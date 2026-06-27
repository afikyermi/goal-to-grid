import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'
import { scheduleTasks } from '@/lib/engine/scheduler'
import type { Task, UserConstraint } from '@/lib/types'
import { recordBehaviorEvent } from '@/lib/behavior/events'
import { getUserWorkspaceId, goalBelongsToWorkspace, taskBelongsToWorkspace } from '@/lib/server/workspace'

type ManualScheduleBody = {
  task_id: string
  scheduled_start: string
  scheduled_end: string
}

type BulkScheduleBody = {
  task_ids: string[]
  window_start: string
  window_end: string
}

type NewTaskScheduleBody = {
  new_task: {
    name: string
    duration_min: number
    priority?: number
    task_type: 'planned' | 'inbox'
    goal_id?: string | null
  }
  scheduled_start: string
  scheduled_end: string
}

const SCHEDULE_SELECT = '*, tasks(id, name, duration_min, priority, goal_id, task_type, inbox_status, goals(id, name, start_date, end_date))'

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
}

function parseScheduleBody(body: unknown): ManualScheduleBody | BulkScheduleBody | NewTaskScheduleBody | null {
  if (!body || typeof body !== 'object') return null
  const data = body as Record<string, unknown>

  if (isUuid(data.task_id) && isDateTime(data.scheduled_start) && isDateTime(data.scheduled_end)) {
    return {
      task_id: data.task_id,
      scheduled_start: data.scheduled_start,
      scheduled_end: data.scheduled_end,
    }
  }

  if (Array.isArray(data.task_ids)
    && data.task_ids.length > 0
    && data.task_ids.every(isUuid)
    && isDateTime(data.window_start)
    && isDateTime(data.window_end)
  ) {
    return {
      task_ids: data.task_ids,
      window_start: data.window_start,
      window_end: data.window_end,
    }
  }

  if (data.new_task && typeof data.new_task === 'object' && isDateTime(data.scheduled_start) && isDateTime(data.scheduled_end)) {
    const newTask = data.new_task as Record<string, unknown>
    const taskType = newTask.task_type === 'inbox' ? 'inbox' : 'planned'
    const goalId = typeof newTask.goal_id === 'string' ? newTask.goal_id : null
    if (
      typeof newTask.name === 'string'
      && newTask.name.trim().length > 0
      && typeof newTask.duration_min === 'number'
      && newTask.duration_min >= 5
      && (taskType === 'inbox' || isUuid(goalId))
    ) {
      return {
        new_task: {
          name: newTask.name,
          duration_min: newTask.duration_min,
          priority: typeof newTask.priority === 'number' ? newTask.priority : undefined,
          task_type: taskType,
          goal_id: goalId,
        },
        scheduled_start: data.scheduled_start,
        scheduled_end: data.scheduled_end,
      }
    }
  }

  return null
}

function isOutsideGoalWindow(
  start: string,
  end: string,
  goal?: { start_date?: string | null; end_date?: string | null } | null
) {
  if (!goal?.start_date || !goal?.end_date) return false
  const scheduledStart = new Date(start)
  const scheduledEnd = new Date(end)
  const goalStart = new Date(`${goal.start_date}T00:00:00`)
  const goalEnd = new Date(`${goal.end_date}T23:59:59.999`)
  return scheduledStart < goalStart || scheduledEnd > goalEnd
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const weekStart = request.nextUrl.searchParams.get('week_start')

  let query = admin
    .from('schedule_items')
    .select(SCHEDULE_SELECT)
    .eq('scheduled_by', user.id)
    .order('scheduled_start')

  if (weekStart) {
    const start = new Date(weekStart)
    if (isNaN(start.getTime())) {
      return Response.json({ error: 'Invalid week_start date' }, { status: 400 })
    }
    const end = new Date(start)
    end.setDate(end.getDate() + 7)
    query = query.gte('scheduled_start', start.toISOString()).lt('scheduled_start', end.toISOString())
  }

  const { data, error } = await query
  if (error) return Response.json({ error: 'Failed to fetch schedule items' }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'You must belong to a workspace first' }, { status: 400 })
  const admin = createAdminClient()

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const body = parseScheduleBody(rawBody)
  if (!body) return Response.json({ error: 'Invalid request body' }, { status: 400 })

  // Create a task from the calendar, then immediately schedule it.
  if ('new_task' in body) {
    const { new_task, scheduled_start, scheduled_end } = body
    if (new Date(scheduled_end) <= new Date(scheduled_start)) {
      return Response.json({ error: 'scheduled_end must be after scheduled_start' }, { status: 400 })
    }

    if (new_task.task_type === 'planned') {
      if (!new_task.goal_id || !(await goalBelongsToWorkspace(new_task.goal_id, workspaceId))) {
        return Response.json({ error: 'Goal not found' }, { status: 404 })
      }
    }

    const { data: createdTask, error: taskError } = await admin
      .from('tasks')
      .insert({
        household_id: workspaceId,
        created_by: user.id,
        goal_id: new_task.task_type === 'planned' ? new_task.goal_id : null,
        name: new_task.name.trim(),
        duration_min: Number(new_task.duration_min),
        priority: new_task.priority ?? 2,
        is_recurring: false,
        recurrence_rule: null,
        task_type: new_task.task_type,
        inbox_status: new_task.task_type === 'inbox' ? 'active' : 'assigned',
      })
      .select('*, goals(id, name, sector_id, start_date, end_date)')
      .single()

    if (taskError || !createdTask) {
      return Response.json({ error: taskError?.message ?? 'Failed to create task' }, { status: 500 })
    }

    const { data, error } = await admin
      .from('schedule_items')
      .insert({
        task_id: createdTask.id,
        scheduled_start,
        scheduled_end,
        scheduled_by: user.id,
        status: 'Pending',
      })
      .select(SCHEDULE_SELECT)
      .single()

    if (error) {
      await admin.from('tasks').delete().eq('id', createdTask.id)
      return Response.json({ error: 'Failed to create schedule item' }, { status: 500 })
    }

    const task = data.tasks as Pick<Task, 'id' | 'name' | 'goal_id' | 'task_type'> & {
      goals?: { id: string; name: string; start_date: string; end_date: string } | null
    }
    const outsideGoalWindow = isOutsideGoalWindow(scheduled_start, scheduled_end, task.goals)

    await recordBehaviorEvent({
      userId: user.id,
      eventType: 'task_scheduled',
      taskId: task.id,
      goalId: task.goal_id,
      scheduleItemId: data.id,
      scheduledStart: scheduled_start,
      scheduledEnd: scheduled_end,
      metadata: {
        source: task.task_type === 'inbox' ? 'calendar_quick_capture' : 'calendar_new_planned_task',
        outside_goal_window: outsideGoalWindow,
      },
    })

    return Response.json({
      message: task.task_type === 'inbox' ? 'Captured inbox task on calendar' : 'Created and scheduled task',
      task: createdTask,
      item: data,
      warning: outsideGoalWindow ? 'This task is outside its goal date range.' : null,
    }, { status: 201 })
  }

  // Manual single-task scheduling
  if ('task_id' in body) {
    const { task_id, scheduled_start, scheduled_end } = body
    if (new Date(scheduled_end) <= new Date(scheduled_start)) {
      return Response.json({ error: 'scheduled_end must be after scheduled_start' }, { status: 400 })
    }
    if (!(await taskBelongsToWorkspace(task_id, workspaceId))) {
      return Response.json({ error: 'Task not found' }, { status: 404 })
    }

    const { data, error } = await admin
      .from('schedule_items')
      .insert({
        task_id,
        scheduled_start,
        scheduled_end,
        scheduled_by: user.id,
        status: 'Pending',
      })
      .select(SCHEDULE_SELECT)
      .single()

    if (error) return Response.json({ error: 'Failed to create schedule item' }, { status: 500 })
    const task = data.tasks as unknown as Pick<Task, 'id' | 'name' | 'goal_id'> & {
      goals?: { id: string; name: string; start_date: string; end_date: string } | null
    }
    const outsideGoalWindow = isOutsideGoalWindow(scheduled_start, scheduled_end, task.goals)

    await recordBehaviorEvent({
      userId: user.id,
      eventType: 'task_scheduled',
      taskId: task.id,
      goalId: task.goal_id,
      scheduleItemId: data.id,
      scheduledStart: scheduled_start,
      scheduledEnd: scheduled_end,
      metadata: { source: 'manual', outside_goal_window: outsideGoalWindow },
    })

    return Response.json({
      message: 'Scheduled task manually',
      item: data,
      warning: outsideGoalWindow ? 'This task is outside its goal date range.' : null,
    }, { status: 201 })
  }

  // Engine-based bulk scheduling
  const { task_ids, window_start, window_end } = body
  if (new Date(window_end) <= new Date(window_start)) {
    return Response.json({ error: 'window_end must be after window_start' }, { status: 400 })
  }

  // Fetch tasks — exclude completed ones
  const { data: tasks, error: tasksError } = await admin
    .from('tasks')
    .select('*, goals!inner(id, name, start_date, end_date, deadline, priority)')
    .in('id', task_ids)
    .eq('household_id', workspaceId)
    .eq('task_type', 'planned')
    .eq('is_completed', false)

  if (tasksError || !tasks) return Response.json({ error: 'Failed to fetch tasks' }, { status: 500 })

  if (tasks.length === 0) {
    return Response.json({ message: 'All specified tasks are already completed', items: [] })
  }

  // Fetch constraints from all household members (via household_availability_windows view)
  const { data: constraints } = await admin
    .from('household_availability_windows')
    .select('user_id, day_of_week, start_time, end_time')

  // Build UserConstraint-compatible objects from the view (no label — privacy-preserving)
  const constraintList: UserConstraint[] = (constraints ?? []).map((c, i) => ({
    id: String(i),
    user_id: c.user_id,
    label: '',
    day_of_week: c.day_of_week,
    recurrence_days: null,
    start_time: c.start_time,
    end_time: c.end_time,
    created_at: '',
  }))

  // Fetch existing busy blocks from all household members (via household_busy_blocks view)
  const { data: busyBlocks } = await admin
    .from('household_busy_blocks')
    .select('scheduled_start, scheduled_end')
    .gte('scheduled_start', window_start)
    .lte('scheduled_end', window_end)

  const { data: externalBusyBlocks } = await admin
    .from('external_calendar_events')
    .select('starts_at, ends_at')
    .eq('user_id', user.id)
    .eq('is_busy', true)
    .gte('starts_at', window_start)
    .lte('starts_at', window_end)

  const newItems = scheduleTasks(
    tasks as Task[],
    constraintList,
    new Date(window_start),
    new Date(window_end),
    [
      ...(busyBlocks ?? []).map(e => ({ start: new Date(e.scheduled_start), end: new Date(e.scheduled_end) })),
      ...(externalBusyBlocks ?? []).map(e => ({ start: new Date(e.starts_at), end: new Date(e.ends_at) })),
    ]
  )

  if (newItems.length === 0) {
    return Response.json({ message: 'No available slots found in the given window', items: [] })
  }

  const itemsWithUser = newItems.map(item => ({ ...item, scheduled_by: user.id }))

  const { data: inserted, error: insertError } = await admin
    .from('schedule_items')
    .insert(itemsWithUser)
    .select(SCHEDULE_SELECT)

  if (insertError) return Response.json({ error: 'Failed to insert schedule items' }, { status: 500 })
  return Response.json({ message: `Scheduled ${inserted.length} tasks`, items: inserted }, { status: 201 })
}

import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { z } from 'zod'
import { scheduleTasks } from '@/lib/engine/scheduler'
import type { Task, UserConstraint } from '@/lib/types'
import { createGoogleEvent, getGoogleConnection } from '@/lib/google/calendar'
import { recordBehaviorEvent } from '@/lib/behavior/events'

const ManualScheduleSchema = z.object({
  task_id: z.string().uuid(),
  scheduled_start: z.string().datetime(),
  scheduled_end: z.string().datetime(),
})

const BulkScheduleSchema = z.object({
  task_ids: z.array(z.string().uuid()).min(1),
  window_start: z.string().datetime(),
  window_end: z.string().datetime(),
})

const PostBodySchema = z.union([
  ManualScheduleSchema,
  BulkScheduleSchema,
])

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

  const weekStart = request.nextUrl.searchParams.get('week_start')

  let query = supabase
    .from('schedule_items')
    .select('*, tasks(id, name, duration_min, priority, goal_id, goals(id, name, start_date, end_date))')
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

  let rawBody: unknown
  try {
    rawBody = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = PostBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })
  }

  const body = parsed.data

  // Manual single-task scheduling
  if ('task_id' in body) {
    const { task_id, scheduled_start, scheduled_end } = body

    const { data, error } = await supabase
      .from('schedule_items')
      .insert({
        task_id,
        scheduled_start,
        scheduled_end,
        scheduled_by: user.id,
        status: 'Pending',
      })
      .select('*, tasks(id, name, duration_min, priority, goal_id, goals(id, name, start_date, end_date))')
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

    try {
      const connection = await getGoogleConnection(user.id)
      if (connection) {
        const googleEventId = await createGoogleEvent(user.id, data, task)
        const { data: synced } = await supabase
          .from('schedule_items')
          .update({ google_event_id: googleEventId })
          .eq('id', data.id)
          .select('*, tasks(id, name, duration_min, priority, goal_id, goals(id, name, start_date, end_date))')
          .single()

        return Response.json({
          message: 'Scheduled task manually and synced to Google',
          item: synced ?? data,
          warning: outsideGoalWindow ? 'This task is outside its goal date range.' : null,
        }, { status: 201 })
      }
    } catch (err) {
      return Response.json({
        message: 'Scheduled task manually, but Google sync failed',
        detail: err instanceof Error ? err.message : 'Unknown Google sync error',
        item: data,
        warning: outsideGoalWindow ? 'This task is outside its goal date range.' : null,
      }, { status: 201 })
    }

    return Response.json({
      message: 'Scheduled task manually',
      item: data,
      warning: outsideGoalWindow ? 'This task is outside its goal date range.' : null,
    }, { status: 201 })
  }

  // Engine-based bulk scheduling
  const { task_ids, window_start, window_end } = body

  // Fetch tasks — exclude completed ones
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*, goals(id, name, start_date, end_date, deadline, priority)')
    .in('id', task_ids)
    .eq('is_completed', false)

  if (tasksError || !tasks) return Response.json({ error: 'Failed to fetch tasks' }, { status: 500 })

  if (tasks.length === 0) {
    return Response.json({ message: 'All specified tasks are already completed', items: [] })
  }

  // Fetch constraints from all household members (via household_availability_windows view)
  const { data: constraints } = await supabase
    .from('household_availability_windows')
    .select('user_id, day_of_week, start_time, end_time')

  // Build UserConstraint-compatible objects from the view (no label — privacy-preserving)
  const constraintList: UserConstraint[] = (constraints ?? []).map((c, i) => ({
    id: String(i),
    user_id: c.user_id,
    label: '',
    day_of_week: c.day_of_week,
    start_time: c.start_time,
    end_time: c.end_time,
    created_at: '',
  }))

  // Fetch existing busy blocks from all household members (via household_busy_blocks view)
  const { data: busyBlocks } = await supabase
    .from('household_busy_blocks')
    .select('scheduled_start, scheduled_end')
    .gte('scheduled_start', window_start)
    .lte('scheduled_end', window_end)

  const { data: externalBusyBlocks } = await supabase
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

  const { data: inserted, error: insertError } = await supabase
    .from('schedule_items')
    .insert(itemsWithUser)
    .select('*, tasks(id, name, duration_min, priority, goal_id, goals(id, name, start_date, end_date))')

  if (insertError) return Response.json({ error: 'Failed to insert schedule items' }, { status: 500 })
  return Response.json({ message: `Scheduled ${inserted.length} tasks`, items: inserted }, { status: 201 })
}

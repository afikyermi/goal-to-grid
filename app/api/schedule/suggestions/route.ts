import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { suggestTaskSlots } from '@/lib/engine/scheduler'
import { recordBehaviorEvent } from '@/lib/behavior/events'
import type { Task, UserConstraint } from '@/lib/types'
import { NextRequest } from 'next/server'
import { getUserWorkspaceId } from '@/lib/server/workspace'

function isUuid(value: unknown): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(new Date(value).getTime())
}

function parseBody(body: unknown) {
  if (!body || typeof body !== 'object') return null
  const data = body as Record<string, unknown>
  if (!Array.isArray(data.task_ids)
    || data.task_ids.length === 0
    || !data.task_ids.every(isUuid)
    || !isDateTime(data.window_start)
    || !isDateTime(data.window_end)
  ) return null

  return {
    task_ids: data.task_ids,
    window_start: data.window_start,
    window_end: data.window_end,
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'You must belong to a workspace first' }, { status: 400 })

  const parsed = parseBody(await request.json().catch(() => null))
  if (!parsed) return Response.json({ error: 'Invalid request body' }, { status: 400 })

  const { task_ids, window_start, window_end } = parsed
  if (new Date(window_end) <= new Date(window_start)) {
    return Response.json({ error: 'window_end must be after window_start' }, { status: 400 })
  }
  const admin = createAdminClient()

  const { data: tasks, error: tasksError } = await admin
    .from('tasks')
    .select('*, goals!inner(id, name, start_date, end_date, deadline, priority, sectors!inner(household_id))')
    .in('id', task_ids)
    .eq('goals.sectors.household_id', workspaceId)
    .eq('is_completed', false)

  if (tasksError || !tasks) return Response.json({ error: 'Failed to fetch tasks' }, { status: 500 })

  const { data: constraints } = await admin
    .from('household_availability_windows')
    .select('user_id, day_of_week, start_time, end_time')

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

  const occupied = [
    ...(busyBlocks ?? []).map(e => ({ start: new Date(e.scheduled_start), end: new Date(e.scheduled_end) })),
    ...(externalBusyBlocks ?? []).map(e => ({ start: new Date(e.starts_at), end: new Date(e.ends_at) })),
  ]

  const rawSuggestions = suggestTaskSlots(
    tasks as Task[],
    constraintList,
    new Date(window_start),
    new Date(window_end),
    occupied,
    3,
  )

  const suggestions = rawSuggestions.map(row => {
    const task = tasks.find(t => t.id === row.task_id)
    return { ...row, task }
  })

  await recordBehaviorEvent({
    userId: user.id,
    eventType: 'suggestions_generated',
    metadata: {
      task_count: task_ids.length,
      window_start,
      window_end,
      suggestions_count: rawSuggestions.reduce((sum, row) => sum + row.suggestions.length, 0),
    },
  })

  return Response.json({ suggestions })
}

import { createClient } from '@/lib/supabase/server'
import { suggestTaskSlots } from '@/lib/engine/scheduler'
import { recordBehaviorEvent } from '@/lib/behavior/events'
import type { Task, UserConstraint } from '@/lib/types'
import { NextRequest } from 'next/server'
import { z } from 'zod'

const BodySchema = z.object({
  task_ids: z.array(z.string().uuid()).min(1),
  window_start: z.string().datetime(),
  window_end: z.string().datetime(),
})

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = BodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 })
  }

  const { task_ids, window_start, window_end } = parsed.data

  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('*, goals(id, name, start_date, end_date, deadline, priority)')
    .in('id', task_ids)
    .eq('is_completed', false)

  if (tasksError || !tasks) return Response.json({ error: 'Failed to fetch tasks' }, { status: 500 })

  const { data: constraints } = await supabase
    .from('household_availability_windows')
    .select('user_id, day_of_week, start_time, end_time')

  const constraintList: UserConstraint[] = (constraints ?? []).map((c, i) => ({
    id: String(i),
    user_id: c.user_id,
    label: '',
    day_of_week: c.day_of_week,
    start_time: c.start_time,
    end_time: c.end_time,
    created_at: '',
  }))

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

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteGoogleEvent, updateGoogleEvent } from '@/lib/google/calendar'
import { recordBehaviorEvent } from '@/lib/behavior/events'
import { scheduleItemBelongsToUser } from '@/lib/server/workspace'
import { NextRequest } from 'next/server'

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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await scheduleItemBelongsToUser(id, user.id))) {
    return Response.json({ error: 'Schedule item not found' }, { status: 404 })
  }

  const body = await request.json()
  const { status, scheduled_start, scheduled_end } = body

  if (status && !['Pending', 'Done', 'Missed'].includes(status)) {
    return Response.json({ error: 'status must be Pending, Done, or Missed' }, { status: 400 })
  }

  const updates: Record<string, string> = {}
  if (status) updates.status = status
  if (scheduled_start) updates.scheduled_start = scheduled_start
  if (scheduled_end) updates.scheduled_end = scheduled_end

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'No updates provided' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('schedule_items')
    .update(updates)
    .eq('id', id)
    .select('*, tasks(id, name, duration_min, priority, goal_id, goals(id, name, start_date, end_date))')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  const task = data.tasks as {
    id: string
    goal_id: string
    goals?: { id: string; name: string; start_date: string; end_date: string } | null
  }
  const outsideGoalWindow = isOutsideGoalWindow(data.scheduled_start, data.scheduled_end, task.goals)

  await recordBehaviorEvent({
    userId: user.id,
    eventType: scheduled_start || scheduled_end ? 'schedule_item_moved' : `schedule_item_${String(data.status).toLowerCase()}`,
    taskId: task.id,
    goalId: task.goal_id,
    scheduleItemId: data.id,
    scheduledStart: data.scheduled_start,
    scheduledEnd: data.scheduled_end,
    metadata: {
      status: data.status,
      outside_goal_window: outsideGoalWindow,
      changed_time: Boolean(scheduled_start || scheduled_end),
    },
  })

  if (data.google_event_id && (scheduled_start || scheduled_end)) {
    try {
      await updateGoogleEvent(data.scheduled_by ?? user.id, data.google_event_id, data)
    } catch (err) {
      return Response.json({
        ...data,
        warning: outsideGoalWindow ? 'This task is outside its goal date range.' : null,
        google_sync_warning: err instanceof Error ? err.message : 'Google update failed',
      })
    }
  }

  return Response.json({
    ...data,
    warning: outsideGoalWindow ? 'This task is outside its goal date range.' : null,
  })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await scheduleItemBelongsToUser(id, user.id))) {
    return Response.json({ error: 'Schedule item not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('schedule_items')
    .select('id, task_id, google_event_id, scheduled_by, scheduled_start, scheduled_end, tasks(goal_id)')
    .eq('id', id)
    .single()

  if (existing?.google_event_id) {
    try {
      await deleteGoogleEvent(existing.scheduled_by ?? user.id, existing.google_event_id)
    } catch {
      // Keep local delete available even if Google already removed the event.
    }
  }

  const { error } = await admin.from('schedule_items').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  await recordBehaviorEvent({
    userId: user.id,
    eventType: 'schedule_item_deleted',
    taskId: existing?.task_id ?? null,
    goalId: (existing?.tasks as { goal_id?: string } | null)?.goal_id ?? null,
    scheduleItemId: existing?.id ?? id,
    scheduledStart: existing?.scheduled_start ?? null,
    scheduledEnd: existing?.scheduled_end ?? null,
  })
  return new Response(null, { status: 204 })
}

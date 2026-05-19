import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { scheduleTasks } from '@/lib/engine/scheduler'
import type { Task, UserConstraint } from '@/lib/types'
import { recordBehaviorEvent } from '@/lib/behavior/events'

export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()
    const now = new Date()

    // Find all Pending items whose window has already passed
    const { data: overdue, error: overdueError } = await admin
      .from('schedule_items')
      .select('*, tasks(id, name, duration_min, priority, goal_id, is_recurring, recurrence_rule, goals(id, name, start_date, end_date, deadline, priority))')
      .eq('status', 'Pending')
      .eq('scheduled_by', user.id)
      .lt('scheduled_end', now.toISOString())

    if (overdueError) {
      console.error('[reschedule] overdue query error:', overdueError.message)
      return Response.json({ error: overdueError.message }, { status: 500 })
    }
    if (!overdue || overdue.length === 0) {
      return Response.json({ message: 'No missed tasks to reschedule', rescheduled: 0 })
    }

    // Mark all as Missed
    const overdueIds = overdue.map(i => i.id)
    const { error: markError } = await admin
      .from('schedule_items')
      .update({ status: 'Missed' })
      .in('id', overdueIds)

    if (markError) {
      console.error('[reschedule] mark-missed error:', markError.message)
      return Response.json({ error: markError.message }, { status: 500 })
    }

    // Fetch constraints via admin client — the view is RLS-gated without a filter
    const { data: constraints, error: constraintsError } = await admin
      .from('household_availability_windows')
      .select('user_id, day_of_week, start_time, end_time')

    if (constraintsError) {
      console.error('[reschedule] constraints query error:', constraintsError.message)
    }

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

    // Window: now → +7 days
    const windowEnd = new Date(now)
    windowEnd.setDate(windowEnd.getDate() + 7)

    // Fetch existing pending items in that window to avoid conflicts
    const { data: existing, error: existingError } = await admin
      .from('schedule_items')
      .select('scheduled_start, scheduled_end')
      .gte('scheduled_start', now.toISOString())
      .lte('scheduled_end', windowEnd.toISOString())
      .eq('status', 'Pending')

    if (existingError) console.error('[reschedule] existing items query error:', existingError.message)

    const { data: externalBusyBlocks, error: externalError } = await admin
      .from('external_calendar_events')
      .select('starts_at, ends_at')
      .eq('user_id', user.id)
      .eq('is_busy', true)
      .gte('starts_at', now.toISOString())
      .lte('starts_at', windowEnd.toISOString())

    if (externalError) console.error('[reschedule] external events query error:', externalError.message)

    // Filter out null task joins (orphaned schedule_items or RLS-hidden tasks)
    const tasks = overdue
      .map(i => i.tasks as unknown as Task | null)
      .filter((t): t is Task => t != null && typeof t.id === 'string')

    const newItems = scheduleTasks(
      tasks,
      constraintList,
      now,
      windowEnd,
      [
        ...(existing ?? []).map(e => ({ start: new Date(e.scheduled_start), end: new Date(e.scheduled_end) })),
        ...(externalBusyBlocks ?? []).map(e => ({ start: new Date(e.starts_at), end: new Date(e.ends_at) })),
      ]
    )

    if (newItems.length > 0) {
      const { error: insertError } = await admin
        .from('schedule_items')
        .insert(newItems.map(item => ({ ...item, scheduled_by: user.id })))
      if (insertError) {
        console.error('[reschedule] insert error:', insertError.message)
        // Non-fatal: items already marked Missed; log and continue
      }
    }

    await recordBehaviorEvent({
      userId: user.id,
      eventType: 'missed_items_self_healed',
      metadata: { missed_count: overdueIds.length, rescheduled_count: newItems.length },
    })

    return Response.json({
      message: `Marked ${overdueIds.length} items as Missed, rescheduled ${newItems.length}`,
      rescheduled: newItems.length,
    })
  } catch (err) {
    console.error('[reschedule] unhandled error:', err)
    return Response.json({ error: 'Internal server error during reschedule' }, { status: 500 })
  }
}

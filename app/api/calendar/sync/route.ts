import { createClient } from '@/lib/supabase/server'
import { createGoogleEvent, isGoogleCalendarConfigured } from '@/lib/google/calendar'
import type { ScheduleItem, Task } from '@/lib/types'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isGoogleCalendarConfigured()) {
    return Response.json({ message: 'Google Calendar OAuth is not configured yet.', synced: 0 }, { status: 501 })
  }

  const { data: items, error } = await supabase
    .from('schedule_items')
    .select('*, tasks(id, name, duration_min, priority, goal_id, is_recurring, recurrence_rule)')
    .eq('scheduled_by', user.id)
    .eq('status', 'Pending')
    .is('google_event_id', null)

  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!items || items.length === 0) {
    return Response.json({ message: 'All pending items already synced', synced: 0 })
  }

  const synced: string[] = []
  const failures: string[] = []

  for (const item of items) {
    try {
      const task = item.tasks as unknown as Task
      const googleEventId = await createGoogleEvent(user.id, item as unknown as ScheduleItem, task)
      await supabase
        .from('schedule_items')
        .update({ google_event_id: googleEventId })
        .eq('id', item.id)
      synced.push(item.id)
    } catch (err) {
      failures.push((err as Error).message)
    }
  }

  if (failures.length > 0) {
    return Response.json(
      {
        message: synced.length > 0
          ? `Synced ${synced.length} events, but some items need attention.`
          : 'Google Calendar needs attention.',
        detail: failures[0],
        synced: synced.length,
      },
      { status: 502 }
    )
  }

  return Response.json({ message: `Synced ${synced.length} events`, synced: synced.length })
}

import { createClient } from '@/lib/supabase/server'
import {
  createGoogleEvent,
  deleteGoogleEvent,
  isGoogleCalendarConfigured,
  listGoogleEvents,
  updateGoogleEvent,
} from '@/lib/google/calendar'
import type { ScheduleItem, Task } from '@/lib/types'

// How far back / forward to reconcile (covers all realistic active tasks).
const SYNC_PAST_MS  = 30  * 24 * 60 * 60 * 1000   // 30 days
const SYNC_FUTURE_MS = 90 * 24 * 60 * 60 * 1000   // 90 days

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  if (!isGoogleCalendarConfigured()) {
    return Response.json({ message: 'Google Calendar OAuth is not configured yet.', synced: 0 }, { status: 501 })
  }

  const now = new Date()
  const timeMin = new Date(now.getTime() - SYNC_PAST_MS).toISOString()
  const timeMax = new Date(now.getTime() + SYNC_FUTURE_MS).toISOString()

  // Fetch all of this user's schedule items (Pending + Done)
  const { data: items, error: itemsErr } = await supabase
    .from('schedule_items')
    .select('*, tasks(id, name, duration_min, priority, goal_id, is_recurring, recurrence_rule)')
    .eq('scheduled_by', user.id)
    .in('status', ['Pending', 'Done'])

  if (itemsErr) return Response.json({ error: itemsErr.message }, { status: 500 })

  const created: string[] = []
  const updated: string[] = []
  const deleted: string[] = []
  const failures: string[] = []

  // ── 1. CREATE — items with no google_event_id ────────────────────────────
  const needsCreate = (items ?? []).filter(i => !i.google_event_id)
  for (const item of needsCreate) {
    try {
      const task = item.tasks as unknown as Task
      const googleEventId = await createGoogleEvent(user.id, item as unknown as ScheduleItem, task)
      await supabase
        .from('schedule_items')
        .update({ google_event_id: googleEventId })
        .eq('id', item.id)
      created.push(item.id)
    } catch (err) {
      failures.push((err as Error).message)
    }
  }

  // ── 2. UPDATE — items that already have a google_event_id ───────────────
  const needsUpdate = (items ?? []).filter(i => !!i.google_event_id)
  for (const item of needsUpdate) {
    try {
      await updateGoogleEvent(user.id, item.google_event_id!, item as unknown as ScheduleItem)
      updated.push(item.id)
    } catch (err) {
      failures.push((err as Error).message)
    }
  }

  // ── 3. DELETE orphans — Google events with no matching DB item ──────────
  try {
    const googleEvents = await listGoogleEvents(user.id, timeMin, timeMax)
    const knownIds = new Set((items ?? []).map(i => i.google_event_id).filter(Boolean))

    for (const ev of googleEvents.items ?? []) {
      const source = (ev.extendedProperties as Record<string, Record<string, string>> | undefined)
        ?.private?.source
      const gId = ev.id as string | undefined
      if (!gId || source !== 'goal-to-grid') continue
      if (!knownIds.has(gId)) {
        try {
          await deleteGoogleEvent(user.id, gId)
          deleted.push(gId)
        } catch {
          // Google may have already removed it — not a critical failure.
        }
      }
    }
  } catch {
    // listGoogleEvents failure (e.g. token expired) is non-fatal; create/update already ran.
  }

  const total = created.length + updated.length
  const parts: string[] = []
  if (created.length) parts.push(`${created.length} created`)
  if (updated.length) parts.push(`${updated.length} updated`)
  if (deleted.length) parts.push(`${deleted.length} removed`)
  const message = parts.length ? `Google Calendar synced: ${parts.join(', ')}.` : 'Google Calendar is already up to date.'

  if (failures.length > 0) {
    return Response.json({ message, detail: failures[0], synced: total }, { status: 502 })
  }

  return Response.json({ message, synced: total })
}

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
const SYNC_PAST_MS = 30 * 24 * 60 * 60 * 1000 // 30 days
const SYNC_FUTURE_MS = 90 * 24 * 60 * 60 * 1000 // 90 days

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const userId = user.id
  if (!isGoogleCalendarConfigured()) {
    return Response.json({ message: 'Google Calendar OAuth is not configured yet.', synced: 0 }, { status: 501 })
  }

  const now = new Date()
  const timeMin = new Date(now.getTime() - SYNC_PAST_MS).toISOString()
  const timeMax = new Date(now.getTime() + SYNC_FUTURE_MS).toISOString()

  const { data: items, error: itemsErr } = await supabase
    .from('schedule_items')
    .select('*, tasks(id, name, duration_min, priority, goal_id, is_recurring, recurrence_rule)')
    .eq('scheduled_by', userId)
    .in('status', ['Pending', 'Done'])

  if (itemsErr) return Response.json({ error: itemsErr.message }, { status: 500 })

  const created: string[] = []
  const updated: string[] = []
  const deleted: string[] = []
  const failures: string[] = []

  async function saveGoogleEventId(itemId: string, googleEventId: string) {
    const { error } = await supabase
      .from('schedule_items')
      .update({ google_event_id: googleEventId })
      .eq('id', itemId)

    if (error) throw new Error(error.message)
  }

  async function createAndLinkEvent(item: NonNullable<typeof items>[number]) {
    const task = item.tasks as unknown as Task
    const googleEventId = await createGoogleEvent(userId, item as unknown as ScheduleItem, task)
    await saveGoogleEventId(item.id, googleEventId)
    return googleEventId
  }

  // 1. Delete orphan Goal-to-Grid events before creating anything new.
  // Otherwise new events can be treated as orphans during the same sync run.
  try {
    const googleEvents = await listGoogleEvents(userId, timeMin, timeMax)
    const knownIds = new Set((items ?? []).map(i => i.google_event_id).filter(Boolean))

    for (const ev of googleEvents.items ?? []) {
      const source = (ev.extendedProperties as Record<string, Record<string, string>> | undefined)
        ?.private?.source
      const googleEventId = ev.id as string | undefined

      if (!googleEventId || source !== 'goal-to-grid') continue
      if (!knownIds.has(googleEventId)) {
        try {
          await deleteGoogleEvent(userId, googleEventId)
          deleted.push(googleEventId)
        } catch {
          // Google may have already removed it; not a critical failure.
        }
      }
    }
  } catch {
    // Orphan cleanup is best-effort. Create/update should still be allowed.
  }

  // 2. Create items with no google_event_id.
  const needsCreate = (items ?? []).filter(item => !item.google_event_id)
  for (const item of needsCreate) {
    try {
      await createAndLinkEvent(item)
      created.push(item.id)
    } catch (err) {
      failures.push((err as Error).message)
    }
  }

  // 3. Update existing events. If the Google event was deleted externally,
  // recreate it and store the replacement id.
  const needsUpdate = (items ?? []).filter(item => Boolean(item.google_event_id))
  for (const item of needsUpdate) {
    try {
      await updateGoogleEvent(userId, item.google_event_id!, item as unknown as ScheduleItem)
      updated.push(item.id)
    } catch (err) {
      const message = (err as Error).message
      if (message.toLowerCase().includes('not found')) {
        try {
          await createAndLinkEvent(item)
          created.push(item.id)
        } catch (createErr) {
          failures.push((createErr as Error).message)
        }
      } else {
        failures.push(message)
      }
    }
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

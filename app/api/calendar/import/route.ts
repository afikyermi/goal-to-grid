import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { listGoogleEvents } from '@/lib/google/calendar'
import { NextRequest } from 'next/server'

type ExternalEventRow = {
  user_id: string
  provider: string
  calendar_id: string
  google_event_id: string
  title: string
  starts_at: string
  ends_at: string
  is_busy: boolean
  raw_payload: Record<string, unknown>
  last_synced_at: string
}

function eventDateTime(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null
  const record = value as Record<string, unknown>
  return typeof record.dateTime === 'string'
    ? record.dateTime
    : typeof record.date === 'string'
      ? `${record.date}T00:00:00.000Z`
      : null
}

function isGoalToGridManagedEvent(event: Record<string, unknown>): boolean {
  const description = typeof event.description === 'string' ? event.description : ''
  if (description.includes('Created by Goal-to-Grid')) return true

  const extendedProperties = event.extendedProperties as Record<string, unknown> | undefined
  const privateProperties = extendedProperties?.private as Record<string, unknown> | undefined
  return privateProperties?.source === 'goal-to-grid'
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const timeMin = body.timeMin ?? new Date().toISOString()
  const timeMax = body.timeMax ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()

  let googleEvents: Awaited<ReturnType<typeof listGoogleEvents>>
  try {
    googleEvents = await listGoogleEvents(user.id, timeMin, timeMax)
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to import Google Calendar events' },
      { status: 502 }
    )
  }

  const rows: ExternalEventRow[] = []

  for (const event of googleEvents.items ?? []) {
    if (event.status === 'cancelled') continue
    if (isGoalToGridManagedEvent(event)) continue

    const startsAt = eventDateTime(event.start)
    const endsAt = eventDateTime(event.end)
    if (!event.id || !startsAt || !endsAt) continue

    rows.push({
      user_id: user.id,
      provider: 'google',
      calendar_id: 'primary',
      google_event_id: String(event.id),
      title: String(event.summary ?? 'Untitled Google event'),
      starts_at: startsAt,
      ends_at: endsAt,
      is_busy: event.transparency !== 'transparent',
      raw_payload: event,
      last_synced_at: new Date().toISOString(),
    })
  }

  const admin = createAdminClient()

  const { error: deleteError } = await admin
    .from('external_calendar_events')
    .delete()
    .eq('user_id', user.id)
    .eq('provider', 'google')
    .eq('calendar_id', 'primary')
    .gte('starts_at', timeMin)
    .lt('starts_at', timeMax)

  if (deleteError) return Response.json({ error: deleteError.message }, { status: 500 })

  if (rows.length === 0) return Response.json({ imported: 0 })

  const { error } = await admin
    .from('external_calendar_events')
    .upsert(rows, { onConflict: 'user_id,provider,calendar_id,google_event_id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ imported: rows.length })
}

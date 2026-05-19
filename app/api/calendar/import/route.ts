import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { listGoogleEvents } from '@/lib/google/calendar'
import { NextRequest } from 'next/server'

const GOOGLE_COLOR_HEX: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6c026', '6': '#f5511d', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#0b8043', '11': '#d60000',
}

type ExternalEventRow = {
  user_id: string
  provider: string
  calendar_id: string
  google_event_id: string
  title: string
  starts_at: string
  ends_at: string
  is_busy: boolean
  last_synced_at: string
  metadata: {
    google_meta: { is_all_day: boolean; is_transparent: boolean; display_color: string | null }
  }
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

function isSelfDeclined(event: Record<string, unknown>): boolean {
  const attendees = event.attendees as Array<Record<string, unknown>> | undefined
  if (!attendees?.length) return false
  const self = attendees.find(a => a.self === true)
  return self?.responseStatus === 'declined'
}

function isAllDayEvent(event: Record<string, unknown>): boolean {
  const start = event.start as Record<string, unknown> | undefined
  return Boolean(start?.date && !start?.dateTime)
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
    console.error('[calendar/import] listGoogleEvents failed:', err)
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to import Google Calendar events' },
      { status: 502 }
    )
  }

  const rows: ExternalEventRow[] = []
  let totalFromGoogle = 0
  let filteredCancelled = 0
  let filteredDeclined = 0
  let filteredManaged = 0
  let filteredMissingFields = 0

  console.log(`[calendar/import] Google returned ${googleEvents.items?.length ?? 0} events for window ${timeMin} → ${timeMax}`)

  for (const event of googleEvents.items ?? []) {
    totalFromGoogle++
    if (event.status === 'cancelled') { filteredCancelled++; continue }
    if (isSelfDeclined(event)) { filteredDeclined++; continue }
    if (isGoalToGridManagedEvent(event)) { filteredManaged++; continue }

    const startsAt = eventDateTime(event.start)
    const endsAt = eventDateTime(event.end)
    if (!event.id || !startsAt || !endsAt) { filteredMissingFields++; continue }

    const colorId = typeof event.colorId === 'string' ? event.colorId : null
    const displayColor = colorId
      ? (GOOGLE_COLOR_HEX[colorId] ?? null)
      : (typeof event._calBgColor === 'string' ? event._calBgColor : null)

    rows.push({
      user_id: user.id,
      provider: 'google',
      calendar_id: 'primary',
      google_event_id: String(event.id),
      title: String(event.summary ?? 'Untitled Google event'),
      starts_at: startsAt,
      ends_at: endsAt,
      is_busy: event.transparency !== 'transparent',
      last_synced_at: new Date().toISOString(),
      metadata: {
        google_meta: {
          is_all_day: isAllDayEvent(event),
          is_transparent: event.transparency === 'transparent',
          display_color: displayColor,
        },
      },
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

  if (rows.length === 0) return Response.json({ imported: 0, total_from_google: totalFromGoogle, filtered_cancelled: filteredCancelled, filtered_declined: filteredDeclined, filtered_managed: filteredManaged, filtered_missing_fields: filteredMissingFields })

  const { error } = await admin
    .from('external_calendar_events')
    .upsert(rows, { onConflict: 'user_id,google_event_id' })

  if (error) return Response.json({ error: error.message }, { status: 500 })

  const { count: verifiedInDb } = await admin
    .from('external_calendar_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('starts_at', timeMin)
    .lt('starts_at', timeMax)

  return Response.json({
    imported: rows.length,
    verified_in_db: verifiedInDb ?? 0,
    total_from_google: totalFromGoogle,
    filtered_cancelled: filteredCancelled,
    filtered_declined: filteredDeclined,
    filtered_managed: filteredManaged,
    filtered_missing_fields: filteredMissingFields,
  })
}

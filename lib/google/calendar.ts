import { createAdminClient } from '@/lib/supabase/admin'
import type { ScheduleItem, Task } from '@/lib/types'
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto'

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_CALENDAR_API = 'https://www.googleapis.com/calendar/v3'
// calendar.events: read/write events. calendar.readonly: required for calendarList.list
// (secondary/subscribed calendars). Both are needed for multi-calendar import.
const CALENDAR_SCOPE = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.readonly',
].join(' ')
const TOKEN_ENVELOPE_PREFIX = 'enc:v1'

type TokenResponse = {
  access_token: string
  refresh_token?: string
  expires_in?: number
  token_type: string
  scope?: string
}

type CalendarConnection = {
  id: string
  user_id: string
  provider: 'google'
  calendar_id: string
  access_token_encrypted: string | null
  refresh_token_encrypted: string | null
  expires_at: string | null
}

export function isGoogleCalendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI)
}

export function isGoogleTokenEncryptionConfigured(): boolean {
  return Boolean(process.env.GOOGLE_TOKEN_ENCRYPTION_KEY)
}

function tokenEncryptionKey(): Buffer | null {
  const secret = process.env.GOOGLE_TOKEN_ENCRYPTION_KEY
  if (!secret) return null
  return createHash('sha256').update(secret).digest()
}

function encryptToken(token: string | null | undefined): string | null {
  if (!token) return null
  if (token.startsWith(`${TOKEN_ENVELOPE_PREFIX}:`)) return token

  const key = tokenEncryptionKey()
  if (!key) return token

  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()

  return [
    TOKEN_ENVELOPE_PREFIX,
    iv.toString('base64url'),
    tag.toString('base64url'),
    encrypted.toString('base64url'),
  ].join(':')
}

function decryptToken(token: string | null | undefined): string | null {
  if (!token) return null
  if (!token.startsWith(`${TOKEN_ENVELOPE_PREFIX}:`)) return token

  const key = tokenEncryptionKey()
  if (!key) {
    throw new Error('Google Calendar token encryption key is missing. Add GOOGLE_TOKEN_ENCRYPTION_KEY or reconnect Google Calendar.')
  }

  const [, version, ivPart, tagPart, encryptedPart] = token.split(':')
  if (version !== 'v1' || !ivPart || !tagPart || !encryptedPart) {
    throw new Error('Google Calendar token data is invalid. Reconnect Google Calendar.')
  }

  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivPart, 'base64url'))
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

export function generateOAuthNonce(): string {
  // Cryptographically random nonce used as the OAuth state param to prevent CSRF.
  // Stored in a short-lived HttpOnly cookie; validated in the callback.
  return randomBytes(32).toString('hex')
}

export function getGoogleAuthUrl(nonce: string): string {
  if (!isGoogleCalendarConfigured()) {
    throw new Error('Google Calendar OAuth is not configured. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.')
  }

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
    response_type: 'code',
    scope: CALENDAR_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state: nonce,
  })

  return `${GOOGLE_AUTH_URL}?${params.toString()}`
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI!,
      grant_type: 'authorization_code',
    }),
  })

  const json = await res.json()
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? 'Failed to exchange Google OAuth code')
  return json as TokenResponse
}

export async function saveGoogleConnection(userId: string, tokens: TokenResponse) {
  const admin = createAdminClient()
  const expiresAt = tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000).toISOString() : null

  const { data: existing } = await admin
    .from('calendar_connections')
    .select('refresh_token_encrypted')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('calendar_id', 'primary')
    .maybeSingle()

  const { error } = await admin
    .from('calendar_connections')
    .upsert({
      user_id: userId,
      provider: 'google',
      calendar_id: 'primary',
      access_token_encrypted: encryptToken(tokens.access_token),
      refresh_token_encrypted: tokens.refresh_token
        ? encryptToken(tokens.refresh_token)
        : existing?.refresh_token_encrypted ?? null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider,calendar_id' })

  if (error) throw new Error(error.message)
}

export async function getGoogleConnection(userId: string): Promise<CalendarConnection | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('calendar_connections')
    .select('*')
    .eq('user_id', userId)
    .eq('provider', 'google')
    .eq('calendar_id', 'primary')
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data as CalendarConnection | null
}

async function refreshAccessToken(connection: CalendarConnection): Promise<string> {
  const refreshToken = decryptToken(connection.refresh_token_encrypted)
  if (!refreshToken) throw new Error('Google Calendar refresh token is missing. Reconnect Google Calendar.')

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  const json = await res.json()
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? 'Failed to refresh Google access token')

  const expiresAt = json.expires_in ? new Date(Date.now() + json.expires_in * 1000).toISOString() : null
  const admin = createAdminClient()
  const { error } = await admin
    .from('calendar_connections')
    .update({
      access_token_encrypted: encryptToken(json.access_token),
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connection.id)

  if (error) throw new Error(error.message)
  return json.access_token
}

export async function getValidAccessToken(userId: string): Promise<{ accessToken: string; calendarId: string } | null> {
  const connection = await getGoogleConnection(userId)
  if (!connection?.access_token_encrypted) return null

  const expiresAt = connection.expires_at ? new Date(connection.expires_at).getTime() : 0
  const shouldRefresh = expiresAt > 0 && expiresAt - Date.now() < 60_000
  const accessToken = shouldRefresh ? await refreshAccessToken(connection) : decryptToken(connection.access_token_encrypted)

  if (!accessToken) return null

  return { accessToken, calendarId: connection.calendar_id }
}

export async function deleteGoogleConnection(userId: string) {
  const admin = createAdminClient()

  await admin
    .from('external_calendar_events')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'google')

  const { error } = await admin
    .from('calendar_connections')
    .delete()
    .eq('user_id', userId)
    .eq('provider', 'google')

  if (error) throw new Error(error.message)
}

async function googleRequest<T>(userId: string, path: string, init: RequestInit = {}): Promise<T> {
  const token = await getValidAccessToken(userId)
  if (!token) throw new Error('Google Calendar is not connected.')

  const res = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.accessToken}`,
      ...(init.headers ?? {}),
    },
  })

  if (res.status === 204) return undefined as T
  const json = await res.json()
  if (!res.ok) throw new Error(json.error?.message ?? 'Google Calendar request failed')
  return json as T
}

export async function createGoogleEvent(userId: string, item: ScheduleItem, task: Pick<Task, 'name'>): Promise<string> {
  const event = await googleRequest<{ id: string }>(userId, '/calendars/primary/events', {
    method: 'POST',
    body: JSON.stringify({
      summary: task.name,
      description: 'Created by Goal-to-Grid',
      extendedProperties: {
        private: {
          source: 'goal-to-grid',
          scheduleItemId: item.id,
        },
      },
      start: { dateTime: item.scheduled_start },
      end: { dateTime: item.scheduled_end },
    }),
  })

  return event.id
}

export async function updateGoogleEvent(userId: string, googleEventId: string, item: Pick<ScheduleItem, 'scheduled_start' | 'scheduled_end'>) {
  await googleRequest(userId, `/calendars/primary/events/${encodeURIComponent(googleEventId)}`, {
    method: 'PATCH',
    body: JSON.stringify({
      start: { dateTime: item.scheduled_start },
      end: { dateTime: item.scheduled_end },
    }),
  })
}

export async function deleteGoogleEvent(userId: string, googleEventId: string) {
  await googleRequest(userId, `/calendars/primary/events/${encodeURIComponent(googleEventId)}`, {
    method: 'DELETE',
  })
}

type CalendarListEntry = { id: string; accessRole: string; selected?: boolean; backgroundColor?: string }

const FALLBACK_CALENDARS: CalendarListEntry[] = [
  { id: 'primary', accessRole: 'owner', selected: true },
]

export async function listGoogleEvents(userId: string, timeMin: string, timeMax: string) {
  let readable: CalendarListEntry[]
  try {
    const calendarList = await googleRequest<{ items?: CalendarListEntry[] }>(
      userId,
      '/users/me/calendarList'
    )
    readable = (calendarList.items ?? []).filter(
      cal => Boolean(cal.id) && cal.accessRole !== 'freeBusyReader' && cal.selected !== false
    )
    if (readable.length === 0) readable = FALLBACK_CALENDARS
  } catch {
    readable = FALLBACK_CALENDARS
  }

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy: 'startTime',
    showHiddenInvitations: 'true',
  })

  const eventArrays = await Promise.all(
    readable.map(cal =>
      googleRequest<{ items?: Array<Record<string, unknown>> }>(
        userId,
        `/calendars/${encodeURIComponent(cal.id)}/events?${params.toString()}`
      )
        .then(r => (r.items ?? []).map(ev => ({ ...ev, _calBgColor: cal.backgroundColor ?? null })))
        .catch(() => [])
    )
  )

  const seen = new Map<string, Record<string, unknown>>()
  for (const event of eventArrays.flat()) {
    if (event && typeof event.id === 'string') seen.set(event.id, event)
  }
  return { items: Array.from(seen.values()) }
}

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getGoogleConnection, getValidAccessToken, isGoogleCalendarConfigured, isGoogleTokenEncryptionConfigured } from '@/lib/google/calendar'

// Diagnostic endpoint — reveals token health without exposing credentials.
// Safe to call; never returns actual token values.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const envOk = {
    GOOGLE_CLIENT_ID: Boolean(process.env.GOOGLE_CLIENT_ID),
    GOOGLE_CLIENT_SECRET: Boolean(process.env.GOOGLE_CLIENT_SECRET),
    GOOGLE_REDIRECT_URI: Boolean(process.env.GOOGLE_REDIRECT_URI),
    GOOGLE_TOKEN_ENCRYPTION_KEY: isGoogleTokenEncryptionConfigured(),
    configured: isGoogleCalendarConfigured(),
  }

  let connection: Awaited<ReturnType<typeof getGoogleConnection>> = null
  let connectionError: string | null = null
  try {
    connection = await getGoogleConnection(user.id)
  } catch (err) {
    connectionError = (err as Error).message
  }

  const tokenState = connection ? {
    has_access_token: Boolean(connection.access_token_encrypted),
    has_refresh_token: Boolean(connection.refresh_token_encrypted),
    access_token_encrypted: Boolean(connection.access_token_encrypted?.startsWith('enc:v1')),
    refresh_token_encrypted: Boolean(connection.refresh_token_encrypted?.startsWith('enc:v1')),
    expires_at: connection.expires_at,
    expired: connection.expires_at ? new Date(connection.expires_at) < new Date() : null,
    needs_refresh: connection.expires_at
      ? new Date(connection.expires_at).getTime() - Date.now() < 60_000
      : null,
  } : null

  let accessTokenResult: 'ok' | string = 'not_attempted'
  if (connection) {
    try {
      const token = await getValidAccessToken(user.id)
      accessTokenResult = token ? 'ok' : 'returned_null'
    } catch (err) {
      accessTokenResult = (err as Error).message
    }
  }

  const admin = createAdminClient()
  const { data: storedEvents, count: storedCount } = await admin
    .from('external_calendar_events')
    .select('google_event_id, title, starts_at, ends_at, is_busy', { count: 'exact' })
    .eq('user_id', user.id)
    .order('starts_at')
    .limit(5)

  return Response.json({
    env: envOk,
    connection_found: Boolean(connection),
    connection_error: connectionError,
    token_state: tokenState,
    get_valid_access_token: accessTokenResult,
    stored_events: { count: storedCount ?? 0, sample: storedEvents ?? [] },
    diagnosis: (() => {
      if (!envOk.configured) return 'MISSING_ENV: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, or GOOGLE_REDIRECT_URI not set'
      if (!envOk.GOOGLE_TOKEN_ENCRYPTION_KEY) return 'MISSING_KEY: GOOGLE_TOKEN_ENCRYPTION_KEY not set — tokens cannot be decrypted'
      if (!connection) return 'NO_CONNECTION: User has not connected Google Calendar'
      if (!tokenState?.has_refresh_token) return 'NO_REFRESH_TOKEN: Reconnect Google Calendar to get a refresh token'
      if (tokenState?.access_token_encrypted === false && envOk.GOOGLE_TOKEN_ENCRYPTION_KEY) {
        return 'TOKEN_NOT_ENCRYPTED: Token in DB is plain-text but encryption key is set — disconnect and reconnect Google Calendar'
      }
      if (accessTokenResult === 'ok') return 'OK: Token is valid'
      return `ERROR: ${accessTokenResult}`
    })(),
  })
}

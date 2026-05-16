import { createClient } from '@/lib/supabase/server'
import {
  getGoogleConnection,
  isGoogleCalendarConfigured,
  isGoogleTokenEncryptionConfigured,
} from '@/lib/google/calendar'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({
      connected: false,
      configured: isGoogleCalendarConfigured(),
      token_encryption_configured: isGoogleTokenEncryptionConfigured(),
    })
  }

  let connection = null
  try {
    connection = await getGoogleConnection(user.id)
  } catch {
    return Response.json({
      configured: isGoogleCalendarConfigured(),
      token_encryption_configured: isGoogleTokenEncryptionConfigured(),
      connected: false,
      migration_applied: false,
    })
  }

  const connected = Boolean(connection)
  const needsReconnect = connected && !connection?.refresh_token_encrypted

  return Response.json({
    configured: isGoogleCalendarConfigured(),
    token_encryption_configured: isGoogleTokenEncryptionConfigured(),
    connected,
    needs_reconnect: needsReconnect,
    migration_applied: true,
    calendar_id: connection?.calendar_id ?? null,
    expires_at: connection?.expires_at ?? null,
  })
}

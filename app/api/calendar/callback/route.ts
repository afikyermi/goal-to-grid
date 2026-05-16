import { createClient } from '@/lib/supabase/server'
import { exchangeCodeForTokens, saveGoogleConnection } from '@/lib/google/calendar'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const NONCE_COOKIE = 'gcal_oauth_nonce'

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin
  const redirectUrl = new URL('/schedule', baseUrl)
  const code = request.nextUrl.searchParams.get('code')
  const state = request.nextUrl.searchParams.get('state')
  const error = request.nextUrl.searchParams.get('error')

  if (error) {
    redirectUrl.searchParams.set('calendar_error', error)
    return Response.redirect(redirectUrl)
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirectUrl.searchParams.set('calendar_error', 'Session expired. Please log in again.')
    return Response.redirect(redirectUrl)
  }

  // Verify CSRF nonce: the state param must match the HttpOnly cookie we set in /connect.
  // This prevents an attacker from forging the callback with a stolen authorization code.
  const cookieStore = await cookies()
  const storedNonce = cookieStore.get(NONCE_COOKIE)?.value

  if (!state || !storedNonce || state !== storedNonce) {
    redirectUrl.searchParams.set('calendar_error', 'OAuth state mismatch. Please try connecting again.')
    return Response.redirect(redirectUrl)
  }

  // Clear the nonce — it's single-use
  cookieStore.delete(NONCE_COOKIE)

  if (!code) {
    redirectUrl.searchParams.set('calendar_error', 'Missing Google OAuth authorization code.')
    return Response.redirect(redirectUrl)
  }

  try {
    const tokens = await exchangeCodeForTokens(code)
    await saveGoogleConnection(user.id, tokens)
    redirectUrl.searchParams.set('calendar_connected', '1')
  } catch (err) {
    redirectUrl.searchParams.set('calendar_error', err instanceof Error ? err.message : 'Failed to connect Google Calendar')
  }

  return Response.redirect(redirectUrl)
}

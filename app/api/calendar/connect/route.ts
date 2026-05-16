import { createClient } from '@/lib/supabase/server'
import { getGoogleAuthUrl, generateOAuthNonce } from '@/lib/google/calendar'
import { cookies } from 'next/headers'

const NONCE_COOKIE = 'gcal_oauth_nonce'
const NONCE_TTL_SECONDS = 600 // 10 minutes — plenty of time to complete OAuth

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.redirect(new URL('/login', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'))
  }

  try {
    const nonce = generateOAuthNonce()

    // Store the nonce in an HttpOnly cookie. The callback route will verify it,
    // preventing CSRF attacks where an attacker forges the redirect with a valid code.
    const cookieStore = await cookies()
    cookieStore.set(NONCE_COOKIE, nonce, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: NONCE_TTL_SECONDS,
      path: '/',
    })

    return Response.redirect(getGoogleAuthUrl(nonce))
  } catch (err) {
    const url = new URL('/schedule', process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000')
    url.searchParams.set('calendar_error', err instanceof Error ? err.message : 'Google Calendar is not configured')
    return Response.redirect(url)
  }
}

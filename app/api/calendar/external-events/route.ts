import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const start = request.nextUrl.searchParams.get('start')
  const end = request.nextUrl.searchParams.get('end')

  let query = supabase
    .from('external_calendar_events')
    .select('*')
    .eq('user_id', user.id)
    .order('starts_at')

  if (start) query = query.gte('starts_at', start)
  if (end) query = query.lt('starts_at', end)

  const { data, error } = await query

  if (error) {
    if (error.message.includes('external_calendar_events')) {
      return Response.json({ events: [], warning: 'Calendar migration has not been applied yet.' })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ events: data ?? [] })
}

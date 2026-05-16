import { createClient } from '@/lib/supabase/server'
import { deleteGoogleConnection } from '@/lib/google/calendar'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await deleteGoogleConnection(user.id)
    return Response.json({ message: 'Google Calendar disconnected.' })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Failed to disconnect Google Calendar' },
      { status: 500 }
    )
  }
}

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Architecture is a documentation page for course review/demo.
  // Use admin client to return global system-wide counts (bypasses RLS).
  const admin = createAdminClient()
  const tables = [
    'households', 'profiles', 'sectors', 'user_constraints', 'goals',
    'priority_levels', 'tasks', 'schedule_items', 'calendar_connections',
    'external_calendar_events', 'user_behavior_events',
  ] as const

  const results = await Promise.all(
    tables.map(t => admin.from(t).select('id', { count: 'exact', head: true }))
  )

  const counts = Object.fromEntries(
    tables.map((t, i) => [t, results[i].count ?? 0])
  )
  return Response.json({ counts })
}

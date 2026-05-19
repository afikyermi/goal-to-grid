import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profile, error: profileError } = await admin
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (profileError || !profile?.household_id) {
    return Response.json({ error: 'You must belong to a household first' }, { status: 400 })
  }

  const { data: householdProfiles, error: householdProfilesError } = await admin
    .from('profiles')
    .select('id')
    .eq('household_id', profile.household_id)

  if (householdProfilesError) return Response.json({ error: householdProfilesError.message }, { status: 500 })

  const userIds = (householdProfiles ?? []).map(p => p.id)
  if (userIds.length === 0) return Response.json([])

  const { data, error } = await admin
    .from('user_constraints')
    .select('*, profiles(id, display_name)')
    .in('user_id', userIds)
    .order('day_of_week', { nullsFirst: true })
    .order('start_time')

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()

  const body = await request.json()
  const { label, recurrence_days, start_time, end_time } = body

  if (!label || !start_time || !end_time) {
    return Response.json({ error: 'label, start_time, and end_time are required' }, { status: 400 })
  }
  if (!recurrence_days || !Array.isArray(recurrence_days) || recurrence_days.length === 0) {
    return Response.json({ error: 'recurrence_days must be a non-empty array of day numbers (0=Sun..6=Sat)' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('user_constraints')
    .insert({
      user_id: user.id,
      label,
      recurrence_days,
      start_time,
      end_time,
    })
    .select('*, profiles(id, display_name)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

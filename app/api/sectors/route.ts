import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

async function getHouseholdId(userId: string) {
  const supabase = await createClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('household_id')
    .eq('id', userId)
    .single()

  if (error) return null
  return profile?.household_id ?? null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('sectors')
    .select('id, household_id, name, created_at')
    .order('name', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const householdId = await getHouseholdId(user.id)
  if (!householdId) return Response.json({ error: 'You must belong to a household first' }, { status: 400 })

  const { name } = await request.json()
  if (!name?.trim()) {
    return Response.json({ error: 'name is required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('sectors')
    .insert({ name: name.trim(), household_id: householdId })
    .select('id, household_id, name, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

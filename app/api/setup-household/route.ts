import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // If user already has a household, nothing to do
  const { data: existing } = await admin
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (existing?.household_id) {
    return Response.json({ household_id: existing.household_id })
  }

  const body = await request.json()
  const { action } = body

  let targetHouseholdId: string

  if (action === 'create') {
    const { name } = body
    if (!name) return Response.json({ error: 'name is required' }, { status: 400 })

    const { data: household, error: householdError } = await admin
      .from('households')
      .insert({ name })
      .select('id')
      .single()

    if (householdError) return Response.json({ error: householdError.message }, { status: 500 })

    targetHouseholdId = household.id
  } else if (action === 'join') {
    const { household_id } = body
    if (!household_id) return Response.json({ error: 'household_id is required' }, { status: 400 })

    const { data: household, error: lookupError } = await admin
      .from('households')
      .select('id')
      .eq('id', household_id)
      .single()

    if (lookupError || !household) {
      return Response.json({ error: 'Household not found' }, { status: 404 })
    }

    targetHouseholdId = household.id
  } else {
    return Response.json({ error: 'Invalid action' }, { status: 400 })
  }

  // upsert guarantees the row exists even if handle_new_user trigger never ran
  const { error: upsertError } = await admin
    .from('profiles')
    .upsert({ id: user.id, household_id: targetHouseholdId, role: 'member' })

  if (upsertError) return Response.json({ error: upsertError.message }, { status: 500 })

  // Verify the write actually landed
  const { data: verified } = await admin
    .from('profiles')
    .select('household_id')
    .eq('id', user.id)
    .single()

  if (!verified?.household_id) {
    return Response.json({ error: 'Profile update did not persist — please try again' }, { status: 500 })
  }

  return Response.json({ household_id: verified.household_id })
}

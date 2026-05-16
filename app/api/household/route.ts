import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

async function getUser(request: NextRequest) {
  // Try Authorization header first (used during registration before cookies are set)
  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  const admin = createAdminClient()

  if (token) {
    const { data: { user } } = await admin.auth.getUser(token)
    if (user) return user
  }

  // Fall back to cookie-based session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function POST(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { name, display_name } = await request.json()
  if (!name) return Response.json({ error: 'name is required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: household, error: householdError } = await admin
    .from('households')
    .insert({ name })
    .select('id')
    .single()

  if (householdError) return Response.json({ error: householdError.message }, { status: 500 })

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({
      id: user.id,
      household_id: household.id,
      display_name: display_name || null,
      role: 'member',
    })

  if (profileError) return Response.json({ error: profileError.message }, { status: 500 })

  return Response.json({ household_id: household.id }, { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const user = await getUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { household_id, display_name } = await request.json()
  if (!household_id) return Response.json({ error: 'household_id is required' }, { status: 400 })

  const admin = createAdminClient()
  const { error } = await admin
    .from('profiles')
    .upsert({
      id: user.id,
      household_id,
      display_name: display_name || null,
      role: 'member',
    })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ success: true })
}

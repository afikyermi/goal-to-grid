import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserWorkspaceId } from '@/lib/server/workspace'
import { NextRequest } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'You must belong to a workspace first' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sectors')
    .select('id, household_id, name, created_at')
    .eq('household_id', workspaceId)
    .order('name', { ascending: true })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'You must belong to a workspace first' }, { status: 400 })

  const { name } = await request.json()
  if (!name?.trim()) {
    return Response.json({ error: 'name is required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sectors')
    .insert({ name: name.trim(), household_id: workspaceId })
    .select('id, household_id, name, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

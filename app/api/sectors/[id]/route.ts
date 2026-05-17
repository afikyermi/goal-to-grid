import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserWorkspaceId, sectorBelongsToWorkspace } from '@/lib/server/workspace'
import { NextRequest } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'You must belong to a workspace first' }, { status: 400 })
  if (!(await sectorBelongsToWorkspace(id, workspaceId))) {
    return Response.json({ error: 'Domain not found' }, { status: 404 })
  }

  const { name } = await request.json()
  if (!name?.trim()) return Response.json({ error: 'name is required' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sectors')
    .update({ name: name.trim() })
    .eq('id', id)
    .select('id, household_id, name, created_at')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'You must belong to a workspace first' }, { status: 400 })
  if (!(await sectorBelongsToWorkspace(id, workspaceId))) {
    return Response.json({ error: 'Domain not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('sectors').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserWorkspaceId, goalBelongsToWorkspace } from '@/lib/server/workspace'
import { NextRequest } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'You must belong to a workspace first' }, { status: 400 })
  if (!(await goalBelongsToWorkspace(id, workspaceId))) {
    return Response.json({ error: 'Goal not found' }, { status: 404 })
  }

  const body = await request.json()
  if ('start_date' in body && 'end_date' in body && new Date(body.start_date) > new Date(body.end_date)) {
    return Response.json({ error: 'start_date must be before or equal to end_date' }, { status: 400 })
  }

  if (body.end_date) body.deadline = body.end_date

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('goals')
    .update(body)
    .eq('id', id)
    .select('*, sectors(id, name)')
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
  if (!(await goalBelongsToWorkspace(id, workspaceId))) {
    return Response.json({ error: 'Goal not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('goals').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

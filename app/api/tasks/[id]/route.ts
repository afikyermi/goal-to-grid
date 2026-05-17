import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserWorkspaceId } from '@/lib/server/workspace'
import { NextRequest } from 'next/server'

async function taskBelongsToWorkspace(taskId: string, workspaceId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tasks')
    .select('id, goals!inner(sectors!inner(household_id))')
    .eq('id', taskId)
    .eq('goals.sectors.household_id', workspaceId)
    .maybeSingle()

  return !error && Boolean(data)
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'You must belong to a workspace first' }, { status: 400 })
  if (!(await taskBelongsToWorkspace(id, workspaceId))) {
    return Response.json({ error: 'Task not found' }, { status: 404 })
  }

  const body = await request.json()
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tasks')
    .update(body)
    .eq('id', id)
    .select('*, goals(id, name, sector_id, start_date, end_date)')
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
  if (!(await taskBelongsToWorkspace(id, workspaceId))) {
    return Response.json({ error: 'Task not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { error } = await admin.from('tasks').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserWorkspaceId, goalBelongsToWorkspace, taskBelongsToWorkspace } from '@/lib/server/workspace'
import { NextRequest } from 'next/server'

const INBOX_SELECT = '*, goals(id, name, sector_id, start_date, end_date), schedule_items(id, scheduled_start, scheduled_end, status)'

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

  const body = await request.json().catch(() => null)
  const action = body?.action
  const admin = createAdminClient()

  let updates: Record<string, unknown>
  if (action === 'assign_to_goal') {
    const goalId = typeof body?.goal_id === 'string' ? body.goal_id : ''
    if (!goalId || !(await goalBelongsToWorkspace(goalId, workspaceId))) {
      return Response.json({ error: 'Goal not found' }, { status: 404 })
    }
    updates = { goal_id: goalId, task_type: 'planned', inbox_status: 'assigned' }
  } else if (action === 'done') {
    updates = { is_completed: true, inbox_status: 'done' }
  } else if (action === 'activate') {
    updates = { is_completed: false, inbox_status: 'active' }
  } else {
    return Response.json({ error: 'Unsupported inbox action' }, { status: 400 })
  }

  const { data, error } = await admin
    .from('tasks')
    .update(updates)
    .eq('id', id)
    .eq('household_id', workspaceId)
    .select(INBOX_SELECT)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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
  const { error } = await admin.from('tasks').delete().eq('id', id).eq('household_id', workspaceId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

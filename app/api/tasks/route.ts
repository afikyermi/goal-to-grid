import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserWorkspaceId, goalBelongsToWorkspace } from '@/lib/server/workspace'
import { NextRequest } from 'next/server'

const TASK_SELECT = '*, goals(id, name, sector_id, start_date, end_date)'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'You must belong to a workspace first' }, { status: 400 })

  const goalId = request.nextUrl.searchParams.get('goal_id')
  const type = request.nextUrl.searchParams.get('type') ?? 'planned'

  const admin = createAdminClient()
  let query = admin
    .from('tasks')
    .select(TASK_SELECT)
    .eq('household_id', workspaceId)
    .order('priority')
    .order('name')

  if (goalId) query = query.eq('goal_id', goalId)
  if (type === 'planned') query = query.eq('task_type', 'planned')
  if (type === 'inbox') query = query.eq('task_type', 'inbox')

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'You must belong to a workspace first' }, { status: 400 })

  const body = await request.json()
  const {
    goal_id,
    name,
    duration_min,
    priority,
    is_recurring,
    recurrence_rule,
    task_type = 'planned',
  } = body

  if (!name || !duration_min) {
    return Response.json({ error: 'name and duration_min are required' }, { status: 400 })
  }

  if (!['planned', 'inbox'].includes(task_type)) {
    return Response.json({ error: 'task_type must be planned or inbox' }, { status: 400 })
  }

  if (task_type === 'planned' && !goal_id) {
    return Response.json({ error: 'goal_id is required for planned tasks' }, { status: 400 })
  }

  if (task_type === 'planned' && !(await goalBelongsToWorkspace(goal_id, workspaceId))) {
    return Response.json({ error: 'Goal not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tasks')
    .insert({
      household_id: workspaceId,
      created_by: user.id,
      goal_id: task_type === 'planned' ? goal_id : null,
      name: String(name).trim(),
      duration_min: Number(duration_min),
      priority: priority ?? 2,
      is_recurring: is_recurring ?? false,
      recurrence_rule: recurrence_rule || null,
      task_type,
      inbox_status: task_type === 'inbox' ? 'active' : 'assigned',
    })
    .select(TASK_SELECT)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

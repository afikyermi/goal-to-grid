import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserWorkspaceId, goalBelongsToWorkspace } from '@/lib/server/workspace'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'You must belong to a workspace first' }, { status: 400 })

  const goalId = request.nextUrl.searchParams.get('goal_id')

  const admin = createAdminClient()
  let query = admin
    .from('tasks')
    .select('*, goals!inner(id, name, sector_id, start_date, end_date, sectors!inner(household_id))')
    .eq('goals.sectors.household_id', workspaceId)
    .order('priority')
    .order('name')

  if (goalId) query = query.eq('goal_id', goalId)

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
  const { goal_id, name, duration_min, priority, is_recurring, recurrence_rule } = body

  if (!goal_id || !name || !duration_min) {
    return Response.json({ error: 'goal_id, name, and duration_min are required' }, { status: 400 })
  }

  if (!(await goalBelongsToWorkspace(goal_id, workspaceId))) {
    return Response.json({ error: 'Goal not found' }, { status: 404 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tasks')
    .insert({
      goal_id,
      name,
      duration_min: Number(duration_min),
      priority: priority ?? 2,
      is_recurring: is_recurring ?? false,
      recurrence_rule: recurrence_rule || null,
    })
    .select('*, goals(id, name, sector_id, start_date, end_date)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

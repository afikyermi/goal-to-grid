import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserWorkspaceId } from '@/lib/server/workspace'

const INBOX_SELECT = '*, schedule_items(id, scheduled_start, scheduled_end, status)'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'You must belong to a workspace first' }, { status: 400 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tasks')
    .select(INBOX_SELECT)
    .eq('household_id', workspaceId)
    .eq('task_type', 'inbox')
    .order('captured_at', { ascending: false })

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data ?? [])
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'You must belong to a workspace first' }, { status: 400 })

  const body = await request.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const durationMin = Number(body?.duration_min ?? 30)
  const priority = Number(body?.priority ?? 2)

  if (!name) return Response.json({ error: 'Task name is required' }, { status: 400 })
  if (!Number.isFinite(durationMin) || durationMin < 5) {
    return Response.json({ error: 'Duration must be at least 5 minutes' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tasks')
    .insert({
      household_id: workspaceId,
      created_by: user.id,
      goal_id: null,
      name,
      duration_min: durationMin,
      priority,
      is_recurring: false,
      recurrence_rule: null,
      task_type: 'inbox',
      inbox_status: 'active',
    })
    .select(INBOX_SELECT)
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

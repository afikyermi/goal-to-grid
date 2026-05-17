import { createAdminClient } from '@/lib/supabase/admin'

export async function getUserWorkspaceId(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('profiles')
    .select('household_id')
    .eq('id', userId)
    .single()

  if (error) return null
  return data?.household_id ?? null
}

export async function sectorBelongsToWorkspace(sectorId: string, workspaceId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('sectors')
    .select('id')
    .eq('id', sectorId)
    .eq('household_id', workspaceId)
    .maybeSingle()

  return !error && Boolean(data)
}

export async function goalBelongsToWorkspace(goalId: string, workspaceId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('goals')
    .select('id, sectors!inner(household_id)')
    .eq('id', goalId)
    .eq('sectors.household_id', workspaceId)
    .maybeSingle()

  return !error && Boolean(data)
}

export async function taskBelongsToWorkspace(taskId: string, workspaceId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('tasks')
    .select('id, goals!inner(sectors!inner(household_id))')
    .eq('id', taskId)
    .eq('goals.sectors.household_id', workspaceId)
    .maybeSingle()

  return !error && Boolean(data)
}

export async function scheduleItemBelongsToUser(scheduleItemId: string, userId: string): Promise<boolean> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('schedule_items')
    .select('id')
    .eq('id', scheduleItemId)
    .eq('scheduled_by', userId)
    .maybeSingle()

  return !error && Boolean(data)
}

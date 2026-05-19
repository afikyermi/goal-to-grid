import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getUserWorkspaceId } from '@/lib/server/workspace'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const workspaceId = await getUserWorkspaceId(user.id)
  if (!workspaceId) return Response.json({ error: 'No workspace' }, { status: 403 })

  const admin = createAdminClient()
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setDate(now.getDate() - now.getDay())
  weekStart.setHours(0, 0, 0, 0)
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekStart.getDate() + 7)

  const [
    { data: sectorsRaw },
    { data: upcomingRaw },
    { count: missedCount },
    { data: weekItems },
  ] = await Promise.all([
    admin
      .from('sectors')
      .select('id, name, goals(id, name, start_date, end_date, deadline, priority, tasks(id, name, duration_min, priority, is_completed))')
      .eq('household_id', workspaceId)
      .order('name', { ascending: true }),
    admin
      .from('schedule_items')
      .select('id, task_id, scheduled_start, scheduled_end, status, tasks(name, priority)')
      .eq('scheduled_by', user.id)
      .eq('status', 'Pending')
      .gte('scheduled_start', now.toISOString())
      .order('scheduled_start')
      .limit(8),
    admin
      .from('schedule_items')
      .select('*', { count: 'exact', head: true })
      .eq('scheduled_by', user.id)
      .eq('status', 'Missed'),
    admin
      .from('schedule_items')
      .select('id, task_id, status')
      .eq('scheduled_by', user.id)
      .gte('scheduled_start', weekStart.toISOString())
      .lt('scheduled_start', weekEnd.toISOString()),
  ])

  const sectors = (sectorsRaw ?? []) as Array<{
    id: string; name: string;
    goals: Array<{
      id: string; name: string; priority: number; start_date: string; end_date: string;
      tasks: Array<{ id: string; name: string; duration_min: number | null; priority: number; is_completed: boolean }> | null
    }> | null
  }>

  const allGoals = sectors.flatMap(s => s.goals ?? [])
  const openTasks = allGoals.flatMap(g => (g.tasks ?? []).filter(t => !t.is_completed))

  const weekDone = (weekItems ?? []).filter(i => i.status === 'Done').length
  const weekTotal = (weekItems ?? []).length
  const completionRate = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : null

  const domainEffort = sectors.map(s => {
    const mins = (s.goals ?? [])
      .flatMap(g => (g.tasks ?? []).filter(t => !t.is_completed))
      .reduce((sum, t) => sum + (t.duration_min ?? 0), 0)
    return { id: s.id, name: s.name, minutes: mins }
  }).filter(d => d.minutes > 0).sort((a, b) => b.minutes - a.minutes)

  const backlog = allGoals
    .map(g => ({
      goalId: g.id,
      goalName: g.name,
      priority: g.priority,
      endDate: g.end_date,
      tasks: (g.tasks ?? [])
        .filter(t => !t.is_completed)
        .sort((a, b) => a.priority - b.priority),
    }))
    .filter(g => g.tasks.length > 0)
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())

  return Response.json({
    sectors: sectorsRaw ?? [],
    upcoming: upcomingRaw ?? [],
    weekItems: (weekItems ?? []).map(i => ({ id: i.id, task_id: (i as Record<string, unknown>).task_id ?? null, status: i.status })),
    missedCount: missedCount ?? 0,
    weekDone,
    weekTotal,
    completionRate,
    openBacklogCount: openTasks.length,
    totalPlannedMin: openTasks.reduce((sum, t) => sum + (t.duration_min ?? 0), 0),
    domainEffort,
    backlog,
  })
}

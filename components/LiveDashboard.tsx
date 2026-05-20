'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, BarChart2, CalendarDays, ClipboardList, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import RunSchedulerButton from '@/components/RunSchedulerButton'
import DomainBoard from '@/components/DomainBoard'
import { cn, formatDuration } from '@/lib/utils'
import { useActiveGoal } from '@/lib/contexts/active-goal-context'

type DashboardTask = { id: string; name: string; duration_min: number; priority: number; is_completed: boolean }
type DashboardGoal = { id: string; name: string; start_date: string; end_date: string; deadline: string | null; priority: number; tasks: DashboardTask[] | null }
type DashboardSector = { id: string; name: string; goals: DashboardGoal[] | null }
type UpcomingItem = { id: string; task_id: string; scheduled_start: string; scheduled_end: string; status: string; tasks: { name: string; priority: number } | null }
type WeekItem = { id: string; task_id: string | null; status: string }
type DomainEffort = { id: string; name: string; minutes: number }
type BacklogTask = { id: string; name: string; duration_min: number; priority: number }
type BacklogGroup = { goalId: string; goalName: string; priority: number; endDate: string; tasks: BacklogTask[] }

export type DashboardData = {
  sectors: DashboardSector[]
  upcoming: UpcomingItem[]
  weekItems: WeekItem[]
  missedCount: number
  weekDone: number
  weekTotal: number
  completionRate: number | null
  openBacklogCount: number
  totalPlannedMin: number
  domainEffort: DomainEffort[]
  backlog: BacklogGroup[]
}

const priorityLabel: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }
const priorityVariant: Record<number, 'destructive' | 'default' | 'secondary'> = { 1: 'destructive', 2: 'default', 3: 'secondary' }

function fmtDate(ds: string) {
  return new Date(ds).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
function fmtTime(ds: string) {
  return new Date(ds).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

function RadialProgress({ value }: { value: number | null }) {
  const pct = value ?? 0
  const r = 28
  const circ = 2 * Math.PI * r
  const dash = value !== null ? (pct / 100) * circ : 0
  return (
    <div className="relative flex items-center justify-center">
      <svg width="72" height="72" className="-rotate-90">
        <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="6"
          className="text-muted/30" />
        {value !== null && (
          <circle cx="36" cy="36" r={r} fill="none" stroke="currentColor" strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            className={`transition-all duration-700 ${value === 100 ? 'text-[var(--status-done)]' : 'text-primary'}`} />
        )}
      </svg>
      <span className={`absolute text-lg font-bold font-mono ${value === null ? 'text-muted-foreground' : ''}`}>
        {value === null ? '—' : `${pct}%`}
      </span>
    </div>
  )
}

export function LiveDashboard({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState<DashboardData>(initialData)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const { activeGoalId, setActiveGoalId } = useActiveGoal()

  const refresh = useCallback(async () => {
    const res = await fetch('/api/dashboard')
    if (res.ok) setData(await res.json())
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'goals' }, () => void refresh())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schedule_items' }, () => void refresh())
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [refresh])

  const handleToggleTask = useCallback(async (taskId: string, completed: boolean) => {
    const snapshot = data
    setData(prev => ({
      ...prev,
      sectors: prev.sectors.map(s => ({
        ...s,
        goals: (s.goals ?? []).map(g => ({
          ...g,
          tasks: (g.tasks ?? []).map(t =>
            t.id === taskId ? { ...t, is_completed: completed } : t
          ),
        })),
      })),
      weekItems: prev.weekItems.map(i =>
        i.task_id === taskId ? { ...i, status: completed ? 'Done' : 'Pending' } : i
      ),
    }))
    setSyncMsg(null)
    try {
      const matchingItems = snapshot.weekItems.filter(i => i.task_id === taskId)
      await Promise.all([
        fetch(`/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_completed: completed }),
        }).then(r => { if (!r.ok) throw new Error('task sync failed') }),
        ...matchingItems.map(i =>
          fetch(`/api/schedule/${i.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: completed ? 'Done' : 'Pending' }),
          }).then(r => { if (!r.ok) throw new Error('schedule sync failed') })
        ),
      ])
    } catch {
      setData(snapshot)
      setSyncMsg('Failed to save — change reverted.')
    }
  }, [data])

  // ── Locally-derived KPIs ────────────────────────────────────────────────
  const allGoals = data.sectors.flatMap(s => s.goals ?? [])
  const openTasks = allGoals.flatMap(g => (g.tasks ?? []).filter(t => !t.is_completed))
  const openBacklogCount = openTasks.length
  const totalPlannedMin = openTasks.reduce((sum, t) => sum + (t.duration_min ?? 0), 0)

  const domainEffort = data.sectors
    .map(s => ({
      id: s.id,
      name: s.name,
      minutes: (s.goals ?? []).flatMap(g => (g.tasks ?? []).filter(t => !t.is_completed))
        .reduce((sum, t) => sum + (t.duration_min ?? 0), 0),
    }))
    .filter(d => d.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)

  const maxDomainMin = domainEffort.length > 0 ? domainEffort[0].minutes : 1

  const backlog = allGoals
    .map(g => ({
      goalId: g.id,
      goalName: g.name,
      priority: g.priority,
      endDate: g.end_date,
      tasks: (g.tasks ?? []).filter(t => !t.is_completed).sort((a, b) => a.priority - b.priority),
    }))
    .filter(g => g.tasks.length > 0)
    .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())

  const weekDone = data.weekItems.filter(i => i.status === 'Done').length
  const weekTotal = data.weekItems.length
  const completionRate = weekTotal > 0 ? Math.round((weekDone / weekTotal) * 100) : null

  const { sectors, upcoming, missedCount } = data
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  return (
    <>
      {/* ── KPI Strip ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className={cn(
          'ao-mount border-[oklch(0.50_0.20_264/0.15)]',
          completionRate === 100 ? 'bg-[var(--status-done-bg)]' : 'bg-gradient-to-b from-card to-muted/20'
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <BarChart2 className="h-4 w-4 text-primary" />Weekly Completion
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <RadialProgress value={completionRate} />
            <div>
              <p className="text-2xl font-bold font-mono">
                {weekDone}<span className="text-sm font-normal text-muted-foreground font-sans">/{weekTotal}</span>
              </p>
              <p className="text-xs text-muted-foreground">tasks this week</p>
            </div>
          </CardContent>
        </Card>

        <Card className="ao-mount bg-gradient-to-b from-card to-muted/20 border-[oklch(0.50_0.20_264/0.15)]" style={{ animationDelay: '60ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <ClipboardList className="h-4 w-4 text-primary" />Open Backlog
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-4xl font-bold font-mono transition-colors duration-300 ${openBacklogCount === 0 ? 'text-primary' : ''}`}>
              {openBacklogCount}
            </p>
            <p className="text-xs text-muted-foreground">
              {openBacklogCount === 0 ? 'All caught up' : 'tasks remaining'}
            </p>
          </CardContent>
        </Card>

        <Card className="ao-mount bg-gradient-to-b from-card to-muted/20 border-[oklch(0.50_0.20_264/0.15)]" style={{ animationDelay: '120ms' }}>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="h-4 w-4 text-primary" />Planned Effort
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold font-mono">{formatDuration(totalPlannedMin)}</p>
            <p className="text-xs text-muted-foreground">across open tasks</p>
          </CardContent>
        </Card>
      </div>

      {/* ── Sync error banner ────────────────────────────────────────────────── */}
      {syncMsg && (
        <div className="ao-slide-up flex items-center justify-between rounded-md border border-destructive bg-destructive/10 px-4 py-2 text-sm text-destructive">
          <span>{syncMsg}</span>
          <button type="button" className="ml-4 shrink-0 font-medium" onClick={() => setSyncMsg(null)}>Dismiss</button>
        </div>
      )}

      {/* ── Active Goal selector ─────────────────────────────────────────────── */}
      {allGoals.length > 0 && (
        <div className="ao-mount flex items-center gap-3 rounded-lg border border-l-2 border-primary bg-[var(--page-bg)] px-4 py-2"
             style={{ animationDelay: '180ms' }}>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Active Goal:</span>
          <select
            className="flex-1 rounded-md border bg-background px-2 py-1 text-sm"
            value={activeGoalId ?? ''}
            onChange={e => setActiveGoalId(e.target.value || null)}
          >
            <option value="">All goals</option>
            {allGoals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
          {activeGoalId && (
            <Button size="sm" variant="ghost" className="shrink-0 transition-opacity duration-200"
                    onClick={() => setActiveGoalId(null)}>
              Clear
            </Button>
          )}
        </div>
      )}

      {/* ── Main two-column layout ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_380px]">

        {/* Left column: Domain Board + Open Backlog */}
        <div className="space-y-4">
          <Card className="ao-mount" style={{ animationDelay: '240ms' }}>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-sm font-semibold uppercase tracking-wider text-foreground">Domain Board</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Check off tasks to track goal progress across your domains.
                  </p>
                </div>
                <Badge variant="outline" className="font-mono tabular-nums">{sectors.length} domains</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {sectors.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="font-medium">Start by creating your first domain.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Use domains as stable headings, then add goals and tasks under them.
                  </p>
                </div>
              ) : (
                <DomainBoard sectors={sectors} activeGoalId={activeGoalId} onToggle={handleToggleTask} />
              )}
            </CardContent>
          </Card>

          <Card className="ao-mount" style={{ animationDelay: '300ms' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Open Backlog</CardTitle>
              <p className="text-sm text-muted-foreground">
                All incomplete tasks, grouped by goal — sorted by deadline, then priority.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {backlog.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="font-medium text-primary">All caught up!</p>
                  <p className="mt-1 text-sm text-muted-foreground">No open tasks remaining.</p>
                </div>
              ) : (
                backlog.map((group, idx) => (
                  <div key={group.goalId} className="ao-slide-up rounded-md border p-3"
                       style={{ animationDelay: `${360 + idx * 40}ms` }}>
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-sm">{group.goalName}</p>
                        <p className="text-xs text-muted-foreground">Due {fmtDate(group.endDate)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Badge variant={priorityVariant[group.priority]}>{priorityLabel[group.priority]}</Badge>
                        <Badge variant="secondary" className="font-mono tabular-nums">{group.tasks.length}</Badge>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {group.tasks.map(task => (
                        <div key={task.id} className="flex items-center gap-2 rounded border bg-muted/20 px-2 py-1.5 text-xs">
                          <span className="flex-1 truncate">{task.name}</span>
                          <span className="shrink-0 text-muted-foreground font-mono">{formatDuration(task.duration_min)}</span>
                          <Badge variant={priorityVariant[task.priority]} className="shrink-0 text-[10px]">
                            {priorityLabel[task.priority]}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column (380px): Execution Health + Upcoming + Domain Effort */}
        <div className="space-y-4">
          <Card
            className={cn(
              'ao-mount transition-colors duration-300',
              missedCount > 0
                ? 'border-destructive bg-destructive/5'
                : 'border-[var(--status-done-border)] bg-[var(--status-done-bg)]'
            )}
            style={{ animationDelay: '300ms' }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <AlertCircle className={`h-4 w-4 ${missedCount > 0 ? 'ao-breathe text-destructive' : 'text-[var(--status-done)]'}`} />
                Execution Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-xs uppercase tracking-wider text-muted-foreground">Missed items</span>
                <span className={`font-mono tabular-nums ${missedCount > 0 ? 'font-semibold text-destructive' : 'font-semibold'}`}>
                  {missedCount}
                </span>
              </div>
              <RunSchedulerButton />
            </CardContent>
          </Card>

          <Card className="ao-mount" style={{ animationDelay: '360ms' }}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                <CalendarDays className="h-4 w-4" />Next Scheduled Work
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Nothing scheduled yet. Run the scheduler after creating actions.
                </div>
              ) : (
                upcoming.map((item, idx) => {
                  const start = new Date(item.scheduled_start)
                  const isToday = start.toDateString() === now.toDateString()
                  const isTomorrow = start.toDateString() === tomorrow.toDateString()
                  const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : fmtDate(item.scheduled_start)
                  return (
                    <div key={item.id} className="ao-slide-up rounded-md border bg-background p-3"
                         style={{ animationDelay: `${420 + idx * 30}ms` }}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.tasks?.name ?? 'Untitled task'}</p>
                          <p className="mt-1 text-xs text-muted-foreground font-mono">
                            {dayLabel} · {fmtTime(item.scheduled_start)}
                          </p>
                        </div>
                        <Badge variant={priorityVariant[item.tasks?.priority ?? 2]}>
                          {priorityLabel[item.tasks?.priority ?? 2]}
                        </Badge>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>

          <Card className="ao-mount" style={{ animationDelay: '420ms' }}>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Effort by Domain</CardTitle>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Time allocated to open tasks per domain.</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {domainEffort.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  No open tasks to display.
                </div>
              ) : (
                domainEffort.map((domain, idx) => {
                  const pct = Math.round((domain.minutes / maxDomainMin) * 100)
                  const isLeading = idx === 0
                  return (
                    <div key={domain.id} className="ao-slide-up space-y-1"
                         style={{ animationDelay: `${480 + idx * 60}ms` }}>
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full bg-primary/70 shrink-0" />
                          <span className="font-medium truncate">{domain.name}</span>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground font-mono ml-2">
                          {formatDuration(domain.minutes)}
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full origin-left ${isLeading ? 'bg-primary/80' : 'bg-primary/40'}`}
                          style={{
                            width: `${pct}%`,
                            animation: `ao-bar-scale 700ms cubic-bezier(0.4,0,0.2,1) ${480 + idx * 80}ms both`,
                            boxShadow: isLeading ? '0 0 8px oklch(0.205 0 0 / 0.25)' : 'none',
                          }}
                        />
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </>
  )
}

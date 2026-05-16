import Link from 'next/link'
import { AlertCircle, CalendarDays, CheckSquare, Clock, Layers, Plus, Target } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import RunSchedulerButton from '@/components/RunSchedulerButton'
import DomainBoard from '@/components/DomainBoard'
import { formatDuration } from '@/lib/utils'

type DashboardTask = {
  id: string
  name: string
  duration_min: number
  priority: number
  is_completed: boolean
}

type DashboardGoal = {
  id: string
  name: string
  start_date: string
  end_date: string
  deadline: string | null
  priority: number
  tasks: DashboardTask[] | null
}

type DashboardSector = {
  id: string
  name: string
  goals: DashboardGoal[] | null
}

type UpcomingItem = {
  id: string
  scheduled_start: string
  scheduled_end: string
  status: string
  tasks: {
    name: string
    priority: number
  } | null
}

const priorityLabel: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }
const priorityVariant: Record<number, 'destructive' | 'default' | 'secondary'> = {
  1: 'destructive',
  2: 'default',
  3: 'secondary',
}

function formatShortDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)

  const [
    { data: sectorsRaw },
    { data: upcomingRaw },
    { count: missedCount },
  ] = await Promise.all([
    supabase
      .from('sectors')
      .select('id, name, goals(id, name, start_date, end_date, deadline, priority, tasks(id, name, duration_min, priority, is_completed))')
      .order('name', { ascending: true }),
    supabase
      .from('schedule_items')
      .select('id, scheduled_start, scheduled_end, status, tasks(name, priority)')
      .eq('status', 'Pending')
      .gte('scheduled_start', now.toISOString())
      .order('scheduled_start')
      .limit(8),
    supabase
      .from('schedule_items')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'Missed'),
  ])

  const sectors = (sectorsRaw ?? []) as unknown as DashboardSector[]
  const upcoming = (upcomingRaw ?? []) as unknown as UpcomingItem[]
  const boardSectors = sectors

  const allGoals = sectors.flatMap(sector => sector.goals ?? [])
  const allTasks = allGoals.flatMap(goal => goal.tasks ?? [])
  const unscheduledTaskIds = new Set(allTasks.map(task => task.id))
  for (const item of upcoming) {
    const taskName = item.tasks?.name
    const matchingTask = allTasks.find(task => task.name === taskName)
    if (matchingTask) unscheduledTaskIds.delete(matchingTask.id)
  }

  const plannedMinutes = allTasks.reduce((sum, task) => sum + task.duration_min, 0)

  const stats = [
    { label: 'Domains', value: sectors.length, icon: Layers },
    { label: 'Goals', value: allGoals.length, icon: Target },
    { label: 'Actions', value: allTasks.length, icon: CheckSquare },
    { label: 'Planned effort', value: formatDuration(plannedMinutes), icon: Clock },
  ]

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Household Workspace</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            One place to see your domains, goals, practical tasks, constraints, and the next scheduled work.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/sectors"><Plus className="h-4 w-4 mr-2" />Domains</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/schedule">Open Schedule</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map(stat => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <stat.icon className="h-4 w-4" />
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Domain Board</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Check off tasks to track goal progress across your domains.
                  </p>
                </div>
                <Badge variant="outline">{boardSectors.length} domains</Badge>
              </div>
            </CardHeader>
            <CardContent>
              {boardSectors.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="font-medium">Start by creating your first domain.</p>
                  <p className="mt-1 text-sm text-muted-foreground">Use domains as stable headings, then add goals and tasks under them.</p>
                </div>
              ) : (
                <DomainBoard sectors={boardSectors} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className={(missedCount ?? 0) > 0 ? 'border-destructive' : ''}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5" />
                Execution Health
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Missed items</span>
                <span className={(missedCount ?? 0) > 0 ? 'font-semibold text-destructive' : 'font-semibold'}>{missedCount ?? 0}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Unscheduled actions</span>
                <span className="font-semibold">{unscheduledTaskIds.size}</span>
              </div>
              <RunSchedulerButton />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                Next Scheduled Work
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {upcoming.length === 0 ? (
                <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                  Nothing scheduled yet. Run the scheduler after creating actions.
                </div>
              ) : (
                upcoming.map(item => {
                  const start = new Date(item.scheduled_start)
                  const isToday = start.toDateString() === now.toDateString()
                  const isTomorrow = start.toDateString() === tomorrow.toDateString()
                  const dayLabel = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : formatShortDate(item.scheduled_start)
                  return (
                    <div key={item.id} className="rounded-md border bg-background p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">{item.tasks?.name ?? 'Untitled task'}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{dayLabel} at {formatTime(item.scheduled_start)}</p>
                        </div>
                        <Badge variant={priorityVariant[item.tasks?.priority ?? 2]}>{priorityLabel[item.tasks?.priority ?? 2]}</Badge>
                      </div>
                    </div>
                  )
                })
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

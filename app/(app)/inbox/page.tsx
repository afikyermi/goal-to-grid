'use client'

import { useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { GoalWithSector, ScheduleStatus, Task } from '@/lib/types'
import { cn, formatDuration } from '@/lib/utils'
import { CalendarPlus, CheckCircle2, Inbox, Link2, Plus, Trash2 } from 'lucide-react'

type InboxSchedule = {
  id: string
  scheduled_start: string
  scheduled_end: string
  status: ScheduleStatus
}

type InboxTask = Task & {
  schedule_items?: InboxSchedule[] | null
}

type ViewFilter = 'active' | 'scheduled' | 'done'

const PRIORITY_LABELS: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }

function pad2(value: number) {
  return String(value).padStart(2, '0')
}

function toDateInput(date: Date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function toTimeInput(date: Date) {
  return date.toTimeString().slice(0, 5)
}

function dateTimeLocal(date: string, time: string) {
  return new Date(`${date}T${time}:00`)
}

function normalizeDurationParts(hours: number, minutes: number) {
  const total = Math.max(0, Math.round(hours) * 60 + Math.round(minutes))
  return { hours: Math.floor(total / 60), minutes: total % 60 }
}

function nextSchedule(task: InboxTask) {
  const future = (task.schedule_items ?? [])
    .filter(item => item.status === 'Pending')
    .sort((a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime())
  return future[0] ?? null
}

export default function InboxPage() {
  const [tasks, setTasks] = useState<InboxTask[]>([])
  const [goals, setGoals] = useState<GoalWithSector[]>([])
  const [filter, setFilter] = useState<ViewFilter>('active')
  const [quickName, setQuickName] = useState('')
  const [quickDuration, setQuickDuration] = useState(30)
  const [quickPriority, setQuickPriority] = useState(2)
  const [error, setError] = useState<string | null>(null)
  const [placingTask, setPlacingTask] = useState<InboxTask | null>(null)
  const [assigningTask, setAssigningTask] = useState<InboxTask | null>(null)
  const [selectedGoalId, setSelectedGoalId] = useState('')
  const [placeForm, setPlaceForm] = useState(() => ({
    date: toDateInput(new Date()),
    start_time: toTimeInput(new Date()),
    durationHours: 0,
    durationMins: 30,
  }))

  async function fetchAll() {
    const [inboxRes, goalsRes] = await Promise.all([fetch('/api/inbox'), fetch('/api/goals')])
    if (inboxRes.ok) setTasks(await inboxRes.json())
    if (goalsRes.ok) setGoals(await goalsRes.json())
  }

  useEffect(() => { void Promise.resolve().then(fetchAll) }, [])

  const visibleTasks = useMemo(() => {
    return tasks.filter(task => {
      const scheduled = Boolean(nextSchedule(task))
      if (filter === 'done') return task.inbox_status === 'done' || task.is_completed
      if (filter === 'scheduled') return task.inbox_status !== 'done' && scheduled
      return task.inbox_status === 'active' && !task.is_completed
    })
  }, [filter, tasks])

  async function createQuickTask(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const name = quickName.trim()
    if (!name) return
    const res = await fetch('/api/inbox', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, duration_min: quickDuration, priority: quickPriority }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed to create inbox task.')
      return
    }
    setTasks(prev => [json, ...prev])
    setQuickName('')
    setQuickDuration(30)
    setQuickPriority(2)
  }

  async function markDone(task: InboxTask) {
    const res = await fetch(`/api/inbox/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'done' }),
    })
    if (!res.ok) return
    const updated = await res.json()
    setTasks(prev => prev.map(t => t.id === task.id ? updated : t))
  }

  async function deleteTask(task: InboxTask) {
    if (!confirm('Delete this inbox task?')) return
    const res = await fetch(`/api/inbox/${task.id}`, { method: 'DELETE' })
    if (res.ok) setTasks(prev => prev.filter(t => t.id !== task.id))
  }

  function openPlace(task: InboxTask) {
    setPlacingTask(task)
    setPlaceForm({
      date: toDateInput(new Date()),
      start_time: toTimeInput(new Date()),
      durationHours: Math.floor(task.duration_min / 60),
      durationMins: task.duration_min % 60,
    })
  }

  async function placeTask(e: React.FormEvent) {
    e.preventDefault()
    if (!placingTask) return
    const duration = placeForm.durationHours * 60 + placeForm.durationMins
    if (duration < 5) {
      setError('Duration must be at least 5 minutes.')
      return
    }
    const start = dateTimeLocal(placeForm.date, placeForm.start_time)
    const end = new Date(start.getTime() + duration * 60000)
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: placingTask.id,
        scheduled_start: start.toISOString(),
        scheduled_end: end.toISOString(),
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed to place task on calendar.')
      return
    }
    setPlacingTask(null)
    await fetchAll()
  }

  function openAssign(task: InboxTask) {
    setAssigningTask(task)
    setSelectedGoalId(goals[0]?.id ?? '')
  }

  async function assignToGoal(e: React.FormEvent) {
    e.preventDefault()
    if (!assigningTask || !selectedGoalId) return
    const res = await fetch(`/api/inbox/${assigningTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign_to_goal', goal_id: selectedGoalId }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error ?? 'Failed to assign task to goal.')
      return
    }
    setAssigningTask(null)
    setTasks(prev => prev.filter(t => t.id !== json.id))
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Inbox className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold">Inbox</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Quick tasks waiting to be scheduled, completed, or organized into a goal.
          </p>
        </div>
        <Badge variant="secondary" className="rounded-md">{tasks.filter(t => t.inbox_status === 'active' && !t.is_completed).length} active</Badge>
      </div>

      <form onSubmit={createQuickTask} className="rounded-xl border bg-card p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_120px_130px_auto]">
          <div className="space-y-1.5">
            <Label>Quick add</Label>
            <Input value={quickName} onChange={e => setQuickName(e.target.value)} placeholder="Capture a task without planning it yet..." />
          </div>
          <div className="space-y-1.5">
            <Label>Minutes</Label>
            <Input type="number" min={5} step={5} value={quickDuration} onChange={e => setQuickDuration(Math.max(5, Number(e.target.value)))} />
          </div>
          <div className="space-y-1.5">
            <Label>Priority</Label>
            <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" value={quickPriority} onChange={e => setQuickPriority(Number(e.target.value))}>
              <option value={1}>High</option>
              <option value={2}>Medium</option>
              <option value={3}>Low</option>
            </select>
          </div>
          <Button type="submit" className="self-end"><Plus className="mr-2 h-4 w-4" />Add</Button>
        </div>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      </form>

      <div className="flex w-fit rounded-md border bg-card p-1">
        {[
          ['active', 'Active'],
          ['scheduled', 'Scheduled'],
          ['done', 'Done'],
        ].map(([value, label]) => (
          <Button key={value} type="button" size="sm" variant={filter === value ? 'default' : 'ghost'} onClick={() => setFilter(value as ViewFilter)}>
            {label}
          </Button>
        ))}
      </div>

      <div className="space-y-3">
        {visibleTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card p-10 text-center">
            <Inbox className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No inbox tasks here.</p>
            <p className="mt-1 text-sm text-muted-foreground">Capture something quickly, then decide what to do with it later.</p>
          </div>
        ) : visibleTasks.map(task => {
          const schedule = nextSchedule(task)
          return (
            <div key={task.id} className={cn('rounded-xl border bg-card p-4 shadow-sm', task.is_completed && 'opacity-65')}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className={cn('font-semibold', task.is_completed && 'line-through')}>{task.name}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">{formatDuration(task.duration_min)}</Badge>
                    <Badge variant="secondary">{PRIORITY_LABELS[task.priority] ?? 'Priority'}</Badge>
                    {schedule ? (
                      <Badge variant="outline">
                        {new Date(schedule.scheduled_start).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </Badge>
                    ) : (
                      <Badge variant="outline">Not scheduled</Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openPlace(task)}><CalendarPlus className="mr-1.5 h-4 w-4" />Place</Button>
                  <Button size="sm" variant="outline" onClick={() => openAssign(task)}><Link2 className="mr-1.5 h-4 w-4" />Assign</Button>
                  <Button size="sm" variant="outline" onClick={() => markDone(task)}><CheckCircle2 className="mr-1.5 h-4 w-4" />Done</Button>
                  <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive" onClick={() => deleteTask(task)}><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <Dialog open={!!placingTask} onOpenChange={next => { if (!next) setPlacingTask(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Place in Calendar</DialogTitle>
            <DialogDescription>{placingTask?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={placeTask} className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Date</Label>
                <Input type="date" value={placeForm.date} onChange={e => setPlaceForm(f => ({ ...f, date: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Start</Label>
                <Input type="time" step={900} value={placeForm.start_time} onChange={e => setPlaceForm(f => ({ ...f, start_time: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <div className="flex items-center gap-1.5">
                  <Input type="number" min={0} className="w-16" value={placeForm.durationHours} onChange={e => setPlaceForm(f => ({ ...f, durationHours: Math.max(0, Number(e.target.value)) }))} />
                  <span className="text-sm text-muted-foreground">h</span>
                  <Input
                    type="number"
                    min={0}
                    step={5}
                    className="w-16"
                    value={placeForm.durationMins}
                    onChange={e => setPlaceForm(f => {
                      const next = normalizeDurationParts(f.durationHours, Number(e.target.value))
                      return { ...f, durationHours: next.hours, durationMins: next.minutes }
                    })}
                  />
                  <span className="text-sm text-muted-foreground">m</span>
                </div>
              </div>
            </div>
            <Button type="submit" className="w-full">Place Task</Button>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!assigningTask} onOpenChange={next => { if (!next) setAssigningTask(null) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign to Goal</DialogTitle>
            <DialogDescription>{assigningTask?.name}</DialogDescription>
          </DialogHeader>
          <form onSubmit={assignToGoal} className="space-y-4">
            <div className="space-y-2">
              <Label>Goal</Label>
              <select className="w-full rounded-md border bg-background px-3 py-2 text-sm" value={selectedGoalId} onChange={e => setSelectedGoalId(e.target.value)} required>
                <option value="">Select a goal...</option>
                {goals.map(goal => (
                  <option key={goal.id} value={goal.id}>{goal.sectors?.name ?? 'No domain'} / {goal.name}</option>
                ))}
              </select>
            </div>
            <Button type="submit" className="w-full" disabled={!selectedGoalId}>Assign to Goal</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

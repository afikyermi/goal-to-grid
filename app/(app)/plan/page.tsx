'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn, formatDuration } from '@/lib/utils'
import type { Goal, Sector, Task } from '@/lib/types'
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock,
  Columns3,
  Flag,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
} from 'lucide-react'

const PRIORITY_LABELS: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }
const PRIORITY_VARIANTS: Record<number, 'destructive' | 'default' | 'secondary'> = {
  1: 'destructive',
  2: 'default',
  3: 'secondary',
}

type GoalWithTasks = Goal & { tasks: Task[] }
type SectorWithGoals = Sector & { goals: GoalWithTasks[] }
type SectorForm = { name: string }
type GoalForm = { sector_id: string; name: string; start_date: string; end_date: string; priority: number }
type TaskForm = { goal_id: string; name: string; durationHours: number; durationMins: number; priority: number; is_recurring: boolean; recurrence_rule: string }

function getSectorForm(editing: Sector | null): SectorForm {
  return { name: editing?.name ?? '' }
}

function getGoalForm(editing: Goal | null, defaultSectorId: string): GoalForm {
  return editing
    ? { sector_id: editing.sector_id, name: editing.name, start_date: editing.start_date, end_date: editing.end_date, priority: editing.priority }
    : { sector_id: defaultSectorId, name: '', start_date: '', end_date: '', priority: 2 }
}

function getTaskForm(editing: Task | null, defaultGoalId: string): TaskForm {
  if (!editing) return { goal_id: defaultGoalId, name: '', durationHours: 0, durationMins: 30, priority: 2, is_recurring: false, recurrence_rule: '' }
  return {
    goal_id: editing.goal_id,
    name: editing.name,
    durationHours: Math.floor(editing.duration_min / 60),
    durationMins: editing.duration_min % 60,
    priority: editing.priority,
    is_recurring: editing.is_recurring,
    recurrence_rule: editing.recurrence_rule ?? '',
  }
}

function normalizeDurationParts(hours: number, minutes: number) {
  const total = Math.max(0, Math.round(hours) * 60 + Math.round(minutes))
  return {
    hours: Math.floor(total / 60),
    minutes: total % 60,
  }
}

function SectorDialog({ open, onOpenChange, editing, onSaved }: {
  open: boolean
  onOpenChange: (value: boolean) => void
  editing: Sector | null
  onSaved: (sector: Sector, isNew: boolean) => void
}) {
  const [form, setForm] = useState<SectorForm>(() => getSectorForm(editing))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch(editing ? `/api/sectors/${editing.id}` : '/api/sectors', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error)
      setLoading(false)
      return
    }
    onSaved(json, !editing)
    onOpenChange(false)
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Domain' : 'Create Domain'}</DialogTitle>
          <DialogDescription>A domain is only a heading, such as Personal, Studies, Career, or Family.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Domain name</Label>
            <Input placeholder="e.g. Personal, Career, Studies" value={form.name} onChange={e => setForm({ name: e.target.value })} required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Saving...' : editing ? 'Save Domain' : 'Create Domain'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function GoalDialog({ open, onOpenChange, editing, sectors, defaultSectorId, onSaved }: {
  open: boolean
  onOpenChange: (value: boolean) => void
  editing: Goal | null
  sectors: Sector[]
  defaultSectorId: string
  onSaved: (goal: Goal, isNew: boolean) => void
}) {
  const [form, setForm] = useState<GoalForm>(() => getGoalForm(editing, defaultSectorId))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch(editing ? `/api/goals/${editing.id}` : '/api/goals', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error)
      setLoading(false)
      return
    }
    onSaved(json, !editing)
    onOpenChange(false)
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Goal' : 'Add Goal'}</DialogTitle>
          <DialogDescription>A goal is a clear result with a required start date and end date.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Domain</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.sector_id} onChange={e => setForm(f => ({ ...f, sector_id: e.target.value }))} required>
              <option value="">Select a domain...</option>
              {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Goal name</Label>
            <Input placeholder="e.g. Paint the room" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Start date</Label>
              <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} required />
            </div>
            <div className="space-y-2">
              <Label>End date</Label>
              <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} required />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}>
              <option value={1}>High</option>
              <option value={2}>Medium</option>
              <option value={3}>Low</option>
            </select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Saving...' : editing ? 'Save Goal' : 'Add Goal'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TaskDialog({ open, onOpenChange, editing, goals, defaultGoalId, onSaved }: {
  open: boolean
  onOpenChange: (value: boolean) => void
  editing: Task | null
  goals: Goal[]
  defaultGoalId: string
  onSaved: (task: Task, isNew: boolean) => void
}) {
  const [form, setForm] = useState<TaskForm>(() => getTaskForm(editing, defaultGoalId))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const durationPreview = formatDuration(form.durationHours * 60 + form.durationMins)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const duration_min = form.durationHours * 60 + form.durationMins
    if (duration_min < 5) {
      setError('Duration must be at least 5 minutes.')
      return
    }
    setLoading(true)
    setError(null)
    const res = await fetch(editing ? `/api/tasks/${editing.id}` : '/api/tasks', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goal_id: form.goal_id, name: form.name, duration_min, priority: form.priority, is_recurring: form.is_recurring, recurrence_rule: form.recurrence_rule || null }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error)
      setLoading(false)
      return
    }
    onSaved(json, !editing)
    onOpenChange(false)
    setLoading(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit Task' : 'Add Task'}</DialogTitle>
          <DialogDescription>A task is the practical action that can later be placed on the calendar.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Goal</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.goal_id} onChange={e => setForm(f => ({ ...f, goal_id: e.target.value }))} required>
              <option value="">Select a goal...</option>
              {goals.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label>Task name</Label>
            <Input placeholder="e.g. Buy paint supplies" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div className="space-y-2">
            <Label>Duration <span className="text-muted-foreground font-normal">= {durationPreview}</span></Label>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Hours</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.durationHours}
                  onChange={e => setForm(f => ({ ...f, durationHours: Math.max(0, Number(e.target.value)) }))}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Minutes</Label>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={form.durationMins}
                  onChange={e => setForm(f => {
                    const next = normalizeDurationParts(f.durationHours, Number(e.target.value))
                    return { ...f, durationHours: next.hours, durationMins: next.minutes }
                  })}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">You can type 90 minutes; it will become 1h 30m automatically.</p>
          </div>
          <div className="space-y-2">
            <Label>Priority</Label>
            <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: Number(e.target.value) }))}>
              <option value={1}>High</option>
              <option value={2}>Medium</option>
              <option value={3}>Low</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="recurring" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} className="h-4 w-4" />
            <Label htmlFor="recurring" className="cursor-pointer">Recurring task</Label>
          </div>
          {form.is_recurring && (
            <div className="space-y-2">
              <Label>Recurrence rule (RRULE)</Label>
              <Input placeholder="e.g. FREQ=WEEKLY;BYDAY=MO,WE" value={form.recurrence_rule} onChange={e => setForm(f => ({ ...f, recurrence_rule: e.target.value }))} />
            </div>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={loading} className="w-full">{loading ? 'Saving...' : editing ? 'Save Task' : 'Add Task'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function TaskRow({ task, onEdit, onDelete, onToggleComplete }: {
  task: Task
  onEdit: () => void
  onDelete: () => void
  onToggleComplete: () => void
}) {
  return (
    <div className={cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm group', task.is_completed && 'opacity-60')}>
      <button onClick={onToggleComplete} className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
        {task.is_completed ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Circle className="h-4 w-4" />}
      </button>
      <span className={cn('flex-1 truncate', task.is_completed && 'line-through text-muted-foreground')}>{task.name}</span>
      <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(task.duration_min)}</span>
      <Badge variant={PRIORITY_VARIANTS[task.priority]} className="text-xs shrink-0">{PRIORITY_LABELS[task.priority]}</Badge>
      {task.is_recurring && <span title="Recurring"><RefreshCw className="h-3 w-3 text-muted-foreground shrink-0" /></span>}
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <button onClick={onEdit} className="p-0.5 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
        <button onClick={onDelete} className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  )
}

function GoalRow({ goal, onEdit, onDelete, onAddTask, onEditTask, onDeleteTask, onToggleTask }: {
  goal: GoalWithTasks
  onEdit: () => void
  onDelete: () => void
  onAddTask: () => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  onToggleTask: (task: Task) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const completedCount = goal.tasks.filter(t => t.is_completed).length
  const totalCount = goal.tasks.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  return (
    <div className="rounded-md border bg-background">
      <div className="flex items-center gap-2 px-3 py-2 group">
        <button onClick={() => setExpanded(v => !v)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <span className="flex-1 font-medium text-sm truncate">{goal.name}</span>
        {totalCount > 0 && <span className="text-xs text-muted-foreground shrink-0">{completedCount}/{totalCount}</span>}
        <Badge variant={PRIORITY_VARIANTS[goal.priority]} className="text-xs shrink-0"><Flag className="h-3 w-3 mr-1" />{PRIORITY_LABELS[goal.priority]}</Badge>
        <span className="text-xs text-muted-foreground shrink-0 flex items-center gap-1"><CalendarDays className="h-3 w-3" />{goal.start_date} - {goal.end_date}</span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onEdit} className="p-0.5 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onDelete} className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {totalCount > 0 && (
        <div className="mx-3 h-1 rounded-full bg-muted mb-1">
          <div className="h-1 rounded-full bg-green-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}
      {expanded && (
        <div className="border-t">
          {goal.tasks.map(task => (
            <TaskRow key={task.id} task={task} onEdit={() => onEditTask(task)} onDelete={() => onDeleteTask(task.id)} onToggleComplete={() => onToggleTask(task)} />
          ))}
          <div className="px-3 py-1.5">
            <button onClick={onAddTask} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" />Add task
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SectorRow({ sector, onEditSector, onDeleteSector, onAddGoal, onEditGoal, onDeleteGoal, onAddTask, onEditTask, onDeleteTask, onToggleTask }: {
  sector: SectorWithGoals
  onEditSector: () => void
  onDeleteSector: () => void
  onAddGoal: () => void
  onEditGoal: (goal: Goal) => void
  onDeleteGoal: (goalId: string) => void
  onAddTask: (goalId: string) => void
  onEditTask: (task: Task) => void
  onDeleteTask: (taskId: string) => void
  onToggleTask: (task: Task) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const totalTasks = sector.goals.reduce((sum, g) => sum + g.tasks.length, 0)
  const completedTasks = sector.goals.reduce((sum, g) => sum + g.tasks.filter(t => t.is_completed).length, 0)

  return (
    <div className="rounded-lg border">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 rounded-t-lg group">
        <button onClick={() => setExpanded(v => !v)} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
        <Columns3 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="flex-1 font-semibold text-sm">{sector.name}</span>
        {totalTasks > 0 && <span className="text-xs text-muted-foreground">{completedTasks}/{totalTasks} tasks</span>}
        <Badge variant="outline" className="text-xs shrink-0">{sector.goals.length} goals</Badge>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={onEditSector} className="p-0.5 text-muted-foreground hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
          <button onClick={onDeleteSector} className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
        </div>
      </div>
      {expanded && (
        <div className="p-3 space-y-2">
          {sector.goals.map(goal => (
            <GoalRow
              key={goal.id}
              goal={goal}
              onEdit={() => onEditGoal(goal)}
              onDelete={() => onDeleteGoal(goal.id)}
              onAddTask={() => onAddTask(goal.id)}
              onEditTask={onEditTask}
              onDeleteTask={onDeleteTask}
              onToggleTask={onToggleTask}
            />
          ))}
          <button onClick={onAddGoal} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors px-1 py-0.5">
            <Plus className="h-3.5 w-3.5" />Add goal
          </button>
        </div>
      )}
    </div>
  )
}

export default function PlanPage() {
  const [sectors, setSectors] = useState<Sector[]>([])
  const [goals, setGoals] = useState<Goal[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [sectorDialog, setSectorDialog] = useState(false)
  const [editingSector, setEditingSector] = useState<Sector | null>(null)
  const [goalDialog, setGoalDialog] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)
  const [defaultGoalSectorId, setDefaultGoalSectorId] = useState('')
  const [taskDialog, setTaskDialog] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [defaultTaskGoalId, setDefaultTaskGoalId] = useState('')

  const fetchAll = useCallback(async () => {
    const [sRes, gRes, tRes] = await Promise.all([fetch('/api/sectors'), fetch('/api/goals'), fetch('/api/tasks')])
    if (sRes.ok) setSectors(await sRes.json())
    if (gRes.ok) setGoals(await gRes.json())
    if (tRes.ok) setTasks(await tRes.json())
  }, [])

  useEffect(() => { void Promise.resolve().then(fetchAll) }, [fetchAll])

  const tree = useMemo<SectorWithGoals[]>(() => {
    const goalsByParent: Record<string, GoalWithTasks[]> = {}
    for (const goal of goals) {
      const tasksForGoal = tasks.filter(t => t.goal_id === goal.id).sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name))
      goalsByParent[goal.sector_id] = [...(goalsByParent[goal.sector_id] ?? []), { ...goal, tasks: tasksForGoal }]
    }
    for (const id of Object.keys(goalsByParent)) {
      goalsByParent[id].sort((a, b) => a.end_date.localeCompare(b.end_date) || a.priority - b.priority)
    }
    return sectors
      .map(sector => ({ ...sector, goals: goalsByParent[sector.id] ?? [] }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [sectors, goals, tasks])

  function openCreateSector() { setEditingSector(null); setSectorDialog(true) }
  function openEditSector(sector: Sector) { setEditingSector(sector); setSectorDialog(true) }
  function handleSectorSaved(sector: Sector, isNew: boolean) {
    setSectors(prev => isNew ? [...prev, sector] : prev.map(s => s.id === sector.id ? sector : s))
  }
  async function handleDeleteSector(id: string) {
    if (!confirm('Delete this domain and all its goals and tasks?')) return
    await fetch(`/api/sectors/${id}`, { method: 'DELETE' })
    setSectors(prev => prev.filter(s => s.id !== id))
    setGoals(prev => prev.filter(g => g.sector_id !== id))
  }

  function openCreateGoal(sectorId = '') { setEditingGoal(null); setDefaultGoalSectorId(sectorId); setGoalDialog(true) }
  function openEditGoal(goal: Goal) { setEditingGoal(goal); setGoalDialog(true) }
  function handleGoalSaved(goal: Goal, isNew: boolean) {
    setGoals(prev => isNew ? [...prev, goal] : prev.map(g => g.id === goal.id ? goal : g))
  }
  async function handleDeleteGoal(id: string) {
    if (!confirm('Delete this goal and all its tasks?')) return
    await fetch(`/api/goals/${id}`, { method: 'DELETE' })
    setGoals(prev => prev.filter(g => g.id !== id))
    setTasks(prev => prev.filter(t => t.goal_id !== id))
  }

  function openCreateTask(goalId = '') { setEditingTask(null); setDefaultTaskGoalId(goalId); setTaskDialog(true) }
  function openEditTask(task: Task) { setEditingTask(task); setTaskDialog(true) }
  function handleTaskSaved(task: Task, isNew: boolean) {
    setTasks(prev => isNew ? [...prev, task] : prev.map(t => t.id === task.id ? task : t))
  }
  async function handleDeleteTask(id: string) {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
  }
  async function handleToggleTask(task: Task) {
    const next = !task.is_completed
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_completed: next } : t))
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_completed: next }),
    })
    if (!res.ok) setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_completed: !next } : t))
  }

  const completedTasks = tasks.filter(t => t.is_completed).length

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plan</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage the full hierarchy: domains, date-bound goals, and practical tasks.</p>
        </div>
        <div className="flex items-center gap-2">
          {tasks.length > 0 && <span className="text-sm text-muted-foreground">{completedTasks}/{tasks.length} tasks done</span>}
          <Button variant="outline" onClick={() => openCreateGoal()}><Plus className="h-4 w-4 mr-1.5" />Goal</Button>
          <Button onClick={openCreateSector}><Plus className="h-4 w-4 mr-1.5" />Domain</Button>
        </div>
      </div>

      {sectors.length === 0 ? (
        <div className="rounded-lg border border-dashed p-10 text-center">
          <Columns3 className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
          <p className="font-medium">Your plan is empty.</p>
          <p className="mt-1 text-sm text-muted-foreground">Start by creating a domain, then add goals and tasks under it.</p>
          <Button className="mt-4" onClick={openCreateSector}><Plus className="h-4 w-4 mr-2" />Add first domain</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {tree.map(sector => (
            <SectorRow
              key={sector.id}
              sector={sector}
              onEditSector={() => openEditSector(sector)}
              onDeleteSector={() => handleDeleteSector(sector.id)}
              onAddGoal={() => openCreateGoal(sector.id)}
              onEditGoal={openEditGoal}
              onDeleteGoal={handleDeleteGoal}
              onAddTask={openCreateTask}
              onEditTask={openEditTask}
              onDeleteTask={handleDeleteTask}
              onToggleTask={handleToggleTask}
            />
          ))}
        </div>
      )}

      <SectorDialog key={`sector-${sectorDialog ? 'open' : 'closed'}-${editingSector?.id ?? 'new'}`} open={sectorDialog} onOpenChange={setSectorDialog} editing={editingSector} onSaved={handleSectorSaved} />
      <GoalDialog key={`goal-${goalDialog ? 'open' : 'closed'}-${editingGoal?.id ?? (defaultGoalSectorId || 'new')}`} open={goalDialog} onOpenChange={setGoalDialog} editing={editingGoal} sectors={sectors} defaultSectorId={defaultGoalSectorId} onSaved={handleGoalSaved} />
      <TaskDialog key={`task-${taskDialog ? 'open' : 'closed'}-${editingTask?.id ?? (defaultTaskGoalId || 'new')}`} open={taskDialog} onOpenChange={setTaskDialog} editing={editingTask} goals={goals} defaultGoalId={defaultTaskGoalId} onSaved={handleTaskSaved} />
    </div>
  )
}

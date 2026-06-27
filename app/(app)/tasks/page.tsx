'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CheckSquare, Clock, Flag, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react'
import type { Goal, Task } from '@/lib/types'
import { formatDuration } from '@/lib/utils'

const PRIORITY_LABELS: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }
const PRIORITY_VARIANTS: Record<number, 'destructive' | 'default' | 'secondary'> = {
  1: 'destructive',
  2: 'default',
  3: 'secondary',
}

type GoalWithSector = Goal & { sectors: { name: string } | null }
type TaskWithGoal = Task & { goals: { id?: string; name: string; sector_id: string; start_date: string; end_date: string } | null }

type FormState = {
  goal_id: string
  name: string
  durationHours: number
  durationMins: number
  priority: number
  is_recurring: boolean
  recurrence_rule: string
}

const defaultForm: FormState = { goal_id: '', name: '', durationHours: 0, durationMins: 30, priority: 2, is_recurring: false, recurrence_rule: '' }

function taskToForm(task: TaskWithGoal): FormState {
  return {
    goal_id: task.goal_id ?? '',
    name: task.name,
    durationHours: Math.floor(task.duration_min / 60),
    durationMins: task.duration_min % 60,
    priority: task.priority,
    is_recurring: task.is_recurring,
    recurrence_rule: task.recurrence_rule ?? '',
  }
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<TaskWithGoal[]>([])
  const [goals, setGoals] = useState<GoalWithSector[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<TaskWithGoal | null>(null)
  const [form, setForm] = useState<FormState>(defaultForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchAll() {
    const [tasksRes, goalsRes] = await Promise.all([fetch('/api/tasks'), fetch('/api/goals')])
    if (tasksRes.ok) setTasks(await tasksRes.json())
    if (goalsRes.ok) setGoals(await goalsRes.json())
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAll() }, [])

  function openCreateTask(goalId = '') {
    setEditing(null)
    setError(null)
    setForm({ ...defaultForm, goal_id: goalId })
    setOpen(true)
  }

  function openEditTask(task: TaskWithGoal) {
    setEditing(task)
    setError(null)
    setForm(taskToForm(task))
    setOpen(true)
  }

  async function handleCreate(e: { preventDefault(): void }) {
    e.preventDefault()
    const duration_min = form.durationHours * 60 + form.durationMins
    if (duration_min < 5) {
      setError('Duration must be at least 5 minutes.')
      return
    }
    setLoading(true)
    setError(null)
    const body = {
      goal_id: form.goal_id,
      name: form.name,
      duration_min,
      priority: form.priority,
      is_recurring: form.is_recurring,
      recurrence_rule: form.recurrence_rule || null,
    }
    const res = await fetch(editing ? `/api/tasks/${editing.id}` : '/api/tasks', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error)
    } else {
      setTasks(prev => editing ? prev.map(task => task.id === json.id ? json : task) : [...prev, json])
      setOpen(false)
      setEditing(null)
      setForm(defaultForm)
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
  }

  const tasksByGoal = useMemo(() => {
    return goals.map(goal => ({
      goal,
      tasks: tasks
        .filter(task => task.goal_id === goal.id)
        .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)),
    }))
  }, [goals, tasks])

  const totalMinutes = tasks.reduce((sum, task) => sum + task.duration_min, 0)

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <CheckSquare className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Action Tasks</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Tasks are the practical actions pulled from each goal. Each task has a duration and can later be placed on the calendar.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditing(null)
        }}>
          <Button onClick={() => openCreateTask()}><Plus className="h-4 w-4 mr-2" />Add Task</Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Task' : 'Create Task'}</DialogTitle>
              <DialogDescription>
                {editing ? 'Update the practical action details.' : 'Turn a goal into a practical action the scheduler can place on the calendar.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Goal</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.goal_id} onChange={e => setForm(f => ({ ...f, goal_id: e.target.value }))} required>
                  <option value="">Select a goal...</option>
                  {goals.map(g => <option key={g.id} value={g.id}>{g.sectors?.name ?? 'No domain'} / {g.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Task name</Label>
                <Input placeholder="e.g. Buy paint and brushes" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      className="w-20"
                      value={form.durationHours}
                      onChange={e => setForm(f => ({ ...f, durationHours: Math.max(0, Number(e.target.value)) }))}
                    />
                    <span className="text-sm text-muted-foreground">h</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="number"
                      min={0}
                      max={59}
                      step={5}
                      className="w-20"
                      value={form.durationMins}
                      onChange={e => setForm(f => ({ ...f, durationMins: Math.max(0, Math.min(59, Number(e.target.value))) }))}
                    />
                    <span className="text-sm text-muted-foreground">min</span>
                  </div>
                  {(form.durationHours > 0 || form.durationMins > 0) && (
                    <span className="text-sm text-muted-foreground">= {formatDuration(form.durationHours * 60 + form.durationMins)}</span>
                  )}
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
              <div className="flex items-center gap-2">
                <input type="checkbox" id="recurring" checked={form.is_recurring} onChange={e => setForm(f => ({ ...f, is_recurring: e.target.checked }))} />
                <Label htmlFor="recurring">Recurring</Label>
              </div>
              {form.is_recurring && (
                <div className="space-y-2">
                  <Label>Recurrence rule (RRULE)</Label>
                  <Input placeholder="e.g. FREQ=WEEKLY;BYDAY=MO,WE" value={form.recurrence_rule} onChange={e => setForm(f => ({ ...f, recurrence_rule: e.target.value }))} />
                </div>
              )}
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">{loading ? 'Saving...' : editing ? 'Save Task' : 'Create Task'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total tasks</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{tasks.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Planned effort</CardTitle></CardHeader>
          <CardContent><p className="text-3xl font-bold">{formatDuration(totalMinutes)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">User-owned time</CardTitle></CardHeader>
          <CardContent><p className="text-sm text-muted-foreground">No automatic buffer is added.</p></CardContent>
        </Card>
      </div>

      {goals.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">Create goals first.</p>
          <p className="mt-1 text-sm text-muted-foreground">A task needs to belong to a goal so the hierarchy stays clear for the ERD.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {tasksByGoal.map(({ goal, tasks: goalTasks }) => (
          <Card key={goal.id} className="min-h-56">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{goal.name}</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {goal.sectors?.name ?? 'No domain'}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Goal window: {goal.start_date} - {goal.end_date}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{goalTasks.length} tasks</Badge>
                  <Button variant="outline" size="sm" onClick={() => openCreateTask(goal.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Add
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {goalTasks.length === 0 ? (
                <div className="rounded-md border border-dashed p-4">
                  <p className="text-sm text-muted-foreground">No practical tasks yet for this goal.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => openCreateTask(goal.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Add first task
                  </Button>
                </div>
              ) : (
                goalTasks.map(task => (
                  <div key={task.id} className="rounded-md border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <p className="font-medium leading-snug">{task.name}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={PRIORITY_VARIANTS[task.priority]} className="gap-1">
                            <Flag className="h-3 w-3" />{PRIORITY_LABELS[task.priority]}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />{formatDuration(task.duration_min)}
                          </Badge>
                          {task.is_recurring && (
                            <Badge variant="secondary" className="gap-1">
                              <RefreshCw className="h-3 w-3" />Recurring
                            </Badge>
                          )}
                        </div>
                        {task.recurrence_rule && <p className="font-mono text-xs text-muted-foreground">{task.recurrence_rule}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => openEditTask(task)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(task.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

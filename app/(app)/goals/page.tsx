'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { CalendarDays, Flag, Pencil, Plus, Target, Trash2 } from 'lucide-react'
import type { Goal, Sector } from '@/lib/types'

const PRIORITY_LABELS: Record<number, string> = { 1: 'High', 2: 'Medium', 3: 'Low' }
const PRIORITY_VARIANTS: Record<number, 'destructive' | 'default' | 'secondary'> = {
  1: 'destructive',
  2: 'default',
  3: 'secondary',
}

type GoalWithSector = Goal & { sectors: { name: string } | null }

export default function GoalsPage() {
  const [goals, setGoals] = useState<GoalWithSector[]>([])
  const [sectors, setSectors] = useState<Sector[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GoalWithSector | null>(null)
  const [form, setForm] = useState({ sector_id: '', name: '', start_date: '', end_date: '', priority: 2 })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchAll() {
    const [goalsRes, sectorsRes] = await Promise.all([fetch('/api/goals'), fetch('/api/sectors')])
    if (goalsRes.ok) setGoals(await goalsRes.json())
    if (sectorsRes.ok) setSectors(await sectorsRes.json())
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAll() }, [])

  function openCreateGoal(sectorId = '') {
    setEditing(null)
    setError(null)
    setForm({ sector_id: sectorId, name: '', start_date: '', end_date: '', priority: 2 })
    setOpen(true)
  }

  function openEditGoal(goal: GoalWithSector) {
    setEditing(goal)
    setError(null)
    setForm({
      sector_id: goal.sector_id,
      name: goal.name,
      start_date: goal.start_date,
      end_date: goal.end_date,
      priority: goal.priority,
    })
    setOpen(true)
  }

  async function handleCreate(e: React.FormEvent) {
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
    } else {
      setGoals(prev => editing ? prev.map(goal => goal.id === json.id ? json : goal) : [...prev, json])
      setOpen(false)
      setEditing(null)
      setForm({ sector_id: '', name: '', start_date: '', end_date: '', priority: 2 })
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this goal and all its tasks?')) return
    await fetch(`/api/goals/${id}`, { method: 'DELETE' })
    setGoals(prev => prev.filter(g => g.id !== id))
  }

  const goalsBySector = useMemo(() => {
    return sectors.map(sector => ({
      sector,
      goals: goals
        .filter(goal => goal.sector_id === sector.id)
        .sort((a, b) => a.end_date.localeCompare(b.end_date) || a.priority - b.priority),
    }))
  }, [goals, sectors])

  const unlinkedGoals = goals.filter(goal => !sectors.some(sector => sector.id === goal.sector_id))

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Goals</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Goals turn each domain into a concrete result with a start date, an end date, and practical tasks underneath.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditing(null)
        }}>
          <Button onClick={() => openCreateGoal()}><Plus className="h-4 w-4 mr-2" />Add Goal</Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Goal' : 'Create Goal'}</DialogTitle>
              <DialogDescription>
                {editing ? 'Update the goal result, domain, date window, or priority.' : 'Add a measurable result under one domain.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label>Domain</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={form.sector_id}
                  onChange={e => setForm(f => ({ ...f, sector_id: e.target.value }))}
                  required
                >
                  <option value="">Select a domain...</option>
                  {sectors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Goal name</Label>
                <Input placeholder="e.g. Paint the baby room" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
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
              <Button type="submit" disabled={loading} className="w-full">{loading ? 'Saving...' : editing ? 'Save Goal' : 'Create Goal'}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-3">
        <div className="rounded-md bg-background p-3">
          <p className="font-medium">1. Choose a domain</p>
          <p className="text-xs text-muted-foreground">Every goal belongs to one stable life area.</p>
        </div>
        <div className="rounded-md bg-background p-3">
          <p className="font-medium">2. Define the result</p>
          <p className="text-xs text-muted-foreground">Describe the outcome, not just the activity.</p>
        </div>
        <div className="rounded-md bg-background p-3">
          <p className="font-medium">3. Set the execution window</p>
          <p className="text-xs text-muted-foreground">Tasks inherit the goal dates. The closest end date appears first.</p>
        </div>
      </div>

      {sectors.length === 0 && (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">Create domains first.</p>
          <p className="mt-1 text-sm text-muted-foreground">Goals need a domain before they can become tasks.</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {goalsBySector.map(({ sector, goals: sectorGoals }) => (
          <Card key={sector.id} className="min-h-56">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{sector.name}</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{sectorGoals.length} goals</Badge>
                  <Button variant="outline" size="sm" onClick={() => openCreateGoal(sector.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Add
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {sectorGoals.length === 0 ? (
                <div className="rounded-md border border-dashed p-4">
                  <p className="text-sm text-muted-foreground">No goals yet for this domain.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => openCreateGoal(sector.id)}>
                    <Plus className="h-3.5 w-3.5 mr-1" />Add first goal
                  </Button>
                </div>
              ) : (
                sectorGoals.map(goal => (
                  <div key={goal.id} className="rounded-md border bg-background p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 space-y-2">
                        <p className="font-medium leading-snug">{goal.name}</p>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant={PRIORITY_VARIANTS[goal.priority]} className="gap-1">
                            <Flag className="h-3 w-3" />{PRIORITY_LABELS[goal.priority]}
                          </Badge>
                          <Badge variant="outline" className="gap-1">
                            <CalendarDays className="h-3 w-3" />{goal.start_date} - {goal.end_date}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => openEditGoal(goal)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(goal.id)}>
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

      {unlinkedGoals.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Unlinked Goals</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {unlinkedGoals.map(goal => (
              <p key={goal.id} className="text-sm text-muted-foreground">{goal.name}</p>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

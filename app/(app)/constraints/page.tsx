'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { CalendarDays, Clock3, Info, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react'
import type { UserConstraint } from '@/lib/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

type ConstraintWithProfile = UserConstraint & { profiles: { display_name: string | null } | null }

function formatDays(c: ConstraintWithProfile): string {
  const days = c.recurrence_days ?? (c.day_of_week !== null ? [c.day_of_week] : ALL_DAYS)
  if (days.length === 7) return 'Every day'
  return days.map(d => DAYS[d]).join(', ')
}

function constraintDays(c: ConstraintWithProfile): number[] {
  return c.recurrence_days ?? (c.day_of_week !== null ? [c.day_of_week] : ALL_DAYS)
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function formatWindowDuration(c: ConstraintWithProfile): string {
  const start = timeToMinutes(c.start_time)
  const end = timeToMinutes(c.end_time)
  const total = end > start ? end - start : (24 * 60 - start) + end
  const hours = Math.floor(total / 60)
  const minutes = total % 60
  if (hours === 0) return `${minutes}m`
  if (minutes === 0) return `${hours}h`
  return `${hours}h ${minutes}m`
}

export default function ConstraintsPage() {
  const [constraints, setConstraints] = useState<ConstraintWithProfile[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ConstraintWithProfile | null>(null)
  const [form, setForm] = useState({ label: '', recurrence_days: [] as number[], start_time: '09:00', end_time: '17:00' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchConstraints() {
    const res = await fetch('/api/constraints')
    if (res.ok) setConstraints(await res.json())
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchConstraints() }, [])

  function resetForm() {
    setForm({ label: '', recurrence_days: [], start_time: '09:00', end_time: '17:00' })
  }

  function openCreate() {
    setEditing(null)
    setError(null)
    resetForm()
    setOpen(true)
  }

  function openEdit(constraint: ConstraintWithProfile) {
    setEditing(constraint)
    setError(null)
    const days = constraint.recurrence_days ??
      (constraint.day_of_week !== null ? [constraint.day_of_week] : ALL_DAYS)
    setForm({
      label: constraint.label,
      recurrence_days: days,
      start_time: constraint.start_time.slice(0, 5),
      end_time: constraint.end_time.slice(0, 5),
    })
    setOpen(true)
  }

  function toggleDay(day: number) {
    setForm(f => {
      const has = f.recurrence_days.includes(day)
      return { ...f, recurrence_days: has ? f.recurrence_days.filter(d => d !== day) : [...f.recurrence_days, day].sort((a, b) => a - b) }
    })
  }

  function toggleAllDays() {
    setForm(f => ({
      ...f,
      recurrence_days: f.recurrence_days.length === 7 ? [] : [...ALL_DAYS],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.recurrence_days.length === 0) {
      setError('Please select at least one day, or use "Every day".')
      return
    }
    setLoading(true)
    setError(null)

    const payload = {
      label: form.label,
      recurrence_days: form.recurrence_days,
      start_time: form.start_time,
      end_time: form.end_time,
    }

    const res = await fetch(editing ? `/api/constraints/${editing.id}` : '/api/constraints', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const json = await res.json()

    if (!res.ok) {
      setError(json.error)
    } else {
      setConstraints(prev => editing ? prev.map(c => c.id === json.id ? json : c) : [...prev, json])
      setOpen(false)
      setEditing(null)
      resetForm()
    }
    setLoading(false)
  }

  async function handleDelete(id: string) {
    await fetch(`/api/constraints/${id}`, { method: 'DELETE' })
    setConstraints(prev => prev.filter(c => c.id !== id))
  }

  const allSelected = form.recurrence_days.length === 7
  const protectedDays = new Set(constraints.flatMap(constraintDays)).size
  const recurringCount = constraints.filter(c => constraintDays(c).length > 1).length
  const sortedConstraints = [...constraints].sort((a, b) => {
    const dayA = Math.min(...constraintDays(a))
    const dayB = Math.min(...constraintDays(b))
    return dayA - dayB || a.start_time.localeCompare(b.start_time)
  })
  const examples = [
    'Work hours: Sun-Thu, 09:00-17:00',
    'Sleep: Every day, 23:30-07:00',
    'Study class: Mon + Wed, 18:00-20:00',
  ]

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Constraints</h1>
          <p className="text-sm text-muted-foreground">Protected time windows for work, sleep, study, family, and fixed commitments.</p>
        </div>
        <Dialog open={open} onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditing(null)
        }}>
          <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Constraint</Button>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Constraint' : 'Add Constraint'}</DialogTitle>
              <DialogDescription>
                {editing ? 'Update a blocked time window the scheduler must respect.' : 'Block time the scheduler must respect, such as work, sleep, study, or fixed commitments.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Label</Label>
                <Input placeholder="e.g. Work Hours" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} required />
              </div>
              <div className="space-y-2">
                <Label>Repeats on</Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={toggleAllDays}
                    className={cn(
                      'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                      allSelected
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background text-muted-foreground hover:bg-muted border-input'
                    )}
                  >
                    Every day
                  </button>
                  {DAYS.map((d, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(i)}
                      className={cn(
                        'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                        form.recurrence_days.includes(i)
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground hover:bg-muted border-input'
                      )}
                    >
                      {d}
                    </button>
                  ))}
                </div>
                {form.recurrence_days.length === 0 && (
                  <p className="text-xs text-destructive">Select at least one day.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Start time</Label>
                  <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>End time</Label>
                  <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} required />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading || form.recurrence_days.length === 0} className="w-full">
                {loading ? 'Saving...' : editing ? 'Save Constraint' : 'Add'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Protected windows
          </div>
          <p className="mt-3 text-2xl font-bold">{constraints.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Times the planner should avoid.</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <CalendarDays className="h-4 w-4 text-primary" />
            Days covered
          </div>
          <p className="mt-3 text-2xl font-bold">{protectedDays}/7</p>
          <p className="mt-1 text-xs text-muted-foreground">How much of the week has clear boundaries.</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock3 className="h-4 w-4 text-primary" />
            Recurring rules
          </div>
          <p className="mt-3 text-2xl font-bold">{recurringCount}</p>
          <p className="mt-1 text-xs text-muted-foreground">Useful for habits and repeated commitments.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="rounded-lg border bg-card">
          <div className="border-b px-4 py-3">
            <h2 className="font-semibold">Protected time</h2>
            <p className="text-sm text-muted-foreground">These blocks help the scheduler avoid unrealistic suggestions.</p>
          </div>

      {constraints.length === 0 ? (
            <div className="p-6">
              <div className="rounded-lg border border-dashed bg-muted/30 p-5">
                <p className="font-medium">No constraints yet</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Start with the times that are almost never available. This makes the calendar smarter before you even schedule a task.
                </p>
                <Button onClick={openCreate} className="mt-4"><Plus className="h-4 w-4 mr-2" />Add first constraint</Button>
              </div>
            </div>
      ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedConstraints.map(c => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.label}</TableCell>
                    <TableCell>
                      {(() => {
                        const label = formatDays(c)
                        return label === 'Every day'
                          ? <Badge variant="secondary">Every day</Badge>
                          : <Badge variant="outline">{label}</Badge>
                      })()}
                    </TableCell>
                    <TableCell className="font-mono text-sm">{c.start_time.slice(0, 5)} - {c.end_time.slice(0, 5)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{formatWindowDuration(c)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.profiles?.display_name ?? 'You'}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => openEdit(c)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(c.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
      )}
        </div>

        <aside className="space-y-3">
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Info className="h-4 w-4 text-primary" />
              What belongs here?
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              Add times that are fixed or hard to move. Tasks can still be planned manually, but suggestions should respect these blocks.
            </p>
          </div>
          <div className="rounded-lg border bg-card p-4">
            <p className="text-sm font-semibold">Good examples</p>
            <div className="mt-3 space-y-2">
              {examples.map(example => (
                <div key={example} className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
                  {example}
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

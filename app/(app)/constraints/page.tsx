'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Pencil, Plus, Trash2 } from 'lucide-react'
import type { UserConstraint } from '@/lib/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

type ConstraintWithProfile = UserConstraint & { profiles: { display_name: string | null } | null }

export default function ConstraintsPage() {
  const [constraints, setConstraints] = useState<ConstraintWithProfile[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<ConstraintWithProfile | null>(null)
  const [form, setForm] = useState({ label: '', day_of_week: '', start_time: '09:00', end_time: '17:00' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchConstraints() {
    const res = await fetch('/api/constraints')
    if (res.ok) setConstraints(await res.json())
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchConstraints() }, [])

  function resetForm() {
    setForm({ label: '', day_of_week: '', start_time: '09:00', end_time: '17:00' })
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
    setForm({
      label: constraint.label,
      day_of_week: constraint.day_of_week === null ? '' : String(constraint.day_of_week),
      start_time: constraint.start_time.slice(0, 5),
      end_time: constraint.end_time.slice(0, 5),
    })
    setOpen(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const payload = {
      ...form,
      day_of_week: form.day_of_week === '' ? null : Number(form.day_of_week),
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

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Constraints</h1>
          <p className="text-sm text-muted-foreground">Blocked time windows the scheduler must respect</p>
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
                <Label>Day of week</Label>
                <select className="w-full border rounded-md px-3 py-2 text-sm bg-background" value={form.day_of_week} onChange={e => setForm(f => ({ ...f, day_of_week: e.target.value }))}>
                  <option value="">Every day</option>
                  {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                </select>
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
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Saving...' : editing ? 'Save Constraint' : 'Add'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {constraints.length === 0 ? (
        <p className="text-muted-foreground text-sm">No constraints yet. Add your working hours, gym sessions, etc.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Label</TableHead>
              <TableHead>Day</TableHead>
              <TableHead>Window</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {constraints.map(c => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.label}</TableCell>
                <TableCell>
                  {c.day_of_week === null ? (
                    <Badge variant="secondary">Every day</Badge>
                  ) : (
                    <Badge variant="outline">{DAYS[c.day_of_week]}</Badge>
                  )}
                </TableCell>
                <TableCell className="font-mono text-sm">{c.start_time.slice(0, 5)} - {c.end_time.slice(0, 5)}</TableCell>
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
  )
}

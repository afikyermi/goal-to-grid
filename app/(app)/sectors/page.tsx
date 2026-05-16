'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ArrowRight, Columns3, Pencil, Plus, Trash2 } from 'lucide-react'
import type { Sector } from '@/lib/types'

const workflow = [
  ['1', 'Domain', 'A stable life area such as Personal, Studies, Career, or Family.'],
  ['2', 'Goal', 'A concrete result inside the domain, with start and end dates.'],
  ['3', 'Task', 'A practical action under the goal, with a duration.'],
  ['4', 'Schedule', 'The task becomes a time block on the calendar.'],
]

export default function SectorsPage() {
  const [sectors, setSectors] = useState<Sector[]>([])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Sector | null>(null)
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function fetchSectors() {
    const res = await fetch('/api/sectors')
    if (res.ok) setSectors(await res.json())
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchSectors() }, [])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const res = await fetch(editing ? `/api/sectors/${editing.id}` : '/api/sectors', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error)
    } else {
      setSectors(prev => editing ? prev.map(s => s.id === json.id ? json : s) : [...prev, json])
      setOpen(false)
      setEditing(null)
      setName('')
    }
    setLoading(false)
  }

  function openCreate() {
    setEditing(null)
    setError(null)
    setName('')
    setOpen(true)
  }

  function openEdit(sector: Sector) {
    setEditing(sector)
    setError(null)
    setName(sector.name)
    setOpen(true)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this domain and all its goals and tasks?')) return
    await fetch(`/api/sectors/${id}`, { method: 'DELETE' })
    setSectors(prev => prev.filter(s => s.id !== id))
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Columns3 className="h-6 w-6" />
            <h1 className="text-2xl font-bold">Domains</h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Create the stable areas of life you want to manage. Domains are only headings; goals and tasks hold the operational details.
          </p>
        </div>
        <Dialog open={open} onOpenChange={(next) => {
          setOpen(next)
          if (!next) setEditing(null)
        }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 mr-2" />Add Domain</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Edit Domain' : 'Create Domain'}</DialogTitle>
              <DialogDescription>
                Domains are simple labels, such as Personal, Studies, Career, Family, or Health.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Domain name</Label>
                <Input placeholder="e.g. Personal, Career, Studies" value={name} onChange={e => setName(e.target.value)} required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Saving...' : editing ? 'Save Domain' : 'Create Domain'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-3 rounded-lg border bg-muted/30 p-3 text-sm sm:grid-cols-4">
        {workflow.map(([step, title, text], index) => (
          <div key={step} className="flex items-start gap-3 rounded-md bg-background p-3">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {step}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-medium">{title}</p>
                {index < 3 && <ArrowRight className="hidden h-3.5 w-3.5 text-muted-foreground sm:block" />}
              </div>
              <p className="text-xs text-muted-foreground">{text}</p>
            </div>
          </div>
        ))}
      </div>

      {sectors.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="font-medium">No domains yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">Create the first domain, then add goals and tasks under it.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {sectors.map(s => (
            <Card key={s.id} className="min-h-40">
              <CardHeader className="pb-2 flex-row items-start justify-between space-y-0">
                <CardTitle className="text-base">{s.name}</CardTitle>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground" onClick={() => openEdit(s)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleDelete(s.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Add goals and tasks under this domain from the Plan page.</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

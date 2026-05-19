'use client'

import { useEffect, useState } from 'react'
import ChenERD, { type AllEntityCounts } from '@/components/ChenERD'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'

const DEFAULT_COUNTS: AllEntityCounts = {
  households: 0,
  profiles: 0,
  sectors: 0,
  user_constraints: 0,
  goals: 0,
  priority_levels: 0,
  tasks: 0,
  schedule_items: 0,
  calendar_connections: 0,
  external_calendar_events: 0,
  user_behavior_events: 0,
}

async function fetchCounts(): Promise<AllEntityCounts> {
  const res = await fetch('/api/admin/architecture/counts')
  if (!res.ok) return DEFAULT_COUNTS
  const { counts } = await res.json()
  return { ...DEFAULT_COUNTS, ...counts }
}

export function LiveArchitectureDashboard({ initialCounts }: { initialCounts: Partial<AllEntityCounts> }) {
  const [counts, setCounts] = useState<AllEntityCounts>({ ...DEFAULT_COUNTS, ...initialCounts })

  useEffect(() => {
    const supabase = createClient()
    const refresh = () => { void fetchCounts().then(setCounts) }
    refresh()

    const channel = supabase.channel('architecture-domain-counts')
    for (const table of [
      'households',
      'profiles',
      'sectors',
      'user_constraints',
      'goals',
      'tasks',
      'schedule_items',
      'calendar_connections',
      'external_calendar_events',
      'user_behavior_events',
    ]) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, refresh)
    }

    channel.subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [])

  const hierarchy = [
    ['HOUSEHOLDS', counts.households, 'Collaboration boundary'],
    ['SECTORS / DOMAINS', counts.sectors, 'Stable life areas'],
    ['GOALS', counts.goals, 'Date-bound outcomes'],
    ['TASKS', counts.tasks, 'Practical actions with durations'],
    ['SCHEDULE_ITEMS', counts.schedule_items, 'Calendar placements'],
  ]

  return (
    <div className="space-y-4">
      <ChenERD counts={counts} />

      <div className="grid gap-3 md:grid-cols-5">
        {hierarchy.map(([label, value, note]) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{note}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Operational Notes</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-3">
          <div className="rounded-md border p-3">
            <p className="font-medium">Domains have no planning dates</p>
            <p className="mt-1 text-muted-foreground">They are headings only. Dates start at the goal level.</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-medium">Goals own the execution window</p>
            <p className="mt-1 text-muted-foreground">Tasks inherit the goal start and end dates.</p>
          </div>
          <div className="rounded-md border p-3">
            <p className="font-medium">Calendar placement is manual-first</p>
            <p className="mt-1 text-muted-foreground">The engine suggests slots; the user chooses what enters the calendar.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

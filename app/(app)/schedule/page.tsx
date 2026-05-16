'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CalendarSync, ChevronLeft, ChevronRight, Pencil, Trash2, Zap, Plus } from 'lucide-react'
import type { ExternalCalendarEvent, ScheduleItemWithTask, Task, TaskWithGoal } from '@/lib/types'
import { cn, formatDuration } from '@/lib/utils'

type ViewMode = 'week' | 'agenda'

type CalendarEntry =
  | { kind: 'site'; item: ScheduleItemWithTask }
  | { kind: 'external'; item: ExternalCalendarEvent }

type SuggestedSlot = {
  task_id: string
  task?: TaskWithGoal
  suggestions: Array<{ scheduled_start: string; scheduled_end: string }>
}

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-blue-100 border-blue-400 text-blue-900',
  Done: 'bg-green-100 border-green-400 text-green-900',
  Missed: 'bg-red-100 border-red-400 text-red-900',
}

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive'> = {
  Pending: 'default',
  Done: 'secondary',
  Missed: 'destructive',
}

const DAY_START_HOUR = 0
const DAY_END_HOUR = 24
const HOUR_HEIGHT = 56
const SNAP_MINUTES = 15
const DAY_WINDOW_MINUTES = (DAY_END_HOUR - DAY_START_HOUR) * 60

function startOfWeek(d: Date): Date {
  const day = new Date(d)
  day.setDate(day.getDate() - day.getDay())
  day.setHours(0, 0, 0, 0)
  return day
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function toDateInput(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

function toTimeInput(date: Date): string {
  return date.toTimeString().slice(0, 5)
}

function dateTimeLocal(date: string, time: string): Date {
  return new Date(`${date}T${time}:00`)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad2(v: number) { return String(v).padStart(2, '0') }

function shortDate(date: Date, includeYear = false): string {
  const base = `${MONTHS[date.getMonth()]} ${date.getDate()}`
  return includeYear ? `${base}, ${date.getFullYear()}` : base
}

function shortTime(date: Date): string {
  return `${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function dateTimeLabel(date: Date): string {
  return `${shortDate(date, true)} ${shortTime(date)}`
}

function entryStart(entry: CalendarEntry): Date {
  return new Date(entry.kind === 'site' ? entry.item.scheduled_start : entry.item.starts_at)
}

function entryEnd(entry: CalendarEntry): Date {
  return new Date(entry.kind === 'site' ? entry.item.scheduled_end : entry.item.ends_at)
}

function entryTitle(entry: CalendarEntry): string {
  if (entry.kind === 'external') return entry.item.title
  return (entry.item.tasks as unknown as { name: string }).name
}

function minutesSinceDayStart(date: Date): number {
  return (date.getHours() - DAY_START_HOUR) * 60 + date.getMinutes()
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function snapMinutes(minutes: number, mode: 'floor' | 'round' = 'round'): number {
  const ratio = minutes / SNAP_MINUTES
  return (mode === 'floor' ? Math.floor(ratio) : Math.round(ratio)) * SNAP_MINUTES
}

function minutesToTime(minutesFromDayStart: number): string {
  const totalMinutes = DAY_START_HOUR * 60 + minutesFromDayStart
  return `${pad2(Math.floor(totalMinutes / 60))}:${pad2(totalMinutes % 60)}`
}

function entryPosition(entry: CalendarEntry) {
  const start = entryStart(entry)
  const end = entryEnd(entry)
  const startMin = Math.max(0, minutesSinceDayStart(start))
  const durationMin = Math.max(20, Math.round((end.getTime() - start.getTime()) / 60000))
  return {
    top: (startMin / 60) * HOUR_HEIGHT,
    height: Math.max(28, (durationMin / 60) * HOUR_HEIGHT),
  }
}

// ── DnD sub-components ────────────────────────────────────────────────────────

function DroppableDayColumn({
  day, children, onColumnClick, snapPreview,
}: {
  day: Date
  children: React.ReactNode
  onColumnClick: (day: Date, e: React.MouseEvent<HTMLDivElement>) => void
  snapPreview: { date: string; top: number; height: number } | null
}) {
  const id = `day-col-${toDateInput(day)}`
  const { setNodeRef, isOver } = useDroppable({ id })
  const dateStr = toDateInput(day)
  return (
    <div
      ref={setNodeRef}
      id={id}
      data-calendar-day={dateStr}
      className={cn('relative border-r last:border-r-0 cursor-crosshair transition-colors', isOver && 'bg-primary/5')}
      onClick={e => onColumnClick(day, e)}
    >
      {children}
      {snapPreview?.date === dateStr && (
        <div
          className="absolute left-1 right-1 rounded-md border-2 border-primary/60 bg-primary/15 pointer-events-none z-10"
          style={{ top: `${snapPreview.top}px`, height: `${snapPreview.height}px` }}
        />
      )}
    </div>
  )
}

function DraggableTaskCard({ task, onPlace }: { task: Task; onPlace: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `task-${task.id}`,
    data: { type: 'task', task },
  })
  return (
    <div
      ref={setNodeRef}
      className={cn('rounded-md border p-2 touch-none select-none', isDragging && 'opacity-40')}
      {...attributes}
      {...listeners}
    >
      <p className="text-sm font-medium">{task.name}</p>
      <p className="text-xs text-muted-foreground">{formatDuration(task.duration_min)}</p>
      <Button
        variant="outline" size="sm" className="mt-2 w-full"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onPlace() }}
      >
        Place in calendar
      </Button>
    </div>
  )
}

function UnscheduledDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unscheduled-drop-zone' })

  return (
    <div
      ref={setNodeRef}
      data-unscheduled-dropzone="true"
      className={cn('rounded-lg border p-3 transition-colors', isOver && 'border-primary bg-primary/5 ring-1 ring-primary/30')}
    >
      {children}
    </div>
  )
}

function DraggableEventBlock({
  entry, onClick, style, className: cls,
}: {
  entry: CalendarEntry
  onClick: () => void
  style: React.CSSProperties
  className: string
}) {
  const id = entry.kind === 'site'
    ? `item-${entry.item.id}`
    : `ext-${entry.item.google_event_id}`

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id,
    data: { type: entry.kind === 'site' ? 'item' : 'external', entry },
    disabled: entry.kind === 'external',
  })

  const start = entryStart(entry)

  return (
    <button
      ref={setNodeRef}
      style={style}
      className={cn(
        'absolute left-1 right-1 overflow-hidden rounded-md border px-2 py-1 text-left text-xs leading-tight shadow-sm transition-opacity hover:opacity-90 touch-none select-none',
        cls,
        isDragging && 'opacity-30 z-20',
      )}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <div className="truncate font-medium">{entryTitle(entry)}</div>
      <div className="opacity-75">{shortTime(start)}</div>
      {entry.kind === 'external' && <div className="mt-1 text-[10px] uppercase opacity-70">Google</div>}
    </button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()))
  const [items, setItems] = useState<ScheduleItemWithTask[]>([])
  const [externalEvents, setExternalEvents] = useState<ExternalCalendarEvent[]>([])
  const [selected, setSelected] = useState<CalendarEntry | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [allTasks, setAllTasks] = useState<TaskWithGoal[]>([])
  const [manualOpen, setManualOpen] = useState(false)
  const [schedulerOpen, setSchedulerOpen] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [taskIds, setTaskIds] = useState<string[]>([])
  const [suggestedSlots, setSuggestedSlots] = useState<SuggestedSlot[]>([])
  const [editingItem, setEditingItem] = useState<ScheduleItemWithTask | null>(null)
  const [manualForm, setManualForm] = useState({
    task_id: '', date: toDateInput(new Date()), start_time: '09:00', durationHours: 0, durationMins: 30,
  })
  const [calendarStatus, setCalendarStatus] = useState<{
    configured: boolean
    connected: boolean
    migration_applied?: boolean
    needs_reconnect?: boolean
    token_encryption_configured?: boolean
    calendar_id?: string | null
    expires_at?: string | null
  } | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>('week')
  const [now, setNow] = useState(() => new Date())
  const [syncing, setSyncing] = useState(false)

  // DnD state
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null)
  const [activeDragItem, setActiveDragItem] = useState<ScheduleItemWithTask | null>(null)
  const [snapPreview, setSnapPreview] = useState<{ date: string; top: number; height: number } | null>(null)
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragGrabOffsetYRef = useRef(0)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // Track pointer position globally so handleDragEnd can compute drop time
  useEffect(() => {
    function onPointerMove(e: PointerEvent) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY }
    }
    function onPointerUp(e: PointerEvent) {
      lastPointerRef.current = { x: e.clientX, y: e.clientY }
    }
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  // Current time line — refreshes every 30 s
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const windowEnd = useMemo(() => addDays(weekStart, 7), [weekStart])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const fetchItems = useCallback(async () => {
    const [scheduleRes, externalRes] = await Promise.all([
      fetch(`/api/schedule?week_start=${weekStart.toISOString()}`),
      fetch(`/api/calendar/external-events?start=${weekStart.toISOString()}&end=${windowEnd.toISOString()}`),
    ])
    if (scheduleRes.ok) setItems(await scheduleRes.json())
    if (externalRes.ok) {
      const json = await externalRes.json()
      setExternalEvents(json.events ?? [])
    }
  }, [weekStart, windowEnd])

  const fetchCalendarStatus = useCallback(async () => {
    const res = await fetch('/api/calendar/status')
    setCalendarStatus(res.ok ? await res.json() : null)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchItems() }, [fetchItems])

  useEffect(() => {
    fetch('/api/tasks').then(r => r.ok ? r.json() : []).then(setAllTasks)
    void Promise.resolve().then(fetchCalendarStatus)

    void Promise.resolve().then(() => {
      const params = new URLSearchParams(window.location.search)
      const connected = params.get('calendar_connected')
      const error = params.get('calendar_error')
      if (connected) setSyncMsg('Google Calendar connected. Your scheduled tasks can now sync there.')
      if (error && !error.toLowerCase().includes('not configured') && !error.toLowerCase().includes('oauth')) {
        setSyncMsg(error)
      }
    })
  }, [fetchCalendarStatus])

  const scheduledTaskIds = useMemo(() => new Set(items.map(i => i.task_id)), [items])
  const unscheduledTasks = allTasks.filter(t => !scheduledTaskIds.has(t.id) && !t.is_completed)
  const hours = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i),
    []
  )
  const allEntries = useMemo<CalendarEntry[]>(() => [
    ...items.map(item => ({ kind: 'site' as const, item })),
    ...externalEvents.map(item => ({ kind: 'external' as const, item })),
  ].sort((a, b) => entryStart(a).getTime() - entryStart(b).getTime()), [externalEvents, items])

  function entriesForDay(day: Date): CalendarEntry[] {
    return allEntries.filter(entry => {
      const d = entryStart(entry)
      return d.getDate() === day.getDate() && d.getMonth() === day.getMonth() && d.getFullYear() === day.getFullYear()
    })
  }

  function openManual(task?: Task, opts?: { date?: string; startTime?: string }) {
    setEditingItem(null)
    const dm = task?.duration_min ?? 30
    setManualForm({
      task_id: task?.id ?? '',
      date: opts?.date ?? toDateInput(new Date()),
      start_time: opts?.startTime ?? '09:00',
      durationHours: Math.floor(dm / 60),
      durationMins: dm % 60,
    })
    setManualOpen(true)
  }

  function openEdit(item: ScheduleItemWithTask) {
    const start = new Date(item.scheduled_start)
    const end = new Date(item.scheduled_end)
    const dm = Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000))
    setEditingItem(item)
    setManualForm({
      task_id: item.task_id,
      date: toDateInput(start),
      start_time: toTimeInput(start),
      durationHours: Math.floor(dm / 60),
      durationMins: dm % 60,
    })
    setManualOpen(true)
  }

  function getDropTargetFromPointer(durationMin = SNAP_MINUTES, offsetY = 0) {
    const { x, y } = lastPointerRef.current
    const elements = document.elementsFromPoint(x, y)
    let column = elements
      .map(el => el.closest<HTMLElement>('[data-calendar-day]'))
      .find(Boolean) ?? null

    if (!column) {
      column = Array.from(document.querySelectorAll<HTMLElement>('[data-calendar-day]'))
        .find(el => {
          const rect = el.getBoundingClientRect()
          return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
        }) ?? null
    }

    const date = column?.dataset.calendarDay
    if (!column || !date) return null

    const rect = column.getBoundingClientRect()
    const rawMinutes = ((y - rect.top - offsetY) / HOUR_HEIGHT) * 60
    const maxStart = Math.max(0, DAY_WINDOW_MINUTES - durationMin)
    const startMinutes = clamp(snapMinutes(rawMinutes, 'floor'), 0, maxStart)
    const startTime = minutesToTime(startMinutes)

    return {
      date,
      startTime,
      start: dateTimeLocal(date, startTime),
    }
  }

  function isPointerOverUnscheduledDropZone() {
    const { x, y } = lastPointerRef.current
    return document.elementsFromPoint(x, y).some(el => el.closest('[data-unscheduled-dropzone]'))
  }

  function handleColumnClick(day: Date, e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('button')) return
    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const snappedMin = clamp(snapMinutes((y / HOUR_HEIGHT) * 60, 'floor'), 0, DAY_WINDOW_MINUTES - SNAP_MINUTES)
    openManual(undefined, { date: toDateInput(day), startTime: minutesToTime(snappedMin) })
  }

  async function handleManualSubmit(e: { preventDefault(): void }) {
    e.preventDefault()
    const duration_min = manualForm.durationHours * 60 + manualForm.durationMins
    const start = dateTimeLocal(manualForm.date, manualForm.start_time)
    const end = new Date(start.getTime() + duration_min * 60000)
    const endpoint = editingItem ? `/api/schedule/${editingItem.id}` : '/api/schedule'
    const res = await fetch(endpoint, {
      method: editingItem ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingItem
        ? { scheduled_start: start.toISOString(), scheduled_end: end.toISOString() }
        : { task_id: manualForm.task_id, scheduled_start: start.toISOString(), scheduled_end: end.toISOString() }),
    })
    const json = await res.json()
    if (!res.ok) { setSyncMsg(json.error ?? 'Failed to save schedule item'); return }
    if (json.warning) setSyncMsg(json.warning)
    else if (json.detail) setSyncMsg(json.detail)
    setManualOpen(false)
    setEditingItem(null)
    await fetchItems()
  }

  async function updateStatus(id: string, status: string) {
    const res = await fetch(`/api/schedule/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    if (res.ok) {
      const updated = await res.json()
      setItems(prev => prev.map(i => i.id === id ? updated : i))
      if (updated.warning) setSyncMsg(updated.warning)
      setSelected(null)
    }
  }

  async function deleteSiteItem(id: string) {
    await fetch(`/api/schedule/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(item => item.id !== id))
    setSelected(null)
  }

  async function handleSync() {
    if (syncing) return
    setSyncMsg(null)
    setSyncing(true)
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' })
      const json = await res.json()
      setSyncMsg(json.detail ? `${json.message} ${json.detail}` : json.message ?? 'Google Calendar sync finished.')
      await fetchItems()
    } finally {
      setTimeout(() => setSyncing(false), 10000)
    }
  }

  async function handleImportGoogleEvents() {
    if (syncing) return
    setSyncMsg(null)
    setSyncing(true)
    try {
      const res = await fetch('/api/calendar/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeMin: weekStart.toISOString(), timeMax: windowEnd.toISOString() }),
      })
      const json = await res.json()
      if (!res.ok) { setSyncMsg(json.error ?? 'Failed to import Google events'); return }
      setSyncMsg(json.imported > 0
        ? `Google Calendar refreshed: ${json.imported} busy event(s) loaded for this week.`
        : 'Google Calendar refreshed. No busy events were found for this week.'
      )
      await fetchItems()
    } finally {
      setTimeout(() => setSyncing(false), 10000)
    }
  }

  async function handleDisconnectGoogle() {
    setSyncMsg(null)
    const res = await fetch('/api/calendar/disconnect', { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      setSyncMsg(json.error ?? 'Failed to disconnect Google Calendar.')
      return
    }
    setExternalEvents([])
    setSyncMsg('Google Calendar disconnected from this account.')
    await fetchCalendarStatus()
  }

  async function handleSchedule() {
    if (taskIds.length === 0) return
    setScheduling(true)
    setSuggestedSlots([])
    if (calendarStatus?.connected && !calendarStatus.needs_reconnect) {
      await fetch('/api/calendar/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ timeMin: weekStart.toISOString(), timeMax: windowEnd.toISOString() }),
      })
    }
    const res = await fetch('/api/schedule/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_ids: taskIds,
        window_start: weekStart.toISOString(),
        window_end: windowEnd.toISOString(),
      }),
    })
    const json = await res.json()
    setScheduling(false)
    if (res.ok) {
      setSuggestedSlots(json.suggestions ?? [])
      setSyncMsg('Suggestions are ready. Choose the slot you want to place on the calendar.')
    }
    else setSyncMsg(json.error ?? 'Failed to get suggestions')
  }

  async function applySuggestion(slot: SuggestedSlot, option: { scheduled_start: string; scheduled_end: string }) {
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: slot.task_id,
        scheduled_start: option.scheduled_start,
        scheduled_end: option.scheduled_end,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setSyncMsg(json.error ?? 'Failed to apply suggestion'); return }
    await fetch('/api/behavior-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'suggestion_accepted',
        task_id: slot.task_id,
        goal_id: slot.task?.goal_id ?? slot.task?.goals?.id ?? null,
        schedule_item_id: json.item?.id ?? null,
        scheduled_start: option.scheduled_start,
        scheduled_end: option.scheduled_end,
      }),
    })
    if (json.warning) setSyncMsg(json.warning)
    setSuggestedSlots(prev => prev.filter(row => row.task_id !== slot.task_id))
    setTaskIds(prev => prev.filter(id => id !== slot.task_id))
    await fetchItems()
  }

  async function sendTimeFeedback(value: 'too_short' | 'accurate' | 'too_long') {
    if (!selected || selected.kind !== 'site') return
    await fetch('/api/behavior-events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'duration_feedback',
        task_id: selected.item.task_id,
        goal_id: selected.item.tasks.goal_id,
        schedule_item_id: selected.item.id,
        scheduled_start: selected.item.scheduled_start,
        scheduled_end: selected.item.scheduled_end,
        metadata: { value },
      }),
    })
    setSyncMsg('Feedback saved. Future recommendations can use this pattern.')
  }

  // ── DnD handlers ──────────────────────────────────────────────────────────

  function handleDragMove() {
    const durMin = activeDragTask?.duration_min
      ?? (activeDragItem
          ? Math.max(SNAP_MINUTES, Math.round(
              (new Date(activeDragItem.scheduled_end).getTime() - new Date(activeDragItem.scheduled_start).getTime()) / 60000
            ))
          : null)
    if (durMin === null) { setSnapPreview(null); return }
    const offsetY = activeDragItem ? dragGrabOffsetYRef.current : 0
    const target = getDropTargetFromPointer(durMin, offsetY)
    if (!target) { setSnapPreview(null); return }
    const [hStr, mStr] = target.startTime.split(':')
    const startMin = (parseInt(hStr, 10) - DAY_START_HOUR) * 60 + parseInt(mStr, 10)
    setSnapPreview({
      date: target.date,
      top: (startMin / 60) * HOUR_HEIGHT,
      height: Math.max(28, (durMin / 60) * HOUR_HEIGHT),
    })
  }

  function handleDragStart(event: DragStartEvent) {
    const type = event.active.data.current?.type
    dragGrabOffsetYRef.current = 0

    if (type === 'task') {
      setActiveDragTask(event.active.data.current?.task as Task)
      return
    }

    if (type === 'item') {
      const item = (event.active.data.current?.entry as CalendarEntry & { kind: 'site' }).item
      const activeEl = document.getElementById(String(event.active.id))
      if (activeEl) {
        const rect = activeEl.getBoundingClientRect()
        dragGrabOffsetYRef.current = clamp(lastPointerRef.current.y - rect.top, 0, rect.height)
      }
      setActiveDragItem(item)
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragTask(null)
    setActiveDragItem(null)
    setSnapPreview(null)

    const { active } = event
    const overId = event.over?.id
    const type = active.data.current?.type as string

    if (type === 'task') {
      // Open manual dialog pre-filled — user confirms before saving
      const task = active.data.current?.task as Task
      const target = getDropTargetFromPointer(task.duration_min)
      if (!target) return
      const end = new Date(target.start.getTime() + task.duration_min * 60000)
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task_id: task.id,
          scheduled_start: target.start.toISOString(),
          scheduled_end: end.toISOString(),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setSyncMsg(json.error ?? 'Failed to place task on the calendar.')
        return
      }
      if (json.detail) setSyncMsg(json.detail)
      await fetchItems()
    } else if (type === 'item') {
      // Immediate PATCH — preserve duration, change day + time
      const item = (active.data.current?.entry as CalendarEntry & { kind: 'site' }).item
      if (overId === 'unscheduled-drop-zone' || isPointerOverUnscheduledDropZone()) {
        await deleteSiteItem(item.id)
        setSyncMsg('Task removed from the calendar and returned to Unscheduled Tasks.')
        return
      }

      const duration = new Date(item.scheduled_end).getTime() - new Date(item.scheduled_start).getTime()
      const durationMin = Math.max(SNAP_MINUTES, Math.round(duration / 60000))
      const target = getDropTargetFromPointer(durationMin, dragGrabOffsetYRef.current)
      if (!target) return

      const start = target.start
      const end = new Date(start.getTime() + duration)

      // Optimistic update
      setItems(prev => prev.map(i => i.id === item.id
        ? { ...i, scheduled_start: start.toISOString(), scheduled_end: end.toISOString() }
        : i
      ))

      const res = await fetch(`/api/schedule/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduled_start: start.toISOString(), scheduled_end: end.toISOString() }),
      })
      if (!res.ok) await fetchItems() // revert on failure
    }
  }

  const weekLabel = `${shortDate(days[0])} - ${shortDate(days[6], true)}`
  const manualGoalWarning = (() => {
    const task = allTasks.find(t => t.id === manualForm.task_id)
    if (!task?.goals || !manualForm.date) return null
    if (manualForm.date < task.goals.start_date || manualForm.date > task.goals.end_date) {
      return `This task belongs to "${task.goals.name}", planned for ${task.goals.start_date} - ${task.goals.end_date}. You can still schedule it here.`
    }
    return null
  })()

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragMove={handleDragMove} onDragEnd={handleDragEnd}>
      <div className="space-y-4 max-w-7xl">
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <div>
            <h1 className="text-2xl font-bold">Schedule</h1>
            <p className="text-sm text-muted-foreground">{weekLabel}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" onClick={() => setWeekStart(startOfWeek(new Date()))}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(d => addDays(d, -7))}><ChevronLeft className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(d => addDays(d, 7))}><ChevronRight className="h-4 w-4" /></Button>
            <div className="flex rounded-md border p-0.5">
              <Button type="button" size="sm" variant={viewMode === 'week' ? 'default' : 'ghost'} onClick={() => setViewMode('week')}>Week</Button>
              <Button type="button" size="sm" variant={viewMode === 'agenda' ? 'default' : 'ghost'} onClick={() => setViewMode('agenda')}>Agenda</Button>
            </div>
            <Button onClick={() => openManual()}><Plus className="h-4 w-4 mr-2" />Plan Manually</Button>
            <Button variant="outline" onClick={() => setSchedulerOpen(true)}><Zap className="h-4 w-4 mr-2" />Suggest Slots</Button>
          </div>
        </div>

        {/* Google Calendar status */}
        {calendarStatus && (
          <div className="rounded-lg border bg-background px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">
                  {calendarStatus.connected
                    ? calendarStatus.needs_reconnect
                      ? 'Google Calendar needs reconnecting'
                      : 'Google Calendar connected'
                    : 'Google Calendar'}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {calendarStatus.connected
                    ? 'Google events appear here as read-only busy blocks. Goal-to-Grid tasks can be synced to Google.'
                    : calendarStatus.configured && calendarStatus.migration_applied
                      ? 'Connect your calendar to see busy time and sync scheduled tasks.'
                      : 'The schedule works inside Goal-to-Grid. Google sync is not available in this environment yet.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {calendarStatus.connected ? (
                  <>
                    <Button variant="outline" onClick={handleImportGoogleEvents} disabled={syncing}>
                      <CalendarSync className="h-4 w-4 mr-2" />{syncing ? 'Syncing...' : 'Refresh Google'}
                    </Button>
                    <Button variant="outline" onClick={handleSync} disabled={syncing}>
                      <CalendarSync className="h-4 w-4 mr-2" />{syncing ? 'Syncing...' : 'Sync Tasks'}
                    </Button>
                    <a href="/api/calendar/connect">
                      <Button variant="outline">Reconnect</Button>
                    </a>
                    <Button variant="outline" onClick={handleDisconnectGoogle}>Disconnect</Button>
                  </>
                ) : calendarStatus.configured && calendarStatus.migration_applied ? (
                  <a href="/api/calendar/connect">
                    <Button><CalendarSync className="h-4 w-4 mr-2" />Connect</Button>
                  </a>
                ) : null}
              </div>
            </div>

            {calendarStatus.connected && !calendarStatus.token_encryption_configured && (
              <details className="mt-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Developer setup note</summary>
                <p className="mt-1">
                  Add GOOGLE_TOKEN_ENCRYPTION_KEY before production so new Google tokens are encrypted at rest.
                </p>
              </details>
            )}
          </div>
        )}
        {(false as boolean) && calendarStatus && !calendarStatus.connected && (
          !calendarStatus.migration_applied ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-sm font-semibold text-amber-700">Database migration needed</p>
              <p className="mt-1 text-sm text-muted-foreground">
                The Google Calendar tables haven&apos;t been created yet. Run the Supabase migration and then refresh this page.
              </p>
            </div>
          ) : !calendarStatus.configured ? (
            <div className="rounded-lg border px-4 py-4 space-y-3">
              <div>
                <p className="text-sm font-semibold">Set up Google Calendar — 5 steps</p>
                <p className="text-xs text-muted-foreground mt-0.5">You only need to do this once. The app code is ready — it just needs your Google credentials.</p>
              </div>
              <ol className="text-sm space-y-1.5 list-decimal list-inside text-muted-foreground">
                <li>Open <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="underline text-foreground font-medium">console.cloud.google.com</a> and create or select a project</li>
                <li>Go to <strong className="text-foreground">APIs &amp; Services → Library</strong>, search <strong className="text-foreground">Google Calendar API</strong>, click Enable</li>
                <li>Go to <strong className="text-foreground">APIs &amp; Services → Credentials → Create Credentials → OAuth 2.0 Client ID</strong></li>
                <li>Application type: <strong className="text-foreground">Web application</strong>. Authorized redirect URI: <code className="bg-muted px-1 rounded text-xs">http://localhost:3000/api/calendar/callback</code></li>
                <li>Add to <code className="bg-muted px-1 rounded text-xs">.env.local</code>:
                  <code className="bg-muted px-1.5 py-0.5 rounded text-xs block mt-1">GOOGLE_CLIENT_ID=…<br />GOOGLE_CLIENT_SECRET=…</code>
                </li>
              </ol>
              <p className="text-xs text-muted-foreground">After saving restart the dev server (<code className="bg-muted px-1 rounded">npm run dev</code>) and refresh this page.</p>
            </div>
          ) : (
            <div className="flex items-center justify-between rounded-lg border px-4 py-3 gap-4">
              <div>
                <p className="text-sm font-semibold">Connect your Google Calendar</p>
                <p className="mt-0.5 text-sm text-muted-foreground">Import existing events and sync tasks you schedule here. You&apos;ll see a Google permission screen.</p>
              </div>
              <a href="/api/calendar/connect" className="shrink-0">
                <Button><CalendarSync className="h-4 w-4 mr-2" />Connect Google Calendar</Button>
              </a>
            </div>
          )
        )}
        {(false as boolean) && calendarStatus?.connected && (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            <p className="text-sm text-green-700 font-medium">Google Calendar connected</p>
            <p className="text-sm text-muted-foreground ml-1">— use &ldquo;Import Google Events&rdquo; to pull this week&apos;s events.</p>
          </div>
        )}
        {syncMsg && (
          <div className="rounded-lg border px-4 py-3">
            <p className="text-sm text-muted-foreground">{syncMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          {viewMode === 'week' ? (
            <div className="overflow-hidden rounded-lg border bg-background">
              {/* Day header row */}
              <div className="grid grid-cols-[64px_repeat(7,minmax(120px,1fr))] border-b">
                <div className="sticky left-0 z-30 border-r bg-muted/30" />
                {days.map(day => {
                  const isToday = new Date().toDateString() === day.toDateString()
                  return (
                    <div key={day.toISOString()} className={`border-r px-3 py-2 text-center last:border-r-0 ${isToday ? 'bg-primary/5' : ''}`}>
                      <div className="text-xs font-medium text-muted-foreground">{WEEKDAYS[day.getDay()]}</div>
                      <div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
                        {day.getDate()}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Time grid */}
              <div className="max-h-[760px] overflow-auto">
                <div
                  className="grid grid-cols-[64px_repeat(7,minmax(120px,1fr))]"
                  style={{ height: `${(DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT}px` }}
                >
                  {/* Hour labels */}
                  <div className="sticky left-0 z-20 relative border-r bg-background">
                    {hours.map(hour => (
                      <div key={hour} className="absolute left-0 right-0 border-t bg-background px-2 text-right text-[11px] text-muted-foreground"
                        style={{ top: `${(hour - DAY_START_HOUR) * HOUR_HEIGHT - (hour === DAY_END_HOUR ? 16 : 0)}px` }}>
                        {hour === 24 ? '24' : pad2(hour)}:00
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {days.map(day => {
                    const dayEntries = entriesForDay(day)
                    const isToday = now.toDateString() === day.toDateString()
                    const nowMinutes = (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes()
                    const nowTop = (nowMinutes / 60) * HOUR_HEIGHT
                    const showNowLine = isToday && nowMinutes >= 0 && nowMinutes <= (DAY_END_HOUR - DAY_START_HOUR) * 60

                    return (
                      <DroppableDayColumn key={day.toISOString()} day={day} onColumnClick={handleColumnClick} snapPreview={snapPreview}>
                        {/* Hour grid lines */}
                        {hours.map(hour => (
                          <div key={hour} className="absolute left-0 right-0 border-t border-muted"
                            style={{ top: `${(hour - DAY_START_HOUR) * HOUR_HEIGHT}px` }} />
                        ))}

                        {/* 15-minute grid lines */}
                        {Array.from({ length: (DAY_END_HOUR - DAY_START_HOUR) * 4 }, (_, q) => q).map(q =>
                          q % 4 !== 0 ? (
                            <div key={`q${q}`} className="absolute left-0 right-0 border-t border-muted/25"
                              style={{ top: `${(q / 4) * HOUR_HEIGHT}px` }} />
                          ) : null
                        )}

                        {/* Current time indicator */}
                        {showNowLine && (
                          <div className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                            style={{ top: `${nowTop}px` }}>
                            <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                            <div className="flex-1 h-px bg-red-500" />
                          </div>
                        )}

                        {/* Calendar events */}
                        {dayEntries.map(entry => {
                          const position = entryPosition(entry)
                          const colorClass = entry.kind === 'external'
                            ? 'bg-zinc-100 border-zinc-300 text-zinc-700'
                            : STATUS_COLORS[entry.item.status]
                          return (
                            <DraggableEventBlock
                              key={`${entry.kind}-${entry.kind === 'site' ? entry.item.id : entry.item.google_event_id}`}
                              entry={entry}
                              onClick={() => setSelected(entry)}
                              className={colorClass}
                              style={{ top: `${position.top}px`, height: `${position.height}px` }}
                            />
                          )
                        })}
                      </DroppableDayColumn>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border bg-background">
              <div className="border-b px-4 py-3">
                <h2 className="font-semibold">Agenda</h2>
                <p className="text-sm text-muted-foreground">Chronological list for {weekLabel}</p>
              </div>
              <div className="divide-y">
                {allEntries.length === 0 ? (
                  <p className="p-6 text-sm text-muted-foreground">No scheduled items this week.</p>
                ) : (
                  allEntries.map(entry => {
                    const start = entryStart(entry)
                    return (
                      <button
                        key={`${entry.kind}-${entry.kind === 'site' ? entry.item.id : entry.item.google_event_id}`}
                        onClick={() => setSelected(entry)}
                        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-muted/50"
                      >
                        <div className="w-24 text-sm text-muted-foreground">{shortDate(start)}</div>
                        <div className="w-14 text-sm font-medium">{shortTime(start)}</div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{entryTitle(entry)}</p>
                          <p className="text-xs text-muted-foreground">{entry.kind === 'external' ? 'Google Calendar event' : 'Goal-to-Grid task'}</p>
                        </div>
                      </button>
                    )
                  })
                )}
              </div>
            </div>
          )}

          <aside className="space-y-3">
            <UnscheduledDropZone>
              <h2 className="font-semibold">Unscheduled Tasks</h2>
              <p className="mt-1 text-xs text-muted-foreground">Drag tasks onto the calendar. Drag scheduled items back here to unschedule them.</p>
              <div className="mt-3 max-h-[420px] space-y-2 overflow-auto">
                {unscheduledTasks.length === 0 ? (
                  <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">All tasks are scheduled. Drop a calendar item here to unschedule it.</p>
                ) : (
                  unscheduledTasks.map(task => (
                    <DraggableTaskCard key={task.id} task={task} onPlace={() => openManual(task)} />
                  ))
                )}
              </div>
            </UnscheduledDropZone>

            <div className="rounded-lg border p-3 text-xs text-muted-foreground space-y-1">
              <p><span className="font-semibold text-foreground">Drag tasks</span> from the list above onto any 15-minute slot.</p>
              <p><span className="font-semibold text-foreground">Drag events</span> within the calendar to move them, or back to Unscheduled Tasks to remove them from the calendar.</p>
              <p><span className="font-semibold text-foreground">Click any empty slot</span> in the calendar to open the manual scheduling dialog.</p>
            </div>
          </aside>
        </div>

        {/* Event detail dialog */}
        {selected && (
          <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{entryTitle(selected)}</DialogTitle>
                <DialogDescription>
                  {selected.kind === 'site'
                    ? 'Created by Goal-to-Grid — editable here.'
                    : 'External Google Calendar event — read-only.'}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex gap-2">
                  {selected.kind === 'site'
                    ? <Badge variant={STATUS_BADGE[selected.item.status]}>{selected.item.status}</Badge>
                    : <Badge variant="outline">Google Event</Badge>}
                </div>
                <p className="text-sm text-muted-foreground">
                  {dateTimeLabel(entryStart(selected))} — {shortTime(entryEnd(selected))}
                </p>
                {selected.kind === 'site' ? (
                  <div className="space-y-3">
                    <div className="rounded-md border p-3">
                      <p className="text-xs font-medium text-muted-foreground">Was the planned duration right?</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => sendTimeFeedback('too_short')}>Too short</Button>
                        <Button size="sm" variant="outline" onClick={() => sendTimeFeedback('accurate')}>Accurate</Button>
                        <Button size="sm" variant="outline" onClick={() => sendTimeFeedback('too_long')}>Too long</Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => updateStatus(selected.item.id, 'Done')} disabled={selected.item.status === 'Done'}>Mark Done</Button>
                      <Button size="sm" variant="outline" onClick={() => openEdit(selected.item)}><Pencil className="h-4 w-4 mr-1" />Edit Time</Button>
                      <Button size="sm" variant="destructive" onClick={() => deleteSiteItem(selected.item.id)}><Trash2 className="h-4 w-4 mr-1" />Delete</Button>
                      <Button size="sm" variant="outline" onClick={() => setSelected(null)}>Close</Button>
                    </div>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setSelected(null)}>Close</Button>
                )}
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Manual plan dialog */}
        <Dialog open={manualOpen} onOpenChange={next => { setManualOpen(next); if (!next) setEditingItem(null) }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingItem ? 'Edit Scheduled Time' : 'Plan Task Manually'}</DialogTitle>
              <DialogDescription>Choose the exact time. The event will be synced to Google Calendar.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Task</Label>
                <select
                  className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  value={manualForm.task_id}
                  onChange={e => {
                    const task = allTasks.find(t => t.id === e.target.value)
                    setManualForm(f => {
                      const dm = task?.duration_min ?? (f.durationHours * 60 + f.durationMins)
                      return { ...f, task_id: e.target.value, durationHours: Math.floor(dm / 60), durationMins: dm % 60 }
                    })
                  }}
                  required
                  disabled={!!editingItem}
                >
                  <option value="">Select a task...</option>
                  {allTasks.map(task => <option key={task.id} value={task.id}>{task.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input type="time" value={manualForm.start_time} onChange={e => setManualForm(f => ({ ...f, start_time: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Duration</Label>
                  <div className="flex items-center gap-1.5">
                    <Input type="number" min={0} max={23} className="w-16" value={manualForm.durationHours} onChange={e => setManualForm(f => ({ ...f, durationHours: Math.max(0, Number(e.target.value)) }))} />
                    <span className="text-sm text-muted-foreground">h</span>
                    <Input type="number" min={0} max={59} step={5} className="w-16" value={manualForm.durationMins} onChange={e => setManualForm(f => ({ ...f, durationMins: Math.max(0, Math.min(59, Number(e.target.value))) }))} />
                    <span className="text-sm text-muted-foreground">m</span>
                  </div>
                </div>
              </div>
              {manualGoalWarning && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
                  {manualGoalWarning}
                </div>
              )}
              <Button type="submit" className="w-full">{editingItem ? 'Save Time' : 'Place Task'}</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Suggest slots dialog */}
        <Dialog open={schedulerOpen} onOpenChange={setSchedulerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Suggest Slots</DialogTitle>
              <DialogDescription>Select tasks and let the engine suggest available slots. You choose what gets placed.</DialogDescription>
            </DialogHeader>
            <div className="max-h-60 overflow-auto space-y-1 border rounded-md p-2">
              {unscheduledTasks.map(t => (
                <label key={t.id} className="flex items-center gap-2 text-sm p-1 hover:bg-accent rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={taskIds.includes(t.id)}
                    onChange={e => setTaskIds(prev => e.target.checked ? [...prev, t.id] : prev.filter(id => id !== t.id))}
                  />
                  <span>{t.name}</span>
                  <span className="text-muted-foreground ml-auto">{formatDuration(t.duration_min)}</span>
                </label>
              ))}
              {unscheduledTasks.length === 0 && <p className="text-sm text-muted-foreground p-2">No unscheduled tasks found.</p>}
            </div>
            {suggestedSlots.length > 0 && (
              <div className="max-h-72 overflow-auto space-y-3 rounded-md border p-3">
                {suggestedSlots.map(slot => (
                  <div key={slot.task_id} className="space-y-2">
                    <div>
                      <p className="text-sm font-medium">{slot.task?.name ?? 'Task'}</p>
                      {slot.task?.goals && (
                        <p className="text-xs text-muted-foreground">
                          Goal window: {slot.task.goals.start_date} - {slot.task.goals.end_date}
                        </p>
                      )}
                    </div>
                    {slot.suggestions.length === 0 ? (
                      <p className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                        No available slot found inside this goal&apos;s date range.
                      </p>
                    ) : (
                      <div className="grid gap-2">
                        {slot.suggestions.map(option => {
                          const start = new Date(option.scheduled_start)
                          const end = new Date(option.scheduled_end)
                          return (
                            <Button
                              key={option.scheduled_start}
                              type="button"
                              variant="outline"
                              className="justify-between"
                              onClick={() => applySuggestion(slot, option)}
                            >
                              <span>{shortDate(start, true)} {shortTime(start)}</span>
                              <span className="text-muted-foreground">{shortTime(end)}</span>
                            </Button>
                          )
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <Button onClick={handleSchedule} disabled={scheduling || taskIds.length === 0}>
              {scheduling ? 'Finding suggestions...' : `Find suggestions for ${taskIds.length} task(s)`}
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      {/* Drag overlay — shown while dragging */}
      <DragOverlay>
        {activeDragTask && (
          <div className="rounded-md border bg-background p-2 shadow-lg text-sm opacity-90 w-40 pointer-events-none">
            <p className="font-medium truncate">{activeDragTask.name}</p>
            <p className="text-xs text-muted-foreground">{formatDuration(activeDragTask.duration_min)}</p>
          </div>
        )}
        {activeDragItem && (
          <div className={cn('rounded-md border px-2 py-1 text-xs shadow-lg opacity-90 w-32 pointer-events-none', STATUS_COLORS[activeDragItem.status])}>
            <p className="font-medium truncate">{(activeDragItem.tasks as unknown as { name: string }).name}</p>
            <p className="opacity-70">
              {formatDuration(Math.round(
                (new Date(activeDragItem.scheduled_end).getTime() - new Date(activeDragItem.scheduled_start).getTime()) / 60000
              ))}
            </p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

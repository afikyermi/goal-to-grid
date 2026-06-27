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
import { AlertTriangle, CalendarPlus, CalendarSync, CheckCircle2, ChevronLeft, ChevronRight, GripVertical, Pencil, Trash2, Zap, Plus } from 'lucide-react'
import type { ExternalCalendarEvent, GoalWithSector, ScheduleItemWithTask, Task, TaskWithGoal, UserConstraint } from '@/lib/types'
import { cn, formatDuration } from '@/lib/utils'

type ViewMode = 'week' | 'agenda'
type ManualMode = 'existing' | 'new_planned' | 'new_inbox'

type CalendarEntry =
  | { kind: 'site'; item: ScheduleItemWithTask }
  | { kind: 'external'; item: ExternalCalendarEvent }

type SuggestedSlot = {
  task_id: string
  task?: TaskWithGoal
  suggestions: Array<{ scheduled_start: string; scheduled_end: string }>
}

const STATUS_COLORS: Record<string, { normal: string; long: string }> = {
  Pending: {
    normal: 'bg-[oklch(0.88_0.075_255)] border-[oklch(0.58_0.15_255)] text-[oklch(0.25_0.12_255)]',
    long: 'bg-[oklch(0.88_0.075_255)] border-[oklch(0.58_0.15_255)] text-[oklch(0.25_0.12_255)] opacity-55',
  },
  Done: {
    normal: 'bg-[oklch(0.88_0.075_145)] border-[oklch(0.52_0.13_145)] text-[oklch(0.25_0.10_145)]',
    long: 'bg-[oklch(0.88_0.075_145)] border-[oklch(0.52_0.13_145)] text-[oklch(0.25_0.10_145)] opacity-55',
  },
  Missed: {
    normal: 'bg-[oklch(0.91_0.06_27)] border-destructive/55 text-destructive',
    long: 'bg-[oklch(0.91_0.06_27)] border-destructive/55 text-destructive opacity-55',
  },
}

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive'> = {
  Pending: 'default',
  Done: 'secondary',
  Missed: 'destructive',
}

const PRIORITY_LABELS: Record<number, string> = {
  1: 'High',
  2: 'Medium',
  3: 'Low',
}

function siteStatusClass(status: string, isLong = false): string {
  return STATUS_COLORS[status]?.[isLong ? 'long' : 'normal'] ?? STATUS_COLORS.Pending.normal
}

function inboxTaskClass(isLong = false): string {
  return cn(
    'bg-[oklch(0.88_0.055_235)] border-[oklch(0.55_0.12_235)] text-[oklch(0.24_0.10_235)]',
    isLong && 'opacity-55'
  )
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

function normalizeDurationParts(hours: number, minutes: number) {
  const total = Math.max(0, Math.round(hours) * 60 + Math.round(minutes))
  return {
    hours: Math.floor(total / 60),
    minutes: total % 60,
  }
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

function entryId(entry: CalendarEntry): string {
  return entry.kind === 'site' ? entry.item.id : entry.item.google_event_id
}

function isAllDay(entry: CalendarEntry): boolean {
  return entry.kind === 'external' && Boolean(entry.item.metadata?.google_meta?.is_all_day)
}

function isTransparent(entry: CalendarEntry): boolean {
  return entry.kind === 'external' && Boolean(entry.item.metadata?.google_meta?.is_transparent)
}

function externalDisplayColor(entry: CalendarEntry): string | null {
  if (entry.kind !== 'external') return null
  return entry.item.metadata?.google_meta?.display_color ?? null
}

function entryDurationMinutes(entry: CalendarEntry): number {
  return Math.round((entryEnd(entry).getTime() - entryStart(entry).getTime()) / 60000)
}

function eventColorStyle(color: string | null, isLong: boolean): React.CSSProperties {
  const base = color ?? '#1a73e8'
  return {
    backgroundColor: base,
    borderColor: base,
    color: '#ffffff',
    opacity: isLong ? 0.55 : 1,
  }
}

// Assigns side-by-side columns to overlapping entries (Google Calendar style).
function computeColumnLayout(entries: CalendarEntry[]): Map<string, { col: number; totalCols: number }> {
  if (entries.length === 0) return new Map()
  const sorted = [...entries].sort((a, b) => entryStart(a).getTime() - entryStart(b).getTime())
  const n = sorted.length
  const cols = new Array<number>(n).fill(0)
  const lastInCol: number[] = []

  for (let i = 0; i < n; i++) {
    let placed = false
    for (let c = 0; c < lastInCol.length; c++) {
      if (entryEnd(sorted[lastInCol[c]]).getTime() <= entryStart(sorted[i]).getTime()) {
        cols[i] = c
        lastInCol[c] = i
        placed = true
        break
      }
    }
    if (!placed) { cols[i] = lastInCol.length; lastInCol.push(i) }
  }

  // totalCols = width of this entry's overlap cluster
  const totalCols = new Array<number>(n).fill(1)
  for (let i = 0; i < n; i++) {
    const iS = entryStart(sorted[i]).getTime()
    const iE = entryEnd(sorted[i]).getTime()
    let maxCol = cols[i]
    for (let j = 0; j < n; j++) {
      if (i !== j && iS < entryEnd(sorted[j]).getTime() && iE > entryStart(sorted[j]).getTime()) {
        maxCol = Math.max(maxCol, cols[j])
      }
    }
    totalCols[i] = maxCol + 1
  }

  const result = new Map<string, { col: number; totalCols: number }>()
  for (let i = 0; i < n; i++) result.set(entryId(sorted[i]), { col: cols[i], totalCols: totalCols[i] })
  return result
}

// Shared day-matching predicate for both constraint functions — keeps logic in sync.
function matchesConstraintDay(c: UserConstraint, dayOfWeek: number): boolean {
  if (c.recurrence_days && c.recurrence_days.length > 0) {
    return c.recurrence_days.includes(dayOfWeek)
  }
  // Legacy fallback for rows that predate the recurrence_days migration
  return c.day_of_week === null || c.day_of_week === dayOfWeek
}

// Returns absolute-positioned blocks for a day's constraint zones (handles midnight-crossing).
function getConstraintBlocksForDay(
  constraints: UserConstraint[],
  dayOfWeek: number,
  hourHeight: number,
): Array<{ top: number; height: number; label: string }> {
  const blocks: Array<{ top: number; height: number; label: string }> = []
  const dayStartMin = DAY_START_HOUR * 60
  const dayEndMin   = DAY_END_HOUR   * 60

  for (const c of constraints) {
    if (!matchesConstraintDay(c, dayOfWeek)) continue
    const [sh, sm] = c.start_time.split(':').map(Number)
    const [eh, em] = c.end_time.split(':').map(Number)
    const cStart = sh * 60 + sm
    const cEnd   = eh * 60 + em

    if (cEnd > cStart) {
      // Normal window
      const visStart = Math.max(cStart, dayStartMin)
      const visEnd   = Math.min(cEnd,   dayEndMin)
      if (visStart < visEnd) blocks.push({
        top:    ((visStart - dayStartMin) / 60) * hourHeight,
        height: ((visEnd   - visStart)    / 60) * hourHeight,
        label:  c.label,
      })
    } else {
      // Crosses midnight — two visual blocks
      const visStartA = Math.max(cStart, dayStartMin)
      if (visStartA < dayEndMin) blocks.push({
        top:    ((visStartA - dayStartMin) / 60) * hourHeight,
        height: ((dayEndMin - visStartA)   / 60) * hourHeight,
        label:  c.label,
      })
      const visEndB = Math.min(cEnd, dayEndMin)
      if (visEndB > dayStartMin) blocks.push({
        top:    0,
        height: ((visEndB - dayStartMin) / 60) * hourHeight,
        label:  c.label,
      })
    }
  }
  return blocks
}

function overlapsConstraint(start: Date, end: Date, constraints: UserConstraint[]): boolean {
  const dayOfWeek = start.getDay()
  const startMin = start.getHours() * 60 + start.getMinutes()
  const endMin = end.getHours() * 60 + end.getMinutes()

  for (const c of constraints) {
    if (!matchesConstraintDay(c, dayOfWeek)) continue
    const [sh, sm] = c.start_time.split(':').map(Number)
    const [eh, em] = c.end_time.split(':').map(Number)
    const cStart = sh * 60 + sm
    const cEnd = eh * 60 + em

    if (cEnd > cStart) {
      if (startMin < cEnd && endMin > cStart) return true
    } else {
      if (startMin >= cStart || endMin <= cEnd) return true
    }
  }
  return false
}

// ── DnD sub-components ────────────────────────────────────────────────────────

function DroppableDayColumn({
  day, children, onColumnClick, snapPreview, constraintBlocks,
}: {
  day: Date
  children: React.ReactNode
  onColumnClick: (day: Date, e: React.MouseEvent<HTMLDivElement>) => void
  snapPreview: { date: string; startTime: string; top: number; height: number } | null
  constraintBlocks: Array<{ top: number; height: number; label: string }>
}) {
  const id = `day-col-${toDateInput(day)}`
  const { setNodeRef } = useDroppable({ id })
  const dateStr = toDateInput(day)
  return (
    <div
      ref={setNodeRef}
      id={id}
      data-calendar-day={dateStr}
      className="relative border-r border-border/70 bg-card last:border-r-0 cursor-crosshair transition-colors"
      onClick={e => onColumnClick(day, e)}
    >
      {/* Constraint zones — blocked time shown as amber background with label */}
      {constraintBlocks.map((block, i) => (
        <div
          key={i}
          className="absolute left-0 right-0 border-t border-b bg-[var(--constraint-fill)] border-[var(--constraint-border)] pointer-events-none z-0 overflow-hidden"
          style={{ top: `${block.top}px`, height: `${block.height}px` }}
        >
          {block.height >= 20 && (
            <span className="absolute left-1.5 top-0.5 text-[10px] font-medium text-[oklch(0.42_0.11_70)] truncate max-w-full pr-1">
              {block.label}
            </span>
          )}
        </div>
      ))}
      {children}
      {snapPreview?.date === dateStr && (
        <div
          className="absolute left-1 right-1 rounded-md border-2 border-primary/60 bg-[var(--status-active-bg)] pointer-events-none z-10 px-2 py-1 text-xs font-medium text-primary shadow-sm"
          style={{ top: `${snapPreview.top}px`, height: `${snapPreview.height}px` }}
        >
          {snapPreview.startTime}
        </div>
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
      className={cn(
        'group relative overflow-hidden rounded-lg border-2 border-primary/25 bg-gradient-to-br from-card to-[var(--status-active-bg)]/35 p-3 touch-none select-none shadow-sm transition-all cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:border-primary/55 hover:shadow-md',
        isDragging && 'opacity-40'
      )}
      {...attributes}
      {...listeners}
    >
      <div className="absolute left-0 top-0 h-full w-1 bg-primary/70" />
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background/75 text-primary shadow-sm transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{task.name}</p>
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">Drag</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="rounded-md">{formatDuration(task.duration_min)}</Badge>
            <Badge variant="outline" className="rounded-md">{PRIORITY_LABELS[task.priority] ?? 'Priority'}</Badge>
          </div>
        </div>
      </div>
      <Button
        variant="outline" size="sm" className="mt-3 w-full justify-center bg-muted/45 hover:bg-[var(--status-active-bg)]"
        onPointerDown={e => e.stopPropagation()}
        onClick={e => { e.stopPropagation(); onPlace() }}
      >
        <CalendarPlus className="mr-2 h-4 w-4" />
        Place in calendar
      </Button>
    </div>
  )
}

function DraggableMissedCard({
  item, taskName, wasDate, task, onComplete, onDismiss, onReschedule,
}: {
  item: ScheduleItemWithTask
  taskName: string
  wasDate: string
  task: TaskWithGoal | undefined
  onComplete: () => void
  onDismiss: () => void
  onReschedule: () => void
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `missed-${item.id}`,
    data: { type: 'missed', item },
  })
  const duration = Math.round(
    (new Date(item.scheduled_end).getTime() - new Date(item.scheduled_start).getTime()) / 60000
  )
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative overflow-hidden rounded-lg border-2 border-destructive/25 bg-gradient-to-br from-card to-destructive/10 p-3 text-xs touch-none select-none shadow-sm transition-all cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:border-destructive/50 hover:shadow-md',
        isDragging && 'opacity-40'
      )}
    >
      <div className="absolute left-0 top-0 h-full w-1 bg-destructive/70" />
      <div className="flex items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border bg-background/75 text-destructive shadow-sm transition-colors group-hover:bg-destructive group-hover:text-destructive-foreground">
          <GripVertical className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{taskName}</p>
            <span className="shrink-0 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-destructive">Drag</span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge variant="secondary" className="rounded-md">{formatDuration(duration)}</Badge>
            <Badge variant="outline" className="rounded-md">Was {wasDate}</Badge>
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2" onPointerDown={e => e.stopPropagation()}>
        {task && (
          <Button size="sm" variant="outline" className="h-8 flex-1 bg-muted/45 hover:bg-destructive/10" onClick={onReschedule}>
            Reschedule
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-8 px-3" title="Mark completed" onClick={onComplete}>
          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
        </Button>
        <Button size="sm" variant="ghost" className="h-8 px-3" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </div>
  )
}

function UnscheduledDropZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unscheduled-drop-zone' })

  return (
    <div
      ref={setNodeRef}
      data-unscheduled-dropzone="true"
      className={cn('rounded-xl border bg-card p-4 shadow-sm transition-colors', isOver && 'border-primary bg-[var(--status-active-bg)] ring-1 ring-primary/25')}
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
      id={id}
      style={style}
      className={cn(
        'absolute overflow-hidden rounded-md border px-2 py-1 text-left text-xs leading-tight shadow-sm transition-opacity hover:opacity-90 touch-none select-none',
        cls,
        isDragging && 'opacity-30 z-20',
      )}
      onClick={onClick}
      {...attributes}
      {...listeners}
    >
      <div className="truncate font-medium">{entryTitle(entry)}</div>
      <div className="opacity-75">{shortTime(start)}</div>
      {entry.kind === 'site' && entry.item.tasks.task_type === 'inbox' && <div className="mt-1 text-[10px] uppercase opacity-70">Inbox</div>}
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
  const [goals, setGoals] = useState<GoalWithSector[]>([])
  const [manualOpen, setManualOpen] = useState(false)
  const [schedulerOpen, setSchedulerOpen] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [taskIds, setTaskIds] = useState<string[]>([])
  const [suggestedSlots, setSuggestedSlots] = useState<SuggestedSlot[]>([])
  const [editingItem, setEditingItem] = useState<ScheduleItemWithTask | null>(null)
  const [manualForm, setManualForm] = useState({
    mode: 'existing' as ManualMode,
    task_id: '',
    newTaskName: '',
    newTaskGoalId: '',
    newTaskPriority: 2,
    date: toDateInput(new Date()),
    start_time: '09:00',
    durationHours: 0,
    durationMins: 30,
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
  const [now, setNow] = useState<Date | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [constraints, setConstraints] = useState<UserConstraint[]>([])
  const [constraintWarning, setConstraintWarning] = useState<{
    message: string
    onConfirm: () => void | Promise<void>
  } | null>(null)

  // DnD state
  const [activeDragTask, setActiveDragTask] = useState<Task | null>(null)
  const [activeDragItem, setActiveDragItem] = useState<ScheduleItemWithTask | null>(null)
  const [snapPreview, setSnapPreview] = useState<{ date: string; startTime: string; top: number; height: number } | null>(null)
  const lastPointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const dragGrabOffsetYRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const calendarScrollRef = useRef<HTMLDivElement>(null)
  const didAutoSweep = useRef(false)

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
    const refreshNow = () => setNow(new Date())
    const firstTick = window.setTimeout(refreshNow, 0)
    const id = window.setInterval(refreshNow, 30000)
    return () => {
      window.clearTimeout(firstTick)
      window.clearInterval(id)
    }
  }, [])

  const windowEnd = useMemo(() => addDays(weekStart, 7), [weekStart])
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart])

  const fetchScheduleItems = useCallback(async () => {
    const res = await fetch(`/api/schedule?week_start=${weekStart.toISOString()}`)
    if (res.ok) setItems(await res.json())
  }, [weekStart])

  const fetchExternalEvents = useCallback(async () => {
    const url = `/api/calendar/external-events?start=${weekStart.toISOString()}&end=${windowEnd.toISOString()}`
    const res = await fetch(url)
    if (res.ok) {
      const json = await res.json()
      setExternalEvents(json.events ?? [])
    }
  }, [weekStart, windowEnd])

  const fetchCalendarStatus = useCallback(async () => {
    const res = await fetch('/api/calendar/status')
    setCalendarStatus(res.ok ? await res.json() : null)
  }, [])

  // Refetch schedule items whenever the week changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchScheduleItems()
  }, [fetchScheduleItems])

  // Runs once on mount — marks overdue Pending items as Missed, creates new Pending slots
  useEffect(() => {
    if (didAutoSweep.current) return
    didAutoSweep.current = true
    void (async () => {
      try {
        const res = await fetch('/api/schedule/reschedule', { method: 'POST' })
        const json = res.ok ? await res.json() : null
        if ((json?.rescheduled ?? 0) > 0) {
          setSyncMsg(`${json.rescheduled} overdue task(s) automatically rescheduled.`)
        }
      } catch { /* silent — non-critical path */ }
      const r = await fetch(`/api/schedule?week_start=${weekStart.toISOString()}`)
      if (r.ok) setItems(await r.json())
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // On mount: tasks, calendar status, constraints, URL params
  useEffect(() => {
    fetch('/api/tasks?type=all').then(r => r.ok ? r.json() : []).then(setAllTasks)
    fetch('/api/goals').then(r => r.ok ? r.json() : []).then(setGoals)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCalendarStatus()
    fetch('/api/constraints').then(r => r.ok ? r.json() : []).then(setConstraints)

    requestAnimationFrame(() => {
      calendarScrollRef.current?.scrollTo({ top: 8 * HOUR_HEIGHT, behavior: 'instant' })
    })

    const params = new URLSearchParams(window.location.search)
    const connected = params.get('calendar_connected')
    const error = params.get('calendar_error')
    if (connected) setSyncMsg('Google Calendar connected. Your scheduled tasks can now sync there.')
    if (error && !error.toLowerCase().includes('not configured') && !error.toLowerCase().includes('oauth')) {
      setSyncMsg(error)
    }
  }, [fetchCalendarStatus])

  // Auto-import Google events whenever the week changes (read-only, background)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchCalendarStatus().then(() => {
      // calendarStatus is stale here — check after fetch via a local flag
    })
    void fetch('/api/calendar/status').then(r => r.ok ? r.json() : null).then(status => {
      if (status?.connected && !status?.needs_reconnect) {
        void fetch('/api/calendar/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ timeMin: weekStart.toISOString(), timeMax: windowEnd.toISOString() }),
        }).then(async r => {
          const json = await r.json().catch(() => ({}))
          if (!r.ok) setSyncMsg(`Google Calendar sync failed: ${json.error ?? `HTTP ${r.status}`}`)
          await fetchExternalEvents()
        }).catch(err => {
          setSyncMsg(`Google Calendar error: ${(err as Error).message}`)
          void fetchExternalEvents()
        })
      } else {
        void fetchExternalEvents()
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart])

  const activeItems = useMemo(() => items.filter(i => i.status !== 'Missed'), [items])
  const missedItems = useMemo(() => items.filter(i => i.status === 'Missed'), [items])

  const scheduledTaskIds = useMemo(
    () => new Set(activeItems.filter(i => i.status === 'Pending').map(i => i.task_id)),
    [activeItems]
  )
  const unscheduledTasks = allTasks.filter(t => !scheduledTaskIds.has(t.id) && !t.is_completed)
  const suggestableTasks = unscheduledTasks.filter(t => t.task_type === 'planned' && Boolean(t.goal_id))
  const hours = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR }, (_, i) => DAY_START_HOUR + i),
    []
  )
  const hourMarks = useMemo(
    () => Array.from({ length: DAY_END_HOUR - DAY_START_HOUR + 1 }, (_, i) => DAY_START_HOUR + i),
    []
  )
  const allEntries = useMemo<CalendarEntry[]>(() => {
    return [
      ...activeItems.map(item => ({ kind: 'site' as const, item })),
      ...externalEvents.map(item => ({ kind: 'external' as const, item })),
    ].sort((a, b) => entryStart(a).getTime() - entryStart(b).getTime())
  }, [externalEvents, activeItems])
  const hasAnyAllDay = useMemo(() => allEntries.some(isAllDay), [allEntries])

  // Pre-compute per-day column layouts (O(k²) × 7 — memoized so it only runs when entries change)
  const perDayLayouts = useMemo(() => {
    const map = new Map<string, Map<string, { col: number; totalCols: number }>>()
    for (const day of days) {
      const dayKey = day.toISOString()
      const dayEntries = allEntries.filter(entry => {
        const d = entryStart(entry)
        return (
          d.getDate() === day.getDate() &&
          d.getMonth() === day.getMonth() &&
          d.getFullYear() === day.getFullYear()
        )
      })
      const timedEntries = dayEntries.filter(e => !isAllDay(e))
      const blockingEntries = timedEntries.filter(e => !isTransparent(e))
      const layout = computeColumnLayout(blockingEntries)
      timedEntries.filter(isTransparent).forEach(e =>
        layout.set(entryId(e), { col: 0, totalCols: 1 })
      )
      map.set(dayKey, layout)
    }
    return map
  }, [allEntries, days])

  // Pre-compute constraint blocks for all 7 days (only recalculates when constraints or week changes)
  const perDayConstraintBlocks = useMemo(() => {
    const map = new Map<string, Array<{ top: number; height: number; label: string }>>()
    for (const day of days) {
      map.set(day.toISOString(), getConstraintBlocksForDay(constraints, day.getDay(), HOUR_HEIGHT))
    }
    return map
  }, [constraints, days])

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
      mode: task ? 'existing' : (opts ? 'new_inbox' : 'existing'),
      task_id: task?.id ?? '',
      newTaskName: '',
      newTaskGoalId: goals[0]?.id ?? '',
      newTaskPriority: 2,
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
      mode: 'existing',
      task_id: item.task_id,
      newTaskName: '',
      newTaskGoalId: '',
      newTaskPriority: 2,
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
    if (duration_min < 5) {
      setSyncMsg('Duration must be at least 5 minutes.')
      return
    }
    if (!editingItem && manualForm.mode === 'existing' && !manualForm.task_id) {
      setSyncMsg('Choose an existing task first.')
      return
    }
    if (!editingItem && manualForm.mode !== 'existing' && !manualForm.newTaskName.trim()) {
      setSyncMsg('Write a task name first.')
      return
    }
    if (!editingItem && manualForm.mode === 'new_planned' && !manualForm.newTaskGoalId) {
      setSyncMsg('Choose a goal for this planned task, or save it to Inbox.')
      return
    }
    const start = dateTimeLocal(manualForm.date, manualForm.start_time)
    const end = new Date(start.getTime() + duration_min * 60000)
    const endpoint = editingItem ? `/api/schedule/${editingItem.id}` : '/api/schedule'
    const createBody = manualForm.mode === 'existing'
      ? { task_id: manualForm.task_id, scheduled_start: start.toISOString(), scheduled_end: end.toISOString() }
      : {
          new_task: {
            name: manualForm.newTaskName,
            duration_min,
            priority: manualForm.newTaskPriority,
            task_type: manualForm.mode === 'new_inbox' ? 'inbox' : 'planned',
            goal_id: manualForm.mode === 'new_planned' ? manualForm.newTaskGoalId : null,
          },
          scheduled_start: start.toISOString(),
          scheduled_end: end.toISOString(),
        }
    const res = await fetch(endpoint, {
      method: editingItem ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingItem
        ? { scheduled_start: start.toISOString(), scheduled_end: end.toISOString() }
        : createBody),
    })
    const json = await res.json()
    if (!res.ok) { setSyncMsg(json.error ?? 'Failed to save schedule item'); return }
    if (json.warning) setSyncMsg(json.warning)
    else if (json.detail) setSyncMsg(json.detail)
    setManualOpen(false)
    setEditingItem(null)
    if (editingItem) {
      setItems(prev => prev.map(i => i.id === editingItem.id ? json as ScheduleItemWithTask : i))
    } else {
      if (json.task) setAllTasks(prev => [...prev, json.task as TaskWithGoal])
      setItems(prev => [...prev, json.item as ScheduleItemWithTask])
    }
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
    const snapshot = items.find(item => item.id === id) ?? null
    setItems(prev => prev.filter(item => item.id !== id))   // optimistic — instant
    setSelected(null)
    const res = await fetch(`/api/schedule/${id}`, { method: 'DELETE' })
    if (!res.ok && snapshot) {
      setItems(prev =>
        prev.some(i => i.id === id)
          ? prev
          : [...prev, snapshot].sort(
              (a, b) => new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime()
            )
      )
      setSyncMsg('Failed to remove task from calendar.')
    }
  }

  async function completeMissedItem(item: ScheduleItemWithTask) {
    setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'Done' } : i))
    const [schedRes, taskRes] = await Promise.all([
      fetch(`/api/schedule/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Done' }),
      }),
      fetch(`/api/tasks/${item.task_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_completed: true }),
      }),
    ])
    if (!schedRes.ok || !taskRes.ok) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'Missed' } : i))
      setSyncMsg('Failed to mark task as completed.')
    }
  }

  async function handleSync() {
    if (syncing) return
    setSyncMsg(null)
    setSyncing(true)
    try {
      const res = await fetch('/api/calendar/sync', { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setSyncMsg(json.detail ? `${json.error ?? json.message ?? 'Google Calendar sync failed.'} ${json.detail}` : json.error ?? json.message ?? 'Google Calendar sync failed.')
        return
      }
      setSyncMsg(json.detail ? `${json.message} ${json.detail}` : json.message ?? 'Google Calendar sync finished.')
      await fetchScheduleItems()
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
    if (json.item) setItems(prev => [...prev, json.item as ScheduleItemWithTask])
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
    if (rafRef.current !== null) return
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = null
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
        startTime: target.startTime,
        top: (startMin / 60) * HOUR_HEIGHT,
        height: Math.max(28, (durMin / 60) * HOUR_HEIGHT),
      })
    })
  }

  async function doPlaceTask(task: Task, targetStart: Date, targetEnd: Date) {
    const tempId = `temp-${Date.now()}`
    const tempItem: ScheduleItemWithTask = {
      id: tempId,
      task_id: task.id,
      scheduled_by: null,
      scheduled_start: targetStart.toISOString(),
      scheduled_end: targetEnd.toISOString(),
      status: 'Pending',
      google_event_id: null,
      created_at: new Date().toISOString(),
      tasks: {
        id: task.id,
        name: task.name,
        duration_min: task.duration_min,
        priority: task.priority,
        goal_id: task.goal_id,
        task_type: task.task_type,
        inbox_status: task.inbox_status,
        goals: (task as TaskWithGoal).goals ?? null,
      },
    }
    setItems(prev => [...prev, tempItem])
    const res = await fetch('/api/schedule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        task_id: task.id,
        scheduled_start: targetStart.toISOString(),
        scheduled_end: targetEnd.toISOString(),
      }),
    })
    const json = await res.json()
    if (!res.ok) {
      setItems(prev => prev.filter(i => i.id !== tempId))
      setSyncMsg(json.error ?? 'Failed to place task on the calendar.')
      return
    }
    setItems(prev => prev.map(i => i.id === tempId ? json.item as ScheduleItemWithTask : i))
    setSyncMsg(json.warning ?? null)
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
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    setActiveDragTask(null)
    setActiveDragItem(null)
    setSnapPreview(null)

    const { active } = event
    const overId = event.over?.id
    const type = active.data.current?.type as string

    if (type === 'task') {
      const task = active.data.current?.task as Task
      const target = getDropTargetFromPointer(task.duration_min)
      if (!target) return
      const end = new Date(target.start.getTime() + task.duration_min * 60000)

      if (overlapsConstraint(target.start, end, constraints)) {
        setConstraintWarning({
          message: `"${task.name}" overlaps a blocked constraint window. Schedule it here anyway?`,
          onConfirm: () => void doPlaceTask(task, target.start, end),
        })
        return
      }
      void doPlaceTask(task, target.start, end)
    } else if (type === 'missed') {
      const missedItem = active.data.current?.item as ScheduleItemWithTask
      const durationMs = new Date(missedItem.scheduled_end).getTime() - new Date(missedItem.scheduled_start).getTime()
      const durationMin = Math.max(SNAP_MINUTES, Math.round(durationMs / 60000))
      const target = getDropTargetFromPointer(durationMin)
      if (!target) return
      const newEnd = new Date(target.start.getTime() + durationMs)

      setItems(prev => prev.map(i =>
        i.id === missedItem.id
          ? { ...i, status: 'Pending', scheduled_start: target.start.toISOString(), scheduled_end: newEnd.toISOString() }
          : i
      ))

      const res = await fetch(`/api/schedule/${missedItem.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Pending',
          scheduled_start: target.start.toISOString(),
          scheduled_end: newEnd.toISOString(),
        }),
      })
      if (!res.ok) {
        setItems(prev => prev.map(i =>
          i.id === missedItem.id
            ? { ...i, status: 'Missed', scheduled_start: missedItem.scheduled_start, scheduled_end: missedItem.scheduled_end }
            : i
        ))
        setSyncMsg('Failed to reschedule missed task.')
      }
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
      if (!res.ok) {
        // Local rollback — restore original times without a full refetch
        setItems(prev => prev.map(i =>
          i.id === item.id
            ? { ...i, scheduled_start: item.scheduled_start, scheduled_end: item.scheduled_end }
            : i
        ))
        setSyncMsg('Failed to move task.')
        return
      }
      const json = await res.json()
      setSyncMsg(json.warning ?? 'Task moved on the calendar.')
    }
  }

  const weekLabel = `${shortDate(days[0])} - ${shortDate(days[6], true)}`
  const manualGoalWarning = (() => {
    const goal = manualForm.mode === 'existing'
      ? allTasks.find(t => t.id === manualForm.task_id)?.goals
      : manualForm.mode === 'new_planned'
        ? goals.find(g => g.id === manualForm.newTaskGoalId)
        : null
    if (!goal || !manualForm.date) return null
    if (manualForm.date < goal.start_date || manualForm.date > goal.end_date) {
      return `This task belongs to "${goal.name}", planned for ${goal.start_date} - ${goal.end_date}. You can still schedule it here.`
    }
    return null
  })()

  const manualConstraintWarning = (() => {
    if (!manualForm.date || !manualForm.start_time) return null
    const dm = manualForm.durationHours * 60 + manualForm.durationMins
    if (dm <= 0) return null
    const start = dateTimeLocal(manualForm.date, manualForm.start_time)
    const end = new Date(start.getTime() + dm * 60000)
    return overlapsConstraint(start, end, constraints)
      ? 'This time slot overlaps a blocked constraint window. You can still schedule here — constraints are soft boundaries.'
      : null
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
          <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
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
                    ? 'Google events load automatically each week. Press "Sync to Google" to push your tasks to Google Calendar.'
                    : calendarStatus.configured && calendarStatus.migration_applied
                      ? 'Connect your calendar to see busy time and sync scheduled tasks.'
                      : 'The schedule works inside Goal-to-Grid. Google sync is not available in this environment yet.'}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {calendarStatus.connected ? (
                  <>
                    <Button variant="outline" onClick={handleSync} disabled={syncing}>
                      <CalendarSync className="h-4 w-4 mr-2" />{syncing ? 'Syncing...' : 'Sync to Google'}
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
          <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
            <p className="text-sm text-muted-foreground">{syncMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          {viewMode === 'week' ? (
            <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
              {/* Day header row */}
              <div className="grid grid-cols-[64px_repeat(7,minmax(120px,1fr))] border-b bg-muted/35">
                <div className="sticky left-0 z-30 border-r bg-muted/60" />
                {days.map(day => {
                  const isToday = new Date().toDateString() === day.toDateString()
                  return (
                    <div key={day.toISOString()} className={`border-r px-3 py-2 text-center last:border-r-0 ${isToday ? 'bg-[var(--status-active-bg)]' : ''}`}>
                      <div className="text-xs font-medium text-muted-foreground">{WEEKDAYS[day.getDay()]}</div>
                      <div className={`mx-auto mt-1 flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold ${isToday ? 'bg-primary text-primary-foreground' : ''}`}>
                        {day.getDate()}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* All-day event row */}
              {hasAnyAllDay && (
                <div className="grid grid-cols-[64px_repeat(7,minmax(120px,1fr))] border-b">
                  <div className="border-r bg-muted/35 px-1 py-1 text-right text-[10px] text-muted-foreground pt-2">all‑day</div>
                  {days.map(day => {
                    const adEntries = entriesForDay(day).filter(isAllDay)
                    return (
                      <div key={day.toISOString()} className="border-r bg-card p-1 min-h-[28px] last:border-r-0 space-y-0.5">
                        {adEntries.map(entry => {
                          const color = externalDisplayColor(entry)
                          return (
                            <button
                              key={entryId(entry)}
                              onClick={() => setSelected(entry)}
                              className="block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white hover:opacity-90"
                              style={{ backgroundColor: color ?? '#3b82f6' }}
                            >
                              {entryTitle(entry)}
                            </button>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Time grid */}
              <div className="max-h-[760px] overflow-auto" ref={calendarScrollRef}>
                <div
                  className="grid grid-cols-[64px_repeat(7,minmax(120px,1fr))]"
                  style={{ height: `${(DAY_END_HOUR - DAY_START_HOUR) * HOUR_HEIGHT}px` }}
                >
                  {/* Hour labels */}
                  <div className="sticky left-0 z-20 relative border-r bg-muted/35">
                    {hourMarks.map(hour => (
                      <div key={hour} className="absolute left-0 right-0 border-t bg-muted/35 px-2 text-right text-[11px] text-muted-foreground"
                        style={{ top: `${(hour - DAY_START_HOUR) * HOUR_HEIGHT - (hour === DAY_END_HOUR ? 16 : 0)}px` }}>
                        {hour === 24 ? '24' : pad2(hour)}:00
                      </div>
                    ))}
                  </div>

                  {/* Day columns */}
                  {days.map(day => {
                    const dayEntries = entriesForDay(day)
                    const timedEntries = dayEntries.filter(e => !isAllDay(e))
                    const layout = perDayLayouts.get(day.toISOString()) ?? new Map()
                    const constraintBlocks = perDayConstraintBlocks.get(day.toISOString()) ?? []
                    const isToday = now ? now.toDateString() === day.toDateString() : false
                    const nowMinutes = now ? (now.getHours() - DAY_START_HOUR) * 60 + now.getMinutes() : -1
                    const nowTop = (nowMinutes / 60) * HOUR_HEIGHT
                    const showNowLine = isToday && nowMinutes >= 0 && nowMinutes <= (DAY_END_HOUR - DAY_START_HOUR) * 60

                    return (
                      <DroppableDayColumn
                        key={day.toISOString()}
                        day={day}
                        onColumnClick={handleColumnClick}
                        snapPreview={snapPreview}
                        constraintBlocks={constraintBlocks}
                      >
                        {/* Hour windows */}
                        {hours.map(hour => (
                          <div
                            key={hour}
                            className="absolute left-0 right-0 border-t border-border/70 bg-transparent hover:bg-accent/35"
                            style={{ top: `${(hour - DAY_START_HOUR) * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }}
                          />
                        ))}
                        <div className="absolute left-0 right-0 border-t border-border/70" style={{ top: `${DAY_WINDOW_MINUTES / 60 * HOUR_HEIGHT}px` }} />

                        {/* Current time indicator */}
                        {showNowLine && (
                          <div className="absolute left-0 right-0 z-10 pointer-events-none flex items-center"
                            style={{ top: `${nowTop}px` }}>
                            <div className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                            <div className="flex-1 h-px bg-red-500" />
                          </div>
                        )}

                        {/* Calendar events — side-by-side when overlapping */}
                        {timedEntries.map(entry => {
                          const position = entryPosition(entry)
                          const { col, totalCols } = layout.get(entryId(entry)) ?? { col: 0, totalCols: 1 }
                          const GAP = 2
                          const colW = 100 / totalCols
                          const leftPct  = col * colW
                          const widthPct = colW
                          const color = externalDisplayColor(entry)
                          const isLongEvent = entryDurationMinutes(entry) > 300
                          const colorClass = entry.kind !== 'external'
                            ? entry.item.tasks.task_type === 'inbox'
                              ? inboxTaskClass(isLongEvent)
                              : siteStatusClass(entry.item.status, isLongEvent)
                            : ''
                          const extraStyle: React.CSSProperties = (() => {
                            if (entry.kind !== 'external') return {}
                            return eventColorStyle(color, isLongEvent)
                          })()
                          return (
                            <DraggableEventBlock
                              key={`${entry.kind}-${entry.kind === 'site' ? entry.item.id : entry.item.google_event_id}`}
                              entry={entry}
                              onClick={() => setSelected(entry)}
                              className={cn(colorClass, 'hover:z-10')}
                              style={{
                                top: `${position.top}px`,
                                height: `${position.height}px`,
                                left: `calc(${leftPct}% + ${GAP}px)`,
                                width: `calc(${widthPct}% - ${GAP * 2}px)`,
                                ...extraStyle,
                              }}
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
            <div className="rounded-lg border bg-card shadow-sm">
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">Unscheduled Tasks</h2>
                  <p className="mt-1 text-xs text-muted-foreground">Drag a task into the calendar or place it manually.</p>
                </div>
                <Badge variant="secondary" className="rounded-md">{unscheduledTasks.length}</Badge>
              </div>
              <div className="mt-3 max-h-[420px] space-y-2 overflow-auto">
                {allTasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed bg-muted/25 p-3 text-sm text-muted-foreground">No tasks yet. Create goals and tasks in Plan first.</p>
                ) : unscheduledTasks.length === 0 ? (
                  <p className="rounded-lg border border-dashed bg-muted/25 p-3 text-sm text-muted-foreground">All tasks are scheduled. Drop a calendar item here to unschedule it.</p>
                ) : (
                  unscheduledTasks.map(task => (
                    <DraggableTaskCard key={task.id} task={task} onPlace={() => openManual(task)} />
                  ))
                )}
              </div>
            </UnscheduledDropZone>

            {missedItems.length > 0 && (
              <div className="rounded-xl border border-destructive/25 bg-card p-4 shadow-sm">
                <div className="rounded-lg bg-destructive/10 p-3">
                  <h2 className="flex items-center gap-2 text-sm font-semibold text-destructive">
                    <AlertTriangle className="h-4 w-4" />
                    Missed / Overdue ({missedItems.length})
                  </h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Move these back into the week or dismiss them.
                  </p>
                </div>
                <div className="mt-3 max-h-[280px] space-y-2 overflow-auto">
                  {missedItems.map(item => {
                    const taskName = (item.tasks as unknown as { name: string } | null)?.name ?? 'Task'
                    const task = allTasks.find(t => t.id === item.task_id)
                    const wasDate = new Date(item.scheduled_start).toLocaleDateString(undefined, {
                      month: 'short', day: 'numeric',
                    })
                    return (
                      <DraggableMissedCard
                        key={item.id}
                        item={item}
                        taskName={taskName}
                        wasDate={wasDate}
                        task={task}
                        onComplete={() => void completeMissedItem(item)}
                        onDismiss={() => void deleteSiteItem(item.id)}
                        onReschedule={() => task && openManual(task)}
                      />
                    )
                  })}
                </div>
              </div>
            )}

              <div className="rounded-lg border bg-card p-3 text-xs text-muted-foreground shadow-sm space-y-1">
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
              <DialogTitle>{editingItem ? 'Edit Scheduled Time' : 'Plan or Capture Task'}</DialogTitle>
              <DialogDescription>Choose the exact time. New quick tasks can stay in Inbox until you organize them.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleManualSubmit} className="space-y-4">
              {!editingItem && (
                <div className="grid grid-cols-3 gap-2 rounded-lg border bg-muted/25 p-1">
                  {[
                    ['existing', 'Existing'],
                    ['new_planned', 'New + Goal'],
                    ['new_inbox', 'Inbox'],
                  ].map(([mode, label]) => (
                    <Button
                      key={mode}
                      type="button"
                      variant={manualForm.mode === mode ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setManualForm(f => ({ ...f, mode: mode as ManualMode }))}
                    >
                      {label}
                    </Button>
                  ))}
                </div>
              )}

              {manualForm.mode === 'existing' || editingItem ? (
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
                    {allTasks.map(task => (
                      <option key={task.id} value={task.id}>
                        {task.task_type === 'inbox' ? '[Inbox] ' : ''}{task.name}
                      </option>
                    ))}
                  </select>
                  {manualForm.task_id && (
                    <p className="text-xs text-muted-foreground">
                      {(() => {
                        const task = allTasks.find(t => t.id === manualForm.task_id)
                        if (!task) return ''
                        return task.goals ? `Goal: ${task.goals.name}` : 'Inbox task: not linked to a goal yet.'
                      })()}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 rounded-lg border p-3">
                  <div className="space-y-2">
                    <Label>Task name</Label>
                    <Input
                      placeholder={manualForm.mode === 'new_inbox' ? 'e.g. Call insurance' : 'e.g. Buy paint supplies'}
                      value={manualForm.newTaskName}
                      onChange={e => setManualForm(f => ({ ...f, newTaskName: e.target.value }))}
                      required
                    />
                  </div>
                  {manualForm.mode === 'new_planned' ? (
                    <div className="space-y-2">
                      <Label>Goal</Label>
                      <select
                        className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                        value={manualForm.newTaskGoalId}
                        onChange={e => setManualForm(f => ({ ...f, newTaskGoalId: e.target.value }))}
                        required
                      >
                        <option value="">Select a goal...</option>
                        {goals.map(goal => (
                          <option key={goal.id} value={goal.id}>
                            {goal.sectors?.name ?? 'No domain'} / {goal.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <p className="rounded-md border border-dashed bg-muted/25 p-2 text-xs text-muted-foreground">
                      This will be saved to Inbox. You can assign it to a goal later.
                    </p>
                  )}
                  <div className="space-y-2">
                    <Label>Priority</Label>
                    <select
                      className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                      value={manualForm.newTaskPriority}
                      onChange={e => setManualForm(f => ({ ...f, newTaskPriority: Number(e.target.value) }))}
                    >
                      <option value={1}>High</option>
                      <option value={2}>Medium</option>
                      <option value={3}>Low</option>
                    </select>
                  </div>
                </div>
              )}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={manualForm.date} onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Start</Label>
                  <Input type="time" step={900} value={manualForm.start_time} onChange={e => setManualForm(f => ({ ...f, start_time: e.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label>Duration <span className="text-muted-foreground font-normal">= {formatDuration(manualForm.durationHours * 60 + manualForm.durationMins)}</span></Label>
                  <div className="flex items-center gap-1.5">
                    <Input type="number" min={0} className="w-16" value={manualForm.durationHours} onChange={e => setManualForm(f => ({ ...f, durationHours: Math.max(0, Number(e.target.value)) }))} />
                    <span className="text-sm text-muted-foreground">h</span>
                    <Input
                      type="number"
                      min={0}
                      step={5}
                      className="w-16"
                      value={manualForm.durationMins}
                      onChange={e => setManualForm(f => {
                        const next = normalizeDurationParts(f.durationHours, Number(e.target.value))
                        return { ...f, durationHours: next.hours, durationMins: next.minutes }
                      })}
                    />
                    <span className="text-sm text-muted-foreground">m</span>
                  </div>
                </div>
              </div>
              {manualGoalWarning && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
                  {manualGoalWarning}
                </div>
              )}
              {manualConstraintWarning && (
                <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
                  {manualConstraintWarning}
                </div>
              )}
              <Button type="submit" className="w-full">
                {editingItem
                  ? 'Save Time'
                  : manualForm.mode === 'new_inbox'
                    ? 'Capture in Inbox'
                    : manualForm.mode === 'new_planned'
                      ? 'Create and Place Task'
                      : 'Place Task'}
              </Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Constraint warning dialog */}
        {constraintWarning && (
          <Dialog open={!!constraintWarning} onOpenChange={() => setConstraintWarning(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Constraint Window Conflict</DialogTitle>
                <DialogDescription>{constraintWarning.message}</DialogDescription>
              </DialogHeader>
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => setConstraintWarning(null)}>Cancel</Button>
                <Button
                  onClick={() => {
                    const fn = constraintWarning.onConfirm
                    setConstraintWarning(null)
                    void fn()
                  }}
                >
                  Schedule Anyway
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {/* Suggest slots dialog */}
        <Dialog open={schedulerOpen} onOpenChange={setSchedulerOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Suggest Slots</DialogTitle>
              <DialogDescription>Select tasks and let the engine suggest available slots. You choose what gets placed.</DialogDescription>
            </DialogHeader>
            <div className="max-h-60 overflow-auto space-y-1 border rounded-md p-2">
              {suggestableTasks.map(t => (
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
              {suggestableTasks.length === 0 && <p className="text-sm text-muted-foreground p-2">No planned unscheduled tasks found.</p>}
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
          <div className="rounded-lg border bg-card p-3 shadow-lg text-sm opacity-95 w-44 pointer-events-none">
            <p className="font-medium truncate">{activeDragTask.name}</p>
            <p className="text-xs text-muted-foreground">{formatDuration(activeDragTask.duration_min)}</p>
          </div>
        )}
        {activeDragItem && (
          (() => {
            const duration = Math.round(
              (new Date(activeDragItem.scheduled_end).getTime() - new Date(activeDragItem.scheduled_start).getTime()) / 60000
            )
            return (
              <div className={cn('rounded-lg border px-2 py-1 text-xs shadow-lg opacity-95 w-36 pointer-events-none', siteStatusClass(activeDragItem.status, duration > 300))}>
                <p className="font-medium truncate">{(activeDragItem.tasks as unknown as { name: string }).name}</p>
                <p className="opacity-70">{formatDuration(duration)}</p>
              </div>
            )
          })()
        )}
      </DragOverlay>
    </DndContext>
  )
}

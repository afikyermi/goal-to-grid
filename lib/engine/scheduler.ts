import type { Task, UserConstraint } from '@/lib/types'
import { isSlotBlocked, type Interval } from './constraints'

const SLOT_INCREMENT = 15 // minutes between candidate slot checks

interface ScheduleInsert {
  task_id: string
  scheduled_start: string
  scheduled_end: string
  status: 'Pending'
}

type SchedulableTask = Task & {
  goals?: {
    id?: string
    start_date?: string | null
    end_date?: string | null
    deadline?: string | null
    priority?: number | null
  } | null
}

function deadlineTime(task: SchedulableTask): number {
  const deadline = task.goals?.end_date ?? task.goals?.deadline
  return deadline ? new Date(deadline).getTime() : Number.POSITIVE_INFINITY
}

function goalWindow(task: SchedulableTask): Interval | null {
  const startDate = task.goals?.start_date
  const endDate = task.goals?.end_date ?? task.goals?.deadline
  if (!startDate || !endDate) return null

  const start = new Date(`${startDate}T00:00:00`)
  const end = new Date(`${endDate}T23:59:59.999`)
  return { start, end }
}

function maxDate(a: Date, b: Date): Date {
  return a > b ? new Date(a) : new Date(b)
}

function minDate(a: Date, b: Date): Date {
  return a < b ? new Date(a) : new Date(b)
}

function alignToSlot(date: Date): Date {
  const aligned = new Date(date)
  const rem = aligned.getMinutes() % SLOT_INCREMENT
  if (rem !== 0) aligned.setMinutes(aligned.getMinutes() + (SLOT_INCREMENT - rem), 0, 0)
  else aligned.setSeconds(0, 0)
  return aligned
}

function sortedTasks(tasks: SchedulableTask[]): SchedulableTask[] {
  return [...tasks].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority - b.priority
    return deadlineTime(a) - deadlineTime(b)
  })
}

function findSlotsForTask(
  task: SchedulableTask,
  constraints: UserConstraint[],
  windowStart: Date,
  windowEnd: Date,
  occupied: Interval[],
  limit: number,
): Interval[] {
  const durationMs = task.duration_min * 60 * 1000
  const inheritedWindow = goalWindow(task)
  const searchStart = inheritedWindow ? maxDate(windowStart, inheritedWindow.start) : new Date(windowStart)
  const searchEnd = inheritedWindow ? minDate(windowEnd, inheritedWindow.end) : new Date(windowEnd)

  const slots: Interval[] = []
  let candidate = alignToSlot(searchStart)

  while (candidate.getTime() + durationMs <= searchEnd.getTime() && slots.length < limit) {
    const slotEnd = new Date(candidate.getTime() + durationMs)
    const slot: Interval = { start: candidate, end: slotEnd }

    if (!isSlotBlocked(slot, constraints, occupied)) {
      slots.push(slot)
    }

    candidate = new Date(candidate.getTime() + SLOT_INCREMENT * 60 * 1000)
  }

  return slots
}

export function suggestTaskSlots(
  tasks: SchedulableTask[],
  constraints: UserConstraint[],
  windowStart: Date,
  windowEnd: Date,
  existingOccupied: Interval[] = [],
  suggestionsPerTask = 3,
): Array<{ task_id: string; suggestions: Array<{ scheduled_start: string; scheduled_end: string }> }> {
  return sortedTasks(tasks).map(task => {
    const suggestions = findSlotsForTask(
      task,
      constraints,
      windowStart,
      windowEnd,
      existingOccupied,
      suggestionsPerTask,
    ).map(slot => ({
      scheduled_start: slot.start.toISOString(),
      scheduled_end: slot.end.toISOString(),
    }))

    return { task_id: task.id, suggestions }
  })
}

export function scheduleTasks(
  tasks: SchedulableTask[],
  constraints: UserConstraint[],
  windowStart: Date,
  windowEnd: Date,
  existingOccupied: Interval[] = []
): ScheduleInsert[] {
  const occupied: Interval[] = [...existingOccupied]
  const results: ScheduleInsert[] = []

  for (const task of sortedTasks(tasks)) {
    const bestSlot = findSlotsForTask(task, constraints, windowStart, windowEnd, occupied, 1)[0]

    if (bestSlot) {
      occupied.push(bestSlot)
      results.push({
        task_id: task.id,
        scheduled_start: bestSlot.start.toISOString(),
        scheduled_end: bestSlot.end.toISOString(),
        status: 'Pending',
      })
    } else {
      console.warn(`[scheduler] No slot found for task "${task.name}" in the given window`)
    }
  }

  return results
}

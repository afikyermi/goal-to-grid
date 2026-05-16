import type { UserConstraint } from '@/lib/types'

export interface Interval {
  start: Date
  end: Date
}

const ALLOWED_HOUR_START = 0  // midnight — full 24h; users define blocked windows via Constraints
const ALLOWED_HOUR_END   = 24

function timeStringToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && a.end > b.start
}

function appliesToDay(constraintDay: number | null, slotDay: number): boolean {
  return constraintDay === null || constraintDay === slotDay
}

function previousDay(day: number): number {
  return (day + 6) % 7
}

export function isSlotBlocked(
  slot: Interval,
  constraints: UserConstraint[],
  existingOccupied: Interval[]
): boolean {
  const slotDay = slot.start.getDay() // 0=Sun..6=Sat
  const slotStartMin = slot.start.getHours() * 60 + slot.start.getMinutes()
  const slotEndMin   = slot.end.getHours()   * 60 + slot.end.getMinutes()

  // Enforce allowed hours
  if (slotStartMin < ALLOWED_HOUR_START * 60) return true
  if (slotEndMin   > ALLOWED_HOUR_END   * 60) return true

  // Check user constraints
  for (const c of constraints) {
    const cStart = timeStringToMinutes(c.start_time)
    const cEnd   = timeStringToMinutes(c.end_time)

    if (cEnd > cStart) {
      if (!appliesToDay(c.day_of_week, slotDay)) continue
      if (slotStartMin < cEnd && slotEndMin > cStart) return true
      continue
    }

    const startsOnSlotDay = appliesToDay(c.day_of_week, slotDay)
    const startedPreviousDay = appliesToDay(c.day_of_week, previousDay(slotDay))

    if (startsOnSlotDay && slotEndMin > cStart) return true
    if (startedPreviousDay && slotStartMin < cEnd) return true
  }

  // Check already occupied slots
  for (const occ of existingOccupied) {
    if (overlaps(slot, occ)) return true
  }

  return false
}

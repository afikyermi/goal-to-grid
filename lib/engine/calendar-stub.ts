import type { ScheduleItem, Task } from '@/lib/types'

export interface CalendarService {
  createEvent(item: ScheduleItem, task: Task): Promise<string>   // returns google_event_id
  updateEvent(googleEventId: string, item: ScheduleItem): Promise<void>
  deleteEvent(googleEventId: string): Promise<void>
}

// Stub — replace body with real Google Calendar API client once credentials are configured
export const calendarStub: CalendarService = {
  createEvent: async () => {
    throw new Error('Google Calendar not configured. Add OAuth2 credentials to .env.local.')
  },
  updateEvent: async () => {
    throw new Error('Google Calendar not configured. Add OAuth2 credentials to .env.local.')
  },
  deleteEvent: async () => {
    throw new Error('Google Calendar not configured. Add OAuth2 credentials to .env.local.')
  },
}

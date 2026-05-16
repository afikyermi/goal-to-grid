import { createClient } from '@/lib/supabase/server'
import { recordBehaviorEvent } from '@/lib/behavior/events'
import { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const eventType = typeof body.event_type === 'string' ? body.event_type : ''
  if (!eventType) return Response.json({ error: 'event_type is required' }, { status: 400 })

  await recordBehaviorEvent({
    userId: user.id,
    eventType,
    taskId: body.task_id ?? null,
    goalId: body.goal_id ?? null,
    scheduleItemId: body.schedule_item_id ?? null,
    scheduledStart: body.scheduled_start ?? null,
    scheduledEnd: body.scheduled_end ?? null,
    metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata : {},
  })

  return Response.json({ ok: true })
}

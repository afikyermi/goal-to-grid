import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest } from 'next/server'

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()

  const body = await request.json()
  const { label, day_of_week, start_time, end_time } = body

  const { data: existing, error: existingError } = await admin
    .from('user_constraints')
    .select('user_id')
    .eq('id', id)
    .single()

  if (existingError) return Response.json({ error: existingError.message }, { status: 500 })
  if (existing.user_id !== user.id) return Response.json({ error: 'You can only edit your own constraints' }, { status: 403 })

  const { data, error } = await admin
    .from('user_constraints')
    .update({
      label,
      day_of_week: day_of_week ?? null,
      start_time,
      end_time,
    })
    .eq('id', id)
    .select('*, profiles(id, display_name)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const admin = createAdminClient()

  const { data: existing, error: existingError } = await admin
    .from('user_constraints')
    .select('user_id')
    .eq('id', id)
    .single()

  if (existingError) return Response.json({ error: existingError.message }, { status: 500 })
  if (existing.user_id !== user.id) return Response.json({ error: 'You can only delete your own constraints' }, { status: 403 })

  const { error } = await admin.from('user_constraints').delete().eq('id', id)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return new Response(null, { status: 204 })
}

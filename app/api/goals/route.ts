import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const sectorId = request.nextUrl.searchParams.get('sector_id')

  let query = supabase
    .from('goals')
    .select('*, sectors(id, name)')
    .order('end_date')
    .order('priority')
  if (sectorId) query = query.eq('sector_id', sectorId)

  const { data, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { sector_id, name, start_date, end_date, priority } = body

  if (!sector_id || !name || !start_date || !end_date) {
    return Response.json({ error: 'sector_id, name, start_date, and end_date are required' }, { status: 400 })
  }

  if (new Date(start_date) > new Date(end_date)) {
    return Response.json({ error: 'start_date must be before or equal to end_date' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('goals')
    .insert({
      sector_id,
      name,
      start_date,
      end_date,
      deadline: end_date,
      priority: priority ?? 2,
    })
    .select('*, sectors(id, name)')
    .single()

  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json(data, { status: 201 })
}

/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET /api/fields?q=searchTerm - search fields by name
export async function GET(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''

  let query = supabase.from('fields').select('*').order('name')

  if (q.trim()) {
    query = query.ilike('name', `%${q.trim()}%`)
  }

  const { data: fields, error } = await query.limit(10)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get average rating for each field
  const fieldsWithRatings = await Promise.all(
    (fields || []).map(async (field: any) => {
      const { data: ratings } = await supabase
        .from('field_ratings')
        .select('rating')
        .eq('field_id', field.id)

      const ratingValues = ratings?.map((r: any) => r.rating) || []
      const avgRating = ratingValues.length > 0
        ? Math.round((ratingValues.reduce((a: number, b: number) => a + b, 0) / ratingValues.length) * 10) / 10
        : null

      return {
        ...field,
        avg_rating: avgRating,
        rating_count: ratingValues.length
      }
    })
  )

  return NextResponse.json(fieldsWithRatings)
}

// POST /api/fields - create a new field
export async function POST(req: Request) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { name, google_maps_url } = body

  if (!name?.trim()) {
    return NextResponse.json({ error: 'Field name is required' }, { status: 400 })
  }

  // Check if field already exists
  const { data: existing } = await supabase
    .from('fields')
    .select('id')
    .ilike('name', name.trim())
    .single()

  if (existing) {
    return NextResponse.json({ id: existing.id, message: 'Field already exists' })
  }

  const { data, error } = await supabase
    .from('fields')
    .insert({
      name: name.trim(),
      google_maps_url: google_maps_url || null,
      created_by: user.id
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

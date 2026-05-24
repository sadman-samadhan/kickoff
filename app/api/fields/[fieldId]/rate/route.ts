import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/fields/[fieldId]/rate - rate a field
export async function POST(req: Request, { params }: { params: { fieldId: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { booking_id, rating, review } = body

  if (!rating || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
  }

  if (!booking_id) {
    return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 })
  }

  // Check if already rated
  const { data: existing } = await supabase
    .from('field_ratings')
    .select('id')
    .eq('field_id', params.fieldId)
    .eq('booking_id', booking_id)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    // Update existing rating
    const { data, error } = await supabase
      .from('field_ratings')
      .update({ rating, review: review || null })
      .eq('id', existing.id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Insert new rating
  const { data, error } = await supabase
    .from('field_ratings')
    .insert({
      field_id: params.fieldId,
      booking_id,
      user_id: user.id,
      rating,
      review: review || null
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

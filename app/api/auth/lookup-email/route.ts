import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const { username } = await req.json()
    if (!username) {
      return NextResponse.json({ error: 'Username required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('profiles')
      .select('email')
      .eq('username', username.toLowerCase())
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ email: data.email })
  } catch (err: unknown) {
    const error = err as Error
    console.error('Lookup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

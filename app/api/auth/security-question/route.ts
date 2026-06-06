import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('profiles')
      .select('security_question')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (error || !data) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!data.security_question) {
      return NextResponse.json({ error: 'Security question not configured for this user' }, { status: 400 })
    }

    return NextResponse.json({ question: data.security_question })
  } catch (err: unknown) {
    const error = err as Error
    console.error('Get security question error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const { email, answer, newPassword } = await req.json()

    if (!email || !answer || !newPassword) {
      return NextResponse.json({ error: 'Email, answer, and new password are required' }, { status: 400 })
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long' }, { status: 400 })
    }

    const admin = createAdminClient()
    
    // Fetch profile id and security answer
    const { data: profile, error: profileErr } = await admin
      .from('profiles')
      .select('id, security_answer')
      .eq('email', email.toLowerCase().trim())
      .single()

    if (profileErr || !profile) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!profile.security_answer) {
      return NextResponse.json({ error: 'Security question not set up for this user' }, { status: 400 })
    }

    // Compare answers case-insensitively and trimmed
    const match = profile.security_answer.trim().toLowerCase() === answer.trim().toLowerCase()
    if (!match) {
      return NextResponse.json({ error: 'Incorrect answer to security question' }, { status: 400 })
    }

    // Update user's password using admin client
    const { error: updateErr } = await admin.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    )

    if (updateErr) {
      console.error('Password update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update password: ' + updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (err: unknown) {
    const error = err as Error
    console.error('Post security question error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

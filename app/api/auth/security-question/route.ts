import { createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { verifyMessage, verifySecurityAnswer } from '@/lib/securityAnswers'

// Password reset with a security question (used instead of email reset links).

const GENERIC_NOT_AVAILABLE = 'Security question reset is not available for this account.'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const email = searchParams.get('email')

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 })
    }

    const { data } = await createAdminClient()
      .from('profiles')
      .select('security_question')
      .eq('email', email.toLowerCase().trim())
      .maybeSingle()

    // Same response whether or not the account exists, so this can't be used to probe emails.
    if (!data?.security_question) {
      return NextResponse.json({ error: GENERIC_NOT_AVAILABLE }, { status: 400 })
    }

    return NextResponse.json({ question: data.security_question })
  } catch (err: unknown) {
    console.error('Get security question error:', err)
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
    const { data: profile } = await admin
      .from('profiles')
      .select('id')
      .eq('email', String(email).toLowerCase().trim())
      .maybeSingle()

    if (!profile) {
      return NextResponse.json({ error: GENERIC_NOT_AVAILABLE }, { status: 400 })
    }

    const result = await verifySecurityAnswer(profile.id, answer)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.reason === 'not_set' ? GENERIC_NOT_AVAILABLE : verifyMessage(result) },
        { status: result.reason === 'locked' ? 429 : 400 },
      )
    }

    const { error: updateErr } = await admin.auth.admin.updateUserById(profile.id, { password: newPassword })
    if (updateErr) {
      console.error('Password update error:', updateErr)
      return NextResponse.json({ error: 'Failed to update password: ' + updateErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Password updated successfully' })
  } catch (err: unknown) {
    console.error('Post security question error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

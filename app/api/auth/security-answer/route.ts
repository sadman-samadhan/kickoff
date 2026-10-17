import { NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/groupAuth'
import { setSecurityAnswer, verifyMessage, verifySecurityAnswer } from '@/lib/securityAnswers'

// For the signed-in user: check their own security answer (before changing password), or set a new one.

export async function POST(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { answer } = await req.json().catch(() => ({}))
  if (!answer) return NextResponse.json({ error: 'Answer required' }, { status: 400 })

  const result = await verifySecurityAnswer(user.id, answer)
  if (!result.ok) {
    return NextResponse.json({ error: verifyMessage(result) }, { status: result.reason === 'locked' ? 429 : 400 })
  }
  return NextResponse.json({ ok: true })
}

export async function PUT(req: Request) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { question, answer } = await req.json().catch(() => ({}))
  if (!question || !String(answer || '').trim()) {
    return NextResponse.json({ error: 'Choose a question and enter an answer' }, { status: 400 })
  }
  await setSecurityAnswer(user.id, String(question).slice(0, 200), String(answer).slice(0, 200))
  return NextResponse.json({ ok: true })
}

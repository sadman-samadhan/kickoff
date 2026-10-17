'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { Sheet } from '@/components/ui/kit'
import { joinGroupByInvite } from './actions'

/** Signed-in visitor: pops up "Join <group>?" straight away; the card behind keeps a Join button too. */
export function JoinPrompt({ code, groupName, userName }: { code: string; groupName: string; userName: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [error, setError] = useState('')
  const [pending, start] = useTransition()

  function join() {
    setError('')
    start(async () => {
      const r = await joinGroupByInvite(code)
      if (!r.ok) return setError(r.error)
      router.replace(`/groups/${r.groupId}`)
    })
  }

  const actions = (
    <>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
          {error}
        </p>
      )}
      <button type="button" onClick={join} disabled={pending} className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-app-primary font-bold text-app-on-primary disabled:opacity-60">
        {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Join {groupName}
      </button>
    </>
  )

  return (
    <>
      <div className="mt-6 flex flex-col gap-2">
        {actions}
        <button type="button" onClick={() => router.push('/dashboard')} className="h-11 rounded-2xl font-semibold text-app-muted hover:text-app-ink">
          Not now
        </button>
      </div>

      {open && (
        <Sheet title={`Join ${groupName}?`} onClose={() => setOpen(false)}>
          <p className="text-app-muted">
            {userName ? (
              <>
                You&apos;re signed in as <b className="text-app-ink">{userName}</b>.{' '}
              </>
            ) : null}
            You&apos;ll see this group&apos;s matchdays, can RSVP, and join the chat.
          </p>
          <div className="flex flex-col gap-2">
            {actions}
            <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-2xl font-semibold text-app-muted hover:text-app-ink">
              Not now
            </button>
          </div>
        </Sheet>
      )}
    </>
  )
}

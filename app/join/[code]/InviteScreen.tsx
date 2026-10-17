import Link from 'next/link'
import { Users } from 'lucide-react'
import { BrandLogo } from '@/components/brand/BrandLogo'
import type { Invite } from './invite'
import { JoinPrompt } from './JoinPrompt'

/** The invite page's card: invalid link, signed out (create account / sign in), or signed in (confirm). */
export function InviteScreen({ code, group: g, signedIn, userName }: { code: string; group: Invite | null; signedIn: boolean; userName: string | null }) {
  const here = `/join/${code}`
  const initials = g ? g.name.trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() : ''

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 bg-app-bg px-4 py-10 text-app-ink">
      <Link href="/" aria-label="KhelaHbe home">
        <BrandLogo size={44} animate />
      </Link>

      {!g ? (
        <div className="w-full max-w-sm rounded-[28px] border border-app-line bg-app-surface p-6 text-center">
          <h1 className="font-display text-2xl font-extrabold">This invite link doesn&apos;t work</h1>
          <p className="mt-2 text-app-muted">It may have been mistyped or changed. Ask your group admin for a new link.</p>
          <Link href="/dashboard" className="mt-5 flex h-12 items-center justify-center rounded-2xl bg-app-ink font-bold text-app-bg">
            Go to KhelaHbe
          </Link>
        </div>
      ) : (
        <div className="w-full max-w-sm rounded-[28px] border border-app-line bg-app-surface p-6 text-center">
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-app-primary font-display text-2xl font-extrabold text-app-on-primary">
            {initials}
          </span>
          <p className="mt-4 text-sm font-bold uppercase tracking-[0.14em] text-app-primary">You&apos;re invited to join</p>
          <h1 className="mt-1 break-words font-display text-3xl font-extrabold leading-tight">{g.name}</h1>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-app-muted">
            <Users className="h-4 w-4" aria-hidden /> {g.members} {g.members === 1 ? 'member' : 'members'}
          </p>

          {signedIn ? (
            <JoinPrompt code={code} groupName={g.name} userName={userName} />
          ) : (
            <div className="mt-6 flex flex-col gap-2">
              <Link href={`/register?next=${encodeURIComponent(here)}`} className="flex h-12 items-center justify-center rounded-2xl bg-app-primary font-bold text-app-on-primary">
                Create an account and join
              </Link>
              <Link href={`/login?next=${encodeURIComponent(here)}`} className="flex h-12 items-center justify-center rounded-2xl border border-app-line font-bold">
                I already have an account
              </Link>
              <p className="mt-2 text-xs text-app-muted">You&apos;ll come straight back here to confirm.</p>
            </div>
          )}
        </div>
      )}
    </main>
  )
}

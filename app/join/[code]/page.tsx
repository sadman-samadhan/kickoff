import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { getAuthUser } from '@/lib/groupAuth'
import { appUrl } from '@/lib/utils'
import { loadInvite } from './invite'
import { InviteScreen } from './InviteScreen'

// Group invite link: /join/<invite code>.
//  • signed out → the group's name plus "Create account" / "Sign in", both bringing them back here;
//  • signed in → a "Join this group?" confirmation; already a member → straight to the group.
type Props = { params: { code: string } }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const g = await loadInvite(params.code)
  if (!g) return { title: 'Invite link · KhelaHbe', robots: { index: false } }
  const title = `Join ${g.name} on KhelaHbe`
  const description = `${g.members} ${g.members === 1 ? 'player is' : 'players are'} already in. RSVPs, teams, live scores and stats for your football group.`
  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: { title, description, siteName: 'KhelaHbe', url: appUrl(`/join/${params.code}`), images: [{ url: appUrl('/icons/icon-512.png'), width: 512, height: 512 }] },
    twitter: { card: 'summary', title, description },
  }
}

export default async function JoinPage({ params }: Props) {
  const g = await loadInvite(params.code)
  const user = g ? await getAuthUser() : null

  let userName: string | null = null
  if (g && user) {
    const admin = createAdminClient()
    const [{ data: membership }, { data: profile }] = await Promise.all([
      admin.from('group_members').select('id').eq('group_id', g.id).eq('player_id', user.id).maybeSingle(),
      admin.from('profiles').select('full_name').eq('id', user.id).maybeSingle(),
    ])
    if (membership) redirect(`/groups/${g.id}`)
    userName = profile?.full_name ?? null
  }

  return <InviteScreen code={params.code} group={g} signedIn={!!user} userName={userName} />
}

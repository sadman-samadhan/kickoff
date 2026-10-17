import { redirect } from 'next/navigation'
import { getAuthUser } from '@/lib/groupAuth'
import { getMyProfile } from '@/lib/profile'
import ProfileClient from './ProfileClient'

export default async function ProfilePage() {
  const user = await getAuthUser()
  if (!user) redirect('/login')

  const profile = await getMyProfile()

  return (
    <div className="pb-24">
      <ProfileClient initialProfile={profile} userId={user.id} />
    </div>
  )
}

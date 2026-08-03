import { BottomNav } from '@/components/layout/BottomNav'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { Providers } from '@/components/Providers'
import { SuspendedLayoutGuard } from '@/components/layout/SuspendedLayoutGuard'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <Providers profile={profile}>
      <SuspendedLayoutGuard isSuspended={!!profile?.is_suspended}>
        <div className="min-h-screen min-h-[100dvh] bg-transparent">
          {/* ── Top Header Bar ── */}
          <header className="fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-lg border-b border-neutral-100 flex items-center justify-between px-4 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <Link href="/dashboard" className="flex items-center">
              <Image src="/icons/logo.png" alt="KhelaHobe" width={40} height={40} className="rounded-lg" />
            </Link>
            <NotificationBell userId={user.id} />
          </header>

          {/* ── Main scrollable content ── */}
          <main className="pt-14 pb-[76px]">
            {children}
          </main>

          {/* ── Bottom Navigation ── */}
          <BottomNav />
        </div>
      </SuspendedLayoutGuard>
    </Providers>
  )
}

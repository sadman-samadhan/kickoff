import { BottomNav } from '@/components/layout/BottomNav'
import { NotificationBell } from '@/components/layout/NotificationBell'
import { Providers } from '@/components/Providers'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

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
      <div className="min-h-screen min-h-[100dvh] bg-slate-50">
        {/* ── Top Header Bar ── */}
        <header className="fixed top-0 left-0 right-0 h-14 bg-white/95 backdrop-blur-lg border-b border-neutral-100 flex items-center justify-between px-4 z-40 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <span className="text-xl" role="img" aria-label="football">⚽</span>
            <span className="font-black text-lg text-neutral-900 tracking-tight">KickOff</span>
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
    </Providers>
  )
}

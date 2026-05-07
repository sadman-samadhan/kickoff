"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, Clock, User } from 'lucide-react'

const tabs = [
  { name: 'Dashboard', href: '/dashboard', icon: Home },
  { name: 'Groups', href: '/groups', icon: Users },
  { name: 'History', href: '/match-history', icon: Clock },
  { name: 'Profile', href: '/profile', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-lg border-t border-neutral-200/80"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)' }}
    >
      <div className="flex justify-around items-end h-[60px] max-w-lg mx-auto px-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const isActive = pathname === tab.href || pathname.startsWith(tab.href + '/')

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`
                relative flex flex-col items-center justify-center flex-1 h-full pt-2
                transition-all duration-150 ease-out
                active:scale-90
                ${isActive ? 'text-green-600' : 'text-neutral-400'}
              `}
            >
              {/* Active indicator dot */}
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-[3px] bg-green-500 rounded-full" />
              )}

              <Icon
                className={`w-[22px] h-[22px] transition-all duration-150 ${
                  isActive ? 'stroke-green-600' : 'stroke-neutral-400'
                }`}
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] mt-1 font-semibold tracking-wide ${isActive ? 'text-green-600' : 'text-neutral-400'}`}>
                {tab.name}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}

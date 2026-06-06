"use client"

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Users, MessageCircle, MessagesSquare, User } from 'lucide-react'

import { useChatUnread } from '@/components/providers/ChatUnreadProvider'

const tabs = [
  { name: 'Home', href: '/dashboard', icon: Home },
  { name: 'Groups', href: '/groups', icon: Users },
  { name: 'Messages', href: '/messages', icon: MessageCircle, badge: true },
  { name: 'Forum', href: '/forum', icon: MessagesSquare },
  { name: 'Profile', href: '/profile', icon: User },
]

export function BottomNav() {
  const pathname = usePathname()
  const { totalUnread } = useChatUnread()

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-lg border-t border-neutral-200/80"
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

              <div className="relative">
                <Icon
                  className={`w-[22px] h-[22px] transition-all duration-150 ${
                    isActive ? 'stroke-green-600' : 'stroke-neutral-400'
                  }`}
                  strokeWidth={isActive ? 2.5 : 2}
                />
                {tab.badge && totalUnread > 0 && (
                  <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[9px] font-bold px-1.5 min-w-[16px] h-[16px] flex items-center justify-center rounded-full border-2 border-white">
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
              </div>
              
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

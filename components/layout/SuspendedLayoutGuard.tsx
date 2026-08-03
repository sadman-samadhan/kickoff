"use client"

import { usePathname } from 'next/navigation'
import { SuspendedLockScreen } from '@/components/modals/SuspendedLockScreen'

export function SuspendedLayoutGuard({
  isSuspended,
  children
}: {
  isSuspended: boolean
  children: React.ReactNode
}) {
  const pathname = usePathname()

  if (isSuspended && pathname !== '/profile') {
    return <SuspendedLockScreen />
  }

  return <>{children}</>
}

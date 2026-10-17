'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Fades its children up as they scroll into view. Server-rendered content stays visible; only things that are
 * below the fold when the page loads get hidden, then revealed. Off when the visitor prefers reduced motion.
 */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'idle' | 'pending' | 'shown'>('idle')

  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const r = el.getBoundingClientRect()
    if (r.top < window.innerHeight * 0.9) return // already on screen: leave it be
    setState('pending')
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setState('shown')
          io.disconnect()
        }
      },
      { rootMargin: '0px 0px -10% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={cn('transition-[opacity,transform] duration-700 ease-[cubic-bezier(.2,.8,.2,1)]', state === 'pending' && 'opacity-0 translate-y-6', className)}
      style={{ transitionDelay: state === 'shown' ? `${delay}ms` : undefined }}
    >
      {children}
    </div>
  )
}

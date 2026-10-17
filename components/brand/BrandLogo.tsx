'use client'

/* The KhelaHbe brand: a speeding football app mark, and the "khelah⊙be" wordmark whose "o" is the ball
   (so it reads "Khela Hobe"). Colours follow the theme tokens; `animate` rolls the ball in once. */

import { useId } from 'react'
import { ballPaths } from './ball'
import { cn } from '@/lib/utils'

const INK = '#14211a'
const BALL_31 = ballPaths(31)
const BALL_21 = ballPaths(21.5)

function Ball({ R, paths, clip, seam, rotate = -16 }: { R: number; paths: { patches: string; seams: string }; clip: string; seam: number; rotate?: number }) {
  return (
    <>
      <defs>
        <clipPath id={clip}>
          <circle r={R} />
        </clipPath>
      </defs>
      <circle r={R} fill="#ffffff" />
      <g clipPath={`url(#${clip})`}>
        <g transform={`rotate(${rotate})`}>
          <path d={paths.patches} fill={INK} />
          <path d={paths.seams} stroke={INK} strokeWidth={seam} strokeLinecap="round" fill="none" />
        </g>
      </g>
    </>
  )
}

/** App mark: the ball speeding across a green tile. */
export function BrandMark({ size = 40, className, animate = false, title }: { size?: number; className?: string; animate?: boolean; title?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 120 120"
      className={cn('shrink-0', className)}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="120" height="120" rx="30" fill="var(--brand-tile, #15803d)" />
      <g className={animate ? 'kh-lines' : undefined}>
        <path d="M12 44 H32 M8 60 H28 M14 76 H33" stroke="#d9f99d" strokeWidth="6.5" strokeLinecap="round" />
      </g>
      <g transform="translate(68 60)">
        <g className={animate ? 'kh-roll' : undefined}>
          <Ball R={31} paths={BALL_31} clip={`m${id}`} seam={2.4} />
          <circle r="31" fill="none" stroke={INK} strokeWidth="3" />
        </g>
      </g>
    </svg>
  )
}

/** The "o" of the wordmark: the ball inside a ring in the text colour. No clip path: the ring is drawn over the
 *  ball's edge, so this also works inside exported share images. */
function BallO({ animate }: { animate: boolean }) {
  return (
    <svg viewBox="-32 -32 64 64" aria-hidden className="inline-block w-[0.64em] h-[0.64em] mx-[0.015em] translate-y-[0.03em]">
      <g className={animate ? 'kh-roll-o' : undefined}>
        <circle r="22" fill="#ffffff" />
        <g transform="rotate(-16)">
          <path d={BALL_21.patches} fill={INK} />
          <path d={BALL_21.seams} stroke={INK} strokeWidth={2} strokeLinecap="round" fill="none" />
        </g>
      </g>
      <circle r="24.5" fill="none" stroke="currentColor" strokeWidth="5.5" />
    </svg>
  )
}

/** "khelah⊙be": ink + green, Archivo Black-weight. Screen readers hear "KhelaHbe". */
export function Wordmark({ className, animate = false, size }: { className?: string; animate?: boolean; size?: number }) {
  return (
    <span
      className={cn('font-black tracking-[-0.045em] leading-none inline-flex items-baseline normal-case', className)}
      style={{ fontFamily: 'var(--font-ka-archivo), system-ui, sans-serif', ...(size ? { fontSize: size } : {}) }}
    >
      <span className="sr-only">KhelaHbe</span>
      <span aria-hidden className="inline-flex items-baseline">
        khela
        <span className="text-app-primary inline-flex items-baseline">
          h<BallO animate={animate} />be
        </span>
      </span>
    </span>
  )
}

/** Mark + wordmark. `stacked` puts the wordmark under the mark (auth pages). */
export function BrandLogo({ size = 40, stacked = false, animate = false, className }: { size?: number; stacked?: boolean; animate?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center', stacked ? 'flex-col gap-3' : 'gap-2.5', className)}>
      <BrandMark size={size} animate={animate} />
      <Wordmark animate={animate} className="text-app-ink" size={Math.round(size * (stacked ? 0.5 : 0.62))} />
    </span>
  )
}

/* eslint-disable @next/next/no-img-element */
'use client'

// Shared building blocks for the Clean Pitch (light) / Floodlight (dark) look. They use the app-* theme
// tokens, so they switch with the theme on their own.

import { useEffect } from 'react'
import { X } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { kit } from '@/components/live/kit'
import { cn } from '@/lib/utils'

// ── Tabs ──

export type TabItem<K extends string> = { key: K; label: string; icon?: LucideIcon; badge?: number; count?: number }

/** Pill tabs (matchday sections, group tabs). The active tab is a solid ink pill. */
export function Tabs<K extends string>({
  items, value, onChange, className, label, stretch,
}: {
  items: TabItem<K>[]
  value: K
  onChange: (k: K) => void
  className?: string
  label?: string
  /** Equal-width tabs inside a surface (for 2–4 tabs); otherwise a scrollable pill row. */
  stretch?: boolean
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        'flex gap-1 overflow-x-auto',
        stretch && 'rounded-2xl bg-app-surface border border-app-line p-1',
        className,
      )}
    >
      {items.map((t) => {
        const active = t.key === value
        const Icon = t.icon
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(t.key)}
            className={cn(
              'relative shrink-0 min-h-11 px-4 rounded-full text-sm flex items-center justify-center gap-1.5 transition-colors',
              stretch && 'flex-1 rounded-xl px-2',
              active ? 'bg-app-ink text-app-bg font-bold' : 'text-app-muted font-semibold hover:text-app-ink',
            )}
          >
            {Icon && <Icon className="w-4 h-4" aria-hidden />}
            {t.label}
            {t.count !== undefined && (
              <span className={cn('text-[11px] font-bold tabular px-1.5 rounded-full', active ? 'bg-app-bg text-app-ink' : 'bg-app-soft')}>{t.count}</span>
            )}
            {!!t.badge && (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                {t.badge > 9 ? '9+' : t.badge}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ── Sheet ──

/** Bottom sheet on phones, centred dialog on wider screens. Escape and tapping outside close it. */
export function Sheet({ title, onClose, children, className }: { title: React.ReactNode; onClose: () => void; children: React.ReactNode; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/55" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'animate-in fade-in slide-in-from-bottom-4 w-full sm:max-w-md max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl bg-app-surface text-app-ink border border-app-line px-4 pt-3 pb-6 flex flex-col gap-4',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-1 rounded-full bg-app-line self-center sm:hidden" aria-hidden />
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0 font-display text-xl font-extrabold">{title}</div>
          <button type="button" onClick={onClose} aria-label="Close" className="w-11 h-11 rounded-full hover:bg-app-soft flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ── StatTile ──

/** A number with a label (profile stats, matchday summary). */
export function StatTile({ value, label, tone = 'default', className }: { value: React.ReactNode; label: string; tone?: 'default' | 'primary' | 'warn'; className?: string }) {
  return (
    <div className={cn('rounded-2xl bg-app-surface border border-app-line px-3 py-3 flex flex-col gap-0.5 min-w-0', className)}>
      <span
        className={cn(
          'font-display font-extrabold text-3xl leading-none tabular',
          tone === 'primary' && 'text-app-primary',
          tone === 'warn' && 'text-amber-500',
        )}
      >
        {value}
      </span>
      <span className="text-xs font-semibold text-app-muted truncate">{label}</span>
    </div>
  )
}

// ── TeamBadge ──

/** Team colour + name. `dot` for lists, `block` for a kit-coloured square with initials. */
export function TeamBadge({ name, color, variant = 'dot', className }: { name: string; color?: string | null; variant?: 'dot' | 'block'; className?: string }) {
  const k = kit(color)
  if (variant === 'block') {
    return (
      <span
        className={cn('inline-flex items-center justify-center w-11 h-11 rounded-2xl font-display font-extrabold text-base shrink-0', className)}
        style={{ background: k.base, color: k.ink, boxShadow: k.isLight ? 'inset 0 0 0 1px rgba(0,0,0,0.12)' : undefined }}
        aria-label={name}
      >
        {initialsOf(name)}
      </span>
    )
  }
  return (
    <span className={cn('inline-flex items-center gap-2 min-w-0 font-semibold', className)}>
      <span className="w-3 h-3 rounded-full shrink-0 ring-1 ring-black/10" style={{ background: k.base }} aria-hidden />
      <span className="truncate">{name}</span>
    </span>
  )
}

// ── PlayerChip ──

/** Avatar (or initials) + name, with optional trailing detail (position, points). */
export function PlayerChip({
  name, avatarUrl, detail, color, onClick, selected, className,
}: {
  name: string
  avatarUrl?: string | null
  detail?: React.ReactNode
  color?: string | null
  onClick?: () => void
  selected?: boolean
  className?: string
}) {
  const body = (
    <>
      <Avatar name={name} src={avatarUrl} color={color} size={28} />
      <span className="truncate font-semibold">{name}</span>
      {detail != null && <span className="ml-auto pl-2 text-xs font-bold text-app-muted shrink-0">{detail}</span>}
    </>
  )
  const cls = cn(
    'min-h-11 flex items-center gap-2 rounded-xl border px-2.5 py-1.5 text-sm text-left',
    selected ? 'border-app-primary ring-1 ring-app-primary bg-app-soft' : 'border-app-line bg-app-surface',
    className,
  )
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={selected} className={cls}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  )
}

export function Avatar({ name, src, color, size = 36 }: { name: string; src?: string | null; color?: string | null; size?: number }) {
  if (src) return <img src={src} alt="" width={size} height={size} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />
  const k = color ? kit(color) : null
  return (
    <span
      className={cn('rounded-full shrink-0 inline-flex items-center justify-center font-bold', !k && 'bg-app-soft text-app-muted')}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38), ...(k ? { background: k.base, color: k.ink } : {}) }}
      aria-hidden
    >
      {initialsOf(name)}
    </span>
  )
}

export function initialsOf(name: string) {
  const parts = (name || '?').trim().split(/\s+/)
  return ((parts[0]?.[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() || '?'
}

// ── Page header / section card ──

export function PageTitle({ title, subtitle, back, right }: { title: React.ReactNode; subtitle?: React.ReactNode; back?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-3">
      {back}
      <div className="flex-1 min-w-0">
        <h1 className="font-display font-extrabold text-2xl leading-tight truncate">{title}</h1>
        {subtitle && <div className="text-sm text-app-muted mt-0.5">{subtitle}</div>}
      </div>
      {right}
    </header>
  )
}

export function Card({ className, children, dark }: { className?: string; children: React.ReactNode; dark?: boolean }) {
  return (
    <section
      className={cn(
        'rounded-[22px] p-4',
        dark ? 'bg-neutral-900 text-white dark:bg-app-soft' : 'bg-app-surface border border-app-line',
        className,
      )}
    >
      {children}
    </section>
  )
}

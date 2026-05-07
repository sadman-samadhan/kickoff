"use client"

interface EmptyStateProps {
  emoji: string
  title: string
  subtitle: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ emoji, title, subtitle, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6">
      <span className="text-6xl mb-4">{emoji}</span>
      <h3 className="text-lg font-bold text-neutral-900 mb-1">{title}</h3>
      <p className="text-sm text-neutral-500 max-w-[240px] mb-6">{subtitle}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="bg-green-600 text-white text-sm font-bold px-6 py-2.5 rounded-xl hover:bg-green-700 active:scale-95 transition-all shadow-sm"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

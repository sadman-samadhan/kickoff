"use client"

export function MatchCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 border-l-4 border-l-neutral-200 p-4">
      <div className="flex justify-between items-start mb-3">
        <div className="flex gap-2">
          <span className="skeleton-shimmer rounded-full h-4 w-16" />
          <span className="skeleton-shimmer rounded-full h-4 w-20" />
        </div>
        <span className="skeleton-shimmer rounded h-4 w-4" />
      </div>
      <span className="skeleton-shimmer rounded h-4 w-28 block mb-2" />
      <div className="flex gap-3 mb-3">
        <span className="skeleton-shimmer rounded h-3 w-14" />
        <span className="skeleton-shimmer rounded h-3 w-24" />
      </div>
      <span className="skeleton-shimmer rounded-full h-1.5 w-full block" />
    </div>
  )
}

export function GroupCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-4 flex items-center gap-3">
      <span className="skeleton-shimmer rounded-xl w-10 h-10 shrink-0" />
      <div className="flex-1 space-y-2">
        <span className="skeleton-shimmer rounded h-4 w-32 block" />
        <span className="skeleton-shimmer rounded h-3 w-48 block" />
      </div>
      <span className="skeleton-shimmer rounded h-4 w-4 shrink-0" />
    </div>
  )
}

export function PlayerStatCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-3.5 flex items-center gap-3">
      <span className="skeleton-shimmer rounded h-5 w-6 shrink-0" />
      <span className="skeleton-shimmer rounded-full w-9 h-9 shrink-0" />
      <div className="flex-1 space-y-2">
        <span className="skeleton-shimmer rounded h-3.5 w-28 block" />
        <div className="flex gap-2">
          <span className="skeleton-shimmer rounded h-3 w-8" />
          <span className="skeleton-shimmer rounded h-3 w-8" />
          <span className="skeleton-shimmer rounded h-3 w-8" />
          <span className="skeleton-shimmer rounded h-3 w-8" />
        </div>
      </div>
    </div>
  )
}

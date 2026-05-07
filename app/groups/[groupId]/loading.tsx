import { MatchCardSkeleton } from '@/components/cards/CardSkeletons'

export default function GroupDetailLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 pt-6 max-w-xl mx-auto">
      {/* Group header skeleton */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="space-y-2">
            <span className="skeleton-shimmer rounded h-6 w-40 block" />
            <span className="skeleton-shimmer rounded h-3 w-24 block" />
          </div>
          <span className="skeleton-shimmer rounded-xl h-9 w-24" />
        </div>
        <span className="skeleton-shimmer rounded h-3 w-full block" />
      </div>

      {/* Next match skeleton */}
      <span className="skeleton-shimmer rounded h-5 w-28 block" />
      <MatchCardSkeleton />

      {/* Members row skeleton */}
      <span className="skeleton-shimmer rounded h-5 w-20 block" />
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 shrink-0">
            <span className="skeleton-shimmer rounded-full w-12 h-12" />
            <span className="skeleton-shimmer rounded h-2.5 w-10" />
          </div>
        ))}
      </div>

      {/* History skeleton */}
      <span className="skeleton-shimmer rounded h-5 w-32 block mt-2" />
      <MatchCardSkeleton />
      <MatchCardSkeleton />
    </div>
  )
}

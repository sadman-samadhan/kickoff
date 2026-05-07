import { MatchCardSkeleton } from '@/components/cards/CardSkeletons'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col gap-6 p-4 pt-6 max-w-xl mx-auto">
      {/* Header skeleton */}
      <div className="space-y-2">
        <span className="skeleton-shimmer rounded h-7 w-44 block" />
        <span className="skeleton-shimmer rounded h-4 w-56 block" />
      </div>

      {/* RSVP alert skeleton */}
      <div className="skeleton-shimmer rounded-2xl h-36 w-full" />

      {/* Upcoming matches */}
      <div className="space-y-3">
        <span className="skeleton-shimmer rounded h-5 w-36 block" />
        <MatchCardSkeleton />
        <MatchCardSkeleton />
        <MatchCardSkeleton />
      </div>
    </div>
  )
}

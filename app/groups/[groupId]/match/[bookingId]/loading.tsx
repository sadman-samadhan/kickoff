export default function MatchDetailLoading() {
  return (
    <div className="flex flex-col gap-5 p-4 pt-6 max-w-xl mx-auto">
      {/* Match info card skeleton */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-5 space-y-3">
        <span className="skeleton-shimmer rounded h-6 w-48 block" />
        <div className="flex gap-3">
          <span className="skeleton-shimmer rounded h-4 w-20" />
          <span className="skeleton-shimmer rounded h-4 w-28" />
        </div>
        <span className="skeleton-shimmer rounded-full h-5 w-24 block" />
      </div>

      {/* Player list skeleton */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-5 space-y-3">
        <span className="skeleton-shimmer rounded h-5 w-32 block" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="skeleton-shimmer rounded-full w-9 h-9 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <span className="skeleton-shimmer rounded h-3.5 w-28 block" />
              <span className="skeleton-shimmer rounded h-2.5 w-16 block" />
            </div>
          </div>
        ))}
      </div>

      {/* RSVP widget skeleton */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-5 space-y-3">
        <span className="skeleton-shimmer rounded h-5 w-28 block" />
        <div className="flex gap-2">
          <span className="skeleton-shimmer rounded-xl h-11 flex-1" />
          <span className="skeleton-shimmer rounded-xl h-11 flex-1" />
        </div>
      </div>

      {/* Teams skeleton */}
      <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-5 space-y-3">
        <span className="skeleton-shimmer rounded h-5 w-20 block" />
        <span className="skeleton-shimmer rounded-xl h-28 w-full block" />
      </div>
    </div>
  )
}

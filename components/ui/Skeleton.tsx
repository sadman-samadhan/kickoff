"use client"

function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`skeleton-shimmer rounded ${className}`} />
}

function SkeletonText({ className = '', width = 'w-24' }: { className?: string; width?: string }) {
  return <div className={`skeleton-shimmer rounded h-3 ${width} ${className}`} />
}

function SkeletonAvatar({ size = 'w-10 h-10' }: { size?: string }) {
  return <div className={`skeleton-shimmer rounded-full ${size}`} />
}

function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-neutral-100 p-4 ${className}`}>
      <div className="flex items-center gap-3 mb-3">
        <SkeletonAvatar />
        <div className="flex-1 space-y-2">
          <SkeletonText width="w-32" />
          <SkeletonText width="w-20" />
        </div>
      </div>
      <Skeleton className="h-2 w-full mb-2" />
      <Skeleton className="h-2 w-3/4" />
    </div>
  )
}

export { Skeleton, SkeletonText, SkeletonAvatar, SkeletonCard }

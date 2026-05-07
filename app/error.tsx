"use client"

import Link from 'next/link'

export default function GlobalError({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100 max-w-sm w-full text-center">
        <span className="text-5xl block mb-4">😕</span>
        <h1 className="text-xl font-black text-neutral-900 mb-2">Something went wrong</h1>
        <p className="text-sm text-neutral-500 mb-6">
          An unexpected error occurred. Don&apos;t worry — your data is safe.
        </p>
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="w-full bg-green-600 text-white rounded-xl py-3 font-bold shadow-sm hover:bg-green-700 active:scale-95 transition-all"
          >
            Try Again
          </button>
          <Link
            href="/dashboard"
            className="w-full bg-white border border-neutral-200 text-neutral-700 rounded-xl py-3 font-bold hover:bg-neutral-50 block text-center"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}

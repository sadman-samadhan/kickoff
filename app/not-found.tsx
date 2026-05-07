import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-neutral-100 max-w-sm w-full text-center">
        <span className="text-5xl block mb-4">⚽</span>
        <h1 className="text-xl font-black text-neutral-900 mb-2">Page not found</h1>
        <p className="text-sm text-neutral-500 mb-6">
          Looks like this page went offside. Let&apos;s get you back on the pitch.
        </p>
        <Link
          href="/dashboard"
          className="w-full bg-green-600 text-white rounded-xl py-3 font-bold shadow-sm hover:bg-green-700 active:scale-95 transition-all block text-center"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

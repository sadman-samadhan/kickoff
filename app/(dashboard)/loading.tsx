import { Loader2 } from 'lucide-react'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] w-full animate-in fade-in duration-500">
      <div className="relative flex items-center justify-center">
        {/* Outer pulsing ring */}
        <div className="absolute inset-0 rounded-full bg-green-500/20 animate-ping" style={{ animationDuration: '2s' }} />
        
        {/* Inner spinning loader */}
        <div className="bg-white p-4 rounded-full shadow-lg shadow-green-500/10 border border-green-50 relative z-10">
          <Loader2 className="w-8 h-8 animate-spin text-green-600" />
        </div>
      </div>
      
      <p className="mt-6 text-xs font-bold text-green-700/60 uppercase tracking-widest animate-pulse">
        Warming Up...
      </p>
    </div>
  )
}

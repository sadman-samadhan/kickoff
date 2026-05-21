"use client"

import { useEffect, useState } from 'react'
import { X } from 'lucide-react'

interface ToastProps {
  message: string
  onClose: () => void
  duration?: number
}

export function Toast({ message, onClose, duration = 4000 }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    setIsVisible(true)
    const timer = setTimeout(() => {
      setIsVisible(false)
      setTimeout(onClose, 300) 
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div className={`fixed top-20 left-4 right-4 z-[100] flex justify-center transition-all duration-300 ${isVisible ? 'translate-y-0 opacity-100' : '-translate-y-10 opacity-0 pointer-events-none'}`}>
      <div className="bg-green-600 text-white px-4 py-3 rounded-2xl shadow-lg flex items-center justify-between gap-3 max-w-sm w-full">
        <span className="text-sm font-bold flex-1">{message}</span>
        <button onClick={() => setIsVisible(false)} className="shrink-0 p-1 bg-green-700/50 rounded-full hover:bg-green-700 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

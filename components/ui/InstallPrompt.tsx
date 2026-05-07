"use client"

import { useState, useEffect } from 'react'
import { Download, X } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Don't show if already installed as standalone
    if (window.matchMedia('(display-mode: standalone)').matches) return

    // Check if dismissed recently
    const dismissed = localStorage.getItem('kickoff-install-dismissed')
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10)
      if (Date.now() - dismissedAt < 7 * 24 * 60 * 60 * 1000) return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setVisible(true)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setVisible(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    localStorage.setItem('kickoff-install-dismissed', Date.now().toString())
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="fixed bottom-20 left-3 right-3 z-50 bg-white rounded-2xl shadow-lg border border-neutral-200 p-4 flex items-center gap-3 animate-in slide-in-from-bottom-4 duration-300">
      <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center shrink-0">
        <Download className="w-5 h-5 text-green-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold text-neutral-900">📲 Add KickOff to your home screen</p>
        <p className="text-[11px] text-neutral-500">Get the best experience as a native app</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={handleInstall}
          className="bg-green-600 text-white text-xs font-bold px-3 py-2 rounded-xl hover:bg-green-700 active:scale-95 transition-all"
        >
          Install
        </button>
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-lg hover:bg-neutral-100 text-neutral-400"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

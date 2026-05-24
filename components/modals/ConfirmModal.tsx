"use client"

import { X, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  onConfirm: () => void
  onCancel: () => void
  isDestructive?: boolean
}

export default function ConfirmModal({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  isDestructive = true
}: ConfirmModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-neutral-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-sm rounded-3xl shadow-xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        <div className="p-5 pb-0 flex justify-between items-start">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${isDestructive ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-500'}`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
          <button onClick={onCancel} className="p-1 text-neutral-400 hover:text-neutral-600 rounded-full hover:bg-neutral-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 pt-3">
          <h3 className="font-bold text-lg text-neutral-900 mb-1">{title}</h3>
          <p className="text-sm text-neutral-600 leading-relaxed">{message}</p>
        </div>

        <div className="p-4 pt-0 flex gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1 rounded-xl h-11 text-neutral-600 border-neutral-200 hover:bg-neutral-50"
          >
            {cancelText}
          </Button>
          <Button
            onClick={() => {
              onConfirm()
              onCancel()
            }}
            className={`flex-1 rounded-xl h-11 text-white shadow-sm ${
              isDestructive 
                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                : 'bg-green-600 hover:bg-green-700 shadow-green-600/20'
            }`}
          >
            {confirmText}
          </Button>
        </div>

      </div>
    </div>
  )
}

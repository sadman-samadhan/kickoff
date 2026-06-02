'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'

interface Option {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  onChange: (value: string) => void
  options: Option[]
  placeholder?: string
  className?: string
  buttonClassName?: string
  dropdownClassName?: string
  disabled?: boolean
}

export function CustomSelect({
  value,
  onChange,
  options,
  placeholder = 'Select...',
  className = '',
  buttonClassName = '',
  dropdownClassName = '',
  disabled = false
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedOption = options.find(opt => opt.value === value)

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between border bg-white transition-colors focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none text-left disabled:opacity-50 disabled:cursor-not-allowed ${
          buttonClassName || 'px-3 py-2 border-neutral-300 rounded-xl text-sm'
        }`}
      >
        <span className={`truncate ${selectedOption ? 'text-neutral-900' : 'text-neutral-400'}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown className="w-4 h-4 text-neutral-400 ml-1.5 flex-shrink-0 transition-transform" />
      </button>

      {isOpen && (
        <div className={`absolute z-[100] w-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg max-h-60 overflow-y-auto py-1 animate-in fade-in duration-100 ${dropdownClassName}`}>
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value)
                setIsOpen(false)
              }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors truncate ${
                opt.value === value
                  ? 'bg-green-100 text-green-800 font-medium'
                  : 'text-neutral-700 hover:bg-green-100 hover:text-green-800'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

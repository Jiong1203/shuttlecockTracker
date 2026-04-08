'use client'

import { useEffect, useState } from 'react'
import { X, CheckCircle2, AlertCircle, Info, AlertTriangle } from 'lucide-react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastProps {
  message: string
  type?: ToastType
  duration?: number
  onClose?: () => void
}

const toastIcons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const toastStyles = {
  success: 'toast-success',
  error: 'toast-error',
  info: 'toast-info',
  warning: 'toast-warning',
}

export function Toast({ message, type = 'info', duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(false)
  const Icon = toastIcons[type]

  // 進場動畫：mount 後下一幀才設 visible=true
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(() => onClose?.(), 300)
    }, duration)
    return () => clearTimeout(timer)
  }, [duration, onClose])

  return (
    <div
      className={`flex items-start gap-3 px-5 py-4 rounded-2xl border-2 shadow-2xl w-full
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-3 scale-95'}
        ${toastStyles[type]}`}
    >
      <Icon className="w-6 h-6 shrink-0 mt-0.5" />
      <p className="flex-1 text-sm font-bold leading-snug">{message}</p>
      <button
        onClick={() => { setVisible(false); setTimeout(() => onClose?.(), 300) }}
        className="shrink-0 hover:opacity-60 transition-opacity mt-0.5"
        aria-label="關閉"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

// ─── Global toast bus ──────────────────────────────────────────────────────────

let toastId = 0
const toastListeners: Array<(toast: ToastProps & { id: number }) => void> = []

export function showToast(message: string, type: ToastType = 'info', duration = 3000) {
  const id = toastId++
  toastListeners.forEach(listener => listener({ id, message, type, duration }))
}

export function useToast() {
  const [toasts, setToasts] = useState<Array<ToastProps & { id: number }>>([])

  useEffect(() => {
    const listener = (toast: ToastProps & { id: number }) => {
      setToasts(prev => [...prev, toast])
    }
    toastListeners.push(listener)
    return () => {
      const index = toastListeners.indexOf(listener)
      if (index > -1) toastListeners.splice(index, 1)
    }
  }, [])

  const removeToast = (id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  return { toasts, removeToast }
}

// ─── Container：固定在畫面頂部中央 ────────────────────────────────────────────

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 items-center w-full max-w-md px-4 pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className="w-full pointer-events-auto">
          <Toast
            message={toast.message}
            type={toast.type}
            duration={toast.duration}
            onClose={() => removeToast(toast.id)}
          />
        </div>
      ))}
    </div>
  )
}

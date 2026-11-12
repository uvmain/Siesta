export type ToastKind = 'success' | 'warning' | 'error' | 'info'

export interface Toast {
  id: string
  message: string
  kind: ToastKind
}

const toasts = ref<Toast[]>([])

export function useToasts() {
  function show(message: string, kind: ToastKind = 'info', duration = 5000): void {
    const id = crypto.randomUUID()
    toasts.value.push({ id, message, kind })
    window.setTimeout(dismiss, duration, id)
  }

  function dismiss(id: string): void {
    toasts.value = toasts.value.filter(toast => toast.id !== id)
  }

  return { toasts, show, dismiss }
}

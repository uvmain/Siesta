<script setup lang="ts">
import { useToasts } from '~/logic/toasts'

const { toasts, dismiss } = useToasts()

const colors = {
  success: 'border-success text-success',
  warning: 'border-warning text-warning',
  error: 'border-danger text-danger',
  info: 'border-info text-info',
}
</script>

<template>
  <div class="pointer-events-none fixed bottom-4 right-4 z-50 grid w-80 gap-2" aria-live="polite">
    <article v-for="toast in toasts" :key="toast.id" class="pointer-events-auto flex items-start justify-between gap-3 rounded-md border bg-panel p-3 shadow-lg" :class="colors[toast.kind]">
      <p class="m-0 text-sm text-primary">
        {{ toast.message }}
      </p>
      <UiIconButton label="Dismiss notification" @click="dismiss(toast.id)">
        ×
      </UiIconButton>
    </article>
  </div>
</template>

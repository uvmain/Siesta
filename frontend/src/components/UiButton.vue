<script setup lang="ts">
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

withDefaults(defineProps<{
  variant?: ButtonVariant
  loading?: boolean
  disabled?: boolean
}>(), {
  variant: 'primary',
  loading: false,
  disabled: false,
})
</script>

<template>
  <button
    class="focus-ring inline-flex items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-semibold transition-colors disabled:cursor-wait disabled:opacity-60"
    :class="{
      'border-accent bg-accent text-white hover:brightness-110': variant === 'primary',
      'border-border bg-elevated text-primary hover:bg-panel': variant === 'secondary',
      'border-danger bg-danger text-white hover:brightness-110': variant === 'danger',
      'border-transparent bg-transparent text-secondary hover:bg-elevated hover:text-primary': variant === 'ghost',
    }"
    :disabled="loading || disabled"
  >
    <span v-if="loading" class="size-3 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
    <slot />
  </button>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  label: string
  active?: boolean
  loading?: boolean
}>(), {
  active: false,
  loading: false,
})
</script>

<template>
  <button
    class="focus-ring inline-grid size-8 place-items-center rounded-md border border-transparent text-secondary transition-colors hover:bg-elevated hover:text-primary disabled:cursor-wait disabled:opacity-60"
    :class="{ 'bg-elevated text-primary': active }"
    :aria-label="label"
    :title="label"
    :disabled="loading || $attrs.disabled !== undefined"
  >
    <span v-if="loading" class="size-3 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />
    <slot v-else />
  </button>
</template>

<script setup lang="ts">
defineProps<{
  text: string
}>()
</script>

<template>
  <span class="group relative inline-flex">
    <slot />
    <span class="pointer-events-none absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-48 -translate-x-1/2 rounded bg-elevated px-2 py-1 text-xs text-primary opacity-0 shadow transition-opacity group-hover:opacity-100 group-focus-within:opacity-100" role="tooltip">{{ text }}</span>
  </span>
</template>

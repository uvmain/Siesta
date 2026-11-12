<script setup lang="ts">
defineProps<{
  open: boolean
  title: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="fixed inset-0 z-40 grid place-items-center bg-black/60 p-4" role="presentation" @click.self="emit('close')">
      <section class="w-full max-w-lg rounded-lg border border-border bg-panel p-5 text-primary shadow-xl" role="dialog" aria-modal="true" :aria-label="title" @keydown.esc="emit('close')">
        <header class="flex items-center justify-between gap-4">
          <h2 class="m-0 text-lg font-semibold">
            {{ title }}
          </h2>
          <UiIconButton label="Close dialog" @click="emit('close')">
            ×
          </UiIconButton>
        </header>
        <div class="mt-4">
          <slot />
        </div>
        <footer v-if="$slots.footer" class="mt-5 flex justify-end gap-2">
          <slot name="footer" />
        </footer>
      </section>
    </div>
  </Teleport>
</template>

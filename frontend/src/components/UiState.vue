<script setup lang="ts">
type StateKind = 'loading' | 'empty' | 'error'

withDefaults(defineProps<{
  kind: StateKind
  title: string
  message?: string
  actionLabel?: string
}>(), {
  message: '',
  actionLabel: '',
})

const emit = defineEmits<{
  action: []
}>()
</script>

<template>
  <section class="grid min-h-40 place-items-center rounded-md border border-dashed border-border bg-panel p-6 text-center">
    <div class="max-w-sm">
      <span v-if="kind === 'loading'" class="mx-auto block size-5 animate-spin rounded-full border-2 border-accent border-r-transparent" aria-label="Loading" />
      <p class="mb-1 mt-3 font-semibold text-primary">
        {{ title }}
      </p>
      <p v-if="message" class="m-0 text-sm text-secondary">
        {{ message }}
      </p>
      <UiButton v-if="actionLabel" class="mt-4" :variant="kind === 'error' ? 'danger' : 'secondary'" @click="emit('action')">
        {{ actionLabel }}
      </UiButton>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Tab {
  id: string
  label: string
  disabled?: boolean
  dirty?: boolean
}

defineProps<{
  modelValue: string
  tabs: Tab[]
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string]
}>()
</script>

<template>
  <div class="flex gap-1 border-b border-border" role="tablist">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      class="focus-ring inline-flex items-center gap-1 border-b-2 px-3 py-2 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      :class="modelValue === tab.id ? 'border-accent text-primary' : 'border-transparent text-secondary hover:text-primary'"
      :aria-selected="modelValue === tab.id"
      :disabled="tab.disabled"
      role="tab"
      @click="emit('update:modelValue', tab.id)"
    >
      {{ tab.label }}<span v-if="tab.dirty" class="size-1.5 rounded-full bg-warning" aria-label="Unsaved changes" />
    </button>
  </div>
</template>

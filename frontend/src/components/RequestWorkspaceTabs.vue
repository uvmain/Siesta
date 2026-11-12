<script setup lang="ts">
import type { RequestTab } from '~/logic/workspace-state'

defineProps<{
  modelValue: string
  tabs: RequestTab[]
}>()

const emit = defineEmits<{
  'update:modelValue': [id: string]
  'close': [id: string]
  'new': []
}>()

function methodClass(method: string): string {
  const methods: Record<string, string> = {
    GET: 'text-method-get',
    POST: 'text-method-post',
    PUT: 'text-method-put',
    PATCH: 'text-method-patch',
    DELETE: 'text-method-delete',
    HEAD: 'text-method-head',
    OPTIONS: 'text-method-options',
  }
  return methods[method] ?? 'text-secondary'
}
</script>

<template>
  <div class="flex items-center overflow-x-auto border-b border-border bg-sidebar" role="tablist">
    <div
      v-for="tab in tabs"
      :key="tab.id"
      class="flex shrink-0 items-center border-r border-border"
      :class="modelValue === tab.id ? 'bg-panel text-primary' : 'text-secondary hover:bg-elevated hover:text-primary'"
    >
      <button
        class="focus-ring flex min-w-0 items-center gap-2 px-3 py-2 text-left text-sm"
        :aria-selected="modelValue === tab.id"
        role="tab"
        @click="emit('update:modelValue', tab.id)"
      >
        <span class="font-code text-xs font-bold" :class="methodClass(tab.method)">{{ tab.method }}</span>
        <span class="max-w-40 truncate">{{ tab.title }}</span>
        <span v-if="tab.dirty" class="size-1.5 rounded-full bg-warning" aria-label="Unsaved changes" />
      </button>
      <UiIconButton :label="`Close ${tab.title}`" class="mr-1" @click="emit('close', tab.id)">
        ×
      </UiIconButton>
    </div>
    <UiIconButton label="New request tab" class="mx-1 shrink-0" @click="emit('new')">
      +
    </UiIconButton>
  </div>
</template>

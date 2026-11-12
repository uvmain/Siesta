<script setup lang="ts">
interface MenuItem {
  id: string
  label: string
  disabled?: boolean
  danger?: boolean
}

defineProps<{
  label: string
  items: MenuItem[]
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const menu = ref<HTMLDetailsElement>()

function select(id: string): void {
  emit('select', id)
  if (menu.value) {
    menu.value.open = false
  }
}
</script>

<template>
  <details ref="menu" class="relative">
    <summary class="focus-ring cursor-pointer list-none rounded-md border border-border bg-elevated px-3 py-2 text-sm font-semibold text-primary [&::-webkit-details-marker]:hidden">
      <slot name="trigger">
        {{ label }}
      </slot>
    </summary>
    <div class="absolute right-0 z-20 mt-1 min-w-40 rounded-md border border-border bg-panel p-1 shadow-lg">
      <button
        v-for="item in items"
        :key="item.id"
        class="focus-ring block w-full rounded px-2 py-1.5 text-left text-sm text-primary hover:bg-elevated disabled:cursor-not-allowed disabled:opacity-50"
        :class="{ 'text-danger': item.danger }"
        :disabled="item.disabled"
        type="button"
        @click="select(item.id)"
      >
        {{ item.label }}
      </button>
    </div>
  </details>
</template>

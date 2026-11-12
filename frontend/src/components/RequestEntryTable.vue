<script setup lang="ts">
import type { RequestEntry } from '~/types/workspace'
import { newRequestEntry } from '~/logic/request-entries'

const props = defineProps<{
  modelValue: RequestEntry[]
  kind: 'parameter' | 'header'
}>()

const emit = defineEmits<{
  'update:modelValue': [entries: RequestEntry[]]
}>()

const commonHeaders = [
  'Accept',
  'Accept-Language',
  'Authorization',
  'Cache-Control',
  'Content-Type',
  'If-Match',
  'If-None-Match',
  'User-Agent',
  'X-API-Key',
  'X-Request-ID',
]

function update(index: number, changes: Partial<RequestEntry>): void {
  emit('update:modelValue', props.modelValue.map((entry, i) => i === index ? { ...entry, ...changes } : entry))
}

function remove(index: number): void {
  emit('update:modelValue', props.modelValue.filter((_, i) => i !== index))
}
</script>

<template>
  <div class="grid gap-3">
    <div class="overflow-x-auto">
      <table class="w-full min-w-[36rem] border-collapse text-left text-sm">
        <thead class="text-secondary">
          <tr>
            <th class="w-10 p-2">
              On
            </th>
            <th class="p-2">
              Key
            </th>
            <th class="p-2">
              Value
            </th>
            <th class="p-2">
              Description
            </th>
            <th class="w-10 p-2">
              <span class="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(entry, index) in modelValue" :key="index" class="border-t border-border">
            <td class="p-2">
              <input :checked="entry.enabled" type="checkbox" :aria-label="`Enable ${kind} ${index + 1}`" @change="update(index, { enabled: ($event.target as HTMLInputElement).checked })">
            </td>
            <td class="p-1">
              <input :value="entry.key" class="ui-control box-border w-full font-code" :aria-label="`${kind} name ${index + 1}`" :list="kind === 'header' ? 'request-header-suggestions' : undefined" placeholder="Key" @input="update(index, { key: ($event.target as HTMLInputElement).value })">
            </td>
            <td class="p-1">
              <input :value="entry.value" class="ui-control box-border w-full font-code" :aria-label="`${kind} value ${index + 1}`" placeholder="Value" @input="update(index, { value: ($event.target as HTMLInputElement).value, hasEquals: true })">
            </td>
            <td class="p-1">
              <input :value="entry.description" class="ui-control box-border w-full" :aria-label="`${kind} description ${index + 1}`" placeholder="Description" @input="update(index, { description: ($event.target as HTMLInputElement).value })">
            </td>
            <td class="p-1">
              <UiIconButton :label="`Remove ${kind} ${index + 1}`" type="button" @click="remove(index)">
                ×
              </UiIconButton>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <datalist v-if="kind === 'header'" id="request-header-suggestions">
      <option v-for="header in commonHeaders" :key="header" :value="header" />
    </datalist>
    <button class="focus-ring w-fit rounded-md border border-border bg-elevated px-3 py-2 text-sm font-semibold" type="button" @click="emit('update:modelValue', [...modelValue, newRequestEntry()])">
      Add {{ kind }}
    </button>
  </div>
</template>

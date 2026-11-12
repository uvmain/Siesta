<script setup lang="ts">
interface RequestResult {
  status: number
  statusText: string
  headers: Record<string, string>
  truncated: boolean
}

defineProps<{
  result: RequestResult
  body: string
  search: string
}>()

const emit = defineEmits<{
  'update:search': [search: string]
}>()

function updateSearch(event: Event): void {
  emit('update:search', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <section class="rounded-xl border border-slate-300 bg-white p-6 shadow-[0_8px_30px_rgb(15_23_42_/_8%)]">
    <div class="flex items-center justify-between gap-4">
      <h2 class="mt-0">
        Response
      </h2>
      <strong :class="result.status >= 400 ? 'text-red-700' : ''">{{ result.status }} {{ result.statusText }}</strong>
    </div>
    <p v-if="result.truncated" class="mt-0 text-slate-500">
      The response body was limited to 1 MB.
    </p>
    <h3 class="mt-0">
      Headers
    </h3>
    <pre class="m-0 mb-5 mt-2 overflow-auto rounded-md bg-slate-900 p-4 whitespace-pre-wrap break-words text-slate-200">{{ JSON.stringify(result.headers, null, 2) }}</pre>
    <h3 class="mt-0">
      Body
    </h3>
    <label class="mt-4 grid gap-2 font-semibold text-slate-700">
      Search response
      <input :value="search" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" placeholder="Filter response lines" @input="updateSearch">
    </label>
    <pre class="m-0 mb-5 mt-2 overflow-auto rounded-md bg-slate-900 p-4 whitespace-pre-wrap break-words text-slate-200">{{ body }}</pre>
  </section>
</template>

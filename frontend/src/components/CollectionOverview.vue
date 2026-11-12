<script setup lang="ts">
import type { RequestAuth } from '~/logic/api'
import type { CollectionContents, CollectionOverview } from '~/types/workspace'

interface VariableEntry {
  key: string
  value: string
}

const props = defineProps<{
  collectionId?: number
  collectionName?: string
  contents: CollectionContents
}>()

const emit = defineEmits<{
  save: [overview: CollectionOverview]
}>()

const activeTab = ref('overview')
const description = ref('')
const variables = ref<VariableEntry[]>([])
const auth = ref<RequestAuth>({ type: 'none' })
const preRequest = ref('')
const tests = ref('')
const error = ref('')

const tabs = [
  { id: 'overview', label: 'Overview' },
  { id: 'variables', label: 'Variables' },
  { id: 'auth', label: 'Authentication' },
  { id: 'scripts', label: 'Scripts' },
]

function resetForm(): void {
  description.value = props.contents.description
  variables.value = Object.entries(props.contents.variables).map(([key, value]) => ({ key, value }))
  auth.value = { ...props.contents.auth }
  preRequest.value = props.contents.scripts.preRequest
  tests.value = props.contents.scripts.tests
  error.value = ''
}

function addVariable(): void {
  variables.value.push({ key: '', value: '' })
}

function removeVariable(index: number): void {
  variables.value.splice(index, 1)
}

function save(): void {
  const entries = variables.value.filter(entry => entry.key.trim())
  const keys = new Set<string>()
  if (entries.some(entry => keys.has(entry.key.trim()) || !keys.add(entry.key.trim()))) {
    error.value = 'Variable names must be unique.'
    activeTab.value = 'variables'
    return
  }
  if (auth.value.type === 'bearer' && !auth.value.token?.trim()) {
    error.value = 'Enter a bearer token.'
    activeTab.value = 'auth'
    return
  }
  if (auth.value.type === 'basic' && (!auth.value.username?.trim() || !auth.value.password)) {
    error.value = 'Enter a username and password.'
    activeTab.value = 'auth'
    return
  }
  if (auth.value.type === 'api-key' && (!auth.value.key?.trim() || !auth.value.value)) {
    error.value = 'Enter an API key name and value.'
    activeTab.value = 'auth'
    return
  }
  if (auth.value.type === 'oauth2' && (!auth.value.tokenUrl?.trim() || !auth.value.clientId?.trim() || !auth.value.clientSecret)) {
    error.value = 'Enter the token URL, client ID and client secret.'
    activeTab.value = 'auth'
    return
  }
  error.value = ''
  emit('save', {
    description: description.value.trim(),
    variables: Object.fromEntries(entries.map(entry => [entry.key.trim(), entry.value])),
    auth: { ...auth.value },
    scripts: { preRequest: preRequest.value, tests: tests.value },
  })
}

watch(() => [props.collectionId, props.contents] as const, resetForm, { immediate: true })
</script>

<template>
  <section class="rounded-lg border border-border bg-panel">
    <header class="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <p class="m-0 text-xs font-bold uppercase tracking-wider text-secondary">
          Collection overview
        </p>
        <h2 class="m-0 mt-1 text-lg">
          {{ collectionName ?? 'Select a collection' }}
        </h2>
      </div>
      <UiButton :disabled="!collectionId" @click="save">
        Save collection
      </UiButton>
    </header>
    <div v-if="collectionId" class="p-5">
      <UiTabs v-model="activeTab" :tabs="tabs" />
      <div v-if="activeTab === 'overview'" class="mt-4 grid gap-2">
        <label class="grid gap-2 text-sm font-semibold">
          Description
          <textarea v-model="description" class="ui-control min-h-28 resize-y font-ui" placeholder="Describe this API collection and its intended use." />
        </label>
      </div>
      <div v-else-if="activeTab === 'variables'" class="mt-4 grid gap-3">
        <p class="m-0 text-sm text-secondary">
          Environment variables override these collection defaults.
        </p>
        <div v-for="(entry, index) in variables" :key="index" class="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
          <input v-model="entry.key" class="ui-control min-w-0" aria-label="Collection variable name" placeholder="API_URL">
          <input v-model="entry.value" class="ui-control min-w-0 font-code" aria-label="Collection variable value" placeholder="https://api.example.com">
          <UiIconButton label="Remove variable" @click="removeVariable(index)">
            ×
          </UiIconButton>
        </div>
        <UiButton class="w-fit" variant="secondary" @click="addVariable">
          Add variable
        </UiButton>
      </div>
      <div v-else-if="activeTab === 'auth'" class="mt-4 grid gap-4">
        <p class="m-0 text-sm text-secondary">
          This authentication is used when a request has no request-specific authentication.
        </p>
        <AuthFields v-model="auth" />
      </div>
      <div v-else class="mt-4 grid gap-4">
        <label class="grid gap-2 text-sm font-semibold">
          Pre-request script
          <textarea v-model="preRequest" class="ui-control min-h-40 resize-y font-code text-xs" spellcheck="false" placeholder="// Script saved with this collection" />
        </label>
        <label class="grid gap-2 text-sm font-semibold">
          Test script
          <textarea v-model="tests" class="ui-control min-h-40 resize-y font-code text-xs" spellcheck="false" placeholder="// Tests saved with this collection" />
        </label>
        <p class="m-0 text-sm text-secondary">
          Scripts are saved now and will run when collection scripting is added.
        </p>
      </div>
      <p v-if="error" class="mb-0 text-sm text-danger">
        {{ error }}
      </p>
    </div>
    <p v-else class="m-0 p-5 text-sm text-secondary">
      Choose a collection from the sidebar to edit its overview.
    </p>
  </section>
</template>

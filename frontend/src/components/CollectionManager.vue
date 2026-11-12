<script setup lang="ts">
interface Collection {
  id: number
  name: string
}

interface StoredFolder {
  id: string
  name: string
}

interface StoredRequest {
  id: string
  name: string
  method: string
  url: string
  headers: Record<string, string>
  body: string
  folderId?: string
}

interface CollectionContents {
  executionMode: 'browser' | 'backend'
  folders: StoredFolder[]
  requests: StoredRequest[]
}

interface RequestHistory {
  id: number
  method: string
  url: string
  status: number
}

defineProps<{
  collections: Collection[]
  selectedCollectionId?: number
  selectedCollection?: Collection
  selectedContents: CollectionContents
  newCollectionName: string
  newFolderName: string
  history: RequestHistory[]
  collectionError: string
  importing: boolean
}>()

const emit = defineEmits<{
  'update:selectedCollectionId': [id: number]
  'update:newCollectionName': [name: string]
  'update:newFolderName': [name: string]
  'createCollection': []
  'importCollection': [event: Event]
  'exportCollection': []
  'downloadBackup': []
  'restoreBackup': [event: Event]
  'toggleExecutionMode': []
  'createFolder': []
  'openRequest': [request: StoredRequest]
  'openHistory': [entry: RequestHistory]
}>()

const importFile = ref<HTMLInputElement>()
const backupFile = ref<HTMLInputElement>()

function updateCollectionName(event: Event): void {
  emit('update:newCollectionName', (event.target as HTMLInputElement).value)
}

function updateFolderName(event: Event): void {
  emit('update:newFolderName', (event.target as HTMLInputElement).value)
}

function updateSelectedCollection(event: Event): void {
  emit('update:selectedCollectionId', Number((event.target as HTMLSelectElement).value))
}

function importCollection(event: Event): void {
  emit('importCollection', event)
  ;(event.target as HTMLInputElement).value = ''
}

function restoreBackup(event: Event): void {
  emit('restoreBackup', event)
  ;(event.target as HTMLInputElement).value = ''
}
</script>

<template>
  <section class="rounded-xl border border-slate-300 bg-white p-6 shadow-[0_8px_30px_rgb(15_23_42_/_8%)]">
    <div class="grid gap-4 sm:flex sm:items-center sm:justify-between">
      <div>
        <h2 class="mt-0">Collections</h2>
        <p class="mt-0 text-slate-500">Browser mode is subject to CORS; backend mode sends requests from this container.</p>
      </div>
      <div class="flex flex-wrap justify-end gap-2">
        <input ref="importFile" class="absolute h-px w-px overflow-hidden whitespace-nowrap [clip:rect(0_0_0_0)]" type="file" accept=".json,.bru,application/json" @change="importCollection">
        <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700 disabled:cursor-wait disabled:opacity-70" type="button" :disabled="importing" @click="importFile?.click()">{{ importing ? 'Importing...' : 'Import Postman / Bruno' }}</button>
        <button v-if="selectedCollection" class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="button" @click="emit('exportCollection')">Export Postman</button>
        <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="button" @click="emit('downloadBackup')">Backup all</button>
        <input ref="backupFile" class="absolute h-px w-px overflow-hidden whitespace-nowrap [clip:rect(0_0_0_0)]" type="file" accept=".json,application/json" @change="restoreBackup">
        <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="button" @click="backupFile?.click()">Restore backup</button>
      </div>
    </div>
    <form class="flex items-end gap-2" @submit.prevent="emit('createCollection')">
      <label class="mt-4 grid flex-1 gap-2 font-semibold text-slate-700">
        New collection name
        <input :value="newCollectionName" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" placeholder="Collection name" required @input="updateCollectionName">
      </label>
      <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="submit">New collection</button>
    </form>
    <div class="mt-4 grid gap-4 sm:grid-cols-[minmax(12rem,1fr)_2fr]">
      <select :value="selectedCollectionId" class="rounded-md border border-slate-300 px-3 py-2.5 font-inherit" size="5" aria-label="Collections" @change="updateSelectedCollection">
        <option v-for="collection in collections" :key="collection.id" :value="collection.id">{{ collection.name }}</option>
      </select>
      <div v-if="selectedCollection">
        <button class="cursor-pointer rounded-md border border-teal-700 bg-teal-700 px-3 py-2.5 font-bold text-white" type="button" @click="emit('toggleExecutionMode')">
          Execution: {{ selectedContents.executionMode === 'browser' ? 'Browser client' : 'Hono backend' }}
        </button>
        <div class="mt-4 flex gap-2">
          <input :value="newFolderName" class="box-border w-full max-w-52 rounded-md border border-slate-300 px-3 py-2.5 font-inherit" aria-label="New folder name" placeholder="Folder name" @input="updateFolderName" @keyup.enter="emit('createFolder')">
          <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="button" @click="emit('createFolder')">Add folder</button>
        </div>
        <ul v-if="selectedContents.requests.length" class="m-0 mt-4 grid list-none gap-1 p-0">
          <li v-for="request in selectedContents.requests" :key="request.id">
            <button class="w-full cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 text-left text-slate-700" type="button" @click="emit('openRequest', request)">{{ selectedContents.folders.find(folder => folder.id === request.folderId)?.name ? `${selectedContents.folders.find(folder => folder.id === request.folderId)?.name} / ` : '' }}{{ request.name }}</button>
          </li>
        </ul>
        <p v-else class="mt-0 text-slate-500">Save requests here to reuse them.</p>
        <div v-if="history.length" class="mt-4 grid gap-1">
          <h3 class="mb-0 mt-0">Recent history</h3>
          <button v-for="entry in history.slice(0, 5)" :key="entry.id" class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 text-left text-slate-700" type="button" @click="emit('openHistory', entry)">
            {{ entry.status }} {{ entry.method }} {{ entry.url }}
          </button>
        </div>
      </div>
    </div>
    <p v-if="collectionError" class="mt-0 text-red-700">{{ collectionError }}</p>
  </section>
</template>

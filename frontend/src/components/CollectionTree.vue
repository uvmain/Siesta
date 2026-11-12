<script setup lang="ts">
import type { CollectionContents, StoredFolder, StoredRequest } from '~/types/workspace'

interface Collection {
  id: number
  name: string
}

interface TreeRow {
  id: string
  kind: 'folder' | 'request'
  depth: number
  title: string
  description?: string
  method?: string
  folder?: StoredFolder
  request?: StoredRequest
}

interface DragSource {
  kind: 'folder' | 'request'
  id: string
}

const props = defineProps<{
  collections: Collection[]
  selectedCollectionId?: number
  selectedContents: CollectionContents
  importing: boolean
}>()

const emit = defineEmits<{
  selectCollection: [id: number]
  createCollection: [name: string]
  createFolder: [payload: { name: string, parentId?: string }]
  deleteFolder: [id: string]
  moveFolder: [payload: { id: string, parentId?: string }]
  moveRequest: [payload: { id: string, folderId?: string }]
  openRequest: [request: StoredRequest]
  duplicateRequest: [request: StoredRequest]
  importCollection: [event: Event]
  exportCollection: []
  downloadBackup: []
  restoreBackup: [event: Event]
  toggleExecutionMode: []
}>()

const newCollectionName = ref('')
const folderName = ref('')
const parentFolderId = ref<string | undefined>()
const expandedFolders = ref(new Set<string>())
const dragged = ref<DragSource>()
const importFile = ref<HTMLInputElement>()
const backupFile = ref<HTMLInputElement>()

const rows = computed<TreeRow[]>(() => {
  const result: TreeRow[] = []
  const addChildren = (parentId: string | undefined, depth: number): void => {
    const folders = props.selectedContents.folders
      .filter(folder => folder.parentId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const folder of folders) {
      result.push({ id: folder.id, kind: 'folder', depth, title: folder.name, folder })
      if (expandedFolders.value.has(folder.id)) {
        addChildren(folder.id, depth + 1)
      }
    }
    const requests = props.selectedContents.requests
      .filter(request => request.folderId === parentId)
      .sort((a, b) => a.name.localeCompare(b.name))
    for (const request of requests) {
      result.push({
        id: request.id,
        kind: 'request',
        depth,
        title: request.name,
        description: request.description || request.url,
        method: request.method,
        request,
      })
    }
  }
  addChildren(undefined, 0)
  return result
})

function toggleFolder(id: string): void {
  const next = new Set(expandedFolders.value)
  next.has(id) ? next.delete(id) : next.add(id)
  expandedFolders.value = next
}

function createCollection(): void {
  const name = newCollectionName.value.trim()
  if (!name) {
    return
  }
  emit('createCollection', name)
  newCollectionName.value = ''
}

function createFolder(): void {
  const name = folderName.value.trim()
  if (!name) {
    return
  }
  emit('createFolder', { name, parentId: parentFolderId.value })
  if (parentFolderId.value) {
    const next = new Set(expandedFolders.value)
    next.add(parentFolderId.value)
    expandedFolders.value = next
  }
  folderName.value = ''
}

function startDrag(event: DragEvent, source: DragSource): void {
  dragged.value = source
  event.dataTransfer?.setData('text/plain', `${source.kind}:${source.id}`)
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
  }
}

function isFolderDescendant(folderId: string, ancestorId: string): boolean {
  let current = props.selectedContents.folders.find(folder => folder.id === folderId)
  while (current?.parentId) {
    if (current.parentId === ancestorId) {
      return true
    }
    current = props.selectedContents.folders.find(folder => folder.id === current?.parentId)
  }
  return false
}

function dropOn(parentId?: string): void {
  const source = dragged.value
  dragged.value = undefined
  if (!source) {
    return
  }
  if (source.kind === 'folder') {
    if (source.id === parentId || (parentId && isFolderDescendant(parentId, source.id))) {
      return
    }
    emit('moveFolder', { id: source.id, parentId })
    return
  }
  emit('moveRequest', { id: source.id, folderId: parentId })
}

function methodClass(method: string | undefined): string {
  const methods: Record<string, string> = {
    GET: 'text-method-get',
    POST: 'text-method-post',
    PUT: 'text-method-put',
    PATCH: 'text-method-patch',
    DELETE: 'text-method-delete',
    HEAD: 'text-method-head',
    OPTIONS: 'text-method-options',
  }
  return methods[method ?? ''] ?? 'text-secondary'
}

function importCollection(event: Event): void {
  emit('importCollection', event)
  ;(event.target as HTMLInputElement).value = ''
}

function restoreBackup(event: Event): void {
  emit('restoreBackup', event)
  ;(event.target as HTMLInputElement).value = ''
}

watch(() => props.selectedCollectionId, () => {
  expandedFolders.value = new Set(props.selectedContents.folders.map(folder => folder.id))
}, { immediate: true })
</script>

<template>
  <section class="grid gap-3" aria-label="Collections">
    <div class="flex items-center justify-between gap-2">
      <h2 class="m-0 text-xs font-bold uppercase tracking-wider text-secondary">
        Collections
      </h2>
      <UiMenu
        label="Collection actions" :items="[
          { id: 'import', label: importing ? 'Importing...' : 'Import Postman / Bruno', disabled: importing },
          { id: 'backup', label: 'Download backup' },
          { id: 'restore', label: 'Restore backup' },
        ]" @select="$event === 'import' ? importFile?.click() : $event === 'backup' ? emit('downloadBackup') : backupFile?.click()"
      >
        <template #trigger>
          <span aria-hidden="true">•••</span>
        </template>
      </UiMenu>
      <input ref="importFile" class="sr-only" type="file" accept=".json,.bru,application/json" @change="importCollection">
      <input ref="backupFile" class="sr-only" type="file" accept=".json,application/json" @change="restoreBackup">
    </div>

    <form class="flex gap-1" @submit.prevent="createCollection">
      <input v-model="newCollectionName" class="ui-control min-w-0 flex-1" placeholder="New collection" aria-label="New collection name">
      <UiIconButton label="Create collection" type="submit">
        <span aria-hidden="true">+</span>
      </UiIconButton>
    </form>

    <div class="grid gap-1">
      <div
        v-for="collection in collections"
        :key="collection.id"
        class="rounded-md"
        :class="{ 'bg-elevated': collection.id === selectedCollectionId }"
        @dragover.prevent
        @drop.prevent="collection.id === selectedCollectionId && dropOn()"
      >
        <div class="group flex items-center gap-1">
          <button class="focus-ring min-w-0 flex-1 truncate rounded-md px-2 py-1.5 text-left text-sm font-semibold text-primary hover:bg-elevated" type="button" @click="emit('selectCollection', collection.id)">
            <span class="mr-2 text-secondary" aria-hidden="true">▦</span>{{ collection.name }}
          </button>
          <UiMenu
            v-if="collection.id === selectedCollectionId"
            label="Collection actions"
            :items="[
              { id: 'folder', label: 'New folder' },
              { id: 'mode', label: 'Toggle execution mode' },
              { id: 'export', label: 'Export Postman' },
            ]"
            @select="$event === 'folder' ? parentFolderId = undefined : $event === 'mode' ? emit('toggleExecutionMode') : emit('exportCollection')"
          >
            <template #trigger>
              <span aria-hidden="true">•••</span>
            </template>
          </UiMenu>
        </div>

        <div v-if="collection.id === selectedCollectionId" class="grid gap-1 pb-1">
          <form v-if="parentFolderId !== undefined" class="flex gap-1 px-2" @submit.prevent="createFolder">
            <input v-model="folderName" class="ui-control min-w-0 flex-1 px-2 py-1.5" :placeholder="`New folder in ${selectedContents.folders.find(folder => folder.id === parentFolderId)?.name ?? 'collection'}`" aria-label="New folder name">
            <UiIconButton label="Create folder" type="submit">
              <span aria-hidden="true">+</span>
            </UiIconButton>
            <UiIconButton label="Cancel folder creation" type="button" @click="parentFolderId = undefined">
              <span aria-hidden="true">×</span>
            </UiIconButton>
          </form>
          <form v-else class="flex gap-1 px-2" @submit.prevent="createFolder">
            <input v-model="folderName" class="ui-control min-w-0 flex-1 px-2 py-1.5" placeholder="New root folder" aria-label="New root folder name">
            <UiIconButton label="Create folder" type="submit">
              <span aria-hidden="true">+</span>
            </UiIconButton>
          </form>

          <div
            v-for="row in rows"
            :key="`${row.kind}-${row.id}`"
            class="group flex min-w-0 items-center gap-1 rounded-md hover:bg-elevated"
            :class="{ 'opacity-60': dragged?.id === row.id }"
            :style="{ paddingLeft: `${8 + row.depth * 16}px` }"
            draggable="true"
            @dragstart="startDrag($event, { kind: row.kind, id: row.id })"
            @dragend="dragged = undefined"
            @dragover.prevent="row.kind === 'folder'"
            @drop.prevent="row.kind === 'folder' && dropOn(row.id)"
          >
            <template v-if="row.kind === 'folder' && row.folder">
              <button class="focus-ring grid size-6 shrink-0 place-items-center rounded text-secondary hover:text-primary" :aria-label="`${expandedFolders.has(row.id) ? 'Collapse' : 'Expand'} ${row.title}`" type="button" @click="toggleFolder(row.id)">
                <span aria-hidden="true">{{ expandedFolders.has(row.id) ? '⌄' : '›' }}</span>
              </button>
              <button class="focus-ring min-w-0 flex-1 truncate rounded py-1.5 text-left text-sm text-primary" type="button" @click="toggleFolder(row.id)">
                <span class="mr-2 text-secondary" aria-hidden="true">□</span>{{ row.title }}
              </button>
              <UiMenu label="Folder actions" :items="[{ id: 'child', label: 'New nested folder' }, { id: 'delete', label: 'Delete folder', danger: true }]" @select="$event === 'child' ? parentFolderId = row.id : emit('deleteFolder', row.id)">
                <template #trigger>
                  <span aria-hidden="true">•••</span>
                </template>
              </UiMenu>
            </template>
            <template v-else-if="row.request">
              <span class="w-6 shrink-0" />
              <button class="focus-ring min-w-0 flex-1 rounded py-1.5 text-left" type="button" @click="emit('openRequest', row.request)">
                <span class="block truncate text-xs font-bold" :class="methodClass(row.method)">{{ row.method }}</span>
                <span class="block truncate text-sm text-primary">{{ row.title }}</span>
                <span class="block truncate text-xs text-secondary">{{ row.description }}</span>
              </button>
              <UiMenu label="Request actions" :items="[{ id: 'duplicate', label: 'Duplicate request' }]" @select="emit('duplicateRequest', row.request)">
                <template #trigger>
                  <span aria-hidden="true">•••</span>
                </template>
              </UiMenu>
            </template>
          </div>
          <p v-if="!rows.length" class="m-0 px-2 py-3 text-xs text-secondary">
            Create a folder or save a request to begin.
          </p>
        </div>
      </div>
    </div>
  </section>
</template>

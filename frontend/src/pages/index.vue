<script setup lang="ts">
import type { Collection, Environment, FormField, RequestAuth, RequestHistory, RequestResult } from '~/logic/api'
import type { AuthType, BodyMode, CollectionContents, EnvironmentEntry, StoredFolder, StoredRequest } from '~/types/workspace'
import { api } from '~/logic/api'
import { useWorkspaceState } from '~/logic/workspace-state'

const router = useRouter()
const { preferences, session, updatePreferences, saveDraft } = useWorkspaceState()
const environments = ref<Environment[]>([])
const editingEnvironmentId = ref<number | undefined>()
const environmentName = ref('')
const environmentEntries = ref<EnvironmentEntry[]>([])
const environmentError = ref('')
const collections = ref<Collection[]>([])
const environmentId = ref<number | undefined>(preferences.value.activeEnvironmentId)
const selectedCollectionId = ref<number | undefined>(preferences.value.selectedCollectionId)
const selectedFolderId = ref<string | undefined>()
const activeDraft = session.value.drafts[session.value.activeRequestTabId] ?? {
  method: 'GET',
  url: 'https://httpbin.org/get',
  headers: '{\n  "Accept": "application/json"\n}',
  body: '',
  bodyMode: 'raw' as BodyMode,
  formFields: [{ key: '', value: '' }],
}
const method = ref(activeDraft.method)
const url = ref(activeDraft.url)
const headers = ref(activeDraft.headers)
const body = ref(activeDraft.body)
const bodyMode = ref<BodyMode>(activeDraft.bodyMode)
const formFields = ref<FormField[]>(activeDraft.formFields)
const fileFieldName = ref('file')
const attachedFiles = ref<File[]>([])
const authType = ref<AuthType>('none')
const bearerToken = ref('')
const authUsername = ref('')
const authPassword = ref('')
const sending = ref(false)
const requestError = ref('')
const result = ref<RequestResult>()
const collectionError = ref('')
const importing = ref(false)
const history = ref<RequestHistory[]>([])
const responseSearch = ref('')

async function loadEnvironments(): Promise<void> {
  environments.value = await api.listEnvironments()
}

function openEnvironment(environment?: Environment): void {
  environmentError.value = ''
  editingEnvironmentId.value = environment?.id
  environmentName.value = environment?.name ?? ''
  try {
    const values: unknown = environment ? JSON.parse(environment.values) : {}
    const secretKeys: unknown = environment ? JSON.parse(environment.secretKeys) : []
    const secrets = Array.isArray(secretKeys) ? new Set(secretKeys.filter(key => typeof key === 'string')) : new Set<string>()
    environmentEntries.value = values && typeof values === 'object' && !Array.isArray(values)
      ? Object.entries(values).flatMap(([key, value]) => typeof value === 'string' ? [{ key, value, secret: secrets.has(key) }] : [])
      : []
  }
  catch {
    environmentEntries.value = []
  }
  if (!environmentEntries.value.length) {
    environmentEntries.value = [{ key: '', value: '', secret: false }]
  }
}

function addEnvironmentEntry(): void {
  environmentEntries.value.push({ key: '', value: '', secret: false })
}

async function saveEnvironment(): Promise<void> {
  const entries = environmentEntries.value.filter(entry => entry.key.trim())
  const keys = new Set<string>()
  if (!environmentName.value.trim() || entries.some(entry => keys.has(entry.key.trim()) || !keys.add(entry.key.trim()))) {
    environmentError.value = 'Enter a name and unique variable names.'
    return
  }
  const values = Object.fromEntries(entries.map(entry => [entry.key.trim(), entry.value]))
  const secretKeys = entries.filter(entry => entry.secret).map(entry => entry.key.trim())
  let environment: Environment
  try {
    environment = editingEnvironmentId.value
      ? await api.updateEnvironment(editingEnvironmentId.value, environmentName.value.trim(), values, secretKeys)
      : await api.createEnvironment(environmentName.value.trim(), values, secretKeys)
  }
  catch (error) {
    environmentError.value = error instanceof Error ? error.message : 'Unable to save environment'
    return
  }
  environments.value = [...environments.value.filter(item => item.id !== environment.id), environment].sort((a, b) => a.name.localeCompare(b.name))
  environmentId.value = environment.id
  openEnvironment(environment)
}

async function loadCollections(): Promise<void> {
  collections.value = await api.listCollections()
}

function defaultContents(): CollectionContents {
  return { executionMode: 'backend', requests: [], folders: [], variables: {} }
}

function collectionContents(collection: Collection): CollectionContents {
  try {
    const contents = JSON.parse(collection.contents) as Partial<CollectionContents>
    return {
      executionMode: contents.executionMode === 'backend' ? 'backend' : 'browser',
      requests: Array.isArray(contents.requests) ? contents.requests : [],
      folders: Array.isArray(contents.folders) ? contents.folders : [],
      variables: contents.variables && typeof contents.variables === 'object' && !Array.isArray(contents.variables) && Object.values(contents.variables).every(value => typeof value === 'string')
        ? contents.variables as Record<string, string>
        : {},
    }
  }
  catch {
    return defaultContents()
  }
}

const selectedCollection = computed(() => collections.value.find(collection => collection.id === selectedCollectionId.value))
const selectedContents = computed(() => selectedCollection.value ? collectionContents(selectedCollection.value) : defaultContents())

function withFolderParent(folder: StoredFolder, parentId?: string): StoredFolder {
  const { parentId: _, ...withoutParent } = folder
  return parentId ? { ...withoutParent, parentId } : withoutParent
}

function withRequestFolder(request: StoredRequest, folderId?: string): StoredRequest {
  const { folderId: _, ...withoutFolder } = request
  return folderId ? { ...withoutFolder, folderId } : withoutFolder
}

function resolveBrowserVariables(value: string): string {
  const variables: Record<string, string> = { ...selectedContents.value.variables }
  const environment = environments.value.find(item => item.id === environmentId.value)
  if (environment) {
    try {
      const environmentVariables: unknown = JSON.parse(environment.values)
      if (environmentVariables && typeof environmentVariables === 'object' && !Array.isArray(environmentVariables)) {
        Object.assign(variables, environmentVariables)
      }
    }
    catch {
      // Environment records are validated by the API before they are stored.
    }
  }
  return value.replace(/\{\{([a-z_]\w*)\}\}/gi, (_, key: string) => variables[key] ?? '')
}

function currentAuth(): RequestAuth {
  if (authType.value === 'bearer') {
    return { type: 'bearer', token: bearerToken.value }
  }
  if (authType.value === 'basic') {
    return { type: 'basic', username: authUsername.value, password: authPassword.value }
  }
  return { type: 'none' }
}

function browserAuthorization(auth: RequestAuth): string | undefined {
  if (auth.type === 'bearer') {
    return auth.token ? `Bearer ${resolveBrowserVariables(auth.token)}` : undefined
  }
  if (auth.type === 'basic' && auth.username !== undefined && auth.password !== undefined) {
    return `Basic ${btoa(`${resolveBrowserVariables(auth.username)}:${resolveBrowserVariables(auth.password)}`)}`
  }
  return undefined
}

function makeBrowserFormData(): FormData {
  const formData = new FormData()
  for (const field of formFields.value.filter(field => field.key)) {
    formData.append(resolveBrowserVariables(field.key), resolveBrowserVariables(field.value))
  }
  for (const file of attachedFiles.value) {
    formData.append(resolveBrowserVariables(fileFieldName.value || 'file'), file, file.name)
  }
  return formData
}

function addFormField(): void {
  formFields.value.push({ key: '', value: '' })
}

function setAttachedFiles(event: Event): void {
  attachedFiles.value = Array.from((event.target as HTMLInputElement).files ?? [])
}

async function saveCollection(collection: Collection, contents: CollectionContents): Promise<void> {
  const saved = await api.updateCollection(collection.id, collection.name, contents)
  collections.value = collections.value.map(item => item.id === saved.id ? saved : item)
}

async function createCollection(name: string): Promise<void> {
  if (!name.trim()) {
    collectionError.value = 'Enter a collection name.'
    return
  }
  collectionError.value = ''
  let collection: Collection
  try {
    collection = await api.createCollection(name.trim(), defaultContents())
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to create collection'
    return
  }
  collections.value.unshift(collection)
  selectedCollectionId.value = collection.id
}

async function createFolder({ name, parentId }: { name: string, parentId?: string }): Promise<void> {
  if (!selectedCollection.value) {
    collectionError.value = 'Select a collection before adding a folder.'
    return
  }
  if (!name.trim()) {
    collectionError.value = 'Enter a folder name.'
    return
  }
  try {
    const folder: StoredFolder = { id: crypto.randomUUID(), name: name.trim(), ...(parentId ? { parentId } : {}) }
    await saveCollection(selectedCollection.value, {
      ...selectedContents.value,
      folders: [...selectedContents.value.folders, folder],
    })
    selectedFolderId.value = folder.id
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to save folder'
  }
}

async function deleteFolder(id: string): Promise<void> {
  if (!selectedCollection.value) {
    return
  }
  const folder = selectedContents.value.folders.find(item => item.id === id)
  if (!folder) {
    return
  }
  const parentId = folder.parentId
  try {
    await saveCollection(selectedCollection.value, {
      ...selectedContents.value,
      folders: selectedContents.value.folders
        .filter(item => item.id !== id)
        .map(item => item.parentId === id ? withFolderParent(item, parentId) : item),
      requests: selectedContents.value.requests
        .map(item => item.folderId === id ? withRequestFolder(item, parentId) : item),
    })
    if (selectedFolderId.value === id) {
      selectedFolderId.value = parentId
    }
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to delete folder'
  }
}

async function moveFolder({ id, parentId }: { id: string, parentId?: string }): Promise<void> {
  if (!selectedCollection.value) {
    return
  }
  try {
    await saveCollection(selectedCollection.value, {
      ...selectedContents.value,
      folders: selectedContents.value.folders.map(folder => folder.id === id ? withFolderParent(folder, parentId) : folder),
    })
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to move folder'
  }
}

async function moveRequest({ id, folderId }: { id: string, folderId?: string }): Promise<void> {
  if (!selectedCollection.value) {
    return
  }
  try {
    await saveCollection(selectedCollection.value, {
      ...selectedContents.value,
      requests: selectedContents.value.requests.map(request => request.id === id ? withRequestFolder(request, folderId) : request),
    })
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to move request'
  }
}

async function duplicateRequest(request: StoredRequest): Promise<void> {
  if (!selectedCollection.value) {
    return
  }
  try {
    await saveCollection(selectedCollection.value, {
      ...selectedContents.value,
      requests: [...selectedContents.value.requests, {
        ...request,
        id: crypto.randomUUID(),
        name: `${request.name} copy`,
      }],
    })
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to duplicate request'
  }
}

async function toggleExecutionMode(): Promise<void> {
  if (!selectedCollection.value) {
    return
  }
  collectionError.value = ''
  try {
    await saveCollection(selectedCollection.value, {
      ...selectedContents.value,
      executionMode: selectedContents.value.executionMode === 'browser' ? 'backend' : 'browser',
    })
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to save collection'
  }
}

async function saveRequest(): Promise<void> {
  if (!selectedCollection.value) {
    collectionError.value = 'Select a collection before saving a request.'
    return
  }
  collectionError.value = ''
  let parsedHeaders: Record<string, string>
  try {
    parsedHeaders = JSON.parse(headers.value) as Record<string, string>
  }
  catch {
    collectionError.value = 'Headers must be valid JSON before saving.'
    return
  }
  const request: StoredRequest = {
    id: crypto.randomUUID(),
    name: `${method.value} ${url.value}`,
    method: method.value,
    url: url.value,
    headers: parsedHeaders,
    body: body.value,
    bodyMode: bodyMode.value,
    formFields: formFields.value.filter(field => field.key),
    auth: currentAuth(),
    ...(selectedFolderId.value ? { folderId: selectedFolderId.value } : {}),
  }
  try {
    await saveCollection(selectedCollection.value, {
      ...selectedContents.value,
      requests: [...selectedContents.value.requests, request],
    })
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to save request'
  }
}

function openRequest(request: StoredRequest): void {
  method.value = request.method
  url.value = request.url
  headers.value = JSON.stringify(request.headers, null, 2)
  body.value = request.body
  bodyMode.value = request.bodyMode ?? 'raw'
  formFields.value = request.formFields?.length ? request.formFields : [{ key: '', value: '' }]
  authType.value = request.auth?.type ?? 'none'
  bearerToken.value = request.auth?.token ?? ''
  authUsername.value = request.auth?.username ?? ''
  authPassword.value = request.auth?.password ?? ''
  selectedFolderId.value = request.folderId
}

async function loadHistory(): Promise<void> {
  if (!selectedCollectionId.value) {
    history.value = []
    return
  }
  try {
    history.value = await api.listRequestHistory(selectedCollectionId.value)
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to load request history'
  }
}

async function saveRequestHistory(): Promise<void> {
  if (!selectedCollection.value || !result.value) {
    return
  }
  try {
    const entry = await api.createRequestHistory(selectedCollection.value.id, {
      requestName: `${method.value} ${url.value}`,
      method: method.value,
      url: url.value,
      status: result.value.status,
      statusText: result.value.statusText,
      executionMode: selectedContents.value.executionMode,
    })
    history.value.unshift(entry)
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to save request history'
  }
}

async function exportCollection(): Promise<void> {
  if (!selectedCollection.value) {
    return
  }
  let blob: Blob
  try {
    blob = await api.exportCollection(selectedCollection.value.id)
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to export collection'
    return
  }
  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${selectedCollection.value.name}.postman_collection.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

async function downloadBackup(): Promise<void> {
  let backup: unknown
  try {
    backup = await api.createBackup()
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to create backup'
    return
  }
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }))
  link.download = 'siesta-backup.json'
  link.click()
  URL.revokeObjectURL(link.href)
}

async function restoreBackup(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    return
  }
  try {
    await api.restoreBackup(await file.text())
    await Promise.all([loadCollections(), loadEnvironments()])
    collectionError.value = 'Backup restored. Collections were added and matching environments were updated.'
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to restore backup'
  }
}

async function importCollection(event: Event): Promise<void> {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) {
    return
  }
  collectionError.value = ''
  importing.value = true
  try {
    const format = file.name.endsWith('.bru') ? 'bruno' : 'postman'
    const collection = await api.importCollection(format, await file.text())
    collections.value.unshift(collection)
    selectedCollectionId.value = collection.id
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to import collection'
  }
  finally {
    importing.value = false
  }
}

async function checkSession(): Promise<void> {
  if (!(await api.hasSession())) {
    await router.replace('/login')
    return
  }
  await Promise.all([loadEnvironments(), loadCollections()])
}

async function logout(): Promise<void> {
  await api.logout()
  result.value = undefined
  await router.replace('/login')
}

function newRequest(): void {
  method.value = 'GET'
  url.value = 'https://httpbin.org/get'
  headers.value = '{\n  "Accept": "application/json"\n}'
  body.value = ''
  bodyMode.value = 'raw'
  formFields.value = [{ key: '', value: '' }]
  selectedFolderId.value = undefined
  attachedFiles.value = []
  authType.value = 'none'
  bearerToken.value = ''
  authUsername.value = ''
  authPassword.value = ''
  requestError.value = ''
  result.value = undefined
}

async function sendRequest(): Promise<void> {
  requestError.value = ''
  result.value = undefined
  let parsedHeaders: Record<string, string>
  try {
    const parsedHeadersValue: unknown = JSON.parse(headers.value)
    if (!parsedHeadersValue || typeof parsedHeadersValue !== 'object' || Array.isArray(parsedHeadersValue) || !Object.values(parsedHeadersValue).every(value => typeof value === 'string')) {
      throw new Error('Headers must be a JSON object with string values')
    }
    parsedHeaders = parsedHeadersValue as Record<string, string>
  }
  catch (error) {
    requestError.value = error instanceof Error ? error.message : 'Headers must be valid JSON'
    return
  }

  sending.value = true
  try {
    const request = {
      url: url.value,
      method: method.value,
      headers: parsedHeaders,
      body: body.value || undefined,
      formFields: bodyMode.value === 'form-data' ? formFields.value.filter(field => field.key) : undefined,
      fileFieldName: bodyMode.value === 'form-data' ? fileFieldName.value : undefined,
      auth: currentAuth(),
      collectionId: selectedCollection.value?.id,
      environmentId: environmentId.value,
    }
    if (selectedContents.value.executionMode === 'browser') {
      const browserHeaders = Object.fromEntries(Object.entries(parsedHeaders).map(([key, value]) => [resolveBrowserVariables(key), resolveBrowserVariables(value)]))
      const authorization = browserAuthorization(request.auth)
      if (authorization && !Object.keys(browserHeaders).some(key => key.toLowerCase() === 'authorization')) {
        browserHeaders.Authorization = authorization
      }
      if (bodyMode.value === 'form-data') {
        for (const key of Object.keys(browserHeaders)) {
          if (key.toLowerCase() === 'content-type') {
            delete browserHeaders[key]
          }
        }
      }
      const response = await fetch(resolveBrowserVariables(url.value), {
        method: method.value,
        headers: browserHeaders,
        body: bodyMode.value === 'form-data' ? makeBrowserFormData() : body.value ? resolveBrowserVariables(body.value) : undefined,
      })
      result.value = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers),
        body: await response.text(),
        truncated: false,
      }
    }
    else {
      result.value = await api.sendBackendRequest(request, bodyMode.value === 'form-data' ? attachedFiles.value : [])
    }
    await saveRequestHistory()
  }
  catch (error) {
    requestError.value = error instanceof Error ? error.message : 'Request failed'
  }
  finally {
    sending.value = false
  }
}

watch(selectedCollectionId, () => {
  void loadHistory()
})

watch([environmentId, selectedCollectionId], () => {
  updatePreferences({
    activeEnvironmentId: environmentId.value,
    selectedCollectionId: selectedCollectionId.value,
  })
})

watch([method, url, headers, body, bodyMode, formFields, selectedFolderId], () => {
  saveDraft(session.value.activeRequestTabId, {
    method: method.value,
    url: url.value,
    headers: headers.value,
    body: body.value,
    bodyMode: bodyMode.value,
    formFields: formFields.value,
    folderId: selectedFolderId.value,
  })
}, { deep: true })

const displayedResponseBody = computed(() => {
  if (!result.value || !responseSearch.value.trim()) {
    return result.value?.body ?? ''
  }
  const search = responseSearch.value.toLowerCase()
  const matches = result.value.body.split('\n').filter(line => line.toLowerCase().includes(search))
  return matches.length ? matches.join('\n') : 'No matching response lines.'
})

onMounted(checkSession)
</script>

<template>
  <WorkspaceShell :environments="environments" :environment-id="environmentId" @update:environment-id="environmentId = $event" @new-request="newRequest" @logout="logout">
    <template #sidebar>
      <CollectionTree
        :collections="collections"
        :selected-collection-id="selectedCollectionId"
        :selected-contents="selectedContents"
        :importing="importing"
        @select-collection="selectedCollectionId = $event"
        @create-collection="createCollection"
        @create-folder="createFolder"
        @delete-folder="deleteFolder"
        @move-folder="moveFolder"
        @move-request="moveRequest"
        @open-request="openRequest"
        @duplicate-request="duplicateRequest"
        @import-collection="importCollection"
        @export-collection="exportCollection"
        @download-backup="downloadBackup"
        @restore-backup="restoreBackup"
        @toggle-execution-mode="toggleExecutionMode"
      />
      <p v-if="collectionError" class="px-2 text-xs text-danger">
        {{ collectionError }}
      </p>
    </template>
    <div class="box-border grid min-w-0 gap-6 p-4 sm:p-6">
      <section class="rounded-xl border border-slate-300 bg-white p-6 shadow-[0_8px_30px_rgb(15_23_42_/_8%)]">
        <div class="flex items-center justify-between gap-4">
          <div>
            <h2 class="mt-0">
              Environments
            </h2>
            <p class="mt-0 text-slate-500">
              Secret values are masked while editing.
            </p>
          </div>
          <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="button" @click="openEnvironment()">
            New environment
          </button>
        </div>
        <div class="grid gap-4 sm:grid-cols-[minmax(10rem,1fr)_2fr]">
          <div class="grid gap-2">
            <button v-for="environment in environments" :key="environment.id" class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 text-left text-slate-700" type="button" @click="openEnvironment(environment)">
              {{ environment.name }}
            </button>
          </div>
          <div>
            <label class="mt-4 grid gap-2 font-semibold text-slate-700">
              Name
              <input v-model="environmentName" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" placeholder="Production">
            </label>
            <div v-for="(entry, index) in environmentEntries" :key="index" class="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <input v-model="entry.key" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" aria-label="Variable name" placeholder="API_URL">
              <input v-model="entry.value" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" :type="entry.secret ? 'password' : 'text'" aria-label="Variable value" placeholder="Value">
              <label class="m-0 mt-0 flex items-center whitespace-nowrap font-semibold text-slate-700"><input v-model="entry.secret" class="w-auto" type="checkbox"> Secret</label>
            </div>
            <div class="mt-4 flex gap-2">
              <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="button" @click="addEnvironmentEntry">
                Add variable
              </button>
              <button class="cursor-pointer rounded-md border border-indigo-600 bg-indigo-600 px-3 py-2.5 font-bold text-white" type="button" @click="saveEnvironment">
                Save environment
              </button>
            </div>
            <p v-if="environmentError" class="mt-0 text-red-700">
              {{ environmentError }}
            </p>
          </div>
        </div>
      </section>

      <section class="rounded-xl border border-slate-300 bg-white p-6 shadow-[0_8px_30px_rgb(15_23_42_/_8%)]">
        <div class="grid gap-4 sm:flex sm:items-center">
          <select v-model="method" class="rounded-md border border-slate-300 px-3 py-2.5 font-inherit" aria-label="HTTP method">
            <option>GET</option>
            <option>POST</option>
            <option>PUT</option>
            <option>PATCH</option>
            <option>DELETE</option>
            <option>HEAD</option>
          </select>
          <input v-model="url" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit sm:flex-1" aria-label="Request URL" placeholder="https://api.example.com/v1/resources" required @keyup.enter="sendRequest">
          <button class="cursor-pointer rounded-md border border-indigo-600 bg-indigo-600 px-3 py-2.5 font-bold text-white disabled:cursor-wait disabled:opacity-70" type="button" :disabled="sending" @click="sendRequest">
            {{ sending ? 'Sending...' : 'Send' }}
          </button>
          <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="button" @click="saveRequest">
            Save
          </button>
        </div>

        <label class="mt-4 grid gap-2 font-semibold text-slate-700">
          Environment
          <select v-model="environmentId" class="rounded-md border border-slate-300 px-3 py-2.5 font-inherit">
            <option :value="undefined">No environment</option>
            <option v-for="environment in environments" :key="environment.id" :value="environment.id">
              {{ environment.name }}
            </option>
          </select>
        </label>
        <label v-if="selectedCollection" class="mt-4 grid gap-2 font-semibold text-slate-700">
          Folder
          <select v-model="selectedFolderId" class="rounded-md border border-slate-300 px-3 py-2.5 font-inherit">
            <option :value="undefined">No folder</option>
            <option v-for="folder in selectedContents.folders" :key="folder.id" :value="folder.id">{{ folder.name }}</option>
          </select>
        </label>
        <label class="mt-4 grid gap-2 font-semibold text-slate-700">
          Authentication
          <select v-model="authType" class="rounded-md border border-slate-300 px-3 py-2.5 font-inherit">
            <option value="none">None</option>
            <option value="bearer">Bearer token</option>
            <option value="basic">Basic auth</option>
          </select>
        </label>
        <label v-if="authType === 'bearer'" class="mt-4 grid gap-2 font-semibold text-slate-700">
          Bearer token
          <input v-model="bearerToken" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" type="password" placeholder="{{ACCESS_TOKEN}}">
        </label>
        <div v-if="authType === 'basic'" class="grid gap-4 sm:grid-cols-2">
          <label class="mt-4 grid gap-2 font-semibold text-slate-700">
            Username
            <input v-model="authUsername" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" autocomplete="username">
          </label>
          <label class="mt-4 grid gap-2 font-semibold text-slate-700">
            Password
            <input v-model="authPassword" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" type="password" autocomplete="current-password">
          </label>
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="mt-4 grid gap-2 font-semibold text-slate-700">
            Headers (JSON)
            <textarea v-model="headers" class="box-border min-h-52 w-full resize-y rounded-md border border-slate-300 px-3 py-2.5 font-mono text-sm" spellcheck="false" />
          </label>
          <label v-if="bodyMode === 'raw'" class="mt-4 grid gap-2 font-semibold text-slate-700">
            Body type
            <select v-model="bodyMode" class="rounded-md border border-slate-300 px-3 py-2.5 font-inherit">
              <option value="raw">Raw body</option>
              <option value="form-data">Multipart form-data</option>
            </select>
            Body
            <textarea v-model="body" class="box-border min-h-52 w-full resize-y rounded-md border border-slate-300 px-3 py-2.5 font-mono text-sm" spellcheck="false" placeholder="{&quot;example&quot;: true}" />
          </label>
          <div v-else class="mt-4 grid gap-3">
            <label class="grid gap-2 font-semibold text-slate-700">
              Body type
              <select v-model="bodyMode" class="rounded-md border border-slate-300 px-3 py-2.5 font-inherit">
                <option value="raw">Raw body</option>
                <option value="form-data">Multipart form-data</option>
              </select>
            </label>
            <div v-for="(field, index) in formFields" :key="index" class="grid gap-4 sm:grid-cols-2">
              <input v-model="field.key" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" aria-label="Form field name" placeholder="Field name">
              <input v-model="field.value" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" aria-label="Form field value" placeholder="Value">
            </div>
            <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="button" @click="addFormField">
              Add form field
            </button>
            <label class="grid gap-2 font-semibold text-slate-700">
              File field name
              <input v-model="fileFieldName" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" placeholder="file">
            </label>
            <label class="grid gap-2 font-semibold text-slate-700">
              Files
              <input class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" type="file" multiple @change="setAttachedFiles">
            </label>
            <p v-if="attachedFiles.length" class="mt-0 text-slate-500">
              {{ attachedFiles.length }} file(s) ready to upload.
            </p>
          </div>
        </div>
        <p v-if="requestError" class="mt-0 text-red-700">
          {{ requestError }}
        </p>
      </section>

      <ResponsePanel v-if="result" :result="result" :body="displayedResponseBody" :search="responseSearch" @update:search="responseSearch = $event" />
    </div>
  </WorkspaceShell>
</template>

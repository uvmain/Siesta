<script setup lang="ts">
interface Environment {
  id: number
  name: string
  values: string
  secretKeys: string
}

interface EnvironmentEntry {
  key: string
  value: string
  secret: boolean
}

type ExecutionMode = 'browser' | 'backend'
type AuthType = 'none' | 'bearer' | 'basic'
type BodyMode = 'raw' | 'form-data'

interface RequestAuth {
  type: AuthType
  token?: string
  username?: string
  password?: string
}

interface FormField {
  key: string
  value: string
}

interface StoredRequest {
  id: string
  name: string
  method: string
  url: string
  headers: Record<string, string>
  body: string
  bodyMode?: BodyMode
  formFields?: FormField[]
  auth?: RequestAuth
  folderId?: string
}

interface StoredFolder {
  id: string
  name: string
}

interface CollectionContents {
  executionMode: ExecutionMode
  requests: StoredRequest[]
  folders: StoredFolder[]
}

interface Collection {
  id: number
  name: string
  contents: string
}

interface ApiError {
  error?: string
}

interface RequestResult {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  truncated: boolean
}

interface RequestHistory {
  id: number
  requestName: string
  method: string
  url: string
  status: number
  statusText: string
  executionMode: ExecutionMode
  executedAt: number
}

const router = useRouter()
const environments = ref<Environment[]>([])
const editingEnvironmentId = ref<number | undefined>()
const environmentName = ref('')
const environmentEntries = ref<EnvironmentEntry[]>([])
const environmentError = ref('')
const collections = ref<Collection[]>([])
const environmentId = ref<number | undefined>()
const selectedCollectionId = ref<number | undefined>()
const newCollectionName = ref('')
const newFolderName = ref('')
const selectedFolderId = ref<string | undefined>()
const method = ref('GET')
const url = ref('https://httpbin.org/get')
const headers = ref('{\n  "Accept": "application/json"\n}')
const body = ref('')
const bodyMode = ref<BodyMode>('raw')
const formFields = ref<FormField[]>([{ key: '', value: '' }])
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

async function getError(response: Response): Promise<string> {
  const error = await response.json().catch(() => ({})) as ApiError
  return error.error ?? `Request failed with ${response.status}`
}

async function loadEnvironments(): Promise<void> {
  const response = await fetch('/api/environments')
  if (!response.ok) {
    throw new Error(await getError(response))
  }
  environments.value = await response.json() as Environment[]
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
  const endpoint = editingEnvironmentId.value ? `/api/environments/${editingEnvironmentId.value}` : '/api/environments'
  const response = await fetch(endpoint, {
    method: editingEnvironmentId.value ? 'PUT' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: environmentName.value.trim(), values, secretKeys }),
  })
  if (!response.ok) {
    environmentError.value = await getError(response)
    return
  }
  const environment = await response.json() as Environment
  environments.value = [...environments.value.filter(item => item.id !== environment.id), environment].sort((a, b) => a.name.localeCompare(b.name))
  environmentId.value = environment.id
  openEnvironment(environment)
}

async function loadCollections(): Promise<void> {
  const response = await fetch('/api/collections')
  if (!response.ok) {
    throw new Error(await getError(response))
  }
  collections.value = await response.json() as Collection[]
}

function defaultContents(): CollectionContents {
  return { executionMode: 'backend', requests: [], folders: [] }
}

function collectionContents(collection: Collection): CollectionContents {
  try {
    const contents = JSON.parse(collection.contents) as Partial<CollectionContents>
    return {
      executionMode: contents.executionMode === 'backend' ? 'backend' : 'browser',
      requests: Array.isArray(contents.requests) ? contents.requests : [],
      folders: Array.isArray(contents.folders) ? contents.folders : [],
    }
  }
  catch {
    return defaultContents()
  }
}

const selectedCollection = computed(() => collections.value.find(collection => collection.id === selectedCollectionId.value))
const selectedContents = computed(() => selectedCollection.value ? collectionContents(selectedCollection.value) : defaultContents())

function resolveBrowserVariables(value: string): string {
  const environment = environments.value.find(item => item.id === environmentId.value)
  if (!environment) {
    return value
  }
  try {
    const variables: unknown = JSON.parse(environment.values)
    if (!variables || typeof variables !== 'object' || Array.isArray(variables)) {
      return value
    }
    return value.replace(/\{\{([a-z_]\w*)\}\}/gi, (_, key: string) => {
      const replacement = (variables as Record<string, unknown>)[key]
      return typeof replacement === 'string' ? replacement : ''
    })
  }
  catch {
    return value
  }
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
  const response = await fetch(`/api/collections/${collection.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: collection.name, contents }),
  })
  if (!response.ok) {
    throw new Error(await getError(response))
  }
  const saved = await response.json() as Collection
  collections.value = collections.value.map(item => item.id === saved.id ? saved : item)
}

async function createCollection(): Promise<void> {
  if (!newCollectionName.value.trim()) {
    collectionError.value = 'Enter a collection name.'
    return
  }
  collectionError.value = ''
  const response = await fetch('/api/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: newCollectionName.value.trim(), contents: defaultContents() }),
  })
  if (!response.ok) {
    collectionError.value = await getError(response)
    return
  }
  const collection = await response.json() as Collection
  collections.value.unshift(collection)
  selectedCollectionId.value = collection.id
  newCollectionName.value = ''
}

async function createFolder(): Promise<void> {
  if (!selectedCollection.value) {
    collectionError.value = 'Select a collection before adding a folder.'
    return
  }
  if (!newFolderName.value.trim()) {
    collectionError.value = 'Enter a folder name.'
    return
  }
  try {
    const folder: StoredFolder = { id: crypto.randomUUID(), name: newFolderName.value.trim() }
    await saveCollection(selectedCollection.value, {
      ...selectedContents.value,
      folders: [...selectedContents.value.folders, folder],
    })
    selectedFolderId.value = folder.id
    newFolderName.value = ''
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to save folder'
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
  const response = await fetch(`/api/collections/${selectedCollectionId.value}/history`)
  if (!response.ok) {
    collectionError.value = await getError(response)
    return
  }
  history.value = await response.json() as RequestHistory[]
}

async function saveRequestHistory(): Promise<void> {
  if (!selectedCollection.value || !result.value) {
    return
  }
  const response = await fetch(`/api/collections/${selectedCollection.value.id}/history`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestName: `${method.value} ${url.value}`,
      method: method.value,
      url: url.value,
      status: result.value.status,
      statusText: result.value.statusText,
      executionMode: selectedContents.value.executionMode,
    }),
  })
  if (!response.ok) {
    collectionError.value = await getError(response)
    return
  }
  history.value.unshift(await response.json() as RequestHistory)
}

async function exportCollection(): Promise<void> {
  if (!selectedCollection.value) {
    return
  }
  const response = await fetch(`/api/collections/${selectedCollection.value.id}/export`)
  if (!response.ok) {
    collectionError.value = await getError(response)
    return
  }
  const link = document.createElement('a')
  link.href = URL.createObjectURL(await response.blob())
  link.download = `${selectedCollection.value.name}.postman_collection.json`
  link.click()
  URL.revokeObjectURL(link.href)
}

async function downloadBackup(): Promise<void> {
  const response = await fetch('/api/backups')
  if (!response.ok) {
    collectionError.value = await getError(response)
    return
  }
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([JSON.stringify(await response.json(), null, 2)], { type: 'application/json' }))
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
    const response = await fetch('/api/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: await file.text(),
    })
    if (!response.ok) {
      throw new Error(await getError(response))
    }
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
    const response = await fetch('/api/collections/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ format, content: await file.text() }),
    })
    if (!response.ok) {
      throw new Error(await getError(response))
    }
    const collection = await response.json() as Collection
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
  const response = await fetch('/api/auth/session')
  if (!response.ok) {
    await router.replace('/login')
    return
  }
  await Promise.all([loadEnvironments(), loadCollections()])
}

async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST' })
  result.value = undefined
  await router.replace('/login')
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
      auth: currentAuth(),
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
      const requestBody = bodyMode.value === 'form-data'
        ? (() => {
            const formData = new FormData()
            formData.append('request', JSON.stringify(request))
            for (const file of attachedFiles.value) {
              formData.append(`file:${fileFieldName.value || 'file'}`, file, file.name)
            }
            return formData
          })()
        : JSON.stringify(request)
      const response = await fetch('/api/requests/send', bodyMode.value === 'form-data'
        ? { method: 'POST', body: requestBody }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody })
      if (!response.ok) {
        requestError.value = await getError(response)
        return
      }
      result.value = await response.json() as RequestResult
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
  <main class="box-border mx-auto grid w-full max-w-[1100px] gap-6 p-4 sm:p-8">
    <header class="flex items-center justify-between gap-4">
      <div>
        <p class="mt-0 text-xs font-bold tracking-[.14em] text-indigo-600">siesta</p>
        <h1 class="mt-0">REST client</h1>
      </div>
      <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="button" @click="logout">Sign out</button>
    </header>

    <CollectionManager
      :collections="collections"
      :selected-collection-id="selectedCollectionId"
      :selected-collection="selectedCollection"
      :selected-contents="selectedContents"
      :new-collection-name="newCollectionName"
      :new-folder-name="newFolderName"
      :history="history"
      :collection-error="collectionError"
      :importing="importing"
      @update:selected-collection-id="selectedCollectionId = $event"
      @update:new-collection-name="newCollectionName = $event"
      @update:new-folder-name="newFolderName = $event"
      @create-collection="createCollection"
      @import-collection="importCollection"
      @export-collection="exportCollection"
      @download-backup="downloadBackup"
      @restore-backup="restoreBackup"
      @toggle-execution-mode="toggleExecutionMode"
      @create-folder="createFolder"
      @open-request="openRequest"
      @open-history="url = $event.url; method = $event.method"
    />

    <section class="rounded-xl border border-slate-300 bg-white p-6 shadow-[0_8px_30px_rgb(15_23_42_/_8%)]">
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="mt-0">Environments</h2>
          <p class="mt-0 text-slate-500">Secret values are masked while editing.</p>
        </div>
        <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="button" @click="openEnvironment()">New environment</button>
      </div>
      <div class="grid gap-4 sm:grid-cols-[minmax(10rem,1fr)_2fr]">
        <div class="grid gap-2">
          <button v-for="environment in environments" :key="environment.id" class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 text-left text-slate-700" type="button" @click="openEnvironment(environment)">{{ environment.name }}</button>
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
            <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="button" @click="addEnvironmentEntry">Add variable</button>
            <button class="cursor-pointer rounded-md border border-indigo-600 bg-indigo-600 px-3 py-2.5 font-bold text-white" type="button" @click="saveEnvironment">Save environment</button>
          </div>
          <p v-if="environmentError" class="mt-0 text-red-700">{{ environmentError }}</p>
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
        <button class="cursor-pointer rounded-md border border-indigo-600 bg-indigo-600 px-3 py-2.5 font-bold text-white disabled:cursor-wait disabled:opacity-70" type="button" :disabled="sending" @click="sendRequest">{{ sending ? 'Sending...' : 'Send' }}</button>
        <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="button" @click="saveRequest">Save</button>
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
          <button class="cursor-pointer rounded-md border border-slate-300 bg-white px-3 py-2.5 font-bold text-slate-700" type="button" @click="addFormField">Add form field</button>
          <label class="grid gap-2 font-semibold text-slate-700">
            File field name
            <input v-model="fileFieldName" class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" placeholder="file">
          </label>
          <label class="grid gap-2 font-semibold text-slate-700">
            Files
            <input class="box-border w-full rounded-md border border-slate-300 px-3 py-2.5 font-inherit" type="file" multiple @change="setAttachedFiles">
          </label>
          <p v-if="attachedFiles.length" class="mt-0 text-slate-500">{{ attachedFiles.length }} file(s) ready to upload.</p>
        </div>
      </div>
      <p v-if="requestError" class="mt-0 text-red-700">{{ requestError }}</p>
    </section>

    <ResponsePanel v-if="result" :result="result" :body="displayedResponseBody" :search="responseSearch" @update:search="responseSearch = $event" />
  </main>
</template>

<script setup lang="ts">
import type { Collection, Environment, FormField, RequestAuth, RequestHistory, RequestResult } from '~/logic/api'
import type { BodyMode, CollectionContents, CollectionOverview, EnvironmentEntry, RequestEntry, StoredFolder, StoredRequest } from '~/types/workspace'
import { api } from '~/logic/api'
import { applyRequestAuth } from '~/logic/request-auth'
import { headersFromEntries, parseHeaderEntries, syncQueryEntries, urlWithQueryEntries } from '~/logic/request-entries'
import { createRequestDraft, useWorkspaceState } from '~/logic/workspace-state'

const router = useRouter()
const { preferences, session, updatePreferences, saveDraft, createRequestTab, activateRequestTab, updateRequestTab, closeRequestTab } = useWorkspaceState()
const environments = ref<Environment[]>([])
const editingEnvironmentId = ref<number | undefined>()
const environmentName = ref('')
const environmentEntries = ref<EnvironmentEntry[]>([])
const environmentError = ref('')
const collections = ref<Collection[]>([])
const environmentId = ref<number | undefined>(preferences.value.activeEnvironmentId)
const selectedCollectionId = ref<number | undefined>(preferences.value.selectedCollectionId)
const selectedFolderId = ref<string | undefined>()
const activeDraft = session.value.drafts[session.value.activeRequestTabId] ?? createRequestDraft()
const method = ref(activeDraft.method)
const url = ref(activeDraft.url)
const headers = ref(activeDraft.headers)
const headerEntries = ref<RequestEntry[] | undefined>(activeDraft.headerEntries ?? parseHeaderEntries(activeDraft.headers))
const params = ref<RequestEntry[]>(syncQueryEntries(activeDraft.url, activeDraft.params ?? []))
const body = ref(activeDraft.body)
const bodyMode = ref<BodyMode>(activeDraft.bodyMode)
const formFields = ref<FormField[]>(activeDraft.formFields)
const fileFieldName = ref('file')
const attachedFiles = ref<File[]>([])
const requestAuth = ref<RequestAuth>({ type: 'none' })
const sending = ref(false)
const requestError = ref('')
const result = ref<RequestResult>()
const collectionError = ref('')
const importing = ref(false)
const history = ref<RequestHistory[]>([])
const responseSearch = ref('')
const restoringDraft = ref(false)
const tabAuth = ref<Record<string, RequestAuth>>({})
const closingTabId = ref<string>()
let updatingQuery = false

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
  return {
    executionMode: 'backend',
    requests: [],
    folders: [],
    description: '',
    variables: {},
    auth: { type: 'none' },
    scripts: { preRequest: '', tests: '' },
  }
}

function collectionContents(collection: Collection): CollectionContents {
  try {
    const contents = JSON.parse(collection.contents) as Partial<CollectionContents>
    return {
      executionMode: contents.executionMode === 'backend' ? 'backend' : 'browser',
      requests: Array.isArray(contents.requests) ? contents.requests : [],
      folders: Array.isArray(contents.folders) ? contents.folders : [],
      description: typeof contents.description === 'string' ? contents.description : '',
      variables: contents.variables && typeof contents.variables === 'object' && !Array.isArray(contents.variables) && Object.values(contents.variables).every(value => typeof value === 'string')
        ? contents.variables as Record<string, string>
        : {},
      auth: contents.auth && typeof contents.auth === 'object' && !Array.isArray(contents.auth) && ['none', 'bearer', 'basic', 'api-key', 'oauth2'].includes((contents.auth as RequestAuth).type)
        ? contents.auth as RequestAuth
        : { type: 'none' },
      scripts: contents.scripts && typeof contents.scripts === 'object' && !Array.isArray(contents.scripts)
        && typeof contents.scripts.preRequest === 'string' && typeof contents.scripts.tests === 'string'
        ? contents.scripts
        : { preRequest: '', tests: '' },
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
  return { ...requestAuth.value }
}

function effectiveAuth(): RequestAuth {
  const auth = currentAuth()
  return auth.type === 'none' ? selectedContents.value.auth : auth
}

async function saveCollectionOverview(overview: CollectionOverview): Promise<void> {
  if (!selectedCollection.value) {
    return
  }
  collectionError.value = ''
  try {
    await saveCollection(selectedCollection.value, { ...selectedContents.value, ...overview })
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to save collection overview'
  }
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

function currentDraft() {
  return {
    method: method.value,
    url: url.value,
    headers: headers.value,
    headerEntries: headerEntries.value,
    params: params.value,
    body: body.value,
    bodyMode: bodyMode.value,
    formFields: formFields.value,
    ...(selectedFolderId.value ? { folderId: selectedFolderId.value } : {}),
  }
}

function requestTabTitle(): string {
  if (!url.value.trim()) {
    return 'Untitled request'
  }
  try {
    const parsed = new URL(url.value)
    return `${parsed.host}${parsed.pathname === '/' ? '' : parsed.pathname}` || 'Untitled request'
  }
  catch {
    return url.value
  }
}

function applyActiveDraft(): void {
  const draft = session.value.drafts[session.value.activeRequestTabId] ?? createRequestDraft()
  const auth = tabAuth.value[session.value.activeRequestTabId] ?? { type: 'none' }
  restoringDraft.value = true
  method.value = draft.method
  url.value = draft.url
  headers.value = draft.headers
  headerEntries.value = draft.headerEntries?.map(entry => ({ ...entry })) ?? parseHeaderEntries(draft.headers)
  params.value = syncQueryEntries(draft.url, draft.params ?? [])
  body.value = draft.body
  bodyMode.value = draft.bodyMode
  formFields.value = draft.formFields.map(field => ({ ...field }))
  selectedFolderId.value = draft.folderId
  requestAuth.value = { ...auth }
  attachedFiles.value = []
  requestError.value = ''
  result.value = undefined
  restoringDraft.value = false
}

function updateParams(entries: RequestEntry[]): void {
  updatingQuery = true
  try {
    params.value = entries
    url.value = urlWithQueryEntries(url.value, entries)
  }
  finally {
    updatingQuery = false
  }
}

function updateHeaderEntries(entries: RequestEntry[] | undefined): void {
  headerEntries.value = entries
  if (entries) {
    try {
      headers.value = JSON.stringify(headersFromEntries(entries), null, 2)
    }
    catch {
      // Keep the last valid JSON while an incomplete table row is being edited.
    }
  }
}

function requestHeaders(): Record<string, string> {
  if (headerEntries.value) {
    return headersFromEntries(headerEntries.value)
  }
  throw new Error('Headers must be a JSON object with string values.')
}

function selectRequestTab(id: string): void {
  if (id === session.value.activeRequestTabId) {
    return
  }
  activateRequestTab(id)
  applyActiveDraft()
}

function finishCloseTab(id: string): void {
  const activeTabId = session.value.activeRequestTabId
  closeRequestTab(id)
  delete tabAuth.value[id]
  if (activeTabId === id) {
    applyActiveDraft()
  }
}

function requestCloseTab(id: string): void {
  const tab = session.value.openRequestTabs.find(item => item.id === id)
  if (tab?.dirty) {
    closingTabId.value = id
    return
  }
  finishCloseTab(id)
}

function discardAndCloseTab(): void {
  if (!closingTabId.value) {
    return
  }
  finishCloseTab(closingTabId.value)
  closingTabId.value = undefined
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
    parsedHeaders = requestHeaders()
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Headers are invalid.'
    requestError.value = collectionError.value
    return
  }
  const request: StoredRequest = {
    id: crypto.randomUUID(),
    name: `${method.value} ${url.value}`,
    method: method.value,
    url: url.value,
    headers: parsedHeaders,
    headerEntries: headerEntries.value?.map(entry => ({ ...entry })),
    params: params.value.map(entry => ({ ...entry })),
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
    saveDraft(session.value.activeRequestTabId, currentDraft(), false)
    updateRequestTab(session.value.activeRequestTabId, { title: request.name, dirty: false })
  }
  catch (error) {
    collectionError.value = error instanceof Error ? error.message : 'Unable to save request'
  }
}

function openRequest(request: StoredRequest): void {
  const id = createRequestTab({
    method: request.method,
    url: request.url,
    headers: JSON.stringify(request.headers, null, 2),
    headerEntries: request.headerEntries?.map(entry => ({ ...entry })),
    params: request.params?.map(entry => ({ ...entry })),
    body: request.body,
    bodyMode: request.bodyMode ?? 'raw',
    formFields: request.formFields?.length ? request.formFields : [{ key: '', value: '' }],
    ...(request.folderId ? { folderId: request.folderId } : {}),
  }, request.name)
  tabAuth.value[id] = request.auth ?? { type: 'none' }
  applyActiveDraft()
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
  createRequestTab()
  applyActiveDraft()
}

async function sendRequest(): Promise<void> {
  requestError.value = ''
  result.value = undefined
  let parsedHeaders: Record<string, string>
  try {
    parsedHeaders = requestHeaders()
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
      const browserUrl = new URL(resolveBrowserVariables(url.value))
      await applyRequestAuth(effectiveAuth(), browserUrl, browserHeaders, resolveBrowserVariables)
      if (bodyMode.value === 'form-data') {
        for (const key of Object.keys(browserHeaders)) {
          if (key.toLowerCase() === 'content-type') {
            delete browserHeaders[key]
          }
        }
      }
      const response = await fetch(browserUrl, {
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

watch(url, (value) => {
  if (!restoringDraft.value && !updatingQuery) {
    params.value = syncQueryEntries(value, params.value)
  }
}, { flush: 'sync' })

watch(headers, (value) => {
  if (!restoringDraft.value && !headerEntries.value) {
    headerEntries.value = parseHeaderEntries(value)
  }
}, { flush: 'sync' })

watch([method, url, headers, headerEntries, params, body, bodyMode, formFields, selectedFolderId], () => {
  if (restoringDraft.value) {
    return
  }
  const activeTabId = session.value.activeRequestTabId
  saveDraft(activeTabId, currentDraft())
  updateRequestTab(activeTabId, { title: requestTabTitle(), dirty: true })
}, { deep: true, flush: 'sync' })

watch(requestAuth, () => {
  if (restoringDraft.value) {
    return
  }
  const activeTabId = session.value.activeRequestTabId
  tabAuth.value[activeTabId] = currentAuth()
  updateRequestTab(activeTabId, { dirty: true })
}, { deep: true, flush: 'sync' })

watch(() => session.value.activeRequestTabId, () => {
  applyActiveDraft()
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
      <CollectionOverview
        :collection-id="selectedCollection?.id"
        :collection-name="selectedCollection?.name"
        :contents="selectedContents"
        @save="saveCollectionOverview"
      />
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

      <RequestWorkspaceTabs
        :model-value="session.activeRequestTabId"
        :tabs="session.openRequestTabs"
        @update:model-value="selectRequestTab"
        @close="requestCloseTab"
        @new="newRequest"
      />
      <RequestBuilder
        :key="session.activeRequestTabId"
        v-model:method="method"
        v-model:url="url"
        v-model:environment-id="environmentId"
        v-model:folder-id="selectedFolderId"
        v-model:auth="requestAuth"
        v-model:headers="headers"
        v-model:body="body"
        v-model:body-mode="bodyMode"
        v-model:form-fields="formFields"
        v-model:file-field-name="fileFieldName"
        :header-entries="headerEntries"
        :params="params"
        :environments="environments"
        :folders="selectedContents.folders"
        :has-collection="Boolean(selectedCollection)"
        :sending="sending"
        :error="requestError"
        :attached-file-count="attachedFiles.length"
        @send="sendRequest"
        @save="saveRequest"
        @new-request="newRequest"
        @add-form-field="addFormField"
        @files-changed="setAttachedFiles"
        @update:header-entries="updateHeaderEntries"
        @update:params="updateParams"
      />

      <ResponsePanel v-if="result" :result="result" :body="displayedResponseBody" :search="responseSearch" @update:search="responseSearch = $event" />
    </div>
    <UiDialog :open="Boolean(closingTabId)" title="Discard unsaved request changes?" @close="closingTabId = undefined">
      <p class="m-0 text-secondary">
        This request has unsaved changes. Closing it will discard its session draft.
      </p>
      <template #footer>
        <UiButton variant="secondary" @click="closingTabId = undefined">
          Keep editing
        </UiButton>
        <UiButton variant="danger" @click="discardAndCloseTab">
          Discard changes
        </UiButton>
      </template>
    </UiDialog>
  </WorkspaceShell>
</template>

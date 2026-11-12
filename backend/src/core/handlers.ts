import type { Context } from 'hono'
import { Buffer } from 'node:buffer'
import process from 'node:process'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { createSessionToken, hashPassword, hashSessionToken, SESSION_COOKIE_NAME, SESSION_DURATION_MS, verifyPassword } from './auth.js'
import {
  createBackup,
  createCollection,
  createEnvironment,
  createRequestHistory,
  createSession,
  deleteAllRows,
  deleteCollection,
  deleteEnvironment,
  deleteRow,
  deleteSession,
  getAllRows,
  getCollection,
  getEnvironment,
  getRow,
  getSingleUser,
  getUser,
  listCollections,
  listEnvironments,
  listRequestHistory,
  putRow,
  restoreBackup,
  updateCollection,
  updateEnvironment,
  updateUserPassword,
} from './database.js'

interface PutJson {
  key: string
  value: string
  ttl?: number
}

interface NamedDocument {
  name: string
  contents?: unknown
  values?: unknown
  secretKeys?: unknown
}

interface SendRequest {
  url: string
  method: string
  headers?: Record<string, string>
  body?: string
  formFields?: FormField[]
  auth?: RequestAuth
  environmentId?: number
}

interface FormField {
  key: string
  value: string
}

interface RequestAuth {
  type: 'none' | 'bearer' | 'basic'
  token?: string
  username?: string
  password?: string
}

interface UploadedFile {
  key: string
  file: File
}

interface ImportCollection {
  format: 'postman' | 'bruno'
  content: string
}

interface StoredRequest {
  id: string
  name: string
  method: string
  url: string
  headers: Record<string, string>
  body: string
  formFields?: FormField[]
  auth?: RequestAuth
  folderId?: string
}

interface StoredFolder {
  id: string
  name: string
}

interface StoredCollection {
  executionMode: 'browser' | 'backend'
  requests: StoredRequest[]
  folders?: StoredFolder[]
}

interface RequestHistoryInput {
  requestName: string
  method: string
  url: string
  status: number
  statusText: string
  executionMode: 'browser' | 'backend'
}

interface BackupRequest {
  version: unknown
  collections: unknown
  environments: unknown
}

const MAX_RESPONSE_BYTES = 1024 * 1024

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  return Object.values(value).every(item => typeof item === 'string')
}

function parseDocument(value: unknown): string | undefined {
  if (!isStringRecord(value) && (typeof value !== 'object' || value === null || Array.isArray(value))) {
    return undefined
  }
  return JSON.stringify(value)
}

function parseStringArray(value: unknown): string | undefined {
  return Array.isArray(value) && value.every(item => typeof item === 'string') ? JSON.stringify(value) : undefined
}

function parseBackup(value: unknown): BackupRequest | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as BackupRequest : undefined
}

function parseJson(value: string): unknown | undefined {
  try {
    return JSON.parse(value)
  }
  catch {
    return undefined
  }
}

function isFormFields(value: unknown): value is FormField[] {
  return Array.isArray(value) && value.every(item => item && typeof item === 'object' && !Array.isArray(item) && typeof (item as FormField).key === 'string' && typeof (item as FormField).value === 'string')
}

function isRequestAuth(value: unknown): value is RequestAuth {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const auth = value as RequestAuth
  if (!['none', 'bearer', 'basic'].includes(auth.type)) {
    return false
  }
  return (auth.token === undefined || typeof auth.token === 'string')
    && (auth.username === undefined || typeof auth.username === 'string')
    && (auth.password === undefined || typeof auth.password === 'string')
}

function getId(c: Context): number | undefined {
  const id = Number(c.req.param('id'))
  return Number.isSafeInteger(id) && id > 0 ? id : undefined
}

function resolveVariables(value: string, variables: Record<string, string>): string {
  return value.replace(/\{\{([a-z_]\w*)\}\}/gi, (_, key: string) => variables[key] ?? '')
}

function getPostmanUrl(url: unknown): string {
  if (typeof url === 'string') {
    return url
  }
  if (url && typeof url === 'object' && !Array.isArray(url) && typeof (url as { raw?: unknown }).raw === 'string') {
    return (url as { raw: string }).raw
  }
  return ''
}

function getPostmanHeaders(headers: unknown): Record<string, string> {
  if (!Array.isArray(headers)) {
    return {}
  }
  return Object.fromEntries(headers.flatMap((header) => {
    if (!header || typeof header !== 'object' || Array.isArray(header)) {
      return []
    }
    const { key, value, disabled } = header as { key?: unknown, value?: unknown, disabled?: unknown }
    return typeof key === 'string' && typeof value === 'string' && disabled !== true ? [[key, value]] : []
  }))
}

function parsePostmanCollection(content: string): { name: string, requests: StoredRequest[] } | undefined {
  let document: unknown
  try {
    document = JSON.parse(content)
  }
  catch {
    return undefined
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) {
    return undefined
  }

  const parsed = document as { info?: { name?: unknown }, item?: unknown }
  const requests: StoredRequest[] = []
  const visit = (items: unknown, path: string[]) => {
    if (!Array.isArray(items)) {
      return
    }
    for (const item of items) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        continue
      }
      const entry = item as { name?: unknown, item?: unknown, request?: unknown }
      const name = typeof entry.name === 'string' ? entry.name : 'Untitled request'
      if (entry.item) {
        visit(entry.item, [...path, name])
        continue
      }
      if (!entry.request || typeof entry.request !== 'object' || Array.isArray(entry.request)) {
        continue
      }
      const request = entry.request as { method?: unknown, url?: unknown, header?: unknown, body?: { raw?: unknown } }
      const url = getPostmanUrl(request.url)
      if (!url) {
        continue
      }
      requests.push({
        id: crypto.randomUUID(),
        name: [...path, name].join(' / '),
        method: typeof request.method === 'string' ? request.method.toUpperCase() : 'GET',
        url,
        headers: getPostmanHeaders(request.header),
        body: typeof request.body?.raw === 'string' ? request.body.raw : '',
      })
    }
  }
  visit(parsed.item, [])
  return typeof parsed.info?.name === 'string' ? { name: parsed.info.name, requests } : undefined
}

function parseBrunoCollection(content: string): { name: string, requests: StoredRequest[] } | undefined {
  const meta = content.match(/\bname:\s*(.+)/)
  const method = content.match(/\bmethod:\s*(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/i)
  const url = content.match(/\burl:\s*(.+)/)
  if (!meta || !method || !url) {
    return undefined
  }

  const headers: Record<string, string> = {}
  const headerBlock = content.match(/headers\s*\{([\s\S]*?)\}/)
  for (const line of headerBlock?.[1].split(/\r?\n/) ?? []) {
    const separator = line.indexOf(':')
    if (separator > 0) {
      const key = line.slice(0, separator).trim()
      const value = line.slice(separator + 1).trim()
      if (key && value) {
        headers[key] = value
      }
    }
  }
  const body = content.match(/body(?::\w+)?\s*\{([\s\S]*?)\}/)?.[1]?.trim() ?? ''
  return {
    name: meta[1].trim(),
    requests: [{
      id: crypto.randomUUID(),
      name: meta[1].trim(),
      method: method[1].toUpperCase(),
      url: url[1].trim(),
      headers,
      body,
    }],
  }
}

function parseStoredCollection(contents: string): StoredCollection | undefined {
  try {
    const parsed: unknown = JSON.parse(contents)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined
    }
    const collection = parsed as Partial<StoredCollection>
    return Array.isArray(collection.requests)
      ? {
          executionMode: collection.executionMode === 'browser' ? 'browser' : 'backend',
          requests: collection.requests,
          folders: Array.isArray(collection.folders) ? collection.folders : [],
        }
      : undefined
  }
  catch {
    return undefined
  }
}

export async function handlePutRequest(c: Context): Promise<Response> {
  const { key, value, ttl } = (await c.req.json()) as PutJson
  if (ttl !== undefined && ttl < 0) {
    return c.text('ttl must be a non-negative integer', 400)
  }
  putRow(key, value, ttl)
  return c.text('OK')
}

export async function handleGetRequest(c: Context): Promise<Response> {
  const key = c.req.param('key') as string
  const value = getRow(key)
  if (value === null) {
    return c.notFound()
  }
  else {
    return c.text(value)
  }
}

export async function handleGetAllRequest(c: Context): Promise<Response> {
  const rows = getAllRows()
  return c.json(rows)
}

export async function handleDeleteRequest(c: Context): Promise<Response> {
  const key = c.req.param('key') as string
  deleteRow(key)
  return c.text('OK')
}

export async function handleDeleteAllRequest(c: Context): Promise<Response> {
  deleteAllRows()
  return c.text('OK')
}

export async function handleHealthCheckRequest(c: Context): Promise<Response> {
  return c.text('OK')
}

export async function handleLoginRequest(c: Context): Promise<Response> {
  const body = await c.req.json<{ username?: unknown, password?: unknown }>()
  if (typeof body.username !== 'string' || typeof body.password !== 'string') {
    return c.json({ error: 'username and password are required' }, 400)
  }

  const user = getUser(body.username)
  if (!user || !(await verifyPassword(body.password, user.passwordHash))) {
    return c.json({ error: 'Invalid credentials' }, 401)
  }

  const token = createSessionToken()
  const expireTime = Date.now() + SESSION_DURATION_MS
  createSession(hashSessionToken(token), expireTime)
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
    path: '/',
    sameSite: 'Lax',
    secure: process.env.NODE_ENV === 'production',
  })
  return c.json({ username: user.username })
}

export function handleLogoutRequest(c: Context): Response {
  const token = getCookie(c, SESSION_COOKIE_NAME)
  if (token) {
    deleteSession(hashSessionToken(token))
  }
  deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' })
  return c.body(null, 204)
}

export function handleSessionRequest(c: Context): Response {
  const user = getSingleUser()
  return user ? c.json({ username: user.username }) : c.json({ error: 'User not found' }, 500)
}

export async function handlePasswordChangeRequest(c: Context): Promise<Response> {
  const body = await c.req.json<{ currentPassword?: unknown, newPassword?: unknown }>()
  if (typeof body.currentPassword !== 'string' || typeof body.newPassword !== 'string') {
    return c.json({ error: 'currentPassword and newPassword are required' }, 400)
  }
  if (body.newPassword.length < 8) {
    return c.json({ error: 'newPassword must be at least 8 characters' }, 400)
  }

  const user = getSingleUser()
  if (!user || !(await verifyPassword(body.currentPassword, user.passwordHash))) {
    return c.json({ error: 'Current password is incorrect' }, 401)
  }

  updateUserPassword(user.username, await hashPassword(body.newPassword))
  return c.body(null, 204)
}

export function handleGetCollectionsRequest(c: Context): Response {
  return c.json(listCollections())
}

export function handleCreateBackupRequest(c: Context): Response {
  return c.json(createBackup())
}

export async function handleRestoreBackupRequest(c: Context): Promise<Response> {
  const backup = parseBackup(await c.req.json<unknown>())
  if (!backup || backup.version !== 1 || !Array.isArray(backup.collections) || !Array.isArray(backup.environments)) {
    return c.json({ error: 'Backup format is invalid' }, 400)
  }
  const collections = backup.collections.flatMap((collection) => {
    if (!collection || typeof collection !== 'object' || Array.isArray(collection)) {
      return []
    }
    const { name, contents } = collection as { name?: unknown, contents?: unknown }
    return typeof name === 'string' && name.trim() && typeof contents === 'string' && parseStoredCollection(contents)
      ? [{ name: name.trim(), contents }]
      : []
  })
  const environments = backup.environments.flatMap((environment) => {
    if (!environment || typeof environment !== 'object' || Array.isArray(environment)) {
      return []
    }
    const { name, values, secretKeys } = environment as { name?: unknown, values?: unknown, secretKeys?: unknown }
    const serializedValues = typeof values === 'string' ? values : undefined
    const serializedSecretKeys = typeof secretKeys === 'string' ? secretKeys : undefined
    const parsedValues = serializedValues ? parseJson(serializedValues) : undefined
    const parsedSecretKeys = serializedSecretKeys ? parseJson(serializedSecretKeys) : undefined
    return typeof name === 'string' && name.trim() && isStringRecord(parsedValues) && Array.isArray(parsedSecretKeys) && parsedSecretKeys.every(key => typeof key === 'string') && serializedValues && serializedSecretKeys
      ? [{ name: name.trim(), values: serializedValues, secretKeys: serializedSecretKeys }]
      : []
  })
  if (collections.length !== backup.collections.length || environments.length !== backup.environments.length) {
    return c.json({ error: 'Backup contains invalid collections or environments' }, 400)
  }
  return c.json(restoreBackup({ version: 1, collections, environments }))
}

export async function handleCreateCollectionRequest(c: Context): Promise<Response> {
  const body = await c.req.json<NamedDocument>()
  const contents = parseDocument(body.contents ?? {})
  if (typeof body.name !== 'string' || !body.name.trim() || !contents) {
    return c.json({ error: 'A collection name and object contents are required' }, 400)
  }
  return c.json(createCollection(body.name.trim(), contents), 201)
}

export async function handleImportCollectionRequest(c: Context): Promise<Response> {
  const body = await c.req.json<ImportCollection>()
  if ((body.format !== 'postman' && body.format !== 'bruno') || typeof body.content !== 'string') {
    return c.json({ error: 'format and content are required' }, 400)
  }
  const imported = body.format === 'postman' ? parsePostmanCollection(body.content) : parseBrunoCollection(body.content)
  if (!imported) {
    return c.json({ error: `The ${body.format} export could not be read` }, 400)
  }
  const contents: StoredCollection = { executionMode: 'backend', requests: imported.requests }
  return c.json(createCollection(imported.name, JSON.stringify(contents)), 201)
}

export async function handleExportCollectionRequest(c: Context): Promise<Response> {
  const id = getId(c)
  if (!id) {
    return c.json({ error: 'Invalid collection id' }, 400)
  }
  const collection = getCollection(id)
  if (!collection) {
    return await c.notFound()
  }
  const contents = parseStoredCollection(collection.contents)
  if (!contents) {
    return c.json({ error: 'Collection contents are invalid' }, 500)
  }
  const createPostmanRequest = (request: StoredRequest) => ({
    name: request.name,
    request: {
      method: request.method,
      header: Object.entries(request.headers).map(([key, value]) => ({ key, value })),
      url: { raw: request.url },
      ...(request.body ? { body: { mode: 'raw', raw: request.body } } : {}),
    },
  })
  type PostmanRequest = ReturnType<typeof createPostmanRequest>
  interface PostmanFolder {
    name: string
    item: PostmanRequest[]
  }
  const folders = new Map<string, PostmanFolder>()
  for (const folder of contents.folders ?? []) {
    folders.set(folder.id, { name: folder.name, item: [] })
  }
  const items: Array<PostmanRequest | PostmanFolder> = contents.requests.filter(request => !request.folderId).map(createPostmanRequest)
  for (const request of contents.requests.filter(item => item.folderId)) {
    const folder = folders.get(request.folderId as string)
    if (folder) {
      folder.item.push(createPostmanRequest(request))
    }
    else {
      items.push(createPostmanRequest(request))
    }
  }
  items.push(...[...folders.values()].filter(folder => folder.item.length))
  return c.json({
    info: {
      name: collection.name,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
    },
    item: items,
  }, 200, {
    'Content-Disposition': `attachment; filename="${collection.name.replace(/[^\w.-]/g, '_')}.postman_collection.json"`,
  })
}

export async function handleGetRequestHistoryRequest(c: Context): Promise<Response> {
  const id = getId(c)
  if (!id) {
    return c.json({ error: 'Invalid collection id' }, 400)
  }
  const collection = getCollection(id)
  if (!collection) {
    return await c.notFound()
  }
  return c.json(listRequestHistory(id))
}

export async function handleCreateRequestHistoryRequest(c: Context): Promise<Response> {
  const collectionId = getId(c)
  const body = await c.req.json<RequestHistoryInput>()
  if (!collectionId || typeof body.requestName !== 'string' || typeof body.method !== 'string' || typeof body.url !== 'string' || !Number.isSafeInteger(body.status) || typeof body.statusText !== 'string' || (body.executionMode !== 'browser' && body.executionMode !== 'backend')) {
    return c.json({ error: 'Request history entry is invalid' }, 400)
  }
  if (!getCollection(collectionId)) {
    return await c.notFound()
  }
  return c.json(createRequestHistory({ collectionId, ...body }), 201)
}

export async function handleUpdateCollectionRequest(c: Context): Promise<Response> {
  const id = getId(c)
  const body = await c.req.json<NamedDocument>()
  const contents = parseDocument(body.contents ?? {})
  if (!id || typeof body.name !== 'string' || !body.name.trim() || !contents) {
    return c.json({ error: 'A collection name and object contents are required' }, 400)
  }
  const collection = updateCollection(id, body.name.trim(), contents)
  return collection ? c.json(collection) : c.notFound()
}

export function handleDeleteCollectionRequest(c: Context): Response {
  const id = getId(c)
  if (!id) {
    return c.json({ error: 'Invalid collection id' }, 400)
  }
  deleteCollection(id)
  return c.body(null, 204)
}

export function handleGetEnvironmentsRequest(c: Context): Response {
  return c.json(listEnvironments())
}

export async function handleCreateEnvironmentRequest(c: Context): Promise<Response> {
  const body = await c.req.json<NamedDocument>()
  const values = isStringRecord(body.values) ? JSON.stringify(body.values) : undefined
  const secretKeys = parseStringArray(body.secretKeys ?? [])
  if (typeof body.name !== 'string' || !body.name.trim() || !values || !secretKeys) {
    return c.json({ error: 'An environment name and string values object are required' }, 400)
  }
  try {
    return c.json(createEnvironment(body.name.trim(), values, secretKeys), 201)
  }
  catch {
    return c.json({ error: 'An environment with that name already exists' }, 409)
  }
}

export async function handleUpdateEnvironmentRequest(c: Context): Promise<Response> {
  const id = getId(c)
  const body = await c.req.json<NamedDocument>()
  const values = isStringRecord(body.values) ? JSON.stringify(body.values) : undefined
  const secretKeys = parseStringArray(body.secretKeys ?? [])
  if (!id || typeof body.name !== 'string' || !body.name.trim() || !values || !secretKeys) {
    return c.json({ error: 'An environment name and string values object are required' }, 400)
  }
  try {
    const environment = updateEnvironment(id, body.name.trim(), values, secretKeys)
    return environment ? c.json(environment) : c.notFound()
  }
  catch {
    return c.json({ error: 'An environment with that name already exists' }, 409)
  }
}

export function handleDeleteEnvironmentRequest(c: Context): Response {
  const id = getId(c)
  if (!id) {
    return c.json({ error: 'Invalid environment id' }, 400)
  }
  deleteEnvironment(id)
  return c.body(null, 204)
}

function getRequestAuthorization(auth: RequestAuth | undefined, variables: Record<string, string>): string | undefined {
  if (!auth || auth.type === 'none') {
    return undefined
  }
  if (auth.type === 'bearer') {
    return auth.token ? `Bearer ${resolveVariables(auth.token, variables)}` : undefined
  }
  if (auth.username === undefined || auth.password === undefined) {
    return undefined
  }
  return `Basic ${Buffer.from(`${resolveVariables(auth.username, variables)}:${resolveVariables(auth.password, variables)}`).toString('base64')}`
}

async function sendRequest(c: Context, body: SendRequest, uploadedFiles: UploadedFile[]): Promise<Response> {
  if (typeof body.url !== 'string' || typeof body.method !== 'string' || (body.headers !== undefined && !isStringRecord(body.headers)) || (body.body !== undefined && typeof body.body !== 'string') || (body.formFields !== undefined && !isFormFields(body.formFields)) || (body.auth !== undefined && !isRequestAuth(body.auth))) {
    return c.json({ error: 'url, method, headers, and body are invalid' }, 400)
  }

  let url: URL
  try {
    url = new URL(body.url)
  }
  catch {
    return c.json({ error: 'url must be an absolute URL' }, 400)
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return c.json({ error: 'Only HTTP and HTTPS URLs are supported' }, 400)
  }

  let variables: Record<string, string> = {}
  if (body.environmentId !== undefined) {
    if (!Number.isSafeInteger(body.environmentId)) {
      return c.json({ error: 'environmentId must be an integer' }, 400)
    }
    const environment = getEnvironment(body.environmentId)
    if (!environment) {
      return c.json({ error: 'Environment not found' }, 404)
    }
    const parsedValues: unknown = JSON.parse(environment.values)
    if (!isStringRecord(parsedValues)) {
      return c.json({ error: 'Environment values are invalid' }, 500)
    }
    variables = parsedValues
  }

  const method = body.method.toUpperCase()
  if ((method === 'GET' || method === 'HEAD') && (body.body || body.formFields?.length || uploadedFiles.length)) {
    return c.json({ error: `${method} requests cannot include a body` }, 400)
  }

  try {
    const requestHeaders = Object.fromEntries(Object.entries(body.headers ?? {}).map(([key, value]) => [resolveVariables(key, variables), resolveVariables(value, variables)]))
    const authorization = getRequestAuthorization(body.auth, variables)
    if (authorization && !Object.keys(requestHeaders).some(key => key.toLowerCase() === 'authorization')) {
      requestHeaders.Authorization = authorization
    }
    let requestBody: string | FormData | undefined
    if (body.formFields || uploadedFiles.length) {
      for (const key of Object.keys(requestHeaders)) {
        if (key.toLowerCase() === 'content-type') {
          delete requestHeaders[key]
        }
      }
      const formData = new FormData()
      for (const field of body.formFields ?? []) {
        formData.append(resolveVariables(field.key, variables), resolveVariables(field.value, variables))
      }
      for (const file of uploadedFiles) {
        formData.append(resolveVariables(file.key, variables), file.file, file.file.name)
      }
      requestBody = formData
    }
    else {
      requestBody = body.body ? resolveVariables(body.body, variables) : undefined
    }
    const response = await fetch(resolveVariables(url.toString(), variables), {
      method,
      headers: requestHeaders,
      body: requestBody,
      signal: AbortSignal.timeout(30_000),
    })
    const responseBody = new Uint8Array(await response.arrayBuffer()).slice(0, MAX_RESPONSE_BYTES)
    const headers = Object.fromEntries([...response.headers].filter(([key]) => key !== 'set-cookie'))
    return c.json({
      status: response.status,
      statusText: response.statusText,
      headers,
      body: new TextDecoder().decode(responseBody),
      truncated: Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed'
    return c.json({ error: `Request failed: ${message}` }, 502)
  }
}

export async function handleSendRequest(c: Context): Promise<Response> {
  const contentType = c.req.header('Content-Type') ?? ''
  if (!contentType.startsWith('multipart/form-data')) {
    return sendRequest(c, await c.req.json<SendRequest>(), [])
  }

  const formData = await c.req.formData()
  const rawRequest = formData.get('request')
  if (typeof rawRequest !== 'string') {
    return c.json({ error: 'Multipart requests require a request field' }, 400)
  }
  let request: SendRequest
  try {
    request = JSON.parse(rawRequest) as SendRequest
  }
  catch {
    return c.json({ error: 'request must be valid JSON' }, 400)
  }
  const uploadedFiles: UploadedFile[] = []
  for (const [key, value] of formData.entries()) {
    if (key.startsWith('file:') && value instanceof File) {
      uploadedFiles.push({ key: key.slice(5), file: value })
    }
  }
  return sendRequest(c, request, uploadedFiles)
}

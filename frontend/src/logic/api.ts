export type ExecutionMode = 'browser' | 'backend'

export interface FormField {
  key: string
  value: string
}

export interface RequestAuth {
  type: 'none' | 'bearer' | 'basic' | 'api-key' | 'oauth2'
  token?: string
  username?: string
  password?: string
  key?: string
  value?: string
  location?: 'header' | 'query'
  tokenUrl?: string
  clientId?: string
  clientSecret?: string
  scope?: string
  clientAuthentication?: 'basic' | 'body'
}

export interface Environment {
  id: number
  name: string
  values: string
  secretKeys: string
}

export interface Collection {
  id: number
  name: string
  contents: string
}

export interface RequestResult {
  status: number
  statusText: string
  headers: Record<string, string>
  body: string
  truncated: boolean
}

export interface RequestHistory {
  id: number
  requestName: string
  method: string
  url: string
  status: number
  statusText: string
  executionMode: ExecutionMode
  executedAt: number
}

export interface BackupDocument {
  version: 1
  collections: Array<Pick<Collection, 'name' | 'contents'>>
  environments: Array<Pick<Environment, 'name' | 'values' | 'secretKeys'>>
}

export interface BackupRestoreResult {
  collections: number
  environments: number
}

export interface BackendRequest {
  url: string
  method: string
  headers: Record<string, string>
  body?: string
  formFields?: FormField[]
  bodyMode?: 'none' | 'raw' | 'json' | 'xml' | 'text' | 'html' | 'javascript' | 'form-data' | 'urlencoded' | 'binary'
  urlEncodedFields?: FormField[]
  fileFieldName?: string
  auth: RequestAuth
  collectionId?: number
  environmentId?: number
}

export interface ApiErrorBody {
  error?: string
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message)
    this.name = 'ApiError'
  }
}

async function getError(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({})) as ApiErrorBody
  return new ApiError(body.error ?? `Request failed with ${response.status}`, response.status)
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, init)
  if (!response.ok) {
    throw await getError(response)
  }
  return response.json() as Promise<T>
}

function json<T>(method: 'POST' | 'PUT', body: T): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}

export const api = {
  async hasSession(): Promise<boolean> {
    return (await fetch('/api/auth/session')).ok
  },

  login(username: string, password: string): Promise<{ username: string }> {
    return request('/api/auth/login', json('POST', { username, password }))
  },

  async logout(): Promise<void> {
    const response = await fetch('/api/auth/logout', { method: 'POST' })
    if (!response.ok) {
      throw await getError(response)
    }
  },

  listEnvironments(): Promise<Environment[]> {
    return request('/api/environments')
  },

  createEnvironment(name: string, values: Record<string, string>, secretKeys: string[]): Promise<Environment> {
    return request('/api/environments', json('POST', { name, values, secretKeys }))
  },

  updateEnvironment(id: number, name: string, values: Record<string, string>, secretKeys: string[]): Promise<Environment> {
    return request(`/api/environments/${id}`, json('PUT', { name, values, secretKeys }))
  },

  listCollections(): Promise<Collection[]> {
    return request('/api/collections')
  },

  createCollection(name: string, contents: object): Promise<Collection> {
    return request('/api/collections', json('POST', { name, contents }))
  },

  updateCollection(id: number, name: string, contents: object): Promise<Collection> {
    return request(`/api/collections/${id}`, json('PUT', { name, contents }))
  },

  importCollection(format: 'postman' | 'bruno', content: string): Promise<Collection> {
    return request('/api/collections/import', json('POST', { format, content }))
  },

  listRequestHistory(collectionId: number): Promise<RequestHistory[]> {
    return request(`/api/collections/${collectionId}/history`)
  },

  createRequestHistory(collectionId: number, history: Omit<RequestHistory, 'id' | 'executedAt'>): Promise<RequestHistory> {
    return request(`/api/collections/${collectionId}/history`, json('POST', history))
  },

  async exportCollection(collectionId: number): Promise<Blob> {
    const response = await fetch(`/api/collections/${collectionId}/export`)
    if (!response.ok) {
      throw await getError(response)
    }
    return response.blob()
  },

  createBackup(): Promise<BackupDocument> {
    return request('/api/backups')
  },

  restoreBackup(content: string): Promise<BackupRestoreResult> {
    return request('/api/backups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: content,
    })
  },

  sendBackendRequest(requestData: BackendRequest, files: File[]): Promise<RequestResult> {
    if (!files.length) {
      return request('/api/requests/send', json('POST', requestData))
    }
    const formData = new FormData()
    formData.append('request', JSON.stringify(requestData))
    for (const file of files) {
      formData.append(requestData.bodyMode === 'binary' ? 'binary' : `file:${requestData.fileFieldName || 'file'}`, file, file.name)
    }
    return request('/api/requests/send', { method: 'POST', body: formData })
  },
}

import type { ExecutionMode, FormField, RequestAuth } from '~/logic/api'

export interface EnvironmentEntry {
  key: string
  value: string
  secret: boolean
}

export type AuthType = 'none' | 'bearer' | 'basic'

export type BodyMode = 'raw' | 'form-data'

export interface StoredRequest {
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
  description?: string
}

export interface StoredFolder {
  id: string
  name: string
  parentId?: string
}

export interface CollectionContents {
  executionMode: ExecutionMode
  requests: StoredRequest[]
  folders: StoredFolder[]
  variables: Record<string, string>
}

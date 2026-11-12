import type { ExecutionMode, FormField, RequestAuth } from '~/logic/api'

export interface EnvironmentEntry {
  key: string
  value: string
  secret: boolean
}

export type BodyMode = 'raw' | 'form-data'

export interface RequestEntry {
  key: string
  value: string
  description: string
  enabled: boolean
  hasEquals?: boolean
}

export interface StoredRequest {
  id: string
  name: string
  method: string
  url: string
  headers: Record<string, string>
  headerEntries?: RequestEntry[]
  params?: RequestEntry[]
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

export interface CollectionScripts {
  preRequest: string
  tests: string
}

export interface CollectionOverview {
  description: string
  variables: Record<string, string>
  auth: RequestAuth
  scripts: CollectionScripts
}

export interface CollectionContents {
  executionMode: ExecutionMode
  requests: StoredRequest[]
  folders: StoredFolder[]
  description: string
  variables: CollectionOverview['variables']
  auth: CollectionOverview['auth']
  scripts: CollectionOverview['scripts']
}

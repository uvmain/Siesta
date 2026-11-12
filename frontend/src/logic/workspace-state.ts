import type { RequestEntry } from '~/types/workspace'
import { ref, watch } from 'vue'

export type Theme = 'dark' | 'light'

export interface RequestTab {
  id: string
  title: string
  method: string
  dirty: boolean
}

export interface RequestDraft {
  method: string
  url: string
  headers: string
  headerEntries?: RequestEntry[]
  params?: RequestEntry[]
  body: string
  bodyMode: 'raw' | 'form-data'
  formFields: Array<{ key: string, value: string }>
  folderId?: string
}

interface WorkspacePreferences {
  theme: Theme
  sidebarCollapsed: boolean
  sidebarWidth: number
  responsePanelHeight: number
  activeEnvironmentId?: number
  selectedCollectionId?: number
}

interface WorkspaceSession {
  activeRequestTabId: string
  openRequestTabs: RequestTab[]
  drafts: Record<string, RequestDraft>
}

const PREFERENCES_KEY = 'siesta.preferences'
const SESSION_KEY = 'siesta.workspace'

const defaultPreferences: WorkspacePreferences = {
  theme: 'dark',
  sidebarCollapsed: false,
  sidebarWidth: 280,
  responsePanelHeight: 360,
}

const defaultDraft: RequestDraft = {
  method: 'GET',
  url: 'https://httpbin.org/get',
  headers: '{\n  "Accept": "application/json"\n}',
  body: '',
  bodyMode: 'raw',
  formFields: [{ key: '', value: '' }],
}

export function createRequestDraft(): RequestDraft {
  return {
    ...defaultDraft,
    formFields: defaultDraft.formFields.map(field => ({ ...field })),
  }
}

const defaultSession: WorkspaceSession = {
  activeRequestTabId: 'draft',
  openRequestTabs: [{ id: 'draft', title: 'Untitled request', method: 'GET', dirty: false }],
  drafts: { draft: createRequestDraft() },
}

function readStorage<T>(storage: Storage, key: string, fallback: T): T {
  try {
    const stored = storage.getItem(key)
    if (!stored) {
      return fallback
    }
    return { ...fallback, ...JSON.parse(stored) } as T
  }
  catch {
    return fallback
  }
}

function copyDraft(draft: RequestDraft): RequestDraft {
  return {
    ...draft,
    formFields: draft.formFields.map(field => ({ ...field })),
    headerEntries: draft.headerEntries?.map(entry => ({ ...entry })),
    params: draft.params?.map(entry => ({ ...entry })),
  }
}

const preferences = ref<WorkspacePreferences>(
  typeof window === 'undefined' ? defaultPreferences : readStorage(localStorage, PREFERENCES_KEY, defaultPreferences),
)

const session = ref<WorkspaceSession>(
  typeof window === 'undefined' ? defaultSession : readStorage(sessionStorage, SESSION_KEY, defaultSession),
)

watch(preferences, (value) => {
  localStorage.setItem(PREFERENCES_KEY, JSON.stringify(value))
}, { deep: true })

watch(session, (value) => {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(value))
}, { deep: true })

export function useWorkspaceState() {
  function updatePreferences(value: Partial<WorkspacePreferences>): void {
    preferences.value = { ...preferences.value, ...value }
  }

  function saveDraft(id: string, draft: RequestDraft, dirty = true): void {
    session.value = {
      ...session.value,
      drafts: { ...session.value.drafts, [id]: copyDraft(draft) },
      openRequestTabs: session.value.openRequestTabs.map(tab => tab.id === id ? { ...tab, method: draft.method, dirty } : tab),
    }
  }

  function createRequestTab(draft = createRequestDraft(), title = 'Untitled request'): string {
    const id = crypto.randomUUID()
    session.value = {
      activeRequestTabId: id,
      openRequestTabs: [...session.value.openRequestTabs, { id, title, method: draft.method, dirty: false }],
      drafts: { ...session.value.drafts, [id]: copyDraft(draft) },
    }
    return id
  }

  function activateRequestTab(id: string): void {
    if (session.value.openRequestTabs.some(tab => tab.id === id)) {
      session.value = { ...session.value, activeRequestTabId: id }
    }
  }

  function updateRequestTab(id: string, changes: Partial<Pick<RequestTab, 'title' | 'method' | 'dirty'>>): void {
    session.value = {
      ...session.value,
      openRequestTabs: session.value.openRequestTabs.map(tab => tab.id === id ? { ...tab, ...changes } : tab),
    }
  }

  function closeRequestTab(id: string): void {
    const index = session.value.openRequestTabs.findIndex(tab => tab.id === id)
    if (index < 0) {
      return
    }
    const openRequestTabs = session.value.openRequestTabs.filter(tab => tab.id !== id)
    const { [id]: _, ...drafts } = session.value.drafts
    if (!openRequestTabs.length) {
      const newId = crypto.randomUUID()
      const draft = createRequestDraft()
      session.value = {
        activeRequestTabId: newId,
        openRequestTabs: [{ id: newId, title: 'Untitled request', method: draft.method, dirty: false }],
        drafts: { [newId]: draft },
      }
      return
    }
    const nextTab = openRequestTabs[Math.min(index, openRequestTabs.length - 1)]
    session.value = {
      activeRequestTabId: session.value.activeRequestTabId === id ? nextTab.id : session.value.activeRequestTabId,
      openRequestTabs,
      drafts,
    }
  }

  return {
    preferences,
    session,
    updatePreferences,
    saveDraft,
    createRequestTab,
    activateRequestTab,
    updateRequestTab,
    closeRequestTab,
  }
}

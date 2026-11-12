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

const defaultSession: WorkspaceSession = {
  activeRequestTabId: 'draft',
  openRequestTabs: [{ id: 'draft', title: 'Untitled request', method: 'GET', dirty: false }],
  drafts: { draft: defaultDraft },
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
      drafts: { ...session.value.drafts, [id]: draft },
      openRequestTabs: session.value.openRequestTabs.map(tab => tab.id === id ? { ...tab, method: draft.method, dirty } : tab),
    }
  }

  return { preferences, session, updatePreferences, saveDraft }
}

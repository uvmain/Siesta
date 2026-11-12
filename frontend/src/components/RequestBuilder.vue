<script setup lang="ts">
import type { Environment, FormField, RequestAuth } from '~/logic/api'
import type { BodyMode, RequestEntry, StoredFolder } from '~/types/workspace'

defineProps<{
  environments: Environment[]
  folders: StoredFolder[]
  hasCollection: boolean
  sending: boolean
  error: string
  attachedFileCount: number
}>()

const emit = defineEmits<{
  send: []
  save: []
  newRequest: []
  addFormField: []
  filesChanged: [event: Event]
}>()

const method = defineModel<string>('method', { required: true })
const url = defineModel<string>('url', { required: true })
const environmentId = defineModel<number | undefined>('environmentId', { required: true })
const folderId = defineModel<string | undefined>('folderId', { required: true })
const auth = defineModel<RequestAuth>('auth', { required: true })
const headers = defineModel<string>('headers', { required: true })
const headerEntries = defineModel<RequestEntry[] | undefined>('headerEntries', { required: true })
const params = defineModel<RequestEntry[]>('params', { required: true })
const body = defineModel<string>('body', { required: true })
const bodyMode = defineModel<BodyMode>('bodyMode', { required: true })
const formFields = defineModel<FormField[]>('formFields', { required: true })
const fileFieldName = defineModel<string>('fileFieldName', { required: true })

const activeTab = ref('params')
const tabs = [
  { id: 'params', label: 'Params' },
  { id: 'authorization', label: 'Authorization' },
  { id: 'headers', label: 'Headers' },
  { id: 'body', label: 'Body' },
  { id: 'pre-request', label: 'Pre-request Script' },
  { id: 'tests', label: 'Tests' },
  { id: 'settings', label: 'Settings' },
]
</script>

<template>
  <section class="min-w-0 border border-border rounded-lg bg-panel text-primary" aria-label="Request builder">
    <div class="flex flex-wrap items-center gap-2 border-b border-border p-3">
      <select v-model="method" class="ui-control font-code font-bold" aria-label="HTTP method">
        <option>GET</option>
        <option>POST</option>
        <option>PUT</option>
        <option>PATCH</option>
        <option>DELETE</option>
        <option>HEAD</option>
        <option>OPTIONS</option>
      </select>
      <input v-model="url" class="ui-control min-w-48 flex-1 font-code" aria-label="Request URL" placeholder="https://api.example.com/v1/resources" @keyup.enter="!sending && emit('send')">
      <button class="focus-ring rounded-md border border-accent bg-accent px-4 py-2 text-sm text-white font-semibold disabled:cursor-wait disabled:opacity-60" type="button" :disabled="sending" @click="emit('send')">
        {{ sending ? 'Sending...' : 'Send' }}
      </button>
      <button class="focus-ring rounded-md border border-border bg-elevated px-3 py-2 text-sm font-semibold hover:bg-panel" type="button" @click="emit('save')">
        Save
      </button>
      <UiMenu label="Request actions" :items="[{ id: 'new', label: 'New request' }]" @select="emit('newRequest')" />
    </div>

    <div class="overflow-x-auto px-3">
      <UiTabs v-model="activeTab" :tabs="tabs" />
    </div>

    <div class="min-h-48 p-4">
      <div v-show="activeTab === 'params'" class="grid gap-3">
        <h2 class="m-0 text-sm font-semibold">
          Query parameters
        </h2>
        <p class="m-0 text-sm text-secondary">
          Enabled parameters are included in the URL. Values can use collection or environment variables.
        </p>
        <RequestEntryTable v-model="params" kind="parameter" />
      </div>

      <AuthFields v-show="activeTab === 'authorization'" v-model="auth" inherit />

      <div v-show="activeTab === 'headers'" class="grid gap-3">
        <h2 class="m-0 text-sm font-semibold">
          Headers
        </h2>
        <p class="m-0 text-sm text-secondary">
          Enabled headers are sent with the request. Keys and values can use variables.
        </p>
        <RequestEntryTable v-if="headerEntries" v-model="headerEntries" kind="header" />
        <label v-else class="grid gap-2 text-sm font-semibold">
          Correct the invalid headers JSON to edit it as a table.
          <textarea v-model="headers" class="ui-control min-h-52 resize-y font-code" spellcheck="false" />
        </label>
      </div>

      <div v-show="activeTab === 'body'" class="grid gap-4">
        <label class="grid max-w-sm gap-2 text-sm font-semibold">
          Body type
          <select v-model="bodyMode" class="ui-control">
            <option value="raw">Raw body</option>
            <option value="form-data">Multipart form-data</option>
          </select>
        </label>
        <label v-show="bodyMode === 'raw'" class="grid gap-2 text-sm font-semibold">
          Body
          <textarea v-model="body" class="ui-control min-h-52 resize-y font-code" spellcheck="false" placeholder="{&quot;example&quot;: true}" />
        </label>
        <div v-show="bodyMode === 'form-data'" class="grid gap-3">
          <div v-for="(field, index) in formFields" :key="index" class="grid gap-2 sm:grid-cols-2">
            <input v-model="field.key" class="ui-control" aria-label="Form field name" placeholder="Field name">
            <input v-model="field.value" class="ui-control" aria-label="Form field value" placeholder="Value">
          </div>
          <button class="focus-ring w-fit rounded-md border border-border bg-elevated px-3 py-2 text-sm font-semibold" type="button" @click="emit('addFormField')">
            Add form field
          </button>
          <label class="grid max-w-sm gap-2 text-sm font-semibold">
            File field name
            <input v-model="fileFieldName" class="ui-control" placeholder="file">
          </label>
          <label class="grid gap-2 text-sm font-semibold">
            Files
            <input class="ui-control" type="file" multiple @change="emit('filesChanged', $event)">
          </label>
          <p v-if="attachedFileCount" class="m-0 text-sm text-secondary">
            {{ attachedFileCount }} file(s) ready to upload.
          </p>
        </div>
      </div>

      <p v-show="activeTab === 'pre-request'" class="m-0 text-sm text-secondary">
        Request pre-request scripts will be available when script execution is added.
      </p>
      <p v-show="activeTab === 'tests'" class="m-0 text-sm text-secondary">
        Request test scripts and results will be available when script execution is added.
      </p>

      <div v-show="activeTab === 'settings'" class="grid max-w-sm gap-4">
        <label class="grid gap-2 text-sm font-semibold">
          Environment
          <select v-model="environmentId" class="ui-control">
            <option :value="undefined">No environment</option>
            <option v-for="environment in environments" :key="environment.id" :value="environment.id">
              {{ environment.name }}
            </option>
          </select>
        </label>
        <label v-if="hasCollection" class="grid gap-2 text-sm font-semibold">
          Folder
          <select v-model="folderId" class="ui-control">
            <option :value="undefined">No folder</option>
            <option v-for="folder in folders" :key="folder.id" :value="folder.id">
              {{ folder.name }}
            </option>
          </select>
        </label>
        <p class="m-0 text-sm text-secondary">
          Request-specific execution settings will be available in a later update.
        </p>
      </div>
      <p v-if="error" class="mb-0 text-sm text-danger" role="alert">
        {{ error }}
      </p>
    </div>
  </section>
</template>

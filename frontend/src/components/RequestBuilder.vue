<script setup lang="ts">
import type { Environment, FormField, RequestAuth } from '~/logic/api'
import type { BodyMode, RequestEntry, StoredFolder } from '~/types/workspace'
import { validateJsonBody } from '~/logic/request-body'

defineProps<{
  environments: Environment[]
  folders: StoredFolder[]
  hasCollection: boolean
  sending: boolean
  error: string
  attachedFileCount: number
  binaryFileName?: string
  missingMultipartFiles: boolean
}>()

const emit = defineEmits<{
  send: []
  save: []
  newRequest: []
  addFormField: []
  filesChanged: [event: Event]
  binaryChanged: [event: Event]
  clearFiles: []
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
const urlEncodedFields = defineModel<RequestEntry[]>('urlEncodedFields', { required: true })

const activeTab = ref('params')
const jsonError = ref('')
const multipartInput = ref<HTMLInputElement>()
function clearMultipartFiles(): void {
  if (multipartInput.value) {
    multipartInput.value.value = ''
  }
  emit('clearFiles')
}
function formatJson(): void {
  try {
    body.value = JSON.stringify(JSON.parse(body.value), null, 2)
    jsonError.value = ''
  }
  catch {
    jsonError.value = 'Cannot format invalid JSON. Resolve variable placeholders before formatting.'
  }
}
const jsonValidation = computed(() => bodyMode.value === 'json' && body.value ? validateJsonBody(body.value) : undefined)
watch(body, () => {
  jsonError.value = ''
})
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
            <option value="none">None</option>
            <option value="raw">Raw body</option>
            <option value="json">JSON</option>
            <option value="xml">XML</option>
            <option value="text">Text</option>
            <option value="html">HTML</option>
            <option value="javascript">JavaScript</option>
            <option value="form-data">Multipart form-data</option>
            <option value="urlencoded">URL encoded</option>
            <option value="binary">Binary</option>
          </select>
        </label>
        <label v-show="['raw', 'json', 'xml', 'text', 'html', 'javascript'].includes(bodyMode)" class="grid gap-2 text-sm font-semibold">
          Body
          <textarea v-model="body" class="ui-control min-h-52 resize-y font-code" spellcheck="false" placeholder="{&quot;example&quot;: true}" />
        </label>
        <template v-if="bodyMode === 'json'">
          <button class="focus-ring w-fit rounded-md border border-border bg-elevated px-3 py-2 text-sm font-semibold" type="button" @click="formatJson">
            Format JSON
          </button>
          <p v-if="jsonError || jsonValidation" class="m-0 text-sm text-danger" role="status">
            {{ jsonError || `${jsonValidation} Variable placeholders are resolved when sending.` }}
          </p>
        </template>
        <div v-if="bodyMode === 'urlencoded'" class="grid gap-3">
          <p class="m-0 text-sm text-secondary">
            Enabled fields are encoded after variable substitution.
          </p>
          <RequestEntryTable v-model="urlEncodedFields" kind="form field" />
        </div>
        <div v-if="bodyMode === 'binary'" class="grid gap-3">
          <label class="grid gap-2 text-sm font-semibold">
            Binary file
            <input class="ui-control" type="file" @change="emit('binaryChanged', $event)">
          </label>
          <p class="m-0 text-sm text-secondary">
            {{ binaryFileName ? `Selected: ${binaryFileName}` : 'Select a file before sending.' }} Files are not saved and must be reselected after reloading.
          </p>
        </div>
        <div v-show="bodyMode === 'form-data'" class="grid gap-3">
          <div class="overflow-x-auto">
            <table class="w-full min-w-[30rem] border-collapse text-left text-sm">
              <thead class="text-secondary">
                <tr>
                  <th class="p-2">
                    Key
                  </th><th class="p-2">
                    Value
                  </th><th class="p-2">
                    <span class="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(field, index) in formFields" :key="index" class="border-t border-border">
                  <td class="p-1">
                    <input v-model="field.key" class="ui-control box-border w-full" :aria-label="`Form field name ${index + 1}`" placeholder="Field name">
                  </td>
                  <td class="p-1">
                    <input v-model="field.value" class="ui-control box-border w-full" :aria-label="`Form field value ${index + 1}`" placeholder="Value">
                  </td>
                  <td class="p-1">
                    <UiIconButton :label="`Remove form field ${index + 1}`" type="button" @click="formFields = formFields.filter((_, i) => i !== index)">
                      ×
                    </UiIconButton>
                  </td>
                </tr>
              </tbody>
            </table>
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
            <input ref="multipartInput" class="ui-control" type="file" multiple @change="emit('filesChanged', $event)">
          </label>
          <p v-if="attachedFileCount" class="m-0 text-sm text-secondary">
            {{ attachedFileCount }} file(s) ready to upload.
          </p>
          <p v-if="missingMultipartFiles" class="m-0 text-sm text-danger" role="status">
            Reselect the saved files or clear them before sending.
          </p>
          <button v-if="attachedFileCount || missingMultipartFiles" class="focus-ring w-fit rounded-md border border-border bg-elevated px-3 py-2 text-sm font-semibold" type="button" @click="clearMultipartFiles">
            Clear files
          </button>
          <p class="m-0 text-sm text-secondary">
            Files are not saved and must be reselected after reloading.
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

<script setup lang="ts">
import type { RequestAuth } from '~/logic/api'

defineProps<{ inherit?: boolean }>()
const auth = defineModel<RequestAuth>({ required: true })

function update(changes: Partial<RequestAuth>): void {
  auth.value = { ...auth.value, ...changes }
}
</script>

<template>
  <div class="grid max-w-xl gap-4">
    <label class="grid gap-2 text-sm font-semibold">
      Authentication
      <select :value="auth.type" class="ui-control" @change="auth = { type: ($event.target as HTMLSelectElement).value as RequestAuth['type'] }">
        <option value="none">{{ inherit ? 'Use collection authentication' : 'No authentication' }}</option>
        <option value="bearer">Bearer token</option>
        <option value="basic">Basic auth</option>
        <option value="api-key">API key</option>
        <option value="oauth2">OAuth 2.0 (client credentials)</option>
      </select>
    </label>
    <label v-if="auth.type === 'bearer'" class="grid gap-2 text-sm font-semibold">
      Bearer token
      <input :value="auth.token" class="ui-control font-code" type="password" placeholder="{{ACCESS_TOKEN}}" @input="update({ token: ($event.target as HTMLInputElement).value })">
    </label>
    <template v-if="auth.type === 'basic'">
      <label class="grid gap-2 text-sm font-semibold">
        Username
        <input :value="auth.username" class="ui-control" autocomplete="username" @input="update({ username: ($event.target as HTMLInputElement).value })">
      </label>
      <label class="grid gap-2 text-sm font-semibold">
        Password
        <input :value="auth.password" class="ui-control" type="password" autocomplete="current-password" @input="update({ password: ($event.target as HTMLInputElement).value })">
      </label>
    </template>
    <template v-if="auth.type === 'api-key'">
      <label class="grid gap-2 text-sm font-semibold">
        Key name
        <input :value="auth.key" class="ui-control font-code" placeholder="X-API-Key" @input="update({ key: ($event.target as HTMLInputElement).value })">
      </label>
      <label class="grid gap-2 text-sm font-semibold">
        Key value
        <input :value="auth.value" class="ui-control font-code" type="password" placeholder="{{API_KEY}}" @input="update({ value: ($event.target as HTMLInputElement).value })">
      </label>
      <label class="grid gap-2 text-sm font-semibold">
        Add to
        <select :value="auth.location ?? 'header'" class="ui-control" @change="update({ location: ($event.target as HTMLSelectElement).value as 'header' | 'query' })">
          <option value="header">Header</option>
          <option value="query">Query parameter</option>
        </select>
      </label>
    </template>
    <template v-if="auth.type === 'oauth2'">
      <label class="grid gap-2 text-sm font-semibold">
        Token URL
        <input :value="auth.tokenUrl" class="ui-control font-code" placeholder="https://example.com/oauth/token" @input="update({ tokenUrl: ($event.target as HTMLInputElement).value })">
      </label>
      <label class="grid gap-2 text-sm font-semibold">
        Client ID
        <input :value="auth.clientId" class="ui-control font-code" placeholder="{{CLIENT_ID}}" @input="update({ clientId: ($event.target as HTMLInputElement).value })">
      </label>
      <label class="grid gap-2 text-sm font-semibold">
        Client secret
        <input :value="auth.clientSecret" class="ui-control font-code" type="password" placeholder="{{CLIENT_SECRET}}" @input="update({ clientSecret: ($event.target as HTMLInputElement).value })">
      </label>
      <label class="grid gap-2 text-sm font-semibold">
        Scope (optional)
        <input :value="auth.scope" class="ui-control font-code" placeholder="read write" @input="update({ scope: ($event.target as HTMLInputElement).value })">
      </label>
      <label class="grid gap-2 text-sm font-semibold">
        Client authentication
        <select :value="auth.clientAuthentication ?? 'basic'" class="ui-control" @change="update({ clientAuthentication: ($event.target as HTMLSelectElement).value as 'basic' | 'body' })">
          <option value="basic">HTTP Basic</option>
          <option value="body">Request body</option>
        </select>
      </label>
      <p class="m-0 text-sm text-secondary">
        A new access token is requested when sending. Browser execution requires CORS access to the token endpoint.
      </p>
    </template>
    <p v-if="auth.type !== 'none'" class="m-0 text-sm text-secondary">
      Saved credentials are included in collection backups. Use environment variables for secrets.
    </p>
  </div>
</template>

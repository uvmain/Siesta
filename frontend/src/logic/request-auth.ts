import type { RequestAuth } from './api'

function basicCredentials(username: string, password: string): string {
  const bytes = new TextEncoder().encode(`${username}:${password}`)
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''))
}

function formEncode(value: string): string {
  return new URLSearchParams({ v: value }).toString().slice(2)
}

export async function applyRequestAuth(
  auth: RequestAuth,
  url: URL,
  headers: Record<string, string>,
  resolve: (value: string) => string,
): Promise<void> {
  const hasHeader = (name: string) => Object.keys(headers).some(key => key.toLowerCase() === name.toLowerCase())
  if (auth.type === 'api-key') {
    const key = resolve(auth.key ?? '')
    const value = resolve(auth.value ?? '')
    if (!key || !value) {
      throw new Error('API key name and value are required')
    }
    if (auth.location === 'query') {
      if (!url.searchParams.has(key)) {
        url.searchParams.append(key, value)
      }
    }
    else if (!hasHeader(key)) {
      headers[key] = value
    }
    return
  }
  if (hasHeader('authorization')) {
    return
  }
  if (auth.type === 'bearer' && auth.token) {
    headers.Authorization = `Bearer ${resolve(auth.token)}`
  }
  else if (auth.type === 'basic' && auth.username !== undefined && auth.password !== undefined) {
    headers.Authorization = `Basic ${basicCredentials(resolve(auth.username), resolve(auth.password))}`
  }
  else if (auth.type === 'oauth2') {
    const clientId = resolve(auth.clientId ?? '')
    const clientSecret = resolve(auth.clientSecret ?? '')
    let tokenUrl: URL
    try {
      tokenUrl = new URL(resolve(auth.tokenUrl ?? ''))
      if (!['http:', 'https:'].includes(tokenUrl.protocol) || tokenUrl.username || tokenUrl.password || !clientId || !clientSecret) {
        throw new Error('Invalid credentials')
      }
    }
    catch {
      throw new Error('OAuth token URL and client credentials are invalid')
    }
    const body = new URLSearchParams({ grant_type: 'client_credentials' })
    const scope = resolve(auth.scope ?? '')
    if (scope) {
      body.set('scope', scope)
    }
    const tokenHeaders: Record<string, string> = { 'Content-Type': 'application/x-www-form-urlencoded' }
    if (auth.clientAuthentication === 'body') {
      body.set('client_id', clientId)
      body.set('client_secret', clientSecret)
    }
    else {
      tokenHeaders.Authorization = `Basic ${basicCredentials(formEncode(clientId), formEncode(clientSecret))}`
    }
    try {
      const response = await fetch(tokenUrl, { method: 'POST', headers: tokenHeaders, body, redirect: 'error', signal: AbortSignal.timeout(30_000) })
      if (!response.ok) {
        throw new Error('Token endpoint rejected request')
      }
      const data: unknown = await response.json()
      if (!data || typeof data !== 'object' || !('access_token' in data) || typeof data.access_token !== 'string' || !/^[\w.~+/-]+=*$/.test(data.access_token)
        || ('token_type' in data && (typeof data.token_type !== 'string' || data.token_type.toLowerCase() !== 'bearer'))) {
        throw new Error('Invalid token response')
      }
      headers.Authorization = `Bearer ${data.access_token}`
    }
    catch {
      throw new Error('OAuth token request failed')
    }
  }
}

import assert from 'node:assert/strict'
import { Buffer } from 'node:buffer'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import { createServer } from 'node:http'
import os from 'node:os'
import path from 'node:path'
// This project uses the built-in Node test runner rather than Vitest.
/* eslint-disable test/no-import-node-test */
import { after, before, test } from 'node:test'

const databasePath = path.join(os.tmpdir(), `siesta-test-${randomUUID()}.db`)
process.env.AUTH_USERNAME = 'test-user'
process.env.AUTH_PASSWORD = 'test-password'
process.env.DB_PATH = databasePath

const { createApp } = await import('../src/app.js')
const { closeDatabase } = await import('../src/core/database.js')

let app: Awaited<ReturnType<typeof createApp>>
let sessionCookie = ''
let collectionId = 0
let upstreamUrl = ''
let receivedAuthorization: string | undefined
let receivedKey: string | undefined
let receivedUrl = ''
let tokenCalls = 0
let tokenBody = ''
let tokenAuthorization: string | undefined
const upstream = createServer((request, response) => {
  if (request.url?.startsWith('/token')) {
    tokenCalls++
    tokenAuthorization = request.headers.authorization
    let data = ''
    request.setEncoding('utf8')
    request.on('data', chunk => data += chunk)
    request.on('end', () => {
      tokenBody = data
      if (request.url === '/token-redirect') {
        response.writeHead(302, { Location: `${upstreamUrl}/token` }).end()
      }
      else if (request.url === '/token-fail') {
        response.writeHead(401).end('sensitive response')
      }
      else {
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ access_token: 'fresh-token', token_type: 'Bearer' }))
      }
    })
    return
  }
  receivedAuthorization = request.headers.authorization
  receivedKey = request.headers['x-api-key'] as string | undefined
  receivedUrl = request.url ?? ''
  response.writeHead(204).end()
})

before(async () => {
  app = await createApp()
  await new Promise<void>((resolve, reject) => {
    upstream.once('error', reject)
    upstream.listen(0, '127.0.0.1', () => {
      const address = upstream.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Unable to determine upstream server address'))
        return
      }
      upstreamUrl = `http://127.0.0.1:${address.port}`
      resolve()
    })
  })
})

after(async () => {
  closeDatabase()
  await new Promise<void>((resolve, reject) => upstream.close(error => error ? reject(error) : resolve()))
  for (const suffix of ['', '-shm', '-wal']) {
    fs.rmSync(`${databasePath}${suffix}`, { force: true })
  }
})

async function request(pathname: string, init?: RequestInit): Promise<Response> {
  return app.request(`http://localhost${pathname}`, init)
}

test('protects API endpoints without a session', async () => {
  const response = await request('/api/collections')
  assert.equal(response.status, 401)
})

test('creates a session with configured credentials', async () => {
  const response = await request('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'test-user', password: 'test-password' }),
  })

  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { username: 'test-user' })
  sessionCookie = response.headers.get('set-cookie')?.split(';')[0] ?? ''
  assert.ok(sessionCookie)
})

test('persists collections and exposes them through backups', async () => {
  const collectionResponse = await request('/api/collections', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie },
    body: JSON.stringify({
      name: 'Test collection',
      contents: {
        executionMode: 'backend',
        folders: [],
        requests: [],
        variables: { BASE_URL: 'https://api.example.test' },
      },
    }),
  })

  assert.equal(collectionResponse.status, 201)
  collectionId = (await collectionResponse.json() as { id: number }).id

  const backupResponse = await request('/api/backups', {
    headers: { Cookie: sessionCookie },
  })
  assert.equal(backupResponse.status, 200)
  const backup = await backupResponse.json() as { version: number, collections: Array<{ name: string, contents: string }> }
  assert.equal(backup.version, 1)
  assert.equal(backup.collections[0].name, 'Test collection')
  assert.deepEqual(JSON.parse(backup.collections[0].contents), {
    executionMode: 'backend',
    folders: [],
    requests: [],
    variables: { BASE_URL: 'https://api.example.test' },
  })
})

test('uses collection bearer auth when a backend request has no request auth', async () => {
  const updateResponse = await request(`/api/collections/${collectionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie },
    body: JSON.stringify({
      name: 'Test collection',
      contents: {
        executionMode: 'backend',
        folders: [],
        requests: [],
        variables: { TOKEN: 'collection-token' },
        auth: { type: 'bearer', token: '{{TOKEN}}' },
      },
    }),
  })
  assert.equal(updateResponse.status, 200)

  const response = await request('/api/requests/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie },
    body: JSON.stringify({
      method: 'GET',
      url: upstreamUrl,
      collectionId,
      auth: { type: 'none' },
    }),
  })

  assert.equal(response.status, 200)
  assert.equal((await response.json() as { status: number }).status, 204)
  assert.equal(receivedAuthorization, 'Bearer collection-token')
})

test('rejects invalid backend request URLs', async () => {
  const response = await request('/api/requests/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie },
    body: JSON.stringify({ method: 'GET', url: 'not-a-url' }),
  })
  assert.equal(response.status, 400)
  assert.deepEqual(await response.json(), { error: 'url must be an absolute URL' })
})

async function sendBackend(body: Record<string, unknown>): Promise<Response> {
  return request('/api/requests/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie },
    body: JSON.stringify({ method: 'GET', url: `${upstreamUrl}/resource`, ...body }),
  })
}

test('inherits API key auth and preserves explicit header and query values', async () => {
  const update = await request(`/api/collections/${collectionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie },
    body: JSON.stringify({ name: 'Test collection', contents: {
      executionMode: 'backend',
      requests: [],
      variables: { KEY: 'collection key & value' },
      auth: { type: 'api-key', key: 'X-API-Key', value: '{{KEY}}', location: 'header' },
    } }),
  })
  assert.equal(update.status, 200)
  assert.equal((await sendBackend({ collectionId, auth: { type: 'none' } })).status, 200)
  assert.equal(receivedKey, 'collection key & value')
  await sendBackend({ collectionId, headers: { 'x-api-key': 'manual' } })
  assert.equal(receivedKey, 'manual')
  const auth = { type: 'api-key', key: 'api key', value: '{{KEY}}', location: 'query' }
  await sendBackend({ collectionId, auth, url: `${upstreamUrl}/resource#fragment` })
  assert.equal(new URL(receivedUrl, upstreamUrl).searchParams.get('api key'), 'collection key & value')
  await sendBackend({ collectionId, auth, url: `${upstreamUrl}/resource?api%20key=manual` })
  assert.deepEqual(new URL(receivedUrl, upstreamUrl).searchParams.getAll('api key'), ['manual'])
})

test('obtains OAuth tokens with both client authentication methods and respects explicit authorization', async () => {
  const auth = { type: 'oauth2', tokenUrl: `${upstreamUrl}/token`, clientId: 'client:id', clientSecret: 's & e', scope: 'read write' }
  assert.equal((await sendBackend({ auth })).status, 200)
  assert.equal(receivedAuthorization, 'Bearer fresh-token')
  assert.equal(tokenAuthorization, `Basic ${Buffer.from('client%3Aid:s+%26+e').toString('base64')}`)
  assert.equal(new URLSearchParams(tokenBody).get('scope'), 'read write')
  assert.equal(new URLSearchParams(tokenBody).get('grant_type'), 'client_credentials')
  assert.equal((await sendBackend({ auth: { ...auth, clientAuthentication: 'body' } })).status, 200)
  assert.equal(tokenAuthorization, undefined)
  assert.equal(new URLSearchParams(tokenBody).get('client_id'), 'client:id')
  assert.equal(new URLSearchParams(tokenBody).get('client_secret'), 's & e')
  const previousCalls = tokenCalls
  await sendBackend({ auth, headers: { authorization: 'manual' } })
  assert.equal(receivedAuthorization, 'manual')
  assert.equal(tokenCalls, previousCalls)
})

test('rejects OAuth redirects and sanitizes token endpoint failures', async () => {
  for (const endpoint of ['token-redirect', 'token-fail']) {
    const previousCalls = tokenCalls
    const response = await sendBackend({ auth: { type: 'oauth2', tokenUrl: `${upstreamUrl}/${endpoint}`, clientId: 'id', clientSecret: 'sensitive secret' } })
    assert.equal(response.status, 502)
    assert.deepEqual(await response.json(), { error: 'Request failed: OAuth token request failed' })
    assert.equal(tokenCalls, previousCalls + 1)
  }
})

test('inherits OAuth and resolves environment variables before collection variables', async () => {
  const environment = await request('/api/environments', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie },
    body: JSON.stringify({ name: 'OAuth environment', values: { SECRET: 'environment secret', TOKEN_URL: `${upstreamUrl}/token` }, secretKeys: ['SECRET'] }),
  })
  assert.equal(environment.status, 201)
  const environmentId = (await environment.json() as { id: number }).id
  const collection = await request(`/api/collections/${collectionId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Cookie': sessionCookie },
    body: JSON.stringify({ name: 'Test collection', contents: {
      executionMode: 'backend',
      requests: [],
      variables: { SECRET: 'collection secret', CLIENT: 'client' },
      auth: { type: 'oauth2', tokenUrl: '{{TOKEN_URL}}', clientId: '{{CLIENT}}', clientSecret: '{{SECRET}}', clientAuthentication: 'body' },
    } }),
  })
  assert.equal(collection.status, 200)
  assert.equal((await sendBackend({ collectionId, environmentId, auth: { type: 'none' } })).status, 200)
  assert.equal(receivedAuthorization, 'Bearer fresh-token')
  assert.equal(new URLSearchParams(tokenBody).get('client_id'), 'client')
  assert.equal(new URLSearchParams(tokenBody).get('client_secret'), 'environment secret')
})

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
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

before(async () => {
  app = await createApp()
})

after(() => {
  closeDatabase()
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
      contents: { executionMode: 'backend', folders: [], requests: [] },
    }),
  })

  assert.equal(collectionResponse.status, 201)

  const backupResponse = await request('/api/backups', {
    headers: { Cookie: sessionCookie },
  })
  assert.equal(backupResponse.status, 200)
  const backup = await backupResponse.json() as { version: number, collections: Array<{ name: string }> }
  assert.equal(backup.version, 1)
  assert.equal(backup.collections[0].name, 'Test collection')
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

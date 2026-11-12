import assert from 'node:assert/strict'
/* eslint-disable test/no-import-node-test */
import { test } from 'node:test'
import { applyRequestAuth } from '../src/logic/request-auth'

const resolve = (value: string) => value.replace('{{SECRET}}', 'a & b')

test('adds API keys to headers or encoded query parameters without overriding explicit values', async () => {
  const url = new URL('https://example.test/?existing=1#fragment')
  const headers: Record<string, string> = { 'x-key': 'manual' }
  await applyRequestAuth({ type: 'api-key', key: 'X-Key', value: '{{SECRET}}' }, url, headers, resolve)
  assert.equal(headers['x-key'], 'manual')
  await applyRequestAuth({ type: 'api-key', key: 'api key', value: '{{SECRET}}', location: 'query' }, url, headers, resolve)
  assert.equal(url.searchParams.get('api key'), 'a & b')
  assert.equal(url.hash, '#fragment')
  await applyRequestAuth({ type: 'api-key', key: 'api key', value: 'other', location: 'query' }, url, headers, resolve)
  assert.equal(url.searchParams.getAll('api key').length, 1)
})

test('requests an OAuth token using encoded basic credentials and avoids acquisition for explicit authorization', async () => {
  const originalFetch = globalThis.fetch
  let calls = 0
  globalThis.fetch = async (_url, init) => {
    calls++
    assert.equal(init?.redirect, 'error')
    assert.equal((init?.headers as Record<string, string>).Authorization, `Basic ${btoa('user%3Aname:a+%26+b')}`)
    assert.equal((init?.body as URLSearchParams).get('scope'), 'read')
    return Response.json({ access_token: 'fresh-token', token_type: 'Bearer' })
  }
  try {
    const auth = { type: 'oauth2' as const, tokenUrl: 'https://example.test/token', clientId: 'user:name', clientSecret: '{{SECRET}}', scope: 'read' }
    const headers: Record<string, string> = {}
    await applyRequestAuth(auth, new URL('https://example.test'), headers, resolve)
    assert.equal(headers.Authorization, 'Bearer fresh-token')
    await applyRequestAuth(auth, new URL('https://example.test'), { authorization: 'manual' }, resolve)
    assert.equal(calls, 1)
  }
  finally {
    globalThis.fetch = originalFetch
  }
})

test('sanitizes token errors and rejects invalid responses', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => Response.json({ error: 'secret from server' }, { status: 401 })
  const auth = { type: 'oauth2' as const, tokenUrl: 'https://example.test/token', clientId: 'id', clientSecret: 'secret' }
  try {
    await assert.rejects(applyRequestAuth(auth, new URL('https://example.test'), {}, resolve), { message: 'OAuth token request failed' })
    globalThis.fetch = async () => Response.json({ access_token: 'bad\r\nheader' })
    await assert.rejects(applyRequestAuth(auth, new URL('https://example.test'), {}, resolve), { message: 'OAuth token request failed' })
  }
  finally {
    globalThis.fetch = originalFetch
  }
})

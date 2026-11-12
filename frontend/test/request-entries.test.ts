import assert from 'node:assert/strict'
/* eslint-disable test/no-import-node-test */
import { test } from 'node:test'
import { headersFromEntries, parseHeaderEntries, parseQueryEntries, syncQueryEntries, urlWithQueryEntries } from '../src/logic/request-entries'

test('query table round-trips duplicates, variables, flags and fragments', () => {
  const entries = parseQueryEntries('https://example.test/path?a=1&a=2&token={{TOKEN}}&flag#section')
  assert.deepEqual(entries.map(entry => [entry.key, entry.value]), [
    ['a', '1'],
    ['a', '2'],
    ['token', '{{TOKEN}}'],
    ['flag', ''],
  ])
  entries[0].enabled = false
  entries[1].value = 'a & b'
  assert.equal(urlWithQueryEntries('https://example.test/path?a=1#section', entries), 'https://example.test/path?a=a%20%26%20b&token={{TOKEN}}&flag#section')
})

test('manual URL edits keep disabled rows and matching descriptions', () => {
  const existing = parseQueryEntries('https://example.test/?one=1&two=2')
  existing[0].description = 'First'
  existing[1].enabled = false
  existing[1].description = 'Disabled'
  const synced = syncQueryEntries('https://example.test/?one=changed&three=3#part', existing)
  assert.deepEqual(synced.map(entry => [entry.key, entry.value, entry.description, entry.enabled]), [
    ['one', 'changed', 'First', true],
    ['three', '3', '', true],
    ['two', '2', 'Disabled', false],
  ])
  assert.deepEqual(parseQueryEntries('https://example.test/#fragment?not=query'), [])
})

test('descriptions and empty rows do not rewrite an unchanged URL', () => {
  const url = 'https://example.test/?q=hello+world&flag#part'
  const entries = parseQueryEntries(url)
  entries[0].description = 'Search'
  entries.push({ key: '', value: '', description: '', enabled: true })
  assert.equal(urlWithQueryEntries(url, entries), url)
})

test('header table omits disabled rows and rejects duplicate enabled names', () => {
  const rows = parseHeaderEntries('{"Accept":"application/json"}')
  assert.ok(rows)
  rows.push({ key: 'X-Token', value: '{{TOKEN}}', description: 'Disabled', enabled: false })
  assert.deepEqual(headersFromEntries(rows), { Accept: 'application/json' })
  rows.push({ key: 'accept', value: 'text/plain', description: '', enabled: true })
  assert.throws(() => headersFromEntries(rows), /Duplicate header/)
  assert.equal(parseHeaderEntries('{"bad":1}'), undefined)
})

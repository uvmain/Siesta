import assert from 'node:assert/strict'
/* eslint-disable test/no-import-node-test */
import { test } from 'node:test'
import { encodeFormFields, setBodyContentType, validateJsonBody } from '../src/logic/request-body'

test('encodes repeated form fields after variable resolution', () => {
  const result = encodeFormFields([
    { key: '{{NAME}}', value: 'a & b' },
    { key: '{{NAME}}', value: 'é=1' },
  ], value => value.replace('{{NAME}}', 'my key'))
  assert.equal(result, 'my+key=a+%26+b&my+key=%C3%A9%3D1')
})

test('sets content types without overriding explicit headers', () => {
  const headers: Record<string, string> = { 'content-type': 'custom/type' }
  setBodyContentType(headers, 'json')
  assert.deepEqual(headers, { 'content-type': 'custom/type' })
  const encoded: Record<string, string> = {}
  setBodyContentType(encoded, 'urlencoded')
  assert.equal(encoded['Content-Type'], 'application/x-www-form-urlencoded')
  setBodyContentType(encoded, 'none')
  assert.equal(encoded['Content-Type'], 'application/x-www-form-urlencoded')
})

test('validates JSON values and rejects malformed bodies', () => {
  assert.equal(validateJsonBody('{"ok":true}'), undefined)
  assert.equal(validateJsonBody('null'), undefined)
  assert.ok(validateJsonBody('{broken'))
})

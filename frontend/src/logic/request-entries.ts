import type { RequestEntry } from '../types/workspace'

export function newRequestEntry(): RequestEntry {
  return { key: '', value: '', description: '', enabled: true }
}

function decodeQueryPart(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  }
  catch {
    return value
  }
}

function encodeQueryPart(value: string): string {
  return value.split(/(\{\{[a-z_]\w*\}\})/gi)
    .map(part => /^\{\{[a-z_]\w*\}\}$/i.test(part) ? part : encodeURIComponent(part))
    .join('')
}

function splitUrl(url: string): { base: string, query: string, fragment: string } {
  const hash = url.indexOf('#')
  const beforeFragment = hash < 0 ? url : url.slice(0, hash)
  const query = beforeFragment.indexOf('?')
  return {
    base: query < 0 ? beforeFragment : beforeFragment.slice(0, query),
    query: query < 0 ? '' : beforeFragment.slice(query + 1),
    fragment: hash < 0 ? '' : url.slice(hash),
  }
}

export function parseQueryEntries(url: string): RequestEntry[] {
  const { query } = splitUrl(url)
  if (!query) {
    return []
  }
  return query.split('&').filter(Boolean).map((part) => {
    const equals = part.indexOf('=')
    return {
      key: decodeQueryPart(equals < 0 ? part : part.slice(0, equals)),
      value: decodeQueryPart(equals < 0 ? '' : part.slice(equals + 1)),
      description: '',
      enabled: true,
      hasEquals: equals >= 0,
    }
  })
}

export function syncQueryEntries(url: string, existing: RequestEntry[]): RequestEntry[] {
  const parsed = parseQueryEntries(url)
  const previous = existing.filter(entry => entry.enabled)
  const used = new Set<number>()
  const enabled = parsed.map((entry, index) => {
    let match = previous.findIndex((item, i) => !used.has(i) && item.key === entry.key && item.value === entry.value)
    if (match < 0 && index < previous.length && !used.has(index)) {
      match = index
    }
    if (match < 0) {
      return entry
    }
    used.add(match)
    return { ...entry, description: previous[match].description }
  })
  return [...enabled, ...existing.filter(entry => !entry.enabled)]
}

export function urlWithQueryEntries(url: string, entries: RequestEntry[]): string {
  const { base, fragment } = splitUrl(url)
  const enabled = entries.filter(entry => entry.enabled && (entry.key || entry.value))
  const current = parseQueryEntries(url)
  if (current.length === enabled.length && current.every((entry, index) =>
    entry.key === enabled[index].key
    && entry.value === enabled[index].value
    && (entry.hasEquals !== false) === (enabled[index].hasEquals !== false || Boolean(enabled[index].value)))) {
    return url
  }
  const query = enabled
    .map((entry) => {
      const key = encodeQueryPart(entry.key)
      const value = encodeQueryPart(entry.value)
      return entry.hasEquals === false && !entry.value ? key : `${key}=${value}`
    })
    .join('&')
  return `${base}${query ? `?${query}` : ''}${fragment}`
}

export function parseHeaderEntries(headers: string): RequestEntry[] | undefined {
  try {
    const parsed: unknown = JSON.parse(headers)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !Object.values(parsed).every(value => typeof value === 'string')) {
      return undefined
    }
    return Object.entries(parsed).map(([key, value]) => ({ key, value: value as string, description: '', enabled: true }))
  }
  catch {
    return undefined
  }
}

export function headersFromEntries(entries: RequestEntry[]): Record<string, string> {
  const names = new Set<string>()
  const result: Record<string, string> = {}
  for (const entry of entries) {
    if (!entry.enabled || (!entry.key.trim() && !entry.value)) {
      continue
    }
    const key = entry.key.trim()
    if (!key) {
      throw new Error('Enabled headers must have a name.')
    }
    if (names.has(key.toLowerCase())) {
      throw new Error(`Duplicate header: ${key}`)
    }
    names.add(key.toLowerCase())
    Object.defineProperty(result, key, { value: entry.value, enumerable: true, configurable: true, writable: true })
  }
  return result
}

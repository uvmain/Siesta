import type { BodyMode, RequestEntry } from '../types/workspace'

const contentTypes: Partial<Record<BodyMode, string>> = {
  json: 'application/json',
  xml: 'application/xml',
  text: 'text/plain',
  html: 'text/html',
  javascript: 'application/javascript',
  urlencoded: 'application/x-www-form-urlencoded',
  binary: 'application/octet-stream',
}

export function setBodyContentType(headers: Record<string, string>, mode: BodyMode): void {
  const contentType = contentTypes[mode]
  if (contentType && !Object.keys(headers).some(key => key.toLowerCase() === 'content-type')) {
    headers['Content-Type'] = contentType
  }
}

export function encodeFormFields(fields: Array<Pick<RequestEntry, 'key' | 'value'>>, resolve: (value: string) => string): string {
  const params = new URLSearchParams()
  for (const field of fields) {
    params.append(resolve(field.key), resolve(field.value))
  }
  return params.toString()
}

export function validateJsonBody(body: string): string | undefined {
  try {
    JSON.parse(body)
    return undefined
  }
  catch {
    return 'Body is not valid JSON.'
  }
}

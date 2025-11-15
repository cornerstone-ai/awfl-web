import { getCookie } from '../utils/cookies'

export type ApiClientOptions = {
  idToken?: string
  skipAuth?: boolean
  baseUrl?: string
}

export type RequestOptions = {
  signal?: AbortSignal
  // When true, omit x-project-id header for user-scoped operations (e.g., user credentials)
  noProjectHeader?: boolean
  // Optional per-request extra headers (e.g., x-consumer-id)
  extraHeaders?: Record<string, string>
}

// Determine default API base from environment. In dev, leave empty to use Vite proxy (/api).
export const DEFAULT_API_BASE: string = (import.meta as any)?.env?.VITE_API_BASE || '/api'

export function buildHeaders(opts: ApiClientOptions, ropts?: RequestOptions) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (opts.idToken) headers['Authorization'] = `Bearer ${opts.idToken}`
  if (opts.skipAuth) headers['X-Skip-Auth'] = '1'
  if (!ropts?.noProjectHeader) {
    headers['x-project-id'] = getCookie('awfl.projectId') || ''
  }
  // Merge extra per-request headers last to allow overrides
  if (ropts?.extraHeaders) {
    for (const [k, v] of Object.entries(ropts.extraHeaders)) {
      if (v != null) headers[k] = String(v)
    }
  }
  return headers
}

async function sendJsonInternal(
  path: string,
  body: any,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
  opts: ApiClientOptions,
  ropts?: RequestOptions,
  allowBodyOnDelete?: boolean
) {
  const base = opts.baseUrl ?? DEFAULT_API_BASE
  const url = (base || '') + path
  const init: RequestInit = {
    method,
    headers: buildHeaders(opts, ropts),
    signal: ropts?.signal,
  }
  if (
    (method !== 'GET' && method !== 'DELETE') ||
    (method === 'DELETE' && allowBodyOnDelete)
  ) {
    // Authorization header is used; do not include userAuthToken in body
    init.body = JSON.stringify(body || {})
  }
  const res = await fetch(url, init)
  const ct = res.headers.get('content-type') || ''
  const text = await res.text()
  let json: any
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }
  // If server returned HTML (likely front-end index), surface as an error so callers can fallback.
  if (
    ct.includes('text/html') ||
    (typeof (json as any)?.raw === 'string' && /<\s*html/i.test((json as any).raw))
  ) {
    const msg = 'Unexpected HTML response'
    const err: any = new Error(msg)
    err.httpStatus = res.status
    err.details = { raw: (json as any)?.raw }
    throw err
  }
  if (!res.ok) {
    const msg =
      (json as any)?.error ||
      (json as any)?.message ||
      res.statusText ||
      'Request failed'
    const err: any = new Error(msg)
    err.httpStatus = res.status
    err.details = json
    throw err
  }
  return json
}

export async function postJson(path: string, body: any, opts: ApiClientOptions, ropts?: RequestOptions) {
  return await sendJsonInternal(path, body, 'POST', opts, ropts)
}

export async function patchJson(path: string, body: any, opts: ApiClientOptions, ropts?: RequestOptions) {
  return await sendJsonInternal(path, body, 'PATCH', opts, ropts)
}

export async function putJson(path: string, body: any, opts: ApiClientOptions, ropts?: RequestOptions) {
  return await sendJsonInternal(path, body, 'PUT', opts, ropts)
}

export async function deleteJson(path: string, opts: ApiClientOptions, ropts?: RequestOptions) {
  return await sendJsonInternal(path, undefined, 'DELETE', opts, ropts)
}

export async function deleteWithBodyJson(path: string, body: any, opts: ApiClientOptions, ropts?: RequestOptions) {
  // Specialized sender to support DELETE with JSON body
  return await sendJsonInternal(path, body, 'DELETE', opts, ropts, true)
}

export async function getJson(path: string, opts: ApiClientOptions, ropts?: RequestOptions) {
  return await sendJsonInternal(path, undefined, 'GET', opts, ropts)
}

export function normalizeTasksArray(json: any): any[] | null {
  if (!json) return null
  if (Array.isArray(json)) return json
  if (Array.isArray((json as any)?.tasks)) return (json as any).tasks
  if (Array.isArray((json as any)?.items)) return (json as any).items
  if (Array.isArray((json as any)?.data)) return (json as any).data
  if (Array.isArray((json as any)?.result)) return (json as any).result
  if (Array.isArray((json as any)?.records)) return (json as any).records
  return null
}

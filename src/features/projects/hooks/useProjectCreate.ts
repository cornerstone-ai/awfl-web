import { useCallback, useEffect, useRef, useState } from 'react'
import { makeApiClient } from '../../../api/apiClient'
import type { Project } from '../types/project'

export type UseProjectCreateParams = {
  idToken?: string | null
  enabled?: boolean
}

export type UseProjectCreateResult = {
  create: (input: { name: string; remote?: string | null; live?: boolean | null }) => Promise<Project | null>
  loading: boolean
  error: string | null
}

function mapAnyToProject(input: any): Project | null {
  if (!input) return null
  const id = input.id || input.projectId || input.key || input._id || input.uid
  if (!id || typeof id !== 'string') return null
  const name = input.name ?? input.title ?? null
  const remote = input.remote ?? input.repo ?? input.url ?? null
  return { id, name: name ?? null, remote: remote ?? null }
}

export function useProjectCreate(params: UseProjectCreateParams): UseProjectCreateResult {
  const { idToken, enabled = true } = params || {}
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef<AbortController | null>(null)
  const unmounted = useRef(false)

  useEffect(() => {
    return () => {
      unmounted.current = true
      try { inFlight.current?.abort() } catch {}
    }
  }, [])

  const create = useCallback(async (input: { name: string; remote?: string | null; live?: boolean | null }) => {
    setError(null)
    const skipAuth = (import.meta as any)?.env?.VITE_SKIP_AUTH === '1'
    if (!enabled || (!idToken && !skipAuth)) {
      setError('Not authorized')
      return null
    }
    const name = String(input?.name || '').trim()
    if (!name) {
      setError('Name is required')
      return null
    }

    const ac = new AbortController()
    inFlight.current?.abort()
    inFlight.current = ac
    setLoading(true)
    try {
      const client = makeApiClient({ idToken: idToken ?? undefined, skipAuth })
      const payload: any = { name }
      if (input?.remote != null && input.remote !== '') payload.remote = input.remote
      if (input?.live != null) payload.live = !!input.live
      const json: any = await client.projectsCreate(payload, { signal: ac.signal })
      // Accept either { project } or direct project object
      const projObj = (json && typeof json === 'object') ? (json.project && typeof json.project === 'object' ? json.project : json) : null
      const mapped = mapAnyToProject(projObj)
      return mapped
    } catch (e: any) {
      if (!unmounted.current) setError(e?.message || String(e))
      return null
    } finally {
      if (!unmounted.current) setLoading(false)
    }
  }, [idToken, enabled])

  return { create, loading, error }
}

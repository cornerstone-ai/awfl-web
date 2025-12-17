import { useCallback, useEffect, useMemo, useState } from 'react'
import { makeApiClient } from '../../../api/apiClient'

export type CredMeta = {
  id: string
  provider: string
  last4?: string
  updated?: string | number
  hasValue?: boolean
}

export type UseCredsApiParams = {
  idToken?: string | null
  enabled?: boolean
}

export type UseCredsApiResult = {
  creds: CredMeta[]
  loading: boolean
  error: string | null
  reload: () => void
  listCreds: (signal?: AbortSignal) => Promise<CredMeta[]>
  setCred: (provider: string, value: string, opts?: { signal?: AbortSignal }) => Promise<any>
  deleteCred: (provider: string, opts?: { signal?: AbortSignal }) => Promise<any>
}

function parseSkipAuth(): boolean {
  const rawSkip = (import.meta as any)?.env?.VITE_SKIP_AUTH
  return typeof rawSkip === 'string'
    ? ['1', 'true', 'yes', 'on'].includes(rawSkip.toLowerCase())
    : !!rawSkip
}

export function useCredsApi(params: UseCredsApiParams): UseCredsApiResult {
  const { idToken, enabled = true } = params
  const [creds, setCreds] = useState<CredMeta[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bump, setBump] = useState(0)

  const skipAuth = useMemo(parseSkipAuth, [])

  const client = useMemo(() => makeApiClient({ idToken: idToken ?? undefined, skipAuth }), [idToken, skipAuth])

  const reload = useCallback(() => setBump(v => v + 1), [])

  const listCreds = useCallback(async (signal?: AbortSignal) => {
    const json = await client.credsList({ signal })
    const list: CredMeta[] = Array.isArray(json?.creds) ? json.creds : []
    return list
  }, [client])

  const setCred = useCallback(async (provider: string, value: string, opts?: { signal?: AbortSignal }) => {
    return await client.credsSet(provider, value, { signal: opts?.signal })
  }, [client])

  const deleteCred = useCallback(async (provider: string, opts?: { signal?: AbortSignal }) => {
    return await client.credsDelete(provider, { signal: opts?.signal })
  }, [client])

  useEffect(() => {
    let cancelled = false
    const ac = new AbortController()

    async function load() {
      setError(null)
      if (!enabled || (!idToken && !skipAuth)) {
        if ((import.meta as any)?.env?.DEV) {
           
          console.debug('[useCredsApi] skip load', { enabled, hasToken: !!idToken, skipAuth })
        }
        setCreds([])
        return
      }
      setLoading(true)
      try {
        const list = await listCreds(ac.signal)
        if (!cancelled) setCreds(list)
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      ac.abort()
    }
  }, [enabled, idToken, skipAuth, listCreds, bump])

  return { creds, loading, error, reload, listCreds, setCred, deleteCred }
}

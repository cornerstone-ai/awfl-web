import { useEffect, useRef, useState } from 'react'
import { makeApiClient } from '../../../api/apiClient'
import type { ConsumerStatus, ConsumerType } from '../types'

export type UseConsumerStatusArgs = {
  idToken?: string
  projectId?: string
  consumerId?: string | null
  enabled?: boolean
  intervalMs?: number
}

function normalizeType(t: unknown): ConsumerType | null {
  if (typeof t !== 'string') return null
  const v = t.trim().toUpperCase()
  return v === 'LOCAL' || v === 'CLOUD' ? (v as ConsumerType) : null
}

export function useConsumerStatus({ idToken, projectId, consumerId, enabled, intervalMs = 4000 }: UseConsumerStatusArgs) {
  const [data, setData] = useState<ConsumerStatus | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<any>(null)
  const bumpRef = useRef(0)
  const mountedRef = useRef(true)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [])

  async function fetchOnce(signal?: AbortSignal) {
    if (!enabled || !projectId) return
    const client = makeApiClient({ idToken })
    try {
      setLoading(true)
      setError(null)
      const ropts = consumerId ? { extraHeaders: { 'x-consumer-id': consumerId } } : undefined
      const json: any = await client.consumerLockStatus(projectId, { ...(ropts as any), signal })
      if (!mountedRef.current) return

      const lock = json?.lock ?? null
      const ctype = normalizeType(lock?.consumerType)
      const mapped: ConsumerStatus = {
        locked: !!json?.active,
        consumerId: (lock?.consumerId ?? null) as string | null,
        consumerType: ctype,
        remainingMs: typeof lock?.expiresInMs === 'number' ? lock.expiresInMs : 0,
        leaseMs: typeof lock?.leaseMs === 'number' ? lock.leaseMs : null,
        expiresAt: typeof lock?.expiresAt === 'number' ? new Date(lock.expiresAt).toISOString() : null,
        ownedByYou: consumerId ? (lock?.consumerId === consumerId) : undefined,
        now: typeof json?.now === 'number' ? new Date(json.now).toISOString() : new Date().toISOString(),
      }

      setData(mapped)
    } catch (err) {
      if (!mountedRef.current) return
      if ((err as any)?.name === 'AbortError') return
      setError(err)
    } finally {
      if (mountedRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    if (!enabled || !projectId) {
      setData(null)
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
      return
    }

    const ac = new AbortController()
    fetchOnce(ac.signal)

    if (timerRef.current) window.clearInterval(timerRef.current)
    timerRef.current = window.setInterval(() => {
      const acPoll = new AbortController()
      fetchOnce(acPoll.signal)
    }, Math.max(1500, intervalMs))

    return () => {
      ac.abort()
      if (timerRef.current) window.clearInterval(timerRef.current)
      timerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idToken, projectId, consumerId, enabled, intervalMs, bumpRef.current])

  function reload() {
    bumpRef.current++
  }

  return { status: data as ConsumerStatus | null, loading, error, reload }
}

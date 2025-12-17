import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { makeApiClient } from '../../../api/apiClient'

export type ProducerStartOptions = {
  sessionId?: string
  since_id?: string
  since_time?: string
  leaseMs?: number
  eventsHeartbeatMs?: number
  reconnectBackoffMs?: number
  workspaceId?: string
  workspaceTtlMs?: number
  localDocker?: boolean
  localDockerImage?: string
  localDockerArgs?: string | string[]
}

export type UseProducerControlsArgs = {
  idToken?: string
  projectId?: string
  enabled?: boolean
}

export function useProducerControls({ idToken, projectId, enabled = true }: UseProducerControlsArgs) {
  const [starting, setStarting] = useState(false)
  const [stopping, setStopping] = useState(false)
  const [error, setError] = useState<any>(null)
  const [response, setResponse] = useState<any>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  const client = useMemo(() => makeApiClient({ idToken }), [idToken])

  const start = useCallback(
    async (opts?: ProducerStartOptions) => {
      if (!enabled) return null
      // Ensure required project header is present; http client uses getSelectedProjectId by default
      const ropts = projectId ? { extraHeaders: { 'x-project-id': projectId } } : undefined
      try {
        setStarting(true)
        setError(null)
        const json = await client.producerStart(opts || {}, ropts as any)
        if (!mountedRef.current) return null
        setResponse(json)
        return json
      } catch (err) {
        if (!mountedRef.current) return null
        if ((err as any)?.name === 'AbortError') return null
        setError(err)
        return null
      } finally {
        if (mountedRef.current) setStarting(false)
      }
    },
    [client, enabled, projectId]
  )

  const stop = useCallback(async () => {
    if (!enabled) return null
    const ropts = projectId ? { extraHeaders: { 'x-project-id': projectId } } : undefined
    try {
      setStopping(true)
      setError(null)
      const json = await client.producerStop(ropts as any)
      if (!mountedRef.current) return null
      setResponse(json)
      return json
    } catch (err) {
      if (!mountedRef.current) return null
      if ((err as any)?.name === 'AbortError') return null
      setError(err)
      return null
    } finally {
      if (mountedRef.current) setStopping(false)
    }
  }, [client, enabled, projectId])

  const loading = starting || stopping
  function resetError() {
    setError(null)
  }

  return { start, stop, loading, starting, stopping, error, resetError, response }
}

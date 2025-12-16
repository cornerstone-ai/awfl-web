import { useEffect, useMemo, useState } from 'react'
import { useConsumerStatus } from '../hooks/useConsumerStatus'
import { useProducerControls } from '../hooks/useProducerControls'
import { Tooltip } from '../../ui/public'

export type ConsumerStatusPillProps = {
  idToken?: string
  projectId?: string
  enabled?: boolean
  // Optional override for client id used in x-consumer-id header
  consumerId?: string | null
  intervalMs?: number
}

function getOrMakeClientId(): string {
  try {
    const k = 'awfl.consumerId'
    let v = localStorage.getItem(k)
    if (!v) {
      v = `web-${Math.random().toString(36).slice(2, 8)}-${Date.now().toString(36)}`
      localStorage.setItem(k, v)
    }
    return v
  } catch {
    return `web-${Math.random().toString(36).slice(2, 8)}`
  }
}

export function ConsumerStatusPill({ idToken, projectId, enabled, consumerId: consumerIdProp, intervalMs }: ConsumerStatusPillProps) {
  const consumerId = useMemo(() => consumerIdProp ?? getOrMakeClientId(), [consumerIdProp])
  const { status, reload } = useConsumerStatus({ idToken, projectId, consumerId, enabled, intervalMs })
  const { start, stop, loading: pending } = useProducerControls({ idToken, projectId, enabled })

  const type = status?.consumerType // 'LOCAL' | 'CLOUD' | null
  // Treat the reported type as the source of truth for which side is active.
  const localActive = type === 'LOCAL'
  const cloudActive = type === 'CLOUD'

  // Track the user's intended action during the in-flight request so the tooltip/label
  // doesn't flip from "Starting…" to "Stopping…" just because the poll tick updated the lock.
  const [intent, setIntent] = useState<'start' | 'stop' | null>(null)
  useEffect(() => {
    if (!pending) setIntent(null)
  }, [pending])

  const cannotControlCloud = !enabled || !projectId || !idToken
  const playDisabled = !!(localActive || pending || cannotControlCloud)

  const intentText = intent === 'stop' ? 'Stopping…' : intent === 'start' ? 'Starting…' : null
  const disabledReason = localActive
    ? 'Disabled: Local consumer holds the lock'
    : pending
    ? intentText || (cloudActive ? 'Working…' : 'Working…')
    : cannotControlCloud
    ? 'Disabled: Missing auth or project'
    : ''

  async function onClick() {
    if (playDisabled) return
    try {
      if (cloudActive) {
        setIntent('stop')
        const res = await stop()
        if (res) console.log('[producer.stop] response:', res)
      } else {
        setIntent('start')
        const res = await start({})
        if (res) console.log('[producer.start] response:', res)
      }
    } finally {
      // Nudge the status hook to refresh immediately rather than waiting for the next poll tick
      reload()
    }
  }

  const baseSideStyle: React.CSSProperties = {
    padding: '4px 8px',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 12,
    lineHeight: 1,
    userSelect: 'none',
  }

  // Active -> green for either side (slightly darker bg for better contrast)
  const ACTIVE_TEXT = '#065f46'
  const ACTIVE_BG = '#a7f3d0' // was #d1fae5
  const INACTIVE_TEXT = '#6b7280'
  const INACTIVE_BG = '#f3f4f6'

  const localStyle: React.CSSProperties = localActive
    ? { color: ACTIVE_TEXT, background: ACTIVE_BG }
    : { color: INACTIVE_TEXT, background: INACTIVE_BG }

  const cloudStyle: React.CSSProperties = cloudActive
    ? { color: ACTIVE_TEXT, background: ACTIVE_BG }
    : { color: INACTIVE_TEXT, background: INACTIVE_BG }

  const containerStyle: React.CSSProperties = {
    display: 'inline-flex',
    border: '1px solid #d1d5db',
    borderRadius: 999,
    // Allow tooltips to overflow the pill container
    overflow: 'visible',
    alignItems: 'stretch',
    background: 'white',
  }

  // Button labels and titles should respect the intent while pending
  const normalActionLabel = cloudActive ? 'Stop cloud consumer' : 'Start cloud consumer'
  const pendingLabel = intent === 'stop' ? 'Stopping…' : intent === 'start' ? 'Starting…' : 'Working…'
  const buttonAriaLabel = pending ? pendingLabel : normalActionLabel
  const buttonTitle = disabledReason || (pending ? pendingLabel : normalActionLabel)

  return (
    <div style={containerStyle}>
      <div
        style={{
          ...baseSideStyle,
          ...localStyle,
          borderRight: '1px solid #e5e7eb',
          // Match outer rounding so background doesn't protrude
          borderTopLeftRadius: 999,
          borderBottomLeftRadius: 999,
        }}
        title={localActive ? 'Consumer lock: LOCAL' : 'Local consumer'}
        aria-label={localActive ? 'Consumer lock: LOCAL' : 'Local consumer'}
      >
        <Tooltip
          content="Run the consumer locally: pipx install awfl && awfl"
          placement="bottom"
          align="center"
          disabled={localActive}
        >
          <span aria-hidden style={{ display: 'inline-block', lineHeight: 1 }}>💻</span>
        </Tooltip>
      </div>
      <div
        style={{
          ...baseSideStyle,
          ...cloudStyle,
          // Match outer rounding so background doesn't protrude
          borderTopRightRadius: 999,
          borderBottomRightRadius: 999,
        }}
        title={cloudActive ? 'Consumer lock: CLOUD' : 'Cloud consumer'}
        aria-label={cloudActive ? 'Consumer lock: CLOUD' : 'Cloud consumer'}
      >
        <span aria-hidden style={{ display: 'inline-block', lineHeight: 1 }}>☁️</span>
        {/* Start/Stop control: disabled when local holds the lock, when pending, or when auth/project missing */}
        <Tooltip
          content={disabledReason || (pending ? pendingLabel : normalActionLabel)}
          placement="bottom"
          align="center"
          disabled={!playDisabled}
        >
          <button
            type="button"
            disabled={playDisabled}
            onClick={onClick}
            aria-label={buttonAriaLabel}
            title={buttonTitle}
            style={{
              marginLeft: 6,
              opacity: playDisabled ? 0.35 : 1,
              color: 'inherit',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: playDisabled ? 'not-allowed' : 'pointer',
              lineHeight: 1,
            }}
          >
            {pending ? '…' : cloudActive ? '■' : '▶︎'}
          </button>
        </Tooltip>
      </div>
    </div>
  )
}

export default ConsumerStatusPill

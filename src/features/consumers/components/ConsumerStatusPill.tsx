import { useMemo } from 'react'
import { useConsumerStatus } from '../hooks/useConsumerStatus'
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
  const { status } = useConsumerStatus({ idToken, projectId, consumerId, enabled, intervalMs })

  const type = status?.consumerType // 'LOCAL' | 'CLOUD' | null
  // Treat the reported type as the source of truth for which side is active.
  const localActive = type === 'LOCAL'
  const cloudActive = type === 'CLOUD'
  const playDisabled = localActive // Disable starting cloud when local holds/claims the lock

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
        {/* Placeholder control: disable play when local holds the lock */}
        <button
          type="button"
          disabled={playDisabled}
          aria-label={cloudActive ? 'Stop cloud consumer' : 'Start cloud consumer'}
          title={playDisabled ? 'Disabled: Local consumer holds the lock' : (cloudActive ? 'Stop cloud consumer' : 'Start cloud consumer')}
          style={{
            marginLeft: 6,
            opacity: playDisabled ? 0.35 : 0.6,
            color: 'inherit',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: playDisabled ? 'not-allowed' : 'pointer',
            lineHeight: 1,
          }}
        >
          {cloudActive ? '■' : '▶︎'}
        </button>
      </div>
    </div>
  )
}

export default ConsumerStatusPill

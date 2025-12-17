import React, { useEffect, useRef, useState } from 'react'
import { makeApiClient } from '../../api/apiClient'
import { normalizeGroup } from '../../utils/collapse'
import { ChevronIcon } from '../common/Collapsible'
import styles from './CollapsedGroupCard.module.css'

// Theming: see CollapsedGroupCard.module.css for available CSS custom properties.
// Set variables like --yoj-cg-bg, --yoj-cg-border, --yoj-cg-label-color, etc. on a wrapping container.

export function CollapsedGroupCard(props: {
  sessionId?: string
  idToken?: string
  label: string
  description?: string | null
  responseId?: string | null
  defaultExpanded?: boolean
  children?: React.ReactNode
}) {
  const { sessionId, idToken, label, description, responseId, defaultExpanded = false, children } = props
  const skipAuth = (import.meta as any)?.env?.VITE_SKIP_AUTH === '1'

  // Optimistic UI override; server is the single source of truth.
  // resolvedExpanded = optimistic ?? defaultExpanded
  const [optimistic, setOptimistic] = useState<boolean | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const sendTimerRef = useRef<number | null>(null)
  const lastSentRef = useRef<boolean | null>(null)

  const resolvedExpanded = optimistic != null ? optimistic : !!defaultExpanded

  // When server state catches up to our optimistic override, drop the override
  useEffect(() => {
    if (optimistic == null) return
    if (defaultExpanded === optimistic) {
      setOptimistic(null)
    }
  }, [defaultExpanded, optimistic])

  function postState(target: boolean) {
    if (!sessionId || !label) return
    if (!idToken && !skipAuth) return
    // Avoid re-sending identical value
    if (lastSentRef.current === target) return

    const api = makeApiClient({ idToken, skipAuth })
    api
      .collapseStateSet({ sessionId, group: normalizeGroup(label), expanded: target, responseId: responseId || undefined })
      .then(() => {
        lastSentRef.current = target
      })
      .catch((err: any) => {
        const status = err?.httpStatus || err?.status || err?.response?.status
        if (status === 400 || status === 401) {
          // Revert optimistic override; show a brief message
          setOptimistic(null)
          setToast('Could not update state. Please sign in again.')
          setTimeout(() => setToast(null), 2000)
        }
        // swallow other errors
      })
  }

  function schedulePost(target: boolean) {
    if (sendTimerRef.current) {
      window.clearTimeout(sendTimerRef.current)
      sendTimerRef.current = null
    }
    // Debounce to coalesce rapid toggles
    sendTimerRef.current = window.setTimeout(() => {
      postState(target)
    }, 200)
  }

  function toggle() {
    // Treat this user action as a signal to the scroll container not to auto-scroll
    rootRef.current?.dispatchEvent(new CustomEvent('awfl:user-content-expand', { bubbles: true }))
    const next = !resolvedExpanded
    setOptimistic(next)
    schedulePost(next)
  }

  useEffect(() => () => {
    if (sendTimerRef.current) {
      window.clearTimeout(sendTimerRef.current)
      sendTimerRef.current = null
    }
  }, [])

  return (
    <div ref={rootRef} className={styles.root}>
      <div className={styles.header}>
        <div className={styles.label}>{normalizeGroup(label)}</div>
        <button
          type="button"
          onClick={toggle}
          aria-pressed={resolvedExpanded}
          aria-label={resolvedExpanded ? 'Collapse group' : 'Expand group'}
          title={resolvedExpanded ? 'Collapse group' : 'Expand group'}
          className={styles.toggleButton}
        >
          <ChevronIcon direction={resolvedExpanded ? 'up' : 'down'} size={12} />
        </button>
      </div>

      {description ? <div className={styles.description}>{description}</div> : null}

      {resolvedExpanded && children ? <div className={styles.body}>{children}</div> : null}

      {toast ? <div className={styles.toast}>{toast}</div> : null}
    </div>
  )
}

import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { onIdTokenChanged, signInWithPopup, signOut as firebaseSignOut, type User } from 'firebase/auth'
import { auth, provider } from '../lib/firebase'

export type AuthContextType = {
  user: User | null
  idToken: string | null
  loading: boolean
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Debug flag for optional console logging
const DEBUG_AUTH = (import.meta as any).env?.VITE_DEBUG_AUTH === '1' || (import.meta as any).env?.VITE_DEBUG_AUTH === 'true'
const dlog = (...args: any[]) => {
  if (DEBUG_AUTH) console.log('[auth]', ...args)
}

// Refresh the token slightly before it expires. Fallback to a sane interval when exp cannot be parsed.
const REFRESH_SKEW_MS = 60_000 // 1 minute early
const FALLBACK_REFRESH_MS = 10 * 60_000 // 10 minutes
const FOCUS_NEAR_EXPIRY_MS = 5 * 60_000 // only force-refresh on focus if <5m left

function parseJwtExpMs(token: string | null): number | null {
  if (!token) return null
  try {
    const [, payloadBase64] = token.split('.')
    if (!payloadBase64) return null
    const payloadJson = atob(payloadBase64.replace(/-/g, '+').replace(/_/g, '/'))
    const payload = JSON.parse(payloadJson)
    const expSec = typeof payload?.exp === 'number' ? payload.exp : null
    return expSec ? expSec * 1000 : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [idToken, setIdToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const refreshTimeoutRef = useRef<number | null>(null)
  const lastForcedRefreshAtRef = useRef<number>(0)
  const lastUidRef = useRef<string | null>(null)
  const lastTokenRef = useRef<string | null>(null)
  const initDoneRef = useRef(false)

  const clearRefreshTimer = () => {
    if (refreshTimeoutRef.current != null) {
      clearTimeout(refreshTimeoutRef.current)
      refreshTimeoutRef.current = null
    }
  }

  const scheduleRefresh = (u: User | null, token: string | null) => {
    clearRefreshTimer()
    if (!u || !token) return

    const expMs = parseJwtExpMs(token)
    const now = Date.now()
    const delay = expMs ? Math.max(30_000, expMs - now - REFRESH_SKEW_MS) : FALLBACK_REFRESH_MS
    dlog('scheduleRefresh', {
      uid: u?.uid,
      inMs: delay,
      inMin: Math.round((delay / 60000) * 10) / 10,
      expInMin: expMs ? Math.round(((expMs - now) / 60000) * 10) / 10 : null,
    })

    refreshTimeoutRef.current = window.setTimeout(async () => {
      try {
        dlog('timer: forcing token refresh')
        await u.getIdToken(true)
      } catch {
        // Swallow; onIdTokenChanged will not fire if this fails, but we'll try again on next focus/interval
        dlog('timer: force refresh failed (will retry later)')
      }
    }, delay)
  }

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (u) => {
      let token: string | null = null
      if (u) {
        try {
          token = await u.getIdToken()
        } catch {
          token = null
        }
      }

      const uid = u?.uid ?? null
      const uidChanged = uid !== lastUidRef.current
      const tokenChanged = token !== lastTokenRef.current

      const expMs = parseJwtExpMs(token)
      const minsLeft = expMs ? Math.round(((expMs - Date.now()) / 60000) * 10) / 10 : null

      dlog('onIdTokenChanged', {
        uid,
        uidChanged,
        tokenChanged,
        minsLeft,
      })

      // Only update React state if values actually changed to avoid wide re-renders
      if (uidChanged || !initDoneRef.current) setUser(u)
      if (tokenChanged || !initDoneRef.current) setIdToken(token)

      if (u && token) {
        if (tokenChanged || !initDoneRef.current) scheduleRefresh(u, token)
      } else {
        clearRefreshTimer()
      }

      // Commit refs after state update decisions
      if (uidChanged) lastUidRef.current = uid
      if (tokenChanged) lastTokenRef.current = token

      if (!initDoneRef.current) initDoneRef.current = true
      setLoading(false)
    })
    return () => {
      clearRefreshTimer()
      unsubscribe()
    }
  }, [])

  // Refresh when the app regains focus/visibility (helps after sleep or long inactivity)
  useEffect(() => {
    const maybeForceRefresh = () => {
      const u = auth.currentUser
      if (!u) return
      const now = Date.now()
      if (now - lastForcedRefreshAtRef.current < 60_000) {
        dlog('focus refresh throttled (<=1/min)')
        return // throttle to 1/min
      }

      const token = lastTokenRef.current
      const expMs = parseJwtExpMs(token)
      const msLeft = expMs ? expMs - now : null
      const nearExpiry = msLeft == null ? false : msLeft <= FOCUS_NEAR_EXPIRY_MS

      dlog('focus/visibility: considering refresh', {
        msLeft,
        minsLeft: msLeft != null ? Math.round((msLeft / 60000) * 10) / 10 : null,
        nearExpiry,
      })

      if (!nearExpiry) return
      lastForcedRefreshAtRef.current = now
      dlog('focus/visibility: forcing token refresh')
      u.getIdToken(true).catch(() => {})
    }

    const onFocus = () => maybeForceRefresh()
    const onVisibility = () => {
      if (document.visibilityState === 'visible') maybeForceRefresh()
    }

    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  const signIn = async () => {
    await signInWithPopup(auth, provider)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
  }

  const value = useMemo(
    () => ({ user, idToken, loading, signIn, signOut }),
    [user, idToken, loading]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

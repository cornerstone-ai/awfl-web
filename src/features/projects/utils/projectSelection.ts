import { getCookie, setCookie } from '../../../utils/cookies'

const KEY = 'awfl.projectId'

export function getSelectedProjectId(): string {
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const v = window.sessionStorage.getItem(KEY)
      if (v) return v
    }
  } catch {
    // ignore sessionStorage errors (e.g., privacy mode)
  }
  // Fallback to cookie for a good default on new loads
  return getCookie(KEY) || ''
}

export function setSelectedProjectId(id?: string | null): void {
  const val = id ?? ''
  try {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      if (val) window.sessionStorage.setItem(KEY, val)
      else window.sessionStorage.removeItem(KEY)
    }
  } catch {
    // ignore sessionStorage errors
  }
  // Always persist last non-empty selection to cookie for cross-tab defaults
  if (val) setCookie(KEY, val)
}

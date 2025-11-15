import type { ConsumerStatus, ConsumerType } from './types'

function toIso(ts: any): string {
  const n = typeof ts === 'number' ? ts : Number(ts)
  if (!Number.isFinite(n)) return new Date().toISOString()
  return new Date(n).toISOString()
}

function normalizeType(t: any): ConsumerType | null {
  return t === 'LOCAL' || t === 'CLOUD' ? t : null
}

// Accept multiple backend shapes and normalize to ConsumerStatus
export function mapLockStatusToConsumerStatus(raw: any, selfConsumerId?: string | null): ConsumerStatus {
  // If already looks normalized, return as-is (defensive)
  if (raw && typeof raw === 'object' && 'locked' in raw && 'consumerType' in raw && 'now' in raw) {
    const locked = Boolean((raw as any).locked)
    const consumerId = (raw as any).consumerId ?? null
    const consumerType = normalizeType((raw as any).consumerType)
    const remainingMs = Math.max(0, Number((raw as any).remainingMs ?? 0))
    const leaseMs = (raw as any).leaseMs ?? null
    const expiresAt = (raw as any).expiresAt ?? null
    const now = typeof (raw as any).now === 'string' ? (raw as any).now : toIso((raw as any).now)
    const ownedByYou = !!(selfConsumerId && consumerId && selfConsumerId === consumerId)
    return { locked, consumerId, consumerType, remainingMs, leaseMs, expiresAt, ownedByYou, now }
  }

  // Expected shape per backend sample:
  // { ok, active, now, lock: { consumerId, consumerType, leaseMs, acquiredAt, refreshedAt, expiresAt, expiresInMs } }
  const active = Boolean(raw?.active)
  const lock = raw?.lock ?? {}
  const consumerId = lock?.consumerId ?? null
  const consumerType = normalizeType(lock?.consumerType)
  const leaseMs = typeof lock?.leaseMs === 'number' ? lock.leaseMs : null
  const nowIso = toIso(raw?.now ?? Date.now())
  const expiresAtIso = typeof lock?.expiresAt === 'number' ? toIso(lock.expiresAt) : null
  const remainingMs = Math.max(0, Number(lock?.expiresInMs ?? 0))
  const ownedByYou = !!(selfConsumerId && consumerId && selfConsumerId === consumerId)

  return {
    locked: active,
    consumerId,
    consumerType,
    remainingMs,
    leaseMs,
    expiresAt: expiresAtIso,
    ownedByYou,
    now: nowIso,
  }
}

export type ConsumerType = 'LOCAL' | 'CLOUD'

export interface ConsumerStatus {
  locked: boolean
  consumerId: string | null
  consumerType: ConsumerType | null
  remainingMs: number
  leaseMs: number | null
  expiresAt: string | null
  ownedByYou?: boolean
  now: string
}

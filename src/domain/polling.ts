import type { PaymentStatus } from '../api/schemas'
import { isFinal } from './status'

export const POLL_ACTIVE_MS = 3_000
// expired keeps polling, slower, so a payment sent in the last seconds still moves the page on.
export const POLL_EXPIRED_MS = 15_000
export const POLL_MAX_BACKOFF_MS = 30_000

export function pollInterval(
  status: PaymentStatus | undefined,
  consecutiveFailures: number,
): number | false {
  if (status !== undefined && isFinal(status)) return false
  const base = status === 'expired' ? POLL_EXPIRED_MS : POLL_ACTIVE_MS
  // With no failures the backoff term is POLL_ACTIVE_MS, so this is the base.
  return Math.min(
    Math.max(base, POLL_ACTIVE_MS * 2 ** consecutiveFailures),
    POLL_MAX_BACKOFF_MS,
  )
}

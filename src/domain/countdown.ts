// Recomputed from the deadline on every tick, never decremented, so a throttled tab cannot drift.
export function remainingMs(expiresAt: string, now: number): number {
  return Date.parse(expiresAt) - now
}

export function remainingShare(
  remainingMs: number,
  lifetimeMs: number,
): number {
  return Math.min(1, Math.max(0, remainingMs / lifetimeMs))
}

// Rounded up so 0:00 never sits beside an address that is still up.
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor(total / 60) % 60
  const seconds = String(total % 60).padStart(2, '0')
  if (hours === 0) return `${minutes}:${seconds}`
  return `${hours}:${String(minutes).padStart(2, '0')}:${seconds}`
}

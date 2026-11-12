import type { Screen } from '../domain/screen'

export type StatusScreen = Exclude<Screen, { kind: 'pay' | 'pay_loading' }>

// One source for each headline, so the screen and the announcement cannot drift apart.
export function headline(screen: StatusScreen): string {
  switch (screen.kind) {
    case 'waiting':
      return "We've seen your payment on the network"
    case 'complete':
      return 'Payment complete'
    case 'expired':
      if (screen.variant !== 'dead_end') return 'This quote has expired'
      return screen.after === 'partial'
        ? "The full amount wasn't reached"
        : 'This payment expired'
    case 'failed':
      return 'This payment could not be completed'
    case 'checking':
      return "We're checking your payment"
  }
}

// Only a reason the page knows gets its own words; the code itself is always shown beside it.
export function reasonText(reason: string): string {
  return reason === 'settlement_rejected'
    ? 'The settlement was rejected.'
    : 'The payment service reported a problem.'
}

import type { ReactNode } from 'react'
import type { OrderSummary } from '../api/schemas'
import { Button } from './Button'
import { CheckoutCard } from './CheckoutCard'
import { OrderHeader } from './OrderHeader'

export function LoadingCard({
  order,
  loading,
  problem,
  onRetry,
  strip,
  stacked = false,
}: {
  order: OrderSummary
  loading: string // shown while there is no problem
  problem: string | null // shown in its place, with a "Try again" button
  onRetry(): void
  strip?: ReactNode
  stacked?: boolean // one column, the status under the header
}) {
  const status = (
    <div className="flex flex-col items-center gap-3 text-center text-small">
      {problem != null ? (
        <>
          <p className="font-semibold">{problem}</p>
          <Button variant="primary" onClick={onRetry}>
            Try again
          </Button>
        </>
      ) : (
        <p className="text-ink-muted">{loading}</p>
      )}
    </div>
  )
  return stacked ? (
    <CheckoutCard
      left={
        <>
          <OrderHeader order={order} />
          {status}
        </>
      }
      strip={strip}
    />
  ) : (
    <CheckoutCard
      left={<OrderHeader order={order} />}
      right={status}
      strip={strip}
    />
  )
}

import type { ReactNode } from 'react'
import type { OrderSummary } from '../api/schemas'
import { CheckoutCard } from './CheckoutCard'
import { OrderHeader } from './OrderHeader'

export function LoadingCard({
  order,
  loading,
  problem,
  onRetry,
  strip,
}: {
  order: OrderSummary
  loading: string // shown while there is no problem
  problem: string | null // shown in its place, with a "Try again" button
  onRetry(): void
  strip?: ReactNode
}) {
  return (
    <CheckoutCard
      left={<OrderHeader order={order} />}
      right={
        <div className="flex flex-col items-center gap-3 text-center text-[14.5px]">
          {problem != null ? (
            <>
              <p className="font-semibold">{problem}</p>
              <button
                type="button"
                onClick={onRetry}
                className="rounded-full bg-[#14161a] px-5 py-3 font-bold text-white"
              >
                Try again
              </button>
            </>
          ) : (
            <p className="text-gray-600">{loading}</p>
          )}
        </div>
      }
      strip={strip}
    />
  )
}

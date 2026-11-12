import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import type { QueryState } from '@tanstack/react-query'
import { useState } from 'react'
import { getPayment, isNotFound } from '../api/endpoints'
import { pollInterval } from '../domain/polling'
import { isFinal } from '../domain/status'
import { mergePayment, paymentKey } from './paymentCache'
import type { PaymentEntry } from './paymentCache'

export type UsePaymentResult = {
  entry: PaymentEntry | undefined
  isLoading: boolean
  error: unknown
  lastSuccessAt: number
  lastFailureAt: number | null
  consecutiveFailures: number
  checkNow(): void
}

// After a final status or a not-found answer the server has nothing more to say, so nothing may ask again.
function finished(state: QueryState<PaymentEntry> | undefined): boolean {
  if (state === undefined) return false
  if (isNotFound(state.error)) return true
  return state.data !== undefined && isFinal(state.data.payment.status)
}

export function usePayment(reference: string | null): UsePaymentResult {
  const client = useQueryClient()
  const key = paymentKey(reference ?? '')
  // Not the library's fetchFailureCount: that resets as each fetch starts, so it never counts past one.
  // Kept with its reference, so a new payment starts from none.
  const [failures, setFailures] = useState({ reference, count: 0 })
  const consecutiveFailures =
    failures.reference === reference ? failures.count : 0
  const query = useQuery({
    queryKey: key,
    queryFn:
      reference === null
        ? skipToken
        : async ({ queryKey, signal }) => {
            try {
              const payment = await getPayment(reference, signal)
              setFailures({ reference, count: 0 })
              return mergePayment(
                client.getQueryData<PaymentEntry>(queryKey),
                payment,
                Date.now(),
              )
            } catch (error) {
              // An abort is the page cancelling its own request, not the server failing.
              if (!signal.aborted) {
                setFailures((previous) => ({
                  reference,
                  count:
                    (previous.reference === reference ? previous.count : 0) + 1,
                }))
              }
              throw error
            }
          },
    // Disabled, the query sends nothing from the interval, the tab returning or a reconnect.
    enabled: ({ state }) => !finished(state),
    // The next poll is the retry.
    retry: false,
    staleTime: 0,
    refetchInterval: ({ state }) =>
      pollInterval(state.data?.payment.status, consecutiveFailures),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  })
  const { refetch } = query

  return {
    entry: query.data,
    isLoading: query.isLoading,
    error: query.error,
    lastSuccessAt: query.dataUpdatedAt,
    lastFailureAt: query.errorUpdatedAt === 0 ? null : query.errorUpdatedAt,
    consecutiveFailures,
    checkNow: () => {
      // refetch ignores enabled. The cache is read now, because the answer that ended polling may not have rendered yet.
      if (reference === null || finished(client.getQueryState(key))) return
      // Joins a request in flight instead of cancelling it and starting another.
      void refetch({ cancelRefetch: false })
    },
  }
}

import { skipToken, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getPayment, isNotFound } from '../api/endpoints'
import { pollInterval } from '../domain/polling'
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

export function usePayment(reference: string | null): UsePaymentResult {
  const client = useQueryClient()
  // Not the library's fetchFailureCount: that resets as each fetch starts, so it never counts past one.
  const [failures, setFailures] = useState(0)
  const query = useQuery({
    queryKey: paymentKey(reference ?? ''),
    queryFn:
      reference === null
        ? skipToken
        : async ({ queryKey, signal }) => {
            try {
              const payment = await getPayment(reference, signal)
              setFailures(0)
              return mergePayment(
                client.getQueryData<PaymentEntry>(queryKey),
                payment,
                Date.now(),
              )
            } catch (error) {
              // An abort is the page cancelling its own request, not the server failing.
              if (!signal.aborted) setFailures((count) => count + 1)
              throw error
            }
          },
    // The next poll is the retry.
    retry: false,
    staleTime: 0,
    refetchInterval: ({ state }) =>
      isNotFound(state.error)
        ? false
        : pollInterval(state.data?.payment.status, failures),
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
    consecutiveFailures: failures,
    checkNow: () => {
      // Joins a request in flight instead of cancelling it and starting another.
      if (reference !== null) void refetch({ cancelRefetch: false })
    },
  }
}

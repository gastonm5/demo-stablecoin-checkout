import { useQuery } from '@tanstack/react-query'
import { ApiError } from '../api/client'
import { getCurrencies } from '../api/endpoints'
import type { Currency } from '../api/schemas'

export type Catalogue = {
  currencies: Currency[] | undefined
  isLoading: boolean
  error: unknown
  retry(): void
}

// A 4xx is the server's answer, not an outage: asking again gets the same one.
const isAnswer = (error: unknown) =>
  error instanceof ApiError &&
  error.kind === 'http' &&
  error.status !== undefined &&
  error.status < 500

export function useCurrencies(): Catalogue {
  const query = useQuery({
    queryKey: ['currencies'],
    queryFn: ({ signal }) => getCurrencies(signal),
    staleTime: Infinity,
    retry: (failureCount, error) => failureCount < 2 && !isAnswer(error),
  })
  const { refetch } = query
  return {
    currencies: query.data,
    isLoading: query.isLoading,
    error: query.error,
    retry: () => void refetch(),
  }
}

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { FC, ReactNode } from 'react'

// gcTime Infinity schedules no garbage-collection timer, so a test can assert that none is left.
export function createTestClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
}

export function withClient(client: QueryClient): FC<{ children: ReactNode }> {
  return function Wrapper({ children }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }
}

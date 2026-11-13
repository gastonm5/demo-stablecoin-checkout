import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { LoadingCard } from './components/LoadingCard'
import { PaymentView } from './screens/PaymentView'
import { PickerScreen } from './screens/PickerScreen'
import { DevPanel } from './dev/DevPanel'
import { useCheckout } from './hooks/useCheckout'
import type { UseCheckoutResult } from './hooks/useCheckout'
import { useCurrencies } from './hooks/useCurrencies'

function Checkout({ checkout }: { checkout: UseCheckoutResult }) {
  const catalogue = useCurrencies()
  const { view } = checkout

  // A payment in flight never waits for the currency list; only its pay screen does.
  if (view.kind === 'payment')
    return <PaymentView checkout={checkout} catalogue={catalogue} />

  if (catalogue.currencies) {
    return (
      <PickerScreen
        order={checkout.order}
        currencies={catalogue.currencies}
        mode={view.mode}
        notice={view.notice}
        submitting={checkout.submitting}
        error={checkout.submitError}
        onSubmit={checkout.submit}
        onCancel={view.mode === 'requote' ? checkout.cancelChange : undefined}
      />
    )
  }

  return (
    <LoadingCard
      order={checkout.order}
      loading="Loading payment options…"
      problem={
        catalogue.error != null ? "We couldn't load the payment options." : null
      }
      onRetry={catalogue.retry}
    />
  )
}

// The panel sits beside the page in a row, so at desktop width it pushes the card aside instead of covering it.
function Page() {
  const checkout = useCheckout()
  return (
    <div className="flex">
      <main className="min-h-screen min-w-0 flex-1 bg-page px-4 py-8 text-ink md:py-16">
        <Checkout checkout={checkout} />
      </main>
      <DevPanel reference={checkout.reference} entry={checkout.payment.entry} />
    </div>
  )
}

export default function App() {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <Page />
    </QueryClientProvider>
  )
}

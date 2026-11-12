import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { CheckoutCard } from './components/CheckoutCard'
import { OrderHeader } from './components/OrderHeader'
import { PaymentView } from './components/PaymentView'
import { Picker } from './components/Picker'
import { useCheckout } from './hooks/useCheckout'
import { useCurrencies } from './hooks/useCurrencies'

function Checkout() {
  const checkout = useCheckout()
  const catalogue = useCurrencies()
  const { view } = checkout

  // A payment in flight never waits for the currency list; only its pay screen does.
  if (view.kind === 'payment')
    return <PaymentView checkout={checkout} catalogue={catalogue} />

  if (catalogue.currencies) {
    return (
      <Picker
        orderId={checkout.orderId}
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
    <CheckoutCard
      left={<OrderHeader orderId={checkout.orderId} />}
      right={
        <div className="flex flex-col items-center gap-3 text-center text-[14.5px]">
          {catalogue.error != null ? (
            <>
              <p className="font-semibold">
                We couldn't load the payment options.
              </p>
              <button
                type="button"
                onClick={catalogue.retry}
                className="rounded-full bg-[#14161a] px-5 py-3 font-bold text-white"
              >
                Try again
              </button>
            </>
          ) : (
            <p className="text-gray-600">Loading payment options…</p>
          )}
        </div>
      }
    />
  )
}

export default function App() {
  const [client] = useState(() => new QueryClient())
  return (
    <QueryClientProvider client={client}>
      <main className="min-h-screen bg-[#f5f5f7] px-4 py-8 text-[#14161a] md:py-16">
        <Checkout />
      </main>
    </QueryClientProvider>
  )
}

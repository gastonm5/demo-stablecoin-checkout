import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Payment } from '../api/schemas'
import type { Screen } from '../domain/screen'
import type { UseCheckoutResult } from '../hooks/useCheckout'
import type { Catalogue } from '../hooks/useCurrencies'
import { useFocusOnChange } from '../hooks/useFocusOnChange'
import { usePaymentScreen } from '../hooks/usePaymentScreen'
import { CheckingScreen } from './CheckingScreen'
import { CompleteScreen } from './CompleteScreen'
import { ConfirmChangeDialog } from '../components/ConfirmChangeDialog'
import { ExpiredScreen } from './ExpiredScreen'
import { FailedScreen } from './FailedScreen'
import { LoadingCard } from '../components/LoadingCard'
import { connectionNotice } from '../components/NoticeStrip'
import { PayScreen } from './PayScreen'
import { headline } from './statusText'
import { WaitingScreen } from './WaitingScreen'

const DETAILS_FAILED = "We couldn't load the payment details."

// The pay screen has no headline, so its announcement says what to send and where.
function announcement(
  screen: Screen,
  payment: Payment,
  detailsProblem: boolean,
): string {
  switch (screen.kind) {
    case 'pay': {
      const amount =
        screen.mode === 'remaining' && payment.status === 'underpaid'
          ? payment.amount_outstanding
          : payment.quote.total_due
      return `Send ${amount} ${payment.quote.crypto_currency} on ${payment.quote.network_name}`
    }
    case 'pay_loading':
      return detailsProblem ? DETAILS_FAILED : ''
    default:
      return headline(screen)
  }
}

export function PaymentView({
  checkout,
  catalogue,
}: {
  checkout: UseCheckoutResult
  catalogue: Catalogue
}) {
  // View state only: whether the "have you already sent?" question is open.
  const [confirming, setConfirming] = useState(false)
  const { payment } = checkout
  const { entry, screen, connection, detailsProblem, money, usualSeconds } =
    usePaymentScreen(payment, catalogue)
  const headingRef = useFocusOnChange<HTMLHeadingElement>(
    screen?.kind ?? 'loading',
  )
  const notice = connectionNotice(connection, payment.checkNow)
  // Only a live quote with its address on screen may be dropped.
  const changeOffered =
    screen?.kind === 'pay' && screen.mode === 'full' && screen.showAddress
  // Adjusted while rendering: a question left open must not outlive the address it was about.
  if (confirming && !changeOffered) setConfirming(false)

  function body(): ReactNode {
    if (!entry || !screen) {
      // A reload during an outage has no status to show yet, so the notice is the only thing that says why.
      return (
        <div className="mx-auto w-full max-w-[940px] overflow-hidden rounded-[22px] border border-[#dfe3e8] bg-white text-[15px]">
          <p className="px-8 py-7 text-center text-gray-600">
            Loading your payment…
          </p>
          {notice && (
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-[#dfe3e8] px-5 py-3.5 text-[13.5px] md:px-8">
              {notice}
            </div>
          )}
        </div>
      )
    }
    const current = entry.payment
    const shared = { payment: current, notice, headingRef }
    switch (screen.kind) {
      case 'pay':
        return (
          <PayScreen
            payment={current}
            screen={screen}
            onChange={changeOffered ? () => setConfirming(true) : null}
            notice={notice}
          />
        )
      case 'pay_loading':
        return (
          <LoadingCard
            order={current}
            loading="Loading the payment details…"
            problem={detailsProblem ? DETAILS_FAILED : null}
            onRetry={() => {
              catalogue.retry()
              payment.checkNow()
            }}
            strip={notice}
          />
        )
      case 'waiting':
        return <WaitingScreen {...shared} usualSeconds={usualSeconds} />
      case 'complete':
        return <CompleteScreen {...shared} />
      case 'expired':
        return (
          <ExpiredScreen
            {...shared}
            screen={screen}
            money={money}
            requoting={checkout.submitting}
            error={checkout.submitError}
            onRequote={() =>
              checkout.submit({
                currency: current.quote.crypto_currency,
                network: current.quote.network,
              })
            }
            onChange={checkout.changeChoice}
          />
        )
      case 'failed':
        return <FailedScreen {...shared} screen={screen} money={money} />
      case 'checking':
        return <CheckingScreen {...shared} money={money} />
    }
  }

  return (
    <>
      <p role="status" aria-live="polite" className="sr-only">
        {entry && screen
          ? announcement(screen, entry.payment, detailsProblem)
          : ''}
      </p>
      {body()}
      <ConfirmChangeDialog
        open={confirming}
        onConfirm={() => {
          setConfirming(false)
          checkout.changeChoice()
        }}
        onCancel={() => setConfirming(false)}
      />
    </>
  )
}

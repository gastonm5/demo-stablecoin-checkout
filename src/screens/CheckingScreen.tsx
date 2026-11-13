import type { ReactNode, Ref } from 'react'
import type { Screen } from '../domain/screen'
import type { SequenceEntry } from '../domain/sequence'
import { BODY, StatusCard } from '../components/StatusCard'
import { headline } from './statusText'

// A status the page does not know, or one that went backwards: keep polling, and leave a way forward.
export function CheckingScreen({
  screen,
  money,
  notice,
  headingRef,
}: {
  screen: Extract<Screen, { kind: 'checking' }>
  money?: SequenceEntry // supplies the transaction row when the status itself carries none
  notice?: ReactNode
  headingRef?: Ref<HTMLHeadingElement>
}) {
  const { payment } = screen
  return (
    <StatusCard
      payment={payment}
      money={money}
      icon="wait"
      title={headline(screen)}
      headingRef={headingRef}
      strip="This page updates by itself."
      notice={notice}
    >
      <p className={BODY}>
        <strong>Don't send again.</strong>
        {` If this doesn't change, contact ${payment.merchant.name} and quote reference ${payment.payment_reference}.`}
      </p>
    </StatusCard>
  )
}

import type { ReactNode } from 'react'

// Fills its parent: the page sets the width, so it can move between screens.
export function CheckoutCard({
  left,
  right,
  strip,
}: {
  left: ReactNode
  right?: ReactNode // without it the card is one column
  strip?: ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface text-body leading-[1.4] text-ink">
      {right === undefined ? (
        <div className="entrance px-5 py-7 md:px-8">{left}</div>
      ) : (
        <div className="grid grid-cols-1 md:min-h-[460px] md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
          <div className="entrance px-5 py-7 md:px-8">{left}</div>
          {/* The divider is frame, so the entrance runs on what is inside it. */}
          <div className="flex flex-col justify-center border-t border-line px-5 py-7 md:border-t-0 md:border-l md:px-7">
            <div className="entrance flex flex-col gap-4">{right}</div>
          </div>
        </div>
      )}
      {strip && (
        <div className="border-t border-line px-5 py-3.5 text-small md:px-8">
          {strip}
        </div>
      )}
    </div>
  )
}

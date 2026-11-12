import type { ReactNode } from 'react'

export function CheckoutCard({
  left,
  right,
  strip,
}: {
  left: ReactNode
  right: ReactNode
  strip?: ReactNode
}) {
  return (
    <div className="mx-auto w-full max-w-[940px] overflow-hidden rounded-[22px] border border-[#dfe3e8] bg-white text-[15px] leading-[1.4] text-[#14161a]">
      <div className="grid md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="px-5 py-7 md:px-8">{left}</div>
        <div className="flex flex-col justify-center gap-4 border-t border-[#dfe3e8] px-5 py-7 md:border-t-0 md:border-l md:px-7">
          {right}
        </div>
      </div>
      {strip && (
        <div className="border-t border-[#dfe3e8] px-5 py-3.5 text-[13.5px] md:px-8">
          {strip}
        </div>
      )}
    </div>
  )
}

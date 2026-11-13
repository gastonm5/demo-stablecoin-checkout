import { networkColours } from './networkColours'

// Decoration only: the network's name is always in text beside the chip.
export function NetworkChip({
  networkId,
  networkName,
  className,
  onFill = false,
}: {
  networkId: string
  networkName: string
  className: string
  onFill?: boolean // set when the chip sits on the network's own fill, where its usual colour would vanish
}) {
  const colours = networkColours(networkId)
  const colour = onFill
    ? colours.chipOnFill
    : `${colours.chip} ${colours.onFill}`
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold ${colour} ${className}`}
    >
      {[...networkName][0]}
    </span>
  )
}

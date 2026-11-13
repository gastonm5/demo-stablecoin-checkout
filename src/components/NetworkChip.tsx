import { networkColours } from './networkColours'

// Decoration only: the network's name is always in text beside the chip.
export function NetworkChip({
  networkId,
  networkName,
  className,
}: {
  networkId: string
  networkName: string
  className: string
}) {
  const { chip, onFill } = networkColours(networkId)
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold ${chip} ${onFill} ${className}`}
    >
      {[...networkName][0]}
    </span>
  )
}

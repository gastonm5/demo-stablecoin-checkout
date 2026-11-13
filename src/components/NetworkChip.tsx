// Decoration only: the network's name is always in text beside the chip.
const COLOURS: Record<string, string> = {
  tron: 'bg-network-tron',
  ethereum: 'bg-network-ethereum',
  polygon: 'bg-network-polygon',
  solana: 'bg-network-solana',
}

export function NetworkChip({
  networkId,
  networkName,
  className,
}: {
  networkId: string
  networkName: string
  className: string
}) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold text-ink-inverse ${COLOURS[networkId] ?? 'bg-network-other'} ${className}`}
    >
      {[...networkName][0]}
    </span>
  )
}

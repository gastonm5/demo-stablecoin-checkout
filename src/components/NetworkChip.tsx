// Decoration only: the network's name is always in text beside the chip.
const COLOURS: Record<string, string> = {
  tron: 'bg-[#ff060a]',
  ethereum: 'bg-[#627eea]',
  polygon: 'bg-[#8247e5]',
  solana: 'bg-[#14b8a6]',
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
      className={`flex shrink-0 items-center justify-center rounded-full font-extrabold text-white ${COLOURS[networkId] ?? 'bg-[#6b7280]'} ${className}`}
    >
      {[...networkName][0]}
    </span>
  )
}

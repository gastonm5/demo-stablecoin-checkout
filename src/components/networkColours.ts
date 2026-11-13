type NetworkColours = {
  chip: string
  fill: string
  fillBorder: string // the fill's own colour as a border; `border` is darker on Solana
  onFill: string
  chipOnFill: string // the chip on a fill: the pair reversed, so it stays visible
  border: string
  tint: string
  accent: string
}

// Written out whole: Tailwind only generates a class it can read as one literal string.
const COLOURS: Record<string, NetworkColours> = {
  tron: {
    chip: 'bg-network-tron',
    fill: 'bg-network-tron',
    fillBorder: 'border-network-tron',
    onFill: 'text-ink-inverse',
    chipOnFill: 'bg-ink-inverse text-network-tron',
    border: 'border-network-tron',
    tint: 'bg-network-tron/10',
    accent: 'accent-network-tron',
  },
  ethereum: {
    chip: 'bg-network-ethereum',
    fill: 'bg-network-ethereum-fill',
    fillBorder: 'border-network-ethereum-fill',
    onFill: 'text-ink-inverse',
    chipOnFill: 'bg-ink-inverse text-network-ethereum-fill',
    border: 'border-network-ethereum',
    tint: 'bg-network-ethereum/10',
    accent: 'accent-network-ethereum',
  },
  polygon: {
    chip: 'bg-network-polygon',
    fill: 'bg-network-polygon',
    fillBorder: 'border-network-polygon',
    onFill: 'text-ink-inverse',
    chipOnFill: 'bg-ink-inverse text-network-polygon',
    border: 'border-network-polygon',
    tint: 'bg-network-polygon/10',
    accent: 'accent-network-polygon',
  },
  solana: {
    chip: 'bg-network-solana',
    fill: 'bg-network-solana',
    fillBorder: 'border-network-solana',
    onFill: 'text-ink',
    chipOnFill: 'bg-ink text-network-solana',
    border: 'border-network-solana-line',
    tint: 'bg-network-solana/10',
    accent: 'accent-network-solana-line',
  },
}

const OTHER: NetworkColours = {
  chip: 'bg-network-other',
  fill: 'bg-network-other',
  fillBorder: 'border-network-other',
  onFill: 'text-ink-inverse',
  chipOnFill: 'bg-ink-inverse text-network-other',
  border: 'border-network-other',
  tint: 'bg-network-other/10',
  accent: 'accent-network-other',
}

// The id comes from the server, so one like `constructor` must not reach the object's prototype.
export function networkColours(networkId: string): NetworkColours {
  return Object.hasOwn(COLOURS, networkId) ? COLOURS[networkId] : OTHER
}

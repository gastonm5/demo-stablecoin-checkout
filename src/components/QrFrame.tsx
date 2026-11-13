import { QRCodeSVG } from 'qrcode.react'
import { NetworkChip } from './NetworkChip'
import { networkColours } from './networkColours'

export function QrFrame({
  address,
  networkId,
  networkName,
  note,
}: {
  address: string
  networkId: string
  networkName: string
  note: string
}) {
  const { fill, onFill } = networkColours(networkId)
  return (
    <div className="flex flex-col items-center gap-3.5 text-center">
      {/* Padding, not a border, draws the frame, so it is the bar's own fill class. */}
      <div className={`overflow-hidden rounded-control p-[3px] ${fill}`}>
        <div
          className={`flex items-center justify-center gap-2 px-3 py-[7px] text-label font-extrabold tracking-[.06em] ${fill} ${onFill}`}
        >
          <NetworkChip
            networkId={networkId}
            networkName={networkName}
            className="size-[18px] text-label"
            onFill
          />
          <span className="min-w-0 wrap-anywhere">{`${networkName.toUpperCase()} ONLY`}</span>
        </div>
        {/* Address only: the API gives no token contract to build a payment link from. See ADR 0004.
            The four-module margin is the quiet zone the QR standard asks for, so the frame never touches the code. */}
        <QRCodeSVG
          value={address}
          title={`QR code for the ${networkName} address`}
          marginSize={4}
          className="size-50 sm:size-58"
        />
      </div>
      <div>
        <p className="text-lead font-bold">Scan with your wallet app</p>
        <p className="text-small text-balance text-ink-subtle">{note}</p>
      </div>
    </div>
  )
}

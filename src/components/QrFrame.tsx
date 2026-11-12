import { QRCodeSVG } from 'qrcode.react'
import { NetworkChip } from './NetworkChip'

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
  return (
    <div className="flex flex-col items-center gap-3.5 text-center">
      <div className="overflow-hidden rounded-[14px] border-[3px] border-[#14161a]">
        <div className="flex items-center justify-center gap-2 bg-[#14161a] px-3 py-[7px] text-[12.5px] font-extrabold tracking-[.06em] text-white">
          <NetworkChip
            networkId={networkId}
            networkName={networkName}
            className="size-[18px] text-[10px]"
          />
          {`${networkName.toUpperCase()} ONLY`}
        </div>
        {/* Address only: the API gives no token contract to build a payment link from. See ADR 0004.
            The four-module margin is the quiet zone the QR standard asks for, so the dark frame never touches the code. */}
        <QRCodeSVG
          value={address}
          title={`QR code for the ${networkName} address`}
          marginSize={4}
          className="size-50 sm:size-58"
        />
      </div>
      <div>
        <p className="text-base font-bold">Scan with your wallet app</p>
        <p className="text-[13.5px] text-balance text-gray-500">{note}</p>
      </div>
    </div>
  )
}

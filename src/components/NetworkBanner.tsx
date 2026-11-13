import { networkShortName } from '../domain/format'
import { NetworkChip } from './NetworkChip'

export function NetworkBanner({
  currency,
  networkId,
  networkName,
}: {
  currency: string
  networkId: string
  networkName: string
}) {
  return (
    <div className="mb-5 flex items-center gap-3 rounded-xl bg-[#14161a] px-3.5 py-3 text-white">
      <NetworkChip
        networkId={networkId}
        networkName={networkName}
        className="size-[30px]"
      />
      <div className="min-w-0 wrap-anywhere">
        <p className="text-base font-bold">{`${networkName} network`}</p>
        <p className="text-[13px] text-[#c9ced4]">
          {`Send ${currency} on ${networkShortName(networkName)} only. Any other network loses your funds.`}
        </p>
      </div>
    </div>
  )
}

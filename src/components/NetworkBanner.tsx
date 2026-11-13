import { networkShortName } from '../domain/format'
import { NetworkChip } from './NetworkChip'
import { networkColours } from './networkColours'

export function NetworkBanner({
  currency,
  networkId,
  networkName,
}: {
  currency: string
  networkId: string
  networkName: string
}) {
  const { fill, onFill } = networkColours(networkId)
  return (
    <div
      className={`mb-5 flex items-center gap-3 rounded-control px-3.5 py-3 ${fill} ${onFill}`}
    >
      <NetworkChip
        networkId={networkId}
        networkName={networkName}
        className="size-[30px]"
        onFill
      />
      <div className="min-w-0 wrap-anywhere">
        <p className="text-lead font-bold">{`${networkName} network`}</p>
        <p className="text-small">
          {`Send ${currency} on ${networkShortName(networkName)} only. Any other network loses your funds.`}
        </p>
      </div>
    </div>
  )
}

# Agent log

A running record of where the coding agent and I disagreed, and where it got something wrong. Entries are added when they happen. The README's "Working with the agent" section is written from this file.

Each entry: what the agent proposed, what was decided, and why.

## 12 Nov 2026: design session

The whole design was decided in one long conversation before any code. The agent read the brief, raised each decision in turn with options and a recommendation, and I chose.

### Recommendations I rejected

| # | The agent recommended | I decided | Why |
|---|---|---|---|
| 1 | Correct the countdown from the server's `Date` response header, with a fallback chain for when the header is missing | Use the device clock | The header was my own first idea, and the agent backed it. Once we listed its gaps (unreadable cross-origin without an extra header, optional on 5xx, stale when cached), it was a lot of moving parts for a number that is only information. The server's status decides expiry either way. See ADR 0001 |
| 2 | Any received money stops the clock, so `underpaid` never expires | The original deadline still applies to `underpaid` | A quote is a price held for a limited time. Stopping the clock leaves the rate open with no limit. See ADR 0003 |
| 3 | A wallet payment link in the QR for plain ETH, with a `BigInt` conversion to base units, and a plain address for the tokens | The plain address in every QR | One combination behaving differently from five is not worth a conversion helper. Standard links are a follow-up once the API returns contract addresses. See ADR 0004 |
| 4 | Serve ETH's network fee literally as `3.20` ETH and flag it as unrealistic | Read catalogue fees as USD and convert them in the quote | `3.20` ETH on an order worth about 0.05 ETH makes no sense, and a shopper-facing page should not show it |
| 5 | Start over at the picker on refresh, because the brief puts persistence out of scope | Resume from a reference in the URL | A page that forgets a payment in flight is a safety problem. See ADR 0005 |
| 6 | A picker with every network visible as a card, with its fee and time | Two menus, as in the G2A reference flow | More compact, and closer to a flow shoppers already know |
| 7 | Add an order endpoint to the mock so the picker can show the merchant name and amount | Keep to the API as given; the picker shows the order reference only | We had refused to invent API elsewhere. Staying consistent mattered more than a fuller picker |

### One place I did it my own way

To tell "expired" from "expired after a partial payment", the agent proposed remembering a single fact: that money had arrived. I asked for the full sequence of statuses the page has seen, with the amounts that came with each.

The design now leans on the sequence for more than that one screen. The `failed` screen uses it to say whether money was seen. The reload case uses it to know its own history is incomplete. The dev panel shows it for debugging.

### What the agent got wrong

- **Hiding the address at zero.** The agent first proposed hiding the address the moment the countdown reached zero. That was fine while the clock was going to be corrected from the server. After I chose the device clock, the same rule would have locked out any shopper whose clock runs ahead: the countdown would sit at zero and the address would never show. The agent caught this itself when the clock decision changed and rewrote the rule so that a "still live" answer from the server brings the address back.
- **A picker the API cannot fill.** The agent drew the picker with the merchant name and "You pay €149.90", and I approved the drawing. Neither value is available before a payment exists; the API returns them only inside a payment. The agent noticed the gap later, while checking every agreed screen against the API, and the picker was redrawn.
- **About the payment state machine.** The brief says there are "six more states" beyond the four in its diagram. The API defines four more. I pointed this out before the agent read the brief, so it did not get the chance to miscount; it confirmed eight. It made no factual error about the statuses in this session. The nearest thing was entry 2 above: it wanted to treat `underpaid` like `detected`, as a state where the clock should stop.

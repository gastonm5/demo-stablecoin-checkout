# ADR 0004: The QR code holds the address only

**Status:** accepted, 12 Nov 2026

## Context

The pay screen shows a QR code. A QR can hold a plain address, or a standard payment link that also tells the wallet the network, the token and the amount:

- Ethereum and Polygon tokens (EIP-681): `ethereum:<token contract>@<chain>/transfer?address=<recipient>&uint256=<amount in base units>`
- Solana tokens (Solana Pay): `solana:<recipient>?amount=<amount>&spl-token=<token mint>`
- Plain ETH: `ethereum:<recipient>?value=<amount in wei>`
- Tron has no widely adopted standard.

A payment link prefills the wallet, which removes the two commonest mistakes: a mistyped amount and the wrong network. My first intention was to use them wherever a standard exists.

The API returns the recipient address, the amount and the network. It does not return a token's contract address or mint address, and a token link cannot be built without one.

## Options

| Option | For | Against |
|---|---|---|
| **Plain address in every QR** | Scans in every wallet and exchange app. Nothing invented | No amount or network in the code. The shopper enters the amount themselves |
| **A table of contract addresses in the page** | Standard links for everything except Tron | The page would decide which contract counts. Polygon has two USDCs, native and bridged, and a wrong guess points the shopper at a token the merchant does not accept. Also, an Ethereum token link puts the contract in the address position, so a wallet that only half-understands the link can send to the contract itself |
| **A contract field, or a ready-made link, added to the mock's quote** | Clean | Invents an API the brief did not give |
| **Links only where no contract is needed (plain ETH)** | Uses a standard without inventing anything | One of six combinations behaves differently from the rest |

## Decision

Every QR holds the plain recipient address.

Because the code no longer carries the network, and an Ethereum address and a Polygon address look identical, the page names the network on the frame around the QR and says under it that the code holds the address only.

## Consequences

- The shopper types or pastes the amount. The "Copy amount" button copies the exact string to make that safe.
- The network is never in the code, so the page's labelling does all of that work: the banner, the address label, the copy button and the QR frame.
- The page needs no base-unit conversion, so it does no arithmetic on amounts at all. `decimals` is used only to validate incoming amounts.
- This is a follow-up waiting on the backend. If the quote carried the token contract, or better a ready-made payment link, the page would encode that. A link built by the server is the safer version, because the server already knows which contract it watches.

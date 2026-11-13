# Stablecoin Checkout Implementation Plan

> **Status: a record, not a specification.** This is the plan the build followed, with later tasks appended. Tasks are kept as they were written, so the file paths and names in each are the ones in use when it was planned; Task 16 moved some of them. The page as it is now is described in `docs/design-doc.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the hosted crypto payment page and its mock API described in `docs/design-doc.md`.

**Architecture:** A React page that derives every screen from the server's last answer through pure functions. TanStack Query holds server data and does the polling; a small Express app, mounted inside the Vite dev server, is the mock. Components render, hooks own behaviour, `src/domain` is pure, `src/api` is the boundary.

**Tech Stack:** Vite, React, TypeScript (strict), Tailwind, TanStack Query, zod, `qrcode.react`, Express, Vitest, React Testing Library, ESLint, Prettier, npm.

**Spec:** `docs/design-doc.md`, with `docs/adr/0001` to `0005` and `AGENTS.md`. Read all of them before starting any task. The screens are drawn in `docs/design/*.png`, and the HTML those images were rendered from is in `docs/design/src/`.

## Global Constraints

- **Money:** an amount is a string from the response to the screen. Never use `Number`, `parseFloat`, `toFixed`, unary `+` or arithmetic on an amount. The page shows the totals the server sends and does no maths on money.
- **Authority:** no timer and no failed request may show `expired` or `failed`. Only a server status can.
- **Address:** the address and QR render only on `awaiting_payment` and `underpaid`, and never on `awaiting_payment` once money was seen for that quote. The network is named wherever an address or QR appears.
- **Wording:** never promise an outcome the API does not state. No "refund", and no "safe" or "unaffected" in any notice.
- **Requests:** every request has a 10 s timeout, an abort signal and `cache: 'no-store'`. Reads retry; writes never retry by themselves.
- **Timings:** poll 3 s; 15 s on `expired`; backoff doubling to 30 s; request timeout 10 s; "still working" hint at 4 s; connection notice after 2 failed polls in a row; untimed "still valid" state needs a server answer from the last 10 s.
- **Dependencies:** only the ones in Tech Stack. Ask before adding any other.
- **Layers:** `src/api` must not import from `src/dev` or `mock/`. Only `src/dev` calls `/__mock`.
- **Components and hooks:** a component may hold view state that nothing else reads: a ticked box, an open dialog, an open panel. Timers, requests, subscriptions, clipboard access and anything derived from server data live in a hook or in `src/domain`.
- **Look:** follow `docs/design/*.png`. Use `docs/design/src/*.html` for structure, spacing and exact copy, translated to Tailwind classes. Do not copy its CSS wholesale. System font. The QR in the drawings is a placeholder; the real one comes from `qrcode.react`.
- **Tests:** test-first for `src/domain`, `src/api`, `src/hooks` and `mock/`. Tests sit beside the file they test (`x.test.ts`). No snapshot tests.
- **Gate:** `npm run check` (lint, typecheck, tests) passes before every commit.
- **History:** one commit per task, more if a task needs a fix. Never squash or amend. Commit as `7192634+gastonm5@users.noreply.github.com` (already set in this repo's git config). Each commit message says why and ends with a co-author line naming the model that wrote it.
- **Commit commands:** the `git commit -m` lines in the tasks give the subject only. Add a body that says why, and the co-author line.
- **Never commit** `docs/requirements/`.
- **Documents:** if a task changes behaviour the design doc or an ADR describes, update that document in the same commit. If you get something wrong or a suggestion is rejected, add an entry to `docs/agent-log.md` then.
- **Comments:** explain why, never what. No issue or PR numbers.

## Review Focus

Failure modes the design implies but does not spell out, most likely first. Each has a test in the task that owns the code.

1. **The mock restarts while a page is open.** A poll gets 404 for a payment the page has on screen. Expected: polling stops, and the page returns to the picker with "We couldn't find that payment." (Tasks 8, 9)
2. **A double click on a write.** "Continue" or "Get a new quote" pressed twice. Expected: one request. (Task 9)
3. **The clipboard is unavailable or denied.** Expected: the button says copying failed and tells the shopper to select the text; nothing throws. (Task 11)
4. **A malformed `expires_at`.** Expected: the response is rejected at the boundary, so no countdown ever shows `NaN` beside an address. (Task 4)
5. **A fiat currency code the formatter rejects.** Expected: the amount is shown as sent, followed by the code; nothing throws. (Task 10)

## File Structure

```
mock/
  fixtures.ts        catalogue, merchant, order, the six quotes
  store.ts           in-memory payments, settings, clock
  app.ts             Express app: /api and /__mock routes, fault middleware
  vitePlugin.ts      mounts the app in the dev and preview servers
src/
  api/
    schemas.ts       zod schemas, DecimalString, Payment union, parse functions
    client.ts        request(): fetch with timeout, no-store, problem parsing, ApiError
    endpoints.ts     the four API calls and two error predicates
  domain/
    money.ts         decimal-places check
    status.ts        which statuses carry money, which are final
    sequence.ts      the status sequence
    screen.ts        deriveScreen, deriveConnection
    polling.ts       pollInterval
    countdown.ts     remainingMs, formatRemaining
    format.ts        fiat, fee, time and network-name formatting
  hooks/
    paymentCache.ts  query key, cache merge, runRequote
    usePayment.ts    the polling query
    useNow.ts        device clock tick
    useOnline.ts     browser online hint
    useCurrencies.ts catalogue query
    url.ts           order_id and payment in the URL
    useCheckout.ts   picker/payment flow, create, requote, resume
    usePickerChoice.ts  the picker's two selections
    useDelayedFlag.ts   true once something has lasted a given time
    useCopy.ts          clipboard write and its feedback
    usePaymentScreen.ts screen, connection and the check at zero for one payment
    useFocusOnChange.ts moves focus to a heading when the screen changes
  components/
    CheckoutCard.tsx OrderHeader.tsx Picker.tsx
    PayScreen.tsx NetworkBanner.tsx QrFrame.tsx CopyButton.tsx ConfirmChangeDialog.tsx
    WaitingScreen.tsx CompleteScreen.tsx ExpiredScreen.tsx FailedScreen.tsx CheckingScreen.tsx
    NoticeStrip.tsx PaymentView.tsx
  dev/
    mockControl.ts   calls /__mock
    useMockSettings.ts reads the mock's settings when the panel opens
    DevPanel.tsx
  test/
    setup.ts fixtures.ts
  App.tsx main.tsx index.css
```

---

### Task 1: Project scaffold and gate

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig*.json`, `index.html`, `eslint.config.js`, `.prettierrc`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/test/setup.ts`, `src/App.test.tsx`
- Modify: `AGENTS.md` (add a Commands section)

**Interfaces:**
- Produces: npm scripts `dev`, `build`, `test`, `lint`, `typecheck`, `check`; a Vitest setup with jsdom and `@testing-library/jest-dom` matchers.

- [ ] **Step 1: Scaffold without touching existing files**

```bash
npm create vite@9.0.7 scaffold-tmp -- --template react-ts
```

The version is pinned on purpose. From 9.1 the `react-ts` template ships oxlint and TypeScript 7 with no ESLint, and the current `typescript-eslint` does not support TypeScript 7 yet. 9.0.7 is the last template with ESLint, on TypeScript 6.0 and the current Vite. This project keeps ESLint because the ban on `Number(...)` needs `no-restricted-syntax`, which oxlint does not have.

Move everything from `scaffold-tmp/` into the repo root except its `.gitignore` and `README.md`, then delete `scaffold-tmp/`. Keep the repo's own `.gitignore`.

- [ ] **Step 2: Install dependencies at their current stable versions**

```bash
npm install @tanstack/react-query zod qrcode.react
npm install -D tailwindcss @tailwindcss/vite vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom prettier eslint-config-prettier express @types/express
```

- [ ] **Step 3: Write the failing smoke test** in `src/App.test.tsx`

```tsx
test('renders the checkout shell', () => {
  render(<App />)
  expect(screen.getByRole('main')).toBeInTheDocument()
})
```

- [ ] **Step 4: Run it and see it fail**

Run: `npx vitest run src/App.test.tsx`
Expected: FAIL, because no test environment is configured.

- [ ] **Step 5: Configure the project**

- `vite.config.ts`: import `defineConfig` from `vitest/config`; plugins `react()` and `tailwindcss()`; `test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], restoreMocks: true }`.
- `src/test/setup.ts`: `import '@testing-library/jest-dom/vitest'`.
- `src/index.css`: `@import "tailwindcss";` and nothing else.
- `src/App.tsx`: a `<main>` element with no content yet. Delete the template's demo component, assets and CSS.
- `tsconfig.node.json`: add `"mock"` to `include`.
- `package.json`: set `engines.node` to the range the installed Vite's own `package.json` declares, and no lower than `>=22.12`. Add these scripts:

```json
"dev": "vite",
"build": "tsc -b && vite build",
"typecheck": "tsc -b",
"test": "vitest run",
"lint": "eslint . && prettier --check .",
"check": "npm run lint && npm run typecheck && npm test"
```

- `eslint.config.js`: keep the template's config and append `eslint-config-prettier`. Add `no-restricted-globals` for `parseFloat` and `no-restricted-syntax` for `CallExpression[callee.name='Number']`, both with the message "Amounts are strings. See AGENTS.md."
- `.prettierrc`: `{ "semi": false, "singleQuote": true }`. Add `docs/` and `dist/` to `.prettierignore`.

- [ ] **Step 6: Run the gate**

Run: `npm run check && npm run build`
Expected: all pass, one test.

- [ ] **Step 7: Add a Commands section to `AGENTS.md`**

```markdown
## Commands

- `npm run dev`: the page and the mock, on one port.
- `npm run check`: lint, typecheck and tests. Run before every commit.
- `npm test -- path/to/file.test.ts`: one test file.
```

- [ ] **Step 8: Commit**

Commit `package-lock.json` with it, so every later task runs against the same versions.

```bash
git add -A && git commit -m "Scaffold the project and its gate"
```

---

### Task 2: Mock payments API

**Files:**
- Create: `mock/fixtures.ts`, `mock/store.ts`, `mock/app.ts`, `mock/testServer.ts`, `mock/app.test.ts`

**Interfaces:**
- Produces:

```ts
// mock/store.ts
export type Fault = 'none' | 'http_500' | 'drop'
export type MockSettings = { quote_lifetime_seconds: number; delay_ms: number; fault: Fault; clock_offset_seconds: number }
export type PaymentRecord = Record<string, unknown> & { payment_reference: string; status: string }
export type RequoteResult =
  | { ok: true; payment: PaymentRecord }
  | { ok: false; reason: 'not_found' | 'not_expired' | 'unknown_pair'; expires_at?: string }
export type MockStore = {
  settings: MockSettings
  now(): number // clock() + clock_offset_seconds * 1000
  createPayment(input: { order_id: string; currency: string; network: string }): PaymentRecord | null // null: unknown pair
  getPayment(reference: string): PaymentRecord | undefined // applies expiry first
  requote(reference: string, input: { currency: string; network: string }): RequoteResult
  setStatus(reference: string, status: string, confirmations?: number): PaymentRecord | undefined
  updateSettings(patch: Partial<MockSettings>): MockSettings
  listPayments(): PaymentRecord[]
}
export function createStore(clock?: () => number): MockStore // clock defaults to Date.now

// mock/app.ts
export function createMockApp(store?: MockStore): import('express').Express

// mock/testServer.ts
export function startServer(app: import('express').Express): Promise<{ url: string; close(): Promise<void> }> // listens on port 0
```

**Fixed values** (`mock/fixtures.ts`). Every amount is a string literal. Do not compute any of them.

- Catalogue: exactly the table in design doc section 4.5, in that order. Currency names: `Tether`, `USD Coin`, `Ethereum`.
- Merchant `{ name: 'Nordwind Audio', logo_url: null }`. Order `{ currency: 'EUR', amount: '149.90' }`.
- Defaults: `quote_lifetime_seconds: 900`, `delay_ms: 0`, `fault: 'none'`, `clock_offset_seconds: 0`.
- References: `AQH-100306-PMT`, then `AQH-100307-PMT`, counting up.
- `tx_hash`: `'9d1f4c8a2be7...'`, as the brief writes it.
- Quotes, keyed `CODE:network`:

| Pair | `exchange_rate` | `crypto_amount` | `network_fee` | `total_due` | `crypto_address` |
|---|---|---|---|---|---|
| `USDT:tron` | `0.9214` | `162.69` | `1.00` | `163.69` | `TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e` |
| `USDT:ethereum` | `0.9216` | `162.651910` | `4.50` | `167.151910` | `0x72c44d0e29ae46740cd165165780c8a5ac92fd0e` |
| `USDC:ethereum` | `0.9209` | `162.775546` | `4.50` | `167.275546` | `0x8f9581fb11f3cb441fc9f969bb2468fc64f9fbe2` |
| `USDC:polygon` | `0.9211` | `162.740202` | `0.10` | `162.840202` | `0x80afb2d9d4b673f405cecb802badcf5d0d64d4cb` |
| `USDC:solana` | `0.9212` | `162.722536` | `0.01` | `162.732536` | `7Zq6TfGfDLbTzYNbM35keafauXirCsT6yskoKoSRFffL` |
| `ETH:ethereum` | `2764.20` | `0.054229071702481731` | `0.001066666666666667` | `0.055295738369148398` | `0x39fc48188b62b7b07580aa3c2c6801d075f54893` |

- Amounts used when a status is forced:

| Pair | underpaid: `amount_received` / `amount_outstanding` | overpaid: `amount_received` / `amount_excess` |
|---|---|---|
| `USDT:tron` | `120.00` / `43.69` | `180.00` / `16.31` |
| `USDT:ethereum` | `120.00` / `47.151910` | `180.00` / `12.848090` |
| `USDC:ethereum` | `120.00` / `47.275546` | `180.00` / `12.724454` |
| `USDC:polygon` | `120.00` / `42.840202` | `180.00` / `17.159798` |
| `USDC:solana` | `120.00` / `42.732536` | `180.00` / `17.267464` |
| `ETH:ethereum` | `0.040000000000000000` / `0.015295738369148398` | `0.060000000000000000` / `0.004704261630851602` |

**Behaviour:**

- Responses follow design doc section 4.5. `GET /api/payments/:reference` returns the whole payment plus the status's fields.
- Every `/api` response carries `Cache-Control: no-store`.
- Expiry is applied on read: an `awaiting_payment` payment whose `expires_at` has passed becomes `expired` with `expired_at` equal to that `expires_at`. No other status ever expires by itself.
- Requote from `expired`: 201, same reference, the new pair's quote, a fresh `expires_at`, status `awaiting_payment`, earlier status fields removed. From any other status: 409.
- Errors are `application/problem+json` with `type`, `title`, `status`, `detail`. A body that is not valid JSON must get the 422 below too, not Express's default error page, so the app needs its own error-handling middleware:

| Case | Status | `type` |
|---|---|---|
| Requote when not expired | 409 | `https://developers.triple-a.io/errors/quote-not-expired` |
| Unknown reference | 404 | `https://developers.triple-a.io/errors/payment-not-found` |
| Unknown currency and network pair, or a malformed body | 422 | `https://developers.triple-a.io/errors/invalid-request` |

- `setStatus` sets these fields and removes the fields of the previous status:

| Status | Fields |
|---|---|
| `awaiting_payment` | none; the quote is unchanged |
| `detected` | `confirmations: 0`, `required_confirmations`, `amount_received` = `total_due`, `tx_hash`, `detected_at` = now |
| `confirming` | `confirmations` = the given number, default 1, clamped to 0..required; the rest as `detected` without `detected_at` |
| `paid` | `confirmations` = required, `required_confirmations`, `amount_received` = `total_due`, `tx_hash`, `settled_at` = now |
| `underpaid` | the pair's underpaid amounts, `crypto_address`, `tx_hash` |
| `overpaid` | the pair's overpaid amounts, `tx_hash`, `settled_at` = now |
| `expired` | `expired_at` = now |
| `failed` | `reason: 'settlement_rejected'` |

- [ ] **Step 1: Write the failing tests** in `mock/app.test.ts`. First line: `// @vitest-environment node`. Each test starts its own app with `startServer(createMockApp(createStore(() => t)))`, where `t` is a number the test can advance.

```ts
test('serves the catalogue exactly as the brief gives it', async () => {
  const { currencies } = await getJson('/api/currencies')
  expect(currencies.map((c) => [c.code, c.decimals])).toEqual([['USDT', 6], ['USDC', 6], ['ETH', 18]])
  expect(currencies[0].networks[0]).toEqual({ id: 'tron', name: 'Tron (TRC-20)', network_fee: '1.00', required_confirmations: 1, avg_confirmation_seconds: 60 })
  expect(currencies[2].networks[0].network_fee).toBe('3.20')
})

test('creates the payment the brief shows for USDT on Tron', async () => {
  const res = await post('/api/payments', { order_id: 'ORD-88213', currency: 'USDT', network: 'tron' })
  expect(res.status).toBe(201)
  expect(res.headers.get('cache-control')).toBe('no-store')
  const body = await res.json()
  expect(body).toMatchObject({
    payment_reference: 'AQH-100306-PMT', order_id: 'ORD-88213', status: 'awaiting_payment',
    merchant: { name: 'Nordwind Audio', logo_url: null }, order: { currency: 'EUR', amount: '149.90' },
    quote: { crypto_currency: 'USDT', network: 'tron', network_name: 'Tron (TRC-20)', exchange_rate: '0.9214',
      crypto_amount: '162.69', network_fee: '1.00', total_due: '163.69',
      crypto_address: 'TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e', required_confirmations: 1 },
  })
  expect(Date.parse(body.quote.expires_at)).toBe(t + 900_000)
})

test('gives every create a new reference', ...) // AQH-100306-PMT then AQH-100307-PMT

test.each(SIX_PAIRS)('%s:%s amounts are strings within the currency decimals', ...)
// for crypto_amount, network_fee, total_due and the forced underpaid/overpaid amounts:
// typeof === 'string', matches /^\d+(\.\d+)?$/, and digits after the dot <= decimals

test('an ETH quote keeps all eighteen places', ...) // total_due === '0.055295738369148398'

test('GET returns the whole payment with the status fields', ...) // after setStatus(ref, 'detected'): has merchant, order, quote, confirmations 0, detected_at

test('awaiting_payment expires on read once the deadline passes', ...) // t += 900_001 -> status 'expired', expired_at === the old expires_at

test('a payment that has received money never expires by itself', ...) // setStatus underpaid, t += 10 * 900_000 -> still 'underpaid'

test('requote is refused unless the quote has expired', async () => {
  const res = await post(`/api/payments/${ref}/requote`, { currency: 'USDT', network: 'tron' })
  expect(res.status).toBe(409)
  expect(res.headers.get('content-type')).toContain('application/problem+json')
  expect(await res.json()).toMatchObject({ type: 'https://developers.triple-a.io/errors/quote-not-expired', status: 409 })
})

test('requote from expired keeps the reference and returns a fresh quote for the new pair', ...)
// expire it, requote to USDC:solana -> 201, same payment_reference, status 'awaiting_payment',
// quote.total_due '162.732536', expires_at === t + 900_000, no expired_at

test.each([
  ['an unknown reference', () => fetch(`${url}/api/payments/NOPE`), 404, 'payment-not-found'],
  ['an unknown reference on requote', () => post('/api/payments/NOPE/requote', { currency: 'USDT', network: 'tron' }), 404, 'payment-not-found'],
  ['an unknown pair', () => post('/api/payments', { order_id: 'ORD-1', currency: 'ETH', network: 'tron' }), 422, 'invalid-request'],
  ['a missing field', () => post('/api/payments', { order_id: 'ORD-1' }), 422, 'invalid-request'],
  ['a body that is not JSON', () => fetch(`${url}/api/payments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{nope' }), 422, 'invalid-request'],
])('%s is a complete problem document', async (_name, send, status, slug) => {
  const res = await send()
  expect(res.status).toBe(status)
  expect(res.headers.get('content-type')).toContain('application/problem+json')
  expect(res.headers.get('cache-control')).toBe('no-store')
  const body = await res.json()
  expect(body).toMatchObject({ type: `https://developers.triple-a.io/errors/${slug}`, status })
  expect(typeof body.title).toBe('string')
  expect(typeof body.detail).toBe('string')
})
```

- [ ] **Step 2: Run and see them fail**

Run: `npx vitest run mock/app.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `mock/fixtures.ts`, `mock/store.ts`, `mock/app.ts`, `mock/testServer.ts`** to the interfaces and behaviour above. Use `express.json()` and one router mounted at `/api`.

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run mock/app.test.ts`
Expected: PASS.

- [ ] **Step 5: Gate and commit**

```bash
npm run check && git add -A && git commit -m "Add the mock payments API"
```

---

### Task 3: Mock control endpoints, faults, and the dev-server mount

**Files:**
- Modify: `mock/app.ts`, `vite.config.ts`, `docs/design-doc.md` (section 11, the verification list)
- Create: `mock/vitePlugin.ts`, `mock/control.test.ts`

**Interfaces:**
- Consumes: `MockStore`, `createMockApp`, `startServer` from Task 2.
- Produces:
  - `GET /__mock/state` → `{ settings: MockSettings, payments: PaymentRecord[] }`, oldest first.
  - `POST /__mock/payments/:reference/status` with `{ status, confirmations? }` → 200 with the payment; 404 for an unknown reference; 422 for a status that is not one of the eight.
  - `POST /__mock/settings` with a partial `MockSettings` → 200 with the full settings; 422 for a negative number or an unknown `fault`.
  - `export function mockApiPlugin(): import('vite').Plugin` in `mock/vitePlugin.ts`.

**Behaviour:**

- Faults apply to `/api` only, in this order: wait `delay_ms`; then `http_500` answers 500 with a problem body of type `https://developers.triple-a.io/errors/internal`; `drop` calls `req.socket.destroy()` and sends nothing.
- `/__mock` routes are never delayed, failed or dropped.
- `mockApiPlugin` adds one `createMockApp()` to `server.middlewares` in both `configureServer` and `configurePreviewServer`.

- [ ] **Step 1: Write the failing tests** in `mock/control.test.ts` (`// @vitest-environment node`)

```ts
test.each([
  ['awaiting_payment', []],
  ['detected', ['confirmations', 'required_confirmations', 'amount_received', 'tx_hash', 'detected_at']],
  ['confirming', ['confirmations', 'required_confirmations', 'amount_received', 'tx_hash']],
  ['paid', ['confirmations', 'required_confirmations', 'amount_received', 'tx_hash', 'settled_at']],
  ['underpaid', ['amount_received', 'amount_outstanding', 'crypto_address', 'tx_hash']],
  ['overpaid', ['amount_received', 'amount_excess', 'tx_hash', 'settled_at']],
  ['expired', ['expired_at']],
  ['failed', ['reason']],
])('setting %s adds exactly its fields', async (status, fields) => {
  // set 'paid' first so stale fields would show, then set `status`
  const body = await setStatus(ref, status)
  const base = ['payment_reference', 'order_id', 'status', 'merchant', 'order', 'quote']
  expect(Object.keys(body).sort()).toEqual([...base, ...fields].sort())
})

test('confirming takes a confirmations count', ...) // USDT:ethereum, confirmations 2 -> { confirmations: 2, required_confirmations: 3 }
test('underpaid on Tron uses the brief amounts', ...) // amount_received '120.00', amount_outstanding '43.69'
test('a status outside the eight is refused', ...) // 422
test('quote lifetime applies to new quotes', ...) // settings { quote_lifetime_seconds: 30 } -> expires_at === t + 30_000
test('the server clock offset moves expires_at', ...) // { clock_offset_seconds: 300 } -> expires_at === t + 300_000 + 900_000
test('http_500 fails API requests with a complete problem document', ...) // status 500, problem content type, type ends '/internal', title and detail are strings
test('drop closes the connection without a response', async () => {
  await expect(fetch(`${url}/api/currencies`)).rejects.toThrow()
})
test('a delay holds the response', ...) // delay_ms 80 -> elapsed >= 80
test('control endpoints ignore faults', ...) // with fault 'drop', GET /__mock/state still answers 200
test('state lists settings and payments', ...)
```

- [ ] **Step 2: Run and see them fail**

Run: `npx vitest run mock/control.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the control routes and the fault middleware in `mock/app.ts`**, and `mock/vitePlugin.ts`. Add `mockApiPlugin()` to the plugins in `vite.config.ts`.

- [ ] **Step 4: Run and see them pass**

Run: `npx vitest run mock`
Expected: PASS.

- [ ] **Step 5: Verify a dropped connection through the dev server**

Start `npm run dev` in the background, then:

```bash
curl -s localhost:5173/api/currencies | head -c 60
curl -s -X POST localhost:5173/__mock/settings -H 'content-type: application/json' -d '{"fault":"drop"}'
curl -sS -o /dev/null -w '%{http_code}\n' localhost:5173/api/currencies; echo "curl exit $?"
```

Expected: the first prints JSON. The last prints `000` and a curl exit code that is not 0, meaning no HTTP response arrived. Stop the dev server.

If the last command prints `500` instead, stop and report it: the mock would have to run beside the dev server, which changes this task.

- [ ] **Step 6: Record the result in the design doc.** In section 11, remove the dropped-connection line from "Three things I still have to verify" and say what was observed.

- [ ] **Step 7: Gate and commit**

```bash
npm run check && git add -A && git commit -m "Add mock control endpoints, faults and the dev-server mount"
```

---

### Task 4: Response schemas and the amount guard

**Files:**
- Create: `src/api/schemas.ts`, `src/api/schemas.test.ts`, `src/domain/money.ts`, `src/domain/money.test.ts`, `src/test/fixtures.ts`

**Interfaces:**
- Produces:

```ts
// src/api/schemas.ts
export type DecimalString = string & z.BRAND<'DecimalString'> // matches /^\d+(\.\d+)?$/
export type Network = { id: string; name: string; network_fee: DecimalString; required_confirmations: number; avg_confirmation_seconds: number }
export type Currency = { code: string; name: string; decimals: number; networks: Network[] }
export type Quote = {
  crypto_currency: string; network: string; network_name: string
  exchange_rate: DecimalString; crypto_amount: DecimalString; network_fee: DecimalString; total_due: DecimalString
  crypto_address: string; required_confirmations: number; expires_at: string // ISO date-time, validated
}
export type PaymentBase = {
  payment_reference: string; order_id: string
  merchant: { name: string; logo_url: string | null }
  order: { currency: string; amount: DecimalString }
  quote: Quote
}
export type PaymentState =
  | { status: 'awaiting_payment' }
  | { status: 'detected'; confirmations: number; required_confirmations: number; amount_received: DecimalString; tx_hash: string; detected_at: string }
  | { status: 'confirming'; confirmations: number; required_confirmations: number; amount_received: DecimalString; tx_hash: string }
  | { status: 'paid'; confirmations: number; required_confirmations: number; amount_received: DecimalString; tx_hash: string; settled_at: string }
  | { status: 'underpaid'; amount_received: DecimalString; amount_outstanding: DecimalString; crypto_address: string; tx_hash: string }
  | { status: 'overpaid'; amount_received: DecimalString; amount_excess: DecimalString; tx_hash: string; settled_at: string }
  | { status: 'expired'; expired_at: string }
  | { status: 'failed'; reason: string }
  | { status: 'unknown'; raw_status: string }
export type Payment = PaymentBase & PaymentState
export type PaymentStatus = Payment['status']
export type Problem = { type: string; title: string; status: number; detail?: string }
export function parseCurrencies(json: unknown): Currency[] // throws on an invalid body
export function parsePayment(json: unknown): Payment // throws on an invalid body; an unrecognised status string becomes 'unknown'
export function parseProblem(json: unknown): Problem | null

// src/domain/money.ts
export function fractionDigits(amount: DecimalString): number
export function fitsDecimals(amount: DecimalString, decimals: number): boolean
export function amountsToSend(payment: Payment): DecimalString[] // quote.total_due, plus amount_outstanding on 'underpaid'

// src/test/fixtures.ts — plain JSON builders for tests, values from the brief
export function paymentJson(state?: Record<string, unknown>, quote?: Record<string, unknown>): Record<string, unknown> // USDT:tron, AQH-100306-PMT, awaiting_payment by default
export function makePayment(state?: Record<string, unknown>, quote?: Record<string, unknown>): Payment // parsePayment(paymentJson(...))
export const CURRENCIES_JSON: unknown // the full catalogue body
export const STATE_FIXTURES: Record<string, Record<string, unknown>> // the brief's fields for each of the eight statuses
```

`STATE_FIXTURES` holds the brief's values: `detected` `{ confirmations: 0, required_confirmations: 1, amount_received: '163.69', tx_hash: '9d1f4c8a2be7...', detected_at: '2026-08-14T08:44:02.120Z' }`; `confirming` `{ confirmations: 2, required_confirmations: 3, amount_received: '163.69', tx_hash }`; `paid` `{ confirmations: 3, required_confirmations: 3, amount_received: '163.69', tx_hash, settled_at: '2026-08-14T08:47:31.004Z' }`; `underpaid` `{ amount_received: '120.00', amount_outstanding: '43.69', crypto_address: 'TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e', tx_hash }`; `overpaid` `{ amount_received: '180.00', amount_excess: '16.31', tx_hash, settled_at: '2026-08-14T08:47:31.004Z' }`; `expired` `{ expired_at: '2026-08-14T08:52:10.842Z' }`; `failed` `{ reason: 'settlement_rejected' }`.

- [ ] **Step 1: Write the failing tests**

```ts
// src/api/schemas.test.ts
test.each(Object.keys(STATE_FIXTURES))('parses the %s fixture', (status) => {
  const p = parsePayment(paymentJson({ status, ...STATE_FIXTURES[status] }))
  expect(p.status).toBe(status)
  expect(p.quote.total_due).toBe('163.69')
})
test('parses the catalogue', () => expect(parseCurrencies(CURRENCIES_JSON)).toHaveLength(3))
test('keeps an eighteen-place amount exact', () => {
  const p = parsePayment(paymentJson({}, { total_due: '0.055295738369148398' }))
  expect(p.quote.total_due).toBe('0.055295738369148398')
})
test.each([163.69, '1e3', '-1', '1.', '.5', '', ' 1', '1,5'])('rejects %p as an amount', (bad) => {
  expect(() => parsePayment(paymentJson({}, { total_due: bad }))).toThrow()
})
test('rejects a numeric amount inside a status', () => {
  expect(() => parsePayment(paymentJson({ status: 'detected', ...STATE_FIXTURES.detected, amount_received: 163.69 }))).toThrow()
})
test('maps a status it does not know to unknown', () => {
  expect(parsePayment(paymentJson({ status: 'refunded' }))).toMatchObject({ status: 'unknown', raw_status: 'refunded' })
})
test.each(['2026-08-14T08:52:10.842Z', '2026-08-14T11:52:10+03:00'])('accepts %s as expires_at', (ok) => {
  expect(parsePayment(paymentJson({}, { expires_at: ok })).quote.expires_at).toBe(ok)
})
test.each(['', 'soon', '2026-08-14', '2026-08-14T08:52:10', 1794503441])('rejects %p as expires_at', (bad) => {
  expect(() => parsePayment(paymentJson({}, { expires_at: bad }))).toThrow()
})
test('rejects a known status that is missing its fields', () => {
  expect(() => parsePayment(paymentJson({ status: 'underpaid' }))).toThrow()
})
test('reads a problem body, and returns null for anything else', ...)

// src/domain/money.test.ts
test.each([['163.69', 2], ['5', 0], ['0.055295738369148398', 18], ['120.00', 2]])('%s has %i fraction digits', ...)
test.each([['163.69', 6, true], ['0.055295738369148398', 18, true], ['1.1234567', 6, false], ['5', 0, true]])('fitsDecimals(%s, %i) is %s', ...)
test('amountsToSend is the total, plus the outstanding amount on underpaid', ...) // ['163.69'] and ['163.69', '43.69']
```

- [ ] **Step 2: Run and see them fail**

Run: `npx vitest run src/api/schemas.test.ts src/domain/money.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement the schemas, `money.ts` and the fixtures.** Parse the base shape and the status separately: read `status` as a string, pick the matching state schema, and fall back to `{ status: 'unknown', raw_status }`. Validate every timestamp field with `z.iso.datetime({ offset: true })`, which accepts `Z` and a numeric offset and rejects a time with no zone.

- [ ] **Step 4: Run and see them pass**, then gate and commit

```bash
npm run check && git add -A && git commit -m "Validate responses and keep amounts as strings"
```

---

### Task 5: API client

**Files:**
- Create: `src/api/client.ts`, `src/api/client.test.ts`, `src/api/endpoints.ts`, `src/api/endpoints.test.ts`

**Interfaces:**
- Consumes: `parseCurrencies`, `parsePayment`, `parseProblem`, `Problem`, `Currency`, `Payment` from Task 4.
- Produces:

```ts
// src/api/client.ts
export const REQUEST_TIMEOUT_MS = 10_000
export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'invalid'
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number // for 'http'
  readonly problem?: Problem // for 'http', when the body is a problem document
}
export function request<T>(path: string, options: {
  method?: 'GET' | 'POST'; body?: unknown; signal?: AbortSignal; parse: (json: unknown) => T
}): Promise<T>

// src/api/endpoints.ts
export type Choice = { currency: string; network: string }
export function getCurrencies(signal?: AbortSignal): Promise<Currency[]>
export function createPayment(body: { order_id: string } & Choice, signal?: AbortSignal): Promise<Payment>
export function getPayment(reference: string, signal?: AbortSignal): Promise<Payment>
export function requotePayment(reference: string, body: Choice, signal?: AbortSignal): Promise<Payment>
export function isQuoteNotExpired(error: unknown): boolean // 'http' 409 whose problem.type ends with '/quote-not-expired'
export function isNotFound(error: unknown): boolean // 'http' 404
```

**Behaviour:** `fetch(path, { method, body, headers, cache: 'no-store', signal })`. Implement the timeout with `setTimeout` and an `AbortController` of your own, not `AbortSignal.timeout`, so fake timers can drive it. A caller's abort rejects with the original `AbortError`, not an `ApiError`. A response that is not 2xx is `'http'`. A body that is not JSON, or that `parse` rejects, is `'invalid'`. A rejected `fetch` is `'network'`.

- [ ] **Step 1: Write the failing tests** (stub `fetch` with `vi.stubGlobal`)

```ts
test('sends no-store and JSON headers', ...) // fetch called with { cache: 'no-store' }
test('returns the parsed body on 200', ...)
test('a 500 is an http error with the status', ...) // kind 'http', status 500
test('a 409 carries the problem body', ...) // problem.type ends with '/quote-not-expired'
test('a body that is not JSON is invalid', ...) // kind 'invalid'
test('a body the parser rejects is invalid', ...)
test('a rejected fetch is a network error', ...) // fetch rejects TypeError -> kind 'network'
test('gives up after ten seconds', async () => {
  vi.useFakeTimers()
  fetchMock.mockImplementation((_url, init) => new Promise((_res, rej) => init.signal.addEventListener('abort', () => rej(init.signal.reason))))
  const p = request('/api/x', { parse: (j) => j })
  const assertion = expect(p).rejects.toMatchObject({ kind: 'timeout' })
  await vi.advanceTimersByTimeAsync(10_000)
  await assertion
})
test('a caller abort is not an ApiError', ...) // rejects with name 'AbortError'
test('clears its timer when the request settles', ...) // vi.getTimerCount() === 0 afterwards

// endpoints.test.ts
test('createPayment posts the order and the choice', ...) // POST /api/payments, body { order_id, currency, network }
test('requotePayment posts the choice to the requote path', ...)
test('getPayment encodes the reference', ...) // encodeURIComponent
test('isQuoteNotExpired and isNotFound recognise their errors and nothing else', ...)
```

- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run src/api`. Expected: FAIL.
- [ ] **Step 3: Implement `client.ts` and `endpoints.ts`.**
- [ ] **Step 4: Run and see them pass**, then gate and commit

```bash
npm run check && git add -A && git commit -m "Add the API client with timeouts and typed errors"
```

---

### Task 6: The status sequence

**Files:**
- Create: `src/domain/status.ts`, `src/domain/sequence.ts`, `src/domain/sequence.test.ts`

**Interfaces:**
- Consumes: `Payment`, `PaymentStatus`, `DecimalString` from Task 4.
- Produces:

```ts
// src/domain/status.ts
export const FINAL_STATUSES = ['paid', 'overpaid', 'failed'] as const
export const MONEY_STATUSES = ['detected', 'confirming', 'paid', 'underpaid', 'overpaid'] as const
export function isFinal(status: PaymentStatus): boolean
export function carriesMoney(status: PaymentStatus): boolean

// src/domain/sequence.ts
export type SequenceEntry = {
  status: PaymentStatus; at: number
  amount_received?: DecimalString; amount_outstanding?: DecimalString; tx_hash?: string
}
export type StatusSequence = {
  startedFrom: 'creation' | 'reload'
  quoteExpiresAt: string // the expires_at of the quote the latest entries belong to
  quoteStartIndex: number // index of the first entry of the current quote
  entries: SequenceEntry[]
}
export function startSequence(payment: Payment, startedFrom: 'creation' | 'reload', at: number): StatusSequence
export function recordStatus(sequence: StatusSequence, payment: Payment, at: number): StatusSequence
export function currentQuote(sequence: StatusSequence): SequenceEntry[]
export function moneySeen(entries: SequenceEntry[]): boolean
export function lastMoney(entries: SequenceEntry[]): SequenceEntry | undefined
```

**Behaviour:** `recordStatus` never mutates its input. If `payment.quote.expires_at` differs from `quoteExpiresAt`, a new quote has begun: append an entry and point `quoteStartIndex` at it. Otherwise, a repeated status replaces the last entry (keeping the newer fields), and a new status appends.

- [ ] **Step 1: Write the failing tests**

```ts
test('starts with one entry', ...) // entries [{ status: 'awaiting_payment', at: 1000 }], quoteStartIndex 0
test('a repeated status updates the last entry', () => {
  let s = startSequence(makePayment(), 'creation', 1000)
  s = recordStatus(s, makePayment({ status: 'underpaid', ...STATE_FIXTURES.underpaid }), 2000)
  s = recordStatus(s, makePayment({ status: 'underpaid', ...STATE_FIXTURES.underpaid, amount_received: '140.00', amount_outstanding: '23.69' }), 3000)
  expect(s.entries).toHaveLength(2)
  expect(s.entries[1]).toMatchObject({ status: 'underpaid', amount_received: '140.00', amount_outstanding: '23.69' })
})
test('a new status appends', ...)
test('a new expires_at starts a new quote', () => {
  // awaiting -> expired -> awaiting with a different expires_at
  expect(s.quoteStartIndex).toBe(2)
  expect(currentQuote(s).map((e) => e.status)).toEqual(['awaiting_payment'])
})
test('a backwards status on the same quote stays in the current quote', ...) // detected -> awaiting_payment, same expires_at: currentQuote has both
test('does not mutate the sequence it is given', ...)
test('moneySeen and lastMoney', ...) // lastMoney returns the underpaid entry with its amounts
test('carriesMoney and isFinal', ...) // expired: neither; overpaid: both; unknown: neither
```

- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run src/domain/sequence.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `status.ts` and `sequence.ts`.**
- [ ] **Step 4: Run and see them pass**, then gate and commit

```bash
npm run check && git add -A && git commit -m "Record the sequence of statuses a payment has shown"
```

---

### Task 7: Screen derivation, poll interval and countdown maths

**Files:**
- Create: `src/domain/screen.ts`, `src/domain/screen.test.ts`, `src/domain/polling.ts`, `src/domain/polling.test.ts`, `src/domain/countdown.ts`, `src/domain/countdown.test.ts`

**Interfaces:**
- Consumes: Tasks 4 and 6.
- Produces:

```ts
// src/domain/screen.ts
export const FRESH_ANSWER_MS = 10_000
export const FAILURES_BEFORE_NOTICE = 2
export type ClockState = 'running' | 'checking' | 'still_valid' | 'cannot_confirm' | 'none'
export type Screen =
  | { kind: 'pay'; mode: 'full' | 'remaining'; clock: ClockState; showAddress: boolean; remainingMs: number | null }
  | { kind: 'pay_loading' }
  | { kind: 'waiting' }
  | { kind: 'complete'; overpaid: boolean }
  | { kind: 'expired'; variant: 'plain' | 'cautious' | 'dead_end'; after: 'partial' | 'payment' | null }
  | { kind: 'failed'; moneySeen: 'yes' | 'no' | 'unknown' }
  | { kind: 'checking' }
export type ScreenInput = {
  payment: Payment
  sequence: StatusSequence
  now: number // device clock, ms
  lastSuccessAt: number // device time of the last valid response for this payment
  lastFailureAt: number | null
  amountsChecked: boolean // the currency list is loaded and amountsToSend(payment) all fit its decimals
}
export function deriveScreen(input: ScreenInput): Screen
export type Connection = 'ok' | 'offline' | 'unreachable'
export function deriveConnection(online: boolean, consecutiveFailures: number): Connection

// src/domain/polling.ts
export const POLL_ACTIVE_MS = 3_000
export const POLL_EXPIRED_MS = 15_000
export const POLL_MAX_BACKOFF_MS = 30_000
export function pollInterval(status: PaymentStatus | undefined, consecutiveFailures: number): number | false

// src/domain/countdown.ts
export function remainingMs(expiresAt: string, now: number): number
export function formatRemaining(ms: number): string
```

**Rules for `deriveScreen`**, in this order (design doc sections 3.4 and 5):

1. `paid` → `complete`, `overpaid: false`. `overpaid` → `complete`, `overpaid: true`.
2. `detected`, `confirming` → `waiting`.
3. `unknown` → `checking`.
4. `failed` → `moneySeen: 'yes'` if any entry in the whole sequence carries money; else `'unknown'` if `startedFrom` is `'reload'`; else `'no'`.
5. `expired` → look at the entry just before the last one in the current quote. If it carries money: `dead_end`, with `after: 'partial'` when it is `underpaid` and `'payment'` otherwise. Else `cautious` if `startedFrom` is `'reload'`. Else `plain`. `after` is `null` unless `dead_end`.
6. `awaiting_payment` with money seen in the current quote → `checking`.
7. `awaiting_payment` or `underpaid` with `amountsChecked` false → `pay_loading`.
8. `underpaid` → `pay`, `mode: 'remaining'`, `clock: 'none'`, `showAddress: true`, `remainingMs: null`.
9. `awaiting_payment` → `pay`, `mode: 'full'`. With `deadline = Date.parse(expires_at)` and `left = deadline - now`:
   - `left > 0`: `clock: 'running'`, `showAddress: true`, `remainingMs: left`.
   - otherwise `remainingMs: 0`, and:
     - `lastSuccessAt >= deadline` and `now - lastSuccessAt <= FRESH_ANSWER_MS`: `'still_valid'`, `showAddress: true`.
     - else `lastFailureAt !== null`, `lastFailureAt > lastSuccessAt` and `lastFailureAt >= deadline`: `'cannot_confirm'`, `showAddress: false`.
     - else `'checking'`, `showAddress: false`.

Write the status switch so that a new member of `PaymentStatus` fails to compile (a `never` check in the default branch).

**Rules for the others:**

- `deriveConnection`: `'offline'` when `online` is false; `'unreachable'` when `consecutiveFailures >= 2`; else `'ok'`.
- `pollInterval`: `false` for a final status. Otherwise `base` is 15 000 for `expired` and 3 000 for everything else, including `undefined`. With no failures return `base`. With `n` failures return `min(max(base, 3000 * 2 ** n), 30_000)`.
- `formatRemaining`: whole seconds, rounded down, never below zero. Under an hour `m:ss`; from an hour `h:mm:ss`.

- [ ] **Step 1: Write the failing tests**

```ts
// screen.test.ts — D is the deadline: Date.parse of the fixture's expires_at
const input = (over: Partial<ScreenInput>): ScreenInput => ({
  payment: makePayment(), sequence: startSequence(makePayment(), 'creation', D - 60_000),
  now: D - 30_000, lastSuccessAt: D - 31_000, lastFailureAt: null, amountsChecked: true, ...over,
})
test('time left shows the pay screen with a running clock', () => {
  expect(deriveScreen(input({}))).toEqual({ kind: 'pay', mode: 'full', clock: 'running', showAddress: true, remainingMs: 30_000 })
})
test.each([
  ['checking: at zero with no answer since the deadline', { now: D + 1, lastSuccessAt: D - 500 }, 'checking', false],
  ['still valid: a fresh answer after the deadline', { now: D + 5_000, lastSuccessAt: D + 100 }, 'still_valid', true],
  ['checking again: that answer is older than ten seconds', { now: D + 10_200, lastSuccessAt: D + 100 }, 'checking', false],
  ['cannot confirm: the check after the deadline failed', { now: D + 1_000, lastSuccessAt: D - 500, lastFailureAt: D + 200 }, 'cannot_confirm', false],
])('%s', (_name, over, clock, showAddress) => {
  expect(deriveScreen(input(over))).toMatchObject({ kind: 'pay', clock, showAddress, remainingMs: 0 })
})
test('a clock two minutes behind after a hidden tab is just a smaller number', ...) // now: D - 150_000 then D - 30_000 -> remainingMs 30_000
test('underpaid shows the remaining amount with no clock', ...) // { kind: 'pay', mode: 'remaining', clock: 'none', showAddress: true, remainingMs: null }
test('underpaid past the old deadline still shows the address', ...) // now: D + 3_600_000 -> same
test('awaiting_payment after money was seen hides the address', ...) // sequence awaiting -> detected -> awaiting: { kind: 'checking' }
test('the pay screen waits for the amount check', ...) // amountsChecked false: awaiting and underpaid -> pay_loading
test('status-only screens do not wait for the amount check', ...) // amountsChecked false + detected -> waiting
test.each([
  ['plain', ['awaiting_payment', 'expired'], 'creation', { variant: 'plain', after: null }],
  ['dead end after a partial payment', ['awaiting_payment', 'underpaid', 'expired'], 'creation', { variant: 'dead_end', after: 'partial' }],
  ['dead end after a full payment was seen', ['awaiting_payment', 'detected', 'expired'], 'creation', { variant: 'dead_end', after: 'payment' }],
  ['plain again when the money went away first', ['awaiting_payment', 'detected', 'awaiting_payment', 'expired'], 'creation', { variant: 'plain', after: null }],
  ['cautious after a reload', ['expired'], 'reload', { variant: 'cautious', after: null }],
  ['evidence beats caution', ['underpaid', 'expired'], 'reload', { variant: 'dead_end', after: 'partial' }],
])('expired: %s', ...)
test('expired after a requote ignores money on the earlier quote', ...) // underpaid, expired, then a new expires_at: awaiting, expired -> plain
test.each([
  [['awaiting_payment', 'failed'], 'creation', 'no'],
  [['awaiting_payment', 'confirming', 'failed'], 'creation', 'yes'],
  [['failed'], 'reload', 'unknown'],
])('failed: %j from %s -> moneySeen %s', ...)
test('paid, overpaid, detected, confirming and unknown', ...)
test('deriveConnection', ...) // (false, 0) offline; (true, 1) ok; (true, 2) unreachable; (false, 5) offline

// polling.test.ts
test.each([
  [undefined, 0, 3_000], ['awaiting_payment', 0, 3_000], ['underpaid', 0, 3_000], ['unknown', 0, 3_000],
  ['expired', 0, 15_000], ['paid', 0, false], ['overpaid', 0, false], ['failed', 0, false], ['failed', 3, false],
  ['awaiting_payment', 1, 6_000], ['awaiting_payment', 2, 12_000], ['awaiting_payment', 3, 24_000], ['awaiting_payment', 4, 30_000],
  ['awaiting_payment', 9, 30_000], ['expired', 1, 15_000], ['expired', 4, 30_000],
])('pollInterval(%s, %i) is %s', ...)

// countdown.test.ts
test.each([[767_000, '12:47'], [59_999, '0:59'], [0, '0:00'], [-5, '0:00'], [3_723_000, '1:02:03']])('formatRemaining(%i) is %s', ...)
test('remainingMs is the deadline minus now', ...)
```

- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run src/domain`. Expected: FAIL.
- [ ] **Step 3: Implement `screen.ts`, `polling.ts` and `countdown.ts`** to the rules above.
- [ ] **Step 4: Run and see them pass**, then gate and commit

```bash
npm run check && git add -A && git commit -m "Derive the screen, the poll interval and the countdown from pure functions"
```

---

### Task 8: The polling hook

**Files:**
- Create: `src/hooks/paymentCache.ts`, `src/hooks/usePayment.ts`, `src/hooks/usePayment.test.tsx`, `src/hooks/useNow.ts`, `src/hooks/useNow.test.tsx`, `src/hooks/useOnline.ts`, `src/test/query.tsx`

**Interfaces:**
- Consumes: `getPayment`, `requotePayment`, `Choice`, `isQuoteNotExpired`, `isNotFound` (Task 5); `startSequence`, `recordStatus` (Task 6); `pollInterval` (Task 7).
- Produces:

```ts
// src/hooks/paymentCache.ts
export type PaymentEntry = { payment: Payment; sequence: StatusSequence }
export const paymentKey = (reference: string) => ['payment', reference] as const
export function mergePayment(previous: PaymentEntry | undefined, payment: Payment, at: number): PaymentEntry
// previous undefined -> startSequence(payment, 'reload', at); otherwise recordStatus
export function seedCreatedPayment(client: QueryClient, payment: Payment, at: number): void // startSequence(payment, 'creation', at)
export function runRequote(client: QueryClient, reference: string, choice: Choice): Promise<Payment>

// src/hooks/usePayment.ts
export type UsePaymentResult = {
  entry: PaymentEntry | undefined
  isLoading: boolean // no entry yet and a request is in flight
  error: unknown // the latest error, or null
  lastSuccessAt: number // 0 when there has been none
  lastFailureAt: number | null
  consecutiveFailures: number
  checkNow(): void
}
export function usePayment(reference: string | null): UsePaymentResult

// src/hooks/useNow.ts
export function useNow(intervalMs?: number): number // Date.now(); refreshed every interval (default 1000) and when the tab becomes visible

// src/hooks/useOnline.ts
export function useOnline(): boolean // navigator.onLine, kept current by the online and offline events

// src/test/query.tsx
export function createTestClient(): QueryClient // retries off, gcTime Infinity
export function withClient(client: QueryClient): React.FC<{ children: React.ReactNode }>
```

**Behaviour:**

- One query per reference, key `paymentKey(reference)`, disabled when `reference` is null. Its function calls `getPayment(reference, signal)` and returns `mergePayment(client.getQueryData(key), payment, Date.now())`.
- Options: `retry: false`, `staleTime: 0`, `refetchIntervalInBackground: false`, `refetchOnWindowFocus: 'always'`, `refetchOnReconnect: 'always'`, and `refetchInterval` returning `pollInterval(status, failures)`.
- Count consecutive failures in the hook, in React state set from the query function: 0 when it succeeds, plus one when it fails. A cancelled request is not a failure and must not be counted. Do not keep the count in a ref that is read during render, which this project's lint rules forbid, and do not use the library's `fetchFailureCount`, which resets at the start of each fetch.
- After a not-found error (`isNotFound`), `refetchInterval` returns `false`.
- `lastSuccessAt` is the query's `dataUpdatedAt`. `lastFailureAt` is its `errorUpdatedAt`, or `null` when that is 0.
- `checkNow` calls `refetch({ cancelRefetch: false })`, so it joins a request in flight.
- `runRequote`: `await client.cancelQueries({ queryKey })`, then `requotePayment`, then `client.setQueryData(key, (prev) => mergePayment(prev, payment, Date.now()))`. On any error, `await client.invalidateQueries({ queryKey })` and rethrow: the requote may have gone through, or the server may have refused it, and either way the page has to re-read the payment.
- The query keeps the library's default `networkMode`, so it does not fetch while the browser reports it is offline.

- [ ] **Step 1: Write the failing tests** in `src/hooks/usePayment.test.tsx`

Mock `../api/endpoints` with `vi.mock`, keeping the real `isNotFound` and `isQuoteNotExpired`. `getPayment` returns a promise the test controls and records its `signal`; keep a counter of requests in flight and the highest value it reached. Use `vi.useFakeTimers()` and `renderHook(() => usePayment('AQH-100306-PMT'), { wrapper: withClient(client) })`. A helper sets tab visibility:

```ts
function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}
```

```ts
test('polls every three seconds while awaiting payment', ...) // after the first answer, advance 9 s -> 3 more calls
test('stops after a final status', ...) // answer 'paid', advance 60 s -> no further call
test.each(['overpaid', 'failed'])('stops after %s', ...)
test('polls every fifteen seconds on expired', ...)
test('never has two requests in flight, whichever trigger fires', async () => {
  // hold the second request open; advance 10 s of interval ticks; call checkNow() twice; hide and show the tab
  expect(maxInFlight).toBe(1)
})
test('backs off after failures and resets after a success', ...) // gaps 6 s, 12 s, 24 s, 30 s, then 3 s
test('exposes the failure count and times', ...) // consecutiveFailures 2, lastFailureAt > lastSuccessAt
test('keeps the last payment on screen when a poll fails', ...) // entry still defined, error set
test('a hidden tab does not poll, and polls once when it returns', ...) // hidden: advance 30 s -> 0 calls; visible -> 1 call at once
test('aborts the request in flight and stops on unmount', ...) // signal.aborted true; advance 30 s -> no call; vi.getTimerCount() === 0
test('stops polling when the server no longer knows the payment', ...) // reject with a 404 ApiError -> isNotFound(result.current.error), advance 60 s -> no further call
test('a reload starts the sequence from reload', ...) // no seed -> entry.sequence.startedFrom === 'reload'
test('a seeded payment starts from creation and records status changes', ...) // seedCreatedPayment, then a poll answering 'detected' -> entries ['awaiting_payment', 'detected']
test('a requote cancels the poll in flight and cannot be overwritten by it', async () => {
  // poll in flight; runRequote(...) -> the poll's signal is aborted; requote answers awaiting_payment with a new expires_at;
  // then let the old poll's promise resolve with 'expired'
  expect(client.getQueryData<PaymentEntry>(key)?.payment.status).toBe('awaiting_payment')
})
test('a refused requote re-reads the payment', ...) // requotePayment rejects 409 -> getPayment called again, runRequote rejects
test('a requote that fails some other way re-reads the payment too', ...) // rejects with a 'timeout' ApiError -> getPayment called again
test('does not poll while the browser is offline, and polls at once when it returns', ...) // onlineManager.setOnline(false): advance 30 s -> 0 calls; setOnline(true) -> 1 call

// useOnline.test.tsx (add `src/hooks/useOnline.test.tsx` to this task's files)
test('starts from navigator.onLine', ...)
test('follows the offline and online events', ...) // dispatch 'offline' -> false; 'online' -> true
test('removes its listeners on unmount', ...) // spy on window.removeEventListener: called for both events

// useNow.test.tsx
test('ticks every second', ...)
test('refreshes at once when the tab becomes visible', ...) // advance system time 120 s with the tab hidden, show it -> value jumps
test('clears its interval and listener on unmount', ...)
```

- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run src/hooks`. Expected: FAIL.
- [ ] **Step 3: Implement `paymentCache.ts`, `usePayment.ts`, `useNow.ts`, `useOnline.ts` and `src/test/query.tsx`.**
- [ ] **Step 4: Run and see them pass.**

If "never has two requests in flight" fails because the library starts a second request for some trigger, stop and report it. ADR 0002 names the fallback, a hand-written loop, and that is a decision for the human, not this task.

- [ ] **Step 5: Record the result in the design doc.** In section 11, remove the TanStack Query line from the verification list and say what the tests showed.
- [ ] **Step 6: Gate and commit**

```bash
npm run check && git add -A && git commit -m "Poll the payment through one query and prove it never overlaps"
```

---

### Task 9: The checkout flow hook

**Files:**
- Create: `src/hooks/url.ts`, `src/hooks/url.test.ts`, `src/hooks/useCurrencies.ts`, `src/hooks/useCheckout.ts`, `src/hooks/useCheckout.test.tsx`

**Interfaces:**
- Consumes: Tasks 5 and 8.
- Produces:

```ts
// src/hooks/url.ts
export const DEFAULT_ORDER_ID = 'ORD-88213'
export function readUrl(search: string): { orderId: string; reference: string | null } // ?order_id= and ?payment=
export function writeReference(reference: string | null): void // history.replaceState; keeps order_id

// src/hooks/useCurrencies.ts
export type Catalogue = { currencies: Currency[] | undefined; isLoading: boolean; error: unknown; retry(): void }
export function useCurrencies(): Catalogue // error is set only after the retries are used up
// query key ['currencies'], staleTime: Infinity; retries twice, but never an 'http' error with a status below 500

// src/hooks/useCheckout.ts
export type CheckoutView =
  | { kind: 'picker'; mode: 'create' | 'requote'; notice: 'payment_not_found' | null }
  | { kind: 'payment' }
export type UseCheckoutResult = {
  orderId: string
  reference: string | null
  view: CheckoutView
  payment: UsePaymentResult
  submit(choice: Choice): void // creates when there is no reference, requotes when there is one
  submitting: boolean
  submitError: unknown // null when there is none
  changeChoice(): void
  cancelChange(): void
}
export function useCheckout(): UseCheckoutResult
```

**Behaviour:**

- Start: read the URL once. With a reference, the view is `payment` and `usePayment` fetches it. Without one, the picker in `create` mode.
- `usePayment(reference)` is always mounted while a reference exists, including while the picker is open in `requote` mode.
- `submit` decides by the reference, not by the view: with no reference it creates, and with one it requotes. The expired screen calls it while the view is `payment`, and the requote picker calls it too.
- `submit` with no reference: `createPayment({ order_id: orderId, ...choice })`. On success: `seedCreatedPayment`, set the reference, `writeReference`, view `payment`. On failure: `submitError`, the view does not change.
- `submit` with a reference: `runRequote(client, reference, choice)`. On success or on a refused requote (`isQuoteNotExpired`): view `payment`, no error. On any other failure: `submitError`.
- `submit` is guarded by a ref that is set before the request starts and cleared in `finally`. A second call returns at once, even when it happens before React has re-rendered. `submitting` mirrors the ref for the UI.
- `changeChoice`: if the payment's status is `expired`, open the picker in `requote` mode and keep the reference. Otherwise drop the reference, `writeReference(null)`, and open the picker in `create` mode. The caller is responsible for asking for confirmation first.
- While the picker is open in `requote` mode, the view goes back to `payment` by itself as soon as the status is no longer `expired`. Derive this during render; do not sync it with an effect.
- `cancelChange`: back to `payment` from the picker in `requote` mode.
- When `payment.error` is a not-found error: drop the reference, clear it from the URL, and show the picker in `create` mode with `notice: 'payment_not_found'`. The notice clears on the next `submit`.

- [ ] **Step 1: Write the failing tests** (mock `../api/endpoints`; set `window.history.replaceState(null, '', '/?...')` before rendering)

```ts
// url.test.ts
test.each([
  ['', { orderId: 'ORD-88213', reference: null }],
  ['?order_id=ORD-1', { orderId: 'ORD-1', reference: null }],
  ['?payment=AQH-100306-PMT', { orderId: 'ORD-88213', reference: 'AQH-100306-PMT' }],
  ['?order_id=ORD-1&payment=AQH-1-PMT', { orderId: 'ORD-1', reference: 'AQH-1-PMT' }],
])('readUrl(%j)', ...)
test('writeReference replaces the history entry and keeps order_id', ...) // history.length unchanged; search '?order_id=ORD-1&payment=AQH-1-PMT'; null removes payment

// useCheckout.test.tsx
test('opens on the picker with the default order', ...)
test('submit creates a payment for the order and the choice', ...) // createPayment called with { order_id: 'ORD-88213', currency: 'USDT', network: 'tron' }
test('a second submit before any re-render is ignored', ...) // call submit twice inside one act() -> createPayment called once
test('after creation it shows the payment and puts the reference in the URL', ...) // view.kind 'payment'; location.search contains 'payment=AQH-100306-PMT'; sequence startedFrom 'creation'
test('a failed create keeps the picker and reports the error', ...)
test('a reference in the URL resumes the payment', ...) // getPayment called with it; view 'payment'; sequence startedFrom 'reload'
test('an unknown reference returns to the picker with a notice and clears the URL', ...) // on resume
test('a payment that disappears mid-session returns to the picker with a notice', ...) // first poll ok, next poll 404
test('changing a live quote drops the payment', ...) // status awaiting_payment -> picker 'create', reference null, URL cleared
test('changing an expired quote keeps the payment and requotes', ...) // picker 'requote'; submit -> requotePayment(reference, choice); view 'payment'
test('the payment keeps polling while the picker is open for a requote', ...) // advance 15 s -> getPayment called again
test('a late payment closes the picker', ...) // picker 'requote', poll answers 'detected' -> view 'payment'
test('a refused requote goes back to the payment without an error', ...) // 409 -> view 'payment', submitError null
test('a second requote before any re-render is ignored', ...) // two submit calls inside one act() -> requotePayment called once
test('submit from the payment view requotes the expired payment', ...) // view 'payment', status expired -> requotePayment called, createPayment not called
test('a requote that fails reports the error and stays on the picker', ...) // 'timeout' -> submitError set, view picker 'requote'
test('cancelChange returns to the payment', ...)
test('the catalogue is not retried after a 4xx', ...) // getCurrencies rejects http 422 -> called once
```

- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run src/hooks/url.test.ts src/hooks/useCheckout.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement `url.ts`, `useCurrencies.ts` and `useCheckout.ts`.**
- [ ] **Step 4: Run and see them pass**, then gate and commit

```bash
npm run check && git add -A && git commit -m "Add the checkout flow: create, requote, change and resume"
```

---

### Task 10: The card and the picker

**Files:**
- Create: `src/domain/format.ts`, `src/domain/format.test.ts`, `src/hooks/usePickerChoice.ts`, `src/hooks/usePickerChoice.test.ts`, `src/hooks/useDelayedFlag.ts`, `src/hooks/useDelayedFlag.test.ts`, `src/components/CheckoutCard.tsx`, `src/components/OrderHeader.tsx`, `src/components/Picker.tsx`, `src/components/Picker.test.tsx`

**Interfaces:**
- Consumes: `Currency`, `DecimalString`, `Choice`.
- Produces:

```ts
// src/domain/format.ts
export function formatFiat(amount: DecimalString, currency: string, locale?: string): string
export function formatUsdFee(amount: DecimalString, locale?: string): string // '≈ $1.00'
export function usualTime(seconds: number): string // 15 -> '15 s', 60 -> '1 min', 180 -> '3 min'
export function networkShortName(name: string): string // 'Tron (TRC-20)' -> 'Tron', 'Polygon' -> 'Polygon'
export function formatDateTime(iso: string, locale?: string): string // medium date, short time, device time zone
export function confirmationsLabel(count: number): string // '1 confirmation', '3 confirmations'

// src/hooks/usePickerChoice.ts
export type PickerChoice = {
  currencyCode: string // '' when nothing is chosen
  networkId: string // '' when nothing is chosen
  currency: Currency | undefined
  network: Network | undefined
  choice: Choice | null // set only when both are chosen
  setCurrency(code: string): void // clears the network, unless the currency has exactly one, which it selects
  setNetwork(id: string): void
}
export function usePickerChoice(currencies: Currency[]): PickerChoice

// src/hooks/useDelayedFlag.ts
export function useDelayedFlag(active: boolean, delayMs: number): boolean // true once `active` has stayed true for delayMs; false again when it stops

// src/components
export function CheckoutCard(props: { left: ReactNode; right: ReactNode; strip?: ReactNode }): JSX.Element
export function OrderHeader(props: { orderId: string; merchantName?: string; fiat?: { amount: DecimalString; currency: string } }): JSX.Element
export function Picker(props: {
  orderId: string
  currencies: Currency[]
  mode: 'create' | 'requote'
  notice: 'payment_not_found' | null
  submitting: boolean
  error: unknown
  onSubmit(choice: Choice): void
  onCancel?: () => void
}): JSX.Element
```

**Behaviour and copy** (layout from `docs/design/picker-proposal.png`):

- `formatFiat` passes the string itself to `Intl.NumberFormat(locale, { style: 'currency', currency })`. `locale` defaults to `navigator.language`. If the formatter throws, return `` `${amount} ${currency}` ``. If TypeScript's declarations do not accept a string there, cast the method's signature and nothing else: `(formatter.format as (value: string) => string)(amount)`. Never convert the amount.
- `Picker` takes its selections from `usePickerChoice` and its "Still working…" hint from `useDelayedFlag(submitting, 4000)`. It holds no state of its own.
- `CheckoutCard`: two columns from 768 px up, one column below it with `right` after `left`; the strip spans the bottom.
- `OrderHeader` without `merchantName` shows the label "Order" and the order id. With it, "Payment for" and the merchant name on the left, "Order {orderId}" and the fiat amount on the right, and a tile with the merchant's first letter.
- Two native `<select>` elements, "Currency" and "Network". Nothing is selected at first. The first option of each is a disabled placeholder: "Choose currency", "Choose network". The network menu is disabled until a currency is chosen.
- Currency options: `USDT  Tether`. Network options: `Tron (TRC-20) · fee ≈ $1.00 · usually 1 min`.
- Changing the currency clears the network, unless the new currency has exactly one network, which is then selected.
- Under the menus, once both are chosen: `Fee ≈ $1.00 · usually 1 min · 1 confirmation`.
- Heading: "Choose how to pay".
- Right column, once both are chosen: label "You are paying with", a pill `USDT on Tron (TRC-20)`, and "Your wallet or exchange must be able to send USDT on the Tron network."
- Button: disabled and labelled "Continue" until both are chosen. Then "Continue with USDT on Tron" in `create` mode and "Get a new quote with USDT on Tron" in `requote` mode. Under it: "The amount to send and the address are shown next."
- While `submitting`: the button and both menus are disabled and the button reads "Working…". After 4 s still submitting, add "Still working…" under it.
- With `error`: "We couldn't reach the payment service. Try again." beside the button, in a `role="alert"` element. The choices stay as they were.
- With `notice`: "We couldn't find that payment. Choose how to pay to start again." above the heading.
- In `requote` mode with `onCancel`: a "Back" link that calls it.
- Strip: "**No clock is running yet.** The rate is fixed only when you continue."

- [ ] **Step 1: Write the failing tests**

```ts
// format.test.ts
test('formats fiat for the locale', () => {
  expect(formatFiat('149.90' as DecimalString, 'EUR', 'de-DE')).toMatch(/^149,90\s€$/)
  expect(formatFiat('149.90' as DecimalString, 'EUR', 'en-US')).toMatch(/^€\s?149\.90$/)
})
test('keeps a number too long for a float exact', () => {
  expect(formatFiat('1234567890123456.78' as DecimalString, 'EUR', 'en-US')).toMatch(/^€\s?1,234,567,890,123,456\.78$/)
})
test('falls back to the amount as sent when the currency code is rejected', () => {
  expect(formatFiat('149.90' as DecimalString, 'EURO', 'en-US')).toBe('149.90 EURO')
})
test.each([[15, '15 s'], [30, '30 s'], [60, '1 min'], [180, '3 min']])('usualTime(%i)', ...)
test.each([['Tron (TRC-20)', 'Tron'], ['Ethereum (ERC-20)', 'Ethereum'], ['Polygon', 'Polygon']])('networkShortName(%s)', ...)
test('formatUsdFee', ...) // '1.00' -> '≈ $1.00' in en-US
test('confirmationsLabel', ...)

// usePickerChoice.test.ts
test('starts with nothing chosen', ...) // currencyCode '', networkId '', choice null
test('choosing both gives the choice', ...) // { currency: 'USDT', network: 'tron' }
test('changing the currency clears the network', ...)
test('a currency with one network selects it', ...) // setCurrency('ETH') -> networkId 'ethereum', choice set
test('ignores a network the currency does not have', ...) // USDT then setNetwork('solana') -> networkId ''

// useDelayedFlag.test.ts
test('turns true only after the delay', ...) // active true: false at 3999 ms, true at 4000 ms
test('turns false as soon as it stops being active', ...)
test('clears its timer on unmount and when it stops early', ...) // vi.getTimerCount() === 0

// Picker.test.tsx — currencies from parseCurrencies(CURRENCIES_JSON)
test('opens with nothing selected and the button disabled', ...) // both selects have value ''; button named 'Continue' is disabled
test('the network menu is disabled until a currency is chosen', ...)
test('names the choice on the button once both are chosen', ...) // USDT + tron -> enabled button 'Continue with USDT on Tron'
test('submits the choice', ...) // onSubmit called with { currency: 'USDT', network: 'tron' }
test('changing the currency clears the network', ...) // USDT + tron, then USDC -> network value '', button disabled
test('a currency with one network has it filled in', ...) // ETH -> network 'ethereum', button 'Continue with ETH on Ethereum'
test('shows each network with its fee and usual time', ...) // option text 'Ethereum (ERC-20) · fee ≈ $4.50 · usually 3 min'
test('requote mode changes the button and offers Back', ...)
test('disables everything while submitting', ...)
test('says it is still working after four seconds', ...) // fake timers: no 'Still working…' at 3.9 s, present at 4 s
test('shows an error and keeps the choices', ...) // role alert; selects keep their values
test('shows the not-found notice', ...)
test('shows the order reference and no fiat amount', ...) // 'ORD-88213' present; no '€' anywhere
```

- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run src/domain/format.test.ts src/hooks/usePickerChoice.test.ts src/hooks/useDelayedFlag.test.ts src/components/Picker.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement `format.ts`, `usePickerChoice`, `useDelayedFlag`, `CheckoutCard`, `OrderHeader` and `Picker`.**
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Record the result in the design doc.** In section 11, remove the TypeScript typings line from the verification list and say whether the formatter accepted a string without a cast.
- [ ] **Step 6: Gate and commit**

```bash
npm run check && git add -A && git commit -m "Add the card shell and the currency and network picker"
```

---

### Task 11: The pay screen

**Files:**
- Create: `src/hooks/useCopy.ts`, `src/hooks/useCopy.test.ts`, `src/components/NetworkBanner.tsx`, `src/components/QrFrame.tsx`, `src/components/CopyButton.tsx`, `src/components/CopyButton.test.tsx`, `src/components/ConfirmChangeDialog.tsx`, `src/components/PayScreen.tsx`, `src/components/PayScreen.test.tsx`

**Interfaces:**
- Consumes: `Payment`, `Screen` (Task 7), `formatRemaining` (Task 7), `format.ts`, `CheckoutCard`, `OrderHeader` (Task 10).
- Produces:

```ts
export function NetworkBanner(props: { currency: string; networkId: string; networkName: string }): JSX.Element
export function QrFrame(props: { address: string; networkId: string; networkName: string; note: string }): JSX.Element
export type CopyState = 'idle' | 'copied' | 'failed'
export function useCopy(value: string): { state: CopyState; copy(): void } // src/hooks/useCopy.ts
export function CopyButton(props: { value: string; label: string }): JSX.Element // renders from useCopy; label says what it copies
export function ConfirmChangeDialog(props: { open: boolean; onConfirm(): void; onCancel(): void }): JSX.Element
export function PayScreen(props: {
  payment: Payment // awaiting_payment or underpaid
  screen: Extract<Screen, { kind: 'pay' }>
  onChange: (() => void) | null // null hides "Change currency or network"
  notice?: ReactNode // a connection notice to show in the strip, when there is one
}): JSX.Element
```

**Behaviour and copy** (layout from `docs/design/pay-screen-proposal.png`, underpaid from `status-screens-proposal.png`):

- Left column, top to bottom: `OrderHeader` with merchant and fiat; `NetworkBanner`; the amount block; the address box; the countdown.
- `NetworkBanner`: "{networkName} network" and "Send {currency} on {short} only. Any other network loses your funds." A round chip with the network's first letter: `tron` #ff060a, `ethereum` #627eea, `polygon` #8247e5, `solana` #14b8a6, anything else #6b7280. The name is always in text; the colour is decoration.
- Amount, `mode: 'full'`: label "Send exactly", then `{total_due} {currency}`, a `CopyButton` labelled "Copy amount" whose value is `total_due` alone, and under it `{crypto_amount} {currency} + {network_fee} {currency} network fee · 1 {currency} = {exchange_rate} {order.currency}`.
- Amount, `mode: 'remaining'`: above the banner, a notice "**Part of your payment arrived.** We received {amount_received} of {total_due} {currency}." Label "Send the remaining", then `{amount_outstanding} {currency}`, and "Copy amount" copies `amount_outstanding`. No breakdown line.
- Amounts are rendered exactly as received, in one text node, with `break-all` so eighteen places wrap instead of overflowing.
- Address box: label "{networkName} address", the full address in a monospaced font, and a `CopyButton` labelled "Copy {short} address".
- Countdown, only when `clock` is `'running'`: "Rate held for" and `formatRemaining(remainingMs)` in an element with `role="timer"`. It is not a live region. There is no progress bar: a bar needs the quote's full lifetime, and the API gives only its deadline.
- Right column: `QrFrame`. Its cap reads "{NETWORK NAME IN CAPITALS} ONLY". The QR is `<QRCodeSVG value={address} title="QR code for the {networkName} address" />`. Under it "Scan with your wallet app" and the `note`: "The code holds the address only. Enter the amount yourself." in full mode, "Same address as before. The code holds the address only." in remaining mode.
- When `showAddress` is false, the address box, both address controls and the whole `QrFrame` are not rendered. The right column says "The address is hidden until we can confirm this quote."
- Strip, by `clock`:

| `clock` | Strip |
|---|---|
| `running` | "**Sending from an exchange?** Make sure {total_due} {currency} arrives after its withdrawal fee." |
| `none` (underpaid) | "**Send the rest in one transfer** to the same address." |
| `checking` | "**Time's up.** Checking with the payment service." |
| `still_valid` | "**This quote is still valid.** Your device clock looks wrong, so the timer is hidden." |
| `cannot_confirm` | "**We can't confirm this quote is still live.** Don't send until this page reconnects." |

- If `notice` is given, it replaces the strip text. The "Change currency or network" link, when `onChange` is not null, stays at the right of the strip.
- `useCopy`: `copy()` calls `navigator.clipboard.writeText(value)`. On success the state is `'copied'` for 2 s. If the clipboard is missing or the call rejects, it is `'failed'` for 4 s. A new `copy()` replaces the running timer, and unmounting clears it. It never throws.
- `CopyButton` holds no state. It shows its label when idle, "Copied" when copied and "Copy failed. Select the text and copy it." when failed, in an `aria-live="polite"` element.
- `ConfirmChangeDialog`: a native `<dialog>`. Title "Have you already sent a payment?" Body "Only change if you have not sent anything. A payment sent to the current address after you change will not be tracked on this page." Buttons "I haven't sent anything, change" and "Stay on this payment".

- [ ] **Step 1: Write the failing tests**

```ts
// PayScreen.test.tsx
const running = { kind: 'pay', mode: 'full', clock: 'running', showAddress: true, remainingMs: 767_000 } as const
test('names the network on the banner, the address label, the copy button and the QR', () => {
  render(<PayScreen payment={makePayment()} screen={running} onChange={() => {}} />)
  expect(screen.getByText('Tron (TRC-20) network')).toBeInTheDocument()
  expect(screen.getByText('Tron (TRC-20) address')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Copy Tron address' })).toBeInTheDocument()
  expect(screen.getByText('TRON (TRC-20) ONLY')).toBeInTheDocument()
  expect(screen.getByTitle('QR code for the Tron (TRC-20) address')).toBeInTheDocument()
})
test('shows the amount exactly as sent and copies it without the unit', async () => {
  // writeText stubbed
  await user.click(screen.getByRole('button', { name: 'Copy amount' }))
  expect(writeText).toHaveBeenCalledWith('163.69')
})
test('keeps all eighteen places of an ETH amount', ...) // text '0.055295738369148398 ETH'; copy value '0.055295738369148398'
test('copies the full address', ...) // 'TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e'
test('shows the merchant, the order and the fiat amount', ...) // 'Nordwind Audio', 'Order ORD-88213', '€149.90' with locale en-US
test('shows the countdown', ...) // role timer has text '12:47'
test.each([['checking', "Time's up."], ['cannot_confirm', "We can't confirm this quote is still live."]])(
  '%s hides the address and the QR', (clock, text) => {
    // showAddress false
    expect(screen.queryByText('TQ5Nn8kLpVv3xJ7wYcR2bF9aH4dM6sGz1e')).not.toBeInTheDocument()
    expect(screen.queryByTitle(/QR code/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /address/ })).not.toBeInTheDocument()
    expect(screen.getByText(text)).toBeInTheDocument()
  })
test('still valid shows the address and no timer', ...) // no role timer; 'This quote is still valid.'
test('underpaid shows the remaining amount, what arrived, and no countdown', () => {
  // payment underpaid, screen { mode: 'remaining', clock: 'none', showAddress: true, remainingMs: null }, onChange null
  expect(screen.getByText('43.69 USDT')).toBeInTheDocument()
  expect(screen.getByText(/We received 120.00 of 163.69 USDT/)).toBeInTheDocument()
  expect(screen.queryByRole('timer')).not.toBeInTheDocument()
  expect(screen.queryByText('Change currency or network')).not.toBeInTheDocument()
})
test('underpaid copies the remaining amount', ...) // '43.69'
test('a connection notice replaces the strip text', ...)

// useCopy.test.ts
test('is copied for two seconds, then idle', ...)
test('is failed for four seconds when the clipboard rejects', ...)
test('is failed when there is no clipboard, and does not throw', ...)
test('a second copy replaces the first timer', ...) // copy, 1.5 s, copy, 1.5 s -> still 'copied'; vi.getTimerCount() === 1
test('clears its timer on unmount', ...) // vi.getTimerCount() === 0

// CopyButton.test.tsx
test('says Copied, then goes back to its label', ...) // fake timers: 'Copied' then after 2 s the label
test('says copying failed when the clipboard rejects', ...) // writeText rejects -> 'Copy failed. Select the text and copy it.'
test('says copying failed when there is no clipboard', ...) // navigator.clipboard undefined -> same text, no throw
```

- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run src/hooks/useCopy.test.ts src/components/PayScreen.test.tsx src/components/CopyButton.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement `useCopy` and the five components.** Put the network chip (first letter on the network's colour) in one small `NetworkChip` component, and use it in the banner, the QR frame and the picker's pill, replacing the colour table in `Picker.tsx`.
- [ ] **Step 4: Run and see them pass**, then gate and commit

```bash
npm run check && git add -A && git commit -m "Add the pay screen with the network named at every step"
```

---

### Task 12: Status screens, the notice strip and the page

**Files:**
- Create: `src/hooks/usePaymentScreen.ts`, `src/hooks/usePaymentScreen.test.tsx`, `src/hooks/useFocusOnChange.ts`, `src/hooks/useFocusOnChange.test.tsx`, `src/components/WaitingScreen.tsx`, `CompleteScreen.tsx`, `ExpiredScreen.tsx`, `FailedScreen.tsx`, `CheckingScreen.tsx`, `NoticeStrip.tsx`, `PaymentView.tsx`, and `src/components/StatusScreens.test.tsx`, `NoticeStrip.test.tsx`, `PaymentView.test.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: everything from Tasks 4 to 11.
- Produces:

```ts
export function WaitingScreen(props: { payment: Payment; usualSeconds?: number }): JSX.Element // detected or confirming
export function CompleteScreen(props: { payment: Payment }): JSX.Element // paid or overpaid
export function ExpiredScreen(props: {
  payment: Payment
  screen: Extract<Screen, { kind: 'expired' }>
  money?: SequenceEntry // the entry that carried money, for the dead end
  requoting: boolean
  error: unknown
  onRequote(): void
  onChange(): void
}): JSX.Element
export function FailedScreen(props: { payment: Payment; screen: Extract<Screen, { kind: 'failed' }>; money?: SequenceEntry }): JSX.Element
export function CheckingScreen(props: { payment: Payment; money?: SequenceEntry }): JSX.Element // money supplies the transaction row when the status itself carries none
export function reasonText(reason: string): string
export function connectionNotice(connection: Connection, onTryNow: () => void): ReactNode | null
export function PaymentView(props: { checkout: UseCheckoutResult; catalogue: Catalogue }): JSX.Element

// src/hooks/usePaymentScreen.ts
export type PaymentScreenState = {
  entry: PaymentEntry | undefined
  screen: Screen | null // null until the first answer
  connection: Connection
  detailsProblem: boolean // the pay screen cannot show its amount: the catalogue failed, lacks the quote's currency, or an amount does not fit
  money: SequenceEntry | undefined // lastMoney of the sequence
  usualSeconds: number | undefined // from the catalogue entry for the quote's currency and network
}
export function usePaymentScreen(payment: UsePaymentResult, catalogue: Catalogue): PaymentScreenState

// src/hooks/useFocusOnChange.ts
export function useFocusOnChange<T extends HTMLElement>(key: string): React.RefObject<T | null> // focuses the element when `key` changes, not on first mount
```

**Shared rules:**

- Every screen uses `CheckoutCard` with `OrderHeader` (merchant and fiat) at the top of the left column, facts in the left column as label and value rows, and the headline with its icon in the right column.
- Each screen's headline is an `<h2 tabIndex={-1}>`.
- None of these screens renders the address or a QR.
- Every status screen has a Reference row, and a Transaction row whenever the payment or the `money` entry carries a `tx_hash`. Both values are shown in full. Their buttons are labelled "Copy payment reference" and "Copy transaction hash".
- `connectionNotice` is exported from `NoticeStrip.tsx`. It returns `null` for `'ok'`. When it is not null, it replaces the screen's own strip text.

**Copy** (layout from `docs/design/status-screens-proposal.png`). The table lists each screen's own rows; the Reference row, and the Transaction row when there is a hash, are added to every screen by the shared rule above:

| Screen | Left column | Right column | Strip |
|---|---|---|---|
| `waiting` | "Payment seen", `{amount_received} {currency}`; rows Network, Transaction, and "Seen at" when `detected_at` exists | "We've seen your payment on the network" · "Waiting for it to be confirmed. You don't need to send anything else." · "Confirmations" with "{confirmations} of {required_confirmations}" and a bar · "Usually about {usualTime} on {short}." when `usualSeconds` is given | "This page updates by itself." |
| `complete`, paid | "Paid", `{amount_received} {currency}`; rows Network, Transaction, Reference, Settled | "Payment complete" · "{merchant} has your payment for order {orderId}." | "Nothing more to do. You can close this page." |
| `complete`, overpaid | "Received", `{amount_received} {currency}`; rows "Amount due" `{total_due}`, "Extra sent" `{amount_excess}`, Network, Reference | "Payment complete" · notice "**You sent {amount_excess} {currency} more than was due.** This page can't return the extra amount. Contact {merchant} and quote reference {reference}." | "Your order is paid. Nothing more to send." |
| `expired`, plain | "Expired quote", `{total_due} {currency}` greyed; rows Network, "Expired at", Address "Hidden, so nothing more is sent to it" | "This quote has expired" · "**Already sent?** Do not send again. We are still watching for your payment." · checkbox "I have not sent a payment" · button "Get a new quote" | "Still checking for a late payment." and the link "Change currency or network" |
| `expired`, cautious | as plain | as plain, plus "If you sent any funds for this payment, do not get a new quote. Contact {merchant}." above the checkbox | as plain |
| `expired`, dead end, `after: 'partial'` | "Received before it expired", `{money.amount_received} {currency}`; rows "Amount due", "Missing" `{money.amount_outstanding}`, Network, Reference | "The full amount wasn't reached" · "This payment expired before the rest arrived. We are still watching in case it is on its way. **Do not send again.**" · notice "This page can't complete this payment or tell you what happens to the {money.amount_received} {currency} you sent. Contact {merchant} and quote reference {reference}." | "Still checking for a late payment." |
| `expired`, dead end, `after: 'payment'` | "Payment seen", `{money.amount_received} {currency}`; rows Network, Transaction, Reference | "This payment expired" · "We saw a payment before it expired. **Do not send again.**" · the same notice | "Still checking for a late payment." |
| `failed`, money `yes` | "Payment seen", `{money.amount_received} {currency}`; rows Network, Transaction, Reference | "This payment could not be completed" · "We saw your payment, but it could not be completed. {reasonText}" · "**Do not send anything more.** Contact {merchant} and quote the reference." · "Reason code: {reason}" | "This page can't fix this payment." |
| `failed`, money `no` | rows Network, Reference | the same headline · "{reasonText}" · the same contact line and reason code | the same |
| `failed`, money `unknown` | rows Network, Reference | as `no`, plus "If you sent any funds for this payment, tell {merchant}." | the same |
| `checking` | rows Network, Reference | "We're checking your payment" · "**Don't send again.** If this doesn't change, contact {merchant} and quote reference {reference}." | "This page updates by itself." |

- `reasonText('settlement_rejected')` is "The settlement was rejected." Any other code gives "The payment service reported a problem."
- On the plain and cautious `expired` screens, "Get a new quote" and "Change currency or network" are both disabled until the checkbox is ticked. While `requoting`, the button is disabled and reads "Working…". With `error`: "We couldn't get a new quote. Try again." in a `role="alert"` element.
- The dead-end screens have no checkbox, no button and no link.
- `connectionNotice`: `'offline'` gives "**You appear to be offline.** We'll pick up as soon as your connection returns." `'unreachable'` gives "**We can't reach the payment service.** This page may be out of date until we reconnect. Retrying." with a "Try now" button.

**`PaymentView`:**

**`usePaymentScreen`** owns everything that is not rendering:

- `amountsChecked` is true when the catalogue is loaded, the quote's currency is in it, and every `amountsToSend(payment)` passes `fitsDecimals`.
- `detailsProblem` is true when the status is `awaiting_payment` or `underpaid` and one of these holds: the catalogue has an `error`; it is loaded but lacks the quote's currency; or an amount does not fit. While the catalogue is still loading it is false.
- `screen` is `deriveScreen(...)` with `useNow()`. `connection` is `deriveConnection(useOnline(), consecutiveFailures)`.
- The check at zero: call `payment.checkNow()` once per quote, the first time that quote's device-clock deadline has passed while the status is `awaiting_payment`. Key it by `quote.expires_at`, so a re-render never repeats it and a new quote gets its own.

**`PaymentView`:**

- With no entry yet: a loading card, "Loading your payment…", and nothing else.
- `pay_loading` without a details problem: the card with `OrderHeader` and "Loading the payment details…". No amount, no address, no QR.
- `pay_loading` with a details problem: "We couldn't load the payment details." and a "Try again" button that calls `catalogue.retry()` and `checkout.payment.checkNow()`. No amount, no address, no QR. Status-only screens are never replaced by this.
- "Change currency or network" on the pay screen opens `ConfirmChangeDialog`; confirming calls `checkout.changeChoice()`. On the expired screens it calls `changeChoice()` directly.
- `onRequote` calls `checkout.submit` with the current quote's currency and network. `requoting` and `error` come from `checkout.submitting` and `checkout.submitError`.
- Whether the confirm dialog is open is the one piece of state `PaymentView` holds.
- Announce the headline of the current screen in one `aria-live="polite"` region, and move focus to the new headline with `useFocusOnChange(screen.kind)`.
- `ExpiredScreen` holds whether its box is ticked. That is view state.

**`App`:** creates one `QueryClient`, provides it, calls `useCheckout` and `useCurrencies`, and renders the picker or `PaymentView` inside `<main>`, passing the whole `Catalogue` to `PaymentView`. While the catalogue loads on the picker: "Loading payment options…". If it fails after its retries: "We couldn't load the payment options." with a "Try again" button.

- [ ] **Step 1: Write the failing tests**

```ts
// StatusScreens.test.tsx
test('expired: the new-quote button needs the tick box', async () => {
  // variant 'plain'
  expect(screen.getByRole('button', { name: 'Get a new quote' })).toBeDisabled()
  await user.click(screen.getByRole('checkbox', { name: 'I have not sent a payment' }))
  await user.click(screen.getByRole('button', { name: 'Get a new quote' }))
  expect(onRequote).toHaveBeenCalledTimes(1)
})
test('expired: never shows the address', ...) // queryByText(address) is null for all three variants
test('expired: the cautious variant warns about earlier funds', ...)
test('expired after a partial payment is a dead end', () => {
  // variant 'dead_end', after 'partial', money { amount_received: '120.00', amount_outstanding: '43.69' }
  expect(screen.getByText("The full amount wasn't reached")).toBeInTheDocument()
  expect(screen.getByText('120.00 USDT')).toBeInTheDocument()
  expect(screen.getByText('43.69 USDT')).toBeInTheDocument()
  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /quote/i })).not.toBeInTheDocument()
  expect(screen.queryByText('Change currency or network')).not.toBeInTheDocument()
})
test('expired after a full payment was seen is a dead end too', ...) // 'This payment expired'
test('overpaid tells the truth about the extra', () => {
  expect(screen.getByText('Payment complete')).toBeInTheDocument()
  expect(screen.getByText(/You sent 16.31 USDT more than was due/)).toBeInTheDocument()
  expect(screen.getByText(/can't return the extra amount/)).toBeInTheDocument()
  expect(document.body.textContent).not.toMatch(/refund/i)
})
test('paid shows the amount, the reference and the settled time', ...)
test('detected says seen on the network, not received', ...) // "We've seen your payment on the network"; '0 of 1'; body text does not match /received|complete/i
test('every status screen shows the full reference with a labelled copy button', ...) // each screen: 'AQH-100306-PMT' and a button named 'Copy payment reference'
test('shows the transaction hash wherever the payment has one', ...) // detected, paid, overpaid, expired dead end: '9d1f4c8a2be7...' and 'Copy transaction hash'
test('confirming shows its progress', ...) // '2 of 3'
test.each([['yes', /We saw your payment/], ['no', /The settlement was rejected/], ['unknown', /If you sent any funds/]])('failed, money %s', ...)
test('failed has no button and shows the reason code', ...) // no button except the Copy buttons; 'Reason code: settlement_rejected'
test('a reason the page does not know gets generic wording', ...) // reasonText('chain_reorg') === 'The payment service reported a problem.'
test('checking gives the reference and a way forward', ...) // 'AQH-100306-PMT'; /contact Nordwind Audio/
test('checking keeps the transaction seen earlier', ...) // money { tx_hash: '9d1f4c8a2be7...' } with an unknown status -> the hash and 'Copy transaction hash'

// NoticeStrip.test.tsx
test('says nothing when the connection is fine', ...) // null
test('offline', ...) // 'You appear to be offline.'
test('unreachable offers Try now', ...) // click -> onTryNow called
test('never says the payment is safe or unaffected', ...) // neither notice matches /unaffected|safe/i

// usePaymentScreen.test.tsx — payment built from a fake UsePaymentResult
test('asks the server once when the countdown reaches zero', ...) // advance the clock past expires_at -> checkNow called exactly once
test('does not ask again on later renders of the same quote', ...) // advance 30 s more -> still once
test('a new quote gets its own check at zero', ...) // new expires_at, advance past it -> twice in total
test('does not ask at zero for a status with no clock', ...) // underpaid past the old deadline -> never called
test('a failed catalogue is a details problem for a pay status only', ...) // awaiting_payment -> true; detected -> false
test('a catalogue without the quote currency is a details problem', ...)
test('an amount with too many decimal places is a details problem', ...) // total_due '163.1234567', USDT decimals 6
test('a catalogue that is still loading is not a problem yet', ...)

// useFocusOnChange.test.tsx
test('does not take focus on first mount', ...)
test('focuses the element when the key changes', ...) // rerender with a new key -> document.activeElement is the element

// PaymentView.test.tsx — checkout built from a fake UseCheckoutResult, catalogue from a fake Catalogue
test('shows a loading card before the first answer', ...)
test('the pay screen waits for the currency list', ...) // catalogue loading, awaiting_payment -> 'Loading the payment details…'; no '163.69'; no address
test('a status screen does not wait for the currency list', ...) // catalogue loading, detected -> "We've seen your payment on the network"
test('a failed catalogue offers Try again and shows no amount', ...) // click -> catalogue.retry and checkNow called; no '163.69'; no address
test('an amount with too many decimal places is not shown', ...) // no '163.1234567' in the document
test.each([
  ['a live quote keeps its address when polls fail', 'awaiting_payment', 'before the deadline', true],
  ['underpaid keeps its address when polls fail', 'underpaid', 'any time', true],
  ['a quote past its deadline hides its address when polls fail', 'awaiting_payment', 'after the deadline', false],
])('%s', ...) // consecutiveFailures 2, lastFailureAt after lastSuccessAt: the unreachable notice shows, and the address is present or absent as given
test('a live quote keeps its address while the browser is offline', ...)
test('keeps the last status and adds the notice when polls fail', ...) // consecutiveFailures 2 -> the waiting screen and 'We can\'t reach the payment service.'
test('changing a live quote asks first', ...) // click 'Change currency or network' -> dialog; confirm -> changeChoice called
test('announces a new status and moves focus to its headline', ...) // rerender with 'paid' -> live region text 'Payment complete'; document.activeElement is the h2

// App.test.tsx (replace the smoke test)
test('opens on the picker', ...) // mock endpoints; 'Choose how to pay'
test('offers Try again when the options cannot be loaded', ...)
```

- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run src/hooks/usePaymentScreen.test.tsx src/hooks/useFocusOnChange.test.tsx src/components src/App.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement `usePaymentScreen`, `useFocusOnChange`, the screens, `connectionNotice`, `PaymentView` and `App`.** `PaymentView` passes `money` to `CheckingScreen` as well as to the expired and failed screens.
- [ ] **Step 4: Run and see them pass.**
- [ ] **Step 5: Try it by hand**

Run `npm run dev`, open the page, choose USDT on Tron and continue. Then:

```bash
curl -s -X POST localhost:5173/__mock/payments/AQH-100306-PMT/status -H 'content-type: application/json' -d '{"status":"detected"}'
```

Expected: within three seconds the page shows "We've seen your payment". Stop the dev server.

- [ ] **Step 6: Gate and commit**

```bash
npm run check && git add -A && git commit -m "Add the status screens, the connection notices and the page"
```

---

### Task 13: The dev panel

**Files:**
- Create: `src/dev/mockControl.ts`, `src/dev/mockControl.test.ts`, `src/dev/useMockSettings.ts`, `src/dev/useMockSettings.test.tsx`, `src/dev/DevPanel.tsx`, `src/dev/DevPanel.test.tsx`
- Modify: `src/App.tsx`

The panel sends commands to the mock. It does not watch the mock: an earlier version of this task polled the mock every two seconds to show its status and time left, which the checkout page beside it already shows. That was cut before it was built.

**Interfaces:**
- Consumes: `/__mock` routes (Task 3); `PaymentEntry` (Task 8).
- Produces:

```ts
// src/dev/mockControl.ts
export type MockSettings = { quote_lifetime_seconds: number; delay_ms: number; fault: 'none' | 'http_500' | 'drop'; clock_offset_seconds: number }
export function getMockSettings(signal?: AbortSignal): Promise<MockSettings> // the settings from GET /__mock/state
export function setMockStatus(reference: string, status: string, confirmations?: number): Promise<void>
export function updateMockSettings(patch: Partial<MockSettings>): Promise<MockSettings>

// src/dev/useMockSettings.ts
export function useMockSettings(open: boolean): { settings: MockSettings | undefined; update(patch: Partial<MockSettings>): void }

// src/dev/DevPanel.tsx
export function DevPanel(props: { reference: string | null; entry: PaymentEntry | undefined }): JSX.Element
```

**Behaviour** (layout from `docs/design/dev-panel-proposal.png`, without its "server status" and "expires in" lines):

- `mockControl.ts` calls `/__mock` through its own small helper, not through `src/api`. The helper follows the request rules: a 10 s timeout, an abort signal, and `cache: 'no-store'`.
- `useMockSettings` reads the settings once each time `open` becomes true, so the buttons show what the mock is really set to after a page reload. It does not poll. Closing the panel or unmounting aborts that read. `update(patch)` sends the patch and keeps the settings the mock answers with.
- `DevPanel` holds only whether it is open. Everything about the payment comes from its `entry` prop, which `App` passes from the checkout hook, so the panel sends no request to learn it.
- Collapsed at first: a narrow tab on the right edge labelled "DEV". Clicking it opens the panel; "hide" collapses it.
- Open: docked on the right, 330 px wide, dark background, monospaced. In `App`, the page and the panel sit in a flex row so the panel pushes the card aside. Under 900 px wide it lies over the page instead.
- Sections:
  - **Current payment:** the reference, and "seen:" followed by the statuses in `entry.sequence`, joined with " → ".
  - **Set status:** eight buttons named by status. The one matching `entry.payment.status` has `aria-pressed="true"`. A stepper "confirmations − n +", where n is the payment's `confirmations` when its status carries one and 0 otherwise; "+" calls `setMockStatus(reference, 'confirming', n + 1)` and "−" calls it with `n - 1`, never below 0.
  - **New quotes last:** "30 s", "2 min", "15 min" → `quote_lifetime_seconds` 30, 120, 900.
  - **Faults, on every API request:** "no delay", "3 s", "15 s" → `delay_ms` 0, 3000, 15000; "normal", "HTTP 500", "drop" → `fault`.
  - **Server clock offset:** "−5 min", "0", "+5 min" → `clock_offset_seconds` −300, 0, 300.
  - In the three settings sections, the option matching `settings` has `aria-pressed="true"`.
  - A last line: "Offline: use the browser's own offline switch."
- With no reference, the status buttons and the stepper are disabled and the payment section reads "No payment yet."

- [ ] **Step 1: Write the failing tests** (mock `./mockControl` in the panel and hook tests)

```ts
// DevPanel.test.tsx
test('starts collapsed', ...) // 'DEV' tab present; no button named 'underpaid'
test('opens to show the eight statuses', ...) // eight buttons, one per status
test('sets a status for the current payment', ...) // click 'underpaid' -> setMockStatus('AQH-100306-PMT', 'underpaid')
test('marks the status the page is showing', ...) // entry with status underpaid -> aria-pressed true on 'underpaid' only
test('the stepper sets confirmations from the payment', ...) // entry confirming 1 of 3: '+' -> setMockStatus(ref, 'confirming', 2); '−' -> 0
test.each([['30 s', { quote_lifetime_seconds: 30 }], ['15 s', { delay_ms: 15_000 }], ['HTTP 500', { fault: 'http_500' }], ['drop', { fault: 'drop' }], ['+5 min', { clock_offset_seconds: 300 }]])(
  'the %s button updates the settings', ...)
test('marks the settings the mock reports', ...) // settings { fault: 'drop' } -> aria-pressed true on 'drop'
test('shows the statuses the page has seen', ...) // entry with awaiting_payment then underpaid: 'awaiting_payment → underpaid'
test('disables the status buttons when there is no payment', ...)
test('sends no request while collapsed', ...) // getMockSettings not called

// useMockSettings.test.tsx
test('reads once when opened and does not poll', ...) // fake timers: advance 60 s -> getMockSettings called once
test('reads again when reopened', ...)
test('aborts the read when closed or unmounted', ...) // signal.aborted true
test('update keeps the settings the mock answers with', ...)

// mockControl.test.ts
test('sends no-store and an abort signal', ...) // fetch called with { cache: 'no-store', signal: expect.any(AbortSignal) }
test('gives up after ten seconds', ...)
test('getMockSettings returns the settings from the state', ...)
```

- [ ] **Step 2: Run and see them fail.** Run: `npx vitest run src/dev`. Expected: FAIL.
- [ ] **Step 3: Implement `mockControl.ts`, `useMockSettings.ts` and `DevPanel.tsx`, and add the panel to `App`,** passing it `checkout.reference` and `checkout.payment.entry`.
- [ ] **Step 4: Run and see them pass**, then gate and commit

```bash
npm run check && git add -A && git commit -m "Add the dev panel that drives the mock"
```

---

### Task 14: README, final documents and the walk-through

**Files:**
- Create: `README.md`
- Modify: `docs/design-doc.md`, `docs/agent-log.md`

This task has no code. It is done by the human with the planning agent, not handed to an implementer.

- [ ] **Step 1: Walk every state by hand.** Run `npm run dev` and, with the dev panel, check each line. Note anything that differs from the design doc.

  1. The picker opens with nothing selected; changing the currency clears the network; ETH fills in Ethereum.
  2. USDT on Tron: the pay screen shows 163.69 USDT, the Tron address, and the network in four places.
  3. `detected`, `confirming` (stepper), `paid`: the address is gone; the confirmations bar moves; polling stops on `paid` (watch the network tab).
  4. `underpaid`: 43.69 USDT to send, no countdown, the same address.
  5. `overpaid`: complete, with the notice about 16.31 USDT and no mention of a refund.
  6. `expired` from `awaiting_payment`: the tick box guards "Get a new quote"; a new quote brings a fresh countdown.
  7. `underpaid` then `expired`: the dead end, with no button.
  8. `detected` then `awaiting_payment`: "We're checking your payment", no address.
  9. `failed` from `awaiting_payment` and from `confirming`: the two wordings.
  10. Quote lifetime 30 s: the countdown reaches zero, "Time's up", then the expired screen.
  11. Server clock offset −5 min with a 30 s lifetime: "This quote is still valid", address shown, no timer.
  12. Server clock offset +5 min: the countdown shows time left when the server expires the quote, and the page follows the server.
  13. HTTP 500 and drop: the last status stays, the notice appears after two failed polls, and "Try now" works. Turning the fault off recovers by itself.
  14. Delay 15 s: a create times out with the error beside the button and the choices intact.
  15. Browser offline: "You appear to be offline", and polling resumes on reconnect.
  16. Hide the tab for two minutes on a live quote: the countdown is right when it returns.
  17. Refresh on each of `awaiting_payment`, `confirming` and `expired`: the page resumes; `expired` uses the cautious wording.
  18. Restart `npm run dev` with a payment open: the page returns to the picker with "We couldn't find that payment."
  19. An ETH quote: all eighteen places, on the screen and in the clipboard.
  20. Phone width (380 px): one column, nothing overflows, including the ETH amount.

- [ ] **Step 2: Fix what the walk-through found**, each fix as its own commit with a failing test first.

- [ ] **Step 3: Revise `docs/design-doc.md`** so it describes what was built: update the status line, section 11, and anything the build changed. Keep "One thing I would defend" as the last section.

- [ ] **Step 4: Write `README.md`** with these sections:

  - **Run it:** `npm install`, `npm run dev`, the URL, `npm run check`. The Node version.
  - **Trigger each payment state:** the dev panel, then a table of the eight statuses with the matching `curl` for each, then how to cause a network error, a 500, a slow response, an offline browser, and a clock difference.
  - **What I dropped:** from the design doc's follow-ups, each with why that and not something else.
  - **Working with the agent:** three things the agent wrote that were thrown away and why; one place I did it my own way and the code got better; anything the agent got wrong about the payment state machine. Written from `docs/agent-log.md`, which by now includes the build. Every entry must be something that happened.

- [ ] **Step 5: Final gate**

Run: `npm run check && npm run build`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add -A && git commit -m "Add the README and bring the design doc in line with the build"
```

---

### Task 15: The order summary on the picker, and the merchant's logo

Added on 12 Nov 2026, after the build and the walk-through, at my request.

**Why.** The picker showed only the order reference, because the API returns the merchant and the amount only inside a payment. The page already assumed it is handed an order id by whatever sent the shopper here. It now assumes the rest of the order summary arrives with it, so the picker has the same header as every later screen. Separately, the header ignored `merchant.logo_url`.

**Files:**

- Modify: `src/api/schemas.ts`, `src/api/schemas.test.ts`
- Modify: `src/hooks/url.ts` and its test
- Modify: `src/hooks/useCheckout.ts` and its test
- Modify: `src/components/OrderHeader.tsx` and its test (create the test file if there is none)
- Modify the callers and their tests: `src/components/Picker.tsx`, `src/App.tsx`, `src/components/PaymentView.tsx`, `src/components/PayScreen.tsx`, `src/components/StatusCard.tsx`
- Modify: `docs/design-doc.md`

**Interfaces:**

- Consumes: the `merchant` and `order` schemas inside `paymentBase` in `src/api/schemas.ts`; `formatFiat` from `src/domain/format.ts`.
- Produces:

```ts
// src/api/schemas.ts — built from the same merchant and order schemas a payment uses
export type OrderSummary = {
  order_id: string
  merchant: { name: string; logo_url: string | null }
  order: { currency: string; amount: DecimalString }
}
export function parseOrderSummary(json: unknown): OrderSummary

// src/hooks/url.ts
export const ASSUMED_ORDER: OrderSummary // parseOrderSummary of the literal below
export function readUrl(search: string): {
  order: OrderSummary // ?order_id= replaces order.order_id and nothing else
  reference: string | null
}

// src/hooks/useCheckout.ts
// UseCheckoutResult.order: OrderSummary replaces orderId: string

// src/components/OrderHeader.tsx
export function OrderHeader(props: { order: OrderSummary }): ReactNode
```

A `Payment` already carries `order_id`, `merchant` and `order`, so the payment screens pass the payment itself.

The assumed object, verbatim:

```json
{
  "order_id": "ORD-88213",
  "merchant": { "name": "Nordwind Audio", "logo_url": null },
  "order": { "currency": "EUR", "amount": "149.90" }
}
```

**Rules:**

- The summary is for display. The only field sent to the API is `order_id`, as before.
- The amount gets its `DecimalString` type from `parseOrderSummary`, never from a cast.
- Once a payment exists, the header shows that payment's own `merchant` and `order`, not the assumed ones.
- The app does not import from `mock/`.
- The header has one form. The order-only form is deleted.
- **Logo.** When `merchant.logo_url` is a non-empty string, the 44 px box holds `<img src={logo_url} alt="" referrerPolicy="no-referrer">`, scaled to fit. The merchant's name beside it is its text, so the image has an empty `alt`. With no logo, or one that fails to load, the box holds the first character of the name, as now. Which URL failed is view state in the component, compared with the current URL, so a new URL gets a new try. No effect is needed.

- [ ] **Step 1: Write the failing tests**

  - `parseOrderSummary` accepts the literal above; rejects `amount` as the JSON number `149.9`; rejects an object with no `merchant`.
  - `readUrl('')` returns `{ order: ASSUMED_ORDER, reference: null }`. `readUrl('?order_id=ORD-1')` returns the same merchant and order with `order_id: 'ORD-1'`.
  - `OrderHeader` with the literal shows "Nordwind Audio", "Order ORD-88213" and `formatFiat` of `149.90` EUR; it shows the letter "N" and no image.
  - `OrderHeader` with `logo_url: 'https://cdn.example/nordwind.png'` shows an image with that `src`, an empty `alt` and `referrerpolicy="no-referrer"`, and no letter. After the image's `error` event it shows the letter and no image.
  - The picker, and the card shown while the currency list loads or has failed, show the merchant's name and the amount.

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -- src/api/schemas.test.ts src/hooks src/components src/App.test.tsx`
Expected: the new tests fail; the rest pass.

- [ ] **Step 3: Implement the order summary and commit it**

Commit message: "Show the order summary on the picker". The design doc changes for the summary go in this commit: section 2 ("What the picker can show"), the "Order details before a payment" row in section 9, the "Merchant name and amount on the picker" follow-up in section 10, and the "Order id" detail in section 11.

- [ ] **Step 4: Implement the logo and commit it**

Commit message: "Show the merchant's logo when there is one". One line in the design doc's section 11 goes in this commit.

- [ ] **Step 5: Gate**

Run: `npm run check && npm run build`
Expected: both pass.

---

### Task 16: Sort the source folders into screens, components and config

Added on 12 Nov 2026, after Task 15, at my request. An organisational refactor: no payment behaviour, screen, API contract or safety rule changes.

**Why.** `src/components` held two different things: whole checkout screens and the small pieces they are built from. The assumed order summary sat in the URL helper, which is not where a reader looks for configuration.

**Target structure:**

```
src/
  main.tsx
  App.tsx
  api/          HTTP client, response schemas and endpoint functions
  domain/       Pure payment, history, money and presentation derivation
  screens/      Complete checkout screens and screen-specific helpers
  components/   Reusable rendering components
  hooks/        Checkout orchestration and browser effects
  config/       Initial checkout configuration
  dev/          Browser-side mock controls
  test/         Shared test helpers and fixtures
mock/           Express mock server and its fixtures
docs/           Current specifications and historical material
```

**Moves** (with `git mv`, so history follows the files):

| From `src/components/` | To `src/screens/` |
| --- | --- |
| `PaymentView.tsx`, `PaymentView.test.tsx` | same names |
| `Picker.tsx`, `Picker.test.tsx` | `PickerScreen.tsx`, `PickerScreen.test.tsx`; the component is renamed `PickerScreen` |
| `PayScreen.tsx`, `PayScreen.test.tsx` | same names |
| `WaitingScreen.tsx`, `CompleteScreen.tsx`, `ExpiredScreen.tsx`, `FailedScreen.tsx`, `CheckingScreen.tsx` | same names |
| `statusText.ts`, `StatusScreens.test.tsx` | same names |

Staying in `src/components/`, with their tests: `CheckoutCard`, `StatusCard`, `OrderHeader`, `CopyButton`, `NetworkBanner`, `NetworkChip`, `QrFrame`, `ConfirmChangeDialog`, `NoticeStrip`.

`ASSUMED_ORDER` moves from `src/hooks/url.ts` to a new `src/config/checkout.ts`, with the same values, the same validation through `parseOrderSummary` and the same initialisation at module load. `url.ts` keeps reading and writing the URL and imports the constant.

**Rules:**

- No behaviour change. No string, condition, request or amount changes. Existing assertions and coverage stay.
- No barrel files, no path aliases, no new layer, no new dependency, no compatibility re-exports.
- Nothing else is renamed. `usePickerChoice` keeps its name.
- No test that only asserts a folder name.
- `paymentCache.ts` stays beside the hooks that use it.
- Out of scope, each needing its own change and tests: the amounts-after-a-requote currency question, the history model, polling and error policy, focus behaviour, slow-request feedback.

- [ ] **Step 1: Baseline.** Record `git status` and the head commit. Run `npm run check` and `npm run build`; both pass before anything moves.

- [ ] **Step 2: Move the screens.** `git mv` the files in the table, rename `Picker` to `PickerScreen` everywhere it is used, and fix every import and `vi.mock` path. Run `npm run check`. Commit: "Move the checkout screens into src/screens".

- [ ] **Step 3: Move the assumed order.** Create `src/config/checkout.ts`, update `url.ts` and every importer. Run `npm run check`. Commit: "Keep the assumed order in src/config".

- [ ] **Step 4: Documents.** `docs/design-doc.md` section 4 (diagram, layers, state table), a project-structure section in `README.md`, the Structure section of `AGENTS.md`, and a note that separates current specifications from historical records. Old plan tasks, log entries and ADR narratives keep the paths they were written with. Commit: "Describe the new folder structure".

- [ ] **Step 5: Verify.** `npm run check && npm run build`; start the app and look at the picker, the pay screen and a few status screens; search the source and the active documents for the old paths; read the whole diff for anything that is not a move, an import or the rename.

> **Corrections, added after the task was planned.** In the rules above, "the amounts-after-a-requote currency question" was the planning agent's guess at a bug it had not seen described; my brief called it "the previously identified historical-currency bug", and that is all this task knows about it. Step 4's note became a new file, `docs/README.md`.

---

### Task 17: Remove repeated decisions and unreachable branches from the screens

Added on 12 Nov 2026, after Task 16, at my request, from a review of five simplification proposals. No behaviour, wording, request or amount changes. No ADR is affected.

**Why.** Three things were written more than once or more loosely than the code means them:

- The amount and address to pay were chosen in two places, each checking both `screen.mode` and `payment.status` because the types did not tie them together. If the two ever disagreed, the pay screen would show the full amount under "Send exactly".
- The check of a payment against the currency list lived inside a hook, where it could only be tested through the hook.
- Every screen took any `Payment` and defended itself against statuses it can never be given. The `Screen` type also allowed combinations the derivation never produces.

**Left alone on purpose:** the write latch and its release, the two poll cancellations around a requote, the failure count, the disabled query after a final status, the request client, the status sequence and its types, focus behaviour, polling policy.

**Files:**

- Create: `src/components/LoadingCard.tsx`, `src/domain/details.ts`, `src/domain/details.test.ts`
- Modify: `src/App.tsx`, `src/domain/money.ts`, `src/domain/screen.ts`, `src/hooks/usePaymentScreen.ts`, `src/screens/statusText.ts`, every file in `src/screens/`, `src/test/fixtures.ts`, and the tests beside each

**Interfaces:**

```ts
// Step 1 — src/components/LoadingCard.tsx
export function LoadingCard(props: {
  order: OrderSummary
  loading: string // shown while there is no problem
  problem: string | null // shown in its place, with a "Try again" button
  onRetry(): void
  strip?: ReactNode
}): ReactNode

// Step 2 — src/domain/money.ts
export function toSend(payment: Payment): {
  amount: DecimalString
  address: string
} // underpaid: its amount_outstanding and its own crypto_address; otherwise the quote's total_due and address

// Step 3 — src/domain/details.ts
export function detailsMatch(payment: Payment, currencies: Currency[]): boolean
// true when the quote's currency is listed, its network is listed under the same name,
// and every amountsToSend(payment) fits the currency's decimals

// Step 4 — src/domain/screen.ts
type With<S extends Payment['status']> = Extract<Payment, { status: S }>
export type DetailsState = 'loading' | 'unavailable' | 'ready'
export type Screen =
  | { kind: 'pay'; mode: 'full'; payment: With<'awaiting_payment'>; clock: 'running'; showAddress: true; remainingMs: number }
  | { kind: 'pay'; mode: 'full'; payment: With<'awaiting_payment'>; clock: 'still_valid'; showAddress: true }
  | { kind: 'pay'; mode: 'full'; payment: With<'awaiting_payment'>; clock: 'checking' | 'cannot_confirm'; showAddress: false }
  | { kind: 'pay'; mode: 'remaining'; payment: With<'underpaid'>; clock: 'none'; showAddress: true }
  | { kind: 'pay_loading'; payment: With<'awaiting_payment' | 'underpaid'>; problem: boolean }
  | { kind: 'waiting'; payment: With<'detected' | 'confirming'> }
  | { kind: 'complete'; payment: With<'paid' | 'overpaid'> }
  | { kind: 'expired'; payment: With<'expired'>; variant: 'plain' | 'cautious' }
  | { kind: 'expired'; payment: With<'expired'>; variant: 'dead_end'; after: 'partial' | 'payment' }
  | { kind: 'failed'; payment: With<'failed'>; moneySeen: 'yes' | 'no' | 'unknown' }
  | { kind: 'checking'; payment: With<'unknown' | 'awaiting_payment'> }
// ScreenInput.detailsChecked: boolean becomes ScreenInput.details: DetailsState
// ClockState stays exported, as the union of the clock values above
```

After Step 4 a screen takes `screen` and reads `screen.payment`; it no longer takes `payment`. `StatusCard` and the other reusable components keep their props. `toSend` narrows its parameter to `With<'awaiting_payment' | 'underpaid'>`. `usePaymentScreen` stops returning `detailsProblem`.

**Rules for every step:**

- No visible string, condition that can be reached, request or amount changes. Existing assertions stay; where a type forces an expected value to change shape, it keeps asserting the same facts.
- `showAddress`, `mode` and `clock` stay as fields. `showAddress` is the address rule in one place and tests assert it by name.
- `SequenceEntry` and `money` are not touched. The dead end keeps its checks on `money`.
- In `WaitingScreen`, `required > 0` and `Math.min(1, …)` stay: the server may send zero required confirmations.
- In `src/domain/screen.test.ts`, `toEqual` stays `toEqual`. Compare everything except the payment, and check the payment's identity once. Do not turn an exact assertion into `toMatchObject`.
- No assertion (`as`) in production code. Test fixtures get one typed helper that narrows a payment by status.
- No new dependency, no new layer, nothing renamed that is not listed here.

- [ ] **Step 1: The shared card.** First add the test that is missing today: the `pay_loading` card shows the connection notice in its strip. It passes before the change; it pins what the extraction must keep. Then extract `LoadingCard` and use it in `App.tsx` and in `PaymentView`'s `pay_loading` case. The "Loading your payment…" card stays as it is: it has no order to show. Neither card gains a heading. Commit: "Share the loading and error card".

- [ ] **Step 2: The amount and address, decided once.** Tests first for `toSend` in `money.test.ts`: `awaiting_payment` gives the quote's `total_due` and address; `underpaid` gives `amount_outstanding` and its own `crypto_address`, with a fixture whose address differs from the quote's. Then use it in `PayScreen` and in `PaymentView`'s announcement, deciding on `payment.status` alone. Commit: "Decide the amount and address to pay in one place".

- [ ] **Step 3: The details check as a pure function.** First add the hook test that is missing today: a catalogue that has both `currencies` and an `error` still gives the pay screen. Then tests first for `detailsMatch` in `details.test.ts`: a match; the currency missing; the network missing; the network listed under another name; `total_due` with too many decimal places; `amount_outstanding` with too many on `underpaid`. Then call it from `usePaymentScreen`. The hook's own tests stay. Commit: "Check a payment against the currency list in src/domain".

- [ ] **Step 4: Screens that receive exactly their payment.** Change `Screen`, `ScreenInput` and `deriveScreen` as in the interfaces above; give `headline` a parameter that names only the fields it reads, so a small literal still works; make each screen take `screen`; compute `details` in `usePaymentScreen` as `loading` when there is no list and no error, `unavailable` when there is no list and an error or the list does not match, `ready` when the list matches. Remove the branches that only defended against another status. Commit: "Give each screen the payment its status guarantees".

- [ ] **Step 5: Gate.** `npm run check && npm run build`, and the test count is not lower than before the task.

---

### Task 18: Stop the clock when time cannot change the screen

Added on 12 Nov 2026, after Task 17, at my request. No status, wording, request or amount changes.

**What was observed.** `useNow` ticks every second and is called by `usePaymentScreen`, so every tick re-renders `PaymentView` and the screen under it, whatever the status. Measured in the running app with temporary commit counters, over ten seconds in each status:

| Status | Polls sent | `PaymentView` commits | Of which from the clock |
| --- | --- | --- | --- |
| Picker | 0 | 0 | 0 |
| `awaiting_payment` | 3 | 13 | 10 |
| `underpaid`, `detected`, `confirming` | 3 | 13 | 10 |
| `paid`, `overpaid`, `failed`, `expired` | 0 | 10 | 10 |

On a final status nothing is polled and nothing can change, and the page still re-rendered once a second for as long as it stayed open.

**Where time is read.** In two places only, and both only when the server's status is `awaiting_payment`:

- `payInFull` in `src/domain/screen.ts`: the countdown, hiding the address at the device's deadline, and the ten-second window in which a "still valid" answer authorises the address.
- `usePaymentScreen`: the one check sent to the server when the device's deadline passes. It applies to any `awaiting_payment`, including while the details card is showing and after a status went backwards.

**The rule.** The clock runs while the server's status is `awaiting_payment`, and not otherwise. Nothing finer: after the deadline the screen still needs the clock, because "still valid" must stop authorising the address when its answer is ten seconds old. Stopping the clock in some sub-states of `awaiting_payment` would need scheduling logic that can get that wrong.

**A stale clock must never be used.** While the clock is stopped its value is old. The status can only become `awaiting_payment` through a server answer, and every answer carries the device time it arrived at (`lastSuccessAt`). So the time the screen is derived from is the later of the ticking clock and the last answer. On the first render after a new quote, that is the answer's own time, a few milliseconds old.

**Interfaces:**

```ts
// src/hooks/useNow.ts
export function useNow(active: boolean, intervalMs = 1_000): number
// active: the device time, updated every intervalMs and at once when the tab becomes visible.
// not active: no timer and no listener. The value is whatever it last was, and is not the time.

// src/hooks/usePaymentScreen.ts
// useNow(status === 'awaiting_payment'), and the time used everywhere in the hook is
// Math.max(<that value>, payment.lastSuccessAt)
```

**Rules:**

- Hook calls stay unconditional.
- No `Date.now()` during render and no state set in an effect's body; both are lint errors here, and neither is needed.
- No memoisation, no new component, no second timer, no change to polling.
- The check at zero keeps both guards: once per quote, and not when the server has answered since the deadline.
- Every timer and listener is cleaned up when the clock stops and on unmount.
- No test asserts a React render count.

- [ ] **Step 1: Write the failing tests**

  In `src/hooks/useNow.test.tsx` (the three existing tests pass `true`):

  - Not active: no timer is scheduled; five seconds pass and the value has not changed; the tab going hidden and visible with the system time moved on does not change it either.
  - Becoming active schedules the timer and the value follows the device time; becoming inactive clears the timer and removes the listener.

  In `src/hooks/usePaymentScreen.test.tsx`:

  - For each of `underpaid`, `detected`, `confirming`, `paid`, `overpaid`, `expired` and `failed`, no timer is scheduled. For `awaiting_payment`, one is.
  - A clock stopped on `expired` for sixty seconds, then a new quote answered now: the pay screen's remaining time is the new deadline minus the time of that answer, not sixty seconds more.
  - A clock stopped on `expired`, then an `awaiting_payment` answer for a quote whose deadline is already past on the device but ahead of the stale value: the screen is "still valid", not a running countdown.
  - A "still valid" screen stops showing the address once its answer is more than ten seconds old.

- [ ] **Step 2: Run them and see them fail**

Run: `npm test -- src/hooks/useNow.test.tsx src/hooks/usePaymentScreen.test.tsx`
Expected: the new tests fail; the existing ones pass.

- [ ] **Step 3: Implement** `useNow(active)` and its use in `usePaymentScreen`.

- [ ] **Step 4: Gate.** `npm run check && npm run build`.

- [ ] **Step 5: Commit**: "Stop the clock when time cannot change the screen".

- [ ] **Step 6: Measure again** in the running app with the same temporary counters, and remove them. Expected: `awaiting_payment` unchanged; `underpaid`, `detected` and `confirming` commit only with their polls; `paid`, `overpaid`, `failed` and `expired` do not commit at all between polls.

---

## Tasks 19 to 27: layout, a visual system and motion

Added on 13 Nov 2026, at my request, after a review of the rendered page at 1200, 768, 390 and 320 px. The page keeps its look: a white card on a cool grey page, near-black for the one primary action, colour only for networks and for status. No status, request, amount or ADR changes. No new dependency.

**What the review confirmed:**

- At 320 px, a long unbreakable word in the merchant or network name makes the card clip the amount, the address's first line and the countdown. The mobile grid column is sized `auto` and the card is `overflow-hidden`.
- "167.275546 USDC" breaks as "USD" / "C" at 390 and 768 px, because the amount uses `break-all`.
- The copy button is 130 px wide idle, 91 px on "Copied" and 294 px on failure, and moves what is under it.
- On a phone the header wraps as "Nordwind" / "Audio" and "ORDER ORD-" / "88213".
- At 1200 px the card is 240 px tall on the picker, up to 631 on the pay screen and 300 on the failed screen. A connection notice adds a row to the strip.
- Three colour pairs fall short on contrast. There are 23 hex colours, 15 font sizes, six radii, three copies of the primary button, three of the amber notice, two link blues, font glyphs for status icons, no focus styles and no motion.

**Decisions I made:**

- The QR is shown on phones as it is now.
- A partial payment's new amount is emphasised, so nobody sends the full amount again by mistake.
- The countdown gets no special styling in its last minute. It gets a bar under it showing how much time is left.
- The waiting screen gets no continuous indicator.
- The copy failure sentence moves out of the button to a line under it.
- A long merchant name wraps. It is never cut short.
- Dark mode and merchant branding are left out.

**Rules for every task below:**

- Every digit of every amount stays visible and unchanged. Nothing is rounded, shortened or hidden.
- The address and QR are shown exactly when they are now. Nothing that hides them may be delayed by an animation.
- Shopper-facing words do not change unless a task says so.
- The colours of the dev panel are not touched.
- Tests keep their assertions. Where markup changes how a string must be found, the same fact is asserted another way.

### Task 19: Stop the card clipping, and keep the unit whole

**Files:** `src/components/CheckoutCard.tsx`, `src/components/OrderHeader.tsx`, `src/components/StatusCard.tsx`, `src/components/NetworkBanner.tsx`, `src/components/QrFrame.tsx`, `src/screens/PayScreen.tsx`, `src/screens/PickerScreen.tsx`, and their tests.

- [ ] **The grid.** The card's single column below `md` becomes `minmax(0, 1fr)`, and every flex child that holds text gets `min-width: 0`, so content wraps inside the card instead of being clipped.
- [ ] **Long words.** Merchant name, order id, network name and the banner and QR frame titles use `overflow-wrap: anywhere`. Nothing is truncated.
- [ ] **The amount.** In `PayScreen` and `StatusCard`, `break-all` goes. The digits and the unit are separate inline pieces: the unit does not break, the line breaks at the space first, and a run of digits breaks only when it is longer than the line. The size is fluid, `clamp(1.75rem, 7.5vw, 2.5rem)`.
- [ ] **The header.** Under 480 px the order id and the fiat amount take their own row under the merchant, on one line with the id on the left and the amount on the right. From 480 px they sit on the right as now.
- [ ] **Tests.** For the pay screen, the waiting screen and the plain expired screen: the amount's text content is exactly the server's string followed by a space and the currency, and the unit is in an element that does not wrap. A long merchant name is rendered in full.
- [ ] Commit: "Wrap inside the card, and never split a currency code".

### Task 20: Name the colours

**Files:** `src/index.css` and every component and screen that has a colour. Not `src/dev/`.

Tokens in `@theme`, each generating its Tailwind utilities:

| Token | Value | Replaces |
| --- | --- | --- |
| `page` | `#f5f5f7` | |
| `surface` | `#ffffff` | `bg-white` |
| `surface-sunken` | `#fafbfc` | also `#f6f7f9`, `gray-50` |
| `surface-inverse` | `#14161a` | |
| `ink` | `#14161a` | |
| `ink-muted` | `#4b5563` | `gray-600` |
| `ink-subtle` | `#6b7280` | `gray-500` |
| `ink-faint` | `#838a94` | `#9aa1ab`, which was 2.61:1 on white; this is 3.48:1 |
| `ink-inverse` | `#ffffff` | `text-white` |
| `ink-inverse-muted` | `#c9ced4` | |
| `line` | `#dfe3e8` | |
| `line-strong` | `#cfd4da` | |
| `line-faint` | `#eef0f2` | |
| `track` | `#e6e8eb` | |
| `action` | `#14161a` | |
| `action-disabled` | `#e5e7eb` | also `#d5d9de`; its text is `ink-muted` |
| `link` | `#3b5bdb` | also `blue-700`; a disabled link is `ink-subtle` |
| `focus` | `#3b5bdb` | |
| `ok` | `#15803d` | |
| `warn` | `#b45309` | |
| `warn-surface`, `warn-line`, `warn-ink` | `#fff7e6`, `#f3d999`, `#6b4e00` | also `amber-50`, `amber-300` |
| `bad` | `#b91c1c` | also `red-700` |
| `pending` | `#6b7280` | |
| `network-tron`, `network-ethereum`, `network-polygon`, `network-solana`, `network-other` | `#ff060a`, `#627eea`, `#8247e5`, `#14b8a6`, `#6b7280` | |

- [ ] Network tokens are used only by `NetworkChip`. No action or status style uses one.
- [ ] After the task, no hex colour and no Tailwind palette colour is left in `src/components` or `src/screens`.
- [ ] Commit: "Name the colours the checkout uses".

### Task 21: One button, one notice, one set of icons, one scale

**Files:** create `src/components/Button.tsx`, `src/components/Notice.tsx`, `src/components/StatusIcon.tsx`; `src/index.css`; the screens and components that use them.

- [ ] **`Button`**, with `variant: 'primary' | 'secondary' | 'link'` and a `busy` flag, replaces every hand-written button. Primary is the black pill; secondary is the bordered control used by copy and "Try now"; link is the underlined text button. Each has hover, pressed, disabled and busy states. A disabled primary button is `action-disabled` with `ink-muted` text.
- [ ] **`Notice`** is the one warning box, used by the underpaid banner, the overpaid notice, the dead end and "payment not found".
- [ ] **`StatusIcon`** draws pending, clock, check and alert as inline SVG in the existing ring, in place of the glyphs `●`, `◷`, `✓` and `!`.
- [ ] **Type:** `label` 12 px, `small` 14, `body` 15, `lead` 16, `figure` 18, `title` 22, and `amount` from Task 19. Every other size goes.
- [ ] **Radii:** `card` 22 px, `control` 12 px, and full. Every other radius goes.
- [ ] Commit: "Share the button, the notice, the status icons and the scales".

### Task 22: A copy button that keeps its size, a strip that keeps its shape, focus you can see

**Files:** `src/components/CopyButton.tsx`, `src/hooks/useCopy.ts` only if needed, `src/components/StatusCard.tsx`, `src/screens/PayScreen.tsx`, `src/index.css`, tests.

- [ ] **Copy.** The button always has the width of its normal label. On success the label inside it reads "Copied". On failure the button keeps its label and the sentence "Copy failed. Select the text and copy it." appears on a line under it, announced as it is now.
- [ ] **Strip.** The notice takes the space on the left and wraps there; its button and the link stay together on the right. At 1200 px a notice appearing on the pay screen changes the card's height by no more than 24 px.
- [ ] **Focus.** Every button, link, menu and tick box shows a 2 px `focus` outline, offset 2 px, on keyboard focus. The heading that receives programmatic focus keeps none.
- [ ] Commit: "Keep the copy button and the strip steady, and show keyboard focus".

### Task 23: One card height on a desktop

**Files:** `src/components/CheckoutCard.tsx`, test.

- [ ] From `md` up the card's two columns have a minimum height of 460 px. Below `md` there is none.
- [ ] Commit: "Give the card a steady height on wide screens".

### Task 24: A bar under the countdown

This reverses something I dropped. The bar was left out because the API gives a quote's deadline and not its lifetime. It comes back on one condition: the page draws it only when it saw the quote begin.

**Files:** `src/domain/sequence.ts`, `src/domain/screen.ts`, `src/screens/PayScreen.tsx`, their tests, `src/test/fixtures.ts` if needed.

**Interfaces:**

```ts
// src/domain/sequence.ts
export type StatusSequence = {
  // …as now, plus:
  quoteStartedAt: number | null // device time the page saw the current quote begin; null after a reload, until a new quote
}
// startSequence(payment, 'creation', at) sets it to at; startSequence(payment, 'reload', at) sets it to null.
// recordStatus sets it to at when quote.expires_at changes, and leaves it alone otherwise.

// src/domain/screen.ts — the running pay variant gains:
lifetimeMs: number | null // the deadline minus quoteStartedAt; null when that is null or not positive
```

- [ ] Tests first, in `sequence.test.ts` and `screen.test.ts`: creation sets the start; a reload does not; a repeated status keeps it; a new quote resets it; the running screen carries the lifetime, or `null` after a reload.
- [ ] `PayScreen` draws a thin bar under "Rate held for" when `lifetimeMs` is not `null`: its filled share is `remainingMs / lifetimeMs`, held between 0 and 1. It is decoration (`aria-hidden`); the time beside it is the information. With no lifetime there is no bar and nothing in its place.
- [ ] The bar disappears with the countdown, at once.
- [ ] Commit: "Draw the time left as a bar when the page saw the quote begin".

### Task 25: Make a partial payment's new amount hard to miss

**Files:** `src/screens/PayScreen.tsx`, `src/index.css`, test.

- [ ] On `underpaid`, the label "Send the remaining" is set in `warn` and the amount block carries a `warn` rule down its left side. These stay for as long as the status does, so the emphasis does not depend on motion.
- [ ] When the block first appears it is washed in `warn-surface`, fading over 1.5 s, once. With reduced motion there is no wash.
- [ ] The words do not change, and the amount is still replaced in a single frame, never counted or tweened.
- [ ] Commit: "Emphasise the amount still to send after a partial payment".

### Task 26: Motion for a change of screen

**Files:** `src/index.css`, `src/components/CheckoutCard.tsx`, the screens, tests.

- [ ] **Entrances only.** One utility: opacity from 0 and 8 px of rise, 180 ms, `cubic-bezier(.2, 0, 0, 1)`, through `@starting-style`. It is applied to the card's content, not its frame. Nothing has an exit animation.
- [ ] A change of screen kind plays it once. A poll or a countdown tick that changes nothing plays nothing: a test re-renders the payment view with a new answer of the same status and finds the same DOM node.
- [ ] When the address must go, it is absent from the DOM in the same render as the status change. The existing tests for that stay.
- [ ] `prefers-reduced-motion: reduce` makes every transition and animation in the app instant, in one rule.
- [ ] Commit: "Fade a new screen in, and never animate one out".

### Task 27: Motion for the rest

**Files:** `src/index.css`, `src/screens/PickerScreen.tsx`, `src/screens/WaitingScreen.tsx`, `src/screens/PayScreen.tsx`, `src/components/ConfirmChangeDialog.tsx`, `src/components/CopyButton.tsx`, `src/components/NoticeStrip.tsx`, `src/components/Button.tsx`, tests.

| What | Motion |
| --- | --- |
| Picker: the fee line and the "You are paying with" group, when a network is first chosen | The entrance, 160 ms, 6 px |
| "Still working…", a create or requote error, the copy failure line, a connection notice appearing | Fade in, 150 ms, no movement |
| The address and QR returning on "still valid" | Fade in, 150 ms, no movement |
| The confirmations bar | Width moves to the server's value, 300 ms ease-out, in either direction |
| The countdown bar | Width follows each tick over 1 s, linear |
| The dialog and its backdrop opening | Fade in 150 ms; the dialog from 0.98 scale |
| Buttons, the menus and the tick-box-gated controls | Colour, 120 ms |

Immediate, on purpose: any amount; the countdown's digits; the address and QR going; a notice changing or disappearing; the dialog closing; an error replacing a loading line.

- [ ] Commit: "Add the small motions: picker, notices, dialog, bars and buttons".

---

## Task 28: Start over from the dev panel, and a panel that slides

Added on 13 Nov 2026, at my request, after I saw a drawing of the panel with the new section. It is built before Tasks 21 to 27 because I want it for testing them.

**Why.** Once a payment is `paid`, `overpaid` or `failed` the page stops polling, and the page remembers every status it has seen. So a status pressed after that never brings the page back, and the only way out was to edit the URL by hand.

**Files:** `mock/store.ts`, `mock/app.ts`, `mock/control.test.ts`, `src/dev/mockControl.ts`, `src/dev/mockControl.test.ts`, `src/dev/DevPanel.tsx`, `src/dev/DevPanel.test.tsx`, `README.md`, `docs/design-doc.md`, and `src/App.tsx` only if the row around the panel needs it. Nothing in `src/api`, `src/hooks`, `src/domain`, `src/screens` or `src/components`: the app must not learn that the mock exists.

**Interfaces:**

- `MockStore.restart(reference: string): PaymentRecord | undefined`
- `POST /__mock/payments/:reference/restart`, no body needed: 200 with the payment, or the same 404 the status route gives for an unknown reference.
- `restartMockPayment(reference: string): Promise<void>` in `src/dev/mockControl.ts`.

### The mock

- [ ] Tests first, in `mock/control.test.ts`: a restart after `paid` answers `awaiting_payment` with the same reference, order and pair; nothing of the old status is left (`amount_received`, `tx_hash`, `confirmations`, `settled_at`); `expires_at` is rebuilt from the mock's clock and the current "New quotes last" setting, shown by changing that setting before the restart; a restart of an unknown reference is a 404; a restart works from `awaiting_payment` too.
- [ ] `restart` builds the quote the way a new payment does, for the payment's own currency and network, and saves it as `awaiting_payment` with no status fields. It does not go through `requote`, which refuses anything that is not `expired`.

### The panel

- [ ] A section titled "Start over" between "Current payment" and "Set status", with two buttons side by side, `restart this payment` and `new payment`, and under them the line: "restart: same reference, awaiting_payment with a fresh quote, then the page reloads. new: back to the picker." Both buttons are disabled when there is no payment. They look like the panel's other buttons.
- [ ] `restart this payment` sends the restart. When the mock answers, the page reloads (`window.location.reload()`), because only a reload clears what the page has seen. When the request fails, nothing happens, like a failed status command.
- [ ] `new payment` loads the page's own path with no query (`window.location.assign(window.location.pathname)`).
- [ ] jsdom cannot spy on `window.location`. Put the two navigations behind something a test can replace; two functions in a small module in `src/dev`, mocked with `vi.mock`, is enough.
- [ ] The panel remembers being open in `sessionStorage` under `dev-panel-open`, read when it mounts and written when it opens or closes, so it is still open after either button reloads the page. A browser that refuses storage is ignored: the panel then starts collapsed as it does now.
- [ ] Tests: the restart button sends the open payment's reference and then reloads; a failed restart does not reload; `new payment` navigates and sends nothing to the mock; both are disabled with no payment; a panel left open is open again after a remount, and one that was closed is not. The existing tests keep their assertions.

### The slide

- [ ] Opening and closing both animate. The panel's width goes between the 34 px tab and 330 px in 200 ms with `cubic-bezier(.2,0,0,1)`. Its content keeps a fixed 330 px width and is clipped, so nothing inside reflows while the width changes. With `prefers-reduced-motion: reduce` there is no transition.
- [ ] The panel is fixed to the right edge of the window at every width. The row beside the page keeps 34 px for it, and from 900 px wide that reserved width grows to 330 px in step with the panel, so the card is pushed aside as before. Under 900 px the panel lies over the page as before.
- [ ] The tab and the content are both always in the document, so the one going away can fade while the width changes. Whichever is not showing is `inert` and `aria-hidden`: it cannot be focused, is not announced, and the tests' role queries do not find it.
- [ ] Focus moves to "hide" when the panel opens and to the tab when it closes, and never when the page loads, including when it loads already open.
- [ ] Still no request to the mock while collapsed.

### The documents, in the same commit

- [ ] `README.md`, in "With the dev panel": two rows in the table before "An offline browser": "The same payment from the start" (press **restart this payment** under **Start over**; it goes back to `awaiting_payment` with a new quote and the page reloads) and "The picker again" (press **new payment** under **Start over**). The paragraph that ends "To try another sequence, start a new payment." ends instead: "To try another sequence, use **Start over**: both of its buttons reload the page, and the panel stays open across the reload." In "With curl", one more example: `curl -X POST localhost:5173/__mock/payments/AQH-100306-PMT/restart`, with the comment "Put a payment back to awaiting_payment with a new quote. An open page needs a reload to forget what it saw."
- [ ] `docs/design-doc.md`, section 8: a row in the controls table after "Set status": "Start over" with "\"restart this payment\" puts the open payment back to `awaiting_payment` with a new quote and reloads the page. \"new payment\" reloads to the picker". After "It starts collapsed.": "It slides open and closed in 200 ms, or at once when the system asks for reduced motion, and it remembers being open for the life of the tab, so it is still open after a reload." Under "What the build changed from the drawing", a bullet: "**Start over.** Added after the build, at my request. Once a payment is `paid`, `overpaid` or `failed` the page stops polling, and it remembers the statuses it has seen, so a status pressed afterwards could not bring the page back. The buttons reload the page because loading it again is the only thing that clears that memory."
- [ ] `docs/design-doc.md`, the paragraph before the first drawing: "eight small ways" becomes "nine small ways", and after the sentence listing the six, one more: "One was added later: the dev panel has a Start over section and slides open and closed (section 8)."
- [ ] `docs/design-doc.md`, the table of where state lives: the row "A ticked box, an open dialog, the open dev panel" loses the dev panel, and a new row under it reads: "The open dev panel", "React state in the panel, copied to `sessionStorage`", "So it is still open after the reload its Start over buttons cause".
- [ ] Commit: "Start over from the dev panel, and slide it open and closed".

---

## Tasks 29 to 34: the picker as radio sections, chain colours, and three smaller changes

Added on 13 Nov 2026, after I saw drawings of the options and chose. Nothing here changes a status, a request, an amount or an ADR. No new dependency.

**What I decided:**

- Both pickers become vertical sections of radio buttons that open and close with an animation, on every window width, laid out like the phone drawing. Choosing an option is animated too.
- A network option shows the network's name only. Its fee and usual time are on a line under the network section once a network is chosen.
- The picker has no right-hand column. The Continue button sits under the pickers.
- The pay screen keeps its two columns.
- The chain colours go into the design system: Ethereum `#627EEA`, Solana `#9945FF`, Polygon `#8247E5`, Tron `#DC062B`.
- The Continue button takes the chosen chain's colour.
- "Change currency or network" becomes an outlined button, on the pay screen and on the expired screen.
- The copy button narrows to fit "Copied" and widens back, animated both ways.
- Each copy button on the pay screen sits in line with what it copies, the amount or the address, and no longer beside the label or under the amount.

**What the planning agent recommended and I did not take:** keeping both groups open with no collapsing, and a black Continue button on every network, on the grounds that a red "Continue with USDT on Tron" reads as a delete button.

**Not decided yet.** The planning agent's default is in brackets. Nothing is built on a default until I answer.

1. The pay screen's network banner and QR frame: filled with the chain colour, or dark with a chain-coloured edge and chip. [Dark with an edge. Task 32 waits for this.]
2. The two sentences that lived in the right-hand column: "Your wallet or exchange must be able to send USDC on the Polygon network." and "The amount to send and the address are shown next." [Keep both: the first under the fee line, the second under the button. Only the "You are paying with" pill goes.]
3. White text on Ethereum's blue is 3.69:1, under the 4.5:1 that 15 px text needs. Solana is 4.52:1, Polygon 5.27:1, Tron 5.12:1. [The Continue button on Ethereum uses a blue 11% darker, `#5770d0`, 4.53:1. Every other use keeps `#627EEA`.]
4. The colour of a chosen currency, which has no chain. [The page's near-black.]
5. With names only in the options, comparing two networks' fees takes a click on each. [As I decided. The planning agent would keep the fee as small text in each option.]

**Rules for every task below:**

- Every rule of Tasks 19 to 27 still holds: every digit of every amount stays visible; the address and QR are shown exactly when they are now; shopper-facing words change only where a task says so; the dev panel's colours are not touched; tests keep their assertions, or assert the same fact another way.
- Colours, sizes and radii come from `src/index.css`. A network's colour is never used for a status.
- Reduced motion is handled by the one rule in `src/index.css`. No component adds its own.
- Each task is checked in a real browser at 1200, 768, 390 and 320 px before it is called done.

### Task 29: The chain colours, named once

**Files:** `src/index.css`, `src/components/NetworkChip.tsx`, create `src/components/networkColours.ts` and its test.

- [ ] `@theme`: `network-ethereum` `#627eea`, `network-solana` `#9945ff`, `network-polygon` `#8247e5`, `network-tron` `#dc062b`, `network-other` `#6b7280` as now. One more, per decision 3: `network-ethereum-fill` `#5770d0`, with a comment giving the two contrast figures.
- [ ] `networkColours(networkId: string): { chip: string; fill: string; border: string; tint: string; accent: string }` returns whole class names Tailwind can see: the chip's background, the background of a filled control that carries white text, a border, the 10% tint for a chosen option's background, and the radio's accent colour. An id it does not know gets `network-other` in every slot. `fill` is the chain's own colour except for Ethereum.
- [ ] `NetworkChip` takes its background from it. Nothing else changes in this task.
- [ ] Test: each of the four ids and an unknown one returns five non-empty classes, and Ethereum's `fill` differs from its `chip`. The built CSS has a rule for every class returned.
- [ ] Solana's and Polygon's purples are close. The network's name is always beside its colour, so colour is still never the only signal.
- [ ] Commit: "Name the chain colours once, with a fill that carries white text".

### Task 30: The picker as two sections of radio buttons

**Files:** `src/screens/PickerScreen.tsx` and its test, a small collapsible section component in `src/components` if it earns one, `src/components/CheckoutCard.tsx`, `src/components/LoadingCard.tsx`, `src/components/Button.tsx`, `src/App.tsx`, `src/App.test.tsx`, `src/index.css`, the documents named at the end. `usePickerChoice` keeps its interface: it already clears the network when the currency changes and fills in a currency's only network.

**The card.** The picker's card is one column, at most 520 px wide, at every window width, with no minimum height. The loading card shown before the picker uses the same narrow card, so the frame does not jump when the list arrives. The pay screen and every status screen keep the 940 px two-column card.

**Top to bottom:** the order header; the "payment not found" notice when there is one; "Choose how to pay"; the Currency section; the Network section; the fee line; the Continue button; "Still working…" or the error; the "Back" link when changing an expired quote. The sentences of decision 2 go where it says.

**A section** is a `fieldset` with a `legend` ("Currency", "Network") and has two forms:

- [ ] Open: a column of options. Each is a `label` at least 44 px tall holding a native radio and the option's text: for a currency its code in bold and its name, for a network its chip and its name. No fee, no time.
- [ ] Closed: one row with the chosen option's text and an outlined "Change" button whose accessible name says which section it changes.
- [ ] The Currency section is open while no currency is chosen, and after its "Change" until a currency is chosen again. The Network section is not shown at all until a currency is chosen; then it is open while no network is chosen, and after its "Change". Choosing closes the section. Choosing a currency with one network leaves the Network section closed on that network. Changing the currency opens the Network section with nothing chosen.
- [ ] A chosen option has a border in its colour and a 10% tint of it behind: the chain's colour for a network, and per decision 4 for a currency. The radio's accent matches.

**Motion.**

- [ ] Choosing: the option's border and background reach their colour over 120 ms. Then the section closes.
- [ ] Opening and closing: the height moves over 200 ms with `cubic-bezier(.2,0,0,1)`. Both forms are always in the document so each can shrink while the other grows; the one not showing is `inert` and `aria-hidden`.
- [ ] The fee line appears with the existing 160 ms, 6 px entrance when a network is first chosen, and updates in place when the network changes.

**Focus.** A choice made with the keyboard must never leave focus on something hidden.

- [ ] After a currency is chosen: the first network radio if the Network section opened, otherwise the Continue button.
- [ ] After a network is chosen: the Continue button.
- [ ] After "Change": the chosen radio of that section.
- [ ] Nothing takes focus when the page loads.
- [ ] Arrow keys choose, as native radios do, so each press chooses and closes. Every option stays reachable: the first with Space, the others with the arrows, and again after "Change".

**The button.**

- [ ] `Button` gains one prop for the fill of a primary button. The picker passes `networkColours(network.id).fill` once a currency and a network are chosen; nothing else uses it. Its words do not change ("Continue with USDC on Polygon", "Get a new quote with …", "Working…"). Before both are chosen it is the disabled grey it is now. Hover and pressed states stay visible on every chain colour.
- [ ] While a create or requote is in flight, the radios and the "Change" buttons are disabled.

**What goes.** The right-hand column and the "You are paying with" pill. The two menus and their chevron.

**Tests.** The existing picker and app tests drive two menus; they are rewritten to drive the radios and keep what they assert. New ones: which section is open in each state above; a currency with one network; changing the currency clears the network and reopens its section; the hidden form of a section cannot be reached by a role query; focus after each choice and after "Change"; the fee line appears only after a network is chosen and shows that network's fee and time; the button's label and that its fill is the chosen chain's; nothing is chosen or focused on load.

**Documents, in the same commit.**

- [ ] `AGENTS.md`, "Look and motion": "Things may fade in. Nothing is animated out." becomes "Things may fade in. Nothing the server takes away is animated out. The picker's sections open and close with the shopper's own choice." The line about never animating a change of amount or the removal of an address, a QR, a notice or a screen stays.
- [ ] `docs/design-doc.md`: the paragraph before the first drawing (the picker is now radio sections, not menus, and has no right-hand column); section 7.4 (nothing is preselected, a currency's only network is filled in, the network is named on the button); section 11's "Picker menus" entry, rewritten as "Picker sections"; section 11.1's rows for the picker's motion and for "Buttons and the picker's menus", its sentence that the network colours are used by the chip alone, and its sentence that nothing in the checkout is animated out.
- [ ] Commit: "Choose the currency and the network from two sections of radio buttons".

### Task 31: Outlined buttons for "Change currency or network"

**Files:** `src/screens/PayScreen.tsx`, `src/screens/ExpiredScreen.tsx`, their tests.

- [ ] Both become `Button variant="secondary"`. Their words, their handlers, and the expired screen's tick box that enables it do not change. The picker's "Back" stays a link.
- [ ] On the pay screen the strip keeps its shape: text on the left, "Try now" and this button together on the right. Focus still returns to it when the dialog closes on "Stay on this payment" or Escape.
- [ ] Commit: "Make Change currency or network an outlined button".

### Task 32: The chain's colour on the pay screen

Waits for decision 1.

**Files:** `src/components/NetworkBanner.tsx`, `src/components/QrFrame.tsx`, their tests.

- [ ] The QR frame's border takes the chain's colour in either answer. The four-module quiet zone inside it stays white.
- [ ] If filled: the banner and the frame's label bar use `fill` with white text, and the chip inside them turns white with the chain's colour for its letter. If dark with an edge: both stay `surface-inverse`, the banner gains a 4 px edge in the chain's colour, and the chip keeps it.
- [ ] The banner's and the frame's words do not change.
- [ ] Commit: "Carry the chain's colour onto the pay screen".

### Task 34: Each copy button beside the value it copies

Today "Copy amount" drops under the amount whenever the two do not fit on a line, and "Copy … address" sits on the label's row, above the address. I asked for both to line up with the value they copy. Built before Task 33, which animates the button where this task puts it.

**Files:** `src/screens/PayScreen.tsx` and its test. The status screens' rows already have the button beside the value.

- [ ] The amount: the amount on the left and "Copy amount" at the right end of the same row, centred on the amount. The currency code may move to a second line to make room. The digits may not: an amount's digits are never broken because of the button.
- [ ] The address: its label on a line of its own; under it the address on the left and "Copy … address" at the right end of the same row, centred on the address, which may take two lines beside the button.
- [ ] Where a row cannot hold both without breaking the digits, or without putting the address on more than two lines, the button sits directly under the value, at its left edge. That is the layout on a phone.
- [ ] Nothing is clipped at 320 px with the long names and the 20-digit amount the earlier checks use, and the unit still never splits.
- [ ] The words, the copied values and the order a keyboard reaches them in do not change.
- [ ] Commit: "Put each copy button beside the value it copies".

### Task 33: A copy button that narrows to "Copied" and widens back

This changes something Task 22 fixed. Task 22 made the button keep the width of its normal label, because its width used to jump and move what was beside it. I now want it to narrow to fit "Copied" and widen back, as a movement and not a jump.

**Files:** `src/components/CopyButton.tsx` and its test, `src/index.css` if it needs a rule, the documents named below.

- [ ] On a successful copy the button's width moves to the width of "Copied" over 180 ms with `cubic-bezier(.2,0,0,1)`, and back the same way when the label returns. The edge it is aligned to stays where it is: the right edge when it sits at the end of a row, the left edge when it sits under the value.
- [ ] The space the button takes in its row never changes: the row is laid out for the normal label throughout. So nothing beside or under the button moves, and the button cannot jump to another line while it is narrow.
- [ ] No measuring in JavaScript, no timer, no observer. One way that needs none: two one-column grids side by side, each holding an unseen copy of one label, with their single column moving between `1fr` and `0fr` in opposite directions, and the label people see laid over them.
- [ ] A failed copy is as it is now: the button keeps its label and its width, and the sentence appears under it.
- [ ] What a screen reader hears does not change.
- [ ] The labels inside the button no longer wrap. A network name too long for the button is cut with an ellipsis in the button only; it is whole in the address label and in the banner. Nothing may extend past the card.
- [ ] Tests: the label reads "Copied" after a copy and the normal label after two seconds; both unseen copies are hidden from assistive technology; the failure line is unchanged.
- [ ] `docs/design-doc.md`: section 11's "Copy buttons" entry and section 11.1's "Things that keep their place" say that the space the button takes is fixed and the button narrows and widens inside it.
- [ ] Commit: "Narrow the copy button to Copied and widen it back".

---

## How this plan is executed

- **Tasks 1 to 13** are implemented one at a time, in order, each by a fresh implementer on Opus that is given this plan, the spec and its own task.
- **After each task's commit,** Codex reviews that commit read-only before the next task starts. Every finding is fixed, rejected with a reason, or deferred, in at most two rounds. Fixes are new commits.
- **The planning agent** reads each commit and its diff, re-runs `npm run check`, and records in `docs/agent-log.md` anything rejected or wrong.
- **After Task 13,** Codex reviews the whole branch, and the full gate runs once more.
- **Task 14** is done with the human.
- **Task 15** was added after the walk-through and is built like Tasks 1 to 13: one implementer on Opus, then a Codex review of its commits.
- **Task 16** is a folder refactor added after Task 15: one implementer on Opus in a separate worktree, a Codex review of the moves, then a Codex pass over the whole change.
- **Task 17** removes repeated decisions and unreachable branches: one implementer on Opus in a separate worktree, a Codex review of the three mechanical steps and another of the typed change, then a Codex pass over the whole change with its documents.
- **Task 18** stops the clock outside `awaiting_payment`: measured first by the planning agent in the running app, built by one implementer on Opus on top of Task 17, reviewed by Codex, then measured again.
- **Tasks 19 to 27** follow a review of the rendered page: each is built by an implementer on Opus in a separate worktree, checked by the planning agent with screenshots and measurements at four widths, and reviewed by Codex. Nothing is pushed until I have tested it.
- **Task 28** adds Start over to the dev panel and makes it slide. It was planned after Task 20 and is built next: one implementer on Opus in the same worktree, checked by the planning agent in a browser, and reviewed by Codex.
- **From Task 21 on, the tasks ran in lanes,** once I asked whether they could run in parallel. Tasks 28, 21 and 24 were built at the same time, then Tasks 22, 23 with 26, and 25, then Task 27 by itself. Each lane had its own worktree and branch and touched files the others did not, was checked in a browser and reviewed by Codex on its own, and was then merged with a merge commit.
- **Tasks 29 to 34** were planned after I chose from drawings. Task 29 goes first, because the others use its colours. Then three lanes run side by side in their own worktrees: Task 30; Task 31; and Task 34 followed by Task 33, which share the copy button. Task 32 joins them once I have answered its question. Each is checked in a browser and reviewed by Codex before it is merged.
- Nothing is pushed until the human says so.

# Agent log

A running record of where the coding agent and I disagreed, and where it got something wrong. Entries are added when they happen. The README's "Working with the agent" section is written from this file.

Each entry: what the agent proposed, what was decided, and why.

Entries are not edited afterwards. File paths and component names in an entry are the ones in use when it was written.

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
- **About the payment state machine.** The brief says there are "six more states" beyond the four in its diagram. The API defines four more. I pointed this out before the agent read the brief, so it did not get the chance to miscount; it confirmed eight. It made no factual error about the statuses in this session. On entry 2 above, where it wanted the clock to stop on `underpaid` as it does on `detected`, I disagreed at first and came round after the review; see "Where the review changed a decision of mine".

## 12 Nov 2026: review of the first draft

Two reviews read the first draft of the design before I approved it. One was a fresh agent acting as a builder who has to plan from the document alone. The other was Codex, a different model, checking the design against the brief.

### What the reviews caught in the agent's draft

All of these are fixed in the design doc.

- **An unbacked promise.** The outage notice said "Your payment is unaffected." A failed request tells the page nothing about the payment. This broke the draft's own rule against promising what the API does not state.
- **A stale address after the tab returns.** When the device clock turns out to be wrong, the page shows the address with no timer. The draft would have kept showing it while the tab came back from the background, before a fresh answer arrived. That state now depends on an answer from the last 10 seconds.
- **A status that goes backwards.** `detected` followed by `awaiting_payment` would have brought the address back and invited a second payment. I chose to keep the address hidden once money was seen for a quote.
- **No cache rule.** Nothing said that status requests must bypass the HTTP cache.
- **A tick box nobody could truthfully tick.** "I have not sent a payment" was described as gating every expired screen, including the one for a shopper who had paid part.
- **A rule with no data behind it.** The decimal-places check was written for every amount, but only crypto currencies have a `decimals` value.
- **A design that leaned on a document the repo does not contain.** The draft never restated the API it was designed against, so a builder without the brief could not have planned from it. Section 4.5 now does.

### Where the review changed a decision of mine

- **No new quote after a partial payment.** In the design session I had decided that a quote which expired after a partial payment would offer a new quote for the full amount, with a warning that the earlier funds would not count. Codex pointed out that the API says nothing about what happens to those funds, so the warning was a guess told to the shopper as fact, against the design's own wording rule. The agent proposed softening the wording. I went further and removed the new quote: that screen is now a dead end that points to the merchant. See ADR 0003.

- **Any money stops the clock.** This reverses entry 2 in the table above, so that recommendation was not thrown away in the end. Codex read the brief's line, that a payment on its way must never expire under the shopper, as covering a partial payment. Two things made me agree. After the change above, missing the deadline on a partial payment had become a dead end. And the page never expires anything by itself, so it was our own mock that would have stranded the shopper. The countdown now exists only while nothing has arrived. See ADR 0003, which records how the decision moved.

### What Codex argued that I kept as it was

- **A slow device clock during an outage.** Codex showed that two of my decisions combine badly: the countdown uses the device clock, and the address stays visible during an outage until that countdown reaches zero. With a slow clock and an unreachable server, the real deadline can pass while the address is still on screen. I kept both decisions and wrote the consequence into ADR 0001. Hiding the address after a period of silence would hurt the common case, a correct clock and a short outage, to protect a rare double failure.
- **The ETH fee.** Codex wanted the catalogue's `3.20` served literally as ETH, or the question put to the recruiting contact. I kept my reading of catalogue fees as USD. The catalogue itself is served exactly as given; the brief shows only one example quote, so the ETH quote was mine to define either way. It is listed as an assumption in the design doc.
- **Polling on `expired`.** Codex noted the brief says to stop polling on terminal states and the API never says `expired` can change. I kept the polling, because stopping there invites a second payment from a shopper whose first one is in flight. Whether `expired` is terminal is now an explicit open question.
- **Resuming after a refresh.** Codex noted the brief puts persistence out of scope. I kept it; ADR 0005 already argues why.
- **The QR and the network.** Codex noted that a QR holding only an address gives the wallet no network. That is true and stays true until the API returns what a payment link needs. The design doc now states the limit plainly and no longer says a wrong-network send is impossible.

## 12 Nov 2026: second review pass

Codex read the revised documents once more. This was the second and last pass on the design.

### What it caught in the agent's revisions

- **An amount shown before it was checked.** To avoid hiding a payment in flight, the agent had let a resumed payment render before the currency list arrived, which meant an amount to send could appear before its decimal-places check. Now only the pay screen waits for the list. Screens that only report a status do not.
- **An unknown status with no way forward.** The "we're checking" screen for a status the page does not know had no reference and no contact line, so a status that never resolved left the shopper stuck. It now has both.

### What Codex argued that I kept as it was

- **Changing currency while a quote is live.** Codex wanted no change allowed once an address has been shown, because the confirmation cannot rule out a transfer started on another device. I kept the confirmation. A shopper who picked the wrong network should not have to wait for the quote to expire before they can correct it.

### What Codex raised that I deferred

- **Money seen, then forgotten.** Two paths still lead to a new quote after the page has seen money: a status that goes backwards and then expires, and a reload, which restarts the status sequence. Both sit behind the "I have not sent a payment" tick box. I approved the design with these as known limits and listed the fixes as follow-ups in the design doc.

## 12 Nov 2026: the plan

The agent wrote the task plan from the approved design. Two checks ran before any code was written.

### What the agent's own pre-flight check caught

- **A requote that would have created a second payment.** The plan made "create or requote" depend on which screen was showing. But "Get a new quote" is pressed on the expired screen, where the plan would have chosen "create". The rule is now simple: a payment that already exists is requoted, and a new one is created only when there is none.

### What Codex caught in the plan

Codex raised fourteen points and all of them held up. The four that mattered most:

- **A double-click guard that did not guard.** The plan stopped a second write by checking React state, which is still stale when two clicks land before a re-render. It is now a latch set synchronously before the request starts.
- **Behaviour inside components.** The plan put timers, clipboard access and effects in components, against this repo's own rule that components render and hooks own behaviour. The plan now names a hook for each, and `AGENTS.md` says exactly what a component may hold: view state nothing else reads.
- **A pay screen that could load forever.** After a reload, if the currency list failed to load, the pay screen had no way to tell "still loading" from "failed" and no retry.
- **Copy buttons that did not say what they copy.** The status screens had buttons labelled just "Copy", against the rule that a copy button names what it copies.

## 12 Nov 2026: the build

### Task 1

- **A plan written from stale knowledge.** The planning agent told the implementer to keep "the template's ESLint config". The current Vite template no longer has one: it ships oxlint and TypeScript 7. The implementing agent stopped at the first step and reported it, with the options, instead of improvising. The decision was to pin the last template version that ships ESLint, because the lint rule that bans `Number(...)` on amounts cannot be written in oxlint.
- **A test setup that leaked between tests.** The plan never said to clean up after each component test, and the implementer did not add it. With Vitest's globals off, Testing Library does not register its own cleanup, so every later component test would have found earlier renders still on the page. I caught it reading the commit; Codex did not. The fix came with a two-render probe that failed before and passed after.
- **A lint rule narrower than the rule it enforces.** The plan asked for a ban on `parseFloat` and `Number(...)`. The implementer pointed out that `Number.parseFloat` and `new Number` got past it. The rule now covers every form the Money rule in `AGENTS.md` names, including `toFixed` and unary plus.

### Task 2

- **An order of checks taken from the wrong place.** The mock's requote checked whether the quote had expired before checking that the requested currency and network exist, so a request for a pair that does not exist got "not expired" where it should get "invalid request". The implementing agent said afterwards that it had taken the order from the order in which a type listed its cases. Codex caught it. A request is now validated before the payment's state is looked at.
- **Wording close to the brief, but not the brief's.** The 409 said "Quote not expired" where the brief's example says "Quote has not expired". I caught it reading the commit. The brief gives the fixture, so the mock now uses its words exactly.

### Task 3

- **A plan rule that contradicted the design.** The plan said the mock refuses any negative setting. The design's dev panel sets the server clock five minutes behind, which is a negative number. The implementing agent noticed, applied the rule only to the quote lifetime and the delay, and reported it.
- **A delay that outlived its request.** With the mock set to respond slowly, a request the page had already given up on still ran on the server when the delay ended. Codex caught it. The timer is now cleared when the connection closes.
- **A test that proved nothing.** For that fix, the planning agent specified a test: abort a slow create, then check that no payment appeared. The implementing agent ran it against the unfixed code first and found it passed anyway, because Node discards the body of an aborted request before the handler can use it. It said so and wrote a test that does fail without the fix. I would not have known the first test was empty.
- **Nothing tested the Vite plugin.** Removing either of its two hooks would have left every test green. Codex caught it.

### Task 4

- Nothing was rejected. Codex had no findings. The implementing agent removed three validation rules in turn to show that the tests fail when the behaviour is gone, which is the check I now ask every task for.

### Task 5

- **Tests that would not have caught a regression.** The API client itself had no bugs, but Codex found three places where its tests proved less than they claimed: timeouts and aborts were only tested while the request was pending, not while the body was being read; the success test would have passed if the parser's result were thrown away; and the two error checks were never tried against a look-alike object. The implementing agent then showed the gaps were real: the original suite let four deliberate breakages through.

### Task 6

- Nothing was rejected. Codex had no findings. The implementing agent raised a risk in a later task on its own: a poll already in flight that comes back after a requote would be taken for a new quote. The plan already cancels that poll first, and the warning now travels with Task 8.

### Task 7

- **A rule with a hole the implementer found.** The design said a quote that expires "straight after" a status with money is a dead end. The implementing agent built it as written, then pointed out what that lets through: money, then a status the page does not know, then expiry, gives the plain expired screen with its new-quote button. An unknown status says nothing about the money, so the rule now skips it when looking back. This tightens a rule I had approved, on the safer side.
- **Two sentences of mine that disagreed.** The implementer also noticed that one line of the design doc said a new quote is offered "only when the page has seen no money", while another said only the current quote's history counts. The code follows the second. The first is reworded.
- **A list nobody tested in full.** Codex found that the expired tests did not cover every status that carries money, so dropping `paid` from that list would have gone unnoticed. Each one now has a case.

### Task 8

This is the task ADR 0002 depended on, and the place where the agents were wrong most often.

- **The bet held.** The no-overlap test held one request open and fired seven triggers at it. All seven joined that request; the most ever in flight was one. The fallback in ADR 0002, a hand-written loop, was not needed.
- **An ADR that stated a library's behaviour from memory.** When the planning agent drafted ADR 0002 it wrote that the library's interval is fixed-rate, and I let it stand. The implementing agent's tests showed the library restarts its timer after every answer, which is fixed-delay. It reported that the ADR was wrong and did not edit it, because the file was outside its task. The ADR is corrected, and says it was corrected.
- **Polling that did not quite stop.** After a final status the timer stopped, but returning to the tab, reconnecting, or pressing "Try now" each still sent one request. The plan's own settings caused it. The implementing agent flagged it and Codex rated it a blocker. Nothing is sent now once a payment is final or the server does not know it.
- **A race the plan only half closed.** The plan cancelled a poll already in flight before a requote. A poll that starts during the requote could still write the old quote over the new one. The mock cannot produce this, so no test would have shown it; the implementing agent built a probe that did. The requote now cancels again before it writes.
- **A count that outlived its payment.** The number of consecutive failed polls carried over from one payment to the next.
- **A helper in the plan that could not work.** The plan's test helper sent a tab-visibility event that the library never receives, because it listens on the window and the event did not bubble. The implementing agent found it and fixed the helper.

### Task 9

- **A double-click guard with a gap.** The plan said to release the guard when the write finishes. The implementing agent built that, then reported what it leaves open: the write finishes a moment before React re-renders, and a click in that moment runs the old button handler, which still sees no payment and creates a second one. It could not reproduce it and said so. Codex rated it a blocker. The guard is now held until the result has rendered.
- **A fix with a trap in it.** The obvious way to do that is to release the guard when "submitting" turns false. The planning agent warned that a write which settles instantly never shows "submitting" as true, so the guard would stay locked for good. The release is keyed on a count of settled writes, and a test covers the instant case.
- **A hook that trusted the screens.** Reading the commit, I found that "change currency" would drop the payment for any status except expired, including one that had received money. No screen offers it there, but the hook should not depend on that. It now drops a payment only while nothing has been sent.
- **One more gap beside the first.** Codex's second look found that the effect releasing the guard also runs once when the page first mounts, so a press in that same frame could have its guard released mid-request. A person cannot reach it, because the button is disabled until two selections have been made. The fix was one word, a layout effect, and the implementing agent wrote a test that sends two creates without it and one with it.

### Task 10

- **A formatter that could round money.** The picker shows fees through the browser's currency formatter, which rounds to the currency's usual two decimals. None of the brief's fees has more than two, so every test passed and the screen looked right. Codex pointed out that a fee of 0.001 would show as $0.00. The formatter now keeps every decimal place the string has. The implementing agent called it its own mistake; the plan had not asked for it either.
- **TypeScript did not accept what the browser does.** The design said amounts go to the number formatter as strings, and listed "TypeScript's typings accept this" as unverified. They do not. The plan had prescribed a cast of the formatter's signature only, never of the amount, and that is what the code uses.

### Task 11

- **A dialog that was not a dialog.** The test environment has no modal dialog, so the implementing agent opened the "have you already sent a payment?" dialog a simpler way, and said plainly what that cost: in a real browser the page behind stays clickable and focus is not held. Codex rated it major. It now uses the browser's modal where there is one. The implementing agent then checked in a real browser that clicks behind it reach nothing.
- **A QR code with no margin.** The code had under half the blank border the QR standard asks for, and a test that pinned exactly that. The implementing agent flagged the border itself. It now has the full four modules.
- **A bar I had drawn that the data cannot fill.** The agreed pay screen shows a progress bar under the countdown. Writing the task, the planning agent noticed the API gives a quote's deadline but not its lifetime, so there is nothing to draw a proportion from. The bar is gone and the time stays.
- **A browser check in the wrong harness.** The implementing agent had tested the new modal dialog in a real browser, but through a throwaway page that did not use React's Strict Mode. The app does. In development Strict Mode runs every effect twice, so the second attempt to open an already open dialog throws, and in `npm run dev` pressing "Change currency or network" would have broken the page. Codex found it by reading the hook. The fix has a test that renders the dialog in Strict Mode, and the next task pressed the real button in the real app.

### Task 12

- **The page runs end to end.** After this task I started the app from a clean dependency cache and looked at it myself: no console errors, and the pay screen, underpaid, overpaid and expired screens match the agreed drawings, at desktop width and inside real 390 and 320 pixel frames. The eighteen-place ETH amount wraps inside the card.
- **Two tests that proved nothing, found by their author.** Checking its own tests by breaking the code, the implementing agent found two that passed for the wrong reason: one "mutation" was a syntax error, so the test failed without testing anything, and a test that the check at zero fires once per quote reused one mock across quotes. It reported both and fixed them.
- **A diagnosis from the planning agent that was wrong.** When the dialog closed, keyboard focus went to the page body instead of back to the link. The planning agent told the implementer the likely cause and the fix, a layout effect. The implementing agent tried it, measured in a real browser that focus still landed on the body, said so, and fixed it another way: the hook remembers what had focus and returns it. It did not ship the suggested fix just because it was suggested.
- **Nothing rejected from Codex but one point.** Codex's only finding was that an empty transaction hash shows no Transaction row. I kept that: an empty hash has nothing to show or copy.

### Task 13, before it was built

- **A feature cut on the way in.** The dev panel was drawn with a live readout of the mock's status and time left, refreshed every two seconds. The planning agent pointed out that this needed a polling hook, a request helper and their tests, about a third of the task, to show what the checkout page beside it already shows. I cut it. The panel sends commands and reads the mock's settings once when it opens.

### Task 13

- **An older answer could replace a newer one.** The panel reads the mock's settings when it opens and again after each change. Codex pointed out that the answers can arrive out of order, so the panel could mark a setting the mock no longer had. It now keeps only the answer to the newest request.
- **Failures nobody handled.** A panel command that failed was an unhandled promise rejection. It is handled now. The panel still shows nothing when a command fails, and I kept that: the checkout page beside it already reports a payment the server does not know.
- **A defect in the page, found by using the panel.** The implementing agent drove the real app through the panel and reloaded during an outage. The card said "Loading your payment…" and nothing else: no notice and no "Try now". That card was the previous task's work, and every test had passed. It now shows the same connection notice as every other screen.
- **A reviewer's finding that did not hold.** Codex's second look said one test could not fail, because the test framework's mock function attaches its own handler to a rejected promise. The implementing agent had found that exact trap in another test earlier, so the claim was plausible. This time it was wrong. The implementing agent removed the code under test and the run failed. The planning agent repeated the check and got the same result. The test stayed as it was.

### The review of the whole branch

After the last task, Codex read the whole branch against the brief and reported six findings. The planning agent checked each against the code before anything changed.

- **Nothing checked that an answer was about what was asked.** Every response was validated for its shape and its amounts, and none for identity. An answer carrying another payment's reference, or a quote for a pair the shopper did not pick, would have gone on screen with its address. For two networks that share an address format, USDC on Ethereum and on Polygon, that can lose the payment. Thirteen per-task reviews had not raised it, and neither had the planning agent or any implementing agent. Codex rated it a blocker. The API layer now rejects an answer with a different reference, order or pair, and the pay screen needs the quote's currency and network to be in the currency list under the same network name. One limit stays, and the design doc states it: a poll cannot be compared with the shopper's choice, because the page keeps no record of that choice across a reload.
- **A countdown that read 0:00 too early.** The time was rounded down, so for the last second the page showed 0:00 beside an address that was still up. It rounds up now.
- **A helper that was tested and not used.** The function that computes the time left had its own test, while the screen logic repeated the subtraction. The test could pass with the real calculation broken. The screen logic uses the helper now.
- **The design doc was wrong about the currency list, and so was the planning agent.** The doc said the list is tried three times and then waits for "Try again". During Task 13 the planning agent also wrote in its notes that the list is not fetched again by itself after an outage. Codex pointed out that the library asks again when the tab regains focus or the connection returns. This time the planning agent read the library's source instead of answering from memory, and Codex was right. I kept the behaviour, because a read that heals itself is what I want, and corrected the doc. Two tests pin it.
- **One finding I rejected.** Codex wanted the expired screen to offer one action in place of a button and a link. I kept both. "Get a new quote" is the main action, and the link is the only way to correct a wrong network.
- **Three small points closed.** The three minor points deferred from Task 10 went back to Codex, which agreed none needs a change.

## 12 Nov 2026: my own pass over the finished screens

Looking at the finished page, I removed three pieces of copy the agent had written and corrected the picker's menus. All three lines were in the drawings I had approved; they read differently on the real page. None of this went to Codex.

- **A footer I did not want.** The picker ended with "No clock is running yet. The rate is fixed only when you continue." It was one more thing to read before the one choice that matters. Removed.
- **A hint that confused more than it helped.** A live quote said "Sending from an exchange? Make sure 163.69 USDT arrives after its withdrawal fee." The agent proposed it during design as a guard against the commonest cause of underpayment, and I accepted it then. On the real screen, under "Send exactly 163.69 USDT", it reads like a second instruction about the amount. Removed.
- **A row that explained an absence.** The expired screen listed "Address: Hidden, so nothing more is sent to it". The address is simply not there now.
- **A menu that cut off its own label.** After a network was chosen, the closed menu showed the whole option text, name, fee and time, and the browser cut it off. The chosen option now shows the name alone, and the fee and time stay on the line under the menus. The menus' arrow also sat against the border; both menus now draw their own, with room around it.
- **A side effect the implementing agent flagged.** With the hint gone, the "Change currency or network" link sat alone at the left of the strip, while in every other state it is on the right. The implementing agent reported this and did not decide it. The planning agent kept the link on the right, as drawn, so it does not jump when a notice appears.

## 12 Nov 2026: the walk-through

The plan's last task is a list of twenty checks to walk before submitting. The planning agent wrote a throwaway script that drives the real page in headless Chrome through all twenty, plus three it added, and read what each screen showed. The script is not in the repo.

- **Every item behaved as designed.** Each status, each sequence in the README, the three clock cases, both server faults, a slow create, the offline switch, reloads, the ETH amount in the clipboard with all eighteen places and no unit, and 380 pixels wide with nothing overflowing. After `paid` the page sent no request in twelve seconds.
- **One real defect: a console error.** Creating a payment with the server clock five minutes behind logged a library error. The shopper saw the right screen. The cause was the order in which React runs effects: the pay screen's check at zero ran before the polling hook had moved to the new payment, so the check went to the placeholder query that exists before any payment does. Each hook had been tested with the other mocked, so no test saw it, and neither had Codex. The page now skips the check when the server has already answered since the deadline, which is also the rule the screen logic uses. Codex reviewed the fix and found nothing.
- **A claim in my README that was wrong.** I had written that restarting the dev server returns the page to the picker with "We couldn't find that payment". It does return to the picker, but the dev server's own page reload usually clears the notice a moment later. The README now suggests opening an unknown reference, which always shows it.
- **"Time's up, checking" is too quick to read.** Against a local mock the check at zero is answered in milliseconds. With a three-second delay set in the panel it stays for three seconds, with the address hidden. The README says so.
- **Two false alarms from the script itself.** It waited for a countdown by looking for digits and a colon, which matched "8:00 PM" in "Expired at". And it froze the page to imitate a hidden tab, after which headless Chrome kept reporting the tab as hidden, which pauses polling; three later items looked broken until the freeze was moved to the end. For a few minutes the planning agent's notes listed those three as inconclusive. Neither was the page's fault.
- **What the script does not do.** It reads text and measures boxes. It does not judge how a screen looks, and its hidden-tab check freezes the page for 25 seconds, not a real tab hidden for two minutes. The changes in the section above came from my own look at the screens, not from the script.

## 12 Nov 2026: where I changed my own mind about the first screen

- **The header came back.** During design I refused an order endpoint in the mock, and the picker showed only the order reference for the whole build. Looking at the finished page, I wanted the same header on the picker as on the payment screens. The page already assumed it is handed an order id. I decided it can assume the rest of the order summary arrives with it, from the merchant's checkout or a call made before this page, and keep that object for display only. The planning agent pointed out what this costs: the amount on the first screen is not confirmed by the server until a payment exists, and one of my README answers had to be rewritten to stay true. Both are now stated in the documents. No endpoint was invented.
- **A field the header ignored.** The API's merchant has a `logo_url`. The header showed the first letter of the name whether or not a logo existed. It now shows the logo when there is one and falls back to the letter when there is none or it fails to load. The brief's merchant has no logo, so the running page still shows the letter.
- **A reason the planning agent overstated.** It told the implementing agent the logo image must send no referrer because the page's URL carries the payment reference. The implementing agent pointed out that browsers already send only the origin to another host, not the full URL. The attribute stays, because it withholds the origin as well, but the commit message repeats the overstated reason, and history is not rewritten.
- **The new header showed the wrong order in one place.** Codex reviewed the task and found that the picker reopened from an expired payment showed the assumed summary, not that payment's own merchant and amount. The test fixtures carried the same values as the assumed object, so the two could not be told apart and every test passed. The implementing agent had already reported that no test could tell them apart; it had not seen that one screen was wrong. The fix was one line, and the tests now use a payment for a different merchant, order and amount. Codex's second look found nothing more.

## 12 Nov 2026: the folder refactor

- **A bug the planning agent described without having seen it.** My brief for this refactor listed things to leave alone, among them "the previously identified historical-currency bug". The planning agent had not seen that bug described in its session, and in the plan it wrote its own guess at what the bug was. The plan now uses my words. Nothing was built on the guess.
- **A correction made the wrong way.** The planning agent fixed that wording by editing the task in the plan, in the same commit that added a note saying plan tasks are kept as they were written. Codex caught the contradiction. The task's text is back as it was planned, and the correction is a note under it.
- **A claim older than this refactor that was not quite true.** `AGENTS.md`, the design doc and the new README section all said `src/api` is the only code that talks to the server. The dev panel has its own small request helper for the mock's control endpoints, on purpose, so that the app's request code never learns the mock exists. Codex pointed out the wording. It now says "the payment API".

## 12 Nov 2026: a review of the screens' code

I gave the planning agent five proposals for simplifying the screens and asked it to review them before anything was changed. It became Task 17.

- **Branches that could never run.** Five screens took any payment and defended themselves against statuses they are never given: a waiting screen checking whether confirmations exist, a failed screen with a fallback for a missing reason. About ten such branches, none tested, because the tests only ever render a screen with its own status. Implementing agents wrote them in Tasks 11 and 12, and each task passed its review.
- **A wrong amount behind a double check.** The pay screen chose the amount on two conditions that always agree, the screen's mode and the payment's status, and fell back to the full amount when they did not. The same choice was written a second time for the screen-reader announcement. Nothing could reach the fallback, and nothing in the types said so. The amount and address are now decided in one function, on the server's status alone, and the type of each screen makes the disagreement impossible.
- **Four of my five proposals were changed, and I agreed.** The planning agent kept all five and cut four of them down. A five-field "payment instructions" object became two fields, because only the amount and the address are decisions. A "ready" state carrying the validated currency and network was dropped, because nothing would read them. Two proposals became one step, so the screen type and its test table were rewritten once. And it refused to make the test changes easier by loosening exact assertions.
- **A rule worded more broadly than it was meant.** The planning agent wrote "no `as` in production code" into the task. One `as const` was already there and stayed. Codex flagged it. I kept it: a const assertion narrows a literal and cannot claim something untrue, which is what the rule was for.
- **Nothing changed on screen.** The implementing agent rendered the payment view in 22 states before and after the typed change and compared the HTML: identical. The planning agent then drove twelve of the walk-through items in a browser.

## 12 Nov 2026: the clock

- **A clock that never stopped.** The clock hook ticked every second and sat in the hook that derives the screen, so the whole payment view re-rendered every second in every status. On `paid`, `overpaid` and `failed`, where nothing is polled, that went on for as long as the page stayed open. It had been that way since the build. No implementing agent, no review and not the planning agent noticed. I did, and asked for it to be analysed and fixed. It became Task 18.
- **Measured before it was changed.** With temporary counters in a throwaway copy, over ten seconds per status: 13 commits on `awaiting_payment`, `underpaid`, `detected` and `confirming`, of which 10 were the clock and 3 were polls; 10 on `paid`, `overpaid`, `failed` and `expired`, all of them the clock. After the change: 13 on `awaiting_payment`, 3 on the three waiting statuses, none on the final ones.
- **A stale reading the first version could inherit.** The first version kept the stopped clock's last value and used the later of it and the last answer's time. Codex found the hole: if the device clock is set back while the clock is stopped, the old value is the later one, so a new quote would hide its address for up to a second and spend its one check at zero early. A stopped clock now has no value. The implementing agent wrote the test for it first and it failed the way Codex said.
- **A test that proved less than its name.** That test then advanced the whole fifteen minutes and expected one check, which a check fired early would also have passed. Codex pointed it out. It now stops a second before the deadline, expects no check, then crosses it.
- **A wrong claim in a report.** The implementing agent reported that getting a new quote unmounts the payment view, so the stale case could not arise there. It does not unmount it: "Get a new quote" on the expired screen keeps the view. The planning agent caught it reading the report, and the implementing agent corrected the report.
- **Two tests that cannot fail against the old code.** The implementing agent said so itself: a clock that always ran passes "the clock runs on a live quote" and "a still valid screen hides the address after ten seconds". It proved the second with a deliberately broken version instead, which it did not commit.

## 12 Nov 2026: the design doc against the code

I asked that the design doc and the code have no differences. Codex compared them claim by claim, about 520 claims, and the planning agent checked the quoted strings itself. About 50 did not match. In every case the code was the intended behaviour and the document was loose or out of date.

- **Messages quoted from memory.** The document said "Time's up, checking", "quote still valid" and "can't confirm". The page says "Time's up. Checking with the payment service.", "This quote is still valid. Your device clock looks wrong, so the timer is hidden." and "We can't confirm this quote is still live. Don't send until this page reconnects."
- **A fifth input the document never mentioned.** It said the screen is derived from four inputs. The check of a payment against the currency list has been a fifth since the build, and the diagram drawn from the document repeated the four.
- **A rule that held for two requests out of three.** "A 4xx is an answer and is not retried" is true of the currency list and of the two writes. The payment poll stops only on a 404 and asks again after anything else.
- **Things said too simply.** That `failed` uses the same cautious sentence as `expired` (it has its own). That the mock is in every build (it exists only inside Vite's servers). That the dev panel pushes the card aside (only from 900 px wide). That the backoff doubles on `expired` (it holds at 15 s until the doubling passes it).
- **One sentence of the page's own that assumes something.** The underpaid screen says "Same address as before". The page shows the address the `underpaid` answer carries and does not check that it is the quote's. The brief's example repeats it. The assumption is now written down; the wording on the page is unchanged.
- **Left for me to decide.** ADR 0002 has the same "doubling up to 30 s" sentence. The planning agent did not edit an ADR without asking.
- **A second pass found nineteen more.** After the corrections Codex audited again, this time the diagrams, `AGENTS.md`, the README and the ADRs as well: 789 claims, 19 still wrong. None was in the design doc's sections on the state model, the countdown, decimals or failure states. They were smaller: a rule in `AGENTS.md` that said every answer is checked for reference, order and pair when each request checks what it can; "for display" said of an order summary whose order id is sent; a diagram arrow from "still valid" straight to "can't confirm" when ten silent seconds lead back to "checking"; and two ADRs quoting messages from memory. All corrected.
- **Two ADRs touched for wording, one for a rule.** I told the planning agent to make ADR 0002's backoff sentence exact. It then made the same kind of correction, a quoted message, in ADR 0001 and ADR 0005 without asking a second time, and told me. No decision in any ADR changed.

## 12 Nov 2026: one more line removed

- **A line under the failed screen.** The failed screen ended with "This page can't fix this payment." in the strip under the card. It was in the drawing I approved. I asked for it to go.
- **An empty strip that nearly stayed.** Every status screen passed some text to that strip, so the shared card always drew it. With the text gone it would have drawn an empty bordered row. The planning agent named that in the task, and the card now draws a strip only when it has a notice, a line or a link to put in it. A connection notice still appears on the failed screen.
- **A reason I did not give.** The implementing agent wrote into the commit message that the line "added nothing" because the screen already says what to do. I had given no reason. It said so in its own report, and history is not rewritten.

## 13 Nov 2026: how the page looks

I asked for a review of the rendered page before any visual change. The planning agent drove 17 screens in a browser at 1200, 768, 390 and 320 px and measured them. The work that followed is Tasks 19 to 27.

- **Text cut off at the card's edge.** At 320 px, with a long unbreakable word in the merchant or network name, 26 elements ran past the card and were clipped, among them the end of the amount, the first line of the address and the countdown. No test could see it: the tests have no layout. Task 19 fixed it.
- **A currency code split in two.** "167.275546 USDC" broke as "USD" / "C" at 390 and 768 px, because the amount was allowed to break anywhere. The digits and the unit are now separate pieces and the unit never breaks.
- **A bar I had dropped and now asked for.** The README lists "a progress bar under the countdown" among the things I dropped. Asked whether the countdown should look different in its last minute, I said no, and asked for a bar under it instead. The planning agent pointed out that the API gives a deadline and no lifetime, so after a reload there is no honest full bar. The bar will be drawn only when the page saw the quote begin. That is Task 24, not built yet.
- **An answer read one way.** The planning agent asked whether the waiting screen should get a continuous indicator. I answered "You mean the progress bar countdown? Let's add it". It took that as being about the countdown bar and planned no indicator for the waiting screen. That reading is the planning agent's, not something I said.
- **A screen the review never looked at.** The planning agent's script set `underpaid` one second after clearing a fault, while polling was still backed off, and took the picture before the status arrived. So the "underpaid" pictures in the review were the ordinary pay screen with a connection notice, and nobody noticed, the planning agent included, until it read the same picture again after Task 19. The script now waits for the notice to go and for "Part of your payment arrived". The real underpaid screen was then captured at all four widths with nothing clipped.
- **Task 19 was committed without being opened in a browser.** The implementing agent said so in its report. The planning agent ran the measurements: nothing clipped and no split unit on any of the 17 screens at the four widths, and none with long names at 320 px.
- **Three places Task 19 missed.** Codex found that a very long fiat amount could not shrink in the header, and that one long unbreakable network word could still overflow the Continue button and the "Usually about" line. The implementing agent had flagged the third itself, and a fourth, the copy button's label. The planning agent added those inputs to its check first: on Task 19's commit, two elements were clipped on the pay screen at 320 px. After the fix commit, none.

## 13 Nov 2026: three tasks at once

I asked whether the remaining tasks could run in parallel. The planning agent split them into lanes that touch different files, each in its own checkout and branch: the dev panel's Start over (Task 28), the shared components and scales (Task 21), and the countdown bar (Task 24). Each lane was checked in a browser and reviewed by Codex on its own, then merged with a merge commit. Neither merge had a conflict.

- **A panel that could not be opened with a mouse.** Task 28 keeps the dev panel's tab and its content both in the page so one can fade while the other slides. The tab was placed with `inset-y-0`, which Tailwind writes as a logical property, and the tab's text runs vertically, so the offsets went to its left and right and its top was left alone. In a browser the tab sat below the bottom of the window and the 34 px strip showed a sliver of the panel's content. The tests could not see it, because they have no layout. Codex reviewed the commit and found nothing. The planning agent's own browser script passed 29 checks on it: it pressed the tab from script, which works on a control that is drawn off screen, and it checked that the tab could be reached, not where it was drawn. It was caught only when the planning agent put several merged screenshots side by side and saw letters where the tab should be. The script now presses with a real mouse and checks what is drawn at the middle of the strip. On the broken commit 5 of its 36 checks fail. After the fix all 36 pass.
- **A section built in one place and reported in another.** The drawing I approved puts Start over directly under the current payment. The implementing agent built it under Set status, and its report said it was "between Current payment and Set status". The planning agent read the code, not the report, and had it moved.
- **A sentence two lanes both had to change.** The design doc's count of how the build differs from the drawings is changed by the countdown bar and by the dev panel. The planning agent told the bar's lane to leave it alone, so for two commits that sentence still said the pay screen has no bar. It is corrected in the commit that adds this entry.
- **Something the panel needed that I had not asked for.** Both Start over buttons reload the page, and a reload closed the panel. The planning agent added to the task that the panel remembers being open for the life of the tab, and told me so before it was built.
- **A correction to the entry above.** It says the planning agent told me about the remembered panel before it was built. It told me in the same message that said the task was already being built.

## 13 Nov 2026: the second set of lanes

Four more tasks ran side by side in three checkouts: the copy button, strip and keyboard focus (Task 22), the card's height and the entrance (Tasks 23 and 26), and the emphasis on a partial payment's new amount (Task 25). All three merged without a conflict, because the planning agent told each lane which part of the shared stylesheet it could add to.

- **"Copied" beside an amount that was not copied.** Since the build, the copy hook kept its "Copied" for two seconds without knowing which value it was for. If the server reported a partial payment inside those two seconds, the amount beside the button changed and the button still said "Copied", while the clipboard held the old, larger amount. A copy still in flight when the amount changed could say "Copied" beside the new one. The implementing agent for Task 25 mentioned it in passing as "older than this task". Codex, reviewing Task 22, called it a blocker. It was right. The feedback now belongs to the value it was for, and the tests for both cases were written first and failed.
- **A reason given to an implementer that was wrong.** The planning agent told the entrance's implementer that several kinds of screen share one component, and to add a key so that a change of kind makes new nodes. Every kind already has its own component. The implementing agent found that the new tests passed before it changed anything, said so, and kept the key as a guard. The planning agent had not checked.
- **A measurement done before and after.** Before the copy button was touched: 144 px wide at rest, 102 showing "Copied", 318 showing the failure sentence, and a connection notice made the card 49 px taller. After: 144 in all three, and 22 px.
- **A check written before the code.** The planning agent wrote the browser checks for this set while the lanes were being built and ran them on the branch as it was: 11 of 25 passed, and every check for something not yet built failed. One of its own probes was wrong the first time, taking the page's grey background for the wash. On the merged branch all 25 pass.

## 13 Nov 2026: the small motions, and the documents

Task 27 ran alone, last, on top of everything else.

- **Two more things the planning agent told an implementer that were not so.** It wrote that the change dialog is always in the document and only its `open` attribute changes. The dialog is rendered only while it is open. It also wrote that the connection notice's elements mount when the connection goes bad. On the status screens they did not: the notice took over the element of the strip's own text, so it would never have faded in, and going from "offline" to "can't reach" would have replayed the fade. The implementing agent found both by reading the code, fixed the second with a test that failed first, and said so.
- **A measurement that measured the wrong thing.** The planning agent's browser check for the dialog reported no fade. The check looked for the dialog before opening it, failed, and was silently run again by a helper that retries on any error, by which time the dialog was already open. The fade was fine: 0 to full in about 130 ms, from 98% of its size. The helper now retries only when the page is navigating, and the same change exposed a second check that had been passing by retry.
- **The same pair of numbers in five files.** The planning agent had told the implementer not to add another fade utility, so the two smaller forms of the entrance were written out with their numbers at every place they are used. That is what the earlier tasks had just removed for colours and sizes. They are now two named utilities beside the entrance, in a commit of their own.
- **The documents were updated by the planning agent after the code, not in each task's commit.** `AGENTS.md` asks for the document change in the same commit. For the dev panel and the countdown bar that was done. For the look and the motion, the design doc's new section, the rules in `AGENTS.md` and the README's notes were written once, after Task 27, because they describe the nine tasks together. Between the first of those commits and this one the design doc said nothing about any of it, and since the commits that changed them it had still listed the copy button's old behaviour and left out the mock's restart endpoint.
- **The whole branch, reviewed once more.** Codex read Tasks 19 to 28 together and found two small things no single commit showed. With two copies in flight at once, the older could settle last and replace the newer one's result. And the wash on a partial payment and the dev panel's slide each handled reduced motion themselves, because they were written in lanes that ran before the one rule for it existed, which by then `AGENTS.md` said not to do. Both are fixed, the first with tests that failed first.
- **The documents, audited against the code.** Codex then checked the updated documents claim by claim and found eighteen sentences that were not exact, most of them written by the planning agent an hour earlier. One could mislead: the design doc said the mock never expires a payment that has received money, and the new restart puts such a payment back where it can expire. The rest were loose: "link" for what is a button, "every screen" for pieces only some screens use, "nothing fades out" when a tint and the dev panel's tab do, and "amounts are never animated" when they fade in with their screen. They are corrected in the same commit as this entry.

## 13 Nov 2026: the picker, the chain colours and the copy button, decided

I looked at the drawings and chose. The choices are written at the top of Tasks 29 to 34 in the plan. Nothing in those tasks is built yet.

- **Two recommendations I did not take.** The planning agent recommended keeping both groups of radio buttons open, with no collapsing, because with three currencies collapsing saves little height and adds a click and focus handling. I chose collapsing sections on every width. It recommended a black Continue button on every network, because a red "Continue with USDT on Tron" reads as a delete button. I chose the chain's colour.
- **A colour that cannot carry white text.** I gave four colours. White 15 px text on Ethereum's blue is 3.69:1, under the 4.5:1 it needs; the other three pass. The planning agent planned a blue 11% darker for the Continue button on Ethereum only and my colour everywhere else. I have not answered yet.
- **A rule a few hours old that this breaks.** The planning agent wrote "Nothing is animated out" into `AGENTS.md` earlier today. A picker section that closes with an animation is animated out. The rule is reworded in Task 30 to say what it was for: nothing the server takes away is animated out.
- **Something I had fixed and then changed.** Task 22 made the copy button keep one width, because it used to jump from 144 to 102 px and move what was beside it. I then asked for it to narrow to "Copied" and widen back as a movement. The planning agent kept the part of Task 22 that mattered: the space the button takes in its row stays fixed, so nothing around it moves. It also named the cost: a label inside the button can no longer wrap, so a very long network name is cut with an ellipsis there.
- **A request read one way.** I asked to "align copy button with the address and the amount instead of the current one". The planning agent read that as: each button on the same row as the value it copies, at the right end, and under the value where there is no room. It drew that for me to confirm.
- **A cost I was told about.** With names only in the network options, comparing two networks' fees takes a click on each. The planning agent would keep the fee as small text in each option. My decision stands unless I say otherwise.
- **Four questions still open,** listed in the plan with the planning agent's default for each: the pay screen's banner and QR frame, the two sentences from the removed column, Ethereum's blue under white text, and the colour of a chosen currency.

## 13 Nov 2026: the five questions, answered

- **What I answered.** The pay screen's banner and QR frame are filled with the chain's colour, which is what I asked for at the start and not the planning agent's default. Of the two sentences from the picker's right-hand column only the wallet sentence stays, under the button. The darker blue for a filled control on Ethereum is accepted. A chosen currency is black. The copy buttons go under the value on every width.
- **A cost I did not accept.** The planning agent had planned network options with names only, as I first asked, and told me that comparing fees would then take a click on each network. I changed it: each option shows its fee and time, and they move under the section once a network is chosen.
- **A colour I swapped, and what the swap needed.** The purple I first gave for Solana was close to Polygon's, so I gave its green, `#14F195`. White text on that green is 1.50:1 and a border in it on white is 1.50:1. The planning agent did not ask me again: text on a Solana fill is black, and Solana's border and radio use a darker green. It wrote the figures into the plan.
- **"Aligned" meant something simpler.** The planning agent had read my request as the button at the right end of the value's row and drew that. I chose the phone's layout everywhere: the button under the value.
- **A jump I asked to be a movement.** The picker's card is narrower than the payment's. The planning agent listed the jump between them as a cost. I asked for the width to be animated. It planned one element that stays mounted and owns the width, because a card that is replaced cannot animate from the old card's width.
- **How it is built.** On a branch of its own, merged only after I have tested it.
- **The plan, briefly doubled.** The script the planning agent used to write my answers into the plan looked for the heading "Rules for every task below" and found the one in Tasks 19 to 27, not the one in Tasks 29 to 34. The commit before this entry therefore repeats about 220 lines of the plan and still carries the list of open questions. The planning agent saw it in the line numbers of its own next command. This commit removes the repeat; everything before Tasks 29 to 34 is again identical to the plan as it was.

## 13 Nov 2026: building the picker, the colours and the copy buttons

Task 29 went first. Then three lanes ran side by side: the picker (Task 30), the change buttons and the pay screen's colours (Tasks 31 and 32), and the copy buttons (Tasks 34 and 33). All three merged without a conflict.

- **A copy button the planning agent designed wrong.** To make the button narrow to "Copied" without measuring anything, the planning agent told the implementer to size it from unseen copies of the two labels that cannot wrap. It also told me that every real network's name would fit at 320 px. It had not measured. In a browser, "Copy Ethereum address" was cut with an ellipsis at 320 px, where the address box is 182 px wide and the label needs 215, and both copy buttons on the paid screen were cut at 390 and 320 px. A button that does not say what it copies breaks a rule in `AGENTS.md`. The implementing agent had warned that the status screens would be affected. The design was replaced: an invisible twin of the button holds its width and height, labels wrap as they did, and the real button's width moves inside that space.
- **The replacement pushed the page for a moment.** While the button widened back, its label wrapped inside the still-narrow button, the button grew from 41.6 to 61.2 px tall, and everything under it moved down 19.6 px and back. The implementing agent predicted it; the planning agent measured it and had the button take its height from the twin. After that, nothing under the button moves.
- **A currency with no networks.** The server's schema allows one. Choosing it closed the Currency section and left keyboard focus on a radio button that had just become inert. The implementing agent listed it as untested, and Codex called it major. Focus now goes to that section's "Change" button, with a test that failed first.
- **A finding the planning agent did not take.** Codex said the white letter on Ethereum's chip is 3.69:1. The chip is decoration, the network's name is always in words beside it, it is as it was before, and I had asked for `#627EEA` there.
- **A test that would have let a wrong colour through.** Codex pointed out that the test for the colour function would pass a misspelt class, which Tailwind drops without an error. The first version of a better test read the stylesheet with Node's file functions and, to compile, let Node's globals typecheck across the browser code. The implementing agent said so. It now reads the stylesheet through Vite, with one line of test configuration, and its own guard caught the first attempt reading an empty file.
- **Scripts that had to learn the new picker.** The planning agent's browser checks drove two menus. They now choose radio buttons, and two of them broke on the way: one waited for a network that was already chosen, one looked for the card by a class it no longer has.
- **The documents came after the code again.** The three lanes would have edited the same sentences of the design doc, so the planning agent wrote the document changes once, in the commit that adds this entry, on the branch I test before anything is merged.
- **One thing left as it is.** At 320 px, on a status screen, a copy button's label can break inside a word: "Copy transactio" and "n hash". The label is whole and the button works. It was "Copy / transaction / hash" before; the row is a few pixels narrower for the button now.
- **A correction to the last entry above.** It says a copy button's label on a status screen broke between words before this work, and that the row is now a few pixels narrower. The planning agent had not measured either. Measured on `main` and on this branch at 320 px, the button is 125 px wide on both and the label reads "Copy transactio" and "n hash" on both. The break inside the word came with the larger button of Task 21, not with this branch.
- **The branch, reviewed whole, and its documents audited.** Codex read Tasks 29 to 34 together and found no fault in behaviour, only names that had not followed a change: the outlined change button was still called a link in a prop, three test titles and a comment, and two types were exported that nothing imports. It then checked the documents against the code and found six sentences that were not exact. Two could mislead: the design doc still said the card keeps two columns throughout, when the picker is now one; and `AGENTS.md` said never to animate a tick of the countdown, when the bar under it has moved between ticks since Task 27. That second sentence was written by the planning agent after Task 27 was built. One of the six was older than this branch: the design doc said the payment reference lives in the URL, when it lives in React state read from the URL and written back to it.

## 13 Nov 2026: testing the picker branch

- **A fee shown twice.** With the Network section opened again by "Change", the fee line stayed under it while every option above showed its own fee and time. I saw it while testing and asked for the line to show only while the section is closed. The task had said the line "updates in place when the network changes", and that is what kept it there.

# Cypher Enterprise Ledger 2.4.0 — Monthly planning update

## IMPORTANT: this is an UPDATE for an existing v2.3.1 installation
This ZIP deliberately preserves your existing app, templates, artwork and fonts. It is not a stand-alone installation. It contains a replacement module.json plus new planner scripts, CSS, tests and this guide. Do not delete the existing module folder.

1. Back up the ledger and the complete existing module folder.
2. Stop Foundry.
3. Extract the update over Data/modules so the unversioned cypher-enterprise-ledger folder MERGES with the existing v2.3.1 folder. Replace module.json when prompted.
4. Restart Foundry and hard-reload the client. Open Monthly Tasks. All five existing themes remain in place.
5. Use a disposable world for the first test. Foundry minimum 14 is retained; the verified field is inherited, not new runtime certification.

Optional: build-complete.py can merge this update with your local v2.3.1 module folder and create a complete installation ZIP, including your original theme images/fonts. Run `python build-complete.py PATH_TO_EXISTING_MODULE_FOLDER` from the update folder. It does not modify the source folder. No downloads occur.

## Included
33 monthly task choices: the original 11 plus 22 new tasks and follow-ups. Each has time, funding, target, resolution and consequences. Assignments use the PC duty-board Actor UUIDs. Add PCs to PC Duty first.

## Delegation and authority
A player may propose a task for another PC; proposals reserve nothing. Only that PC's owner may accept or decline. The GM can use explicitly labelled overrides. Branch-task proposals require the branch owner or GM. New requests use chat-document authorship rather than trusting a client-supplied user ID. GM processing is queued, checks the state revision/month, and rejects stale or duplicate requests. Legacy monthly task execution is disabled while the new planner is installed so it cannot bypass per-PC time commitments.

## Time
Default: 20 business days per PC/month. Each active weekly duty consumes 5 days from the same budget. Both are configurable in Module Settings. Rush uses half the normal days (rounded up), −2 preparation; thorough uses 1.5x days, +2 preparation. Accepted tasks reserve time; resolved tasks consume it even on failure. Pending proposals reserve no time. Decline/cancel releases unspent reservations. Complete, decline or cancel open assignments before closing the month. Multi-month partial task-progress scheduling is not implemented in this release; prototype/client/hiring opportunities and modifiers can carry into the following month.

## Costs: selectable combination
Company coins are populated by default. Set any cost to zero to exclude it; combine company, personal currency, Might, Speed and Intellect as desired. A company contribution below the task's stated funding level requires GM approval of the exact alternative combination. There is NO automatic exchange rate between currencies and pools.

Personal currency and pool points are MANUAL PAYMENTS: after accepting, the PC owner adjusts the character sheet and confirms payment. The module records the receipt but never guesses or updates actor resource fields, and does not apply Edge, Effort discounts, or recovery. An explicit manual-refund acknowledgement enables cancellation after personal payment. The owner/GM is responsible for confirming real payment/refund. Costs cannot be edited in-place after acceptance: refund/cancel and propose a new assignment.

Company expenses and task income are earmarked at resolution and SETTLE ONCE AT MONTH CLOSE through the existing task-income contribution. They are not also deducted immediately. Available company funds subtract all accepted/resolved earmarks. Gross reward, company expense and net contribution are shown in each receipt and a separate month-close summary. Personal/pool expenditures are not counted as company profit. Existing base branch/GM treasury edits can still reduce the cash balance; the planner then refuses unaffordable resolutions.

## Bonuses and consequences
Preparation from time, funding and resources is capped at −3..+3. Role match and active planner modifiers are separate; final planner bonus is capped at −6..+6. Two pool points grant +1 resource preparation, at most +2 from pools. Personal commitment of at least 25 units grants +1; those units must be meaningful in your campaign (record the denomination in notes). This is a module house rule, not an automatic Cypher skill/Effort conversion. Route/threat targets use the existing live difficulty calculation.

A natural 20 is a critical; a natural 1 is a complication. Failed rushed work also causes a complication. Fatigue penalizes the next planner roll, while Rest and Reorganize can clear planner fatigue (not sheet pools). Prepared rolls have limited uses and expire after the following month. Successful prototypes, premium-client searches and recruitment unlock PC-specific follow-up tasks.

## Persistence and scope
Planning is stored inside the existing ledger state's `planning` property so normal backups/restores include assignments, time, effects, audit and receipts. Old saves receive the new property lazily. Weekly duties and monthly close use the current base handlers. The update leaves theme CSS/art/fonts untouched. It does not repair unrelated base-module socket/security or economy issues.

## Tests and limitations
Run `node tests/monthly-engine.test.mjs` for pure-engine tests. Live Foundry rendering, live chat permissions, socket interactions and multi-client timing need an in-world smoke test. The receipt/GM approval model does not automatically verify personal-sheet payments. Use the active GM for week/month closure.

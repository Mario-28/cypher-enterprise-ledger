# Monthly planner 2.4.0 validation

- Both new ES modules parse with node --check.
- 123 pure-engine assertions/scenarios pass (33 tasks tested with natural 1, ordinary result, natural 20, plus cost/reservation/acceptance/weekly/backup checks).
- Existing app, data, theme styles, graphics and fonts are not included/replaced in the update.
- This is not live Foundry certification. Live template injection, ownership/chat handling, multi-client requests, GM handoff and native dialogs must be smoke-tested in a disposable world.

Run: node tests/monthly-engine.test.mjs

Additional checks completed:
- Nine integration flows pass using stubbed Foundry APIs: chat author ownership, stale revisions, duplicate resolution, shared weekly time, once-only settlement, pending-task month-close guard, explicit GM overrides, alternative funding approval and owner payment receipts.
- Planner CSS parses without stylesheet/declaration errors.
- Offline merger tested on a synthetic base: preserves asset/font bytes, updates manifest, leaves source untouched, and produces a valid complete ZIP. This fixture is not the real module and is not shipped as a working module.
- Update ZIP CRC and single unversioned top-level directory verified.

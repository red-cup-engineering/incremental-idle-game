# Little Worlds — Incremental Idle Game

<!-- 561-group-standards:badges:start -->
[![Red Cup Engineering](https://img.shields.io/badge/561%20Group-Red%20Cup%20Engineering-c0392b)](https://github.com/red-cup-engineering)
[![License: MIT](https://img.shields.io/badge/license-MIT-c0392b)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/red-cup-engineering/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->

Red Cup Engineering's reusable **typed, declarative incremental-game engine** and a genuinely playable, zero-custody browser consumer. It builds two independent, original local-only worlds: **Trace Garden** and **Pocket Observatory**. Neither is a mining service, advertisement, money-like reward, blockchain game or public account system.

## Native developer use

Node >=24, with the declared Computer Data and pinned JSNode fabrication supplier installed:

```sh
npm run check:generated
npm test
npm run build
python3 -m http.server --directory dist 8080
```

Open `http://127.0.0.1:8080/` and click, purchase a producer, let it grow, buy upgrades, reload, try the other world, and eventually Replant for permanent sparks. Every input action has a deterministic pure transition. `/assets/discrete-clock.mjs` is a **copied build artifact from the installed Computer Data supplier**, not another leaf implementation. The publisher reads the canonical package's exact resolved file and rewrites the engine's module specifier for static ESM browser loading; it does not ship a private package registry or start a second hosting system.

## Fabricate world rules from designs

Edit `design/world-catalog.json`, whose structural contract is
`design/world-catalog.schema.json`, then run `npm run generate`. The shared
JSNode module producer validates the declared data and fabricates the immutable
ESM catalog in `src/generated/world-definitions.mjs`; the game retains semantic
admission in `defineWorld`. No source editing is needed to add another world
within that contract. The original two worlds retain their game rules and saves.

`npm run check:generated` compares without writing. The build performs that same
check before creating output, so a changed design or hand-edited generated file
cannot silently reach the browser. `dist/fabrication-receipt.json` binds the
schema, catalog, generated source, clock supplier and static artifact bytes by
SHA-256. Read `design/README.md` for the requirement-to-receiving trace and save
compatibility boundary. These are deterministic data projections; algorithm
synthesis, isolated inference assays and production activation retain their
separate contracts.

## Actual mechanics

- World rules are named typed records, not hardcoded browser conditionals; two different worlds exercise the same engine and save separately.
- Manual action gets play started immediately. Producer purchases use a geometric price ladder, with buy 1/10/max; purchases actually alter rate.
- Acquired upgrades increase manual or automatic output; later tiers unlock through **earned this run**, not current balance, so spending cannot relock things.
- Observed time is injected into pure source transitions; complete seconds accrue while the tab is closed, capped at each world's clearly disclosed offline maximum. A clock moving backwards cannot create output.
- Replanting spends accumulated run progress to award permanent sparks; production and manual actions improve afterward while per-run producers/upgrades reset.
- Invalid/incompatible saved state fails closed. A broken save is **not silently overwritten**; the player can export the raw bytes and explicitly clear it, or import an earlier saved JSON. No local browser save is authoritative value.
- Responsive, keyboard-operable, reduced-motion friendly; no external JS, CDN, client analytics, ad callbacks, social pressure, artificial playcounts or payment interfaces.

**Owners and boundaries.** Computer Data owns the generic safe-integer and discrete time quantization source. This package owns only game-specific state, progression and consumer UI. Metrologic/SignCell/SignChain/SignGraph/SignCraft are neither clocks nor pretend financial ledgers. `games-host` is the existing native HTTP game supervisor if a competent host operator later selects this static site; this package does not duplicate it.

**Receiving boundary.** `npm test` and `npm run build` exercise the source and static browser artifact. They do not prove the package version is published, a Cloudflare/Cold Red Gate host has selected these assets, or that a public user has played. No production route is declared here.

# Little Worlds — Incremental Idle Game

Red Cup Engineering's reusable **typed, declarative incremental-game engine** and a genuinely playable, zero-custody browser consumer. It builds two independent, original local-only worlds: **Trace Garden** and **Pocket Observatory**. Neither is a mining service, advertisement, money-like reward, blockchain game or public account system.

## Native developer use

Node >=22, in the 561 Group's normal workspace with Computer Data selected:

```sh
npm test
npm run build
python3 -m http.server --directory dist 8080
```

Open `http://127.0.0.1:8080/` and click, purchase a producer, let it grow, buy upgrades, reload, try the other world, and eventually Replant for permanent sparks. Every input action has a deterministic pure transition. `/assets/discrete-clock.mjs` is a **copied build artifact from the installed Computer Data supplier**, not another leaf implementation. The publisher reads the canonical package's exact resolved file and rewrites the engine's module specifier for static ESM browser loading; it does not ship a private package registry or start a second hosting system.

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

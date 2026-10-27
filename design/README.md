# World design and fabrication contract

The authored input is `world-catalog.json`, admitted by the JSON Schema in
`world-catalog.schema.json` and the engine's `defineWorld` semantic operation.
The generated output is `src/generated/world-definitions.mjs`. Change the input
and run `npm run generate`; `npm run check:generated` checks without writing.
The static build refuses stale source before creating its output.

This is deterministic fabrication of declared data into ESM. The original
JSNode module producer owns that transformation. No inference, source prompt,
new code generator service, package publication or production deployment is
part of this operation. The same producer can fabricate other schema-admitted
content catalogs without introducing a game-specific emitter.

## Requirements and receiving

| Requirement | Machine guarantee | Receiving evidence |
| --- | --- | --- |
| GAME-DESIGN-001: rules are authored as data | A closed structural schema admits the complete catalog before projection. Unknown fields, missing data and out-of-range numbers refuse. | Independent schema/refusal cases in `test/design-fabrication.test.mjs`; upstream data-module assays. |
| GAME-DESIGN-002: valid rules form a playable world | `defineWorld` checks unique producer/upgrade IDs, an initially available producer and progression invariants; catalog world IDs are unique. | A newly authored third world reaches the real progression engine without engine or UI changes. |
| GAME-DESIGN-003: preserve earned play | The original two worlds retain all IDs, prices, yields, unlocks, caps and prestige thresholds; the state format remains v1. | Original engine tests plus catalog equivalence and save/return/prestige scenarios. |
| GAME-DESIGN-004: source follows design | One captured schema/catalog snapshot deterministically projects source; `--check` refuses missing or different bytes and never rewrites them. | Fresh generation, no-change regeneration, changed design and stale source cases. |
| GAME-DESIGN-005: generation is bounded data processing | The shared producer validates strict JSON, confines output paths, emits frozen standalone ESM and preserves data without evaluating it as source. | Original producer's independent data-module tests, including hostile strings and keys. |
| GAME-DESIGN-006: a build retains its basis | The build records raw schema/catalog digests, generated-source digest and the actual static artifact digests. Its game source and supplier files are read once for the output. | Build tests import the emitted browser modules and compare receipt hashes with bytes. |

The schema covers representation. JSON Schema cannot express uniqueness by a
selected `id` property or the game's progression relationships, so those stay
with the existing semantic owner. Both admissions run before a generated file
is replaced. Write failure preserves the old generated file through a sibling
temporary file and rename. Invalid input never authorizes deleting or replacing
a player's saved state.

## Refinement and preserved source

The initial catalog was migrated from `src/worlds.mjs` at game commit
`d833f6525c55e15ab74fd992dae8bef7803a30e2`. It contains Trace Garden and Pocket
Observatory with their existing numerical rules. This work supplies a reusable
fabrication consumer; it does not replace Stoke, Flickering or You Are Conscious,
change their replay semantics, or establish a public route for Little Worlds.

The shared module producer is pinned to an immutable Git revision in this
package's development dependencies. Computer Data remains the exact declared
runtime clock supplier. Build-time dependencies are not shipped to the browser.
The browser receives only generated data and the established progression engine.

Future rule changes must assess existing saves explicitly. Keeping an ID while
changing numerical rules changes the interpretation of an existing run; this
catalog mechanism alone is not a migration or versioning policy.

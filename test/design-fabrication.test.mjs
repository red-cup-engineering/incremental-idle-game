/**
 * Independent consumer assays derived from the original d833f65 world rules
 * and the design-to-source receiving contract, before reading the new producer.
 * These are ordinary game/browser-build receiving tests, not hidden supplier
 * examples and not evidence of a public deployment or a real player's review.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cp, mkdtemp, readFile, readdir, rm, stat, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { generateWorlds } from '../scripts/generate-worlds.mjs';
import { admitRun, advance, buyProducer, newRun, prestige, project, tap } from '../src/engine.mjs';

const exec = promisify(execFile);
const ROOT = fileURLToPath(new URL('../', import.meta.url));
const CATALOG = 'design/world-catalog.json';
const SCHEMA = 'design/world-catalog.schema.json';
const GENERATED = 'src/generated/world-definitions.mjs';
const T = 1_700_000_000_000;

// Independent, frozen-before-implementation oracle: the two original worlds.
const ORIGINAL = [
  {
    kind: '561.incremental-idle-world/v1', id: 'trace-garden', label: 'Trace Garden',
    description: 'Turn single marks into a sprawling, self-writing garden of patterns. An original, nonmonetary incremental game.',
    unit: 'marks', verb: 'Make a mark', offlineCapSeconds: 21600, prestigeThreshold: 2500,
    producers: [
      { id: 'pencil', label: 'Patient pencil', baseCost: 10, ratePerSecond: 1, growthBasisPoints: 11800, unlockAt: 0 },
      { id: 'press', label: 'Printing press', baseCost: 90, ratePerSecond: 7, growthBasisPoints: 12300, unlockAt: 60 },
      { id: 'loom', label: 'Pattern loom', baseCost: 750, ratePerSecond: 42, growthBasisPoints: 12600, unlockAt: 400 },
      { id: 'archive', label: 'Living archive', baseCost: 6400, ratePerSecond: 230, growthBasisPoints: 13000, unlockAt: 2200 },
    ],
    upgrades: [
      { id: 'ink', label: 'Fresh ink · +4 per tap', cost: 35, unlockAt: 20, effect: 'tap', amount: 4 },
      { id: 'binding', label: 'Shared bindings · +50% idle output', cost: 240, unlockAt: 120, effect: 'production', amount: 50 },
      { id: 'stylus', label: 'Precision stylus · +24 per tap', cost: 1100, unlockAt: 500, effect: 'tap', amount: 24 },
      { id: 'pattern', label: 'Repeatable patterns · +100% idle output', cost: 3500, unlockAt: 1800, effect: 'production', amount: 100 },
    ],
  },
  {
    kind: '561.incremental-idle-world/v1', id: 'pocket-observatory', label: 'Pocket Observatory',
    description: 'Start with a single signal and grow a humming observatory. Your receivers keep collecting while you are away.',
    unit: 'signals', verb: 'Observe a signal', offlineCapSeconds: 10800, prestigeThreshold: 4000,
    producers: [
      { id: 'antenna', label: 'Tin-can antenna', baseCost: 8, ratePerSecond: 1, growthBasisPoints: 12200, unlockAt: 0 },
      { id: 'relay', label: 'Backyard relay', baseCost: 160, ratePerSecond: 13, growthBasisPoints: 12500, unlockAt: 90 },
      { id: 'array', label: 'Mirror array', baseCost: 1200, ratePerSecond: 65, growthBasisPoints: 12800, unlockAt: 600 },
      { id: 'satellite', label: 'Tiny satellite', baseCost: 9200, ratePerSecond: 330, growthBasisPoints: 13200, unlockAt: 3000 },
    ],
    upgrades: [
      { id: 'lens', label: 'Clean lens · +6 per tap', cost: 45, unlockAt: 25, effect: 'tap', amount: 6 },
      { id: 'gain', label: 'Signal amplifier · +75% idle output', cost: 360, unlockAt: 200, effect: 'production', amount: 75 },
      { id: 'dish', label: 'Parabolic dish · +30 per tap', cost: 1450, unlockAt: 700, effect: 'tap', amount: 30 },
      { id: 'correlator', label: 'Correlator · +120% idle output', cost: 5200, unlockAt: 2400, effect: 'production', amount: 120 },
    ],
  },
];

const readJSON = async path => JSON.parse(await readFile(path, 'utf8'));
const putJSON = (path, value) => writeFile(path, `${JSON.stringify(value, null, 2)}\n`);

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'idle-design-receiving-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const directory of ['design', 'scripts', 'src']) {
    await cp(join(ROOT, directory), join(root, directory), { recursive: true });
  }
  await cp(join(ROOT, 'package.json'), join(root, 'package.json'));
  await symlink(join(ROOT, 'node_modules'), join(root, 'node_modules'), 'dir');
  return root;
}

async function snapshot(root, prefix = '') {
  const result = {};
  for (const entry of (await readdir(join(root, prefix), { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    if (entry.name === 'node_modules') continue;
    const path = join(prefix, entry.name);
    if (entry.isDirectory()) {
      result[`${path}/`] = 'directory';
      Object.assign(result, await snapshot(root, path));
    } else if (entry.isFile()) {
      const bytes = await readFile(join(root, path));
      const info = await stat(join(root, path), { bigint: true });
      result[path] = { sha256: createHash('sha256').update(bytes).digest('hex'), mtimeNs: String(info.mtimeNs) };
    } else {
      result[path] = 'other';
    }
  }
  return result;
}

async function assertRefusesWithoutWriting(root) {
  const before = await snapshot(root);
  await assert.rejects(generateWorlds({ root }));
  assert.deepEqual(await snapshot(root), before, 'invalid source must not alter, remove, or create files');
}

async function buyFirstProducer(world) {
  const first = world.producers[0];
  let state = newRun(world, T);
  for (let n = 0; n < first.baseCost; n++) state = tap(world, state, T).state;
  const purchase = buyProducer(world, state, first.id, 1, T);
  assert.equal(purchase.accepted, true);
  assert.equal(purchase.state.banked, 0);
  assert.equal(purchase.state.producers[first.id], 1);
  return purchase.state;
}

test('authored catalog and generated runtime preserve both original worlds exactly', async () => {
  assert.deepEqual(await readJSON(join(ROOT, CATALOG)), ORIGINAL);
  const schema = await readJSON(join(ROOT, SCHEMA));
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  const { WORLD_DEFINITIONS } = await import('../src/generated/world-definitions.mjs');
  const { WORLDS, worldById } = await import('../src/worlds.mjs');
  assert.deepEqual(WORLD_DEFINITIONS, ORIGINAL);
  assert.deepEqual(WORLDS, ORIGINAL);
  for (const world of WORLDS) assert.equal(worldById(world.id), world);
});

test('generation is deterministic across roots and no-op on unchanged admitted design', async t => {
  const root = await fixture(t);
  const other = await fixture(t);
  for (const location of [root, other]) await rm(join(location, GENERATED), { force: true });
  assert.equal((await generateWorlds({ root })).changed, true);
  assert.equal((await generateWorlds({ root: other })).changed, true);
  assert.equal(await readFile(join(root, GENERATED), 'utf8'), await readFile(join(other, GENERATED), 'utf8'));
  const before = await snapshot(root);
  assert.equal((await generateWorlds({ root })).changed, false);
  assert.deepEqual(await snapshot(root), before, 'idempotent regeneration must preserve unchanged files');
  assert.equal((await generateWorlds({ root, check: true })).changed, false);
  assert.deepEqual(await snapshot(root), before, 'check mode must not write');
});

for (const [name, mutate] of [
  ['empty catalog', () => []],
  ['non-array catalog', () => ({ worlds: ORIGINAL })],
  ['duplicate world identity', worlds => { worlds[1].id = worlds[0].id; }],
  ['duplicate producer identity', worlds => { worlds[0].producers[1].id = worlds[0].producers[0].id; }],
  ['producer and upgrade identity collision', worlds => { worlds[0].upgrades[0].id = worlds[0].producers[0].id; }],
  ['negative price', worlds => { worlds[0].producers[0].baseCost = -1; }],
  ['fractional production', worlds => { worlds[0].producers[0].ratePerSecond = 0.5; }],
  ['oversized unsafe integer', worlds => { worlds[0].producers[0].baseCost = 9007199254740992; }],
  ['zero offline cap', worlds => { worlds[0].offlineCapSeconds = 0; }],
  ['excessive offline cap', worlds => { worlds[0].offlineCapSeconds = 86401; }],
  ['missing required field', worlds => { delete worlds[0].unit; }],
  ['unknown world field', worlds => { worlds[0].outputPath = '../../unowned.mjs'; }],
  ['unknown producer field', worlds => { worlds[0].producers[0].price = 1; }],
  ['unknown upgrade effect', worlds => { worlds[0].upgrades[0].effect = 'currency'; }],
  ['empty label', worlds => { worlds[0].producers[0].label = '   '; }],
  ['traversing world identity', worlds => { worlds[0].id = '../escape'; }],
  ['no unlocked starting producer', worlds => { for (const row of worlds[0].producers) row.unlockAt = 1; }],
  ['too many producers', worlds => { worlds[0].producers = Array.from({ length: 17 }, (_, n) => ({ ...worlds[0].producers[0], id: `producer-${n}` })); }],
]) {
  test(`design admission refuses ${name} before any output write`, async t => {
    const root = await fixture(t);
    const worlds = structuredClone(ORIGINAL);
    const replacement = mutate(worlds);
    await putJSON(join(root, CATALOG), replacement === undefined ? worlds : replacement);
    await assertRefusesWithoutWriting(root);
  });
}

for (const [name, path, bytes] of [
  ['malformed catalog JSON', CATALOG, '[{"id":'],
  ['malformed schema JSON', SCHEMA, '{"type":'],
  ['invalid JSON Schema vocabulary', SCHEMA, JSON.stringify({ $schema: 'https://json-schema.org/draft/2020-12/schema', type: 'not-a-json-schema-type' })],
]) {
  test(`generation refuses ${name} without replacing the last valid artifact`, async t => {
    const root = await fixture(t);
    await writeFile(join(root, path), bytes);
    await assertRefusesWithoutWriting(root);
  });
}

test('edited authored rules reach real producer income through regeneration', async t => {
  const root = await fixture(t);
  const worlds = structuredClone(ORIGINAL);
  worlds[0].producers[0].ratePerSecond = 3;
  await putJSON(join(root, CATALOG), worlds);
  assert.equal((await generateWorlds({ root })).changed, true);
  const { WORLDS } = await import(pathToFileURL(join(root, 'src/worlds.mjs')).href);
  assert.equal(WORLDS[0].producers[0].ratePerSecond, 3);
  assert.deepEqual(WORLDS[1], ORIGINAL[1]);
  const state = await buyFirstProducer(WORLDS[0]);
  assert.equal(advance(WORLDS[0], state, T + 10_000).gained, 30);
});

test('an additional admitted world becomes playable without editing runtime source', async t => {
  const root = await fixture(t);
  const worlds = structuredClone(ORIGINAL);
  worlds.push({ ...structuredClone(worlds[0]), id: 'tidal-workshop', label: 'Tidal Workshop', unit: 'patterns', verb: 'Trace a pattern' });
  await putJSON(join(root, CATALOG), worlds);
  const consumerBefore = await readFile(join(root, 'src/worlds.mjs'), 'utf8');
  await generateWorlds({ root });
  const { WORLDS, worldById } = await import(pathToFileURL(join(root, 'src/worlds.mjs')).href);
  assert.equal(WORLDS.length, 3);
  const world = worldById('tidal-workshop');
  assert.deepEqual(world, worlds[2]);
  assert.equal(advance(world, await buyFirstProducer(world), T + 20_000).gained, 20);
  assert.equal(await readFile(join(root, 'src/worlds.mjs'), 'utf8'), consumerBefore);
});

test('authored text is received as literal data through generated JavaScript', async t => {
  const root = await fixture(t);
  const worlds = structuredClone(ORIGINAL);
  const literal = "Quotes '\" and slash \\; `template ${notAnExpression}`; line\u2028separator";
  worlds[0].label = literal;
  await putJSON(join(root, CATALOG), worlds);
  await generateWorlds({ root });
  const { WORLD_DEFINITIONS } = await import(pathToFileURL(join(root, GENERATED)).href);
  assert.equal(WORLD_DEFINITIONS[0].label, literal);
});

for (const stale of ['missing', 'edited-source', 'edited-design']) {
  test(`check and CLI refuse ${stale} projection without modifying any file`, async t => {
    const root = await fixture(t);
    if (stale === 'missing') await rm(join(root, GENERATED), { force: true });
    if (stale === 'edited-source') await writeFile(join(root, GENERATED), 'export const WORLD_DEFINITIONS = [];\n');
    if (stale === 'edited-design') {
      const worlds = structuredClone(ORIGINAL);
      worlds[0].prestigeThreshold = 2501;
      await putJSON(join(root, CATALOG), worlds);
    }
    const before = await snapshot(root);
    await assert.rejects(generateWorlds({ root, check: true }));
    await assert.rejects(exec(process.execPath, ['scripts/generate-worlds.mjs', '--check'], { cwd: root, timeout: 30_000 }), error => {
      assert.equal(typeof error.code, 'number');
      assert.notEqual(error.code, 0);
      return true;
    });
    assert.deepEqual(await snapshot(root), before);
  });
}

test('a stale generated module blocks the actual static publisher before output effects', async t => {
  const root = await fixture(t);
  await writeFile(join(root, GENERATED), 'export const WORLD_DEFINITIONS = [];\n');
  const { build } = await import(pathToFileURL(join(root, 'scripts/build.mjs')).href);
  const out = join(root, 'must-not-exist');
  const before = await snapshot(root);
  await assert.rejects(build(out));
  assert.deepEqual(await snapshot(root), before, 'refused build must leave all input and output paths unchanged');
  await assert.rejects(stat(out), { code: 'ENOENT' });
});

test('regenerated game survives the real static build and browser ESM module graph', async t => {
  const root = await fixture(t);
  await generateWorlds({ root });
  const { build } = await import(pathToFileURL(join(root, 'scripts/build.mjs')).href);
  const out = join(root, 'received-site');
  await build(out);
  const { WORLDS } = await import(pathToFileURL(join(out, 'assets/worlds.mjs')).href);
  const builtEngine = await import(pathToFileURL(join(out, 'assets/engine.mjs')).href);
  assert.deepEqual(WORLDS, ORIGINAL);
  for (const world of WORLDS) {
    const outcome = builtEngine.tap(world, builtEngine.newRun(world, T), T);
    assert.equal(outcome.accepted, true);
    assert.equal(outcome.state.banked, 1);
  }
});

for (const [index, expectedSparks] of [[0, 2], [1, 1]]) {
  test(`generated ${ORIGINAL[index].id} completes purchase, capped offline return, save and prestige`, async () => {
    const { WORLDS } = await import('../src/worlds.mjs');
    const world = WORLDS[index];
    const purchaseState = await buyFirstProducer(world);
    const returned = advance(world, purchaseState, T + (world.offlineCapSeconds + 123) * 1000);
    assert.equal(returned.gained, world.offlineCapSeconds);
    assert.equal(returned.seconds, world.offlineCapSeconds);
    assert.equal(returned.discardedSeconds, 123);
    const raw = JSON.stringify(returned.state);
    const saved = admitRun(world, JSON.parse(raw));
    assert.equal(JSON.stringify(saved), raw, 'unchanged save interpretation must roundtrip exactly');
    assert.equal(advance(world, saved, saved.lastMs).gained, 0, 'return cannot pay capped history twice');
    assert.throws(() => admitRun(WORLDS[1 - index], JSON.parse(raw)), /another world/);
    const result = prestige(world, saved, saved.lastMs);
    assert.equal(result.accepted, true);
    assert.equal(result.awarded, expectedSparks);
    assert.equal(result.state.banked, 0);
    assert.equal(result.state.runProduced, 0);
    assert.equal(result.state.allTime, saved.allTime);
    assert.equal(result.state.taps, saved.taps);
    assert.deepEqual(Object.values(result.state.producers), [0, 0, 0, 0]);
    assert.deepEqual(Object.values(result.state.upgrades), [false, false, false, false]);
    assert.equal(project(world, result.state, result.state.lastMs).tapYield, 1 + expectedSparks);
  });
}

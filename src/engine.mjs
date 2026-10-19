/**
 * A finite, deterministic incremental-game rules engine. The world declares
 * its producers and upgrades; the caller supplies a clock and persistence.
 * No platform APIs, currencies, ads, wallets, provenance claims or rewards.
 */
import { boundedNatural, elapsedTicks } from '@red-cup-engineering/computer-data-engineering-services-section/simulation/discrete-clock';

export const STATE_KIND = '561.incremental-idle-state/v1';
export const WORLD_KIND = '561.incremental-idle-world/v1';
export const MAX_POINTS = 1_000_000_000_000_000;
export const MAX_LEVEL = 1000;
const MAX_PRESTIGE = 1000;
const ID = /^[a-z][a-z0-9-]{0,47}$/u;
const minText = (text, name) => {
  if (typeof text !== 'string' || !text.trim() || text.length > 160) throw new TypeError(`${name} must be meaningful short text`);
  return text.trim();
};
const bounded = (value,name,max=MAX_POINTS) => boundedNatural(value,name,max);
const pointSum = (a,b) => Math.min(MAX_POINTS, a+b);

function records(input, field, ids, check) {
  if (!Array.isArray(input) || !input.length || input.length > 16) throw new TypeError(`${field} must have 1..16 entries`);
  return Object.freeze(input.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row) || !ID.test(row.id) || ids.has(row.id)) {
      throw new TypeError(`${field} requires unique named records`);
    }
    ids.add(row.id);
    minText(row.label, `${row.id}.label`);
    check(row);
    return Object.freeze({...row});
  }));
}

/** Admit a named game world, including bounded rules and complete purchase data. */
export function defineWorld(candidate) {
  if (!candidate || candidate.kind !== WORLD_KIND || !ID.test(candidate.id)) throw new TypeError('invalid world identity');
  minText(candidate.label, 'world.label');
  minText(candidate.description, 'world.description');
  minText(candidate.unit, 'world.unit');
  minText(candidate.verb, 'world.verb');
  bounded(candidate.offlineCapSeconds, 'offlineCapSeconds', 86400);
  if (candidate.offlineCapSeconds < 1) throw new RangeError('offlineCapSeconds must be positive');
  bounded(candidate.prestigeThreshold, 'prestigeThreshold');
  if (candidate.prestigeThreshold < 100) throw new RangeError('prestigeThreshold must be at least 100');
  const ids = new Set();
  const producers = records(candidate.producers, 'producers', ids, p => {
    bounded(p.baseCost, `${p.id}.baseCost`);
    bounded(p.ratePerSecond, `${p.id}.ratePerSecond`);
    bounded(p.growthBasisPoints, `${p.id}.growthBasisPoints`, 30000);
    bounded(p.unlockAt, `${p.id}.unlockAt`);
    if (p.baseCost < 1 || p.ratePerSecond < 1 || p.growthBasisPoints < 10000)
      throw new RangeError('producer prices and rates must be positive; costs cannot decrease');
  });
  const upgrades = records(candidate.upgrades, 'upgrades', ids, u => {
    bounded(u.cost, `${u.id}.cost`);
    bounded(u.unlockAt, `${u.id}.unlockAt`);
    bounded(u.amount, `${u.id}.amount`, 10000);
    if (u.cost < 1 || u.amount < 1 || !['tap', 'production'].includes(u.effect))
      throw new RangeError('invalid upgrade contract');
  });
  if (!producers.some(p => p.unlockAt === 0)) throw new TypeError('world needs an initially unlocked producer');
  return Object.freeze({kind:WORLD_KIND,id:candidate.id,label:candidate.label,description:candidate.description,
    unit:candidate.unit,verb:candidate.verb,offlineCapSeconds:candidate.offlineCapSeconds,
    prestigeThreshold:candidate.prestigeThreshold,producers,upgrades});
}

/** Seed a particular world; no clock reads or implicit save access. */
export function newRun(world, nowMs) {
  boundedNatural(nowMs, 'nowMs');
  return {kind:STATE_KIND,worldId:world.id,lastMs:nowMs,banked:0,runProduced:0,
    allTime:0,prestige:0,taps:0,producers:Object.fromEntries(world.producers.map(p=>[p.id,0])),
    upgrades:Object.fromEntries(world.upgrades.map(u=>[u.id,false]))};
}

/** Fail closed for malformed, incompatible or truncated stored runs. */
export function admitRun(world, state) {
  if (!state || typeof state !== 'object' || Array.isArray(state) || state.kind !== STATE_KIND || state.worldId !== world.id)
    throw new TypeError('saved game belongs to another world or version');
  for (const k of ['lastMs','banked','runProduced','allTime','prestige','taps'])
    boundedNatural(state[k], `state.${k}`, k === 'prestige' ? MAX_PRESTIGE : k === 'lastMs' ? Number.MAX_SAFE_INTEGER : MAX_POINTS);
  if (state.runProduced > state.allTime || state.banked > state.allTime) throw new TypeError('saved game has inconsistent totals');
  if (!state.producers || !state.upgrades || Array.isArray(state.producers) || Array.isArray(state.upgrades))
    throw new TypeError('saved game inventory malformed');
  const producerIds = world.producers.map(p=>p.id), upgradeIds = world.upgrades.map(u=>u.id);
  if (Object.keys(state.producers).sort().join('|') !== producerIds.slice().sort().join('|') ||
    Object.keys(state.upgrades).sort().join('|') !== upgradeIds.slice().sort().join('|'))
    throw new TypeError('saved inventory no longer matches the world');
  for (const id of producerIds) boundedNatural(state.producers[id], `producers.${id}`, MAX_LEVEL);
  for (const id of upgradeIds) if (typeof state.upgrades[id] !== 'boolean') throw new TypeError(`upgrades.${id} must be a boolean`);
  return {...state,producers:{...state.producers},upgrades:{...state.upgrades}};
}

export function producerPrice(producer, owned) {
  boundedNatural(owned, 'owned', MAX_LEVEL);
  let price = producer.baseCost;
  for (let n=0; n<owned; n++) {
    price = Math.ceil(price * producer.growthBasisPoints / 10000);
    if (price > MAX_POINTS) return MAX_POINTS + 1;
  }
  return price;
}

export function incomePerSecond(world, state) {
  const base = world.producers.reduce((sum,p)=>sum+p.ratePerSecond*state.producers[p.id],0);
  const bonusPercent = world.upgrades.reduce((sum,u)=>sum+(state.upgrades[u.id] && u.effect==='production' ? u.amount : 0), 0);
  return Math.min(MAX_POINTS, Math.floor(base * (100+bonusPercent+state.prestige*20) / 100));
}

export function tapYield(world, state) {
  return 1 + world.upgrades.reduce((sum,u)=>sum+(state.upgrades[u.id] && u.effect==='tap' ? u.amount : 0),0) + state.prestige;
}

function credit(state, amount) {
  return {...state, banked:pointSum(state.banked,amount),runProduced:pointSum(state.runProduced,amount),
    allTime:pointSum(state.allTime,amount)};
}

export function advance(world, candidate, nowMs) {
  const state = admitRun(world,candidate);
  const time = elapsedTicks(state.lastMs, nowMs, {maxElapsedMs:world.offlineCapSeconds*1000});
  const rate = incomePerSecond(world,state);
  const gained = Math.min(MAX_POINTS, rate*time.ticks);
  return {state:{...credit(state,gained),lastMs:time.nextMs}, gained,
    seconds:time.ticks, discardedSeconds:Math.floor(time.discardedMs/1000)};
}

export function tap(world,candidate,nowMs) {
  const previous=advance(world,candidate,nowMs);
  const amount=tapYield(world,previous.state);
  return {accepted:true,state:{...credit(previous.state,amount),taps:pointSum(previous.state.taps,1)},gained:amount};
}

export function buyProducer(world,candidate,id,requested,nowMs) {
  const previous=advance(world,candidate,nowMs), state=previous.state;
  const p=world.producers.find(x=>x.id===id);
  if (!p) return {accepted:false,reason:'unknown-producer',state};
  if (state.runProduced<p.unlockAt) return {accepted:false,reason:'locked',state};
  const quantity=requested==='max' ? 100 : boundedNatural(requested,'requested',100);
  if (quantity===0) return {accepted:false,reason:'zero-quantity',state};
  let owned=state.producers[id], balance=state.banked, spent=0, bought=0;
  while (bought<quantity && owned<MAX_LEVEL) {
    const price=producerPrice(p,owned);
    if (price>balance) break;
    balance-=price; spent+=price; bought++; owned++;
  }
  if (bought===0) return {accepted:false,reason:owned===MAX_LEVEL?'level-cap':'insufficient-points',state};
  return {accepted:true,count:bought,spent,state:{...state,banked:balance,producers:{...state.producers,[id]:owned}}};
}

export function buyUpgrade(world,candidate,id,nowMs) {
  const previous=advance(world,candidate,nowMs), state=previous.state;
  const upgrade=world.upgrades.find(x=>x.id===id);
  if (!upgrade) return {accepted:false,reason:'unknown-upgrade',state};
  if (state.upgrades[id]) return {accepted:false,reason:'already-owned',state};
  if (state.runProduced<upgrade.unlockAt) return {accepted:false,reason:'locked',state};
  if (state.banked<upgrade.cost) return {accepted:false,reason:'insufficient-points',state};
  return {accepted:true,state:{...state,banked:state.banked-upgrade.cost,
    upgrades:{...state.upgrades,[id]:true}}};
}

export function availablePrestige(world, state) {
  if (state.prestige>=MAX_PRESTIGE) return 0;
  return Math.min(MAX_PRESTIGE-state.prestige,Math.floor(Math.sqrt(state.runProduced/world.prestigeThreshold)));
}

export function prestige(world,candidate,nowMs) {
  const previous=advance(world,candidate,nowMs), state=previous.state;
  const awarded=availablePrestige(world,state);
  if (!awarded) return {accepted:false,reason:'threshold-not-met',state};
  const reset=newRun(world,state.lastMs);
  return {accepted:true,awarded,state:{...reset,prestige:state.prestige+awarded,
    allTime:state.allTime,taps:state.taps}};
}

export function project(world,candidate,nowMs) {
  const {state,gained,seconds,discardedSeconds}=advance(world,candidate,nowMs);
  return {state,gained,seconds,discardedSeconds,rate:incomePerSecond(world,state),tapYield:tapYield(world,state),
    availablePrestige:availablePrestige(world,state),
    producers:world.producers.map(p=>({...p,owned:state.producers[p.id],nextCost:producerPrice(p,state.producers[p.id]),
      locked:state.runProduced<p.unlockAt})),
    upgrades:world.upgrades.map(u=>({...u,owned:state.upgrades[u.id],locked:state.runProduced<u.unlockAt}))};
}

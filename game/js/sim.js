import { GRID_W, GRID_H, DISTRICTS, districtById } from './data/districts.js';
import { ZONE_TYPES, CAPACITY, CHARACTER_TRAITS, characterCap, CIVIC_BUILDINGS } from './data/buildings.js';
import { TRANSIT_TYPES, CROSSINGS } from './data/transit.js';
import { EVENTS, eventsForYear } from './data/events.js';
import { createGrid, seedStartingCity, tileAt, districtTiles, neighbors4 } from './map.js';

const START_YEAR = 1918;
const END_YEAR = 1981;

// ---------------------------------------------------------------- creation

export function createInitialState() {
  const grid = seedStartingCity(createGrid());
  const state = {
    year: START_YEAR,
    month: 0, // 0-11 (Jan..Dec)
    speed: 1, // 0 paused, 1 normal, 2 fast, 3 fastest
    treasury: 800,
    taxRate: 0.08,
    grid,
    unlockedCrossings: new Set(CROSSINGS.filter(c => c.yearBuilt <= START_YEAR).map(c => c.id)),
    forceUnlockedTech: new Set(),
    districtGrowthMult: {},
    districtPopOffset: {},
    modifiers: [], // { key, value, districtId?, monthsRemaining }
    firedEventYears: new Set(),
    pendingEvent: null,
    eventLog: [],
    districtStats: {},
    cityStats: { population: 0, jobs: 0, happiness: 0.5, pollution: 0, score: 0 },
    finalReportShown: false,
    gameOverShown: false,
  };
  recomputeDerived(state);
  // Fire the 1918 intro event immediately (auto, no pause).
  runEventsForYear(state, START_YEAR, []);
  recomputeDerived(state);
  return state;
}

// ---------------------------------------------------------------- fields (BFS decay)

function bfsDecay(grid, predicate, maxDist) {
  const { w, h, tiles } = grid;
  const dist = new Int16Array(w * h).fill(-1);
  const queue = [];
  let head = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (tiles[y][x].terrain === 'land' && predicate(tiles[y][x])) {
        dist[y * w + x] = 0;
        queue.push(x, y);
      }
    }
  }
  while (head < queue.length) {
    const x = queue[head++], y = queue[head++];
    const d = dist[y * w + x];
    if (d >= maxDist) continue;
    for (const [nx, ny] of neighbors4(x, y)) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (tiles[ny][nx].terrain !== 'land') continue;
      const idx = ny * w + nx;
      if (dist[idx] === -1) {
        dist[idx] = d + 1;
        queue.push(nx, ny);
      }
    }
  }
  const score = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) {
    score[i] = dist[i] === -1 ? 0 : Math.max(0, 1 - dist[i] / maxDist);
  }
  return score;
}

// Additive radius field (for pollution, which stacks from multiple sources
// rather than just taking the nearest one).
function radiusSumField(grid, sources, maxDist) {
  const { w, h } = grid;
  const field = new Float32Array(w * h);
  for (const { x: sx, y: sy, weight } of sources) {
    const r = maxDist;
    for (let y = Math.max(0, sy - r); y <= Math.min(h - 1, sy + r); y++) {
      for (let x = Math.max(0, sx - r); x <= Math.min(w - 1, sx + r); x++) {
        const d = Math.abs(x - sx) + Math.abs(y - sy);
        if (d > r) continue;
        field[y * w + x] += weight * Math.max(0, 1 - d / r);
      }
    }
  }
  return field;
}

// ---------------------------------------------------------------- modifiers

function activeMods(state) {
  const m = {
    demandR: 0, demandC: 0, demandI: 0,
    transitCostMult: {}, transitUpkeepMult: {},
    civicCostMult: 0, happinessCity: 0,
    roadPollutionMult: 0, transitDemandShift: 0,
  };
  for (const mod of state.modifiers) {
    if (mod.districtId) continue; // district-scoped, handled separately
    switch (mod.key) {
      case 'demandMult.R': m.demandR += mod.value; break;
      case 'demandMult.C': m.demandC += mod.value; break;
      case 'demandMult.I': m.demandI += mod.value; break;
      case 'civicCostMult': m.civicCostMult += mod.value; break;
      case 'happiness': m.happinessCity += mod.value; break;
      case 'roadPollutionMult': m.roadPollutionMult += mod.value; break;
      case 'transitDemandShift': m.transitDemandShift += mod.value; break;
      default:
        if (mod.key.startsWith('transitCostMult.')) {
          const t = mod.key.split('.')[1];
          m.transitCostMult[t] = (m.transitCostMult[t] || 0) + mod.value;
        } else if (mod.key.startsWith('transitUpkeepMult.')) {
          const t = mod.key.split('.')[1];
          m.transitUpkeepMult[t] = (m.transitUpkeepMult[t] || 0) + mod.value;
        }
    }
  }
  return m;
}

function districtHappinessMod(state, districtId) {
  let total = 0;
  for (const mod of state.modifiers) {
    if (mod.districtId === districtId && mod.key === 'happiness') total += mod.value;
  }
  return total;
}

export function transitCost(state, typeId) {
  const def = TRANSIT_TYPES[typeId];
  const m = activeMods(state);
  const mult = 1 + (m.transitCostMult[typeId] || 0);
  return Math.max(1, def.costPerTile * mult);
}

export function transitUpkeepMult(state, typeId) {
  const m = activeMods(state);
  return 1 + (m.transitUpkeepMult[typeId] || 0);
}

export function civicCost(state, civicId) {
  const def = CIVIC_BUILDINGS[civicId];
  const m = activeMods(state);
  return Math.max(1, def.cost * (1 + m.civicCostMult));
}

// ---------------------------------------------------------------- derived stats

export function recomputeDerived(state) {
  const { grid } = state;
  const { w, h, tiles } = grid;

  const roadField = bfsDecay(grid, t => t.road, 5);
  const subwayField = bfsDecay(grid, t => t.transit === 'subway', 8);
  const elevatedField = bfsDecay(grid, t => t.transit === 'elevated', 7);
  const trolleyField = bfsDecay(grid, t => t.transit === 'trolley', 5);
  const busField = bfsDecay(grid, t => t.transit === 'bus', 5);
  const highwayField = bfsDecay(grid, t => t.transit === 'highway', 4);
  const parkField = bfsDecay(grid, t => t.civic === 'park', 4);
  const fireField = bfsDecay(grid, t => t.civic === 'fire-station', 8);
  const schoolField = bfsDecay(grid, t => t.civic === 'school', 6);
  const hospitalField = bfsDecay(grid, t => t.civic === 'hospital', 7);

  const industrialSources = [];
  const powerSources = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = tiles[y][x];
      if (t.terrain !== 'land') continue;
      if (t.zone === 'I' && t.devLevel >= 2) industrialSources.push({ x, y, weight: 0.35 * (t.devLevel / 4) });
      if (t.civic === 'power-plant') powerSources.push({ x, y, weight: 0.5 });
    }
  }
  const industrialPollution = radiusSumField(grid, industrialSources, 5);
  const powerPollution = radiusSumField(grid, powerSources, 6);

  const cityPowered = powerSources.length > 0;
  state.cityPowered = cityPowered;

  const m = activeMods(state);
  const industrialEraFactor = 1 - 0.5 * Math.max(0, (state.year - 1950) / (END_YEAR - 1950));

  let totalPop = 0, totalJobs = 0, totalHappinessWeighted = 0, totalPollution = 0, tileCount = 0;
  const districtAgg = {};
  for (const d of DISTRICTS) districtAgg[d.id] = { pop: 0, jobs: 0, pollutionSum: 0, accessSum: 0, landValueSum: 0, n: 0, roadTiles: 0, highwayTiles: 0, highwayFieldSum: 0 };

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = tiles[y][x];
      if (t.terrain !== 'land') continue;
      const idx = y * w + x;
      const transitAccess = Math.max(
        subwayField[idx] * 1.0,
        elevatedField[idx] * 0.75,
        trolleyField[idx] * 0.5,
        busField[idx] * 0.55
      );
      const pollution = clamp(
        0.95 * highwayField[idx] * (1 + m.roadPollutionMult) +
        industrialPollution[idx] +
        powerPollution[idx],
        0, 1.6
      );
      const traits = CHARACTER_TRAITS[districtById(t.districtId)?.character] || CHARACTER_TRAITS.suburban;
      const landValue = clamp(
        traits.baseLandValue + 0.18 * transitAccess - 0.3 * pollution + 0.15 * parkField[idx] + 0.08 * fireField[idx],
        0.05, 1.3
      );
      t.access = transitAccess;
      t.pollution = pollution;
      t.landValue = landValue;

      const agg = districtAgg[t.districtId];
      if (agg) {
        agg.pollutionSum += pollution;
        agg.accessSum += transitAccess;
        agg.landValueSum += landValue;
        agg.highwayFieldSum += highwayField[idx];
        if (t.road) agg.roadTiles++;
        if (t.transit === 'highway') agg.highwayTiles++;
        agg.n++;
      }

      if (t.zone === 'R') {
        const pop = CAPACITY.R[t.devLevel] || 0;
        totalPop += pop;
        if (agg) agg.pop += pop;
      } else if (t.zone === 'C') {
        const jobs = CAPACITY.C[t.devLevel] || 0;
        totalJobs += jobs;
        if (agg) agg.jobs += jobs;
      } else if (t.zone === 'I') {
        const jobs = (CAPACITY.I[t.devLevel] || 0) * traits.industryBonus * industrialEraFactor;
        totalJobs += jobs;
        if (agg) agg.jobs += jobs;
      }
      totalPollution += pollution;
      tileCount++;
    }
  }

  // District-level offsets (from one-off event bonuses) and happiness.
  for (const d of DISTRICTS) {
    const agg = districtAgg[d.id];
    const offset = state.districtPopOffset[d.id] || 0;
    const pop = Math.max(0, agg.pop + offset);
    const avgAccess = agg.n ? agg.accessSum / agg.n : 0;
    const avgPollution = agg.n ? agg.pollutionSum / agg.n : 0;
    const unemployment = pop > 0 ? clamp(1 - agg.jobs / Math.max(1, pop), 0, 1) : 0;
    const serviceCoverage = agg.n ? (fieldAvgOverDistrict(schoolField, hospitalField, fireField, d, w) ) : 0;
    const parkCoverage = agg.n ? fieldAvgSingle(parkField, d, w) : 0;
    const districtMod = districtHappinessMod(state, d.id);
    const brokeMalus = state.treasury < 0 ? 0.1 : 0;

    // Car mode share vs. congestion vs. induced demand: more expressway
    // presence pulls trips onto the road (raising car share) faster than
    // it adds capacity, so congestion doesn't reliably improve even as
    // the district paves more lane-miles -- while pollution keeps rising.
    const avgHighwayField = agg.n ? agg.highwayFieldSum / agg.n : 0;
    const carShare = clamp(0.28 + 0.55 * avgHighwayField - 0.4 * avgAccess - m.transitDemandShift, 0.05, 0.95);
    const carTrips = pop * carShare;
    const roadCapacityUnits = agg.roadTiles * 1.0 + agg.highwayTiles * 2.5;
    const congestion = clamp(carTrips / Math.max(1, roadCapacityUnits), 0, 2.5);

    let happiness = 0.55
      + 0.22 * avgAccess
      - 0.32 * avgPollution
      - 0.12 * unemployment
      + 0.12 * serviceCoverage
      + 0.08 * parkCoverage
      - 0.12 * congestion
      + m.happinessCity
      + districtMod
      - brokeMalus;
    happiness = clamp01(happiness);

    state.districtStats[d.id] = {
      population: Math.round(pop * 1000),
      jobs: Math.round(agg.jobs * 1000),
      happiness,
      pollution: avgPollution,
      access: avgAccess,
      landValue: agg.n ? agg.landValueSum / agg.n : 0,
      carShare,
      congestion,
    };
    totalHappinessWeighted += happiness * pop;
  }

  const cityHappiness = totalPop > 0 ? clamp01(totalHappinessWeighted / totalPop) : 0.5;
  state.cityStats = {
    population: Math.round(totalPop * 1000),
    jobs: Math.round(totalJobs * 1000),
    happiness: cityHappiness,
    pollution: tileCount ? totalPollution / tileCount : 0,
    treasury: state.treasury,
    score: Math.round(totalPop * 1000 * (0.4 + 0.6 * cityHappiness)),
  };

  state._fields = { roadField, subwayField, elevatedField, trolleyField, busField, highwayField, parkField, schoolField };
}

function fieldAvgSingle(field, d, w) {
  let sum = 0, n = 0;
  for (let y = d.rect.y0; y < d.rect.y1; y++) {
    for (let x = d.rect.x0; x < d.rect.x1; x++) { sum += field[y * w + x]; n++; }
  }
  return n ? sum / n : 0;
}
function fieldAvgOverDistrict(schoolField, hospitalField, fireField, d, w) {
  let sum = 0, n = 0;
  for (let y = d.rect.y0; y < d.rect.y1; y++) {
    for (let x = d.rect.x0; x < d.rect.x1; x++) {
      sum += (schoolField[y * w + x] + hospitalField[y * w + x] + fireField[y * w + x]) / 3;
      n++;
    }
  }
  return n ? sum / n : 0;
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function clamp01(v) { return clamp(v, 0, 1); }

// ---------------------------------------------------------------- growth tick

export function currentCityDemand(state) {
  return cityDemand(state);
}

function cityDemand(state) {
  const m = activeMods(state);
  const { population, jobs } = state.cityStats;
  const jobRatio = population > 0 ? clamp01(jobs / population) : 0.5;
  const R = clamp01(0.55 - state.taxRate * 2.5 + 0.35 * jobRatio + m.demandR);
  const C = clamp01(0.45 + 0.35 * clamp01(population / Math.max(1, jobs * 2.2 + 1)) - state.taxRate * 2 + m.demandC);
  const industrialEraFactor = 1 - 0.5 * Math.max(0, (state.year - 1950) / (END_YEAR - 1950));
  const I = clamp01(0.6 * industrialEraFactor - state.taxRate * 2 + m.demandI);
  return { R, C, I };
}

function growTiles(state) {
  const { grid } = state;
  const { w, h, tiles } = grid;
  const demand = cityDemand(state);
  const { roadField, schoolField } = state._fields || {};

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = tiles[y][x];
      if (t.terrain !== 'land' || !t.zone) continue;
      const d = districtById(t.districtId);
      const cap = characterCap(d.character);
      const roadAccess = roadField ? roadField[y * w + x] : 0;
      const growthMult = state.districtGrowthMult[d.id] || 1;

      if (roadAccess < 0.01) continue; // no street access, nothing grows

      const powerGate = state.cityPowered ? 1 : (t.devLevel < 1 ? 1 : 0);
      const localMult = clamp(
        0.25 + 0.55 * t.access + 0.25 * roadAccess + 0.25 * t.landValue - 0.4 * t.pollution + 0.2 * (schoolField ? schoolField[y * w + x] : 0),
        0, 1.6
      ) * growthMult * powerGate;

      const dem = demand[t.zone];
      const growthChance = 0.05 * dem * localMult;
      const declineChance = t.devLevel > 0 ? 0.03 * (1 - dem) * (0.3 + t.pollution) : 0;

      if (t.devLevel < cap && Math.random() < growthChance) {
        t.devLevel++;
      } else if (t.devLevel > 0 && Math.random() < declineChance) {
        t.devLevel--;
      }
    }
  }
}

// ---------------------------------------------------------------- congestion & economy

function economyTick(state) {
  const { population, jobs } = state.cityStats;
  const eraProgress = clamp01((state.year - START_YEAR) / (END_YEAR - START_YEAR));
  const incomeFactor = 1 + 0.6 * eraProgress;
  const revenue = (population / 1000) * state.taxRate * 0.35 * incomeFactor + (jobs / 1000) * state.taxRate * 0.25 * incomeFactor;

  let upkeep = 0;
  const { tiles, w, h } = state.grid;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = tiles[y][x];
      if (t.terrain !== 'land') continue;
      if (t.road) upkeep += 0.015;
      if (t.transit) upkeep += (TRANSIT_TYPES[t.transit].upkeepPerTile / 12) * transitUpkeepMult(state, t.transit);
      if (t.civic) upkeep += (CIVIC_BUILDINGS[t.civic].upkeep / 12);
    }
  }
  state.treasury += revenue - upkeep;
  state._lastRevenue = revenue;
  state._lastUpkeep = upkeep;
}

// ---------------------------------------------------------------- events

function pushModifier(state, key, value, durationMonths, districtId) {
  state.modifiers.push({ key, value, districtId: districtId || null, monthsRemaining: durationMonths == null ? 1 : (durationMonths >= 999 ? Infinity : durationMonths) });
}

function bulldozeForDisplacement(state, districtId, amountUnitsK) {
  let remaining = amountUnitsK;
  const cells = districtTiles(state.grid, districtId).filter(c => c.tile.zone === 'R' && c.tile.devLevel > 0);
  cells.sort((a, b) => b.tile.devLevel - a.tile.devLevel);
  for (const { tile } of cells) {
    if (remaining <= 0) break;
    while (tile.devLevel > 0 && remaining > 0) {
      const freed = CAPACITY.R[tile.devLevel] - CAPACITY.R[tile.devLevel - 1];
      tile.devLevel--;
      remaining -= freed;
    }
    if (tile.devLevel === 0) tile.zone = null;
  }
}

function applyEffect(state, effect) {
  if (!effect) return;
  const dur = effect.durationMonths;

  if (effect.treasuryMult) state.treasury *= (1 + effect.treasuryMult);
  if (effect.taxRateDelta) state.taxRate = clamp(state.taxRate + effect.taxRateDelta, 0, 0.3);
  if (effect.unlockCrossing) state.unlockedCrossings.add(effect.unlockCrossing);
  if (effect.unlockTech) state.forceUnlockedTech.add(effect.unlockTech);

  if (effect.demandMult) {
    for (const [k, v] of Object.entries(effect.demandMult)) pushModifier(state, `demandMult.${k}`, v, dur);
  }
  if (effect.transitCostMult) {
    for (const [k, v] of Object.entries(effect.transitCostMult)) pushModifier(state, `transitCostMult.${k}`, v, dur);
  }
  if (effect.transitUpkeepMult) {
    for (const [k, v] of Object.entries(effect.transitUpkeepMult)) pushModifier(state, `transitUpkeepMult.${k}`, v, dur);
  }
  if (effect.civicCostMult) pushModifier(state, 'civicCostMult', effect.civicCostMult, dur);
  if (typeof effect.happiness === 'number') pushModifier(state, 'happiness', effect.happiness, dur);
  if (effect.roadPollutionMult) pushModifier(state, 'roadPollutionMult', effect.roadPollutionMult, dur);
  if (effect.transitDemandShift) pushModifier(state, 'transitDemandShift', effect.transitDemandShift, dur);

  if (effect.districtBonus) {
    for (const [distId, bonus] of Object.entries(effect.districtBonus)) {
      if (typeof bonus.population === 'number') {
        if (bonus.population < 0) bulldozeForDisplacement(state, distId, -bonus.population);
        else state.districtPopOffset[distId] = (state.districtPopOffset[distId] || 0) + bonus.population;
      }
      if (typeof bonus.happiness === 'number') pushModifier(state, 'happiness', bonus.happiness, dur, distId);
      if (typeof bonus.growthMult === 'number') {
        state.districtGrowthMult[distId] = (state.districtGrowthMult[distId] || 1) * bonus.growthMult;
      }
    }
  }
  if (effect.finalReport) state.finalReportPending = true;
}

function runEventsForYear(state, year, notices) {
  for (const ev of eventsForYear(year)) {
    const key = `${year}:${ev.title}`;
    if (state.firedEventYears.has(key)) continue;
    state.firedEventYears.add(key);
    if (ev.type === 'choice') {
      state.pendingEvent = ev;
    } else {
      applyEffect(state, ev.effect);
      state.eventLog.push({ year, title: ev.title, body: ev.body });
      notices.push({ kind: 'event', title: ev.title, body: ev.body });
    }
  }
}

export function resolveEvent(state, optionIndex) {
  const ev = state.pendingEvent;
  if (!ev) return;
  const opt = ev.options[optionIndex];
  applyEffect(state, opt.effect);
  state.eventLog.push({ year: state.year, title: ev.title, body: opt.result });
  state.pendingEvent = null;
  recomputeDerived(state);
}

// ---------------------------------------------------------------- main tick

export function tickMonth(state) {
  const notices = [];
  if (state.pendingEvent) return notices; // paused for a choice

  // decay modifiers
  state.modifiers = state.modifiers.filter(m => {
    if (m.monthsRemaining === Infinity) return true;
    m.monthsRemaining -= 1;
    return m.monthsRemaining > 0;
  });

  growTiles(state);
  economyTick(state);
  recomputeDerived(state);

  state.month++;
  if (state.month >= 12) {
    state.month = 0;
    state.year++;
    runEventsForYear(state, state.year, notices);
    recomputeDerived(state);
  }

  return notices;
}

export function isGameEnded(state) {
  return state.year > END_YEAR;
}

// ---------------------------------------------------------------- build actions

export function unlockedTransitTypes(state) {
  return Object.values(TRANSIT_TYPES).filter(t => t.unlockYear <= state.year || state.forceUnlockedTech.has(t.id));
}

export function zoneTile(state, x, y, zoneId) {
  const t = tileAt(state.grid, x, y);
  if (!t || t.terrain !== 'land' || t.civic || t.zone === zoneId) return false;
  const cost = ZONE_TYPES[zoneId].costPerTile;
  if (state.treasury < cost) return false;
  t.zone = zoneId;
  if (t.devLevel === 0) t.devLevel = 0;
  state.treasury -= cost;
  return true;
}

export function bulldozeTile(state, x, y) {
  const t = tileAt(state.grid, x, y);
  if (!t || t.terrain !== 'land') return false;
  const cost = 3;
  if (state.treasury < cost) return false;
  t.zone = null; t.devLevel = 0; t.civic = null; t.transit = null; t.road = false;
  state.treasury -= cost;
  return true;
}

export function buildRoad(state, x, y) {
  const t = tileAt(state.grid, x, y);
  if (!t || t.terrain !== 'land' || t.road) return false;
  const cost = transitCost(state, 'road');
  if (state.treasury < cost) return false;
  t.road = true;
  state.treasury -= cost;
  return true;
}

export function buildTransit(state, x, y, typeId) {
  const t = tileAt(state.grid, x, y);
  const def = TRANSIT_TYPES[typeId];
  if (!t || !def || t.terrain !== 'land') return false;
  if (def.needsRoad && !t.road && typeId !== 'road') return false;
  const cost = transitCost(state, typeId);
  if (state.treasury < cost) return false;

  // Highways can pave straight through developed neighborhoods -- the
  // Robert Moses mechanic. Demolishing an occupied tile displaces whoever
  // was living/working there.
  if (def.canDemolish && t.zone && t.devLevel > 0) {
    const districtId = t.districtId;
    const capTable = t.zone === 'R' ? CAPACITY.R : (t.zone === 'C' ? CAPACITY.C : CAPACITY.I);
    const displaced = capTable[t.devLevel];
    if (t.zone === 'R') bulldozeForDisplacement(state, districtId, displaced);
    t.zone = null; t.devLevel = 0;
    pushModifier(state, 'happiness', -0.03, 18, districtId);
  }

  t.transit = typeId;
  if (typeId === 'road' || typeId === 'highway') t.road = true;
  else if (def.needsRoad) t.road = true;
  state.treasury -= cost;
  return true;
}

export function buildCivic(state, x, y, civicId) {
  const t = tileAt(state.grid, x, y);
  const def = CIVIC_BUILDINGS[civicId];
  if (!t || !def || t.terrain !== 'land' || t.civic || (t.zone && t.devLevel > 0)) return false;
  const cost = civicCost(state, civicId);
  if (state.treasury < cost) return false;
  t.civic = civicId;
  t.zone = null; t.devLevel = 0;
  t.road = true;
  state.treasury -= cost;
  return true;
}

export { START_YEAR, END_YEAR };

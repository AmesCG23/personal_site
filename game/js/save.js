import { recomputeDerived } from './sim.js';

const SLOT_PREFIX = 'nyc1918.save.';
export const SLOT_IDS = ['a', 'b', 'c'];
const AUTOSAVE_ID = 'auto';

function serialize(state) {
  return JSON.stringify({
    version: 1,
    year: state.year,
    month: state.month,
    speed: state.speed,
    treasury: state.treasury,
    taxRate: state.taxRate,
    grid: state.grid,
    unlockedCrossings: Array.from(state.unlockedCrossings),
    forceUnlockedTech: Array.from(state.forceUnlockedTech),
    districtGrowthMult: state.districtGrowthMult,
    districtPopOffset: state.districtPopOffset,
    modifiers: state.modifiers,
    firedEventYears: Array.from(state.firedEventYears),
    eventLog: state.eventLog,
    finalReportShown: state.finalReportShown,
    savedAt: new Date().toISOString(),
  });
}

function deserialize(json) {
  const obj = JSON.parse(json);
  const state = {
    year: obj.year,
    month: obj.month,
    speed: obj.speed ?? 1,
    treasury: obj.treasury,
    taxRate: obj.taxRate,
    grid: obj.grid,
    unlockedCrossings: new Set(obj.unlockedCrossings),
    forceUnlockedTech: new Set(obj.forceUnlockedTech),
    districtGrowthMult: obj.districtGrowthMult || {},
    districtPopOffset: obj.districtPopOffset || {},
    modifiers: obj.modifiers || [],
    firedEventYears: new Set(obj.firedEventYears || []),
    pendingEvent: null,
    eventLog: obj.eventLog || [],
    districtStats: {},
    cityStats: { population: 0, jobs: 0, happiness: 0.5, pollution: 0, score: 0 },
    finalReportShown: obj.finalReportShown || false,
    gameOverShown: false,
  };
  recomputeDerived(state);
  return { state, savedAt: obj.savedAt };
}

export function saveToSlot(state, slotId) {
  try {
    localStorage.setItem(SLOT_PREFIX + slotId, serialize(state));
    return true;
  } catch (e) {
    console.error('Save failed', e);
    return false;
  }
}

export function loadFromSlot(slotId) {
  const raw = localStorage.getItem(SLOT_PREFIX + slotId);
  if (!raw) return null;
  try {
    return deserialize(raw);
  } catch (e) {
    console.error('Load failed', e);
    return null;
  }
}

export function slotInfo(slotId) {
  const raw = localStorage.getItem(SLOT_PREFIX + slotId);
  if (!raw) return null;
  try {
    const obj = JSON.parse(raw);
    return { year: obj.year, savedAt: obj.savedAt };
  } catch (e) {
    return null;
  }
}

export function autosave(state) {
  saveToSlot(state, AUTOSAVE_ID);
}

export function loadAutosave() {
  return loadFromSlot(AUTOSAVE_ID);
}

export function hasAutosave() {
  return !!localStorage.getItem(SLOT_PREFIX + AUTOSAVE_ID);
}

export function clearSlot(slotId) {
  localStorage.removeItem(SLOT_PREFIX + slotId);
}

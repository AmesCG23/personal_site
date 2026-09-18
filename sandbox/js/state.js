// state.js — the board and every change to it. Pure data; the UI re-renders after each action.
// Rules encoded here are cited by Comprehensive Rules number in comments.

import { loadState, saveState } from "./store.js";

const MAX_HISTORY = 30;
let listeners = [];
export const onChange = (fn) => listeners.push(fn);
const emit = () => listeners.forEach((fn) => fn(state));

export const uid = () => "s_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export let state = fresh();
export const history = [];

function fresh() {
  return { version: 1, turn: 1, life: 40, mana: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 }, stacks: [] };
}

export function init() {
  const saved = loadState();
  if (saved && saved.version === 1 && Array.isArray(saved.stacks)) state = saved;
  emit();
}

let batching = false;
// Run several mutations as one undo step (e.g. "sacrifice Treasure" + "add red mana").
export function batch(fn) {
  if (batching) return fn();
  snapshot(); batching = true;
  try { return fn(); } finally { batching = false; commit(); }
}
function snapshot() {
  if (batching) return;
  history.push(JSON.stringify({ turn: state.turn, life: state.life, mana: state.mana, stacks: state.stacks }));
  if (history.length > MAX_HISTORY) history.shift();
}
function commit(immediate = false) { saveState(state, immediate); emit(); }
export const canUndo = () => history.length > 0;
export function undo() {
  if (!history.length) return;
  Object.assign(state, JSON.parse(history.pop()));
  commit();
}
export const flush = () => saveState(state, true);

export const find = (id) => state.stacks.find((s) => s.uid === id) || null;

const hasKeyword = (s, kw) => new RegExp(`(^|\\n|,\\s*)${kw}\\b`, "i").test(s.text || "");

// ---- creating ----
export function addStack(def, { count = 1, art = null } = {}) {
  snapshot();
  const s = {
    uid: uid(),
    catalog_id: def.catalog_id || null,
    name: def.name,
    type_line: def.type_line,
    types: def.types || [],
    subtypes: def.subtypes || [],
    colors: def.colors || [],
    is_creature: !!def.is_creature,
    base_power: def.base_power,
    base_toughness: def.base_toughness,
    text: def.text || "",
    count: Math.max(1, count | 0),
    tapped: false,
    // 302.6 summoning sickness: creatures can't attack the turn they arrive (haste excepted).
    sick: !!def.is_creature && !hasKeyword(def, "haste"),
    counters: { plus: 0, minus: 0 },
    custom_counter: null,      // { name, n }
    art: art || { kind: "none" },
    created_turn: state.turn,
    order: state.stacks.length,
  };
  // Merge into an identical untapped-and-sick twin created this turn (tapping the palette twice = ×2).
  const twin = state.stacks.find((o) => compatible(o, s) && o.art.kind === "none" && s.art.kind === "none");
  if (twin) { twin.count += s.count; commit(); return twin; }
  state.stacks.push(s);
  commit();
  return s;
}

// ---- counts ----
export function setCount(id, n) {
  const s = find(id); if (!s) return;
  snapshot();
  s.count = n | 0;
  if (s.count <= 0) state.stacks = state.stacks.filter((o) => o !== s);   // 111.7 tokens that leave cease to exist
  commit();
}
export const incCount = (id, d = 1) => { const s = find(id); if (s) setCount(id, s.count + d); };
export function remove(id, all = false) { const s = find(id); if (s) setCount(id, all ? 0 : s.count - 1); }

// ---- tapping ----
export function toggleTap(id) { const s = find(id); if (!s) return; snapshot(); s.tapped = !s.tapped; commit(); }
export function setTapped(id, v) { const s = find(id); if (!s) return; snapshot(); s.tapped = !!v; commit(); }
// "Tap 7 of 12": split, then tap the moved part. 508.1f attacking taps the attackers.
export function tapN(id, n) {
  const s = find(id); if (!s) return;
  if (n >= s.count) { setTapped(id, true); return; }
  const moved = split(id, n, { tapMoved: true });
  return moved;
}
export function nextTurn() {
  snapshot();
  state.turn += 1;
  for (const s of state.stacks) { s.tapped = false; s.sick = false; }   // 502.3 untap step; 302.6 sickness ends
  commit();
}
export function untapAll() { snapshot(); for (const s of state.stacks) s.tapped = false; commit(); }

// ---- counters (122.1a, 704.5q) ----
export function addCounter(id, kind, d = 1) {
  const s = find(id); if (!s) return;
  snapshot();
  if (kind === "plus") s.counters.plus = Math.max(0, s.counters.plus + d);
  else s.counters.minus = Math.max(0, s.counters.minus + d);
  const n = Math.min(s.counters.plus, s.counters.minus);   // 704.5q pairwise annihilation
  s.counters.plus -= n; s.counters.minus -= n;
  commit();
}
export function setCustomCounter(id, name, n) {
  const s = find(id); if (!s) return;
  snapshot();
  s.custom_counter = name && n !== null ? { name, n: n | 0 } : null;
  commit();
}
export function power(s) { return numeric(s.base_power, s); }
export function toughness(s) { return numeric(s.base_toughness, s, true); }
function numeric(base, s, isT = false) {
  if (base == null) return null;
  const b = parseInt(base, 10);
  const delta = s.counters.plus - s.counters.minus;
  if (Number.isNaN(b)) return `${base}${delta ? (delta > 0 ? "+" + delta : delta) : ""}`;
  return b + delta;
}
export const isDead = (s) => s.is_creature && typeof toughness(s) === "number" && toughness(s) <= 0;   // 704.5f

// ---- split / merge / duplicate ----
export function split(id, k, { tapMoved = false } = {}) {
  const s = find(id); if (!s) return null;
  k = Math.max(1, Math.min(s.count - 1, k | 0));
  if (s.count < 2) return null;
  snapshot();
  const t = JSON.parse(JSON.stringify(s));
  t.uid = uid(); t.count = k; t.order = state.stacks.length;
  if (tapMoved) t.tapped = true;
  s.count -= k;
  state.stacks.splice(state.stacks.indexOf(s) + 1, 0, t);
  commit();
  return t;
}
// Two stacks may merge when every copiable value and every status matches (art aside).
export function compatible(a, b) {
  return a !== b && a.name === b.name && a.type_line === b.type_line && a.text === b.text &&
    String(a.base_power) === String(b.base_power) && String(a.base_toughness) === String(b.base_toughness) &&
    a.colors.join() === b.colors.join() && a.tapped === b.tapped && a.sick === b.sick &&
    a.counters.plus === b.counters.plus && a.counters.minus === b.counters.minus &&
    JSON.stringify(a.custom_counter) === JSON.stringify(b.custom_counter);
}
export function whyIncompatible(a, b) {
  if (a.name !== b.name || a.type_line !== b.type_line || a.text !== b.text) return "different tokens";
  if (String(a.base_power) !== String(b.base_power) || String(a.base_toughness) !== String(b.base_toughness)) return "different base power/toughness";
  if (a.colors.join() !== b.colors.join()) return "different colors";
  if (a.tapped !== b.tapped) return "one is tapped";
  if (a.sick !== b.sick) return "one has summoning sickness";
  if (a.counters.plus !== b.counters.plus || a.counters.minus !== b.counters.minus) return "+1/+1 or −1/−1 counters differ";
  if (JSON.stringify(a.custom_counter) !== JSON.stringify(b.custom_counter)) return "custom counters differ";
  return null;
}
export function merge(fromId, toId) {
  const a = find(fromId), b = find(toId);
  if (!a || !b || !compatible(a, b)) return false;
  snapshot();
  b.count += a.count;
  state.stacks = state.stacks.filter((o) => o !== a);
  commit();
  return true;
}
export function mergeTargets(id) { const s = find(id); return s ? state.stacks.filter((o) => compatible(o, s)) : []; }
// 707.2: a copy takes printed values only; counters and tapped state are not copied.
export function duplicate(id, { withState = false } = {}) {
  const s = find(id); if (!s) return null;
  snapshot();
  const t = JSON.parse(JSON.stringify(s));
  t.uid = uid(); t.order = state.stacks.length; t.created_turn = state.turn;
  if (!withState) { t.tapped = false; t.counters = { plus: 0, minus: 0 }; t.custom_counter = null; t.sick = s.is_creature && !hasKeyword(s, "haste"); }
  state.stacks.push(t);
  commit();
  return t;
}

// ---- editing ----
export function edit(id, fields) {
  const s = find(id); if (!s) return;
  snapshot();
  Object.assign(s, fields);
  if ("type_line" in fields) {
    const [left, right] = fields.type_line.split("—").map((x) => x.trim());
    s.types = (left || "").replace(/^Token\s*/i, "").split(/\s+/).filter(Boolean);
    s.subtypes = right ? right.split(/\s+/).filter(Boolean) : [];
    s.is_creature = /creature/i.test(left || "");
  }
  commit();
}
export function setArt(id, art) { const s = find(id); if (!s) return; snapshot(); s.art = art || { kind: "none" }; commit(); }
// Same, but no undo entry: used when the artist name arrives from Scryfall after the fact.
export function setArtQuiet(id, art) { const s = find(id); if (!s) return; s.art = art; commit(); }

// ---- sacrifice / use ----
export function sacrifice(id) { const s = find(id); if (!s) return; setCount(id, s.count - 1); }
// 111.10i Incubator → Phyrexian 0/0 artifact creature, keeps its counters.
export function transformIncubator(id) {
  const s = find(id); if (!s) return;
  snapshot();
  const t = JSON.parse(JSON.stringify(s));
  t.uid = uid(); t.count = 1; t.order = state.stacks.length;
  t.name = "Phyrexian"; t.type_line = "Token Artifact Creature — Phyrexian"; t.types = ["Artifact", "Creature"];
  t.subtypes = ["Phyrexian"]; t.is_creature = true; t.base_power = "0"; t.base_toughness = "0"; t.text = "";
  t.sick = true; t.tapped = false; t.art = { kind: "none" }; t.created_turn = state.turn;
  s.count -= 1;
  if (s.count <= 0) state.stacks = state.stacks.filter((o) => o !== s);
  state.stacks.push(t);
  commit();
  return t;
}

// ---- tray ----
export function addLife(d) { snapshot(); state.life += d; commit(); }
export function addMana(c, d) { snapshot(); state.mana[c] = Math.max(0, (state.mana[c] || 0) + d); commit(); }
export function clearMana() { snapshot(); for (const c of Object.keys(state.mana)) state.mana[c] = 0; commit(); }

export function newGame() {
  history.length = 0;
  state = fresh();
  commit(true);
}

export function summary() {
  const creatures = state.stacks.filter((s) => s.is_creature).reduce((n, s) => n + s.count, 0);
  const tapped = state.stacks.filter((s) => s.tapped).reduce((n, s) => n + s.count, 0);
  const others = {};
  for (const s of state.stacks) if (!s.is_creature) others[s.name] = (others[s.name] || 0) + s.count;
  const parts = [];
  if (creatures) parts.push(`${creatures} creature${creatures === 1 ? "" : "s"}`);
  if (tapped) parts.push(`${tapped} tapped`);
  for (const [k, v] of Object.entries(others)) parts.push(`${k} ×${v}`);
  return parts.join(" · ");
}

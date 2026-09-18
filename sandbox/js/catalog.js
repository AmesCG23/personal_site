// catalog.js — loads data/tokens.json and answers "what is a Goblin?"
// The first record for any name is the most common shape of that token.

const QUICK = ["Goblin", "Zombie", "Soldier", "Spirit", "Saproling", "Elf Warrior", "Thopter", "Human",
               "Wolf", "Beast", "Angel", "Dragon", "Treasure", "Food", "Clue", "Blood"];

let data = null;
const byId = new Map();
const firstByName = new Map();

export async function loadCatalog(url = "data/tokens.json") {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`catalog ${r.status}`);
  data = await r.json();
  for (const t of data.tokens) {
    byId.set(t.id, t);
    const key = t.name.toLowerCase();
    if (!firstByName.has(key)) firstByName.set(key, t);
  }
  return data;
}

export const catalogMeta = () => data ? { count: data.count, version: data.source_version, generated: data.generated_at } : null;
// Every creature type in the catalog, for the anthem type-picker's autocomplete.
let subtypeList = null;
export function allSubtypes() {
  if (!subtypeList) {
    const set = new Set();
    for (const t of data.tokens) for (const st of t.subtypes) if (t.is_creature) set.add(st);
    subtypeList = [...set].sort();
  }
  return subtypeList;
}
export const record = (id) => byId.get(id) || null;
export const defaultFor = (name) => firstByName.get(String(name).toLowerCase()) || null;
export const quickList = () => QUICK.map(defaultFor).filter(Boolean);

// Search the catalog by name or creature type. Popularity order is preserved
// because data.tokens is already sorted by makers_count.
export function search(q, limit = 30) {
  const s = q.trim().toLowerCase();
  if (!s) return quickList();
  const starts = [], contains = [];
  for (const t of data.tokens) {
    const name = t.name.toLowerCase();
    if (name.startsWith(s)) starts.push(t);
    else if (name.includes(s) || t.subtypes.some(st => st.toLowerCase().startsWith(s))) contains.push(t);
    if (starts.length + contains.length > limit * 3) break;
  }
  return starts.concat(contains).slice(0, limit);
}

// Turn a catalog record into the definition a stack is built from.
export function toDef(t) {
  return {
    catalog_id: t.id,
    name: t.name,
    type_line: t.type_line,
    types: t.types.slice(),
    subtypes: t.subtypes.slice(),
    colors: t.colors.slice(),
    is_creature: !!t.is_creature,
    base_power: t.power == null ? null : t.power,
    base_toughness: t.toughness == null ? null : t.toughness,
    text: t.text || "",
  };
}

export function ptLabel(t) {
  return t.power != null ? `${t.power}/${t.toughness}` : "";
}

// scryfall.js — a polite Scryfall client for the browser.
// Rules honoured (https://scryfall.com/docs/api): Accept header on every call,
// never touch User-Agent from a browser, at most one request per 100 ms,
// cache everything. Failures are swallowed by callers: the app must work
// without Scryfall (blank tokens and the bundled catalog still work).

const BASE = "https://api.scryfall.com";
const TTL = 7 * 24 * 3600 * 1000;
const queue = [];
let running = false;
const memo = new Map();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function readCache(url) {
  if (memo.has(url)) return memo.get(url);
  try {
    const raw = localStorage.getItem("sf:" + url);
    if (!raw) return null;
    const { t, j } = JSON.parse(raw);
    if (Date.now() - t > TTL) { localStorage.removeItem("sf:" + url); return null; }
    memo.set(url, j);
    return j;
  } catch { return null; }
}
function writeCache(url, j) {
  memo.set(url, j);
  try { localStorage.setItem("sf:" + url, JSON.stringify({ t: Date.now(), j })); } catch { /* full or private mode */ }
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const { fn, res, rej } = queue.shift();
    try { res(await fn()); } catch (e) { rej(e); }
    await sleep(100);
  }
  running = false;
}
function schedule(fn) { return new Promise((res, rej) => { queue.push({ fn, res, rej }); pump(); }); }

export function api(path, init = {}) {
  const url = path.startsWith("http") ? path : BASE + path;
  const cached = init.method ? null : readCache(url);
  if (cached) return Promise.resolve(cached);
  return schedule(async () => {
    const r = await fetch(url, { ...init, headers: { Accept: "application/json", ...(init.headers || {}) } });
    if (r.status === 404) return { object: "list", data: [], has_more: false, total_cards: 0 };
    if (!r.ok) throw new Error(`Scryfall ${r.status}`);
    const j = await r.json();
    if (!init.method) writeCache(url, j);
    return j;
  });
}

// Image URL from a Scryfall card id. The catalog only stores ids.
export const imgUrl = (id, size = "art_crop") =>
  `https://cards.scryfall.io/${size}/front/${id[0]}/${id[1]}/${id}.jpg`;

// Pull the useful bits out of a Card object (handles double-faced tokens).
export function summarize(card) {
  const face = card.image_uris ? card : (card.card_faces && card.card_faces[0]) || card;
  const uris = face.image_uris || card.image_uris || {};
  return {
    id: card.id,
    name: card.name,
    artist: face.artist || card.artist || null,
    set: card.set,
    set_name: card.set_name,
    cn: card.collector_number,
    released_at: card.released_at,
    art_crop: uris.art_crop || null,
    normal: uris.normal || null,
    small: uris.small || null,
    type_line: face.type_line || card.type_line || "",
    oracle_text: face.oracle_text || card.oracle_text || "",
    power: face.power ?? card.power ?? null,
    toughness: face.toughness ?? card.toughness ?? null,
    colors: face.colors || card.colors || [],
  };
}

export async function card(id) { return summarize(await api(`/cards/${id}`)); }
export async function cardByNumber(set, cn) { return summarize(await api(`/cards/${set}/${cn}`)); }

// Build the "all art for this token" query from a stack definition.
export function artQuery(def) {
  const parts = [`!"${def.name.replace(/"/g, "")}"`, "t:token"];
  parts.push(def.colors.length ? `c=${def.colors.join("").toLowerCase()}` : "c=c");
  if (def.is_creature && def.base_power != null && /^\d+$/.test(String(def.base_power)) && /^\d+$/.test(String(def.base_toughness))) {
    parts.push(`pow=${def.base_power}`, `tou=${def.base_toughness}`);
  }
  return parts.join(" ");
}

export async function searchArt(def) {
  const q = encodeURIComponent(artQuery(def));
  const j = await api(`/cards/search?q=${q}&unique=art&order=released&dir=desc&include_extras=true`);
  return (j.data || []).map(summarize);
}

// Free-text token search for the "Any token" box when the catalog has no match.
export async function searchTokens(text) {
  const q = encodeURIComponent(`${text} t:token`);
  const j = await api(`/cards/search?q=${q}&unique=cards&include_extras=true`);
  return (j.data || []).map(summarize);
}

// Crowd favourites that the community catalog does not carry yet.
export const FEATURED = [
  { forName: "Goblin", label: "Wizard of Barge · Secret Lair “Goblin Storm” (2026)", set: "sld", cn: "2421" },
];

#!/usr/bin/env node
/**
 * enrich-from-scryfall.mjs — fill in artist names, release dates and verified
 * image URLs for every printing in tokens.json, straight from Scryfall.
 *
 * Run this on a machine that can reach api.scryfall.com (a laptop is fine;
 * the Claude sandbox that wrote this file could NOT — its network policy
 * blocks scryfall.com, which is why tokens.json ships with artist: null).
 *
 *   node enrich-from-scryfall.mjs tokens.json            # rewrites in place
 *   node enrich-from-scryfall.mjs tokens.json out.json   # writes elsewhere
 *
 * Follows Scryfall's API rules (https://scryfall.com/docs/api):
 *   - descriptive User-Agent + Accept header on every request (else HTTP 400)
 *   - <= 10 requests/second; we wait 120 ms between calls
 *   - POST /cards/collection takes up to 75 identifiers per call
 * Node 18+ (built-in fetch). No dependencies.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [,, inPath = "tokens.json", outPath = inPath] = process.argv;
const HEADERS = {
  "User-Agent": "amesgrawert-token-catalog/1.0 (https://amesgrawert.com)",
  "Accept": "application/json",
  "Content-Type": "application/json",
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const catalog = JSON.parse(readFileSync(inPath, "utf8"));
const printings = catalog.tokens.flatMap((t) => t.printings.filter((p) => p.id));
console.error(`${printings.length} printings to look up`);

const byId = new Map();
for (let i = 0; i < printings.length; i += 75) {
  const batch = printings.slice(i, i + 75).map((p) => ({ id: p.id }));
  const res = await fetch("https://api.scryfall.com/cards/collection", {
    method: "POST", headers: HEADERS, body: JSON.stringify({ identifiers: batch }),
  });
  if (!res.ok) { console.error(`HTTP ${res.status} on batch ${i / 75}`); await sleep(2000); i -= 75; continue; }
  const data = await res.json();
  for (const card of data.data ?? []) byId.set(card.id, card);
  for (const nf of data.not_found ?? []) console.error("not found on Scryfall:", nf.id);
  console.error(`batch ${i / 75 + 1}/${Math.ceil(printings.length / 75)} ok`);
  await sleep(120);
}

let filled = 0;
for (const t of catalog.tokens) {
  for (const p of t.printings) {
    const c = byId.get(p.id);
    if (!c) { p.missing = true; continue; }
    // Double-faced tokens keep their images on card_faces[0]; normal tokens on image_uris.
    const face = c.image_uris ? c : (c.card_faces?.[0] ?? c);
    p.artist = face.artist ?? c.artist ?? null;
    p.released_at = c.released_at ?? null;
    p.set_name = c.set_name ?? null;
    p.illustration_id = face.illustration_id ?? c.illustration_id ?? null;
    p.art_crop = face.image_uris?.art_crop ?? null;   // authoritative URL, replaces the derived one
    filled++;
  }
}
catalog.enriched_at = new Date().toISOString();
writeFileSync(outPath, JSON.stringify(catalog));
console.error(`filled ${filled} printings -> ${outPath}`);

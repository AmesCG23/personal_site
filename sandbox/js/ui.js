// ui.js — rendering, touch handling and every sheet (bottom-sheet dialog).

import * as S from "./state.js";
import * as C from "./catalog.js";
import * as SF from "./scryfall.js";
import { blobUrl, putBlob, shrinkImage, loadPrefs, savePrefs } from "./store.js";
import { reminderFor } from "./reminders.js";

const $ = (sel, el = document) => el.querySelector(sel);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const COLOR_NAMES = { W: "White", U: "Blue", B: "Black", R: "Red", G: "Green", C: "Colorless" };

export function colorClass(s) {
  if (!s.colors || s.colors.length === 0) return (s.types || []).includes("Artifact") && !s.is_creature ? "c-a" : "c-c";
  if (s.colors.length > 1) return "c-m";
  return "c-" + s.colors[0].toLowerCase();
}

// ---------------------------------------------------------------- toast
let toastTimer = null;
export function toast(msg, ms = 2200) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, ms);
}

// ---------------------------------------------------------------- sheet
let onClose = null;
export function openSheet(title, html) {
  $("#sheet-title").textContent = title;
  const body = $("#sheet-body");
  body.innerHTML = html;
  $("#sheet").hidden = false; $("#sheet-backdrop").hidden = false;
  body.scrollTop = 0;
  return body;
}
export function closeSheet() {
  $("#sheet").hidden = true; $("#sheet-backdrop").hidden = true;
  $("#sheet-body").innerHTML = "";
  if (onClose) { const f = onClose; onClose = null; f(); }
}
export function confirmSheet(title, msg, yesLabel, onYes, danger = true) {
  const b = openSheet(title, `<p>${esc(msg)}</p><div class="row"><button class="btn grow" data-x="no">Cancel</button><button class="btn grow ${danger ? "btn-danger" : "btn-primary"}" data-x="yes">${esc(yesLabel)}</button></div>`);
  $("[data-x=no]", b).onclick = closeSheet;
  $("[data-x=yes]", b).onclick = () => { closeSheet(); onYes(); };
}

// ---------------------------------------------------------------- palette
export function renderPalette() {
  const row = $("#palette-chips");
  row.innerHTML = C.quickList().map((t) => {
    const pt = C.ptLabel(t);
    return `<button class="chip ${colorClass({ colors: t.colors, types: t.types, is_creature: t.is_creature })}" data-cat="${esc(t.id)}" title="${esc(t.type_line)}">${esc(t.name)}${pt ? `<span class="pt">${esc(pt)}</span>` : ""}</button>`;
  }).join("");
  row.onclick = (e) => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    const t = C.record(b.dataset.cat); if (!t) return;
    S.addStack(C.toDef(t));
  };
}

// ---------------------------------------------------------------- board
const artistFetched = new Set();
const uploadUrls = new Map();

function ptHtml(s) {
  if (s.base_power == null) return "";
  const p = S.power(s), t = S.toughness(s);
  return `<div class="pt ${S.isDead(s) ? "dead" : ""}" title="${S.isDead(s) ? "Toughness 0 or less: this creature dies (rule 704.5f)" : "Power / toughness"}">${esc(p)}/${esc(t)}</div>`;
}
function countersHtml(s) {
  const chips = [];
  if (s.counters.plus) chips.push(`<span>+1/+1 ×${s.counters.plus}</span>`);
  if (s.counters.minus) chips.push(`<span>−1/−1 ×${s.counters.minus}</span>`);
  if (s.custom_counter) chips.push(`<span>${esc(s.custom_counter.name)} ${s.custom_counter.n}</span>`);
  return chips.length ? `<div class="counters">${chips.join("")}</div>` : "";
}
function artHtml(s) {
  const a = s.art || { kind: "none" };
  if (a.kind === "scryfall" && a.id) {
    const credit = a.artist ? `Illus. ${esc(a.artist)} · © Wizards of the Coast` : "© Wizards of the Coast";
    return `<div class="art"><img src="${esc(a.art_crop || SF.imgUrl(a.id, "art_crop"))}" alt="" loading="lazy" /></div><div class="credit">${credit}</div>`;
  }
  if (a.kind === "upload" && a.blob_key) {
    const u = uploadUrls.get(a.blob_key);
    return `<div class="art" data-blob="${esc(a.blob_key)}">${u ? `<img src="${u}" alt="" />` : ""}</div>`;
  }
  return `<div class="art"></div>`;
}
function tileHtml(s) {
  const rem = reminderFor(s);
  const creature = s.base_power != null;
  const actions = creature
    ? `<div class="r"><button class="btn pm" data-act="dec" aria-label="Remove one">&minus;</button>
         <button class="btn pm" data-act="inc" aria-label="Add one">+</button></div>
       <div class="r"><button class="btn" data-act="plus" aria-label="Add a +1/+1 counter">+1/+1</button>
         <button class="btn" data-act="minus" aria-label="Add a −1/−1 counter">&minus;1/&minus;1</button>
         <button class="btn" data-act="menu" aria-label="More actions">&#8943;</button></div>`
    : `<div class="r"><button class="btn pm" data-act="dec" aria-label="Remove one">&minus;</button>
         <button class="btn pm" data-act="inc" aria-label="Add one">+</button></div>
       <div class="r"><button class="btn" data-act="sac">${esc(rem ? rem.verb : "Sacrifice")}</button>
         <button class="btn" data-act="menu" aria-label="More actions">&#8943;</button></div>`;
  return `<div class="tile ${s.tapped ? "tapped" : ""}" data-uid="${s.uid}">
    <div class="slot">
      <div class="card ${colorClass(s)} ${s.art.kind === "none" ? "no-art" : ""} ${s.base_power != null ? "has-pt" : ""}" role="button" tabindex="0"
           aria-label="${esc(s.name)} ×${s.count}${s.tapped ? ", tapped" : ""}. Tap to ${s.tapped ? "untap" : "tap"}; hold for menu.">
        ${artHtml(s)}
        <div class="body">
          <div class="name">${esc(s.name)}</div>
          <div class="type">${esc(s.type_line)}</div>
          ${s.text ? `<div class="text">${esc(s.text)}</div>` : ""}
        </div>
        <div class="count">×${s.count}</div>
        ${s.sick ? `<div class="sick" title="Summoning sick: arrived this turn (rule 302.6)">zzz</div>` : ""}
        ${countersHtml(s)}
        ${ptHtml(s)}
      </div>
    </div>
    <div class="actions">${actions}</div>
  </div>`;
}

export function renderBoard(state) {
  const wrap = $("#stacks");
  wrap.innerHTML = state.stacks.map(tileHtml).join("");
  $("#board-empty").hidden = state.stacks.length > 0;
  // uploaded art: resolve blob URLs after paint
  wrap.querySelectorAll(".art[data-blob]").forEach(async (el) => {
    const key = el.dataset.blob;
    const u = await blobUrl(key);
    if (u) { uploadUrls.set(key, u); if (!el.querySelector("img")) el.innerHTML = `<img src="${u}" alt="" />`; }
  });
  // artist credit: fill it in once per art id, quietly
  for (const s of state.stacks) {
    const a = s.art;
    if (a.kind === "scryfall" && a.id && !a.artist && !artistFetched.has(a.id)) {
      artistFetched.add(a.id);
      SF.card(a.id).then((c) => { if (c.artist) S.setArtQuiet(s.uid, { ...a, artist: c.artist, art_crop: c.art_crop || a.art_crop }); }).catch(() => {});
    }
  }
}

export function renderChrome(state) {
  $("#turn").textContent = `Turn ${state.turn}`;
  $("#btn-undo").disabled = !S.canUndo();
  $("#life").textContent = state.life;
  const mana = $("#mana");
  mana.innerHTML = ["W", "U", "B", "R", "G", "C"].map((c) =>
    `<button class="pip pip-${c.toLowerCase()} ${state.mana[c] ? "" : "zero"}" data-mana="${c}" aria-label="${COLOR_NAMES[c]} mana: ${state.mana[c]}. Tap to spend one, hold to add one.">${c === "C" ? "◇" : c}<span class="n">${state.mana[c]}</span></button>`).join("");
  const sum = S.summary();
  $("#summary").textContent = `Turn ${state.turn}${sum ? " · " + sum : ""}`;
}

// ---------------------------------------------------------------- board events
export function bindBoard() {
  const wrap = $("#stacks");
  let pressTimer = null, pressed = false, startX = 0, startY = 0, suppress = false;

  wrap.addEventListener("pointerdown", (e) => {
    const card = e.target.closest(".card"); if (!card) return;
    const uid = card.closest(".tile").dataset.uid;
    pressed = true; startX = e.clientX; startY = e.clientY; suppress = false;
    clearTimeout(pressTimer);
    pressTimer = setTimeout(() => { if (pressed) { suppress = true; pressed = false; stackMenu(uid); } }, 450);
  });
  const cancel = () => { pressed = false; clearTimeout(pressTimer); };
  wrap.addEventListener("pointermove", (e) => { if (pressed && Math.hypot(e.clientX - startX, e.clientY - startY) > 8) cancel(); });
  wrap.addEventListener("pointerup", cancel);
  wrap.addEventListener("pointercancel", cancel);
  wrap.addEventListener("pointerleave", cancel, true);
  wrap.addEventListener("contextmenu", (e) => { if (e.target.closest(".card")) e.preventDefault(); });

  wrap.addEventListener("click", (e) => {
    const tile = e.target.closest(".tile"); if (!tile) return;
    const uid = tile.dataset.uid;
    const btn = e.target.closest("[data-act]");
    if (btn) {
      const act = btn.dataset.act;
      if (act === "inc") S.incCount(uid, 1);
      else if (act === "dec") S.incCount(uid, -1);
      else if (act === "plus") S.addCounter(uid, "plus", 1);
      else if (act === "minus") S.addCounter(uid, "minus", 1);
      else if (act === "menu") stackMenu(uid);
      else if (act === "sac") sacrificeSheet(uid);
      return;
    }
    if (e.target.closest(".card")) {
      if (suppress) { suppress = false; return; }
      S.toggleTap(uid);
    }
  });
  wrap.addEventListener("keydown", (e) => {
    const card = e.target.closest(".card"); if (!card) return;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); S.toggleTap(card.closest(".tile").dataset.uid); }
  });
}

// hold-to-repeat helper for tray buttons: click = 1, hold = big
function holdable(el, onTap, onHold) {
  let timer = null, held = false;
  el.addEventListener("pointerdown", () => { held = false; clearTimeout(timer); timer = setTimeout(() => { held = true; onHold(); }, 500); });
  const stop = () => clearTimeout(timer);
  el.addEventListener("pointerup", stop); el.addEventListener("pointercancel", stop); el.addEventListener("pointerleave", stop);
  el.addEventListener("click", () => { if (held) { held = false; return; } onTap(); });
  el.addEventListener("contextmenu", (e) => e.preventDefault());
}

export function bindTray() {
  holdable($("#life-minus"), () => S.addLife(-1), () => S.addLife(-5));
  holdable($("#life-plus"), () => S.addLife(1), () => S.addLife(5));
  const mana = $("#mana");
  let timer = null, held = false, target = null;
  mana.addEventListener("pointerdown", (e) => {
    target = e.target.closest("[data-mana]"); if (!target) return;
    held = false; clearTimeout(timer);
    timer = setTimeout(() => { held = true; S.addMana(target.dataset.mana, 1); }, 500);
  });
  const stop = () => clearTimeout(timer);
  mana.addEventListener("pointerup", stop); mana.addEventListener("pointercancel", stop); mana.addEventListener("pointerleave", stop, true);
  mana.addEventListener("click", (e) => {
    const b = e.target.closest("[data-mana]"); if (!b) return;
    if (held) { held = false; return; }
    if (S.state.mana[b.dataset.mana] > 0) S.addMana(b.dataset.mana, -1);
    else toast(`No ${COLOR_NAMES[b.dataset.mana].toLowerCase()} mana. Hold the pip to add one.`);
  });
  mana.addEventListener("contextmenu", (e) => e.preventDefault());
}

// ---------------------------------------------------------------- stack menu
export function stackMenu(uid) {
  const s = S.find(uid); if (!s) return;
  const rem = reminderFor(s);
  const targets = S.mergeTargets(uid);
  const many = s.count > 1;
  const b = openSheet(`${s.name} ×${s.count}`, `
    <p class="note">${esc(s.type_line)}${s.base_power != null ? ` · ${esc(S.power(s))}/${esc(S.toughness(s))}` : ""}${s.tapped ? " · tapped" : ""}${s.sick ? " · summoning sick" : ""}</p>
    <div class="menu">
      <button class="btn" data-m="tap">${s.tapped ? "Untap" : "Tap"} all ${many ? s.count : ""}</button>
      ${many ? `<button class="btn" data-m="tapn">Tap some of them&hellip; <small>attack with N of ${s.count}</small></button>` : ""}
      ${many ? `<button class="btn" data-m="split">Split the stack&hellip;</button>` : ""}
      <button class="btn" data-m="dup">Duplicate as printed <small>no counters, untapped</small></button>
      ${(s.counters.plus || s.counters.minus || s.tapped || s.custom_counter) ? `<button class="btn" data-m="dup2">Duplicate exactly <small>counters and tapped state too</small></button>` : ""}
      <button class="btn" data-m="art">Choose art&hellip;</button>
      <button class="btn" data-m="edit">Edit&hellip;</button>
      <button class="btn" data-m="sac">${rem ? esc(rem.verb) : "Sacrifice"} one${rem ? ` <small>${esc(rem.effect)}</small>` : ""}</button>
      ${targets.length ? `<button class="btn" data-m="merge">Merge into another stack&hellip; <small>${targets.length} match${targets.length === 1 ? "" : "es"}</small></button>` : ""}
      <button class="btn" data-m="rm1">Remove one</button>
      ${many ? `<button class="btn btn-danger" data-m="rmall">Remove all ${s.count}</button>` : ""}
    </div>`);
  b.onclick = (e) => {
    const m = e.target.closest("[data-m]"); if (!m) return;
    const k = m.dataset.m;
    if (k === "tap") { S.toggleTap(uid); closeSheet(); }
    else if (k === "tapn") tapNSheet(uid);
    else if (k === "split") splitSheet(uid);
    else if (k === "dup") { S.duplicate(uid); closeSheet(); }
    else if (k === "dup2") { S.duplicate(uid, { withState: true }); closeSheet(); }
    else if (k === "art") artSheet(uid);
    else if (k === "edit") editSheet(uid);
    else if (k === "sac") sacrificeSheet(uid);
    else if (k === "merge") mergeSheet(uid);
    else if (k === "rm1") { S.remove(uid); closeSheet(); }
    else if (k === "rmall") confirmSheet("Remove all?", `Remove all ${s.count} ${s.name} tokens? Undo can bring them back.`, "Remove all", () => S.remove(uid, true));
  };
}

function sliderSheet({ title, intro, min, max, start, label, extras = [], confirm, onConfirm }) {
  const b = openSheet(title, `
    <p class="note">${intro}</p>
    <div class="big"><span id="sl-n">${start}</span></div>
    <input type="range" id="sl" min="${min}" max="${max}" value="${start}" step="1" aria-label="${esc(label)}" />
    <div class="row">${extras.map((x, i) => `<button class="btn grow" data-x="${i}">${esc(x.label)}</button>`).join("")}</div>
    <div id="sl-extra"></div>
    <div class="row"><button class="btn btn-primary btn-wide" id="sl-ok">${esc(confirm)}</button></div>`);
  const sl = $("#sl", b), n = $("#sl-n", b);
  const update = () => { n.textContent = sl.value; };
  sl.oninput = update;
  b.querySelectorAll("[data-x]").forEach((btn) => btn.onclick = () => { sl.value = extras[+btn.dataset.x].value(); update(); });
  $("#sl-ok", b).onclick = () => onConfirm(+sl.value, b);
  return b;
}

export function splitSheet(uid) {
  const s = S.find(uid); if (!s || s.count < 2) return;
  const b = sliderSheet({
    title: `Split ${s.name} ×${s.count}`, intro: "How many move to the new stack?",
    min: 1, max: s.count - 1, start: Math.floor(s.count / 2), label: "Number to move",
    extras: [{ label: "Half", value: () => Math.floor(s.count / 2) }, { label: "All but one", value: () => s.count - 1 }, { label: "Just one", value: () => 1 }],
    confirm: "Split", onConfirm: (k, body) => { S.split(uid, k, { tapMoved: $("#tapmoved", body).checked }); closeSheet(); },
  });
  $("#sl-extra", b).innerHTML = `<label class="row"><input type="checkbox" id="tapmoved" /> Tap the ones that move</label>`;
}

export function tapNSheet(uid) {
  const s = S.find(uid); if (!s) return;
  sliderSheet({
    title: `Tap some ${s.name}s`, intro: `Tap N of ${s.count}. The rest stay untapped as their own stack.`,
    min: 1, max: s.count, start: Math.max(1, Math.ceil(s.count / 2)), label: "Number to tap",
    extras: [{ label: "Half", value: () => Math.max(1, Math.floor(s.count / 2)) }, { label: "All but one", value: () => Math.max(1, s.count - 1) }, { label: "All", value: () => s.count }],
    confirm: "Tap them", onConfirm: (n) => { S.tapN(uid, n); closeSheet(); },
  });
}

export function mergeSheet(uid) {
  const s = S.find(uid); if (!s) return;
  const targets = S.mergeTargets(uid);
  const others = S.state.stacks.filter((o) => o !== s && o.name === s.name && !targets.includes(o));
  const b = openSheet(`Merge ${s.name} ×${s.count} into…`, `
    <div class="results">${targets.map((t) => `<button class="btn" data-t="${t.uid}">${esc(t.name)} ×${t.count}<span class="meta">${t.art.kind !== "none" ? "has art" : "no art"}</span></button>`).join("") || `<p class="note">No compatible stack.</p>`}</div>
    ${others.length ? `<div class="section-title">Can't merge with</div><div class="results">${others.map((o) => `<div class="note">${esc(o.name)} ×${o.count}: ${esc(S.whyIncompatible(s, o))}</div>`).join("")}</div>` : ""}`);
  b.onclick = (e) => { const t = e.target.closest("[data-t]"); if (!t) return; S.merge(uid, t.dataset.t); closeSheet(); };
}

// ---------------------------------------------------------------- sacrifice / use
export function sacrificeSheet(uid) {
  const s = S.find(uid); if (!s) return;
  const rem = reminderFor(s);
  if (!rem) {
    S.sacrifice(uid);
    toast(`Sacrificed one ${s.name}.${s.text ? " " + s.text : ""}`, s.text ? 4000 : 2000);
    closeSheet();
    return;
  }
  const manaButtons = (cols) => `<div class="picker">${cols.map((c) => `<button class="pip pip-${c.toLowerCase()}" data-mana="${c}" aria-label="Add one ${COLOR_NAMES[c].toLowerCase()} mana">${c === "C" ? "◇" : c}</button>`).join("")}</div>`;
  let action = "";
  if (rem.action === "mana") action = `<p>Which color?</p>${manaButtons(["W", "U", "B", "R", "G"])}<div class="row"><button class="btn grow" data-x="skip">Skip the mana</button></div>`;
  else if (rem.action === "colorless") action = `<div class="row"><button class="btn btn-primary grow" data-mana="C">Add {C} to the pool</button><button class="btn grow" data-x="skip">Skip the mana</button></div>`;
  else if (rem.action === "life") action = `<div class="row"><button class="btn btn-primary grow" data-x="life">Life +${rem.amount}</button><button class="btn grow" data-x="skip">Skip</button></div>`;
  else if (rem.action === "counter") {
    const creatures = S.state.stacks.filter((o) => o.is_creature);
    action = `<p>Put the +1/+1 counter on:</p><div class="results">${creatures.map((o) => `<button class="btn" data-plus="${o.uid}">${esc(o.name)} ×${o.count}<span class="meta">${esc(S.power(o))}/${esc(S.toughness(o))}</span></button>`).join("") || `<p class="note">No creature stacks.</p>`}</div><div class="row"><button class="btn grow" data-x="skip">Done</button></div>`;
  }
  else if (rem.action === "transform") action = `<div class="row"><button class="btn btn-primary grow" data-x="transform">Transform one</button><button class="btn grow" data-x="cancel">Cancel</button></div>`;
  else action = `<div class="row"><button class="btn btn-primary grow" data-x="skip">Done</button></div>`;

  const b = openSheet(`${rem.verb} ${s.name}`, `
    <div class="reminder"><span class="note">Cost: ${esc(rem.cost)}</span><b>${esc(rem.effect)}</b></div>
    ${action}`);
  const finish = () => {
    if (rem.keep) { if (rem.action !== "transform") S.setTapped(uid, true); }
    else S.sacrifice(uid);
  };
  b.onclick = (e) => {
    const m = e.target.closest("[data-mana]"); const x = e.target.closest("[data-x]"); const p = e.target.closest("[data-plus]");
    if (m) { S.batch(() => { S.addMana(m.dataset.mana, 1); finish(); }); closeSheet(); toast(`+1 ${COLOR_NAMES[m.dataset.mana].toLowerCase()} mana in the pool.`); }
    else if (p) { S.batch(() => { S.addCounter(p.dataset.plus, "plus", 1); finish(); }); closeSheet(); }
    else if (x) {
      const k = x.dataset.x;
      if (k === "life") { S.batch(() => { S.addLife(rem.amount); finish(); }); closeSheet(); toast(`Life +${rem.amount}.`); }
      else if (k === "transform") { S.transformIncubator(uid); closeSheet(); }
      else if (k === "cancel") closeSheet();
      else { finish(); closeSheet(); }
    }
  };
}

// ---------------------------------------------------------------- art
function galleryButton({ img, label, key, on }) {
  return `<button data-art="${esc(key)}" class="${on ? "on" : ""}" title="${esc(label)}">${img ? `<img src="${esc(img)}" alt="" loading="lazy" />` : `<div class="blank">No art</div>`}<div class="label">${esc(label)}</div></button>`;
}
export function artSheet(uid) {
  const s = S.find(uid); if (!s) return;
  const rec = s.catalog_id ? C.record(s.catalog_id) : null;
  const printings = rec ? rec.printings.filter((p) => p.id) : [];
  const featured = SF.FEATURED.filter((f) => f.forName === s.name);
  const cur = s.art;
  const b = openSheet(`Art for ${s.name}`, `
    <div class="gallery" id="g-top">
      ${galleryButton({ img: null, label: "Blank", key: "none", on: cur.kind === "none" })}
      ${featured.map((f, i) => `<button data-feat="${i}" title="${esc(f.label)}"><div class="blank">Featured ★</div><div class="label">${esc(f.label)}</div></button>`).join("")}
    </div>
    ${printings.length ? `<div class="section-title">Official printings <span class="note">(${printings.length})</span></div>
    <div class="gallery" id="g-cat">${printings.map((p) => galleryButton({ img: SF.imgUrl(p.id, "small"), label: `${p.set.toUpperCase()} #${p.cn}${p.artist ? " · " + p.artist : ""}`, key: p.id, on: cur.kind === "scryfall" && cur.id === p.id })).join("")}</div>` : ""}
    <div class="section-title">More</div>
    <div class="row">
      <button class="btn grow" id="g-more">Search Scryfall for other art</button>
      <label class="btn grow" style="display:flex;align-items:center;justify-content:center">Upload a photo<input type="file" accept="image/*" id="g-file" hidden /></label>
    </div>
    <div class="gallery" id="g-sf"></div>
    <p class="note" style="margin-top:12px">Card images © Wizards of the Coast, served by Scryfall. The illustrator is credited on the token.</p>`);

  const pickScryfall = (art) => { S.setArt(uid, { kind: "scryfall", ...art }); closeSheet(); };
  b.onclick = async (e) => {
    const a = e.target.closest("[data-art]"); const f = e.target.closest("[data-feat]");
    if (a) {
      const key = a.dataset.art;
      if (key === "none") { S.setArt(uid, { kind: "none" }); closeSheet(); return; }
      const p = printings.find((x) => x.id === key);
      if (p) pickScryfall({ id: p.id, set: p.set, artist: p.artist || null, art_crop: p.art_crop || null });
      else if (a.dataset.artist !== undefined) pickScryfall({ id: key, set: a.dataset.set, artist: a.dataset.artist || null, art_crop: a.dataset.crop || null });
    } else if (f) {
      const feat = featured[+f.dataset.feat];
      f.disabled = true; f.querySelector(".label").textContent = "Loading…";
      try { const c = await SF.cardByNumber(feat.set, feat.cn); pickScryfall({ id: c.id, set: c.set, artist: c.artist, art_crop: c.art_crop }); }
      catch { f.disabled = false; f.querySelector(".label").textContent = feat.label; toast("Couldn't reach Scryfall. Try again when online."); }
    }
  };
  $("#g-more", b).onclick = async () => {
    const btn = $("#g-more", b); btn.disabled = true; btn.textContent = "Searching…";
    try {
      const results = await SF.searchArt(s);
      const known = new Set(printings.map((p) => p.id));
      const extra = results.filter((r) => !known.has(r.id));
      $("#g-sf", b).innerHTML = extra.length
        ? extra.map((r) => `<button data-art="${esc(r.id)}" data-set="${esc(r.set)}" data-artist="${esc(r.artist || "")}" data-crop="${esc(r.art_crop || "")}" title="${esc(r.artist || "")}"><img src="${esc(r.small || SF.imgUrl(r.id, "small"))}" alt="" loading="lazy" /><div class="label">${esc(r.set.toUpperCase())}${r.artist ? " · " + esc(r.artist) : ""}</div></button>`).join("")
        : `<p class="note">Scryfall has no other art for this exact token.</p>`;
      btn.textContent = `Scryfall: ${results.length} illustration${results.length === 1 ? "" : "s"}`;
    } catch { btn.disabled = false; btn.textContent = "Search Scryfall for other art"; toast("Couldn't reach Scryfall. Try again when online."); }
  };
  $("#g-file", b).onchange = async (e) => {
    const file = e.target.files && e.target.files[0]; if (!file) return;
    try {
      const blob = await shrinkImage(file);
      const key = "u_" + Date.now().toString(36);
      await putBlob(key, blob);
      S.setArt(uid, { kind: "upload", blob_key: key });
      closeSheet();
    } catch { toast("Couldn't use that image."); }
  };
}

// ---------------------------------------------------------------- edit / custom
function parseTypeLine(tl) {
  const [left, right] = tl.split("—").map((x) => x.trim());
  const types = (left || "").replace(/^Token\s*/i, "").split(/\s+/).filter(Boolean);
  return { types, subtypes: right ? right.split(/\s+/).filter(Boolean) : [], is_creature: /creature/i.test(left || "") };
}
export function editSheet(uid) {
  const s = uid ? S.find(uid) : null;
  const v = s || { name: "", type_line: "Token Creature — ", base_power: "1", base_toughness: "1", colors: [], text: "", custom_counter: null };
  const b = openSheet(s ? `Edit ${s.name}` : "Custom token", `
    <div class="field"><label for="f-name">Name</label><input type="text" id="f-name" value="${esc(v.name)}" autocapitalize="words" /></div>
    <div class="field"><label for="f-type">Type line</label><input type="text" id="f-type" value="${esc(v.type_line)}" placeholder="Token Creature — Goblin" /></div>
    <div class="row">
      <div class="field grow"><label for="f-pow">Power</label><input type="text" id="f-pow" inputmode="numeric" value="${esc(v.base_power ?? "")}" placeholder="blank for none" /></div>
      <div class="field grow"><label for="f-tou">Toughness</label><input type="text" id="f-tou" inputmode="numeric" value="${esc(v.base_toughness ?? "")}" /></div>
    </div>
    <div class="field"><label>Colors</label><div class="colors">${["W", "U", "B", "R", "G"].map((c) => `<label class="pip-${c.toLowerCase()} ${v.colors.includes(c) ? "on" : ""}" title="${COLOR_NAMES[c]}"><input type="checkbox" name="col" value="${c}" ${v.colors.includes(c) ? "checked" : ""} />${c}</label>`).join("")}</div></div>
    <div class="field"><label for="f-text">Rules text</label><textarea id="f-text">${esc(v.text)}</textarea></div>
    <div class="row">
      <div class="field grow"><label for="f-cn">Custom counter (name)</label><input type="text" id="f-cn" value="${esc(v.custom_counter ? v.custom_counter.name : "")}" placeholder="e.g. oil, +1/+0, loyalty" /></div>
      <div class="field" style="width:90px"><label for="f-cv">Count</label><input type="number" id="f-cv" value="${v.custom_counter ? v.custom_counter.n : ""}" /></div>
    </div>
    <div class="row"><button class="btn btn-primary btn-wide" id="f-save">${s ? "Save" : "Create token"}</button></div>`);
  b.querySelectorAll(".colors input").forEach((i) => i.onchange = () => i.parentElement.classList.toggle("on", i.checked));
  $("#f-save", b).onclick = () => {
    const name = $("#f-name", b).value.trim(); if (!name) { $("#f-name", b).focus(); return; }
    let type_line = $("#f-type", b).value.trim() || "Token";
    if (/—\s*$/.test(type_line)) type_line = `${type_line} ${name}`;
    const pow = $("#f-pow", b).value.trim(), tou = $("#f-tou", b).value.trim();
    const colors = [...b.querySelectorAll(".colors input:checked")].map((i) => i.value);
    const text = $("#f-text", b).value.trim();
    const cn = $("#f-cn", b).value.trim(), cv = $("#f-cv", b).value;
    const parsed = parseTypeLine(type_line);
    const fields = { name, type_line, ...parsed, base_power: pow ? pow : null, base_toughness: tou ? tou : (pow ? "0" : null), colors, text };
    if (s) {
      S.edit(uid, { ...fields, custom_counter: cn ? { name: cn, n: cv === "" ? 0 : +cv } : null });
    } else {
      const st = S.addStack({ ...fields, catalog_id: null });
      if (cn) S.setCustomCounter(st.uid, cn, cv === "" ? 0 : +cv);
    }
    closeSheet();
  };
  if (!s) $("#f-name", b).focus();
}

// ---------------------------------------------------------------- any token (search)
export function searchSheet() {
  const b = openSheet("Any token", `
    <div class="search"><input type="search" id="q" placeholder="Name or creature type: saproling, mite, elemental…" autocomplete="off" autocapitalize="none" /></div>
    <div class="results" id="q-res"></div>
    <div class="row" id="q-more"></div>
    <div class="results" id="q-sf"></div>`);
  const q = $("#q", b), res = $("#q-res", b), more = $("#q-more", b), sf = $("#q-sf", b);
  const rowFor = (t) => `<button class="btn" data-cat="${esc(t.id)}"><span class="pip pip-${(t.colors.length === 1 ? t.colors[0] : t.colors.length ? "m" : "c").toLowerCase()}" style="width:28px;height:28px;font-size:12px;border-width:1px">${t.colors.length > 1 ? "M" : (t.colors[0] || "◇")}</span>${esc(t.name)}<span class="meta">${esc(t.type_line.replace(/^Token\s*/, ""))}${t.power != null ? ` · ${t.power}/${t.toughness}` : ""}</span></button>`;
  const run = () => {
    const list = C.search(q.value);
    res.innerHTML = list.map(rowFor).join("") || `<p class="note">Nothing in the built-in list.</p>`;
    more.innerHTML = q.value.trim() ? `<button class="btn grow" id="q-sfbtn">Search Scryfall for “${esc(q.value.trim())}”</button>` : "";
    sf.innerHTML = "";
    const btn = $("#q-sfbtn", more);
    if (btn) btn.onclick = async () => {
      btn.disabled = true; btn.textContent = "Searching Scryfall…";
      try {
        const cards = await SF.searchTokens(q.value.trim());
        sf.innerHTML = cards.slice(0, 30).map((c) => `<button class="btn" data-sf="${esc(c.id)}">${esc(c.name)}<span class="meta">${esc(c.type_line.replace(/^Token\s*/, ""))}${c.power != null ? ` · ${c.power}/${c.toughness}` : ""}</span></button>`).join("") || `<p class="note">No tokens on Scryfall for that.</p>`;
        sf._cards = cards;
        btn.textContent = `Scryfall: ${cards.length} result${cards.length === 1 ? "" : "s"}`;
      } catch { btn.disabled = false; btn.textContent = "Search Scryfall (couldn't connect, try again)"; }
    };
  };
  let deb = null;
  q.oninput = () => { clearTimeout(deb); deb = setTimeout(run, 150); };
  run();
  b.onclick = (e) => {
    const c = e.target.closest("[data-cat]"); const f = e.target.closest("[data-sf]");
    if (c) { S.addStack(C.toDef(C.record(c.dataset.cat))); closeSheet(); }
    else if (f) {
      const card = (sf._cards || []).find((x) => x.id === f.dataset.sf); if (!card) return;
      const parsed = parseTypeLine(card.type_line);
      S.addStack({ catalog_id: null, name: card.name, type_line: card.type_line, ...parsed, colors: card.colors, base_power: card.power, base_toughness: card.toughness, text: card.oracle_text },
        { art: { kind: "scryfall", id: card.id, set: card.set, artist: card.artist, art_crop: card.art_crop } });
      closeSheet();
    }
  };
  q.focus();
}

// ---------------------------------------------------------------- header menu / about / wake lock
let wakeLock = null;
export async function applyWake(on) {
  const prefs = loadPrefs(); prefs.wake = !!on; savePrefs(prefs);
  if (!("wakeLock" in navigator)) return false;
  try {
    if (on && !wakeLock) { wakeLock = await navigator.wakeLock.request("screen"); wakeLock.addEventListener("release", () => { wakeLock = null; }); }
    else if (!on && wakeLock) { await wakeLock.release(); wakeLock = null; }
    return true;
  } catch { return false; }
}
export function reapplyWake() { if (loadPrefs().wake && document.visibilityState === "visible") applyWake(true); }

export function moreMenu() {
  const prefs = loadPrefs();
  const b = openSheet("Token Table", `
    <div class="menu">
      <button class="btn" data-m="untap">Untap everything <small>keeps the turn</small></button>
      <button class="btn" data-m="clearmana">Empty the mana pool</button>
      <button class="btn" data-m="wake">${prefs.wake ? "Stop keeping" : "Keep"} the screen awake <small>${"wakeLock" in navigator ? "" : "not supported here"}</small></button>
      <button class="btn" data-m="about">About &amp; credits</button>
      <button class="btn btn-danger" data-m="new">New game&hellip;</button>
    </div>`);
  b.onclick = async (e) => {
    const m = e.target.closest("[data-m]"); if (!m) return;
    const k = m.dataset.m;
    if (k === "untap") { S.untapAll(); closeSheet(); }
    else if (k === "clearmana") { S.clearMana(); closeSheet(); }
    else if (k === "wake") { const ok = await applyWake(!prefs.wake); closeSheet(); toast(ok ? (prefs.wake ? "Screen may sleep again." : "Screen will stay awake while this page is open.") : "Wake lock isn't available in this browser."); }
    else if (k === "about") aboutSheet();
    else if (k === "new") confirmSheet("New game?", "This clears every token, the mana pool and life. It cannot be undone.", "Start new game", () => { S.newGame(); toast("New game."); });
  };
}

export function aboutSheet() {
  const meta = C.catalogMeta();
  openSheet("About Token Table", `<div class="about">
    <p><b>How to use it.</b> Tap a name to make a token. Tap the card to tap or untap it. Hold the card (or press ⋯) for split, duplicate, art, edit and sacrifice. “Next turn” untaps everything and clears summoning sickness. Hold the life buttons for ±5; hold a mana pip to add one, tap it to spend one.</p>
    <p><b>What it knows.</b> ${meta ? meta.count : "—"} kinds of token from the community-maintained Cockatrice Magic-Token list (version ${meta ? esc(meta.version) : "—"}), with their usual power, toughness, colour and rules text. Treasure, Food, Clue and the other predefined tokens follow Comprehensive Rules 111.10.</p>
    <p><b>Where it keeps things.</b> Only on this device. Nothing is sent anywhere except requests to Scryfall for card art and artist names.</p>
    <p class="note">Token Table is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. © Wizards of the Coast LLC.</p>
    <p class="note">Card images and data courtesy of Scryfall (scryfall.com). Token definitions from the Cockatrice Magic-Token project. Rules text from the Magic: The Gathering Comprehensive Rules. Artwork is credited to its illustrator wherever shown.</p>
    <p class="note">Part of <a href="/">amesgrawert.com</a>. Built with Claude Code.</p>
  </div>`);
}

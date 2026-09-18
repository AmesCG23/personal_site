// Smoke test for Token Table. Runs the worked scenario from docs/mtg-tokens/HANDOFF.md §11
// in headless Chromium at phone and tablet sizes, with Scryfall stubbed out.
//   node sandbox/tests/smoke.mjs [baseUrl]
// Requires a static server for the repo root (default http://127.0.0.1:8123).
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium, devices } = pw;
import { mkdirSync } from "node:fs";

const base = process.argv[2] || "http://127.0.0.1:8123";
const out = process.env.SHOTS || "/tmp/claude-0/-home-user-personal-site/258c768c-bf58-5a8b-8b56-dd7c24c97abe/scratchpad/shots";
mkdirSync(out, { recursive: true });
let failures = 0;
const check = (cond, msg) => { if (cond) console.log("  ok   " + msg); else { failures++; console.log("  FAIL " + msg); } };

// 1x1 red JPEG for any image request
const JPG = Buffer.from("/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=", "base64");
const fakeCard = (id, name, artist, extra = {}) => ({ object: "card", id, name, artist, set: "sld", set_name: "Secret Lair Drop", collector_number: "2421", released_at: "2026-05-18", type_line: "Token Creature — Goblin", oracle_text: "", power: "1", toughness: "1", colors: ["R"], image_uris: { small: "https://cards.scryfall.io/small/x.jpg", normal: "https://cards.scryfall.io/normal/x.jpg", art_crop: "https://cards.scryfall.io/art_crop/x.jpg" }, ...extra });

async function stub(page) {
  await page.route("https://cards.scryfall.io/**", (r) => r.fulfill({ body: JPG, contentType: "image/jpeg" }));
  await page.route("https://api.scryfall.com/**", (r) => {
    const u = r.request().url();
    if (u.includes("/cards/sld/2421")) return r.fulfill({ json: fakeCard("feat-0001", "Goblin", "Wizard of Barge") });
    if (u.includes("/cards/search")) return r.fulfill({ json: { object: "list", total_cards: 1, has_more: false, data: [fakeCard("srch-0001", "Goblin", "Some Artist")] } });
    const m = u.match(/\/cards\/([0-9a-f-]{36})$/);
    if (m) return r.fulfill({ json: fakeCard(m[1], "Goblin", "Catalog Artist") });
    return r.fulfill({ status: 404, json: { object: "error", code: "not_found" } });
  });
}

const browser = await chromium.launch();
try {
  // ---------- scenario on an iPhone ----------
  const ctx = await browser.newContext({ ...devices["iPhone 15"], locale: "en-US" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await stub(page);
  await page.goto(base + "/sandbox/", { waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__tt && document.querySelectorAll("#palette-chips .chip").length > 0);
  console.log("scenario (iPhone 15)");
  check((await page.locator("#palette-chips .chip").count()) === 16, "palette shows 16 quick tokens");

  const chip = (name) => page.locator(`#palette-chips .chip`, { hasText: new RegExp(`^${name}`) }).first();
  await chip("Goblin").click();
  for (let i = 0; i < 11; i++) await page.locator('.tile [data-act="inc"]').first().click();
  check((await page.locator(".tile").count()) === 1, "one stack after 12 goblins");
  check((await page.locator(".tile .count").first().textContent()) === "×12", "count reads ×12");
  check((await page.locator(".tile .pt").first().textContent()) === "1/1", "P/T reads 1/1");
  check((await page.locator(".tile .sick").count()) === 1, "summoning sick badge shown");
  check((await page.locator(".tile .card.c-r").count()) === 1, "red frame");

  await page.click("#btn-next");
  check((await page.locator(".tile .sick").count()) === 0, "next turn clears sickness");
  check((await page.locator("#turn").textContent()) === "Turn 2", "turn 2");

  await page.locator('.tile [data-act="menu"]').first().click();
  await page.locator('[data-m="tapn"]').click();
  await page.locator("#sl").fill("7");
  await page.locator("#sl-ok").click();
  check((await page.locator(".tile").count()) === 2, "tap 7 of 12 → two stacks");
  check((await page.locator(".tile.tapped .count").textContent()) === "×7", "tapped stack ×7");
  check((await page.locator(".tile:not(.tapped) .count").textContent()) === "×5", "untapped stack ×5");

  const tapped = page.locator(".tile.tapped");
  await tapped.locator('[data-act="plus"]').click();
  await tapped.locator('[data-act="plus"]').click();
  check((await tapped.locator(".pt").textContent()) === "3/3", "+1/+1 twice → 3/3");
  check((await page.locator(".tile:not(.tapped) .pt").textContent()) === "1/1", "other stack still 1/1");
  await tapped.locator('[data-act="minus"]').click();
  check((await tapped.locator(".pt").textContent()) === "2/2" && (await tapped.locator(".counters").textContent()).includes("+1/+1 ×1"), "−1/−1 cancels one (704.5q)");
  await tapped.locator('[data-act="plus"]').click();

  await chip("Treasure").click(); await chip("Treasure").click(); await chip("Treasure").click();
  const treasure = page.locator(".tile", { hasText: "Treasure" });
  check((await treasure.locator(".count").textContent()) === "×3", "three Treasures stack");
  await treasure.locator('[data-act="sac"]').click();
  check((await page.locator("#sheet-title").textContent()) === "Sacrifice Treasure", "Treasure reminder opens");
  await page.locator('#sheet [data-mana="R"]').click();
  check((await treasure.locator(".count").textContent()) === "×2", "Treasure ×2 after sacrifice");
  check((await page.locator('#mana [data-mana="R"] .n').textContent()) === "1", "red mana 1 in tray");

  await chip("Food").click();
  const food = page.locator(".tile", { hasText: "Food" });
  await food.locator('[data-act="sac"]').click();
  check((await page.locator("#sheet .reminder").textContent()).includes("{2}, {T}") && (await page.locator("#sheet .reminder").textContent()).includes("gain 3 life"), "Food reminder shows cost and effect");
  await page.locator('#sheet [data-x="life"]').click();
  check((await page.locator("#life").textContent()) === "43", "life 43");
  check((await page.locator(".tile", { hasText: "Food" }).count()) === 0, "Food gone");

  await page.click("#btn-undo");
  check((await page.locator("#life").textContent()) === "40", "one undo → life 40 and Food back");
  check((await page.locator(".tile", { hasText: "Food" }).count()) === 1, "undo → Food back");
  await page.click("#btn-undo"); await page.click("#btn-undo");
  check((await page.locator(".tile", { hasText: "Food" }).count()) === 0, "undo → Food never made");
  check((await treasure.locator(".count").textContent()) === "×3", "undo → Treasure ×3");
  check((await page.locator('#mana [data-mana="R"]').getAttribute("class")).includes("zero"), "undo → red mana 0");

  // art: featured
  await tapped.locator('[data-act="menu"]').click();
  await page.locator('[data-m="art"]').click();
  check((await page.locator("#g-cat button").count()) > 30, "gallery lists catalog printings");
  await page.locator("[data-feat]").click();
  await page.waitForSelector("#sheet[hidden]", { state: "attached" });
  check((await tapped.locator(".credit").textContent()).includes("Wizard of Barge"), "featured art credited to Wizard of Barge");
  check((await tapped.locator(".art img").count()) === 1, "art image on card");

  // merge refused while counters differ, then allowed
  const untapped = page.locator(".tile", { hasText: "Goblin" }).filter({ hasText: "×5" });
  await page.click("#btn-next");
  await untapped.locator('[data-act="menu"]').click();
  check((await page.locator('[data-m="merge"]').count()) === 0, "merge not offered while counters differ");
  await page.locator("#sheet-close").click();
  const big = page.locator(".tile", { hasText: "Goblin" }).filter({ hasText: "×7" });
  await big.locator('[data-act="minus"]').click(); await big.locator('[data-act="minus"]').click();
  await untapped.locator('[data-act="menu"]').click();
  await page.locator('[data-m="merge"]').click();
  await page.locator("#sheet [data-t]").first().click();
  check((await page.locator(".tile", { hasText: "Goblin" }).count()) === 1 && (await page.locator(".tile", { hasText: "Goblin" }).locator(".count").textContent()) === "×12", "merged back to ×12");

  // split with tap-moved
  await page.locator(".tile", { hasText: "Goblin" }).locator('[data-act="menu"]').click();
  await page.locator('[data-m="split"]').click();
  await page.locator("#sl").fill("4"); await page.locator("#tapmoved").check(); await page.locator("#sl-ok").click();
  check((await page.locator(".tile.tapped .count").textContent()) === "×4", "split 4, tapped");

  // custom token, any-token search, sacrifice of a plain creature
  await page.click("#btn-any");
  await page.locator("#q").fill("mite");
  await page.waitForTimeout(250);
  await page.locator('#q-res [data-cat]').first().click();
  check((await page.locator(".tile", { hasText: "Phyrexian Mite" }).count()) === 1, "search → Phyrexian Mite");
  await page.click("#btn-custom");
  await page.locator("#f-name").fill("Shrimp"); await page.locator("#f-pow").fill("3"); await page.locator("#f-tou").fill("3");
  await page.locator(".colors label.pip-u").click();
  await page.locator("#f-save").click();
  const shrimp = page.locator(".tile", { hasText: "Shrimp" });
  check((await shrimp.count()) === 1 && (await shrimp.locator(".pt").textContent()) === "3/3" && (await shrimp.locator(".card.c-u").count()) === 1, "custom Shrimp 3/3 blue");

  // persistence
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => window.__tt);
  check((await page.locator(".tile").count()) === 5, "board restored after reload (5 stacks)");
  check((await page.locator(".tile", { hasText: "Goblin" }).first().locator(".credit").textContent()).includes("Wizard of Barge"), "art survives reload");

  // layout checks
  const noHScroll = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  check(noHScroll, "no horizontal scroll on iPhone");
  const small = await page.evaluate(() => [...document.querySelectorAll("button:not([hidden])")].filter((b) => { const r = b.getBoundingClientRect(); return r.width > 0 && (r.width < 44 || r.height < 44); }).map((b) => b.className + ":" + (b.textContent || "").trim().slice(0, 12)));
  check(small.length === 0, "all visible buttons ≥ 44px" + (small.length ? " — small: " + small.join(", ") : ""));
  await page.screenshot({ path: `${out}/iphone15-portrait.png`, fullPage: false });
  await page.locator(".tile", { hasText: "Goblin" }).first().locator('[data-act="menu"]').click();
  await page.screenshot({ path: `${out}/iphone15-menu.png` });
  await page.locator("#sheet-close").click();
  check(errors.length === 0, "no console errors" + (errors.length ? ": " + errors.join(" | ") : ""));
  await ctx.close();

  // ---------- other sizes: screenshots + overflow check ----------
  for (const [label, opts] of [
    ["iphone-se", { viewport: { width: 375, height: 667 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ["ipad-portrait", { viewport: { width: 820, height: 1180 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
    ["ipad-landscape", { viewport: { width: 1180, height: 820 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }],
  ]) {
    const c = await browser.newContext(opts); const p = await c.newPage(); await stub(p);
    await p.goto(base + "/sandbox/", { waitUntil: "networkidle" });
    await p.waitForFunction(() => window.__tt);
    await p.evaluate(() => {
      const { S, C } = window.__tt;
      const g = S.addStack(C.toDef(C.defaultFor("Goblin")), { count: 12 }); S.tapN(g.uid, 7);
      S.addStack(C.toDef(C.defaultFor("Treasure")), { count: 3 }); S.addStack(C.toDef(C.defaultFor("Angel")));
      S.addStack(C.toDef(C.defaultFor("Zombie")), { count: 4 }); S.addStack(C.toDef(C.defaultFor("Food")));
      S.addStack(C.toDef(C.defaultFor("Spirit")), { count: 2 });
    });
    await p.waitForTimeout(100);
    const ok = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    check(ok, `no horizontal scroll on ${label}`);
    await p.screenshot({ path: `${out}/${label}.png` });
    await c.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} FAILURE(S)` : "\nALL PASSED");
process.exit(failures ? 1 : 0);

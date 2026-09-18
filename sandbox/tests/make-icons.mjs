// Renders sandbox/icons/icon.svg to the PNG sizes the manifest and iOS need.
//   node sandbox/tests/make-icons.mjs
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let pw; try { pw = require("playwright"); } catch { pw = require("/opt/node22/lib/node_modules/playwright"); }
const { chromium } = pw;
import { readFileSync } from "node:fs";
const svg = readFileSync(new URL("../icons/icon.svg", import.meta.url), "utf8");
const browser = await chromium.launch();
for (const size of [180, 192, 512]) {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<html><body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body></html>`);
  await page.screenshot({ path: new URL(`../icons/icon-${size}.png`, import.meta.url).pathname, omitBackground: false });
  await page.close();
}
await browser.close();
console.log("icons written");

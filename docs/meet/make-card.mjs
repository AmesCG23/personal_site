// Renders Meet's link-preview image (what shows when a poll link is pasted into Messages)
// to meet/img/social-card.jpg, 1200 x 630.   node docs/meet/make-card.mjs
// Art: "Hanna" (Vanguard, 1997) by Liz Danforth, © Wizards of the Coast, used under the
// Fan Content Policy. Keep the credit line on the card.
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }

const here = (p) => new URL(p, import.meta.url);
const art = 'data:image/webp;base64,' + readFileSync(here('card-art-hanna.webp')).toString('base64');
const icon = 'data:image/svg+xml;base64,' + readFileSync(here('../../meet/icons/icon.svg')).toString('base64');

const html = `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@500;600&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;1,8..60,400&display=block" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; display: flex; background: #f3ede1; color: #1a1814; font-family: 'Source Serif 4', Georgia, serif; }
  .art { width: 690px; height: 630px; overflow: hidden; border-right: 3px solid #1a1814; }
  .art img { width: 100%; height: 100%; object-fit: cover; object-position: 38% 50%; display: block; }
  .text { flex: 1; padding: 64px 56px 36px; display: flex; flex-direction: column; }
  .icon { width: 90px; height: 90px; image-rendering: pixelated; margin-left: -6px; }
  .eyebrow { margin-top: 30px; font-size: 18px; letter-spacing: .22em; text-transform: uppercase; color: #5e564a; }
  h1 { font-family: 'Cormorant Garamond', serif; font-weight: 500; font-size: 92px; line-height: .95; letter-spacing: -.02em; margin-top: 10px; }
  .sub { font-size: 27px; font-style: italic; color: #5e564a; margin-top: 18px; line-height: 1.3; }
  .credit { margin-top: auto; font-size: 14px; color: #5e564a; line-height: 1.4; }
</style></head><body>
  <div class="art"><img src="${art}"></div>
  <div class="text">
    <img class="icon" src="${icon}">
    <div class="eyebrow">Meet</div>
    <h1>Pick a time</h1>
    <p class="sub">Tap the times that work for you.</p>
    <p class="credit">Art: <i>Hanna</i> by Liz Danforth.<br>Magic: The Gathering © Wizards of the Coast.</p>
  </div>
</body></html>`;

const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'networkidle' });
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: here('../../meet/img/social-card.jpg').pathname, type: 'jpeg', quality: 86 });
await browser.close();
console.log('wrote meet/img/social-card.jpg');

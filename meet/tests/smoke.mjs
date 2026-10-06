// End-to-end check of Meet in headless Chromium, with the real Sheet script running
// against a pretend Sheet (fake-apps-script.mjs) in place of Google.
//   python3 -m http.server 8123 --bind 127.0.0.1   # from the repo root
//   node meet/tests/smoke.mjs [baseUrl]
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { makeBackend } from './fake-apps-script.mjs';
const require = createRequire(import.meta.url);
let pw; try { pw = require('playwright'); } catch { pw = require('/opt/node22/lib/node_modules/playwright'); }
const { chromium, devices } = pw;

const base = process.argv[2] || 'http://127.0.0.1:8123';
const out = process.env.SHOTS || join(tmpdir(), 'meet-shots/');
mkdirSync(out, { recursive: true });
let failures = 0;
const check = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } };

const FAKE = 'https://script.google.com/macros/s/FAKE/exec';
const backend = makeBackend({ passcode: 'tuesday' });

async function wire(ctx) {
  await ctx.route('**/meet/js/config.js', (r) => r.fulfill({ contentType: 'text/javascript', body: `export const API_URL = '${FAKE}';` }));
  await ctx.route(FAKE, async (r) => {
    await new Promise((res) => setTimeout(res, 150)); // Apps Script is never instant
    r.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(backend.post(r.request().postData())) });
  });
}
function watch(page, errors) {
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|fonts\.g/.test(m.text())) errors.push(m.text()); });
}
async function layout(page, label) {
  const r = await page.evaluate(() => {
    const small = [...document.querySelectorAll('button, .btn, input:not([type=hidden]), a.btn')]
      .filter((el) => el.offsetParent && !el.closest('.link-inline'))
      .map((el) => ({ el: el.textContent.trim() || el.getAttribute('aria-label') || el.type, h: el.getBoundingClientRect().height }))
      .filter((x) => x.h < 43.5);
    const stray = [...document.querySelectorAll('main, main *')].flatMap((el) => [...el.childNodes])
      .filter((n) => n.nodeType === 3 && /^(false|true|undefined|null|NaN|0)$|false|undefined/.test(n.textContent.trim()))
      .map((n) => n.textContent.trim());
    return { overflow: document.documentElement.scrollWidth - innerWidth, small, stray };
  });
  check(r.stray.length === 0, `${label}: no stray placeholder text` + (r.stray.length ? ' ' + JSON.stringify(r.stray) : ''));
  check(r.overflow <= 0, `${label}: no sideways scrolling`);
  check(r.small.length === 0, `${label}: tap targets ≥ 44px` + (r.small.length ? ' ' + JSON.stringify(r.small) : ''));
}

const browser = await chromium.launch();
try {
  // ---------- Organizer makes a poll on a phone ----------
  console.log('organizer (iPhone 15)');
  const orgCtx = await browser.newContext({ ...devices['iPhone 15'], locale: 'en-US', timezoneId: 'America/New_York', acceptDownloads: true });
  await wire(orgCtx);
  const org = await orgCtx.newPage();
  const orgErrors = []; watch(org, orgErrors);

  // Not set up yet: the real config.js is empty
  const bare = await browser.newPage();
  await bare.goto(base + '/meet/');
  await bare.waitForSelector('.notice');
  check((await bare.textContent('.notice')).includes('Not connected yet'), 'unconfigured page says so instead of failing');
  await bare.close();

  await org.goto(base + '/meet/', { waitUntil: 'networkidle' });
  check(await org.isVisible('form.create'), 'new-poll form shows');
  check((await org.getAttribute('meta[name=robots]', 'content')).includes('noindex'), 'page tells search engines to stay away');
  await layout(org, 'home (phone)');

  await org.click('form.create .btn-primary');
  check((await org.textContent('.create .form-msg')).includes('title'), 'title is required');
  await org.fill('input[name=title]', 'Game night');
  await org.fill('input[name=location]', 'My place');
  await org.fill('textarea[name=notes]', 'Bring a deck.\nPizza provided.');
  const row = (i) => org.locator('.time-row').nth(i);
  await row(0).locator('input[type=date]').fill('2026-10-16');
  await row(0).locator('input[type=time]').nth(0).fill('19:00');
  await row(0).locator('input[type=time]').nth(1).fill('22:00');
  await org.click('text=+ Add a time');
  check(await row(1).locator('input[type=date]').inputValue() === '2026-10-17', 'added time defaults to the next day');
  check(await row(1).locator('input[type=time]').nth(0).inputValue() === '19:00', '…with the same hours');
  await org.click('text=+ Add a time');
  await row(2).locator('input[type=date]').fill('2026-10-18');
  await row(2).locator('input[type=time]').nth(0).fill('');
  await row(2).locator('input[type=time]').nth(1).fill('');
  await layout(org, 'form filled (phone)');
  await org.screenshot({ path: out + 'meet-create-phone.png', fullPage: true });

  await org.click('form.create .btn-primary');
  await org.waitForSelector('input[name=passcode]:visible');
  const pmsg = await org.textContent('.create .form-msg'); check(pmsg.includes('passcode'), 'asks for the passcode' + ' [' + pmsg + ']');
  await org.fill('input[name=passcode]', 'tuesday');
  await org.click('form.create .btn-primary');
  await org.waitForSelector('.admin');
  const adminUrl = org.url();
  check(/\?e=[a-p]{10}&k=[a-p]{24}$/.test(adminUrl), 'lands on the organizer view (new=1 tidied out of the address)');
  check((await org.textContent('.admin h2')) === 'Your poll is ready', 'says the poll is ready');
  const shareUrl = await org.inputValue('.share-url');
  check(/\?e=[a-p]{10}$/.test(shareUrl) && !shareUrl.includes('k='), 'share link has no admin key');
  check((await org.locator('.opt').count()) === 3, 'three times listed');
  check((await org.locator('.opt-date').first().textContent()) === 'Fri, Oct 16' && (await org.locator('.opt-time').first().textContent()) === '7–10 pm', 'times read naturally');
  check((await org.locator('.opt-time').nth(2).textContent()) === 'Any time', 'blank start = any time');
  check((await org.textContent('.details .notes')).includes('Pizza'), 'notes shown');
  await layout(org, 'organizer view (phone)');
  await org.screenshot({ path: out + 'meet-admin-new-phone.png', fullPage: true });

  // Organizer answers too
  await org.fill('#name', 'Ames');
  await org.locator('.opt').nth(0).locator('[data-answer=yes]').click();
  await org.locator('.opt').nth(1).locator('[data-answer=maybe]').click();
  await org.locator('.savebar .btn-primary').click();
  await org.waitForSelector('.people li');
  check((await org.locator('.people li').count()) === 1, 'organizer’s own answer saved');
  check(await org.isVisible('.admin'), 'still in organizer view after answering');

  // ---------- A friend on another phone ----------
  console.log('friend (iPhone SE)');
  const friendCtx = await browser.newContext({ ...devices['iPhone SE'], locale: 'en-US' });
  await wire(friendCtx);
  const fr = await friendCtx.newPage();
  const frErrors = []; watch(fr, frErrors);
  await fr.goto(shareUrl, { waitUntil: 'networkidle' });
  await fr.waitForSelector('.opts');
  check(!(await fr.isVisible('.admin')) && (await fr.locator('text=Choose this time').count()) === 0, 'friend sees no organizer tools');
  check((await fr.textContent('.opt.best .opt-date')) === 'Fri, Oct 16', '“best so far” marks the leading time');
  await layout(fr, 'poll (small phone)');

  await fr.click('.savebar .btn-primary');
  check((await fr.textContent('.savebar .form-msg')).includes('name'), 'name is required');
  await fr.fill('#name', 'Jo');
  const yes0 = fr.locator('.opt').nth(0).locator('[data-answer=yes]');
  await yes0.click();
  check((await yes0.getAttribute('aria-pressed')) === 'true', 'tapping Yes selects it');
  await yes0.click();
  check((await yes0.getAttribute('aria-pressed')) === 'false', 'tapping again clears it');
  await fr.locator('.opt').nth(1).locator('[data-answer=yes]').click();
  await fr.locator('.opt').nth(2).locator('[data-answer=yes]').click();
  await layout(fr, 'answers picked (small phone)');
  await fr.screenshot({ path: out + 'meet-friend-phone.png', fullPage: true });
  await fr.click('.savebar .btn-primary');
  await fr.waitForSelector('.flash.show');
  check((await fr.locator('.people li').count()) === 2, 'friend’s answer saved');
  check((await fr.locator('.savebar .btn-primary').textContent()) === 'Update my answers', 'button becomes “Update”');
  check((await fr.locator('.opt').nth(1).locator('.tally').textContent()) === '1 yes · 1 if need be · 0 no', 'tallies count everyone');

  // Comes back later: answers remembered, can change them
  await fr.reload({ waitUntil: 'networkidle' });
  await fr.waitForSelector('.opts');
  check((await fr.inputValue('#name')) === 'Jo', 'name remembered on this device');
  check((await fr.locator('.opt').nth(2).locator('[data-answer=yes]').getAttribute('aria-pressed')) === 'true', 'earlier answers pre-filled');
  await fr.locator('.opt').nth(2).locator('[data-answer=no]').click();
  await fr.click('.savebar .btn-primary');
  await fr.waitForSelector('.flash.show');
  check((await fr.locator('.people li').count()) === 2, 'updating doesn’t duplicate');

  // Someone else types an existing name
  console.log('name clash (desktop)');
  const deskCtx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'en-US' });
  await wire(deskCtx);
  const dk = await deskCtx.newPage();
  const dkErrors = []; watch(dk, dkErrors);
  await dk.goto(shareUrl, { waitUntil: 'networkidle' });
  await dk.waitForSelector('.opts');
  await dk.fill('#name', 'jo');
  await dk.click('.savebar .btn-primary');
  await dk.waitForSelector('text=Is that you?');
  check(true, 'asks “Is that you?” on a name clash');
  await dk.click('text=No — I’ll change my name');
  await dk.fill('#name', 'Jo B.');
  await dk.locator('.opt').nth(0).locator('[data-answer=yes]').click();
  await dk.click('.savebar .btn-primary');
  await dk.waitForSelector('.flash.show');
  check((await dk.locator('.people li').count()) === 3, 'different name saves as a new person');
  await layout(dk, 'poll (desktop)');
  await dk.screenshot({ path: out + 'meet-desktop.png', fullPage: true });

  // ---------- Organizer closes and picks the time ----------
  console.log('organizer wraps up');
  await org.reload({ waitUntil: 'networkidle' });
  await org.waitForSelector('.admin');
  await org.click('text=Close the poll');
  await org.waitForSelector('text=Reopen the poll');
  check(!(await org.isVisible('.savebar')), 'closed poll hides the answer buttons');
  org.once('dialog', (d) => d.accept());
  await org.locator('.people li', { hasText: 'Jo B.' }).locator('button').click();
  await org.waitForFunction(() => document.querySelectorAll('.people li').length === 2);
  check(true, 'organizer removes an answer');
  await org.locator('.opt').nth(1).locator('text=Choose this time').click();
  await org.waitForSelector('.final');
  check((await org.textContent('.final-when')).includes('Sat, Oct 17'), 'final time announced');
  const dl = org.waitForEvent('download');
  await org.click('.final >> text=Add to calendar');
  const ics = readFileSync(await (await dl).path(), 'utf8');
  check(ics.includes('DTSTART:20261017T190000') && ics.includes('DTEND:20261017T220000') && ics.includes('SUMMARY:Game night') && ics.includes('LOCATION:My place'), 'calendar file has the right time and place');
  const gcal = await org.getAttribute('.final a', 'href');
  check(gcal.startsWith('https://calendar.google.com/') && gcal.includes('20261017T190000%2F20261017T220000'), 'Google Calendar link built');
  await layout(org, 'chosen time (phone)');
  await org.screenshot({ path: out + 'meet-final-phone.png', fullPage: true });

  await fr.reload({ waitUntil: 'networkidle' });
  await fr.waitForSelector('.final');
  check(await fr.isVisible('.final') && (await fr.locator('.choice').count()) === 0, 'friends see the chosen time, poll closed');

  await org.goto(base + '/meet/', { waitUntil: 'networkidle' });
  check((await org.locator('.mine a', { hasText: 'Game night' }).count()) === 1, 'home lists polls made on this device');
  check((await org.getAttribute('.mine a', 'href')) === adminUrl, '…linking to the organizer view');

  await fr.goto(base + '/meet/?e=abcdefghij', { waitUntil: 'networkidle' });
  await fr.waitForSelector('h1');
  check((await fr.textContent('h1')) === 'No poll here', 'bad link handled');

  check(backend.sheets.Responses.rows.length === 1 + 2 * 3, 'Sheet holds 2 people × 3 times');

  for (const [who, errs] of [['organizer', orgErrors], ['friend', frErrors], ['desktop', dkErrors]]) check(errs.length === 0, `no script errors (${who})` + (errs.length ? ' ' + errs.join(' | ') : ''));
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);

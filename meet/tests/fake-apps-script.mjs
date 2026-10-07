// Runs docs/meet/Code.gs in Node against a pretend Google Sheet, so the page and the
// Sheet script can be tested together without a Google account.
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import vm from 'node:vm';

const CODE = readFileSync(new URL('../../docs/meet/Code.gs', import.meta.url), 'utf8');

// Cells are plain text (the script formats new tabs that way); a leading apostrophe
// before = + - @ is Google's "treat as text" marker and isn't kept, like the real thing.
const store = (v) => (typeof v === 'string' && /^'[=+\-@]/.test(v) ? v.slice(1) : v);

class Sheet {
  constructor(name) { this.name = name; this.rows = []; this.formats = []; }
  getMaxRows() { return 1000; }
  getLastRow() { return this.rows.length; }
  setFrozenRows() {}
  appendRow(r) { this.rows.push(r.map(store)); }
  deleteRow(n) { this.rows.splice(n - 1, 1); }
  getDataRange() { const rows = this.rows; return { getValues: () => rows.map((r) => r.slice()) }; }
  getRange(row, col, nr = 1, nc = 1) {
    const sh = this;
    const range = {
      setValues(vals) {
        if (vals.length !== nr || vals.some((v) => v.length !== nc)) throw new Error('setValues: size mismatch');
        vals.forEach((v, i) => { while (sh.rows.length < row + i) sh.rows.push([]); v.forEach((x, j) => { sh.rows[row - 1 + i][col - 1 + j] = store(x); }); });
        return range;
      },
      setValue(v) { return range.setValues([[v]]); },
      setFontWeight() { return range; },
      setNumberFormat(f) { sh.formats.push(f); return range; },
    };
    return range;
  }
}

export function makeBackend({ passcode = '', notify = '' } = {}) {
  const sheets = {};
  const sent = [];
  const ss = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => (sheets[n] = new Sheet(n)),
  };
  const ctx = vm.createContext({
    SpreadsheetApp: { getActiveSpreadsheet: () => ss },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    Utilities: {
      getUuid: () => randomUUID(),
      formatDate: (d) => d.toISOString().replace('T', ' ').slice(0, 19),
    },
    Session: { getScriptTimeZone: () => 'America/New_York' },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ text: s, setMimeType() { return this; } }) },
    MailApp: { sendEmail: (to, subject, body) => sent.push({ to, subject, body }) },
    JSON, Date, String, Object, Array, Error, parseInt,
  });
  vm.runInContext(CODE, ctx);
  ctx.CREATE_PASSCODE = passcode;
  ctx.NOTIFY_EMAIL = notify;
  return {
    sheets, sent,
    post: (body) => JSON.parse(ctx.doPost({ postData: { contents: body } }).text),
    getStatus: () => JSON.parse(ctx.doGet().text),
    call(action, data = {}) { return this.post(JSON.stringify({ action, ...data })); },
  };
}

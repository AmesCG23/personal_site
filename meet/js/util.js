// Small helpers: building page elements, formatting dates, device memory, calendar files.

/** h('div', { class: 'x', onclick: fn }, 'text', child) — builds an element; text is never treated as HTML. */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

// ---- Dates and times ----

const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };

export function addDays(s, n) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return isoDate(d);
}

export function formatDate(s) {
  const d = parseDate(s);
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  if (d.getFullYear() !== new Date().getFullYear()) opts.year = 'numeric';
  return d.toLocaleDateString('en-US', opts);
}

function clock(t) {
  const [hh, mm] = t.split(':').map(Number);
  const h12 = hh % 12 || 12;
  return { text: mm ? `${h12}:${pad(mm)}` : String(h12), half: hh < 12 ? 'am' : 'pm' };
}

export function formatTimes(start, end) {
  if (!start) return 'Any time';
  const a = clock(start);
  if (!end) return `${a.text} ${a.half}`;
  const b = clock(end);
  return a.half === b.half ? `${a.text}–${b.text} ${b.half}` : `${a.text} ${a.half}–${b.text} ${b.half}`;
}

export const formatOption = (o) => `${formatDate(o.date)} · ${formatTimes(o.start, o.end)}`;

// ---- Remembering things on this device (never required; private windows may refuse) ----

function read(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* fine */ }
}

export const memory = {
  /** Who I am on a given poll: { participantId, editToken } */
  me: (id) => read('meet.me', {})[id] || null,
  setMe(id, val) { const all = read('meet.me', {}); if (val) all[id] = val; else delete all[id]; write('meet.me', all); },
  /** Polls I created on this device: [{ id, adminKey, title }] */
  mine: () => read('meet.mine', []),
  addMine(p) { write('meet.mine', [p, ...read('meet.mine', []).filter((x) => x.id !== p.id)].slice(0, 50)); },
  forgetMine(id) { write('meet.mine', read('meet.mine', []).filter((x) => x.id !== id)); },
  name: () => read('meet.name', ''),
  setName: (n) => write('meet.name', n),
  passcode: () => read('meet.passcode', ''),
  setPasscode: (p) => write('meet.passcode', p),
};

// ---- Calendar ----

const stamp = (date, time) => date.replace(/-/g, '') + (time ? 'T' + time.replace(':', '') + '00' : '');

/** Start and end in calendar format. Times are "floating": they mean local time wherever you open them. */
function span(o) {
  if (!o.start) return { all: true, from: stamp(o.date), to: stamp(addDays(o.date, 1)) };
  let endDate = o.date, end = o.end;
  if (!end) { // no end time given: assume two hours
    const [hh, mm] = o.start.split(':').map(Number);
    end = `${pad((hh + 2) % 24)}:${pad(mm)}`;
    if (hh + 2 >= 24) endDate = addDays(o.date, 1);
  } else if (end <= o.start) endDate = addDays(o.date, 1); // runs past midnight
  return { all: false, from: stamp(o.date, o.start), to: stamp(endDate, end) };
}

const esc = (s) => String(s || '').replace(/[\\;,]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n');

export function icsFile(ev, o, link) {
  const s = span(o);
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//amesgrawert.com//Meet//EN', 'BEGIN:VEVENT',
    `UID:${ev.id}-${o.id}@amesgrawert.com`, `DTSTAMP:${now}`,
    s.all ? `DTSTART;VALUE=DATE:${s.from}` : `DTSTART:${s.from}`,
    s.all ? `DTEND;VALUE=DATE:${s.to}` : `DTEND:${s.to}`,
    `SUMMARY:${esc(ev.title)}`,
    ev.location && `LOCATION:${esc(ev.location)}`,
    `DESCRIPTION:${esc([ev.notes, link].filter(Boolean).join('\n\n'))}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean);
  return lines.join('\r\n') + '\r\n';
}

export function googleCalendarLink(ev, o, link) {
  const s = span(o);
  const q = new URLSearchParams({
    action: 'TEMPLATE', text: ev.title, dates: `${s.from}/${s.to}`,
    details: [ev.notes, link].filter(Boolean).join('\n\n'),
  });
  if (ev.location) q.set('location', ev.location);
  return 'https://calendar.google.com/calendar/render?' + q;
}

export function download(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/** The phone's own share sheet (Messages, WhatsApp…), where there is one. */
export const canShare = () => typeof navigator.share === 'function';

export async function shareSheet(url, title) {
  try { await navigator.share({ title, url }); return true; } catch { return false; }
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch { return false; }
}

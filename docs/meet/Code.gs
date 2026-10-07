/**
 * @OnlyCurrentDoc
 * (The line above limits this script to the one Sheet it's attached to, rather than
 * every spreadsheet in your Google account. Keep it.)
 *
 * Meet — the Google Sheet "doorman" for amesgrawert.com/meet/
 *
 * Paste this whole file into Extensions → Apps Script on the Sheet that should
 * hold the polls, then Deploy → New deployment → Web app (Execute as: Me,
 * Who has access: Anyone). See docs/meet/SETUP.md for the click-by-click guide.
 *
 * The web page sends small JSON messages here; this script reads and writes
 * two tabs in the Sheet ("Events" and "Responses"), creating them on first use.
 */

// ---- Settings you can change -------------------------------------------------

// A passphrase only you know: three or four unrelated words, like 'lamp otter gravel'
// (not a single word or anything about you). Anyone creating a new poll must type it
// once per device. Leave as '' to let anyone who finds the page create polls.
// Set it here in Google's copy only; never in the website's copy, which is public.
var CREATE_PASSCODE = '';

// Your email address to get a note each time someone answers. '' turns it off.
var NOTIFY_EMAIL = '';

// Where the page lives (used for links in notification emails).
var SITE_URL = 'https://amesgrawert.com/meet/';

// ---- Limits ------------------------------------------------------------------

var MAX_OPTIONS = 30;
var MAX_PEOPLE = 200;
var MAX_TITLE = 120;
var MAX_TEXT = 1000;
var MAX_NAME = 60;
var ANSWERS = ['yes', 'maybe', 'no'];

var EVENT_HEADERS = ['event_id', 'created', 'title', 'location', 'notes', 'status',
  'final_option_id', 'timezone', 'admin_key', 'options_json'];
var RESPONSE_HEADERS = ['event_id', 'participant_id', 'name', 'option_id', 'option_label',
  'answer', 'updated', 'edit_token'];

// ---- Entry points ------------------------------------------------------------

/** Opening the web app address in a browser shows this — a quick "is it on?" check. */
function doGet() {
  return json_({ ok: true, service: 'meet', message: 'The Meet backend is running.' });
}

/** Every request from the page arrives here as a JSON message. */
function doPost(e) {
  try {
    var req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    return json_(handle_(req));
  } catch (err) {
    if (err && err.code) return json_({ ok: false, error: err.code, message: err.message });
    return json_({ ok: false, error: 'server', message: String(err && err.message || err) });
  }
}

function handle_(req) {
  switch (req.action) {
    case 'create': return locked_(function () { return create_(req); });
    case 'get': return get_(req);
    case 'respond': return locked_(function () { return respond_(req); });
    case 'admin': return locked_(function () { return admin_(req); });
    default: throw fail_('bad_request', 'Unknown action.');
  }
}

// ---- Actions -----------------------------------------------------------------

function create_(req) {
  if (CREATE_PASSCODE && String(req.passcode || '') !== CREATE_PASSCODE) {
    throw fail_('passcode_required', req.passcode ? 'That passcode is not right.' : 'A passcode is needed to create polls.');
  }
  var title = text_(req.title, MAX_TITLE);
  if (!title) throw fail_('bad_request', 'Give the poll a title.');
  var opts = Array.isArray(req.options) ? req.options : [];
  if (opts.length < 1) throw fail_('bad_request', 'Add at least one time.');
  if (opts.length > MAX_OPTIONS) throw fail_('bad_request', 'At most ' + MAX_OPTIONS + ' times per poll.');
  var options = opts.map(function (o, i) {
    var date = String(o.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw fail_('bad_request', 'Each time needs a date.');
    var start = /^\d{2}:\d{2}$/.test(o.start || '') ? o.start : '';
    var end = start && /^\d{2}:\d{2}$/.test(o.end || '') ? o.end : '';
    return { id: 'o' + (i + 1), date: date, start: start, end: end, label: text_(o.label, 80) || date };
  });

  var id = token_(10);
  var adminKey = token_(24);
  sheet_('Events', EVENT_HEADERS).appendRow(safeRow_([
    id, now_(), title, text_(req.location, 200), text_(req.notes, MAX_TEXT), 'open', '',
    text_(req.timezone, 60), adminKey, JSON.stringify(options)
  ]));
  return { ok: true, id: id, adminKey: adminKey };
}

function get_(req) {
  var ev = findEvent_(req.id);
  var out = publicEvent_(ev);
  out.isAdmin = !!req.adminKey && req.adminKey === ev.adminKey;
  return { ok: true, event: out };
}

function respond_(req) {
  var ev = findEvent_(req.id);
  if (ev.status !== 'open') throw fail_('closed', 'This poll is closed.');
  var name = text_(req.name, MAX_NAME);
  if (!name) throw fail_('bad_request', 'Please type your name.');
  var answers = req.answers || {};

  var rs = sheet_('Responses', RESPONSE_HEADERS);
  var rows = rs.getDataRange().getValues();
  var people = peopleIn_(rows, ev.id);

  // Is this an update from someone who answered before on this device?
  var pid = '';
  var token = '';
  if (req.participantId && people[req.participantId] && people[req.participantId].token === req.editToken) {
    pid = req.participantId;
    token = req.editToken;
  }
  // Otherwise, is the name already taken?
  if (!pid) {
    for (var p in people) {
      if (people[p].name.toLowerCase() === name.toLowerCase()) {
        if (!req.replace) throw fail_('name_taken', 'Someone named ' + people[p].name + ' already answered.');
        pid = p;
        token = people[p].token;
      }
    }
  }
  if (!pid) {
    if (Object.keys(people).length >= MAX_PEOPLE) throw fail_('full', 'This poll has reached its limit.');
    pid = token_(8);
    token = token_(16);
  }

  deleteRows_(rs, rows, function (r) { return cell_(r[0]) === ev.id && cell_(r[1]) === pid; });
  var now = now_();
  var newRows = ev.options.map(function (o) {
    var a = ANSWERS.indexOf(answers[o.id]) >= 0 ? answers[o.id] : 'no';
    return safeRow_([ev.id, pid, name, o.id, o.label, a, now, token]);
  });
  rs.getRange(rs.getLastRow() + 1, 1, newRows.length, RESPONSE_HEADERS.length).setValues(newRows);

  notify_(ev, name, newRows);
  return { ok: true, participantId: pid, editToken: token, event: publicEvent_(findEvent_(ev.id)) };
}

function admin_(req) {
  var ev = findEvent_(req.id);
  if (!req.adminKey || req.adminKey !== ev.adminKey) throw fail_('forbidden', 'That admin link is not right.');
  var es = sheet_('Events', EVENT_HEADERS);
  switch (req.op) {
    case 'close': es.getRange(ev.row, 6).setValue('closed'); break;
    case 'reopen': es.getRange(ev.row, 6).setValue('open'); break;
    case 'finalize':
      var oid = String(req.optionId || '');
      if (oid && !ev.options.some(function (o) { return o.id === oid; })) throw fail_('bad_request', 'No such option.');
      es.getRange(ev.row, 7).setValue(oid);
      break;
    case 'delete_participant':
      var rs = sheet_('Responses', RESPONSE_HEADERS);
      deleteRows_(rs, rs.getDataRange().getValues(), function (r) {
        return cell_(r[0]) === ev.id && cell_(r[1]) === String(req.participantId || '');
      });
      break;
    default: throw fail_('bad_request', 'Unknown admin step.');
  }
  var out = publicEvent_(findEvent_(ev.id));
  out.isAdmin = true;
  return { ok: true, event: out };
}

// ---- Reading the Sheet -------------------------------------------------------

function findEvent_(id) {
  id = String(id || '');
  if (!/^[a-z0-9]{6,40}$/.test(id)) throw fail_('not_found', 'No poll at this link.');
  var rows = sheet_('Events', EVENT_HEADERS).getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (cell_(r[0]) === id) {
      var options = [];
      try { options = JSON.parse(r[9]); } catch (e) { /* hand-edited cell */ }
      return {
        row: i + 1, id: id, title: cell_(r[2]), location: cell_(r[3]), notes: cell_(r[4]),
        status: cell_(r[5]) === 'closed' ? 'closed' : 'open', finalOptionId: cell_(r[6]),
        timezone: cell_(r[7]), adminKey: cell_(r[8]), options: options
      };
    }
  }
  throw fail_('not_found', 'No poll at this link.');
}

function peopleIn_(rows, eventId) {
  var people = {};
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (cell_(r[0]) !== eventId) continue;
    var pid = cell_(r[1]);
    if (!people[pid]) people[pid] = { id: pid, name: cell_(r[2]), token: cell_(r[7]), answers: {}, updated: cell_(r[6]) };
    people[pid].answers[cell_(r[3])] = cell_(r[5]);
  }
  return people;
}

function publicEvent_(ev) {
  var rows = sheet_('Responses', RESPONSE_HEADERS).getDataRange().getValues();
  var people = peopleIn_(rows, ev.id);
  var list = Object.keys(people).map(function (k) {
    var p = people[k];
    return { id: p.id, name: p.name, answers: p.answers, updated: p.updated };
  });
  list.sort(function (a, b) { return a.updated < b.updated ? -1 : 1; });
  return {
    id: ev.id, title: ev.title, location: ev.location, notes: ev.notes, status: ev.status,
    finalOptionId: ev.finalOptionId, timezone: ev.timezone, options: ev.options, participants: list
  };
}

// ---- Helpers -----------------------------------------------------------------

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@'); // keep everything as plain text
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function deleteRows_(sh, rows, match) {
  for (var i = rows.length - 1; i >= 1; i--) if (match(rows[i])) sh.deleteRow(i + 1);
}

function locked_(fn) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function notify_(ev, name, rows) {
  if (!NOTIFY_EMAIL) return;
  try {
    var words = { yes: 'Yes', maybe: 'If need be', no: 'No' };
    var lines = rows.map(function (r) { return '  ' + r[4] + ': ' + words[r[5]]; });
    MailApp.sendEmail(NOTIFY_EMAIL, 'Meet: ' + name + ' answered “' + ev.title + '”',
      name + ' answered your poll “' + ev.title + '”.\n\n' + lines.join('\n') +
      '\n\nSee everyone’s answers (your private admin link):\n' + SITE_URL + '?e=' + ev.id + '&k=' + ev.adminKey + '\n');
  } catch (e) { /* a failed email should never lose someone's answers */ }
}

/** Trim and shorten text; stop the Sheet from treating it as a formula. */
function text_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max);
}

function safeRow_(row) {
  return row.map(function (v) { return typeof v === 'string' && /^[=+\-@]/.test(v) ? "'" + v : v; });
}

/** A random code of n letters a–p (letters only, so the Sheet never mistakes it for a number). */
function token_(n) {
  var s = '';
  while (s.length < n) s += Utilities.getUuid().replace(/-/g, '');
  return s.slice(0, n).toLowerCase().replace(/[0-9a-f]/g, function (c) {
    return String.fromCharCode(97 + parseInt(c, 16));
  });
}

/** Read a cell back as text, undoing the apostrophe added by safeRow_. */
function cell_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  return String(v == null ? '' : v).replace(/^'(?=[=+\-@])/, '');
}

function now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function fail_(code, message) {
  var e = new Error(message);
  e.code = code;
  return e;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

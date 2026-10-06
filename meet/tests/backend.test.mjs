// Checks the Sheet script (docs/meet/Code.gs) on its own.   node meet/tests/backend.test.mjs
import { makeBackend } from './fake-apps-script.mjs';

let failures = 0;
const check = (cond, msg) => { if (cond) console.log('  ok   ' + msg); else { failures++; console.log('  FAIL ' + msg); } };

const opts = [
  { date: '2026-10-16', start: '19:00', end: '22:00', label: 'Fri, Oct 16 · 7–10 pm' },
  { date: '2026-10-17', start: '', end: '', label: 'Sat, Oct 17 · Any time' },
];

console.log('backend');
let b = makeBackend();
check(b.getStatus().ok, 'opening the address in a browser says it is running');
check(b.call('nope').error === 'bad_request', 'unknown actions are refused');
check(b.call('create', { title: '', options: opts }).error === 'bad_request', 'title required');
check(b.call('create', { title: 'x', options: [] }).error === 'bad_request', 'at least one time required');
check(b.call('create', { title: 'x', options: [{ date: 'soon' }] }).error === 'bad_request', 'dates validated');

const c = b.call('create', { title: '=HYPERLINK("evil")', location: 'Home', notes: 'Bring snacks', options: opts, timezone: 'America/New_York' });
check(c.ok && /^[a-p]{10}$/.test(c.id) && /^[a-p]{24}$/.test(c.adminKey), 'create returns a letters-only id and admin key');
check(b.sheets.Events.formats.includes('@'), 'tabs are formatted as plain text');
check(b.sheets.Events.rows[0][0] === 'event_id' && b.sheets.Responses === undefined, 'Events tab made with headers; Responses waits until needed');

let g = b.call('get', { id: c.id });
check(g.ok && g.event.title === '=HYPERLINK("evil")', 'title survives the formula guard intact');
check(g.event.isAdmin === false && !('adminKey' in g.event), 'the friend link never sees the admin key');
check(b.call('get', { id: c.id, adminKey: c.adminKey }).event.isAdmin === true, 'admin key recognised');
check(b.call('get', { id: 'zzzzzzzzzz' }).error === 'not_found', 'unknown poll → not_found');
check(b.call('get', { id: '../etc' }).error === 'not_found', 'odd ids rejected');

const r1 = b.call('respond', { id: c.id, name: 'Alex', answers: { o1: 'yes', o2: 'bogus' } });
check(r1.ok && r1.participantId && r1.editToken, 'Alex answers');
check(b.sheets.Responses.rows.length === 3, 'one row per person per time');
check(r1.event.participants[0].answers.o2 === 'no', 'blank or unknown answers count as No');
check(b.sheets.Responses.rows[1][4] === 'Fri, Oct 16 · 7–10 pm', 'Sheet rows carry readable labels');

const dup = b.call('respond', { id: c.id, name: ' alex ', answers: { o1: 'no' } });
check(dup.error === 'name_taken', 'same name from another device is caught');
const rep = b.call('respond', { id: c.id, name: 'alex', answers: { o1: 'maybe' }, replace: true });
check(rep.ok && rep.participantId === r1.participantId && rep.event.participants.length === 1, 'confirmed replace overwrites, no duplicate');

const upd = b.call('respond', { id: c.id, name: 'Alex R.', answers: { o1: 'yes', o2: 'yes' }, participantId: r1.participantId, editToken: r1.editToken });
check(upd.ok && upd.event.participants.length === 1 && upd.event.participants[0].name === 'Alex R.', 'same device can update and rename');
const forged = b.call('respond', { id: c.id, name: 'Sam', answers: {}, participantId: r1.participantId, editToken: 'wrong' });
check(forged.ok && forged.participantId !== r1.participantId && forged.event.participants.length === 2, 'wrong edit token cannot overwrite someone else');

check(b.call('admin', { id: c.id, adminKey: 'nope', op: 'close' }).error === 'forbidden', 'admin needs the key');
check(b.call('admin', { id: c.id, adminKey: c.adminKey, op: 'close' }).event.status === 'closed', 'organizer can close');
check(b.call('respond', { id: c.id, name: 'Late', answers: {} }).error === 'closed', 'closed poll refuses answers');
check(b.call('admin', { id: c.id, adminKey: c.adminKey, op: 'reopen' }).event.status === 'open', 'and reopen');
check(b.call('admin', { id: c.id, adminKey: c.adminKey, op: 'finalize', optionId: 'o9' }).error === 'bad_request', 'cannot choose a time that does not exist');
check(b.call('admin', { id: c.id, adminKey: c.adminKey, op: 'finalize', optionId: 'o2' }).event.finalOptionId === 'o2', 'organizer chooses a time');
const del = b.call('admin', { id: c.id, adminKey: c.adminKey, op: 'delete_participant', participantId: forged.participantId });
check(del.event.participants.length === 1 && b.sheets.Responses.rows.length === 3, 'organizer removes an answer');

const c2 = b.call('create', { title: 'Second', options: opts });
b.call('respond', { id: c2.id, name: 'Alex', answers: {} });
check(b.call('get', { id: c.id }).event.participants.length === 1 && b.call('get', { id: c2.id }).event.participants.length === 1, 'two polls side by side stay separate');

console.log('passcode + email');
b = makeBackend({ passcode: 'tuesday', notify: 'me@example.com' });
check(b.call('create', { title: 'x', options: opts }).error === 'passcode_required', 'passcode required when set');
check(b.call('create', { title: 'x', options: opts, passcode: 'monday' }).error === 'passcode_required', 'wrong passcode refused');
const c3 = b.call('create', { title: 'Game night', options: opts, passcode: 'tuesday' });
check(c3.ok, 'right passcode works');
b.call('respond', { id: c3.id, name: 'Jo', answers: { o1: 'yes' } });
check(b.sent.length === 1 && /Jo answered/.test(b.sent[0].subject) && b.sent[0].body.includes('Fri, Oct 16 · 7–10 pm: Yes') && b.sent[0].body.includes('&k=' + c3.adminKey),
  'organizer gets an email with the answers and their admin link');

console.log(failures ? `\n${failures} FAILED` : '\nall passed');
process.exit(failures ? 1 : 0);

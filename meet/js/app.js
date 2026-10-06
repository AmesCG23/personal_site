// Meet — a small Doodle-style scheduling poll. See docs/meet/SETUP.md.
//   /meet/                 make a poll; lists polls made on this device
//   /meet/?e=ID            answer a poll (the link you send friends)
//   /meet/?e=ID&k=KEY      the organizer's view: close, pick the final time, remove answers
import { call, configured } from './api.js';
import { h, addDays, formatDate, formatTimes, formatOption, memory, icsFile, googleCalendarLink, download, shareLink } from './util.js';

const root = document.getElementById('app');
// Put a page together, skipping the optional pieces that are switched off.
const mount = (...kids) => root.replaceChildren(...kids.filter((k) => k instanceof Node));
const base = location.origin + location.pathname;
const params = new URLSearchParams(location.search);
const WORDS = { yes: 'Yes', maybe: 'If need be', no: 'No' };

// ---- Shared pieces ----

let flashTimer;
function flash(text, isError = false) {
  const el = document.getElementById('flash');
  el.textContent = text;
  el.className = 'flash show' + (isError ? ' error' : '');
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { el.className = 'flash'; }, isError ? 6000 : 3500);
}

function masthead(title, sub) {
  return h('header', { class: 'masthead' },
    h('a', { class: 'eyebrow', href: base }, 'Meet'),
    h('h1', {}, title),
    sub && h('p', { class: 'sub' }, sub));
}

function busy(btn, label) {
  const old = btn.textContent;
  btn.disabled = true;
  btn.textContent = label;
  return () => { btn.disabled = false; btn.textContent = old; };
}

function shareBox(url, title, note) {
  const btn = h('button', { type: 'button', class: 'btn' }, 'Copy link');
  btn.addEventListener('click', async () => {
    const done = await shareLink(url, title);
    if (done) { btn.textContent = done + ' ✓'; setTimeout(() => { btn.textContent = 'Copy link'; }, 2000); }
    else flash('Couldn’t copy automatically — press and hold the link to copy it.', true);
  });
  return h('div', { class: 'share' },
    note && h('p', { class: 'hint' }, note),
    h('div', { class: 'share-row' },
      h('input', { class: 'share-url', type: 'text', readonly: true, value: url, 'aria-label': 'Link', onfocus: (e) => e.target.select() }),
      btn));
}

function setupNotice() {
  return h('div', { class: 'notice' },
    h('strong', {}, 'Not connected yet. '),
    'This page needs the web address of its Google Sheet script before it can save anything. ',
    'The steps are in docs/meet/SETUP.md.');
}

// ---- Home: make a poll ----

function renderHome() {
  document.title = 'Meet';
  const mine = memory.mine();
  mount(
    masthead('Find a time', 'Make a poll, send the link, and see which times work for everyone.'),
    !configured() && setupNotice(),
    mine.length > 0 && h('section', { class: 'mine' },
      h('h2', {}, 'Your polls'),
      h('p', { class: 'hint' }, 'Saved on this device. Each opens your organizer view.'),
      h('ul', {}, mine.map((p) => h('li', {},
        h('a', { href: `${base}?e=${p.id}&k=${p.adminKey}` }, p.title),
        h('button', {
          type: 'button', class: 'link-btn', 'aria-label': `Forget ${p.title} on this device`,
          onclick: () => { memory.forgetMine(p.id); renderHome(); },
        }, 'forget'))))),
    createForm());
}

function createForm() {
  const rows = [{ date: '', start: '', end: '' }];
  const list = h('ol', { class: 'times' });

  const input = (row, key, type, label, extra = {}) => h('label', { class: 'field ' + key },
    h('span', {}, label),
    h('input', { type, value: row[key], ...extra, oninput: (e) => { row[key] = e.target.value; } }));

  const drawRows = () => list.replaceChildren(...rows.map((row, i) => h('li', { class: 'time-row' },
    input(row, 'date', 'date', 'Date', { required: true }),
    input(row, 'start', 'time', 'From', { step: 900 }),
    input(row, 'end', 'time', 'To', { step: 900 }),
    h('button', {
      type: 'button', class: 'btn btn-icon', 'aria-label': `Remove time ${i + 1}`, disabled: rows.length === 1,
      onclick: () => { rows.splice(i, 1); drawRows(); },
    }, '×'))));
  drawRows();

  const addTime = () => {
    const last = rows[rows.length - 1];
    rows.push({ date: last.date ? addDays(last.date, 1) : '', start: last.start, end: last.end });
    drawRows();
    list.lastElementChild.querySelector('input').focus();
  };

  const passWrap = h('label', { class: 'field', hidden: true },
    h('span', {}, 'Passcode'),
    h('input', { type: 'password', name: 'passcode', autocomplete: 'current-password' }));
  const msg = h('p', { class: 'form-msg', role: 'alert' });
  const submit = h('button', { type: 'submit', class: 'btn btn-primary' }, 'Create poll');

  const form = h('form', { class: 'create', novalidate: true },
    h('h2', {}, 'New poll'),
    h('label', { class: 'field' }, h('span', {}, 'What’s it for?'),
      h('input', { name: 'title', type: 'text', maxlength: 120, placeholder: 'Game night', required: true })),
    h('label', { class: 'field' }, h('span', {}, 'Where (optional)'),
      h('input', { name: 'location', type: 'text', maxlength: 200, placeholder: 'My place' })),
    h('label', { class: 'field' }, h('span', {}, 'Notes (optional)'),
      h('textarea', { name: 'notes', rows: 3, maxlength: 1000, placeholder: 'Bring a deck.' })),
    h('fieldset', {},
      h('legend', {}, 'Times to choose from'),
      h('p', { class: 'hint' }, 'Leave “From” blank for an all-day option. “To” is optional.'),
      list,
      h('button', { type: 'button', class: 'btn', onclick: addTime }, '+ Add a time')),
    passWrap,
    msg,
    submit);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    msg.textContent = '';
    const title = form.title.value.trim();
    if (!title) { msg.textContent = 'Give the poll a title.'; form.title.focus(); return; }
    if (rows.some((r) => !r.date)) { msg.textContent = 'Each time needs a date (or remove the empty one).'; return; }
    const options = rows
      .map((r) => ({ date: r.date, start: r.start, end: r.start ? r.end : '' }))
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
      .map((o) => ({ ...o, label: formatOption(o) }));
    const passcode = form.passcode.value || memory.passcode();
    const done = busy(submit, 'Creating…');
    try {
      const r = await call('create', {
        title, location: form.location.value.trim(), notes: form.notes.value.trim(), options, passcode,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (passcode) memory.setPasscode(passcode);
      memory.addMine({ id: r.id, adminKey: r.adminKey, title });
      location.assign(`${base}?e=${r.id}&k=${r.adminKey}&new=1`);
    } catch (err) {
      done();
      if (err.code === 'passcode_required') {
        memory.setPasscode('');
        passWrap.hidden = false;
        form.passcode.focus();
      }
      msg.textContent = err.message;
    }
  });
  return form;
}

// ---- A poll ----

async function renderPoll(id, key) {
  mount(h('p', { class: 'loading' }, 'Loading the poll…'));
  let ev;
  try {
    ev = (await call('get', { id, adminKey: key || undefined })).event;
  } catch (err) {
    mount(
      masthead(err.code === 'not_found' ? 'No poll here' : 'Couldn’t load the poll'),
      err.code === 'not_configured' ? setupNotice() : h('p', {}, err.message),
      h('p', {}, h('button', { type: 'button', class: 'btn', onclick: () => renderPoll(id, key) }, 'Try again')));
    return;
  }
  new PollView(id, key, ev).draw();
}

class PollView {
  constructor(id, key, ev) {
    this.id = id;
    this.key = key;
    this.ev = ev;
    this.shareUrl = `${base}?e=${id}`;
    this.adminUrl = `${base}?e=${id}&k=${key}`;
    this.isNew = params.get('new') === '1';
    this.loadMe();
    if (ev.isAdmin) memory.addMine({ id, adminKey: key, title: ev.title });
  }

  /** Pick up this device's earlier answers, if any. */
  loadMe() {
    const me = memory.me(this.id);
    const p = me && this.ev.participants.find((x) => x.id === me.participantId);
    if (me && !p) memory.setMe(this.id, null);
    this.me = p ? me : null;
    this.name = p ? p.name : memory.name();
    this.draft = p ? { ...p.answers } : {};
  }

  draw() {
    const { ev } = this;
    document.title = `${ev.title} · Meet`;
    const open = ev.status === 'open';
    const final = ev.options.find((o) => o.id === ev.finalOptionId);

    mount(
      masthead(ev.title, null),
      (ev.location || ev.notes) && h('div', { class: 'details' },
        ev.location && h('p', { class: 'where' }, ev.location),
        ev.notes && h('p', { class: 'notes' }, ev.notes)),
      ev.isAdmin && this.adminPanel(),
      final && this.finalBanner(final),
      !open && !final && h('p', { class: 'notice' }, 'This poll is closed. The organizer is picking a time.'),
      this.answerForm(open, final),
      this.people());

    if (this.isNew) {
      this.isNew = false;
      history.replaceState(null, '', this.adminUrl);
    }
  }

  // -- Organizer tools --

  adminPanel() {
    const { ev } = this;
    const open = ev.status === 'open';
    return h('section', { class: 'admin' },
      h('h2', {}, this.isNew ? 'Your poll is ready' : 'Organizer view'),
      shareBox(this.shareUrl, ev.title, 'Send this link to friends:'),
      h('p', { class: 'hint' },
        'This page’s own address is your private organizer link — only you should have it. ',
        'It’s saved on this device and in the Sheet’s “admin_key” column if you lose it.'),
      h('div', { class: 'admin-actions' },
        h('button', {
          type: 'button', class: 'btn',
          onclick: (e) => this.admin(e.target, open ? 'close' : 'reopen'),
        }, open ? 'Close the poll' : 'Reopen the poll'),
        h('span', { class: 'hint' }, open
          ? 'Closing stops new answers. To announce the time, use “Choose this time” below.'
          : 'Closed: people can see results but not answer.')));
  }

  async admin(btn, op, extra = {}) {
    const done = busy(btn, 'Saving…');
    try {
      this.ev = (await call('admin', { id: this.id, adminKey: this.key, op, ...extra })).event;
      this.loadMe();
      this.draw();
    } catch (err) {
      done();
      flash(err.message, true);
    }
  }

  finalBanner(o) {
    const { ev } = this;
    return h('section', { class: 'final' },
      h('p', { class: 'final-label' }, 'It’s set'),
      h('p', { class: 'final-when' }, formatDate(o.date), h('span', {}, formatTimes(o.start, o.end))),
      ev.location && h('p', { class: 'final-where' }, ev.location),
      h('div', { class: 'final-actions' },
        h('button', {
          type: 'button', class: 'btn btn-primary',
          onclick: () => download(`${ev.title.replace(/[^\w -]+/g, '').trim() || 'event'}.ics`, icsFile(ev, o, this.shareUrl), 'text/calendar'),
        }, 'Add to calendar'),
        h('a', { class: 'btn', href: googleCalendarLink(ev, o, this.shareUrl), target: '_blank', rel: 'noopener' }, 'Google Calendar')));
  }

  // -- The list of times, with everyone's answers and your buttons --

  answerForm(open, final) {
    const { ev } = this;
    const tallies = ev.options.map((o) => {
      const t = { yes: [], maybe: [], no: [] };
      for (const p of ev.participants) (t[p.answers[o.id]] || t.no).push(p.name);
      return t;
    });
    const score = (t) => (t.yes.length + t.maybe.length) * 1000 + t.yes.length;
    const top = ev.participants.length ? Math.max(...tallies.map(score)) : -1;
    const total = ev.participants.length;

    const cards = ev.options.map((o, i) => {
      const t = tallies[i];
      const isBest = top > 0 && score(t) === top;
      const isFinal = final && final.id === o.id;
      const choice = open && this.choices(o);
      return h('li', { class: 'opt' + (isBest ? ' best' : '') + (isFinal ? ' chosen' : '') },
        h('div', { class: 'opt-head' },
          h('span', { class: 'opt-date' }, formatDate(o.date)),
          h('span', { class: 'opt-time' }, formatTimes(o.start, o.end)),
          isFinal ? h('span', { class: 'tag tag-final' }, 'Chosen') : isBest && h('span', { class: 'tag' }, 'Best so far')),
        total > 0 && h('div', { class: 'bar', 'aria-hidden': 'true' },
          h('span', { class: 'bar-yes', style: `width:${(100 * t.yes.length) / total}%` }),
          h('span', { class: 'bar-maybe', style: `width:${(100 * t.maybe.length) / total}%` })),
        total > 0 && h('p', { class: 'tally' },
          `${t.yes.length} yes`, t.maybe.length ? ` · ${t.maybe.length} if need be` : '', ` · ${t.no.length} no`),
        total > 0 && (t.yes.length + t.maybe.length > 0) && h('p', { class: 'names' },
          t.yes.length > 0 && h('span', {}, h('b', {}, 'Yes: '), t.yes.join(', ')),
          t.maybe.length > 0 && h('span', {}, h('b', {}, 'If need be: '), t.maybe.join(', '))),
        choice,
        ev.isAdmin && h('button', {
          type: 'button', class: 'link-btn choose',
          onclick: (e) => this.admin(e.target, 'finalize', { optionId: isFinal ? '' : o.id }),
        }, isFinal ? 'Un-choose this time' : 'Choose this time'));
    });

    const list = h('ol', { class: 'opts' }, cards);
    if (!open) return h('section', { class: 'answers' }, h('h2', {}, 'Results'), list);

    const nameInput = h('input', {
      id: 'name', type: 'text', maxlength: 60, autocomplete: 'name', value: this.name, placeholder: 'Your name',
      oninput: (e) => { this.name = e.target.value; },
    });
    const msg = h('div', { class: 'form-msg', role: 'alert' });
    const save = h('button', { type: 'submit', class: 'btn btn-primary' }, this.me ? 'Update my answers' : 'Save my answers');
    const form = h('form', { class: 'answers', novalidate: true },
      h('h2', {}, 'Which times work for you?'),
      h('label', { class: 'field', for: 'name' }, h('span', {}, 'Your name')),
      nameInput,
      this.me && h('p', { class: 'hint' }, 'You’ve answered on this device — change anything and update. ',
        h('button', {
          type: 'button', class: 'link-btn',
          onclick: () => { memory.setMe(this.id, null); this.me = null; this.name = ''; this.draft = {}; this.draw(); },
        }, 'Not you?')),
      list,
      h('div', { class: 'savebar' },
        msg,
        h('p', { class: 'hint' }, 'Anything left blank counts as “No”.'),
        save));
    form.addEventListener('submit', (e) => { e.preventDefault(); this.save(save, msg, nameInput, false); });
    return form;
  }

  choices(o) {
    const group = h('div', { class: 'choices', role: 'group', 'aria-label': `Your answer for ${formatOption(o)}` });
    for (const a of ['yes', 'maybe', 'no']) {
      group.append(h('button', {
        type: 'button', class: 'choice c-' + a, 'data-answer': a, 'aria-pressed': String(this.draft[o.id] === a),
        onclick: () => {
          this.draft[o.id] = this.draft[o.id] === a ? undefined : a;
          for (const b of group.children) b.setAttribute('aria-pressed', String(this.draft[o.id] === b.dataset.answer));
        },
      }, WORDS[a]));
    }
    return group;
  }

  async save(btn, msg, nameInput, replace) {
    msg.replaceChildren();
    const name = this.name.trim();
    if (!name) { msg.textContent = 'Please type your name first.'; nameInput.focus(); return; }
    const answers = {};
    for (const [k, v] of Object.entries(this.draft)) if (v) answers[k] = v;
    const done = busy(btn, 'Saving…');
    try {
      const r = await call('respond', {
        id: this.id, name, answers, replace,
        participantId: this.me?.participantId, editToken: this.me?.editToken,
      });
      memory.setMe(this.id, { participantId: r.participantId, editToken: r.editToken });
      memory.setName(name);
      this.ev = r.event;
      if (this.key) this.ev.isAdmin = true;
      this.loadMe();
      this.draw();
      flash('Saved ✓ You can come back and change your answers from this device.');
    } catch (err) {
      done();
      if (err.code === 'name_taken') {
        msg.replaceChildren(
          h('p', {}, `${err.message} Is that you?`),
          h('div', { class: 'msg-actions' },
            h('button', { type: 'button', class: 'btn', onclick: () => this.save(btn, msg, nameInput, true) }, 'Yes — replace their answers'),
            h('button', { type: 'button', class: 'btn', onclick: () => { msg.replaceChildren(); nameInput.select(); } }, 'No — I’ll change my name')));
      } else if (err.code === 'closed') {
        flash(err.message, true);
        renderPoll(this.id, this.key);
      } else {
        msg.textContent = err.message;
      }
    }
  }

  // -- Who has answered --

  people() {
    const { ev } = this;
    if (!ev.participants.length) return h('p', { class: 'hint people-empty' }, 'No one has answered yet.');
    return h('section', { class: 'people' },
      h('h2', {}, `Answered (${ev.participants.length})`),
      h('ul', {}, ev.participants.map((p) => h('li', {},
        h('span', {}, p.name),
        ev.isAdmin && h('button', {
          type: 'button', class: 'link-btn', 'aria-label': `Remove ${p.name}’s answers`,
          onclick: (e) => {
            if (confirm(`Remove ${p.name}’s answers? This can’t be undone.`)) this.admin(e.target, 'delete_participant', { participantId: p.id });
          },
        }, 'remove')))));
  }
}

// ---- Start ----

const id = params.get('e');
if (id) renderPoll(id, params.get('k'));
else renderHome();

# Meet

A small Doodle-style scheduling poll at `https://amesgrawert.com/meet/`. Hidden: nothing on
the site links to it, and it's marked `noindex`. Answers are stored in a Google Sheet through
an Apps Script web app. Setup and day-to-day use: `../docs/meet/SETUP.md`.

## How it fits together

- `index.html`, `css/meet.css`: page and styles (colours/fonts copied from the main site).
- `js/app.js`: the three views. `/meet/` makes a poll, `?e=ID` answers one, `?e=ID&k=KEY` is the organizer view.
- `js/api.js`: sends requests to the Sheet script, as plain-text POSTs so Apps Script doesn't need CORS preflight.
- `js/config.js`: the Apps Script `/exec` address. When it's empty, the page shows a "not connected" note.
- `js/util.js`: element builder, date formatting, localStorage, `.ics` and Google Calendar links.
- `../docs/meet/Code.gs`: the Apps Script. Settings (passcode, notify email) are filled in only in Google's copy.

Each device remembers its own answers (an edit token in localStorage), so friends can come
back and change them. If someone answers under a name that's already taken, the page asks
"Is that you?" before replacing it.

## Testing

```
node meet/tests/backend.test.mjs                 # Code.gs against a pretend Sheet
python3 -m http.server 8123 --bind 127.0.0.1     # from the repo root, then:
node meet/tests/smoke.mjs                        # full browser run, phone + desktop
```

`tests/fake-apps-script.mjs` runs the real `Code.gs` in Node with stand-ins for Google's
SpreadsheetApp, LockService, etc., so the browser test exercises both halves together.

# Deploying Code.gs

`Code.gs` is the backend for `/schedule/`. It runs inside the "Scheduling Polls"
Google Sheet as a bound Apps Script project, not on GitHub Pages — GitHub Pages
only serves the static frontend in `schedule/`.

## One-time setup

1. Open the "Scheduling Polls" Google Sheet.
2. **Extensions → Apps Script**. This opens a script editor bound to the sheet.
3. Delete the default empty `Code.gs` content and paste in the contents of this
   folder's `Code.gs`.
4. Save the project (any name is fine).
5. **Deploy → New deployment**.
   - Click the gear icon next to "Select type" and choose **Web app**.
   - Execute as: **Me**.
   - Who has access: **Anyone**.
   - Click **Deploy**, then authorize the script when Google prompts you
     (it will warn that the app is unverified — this is expected for a
     personal script; click through **Advanced → Go to (project name)**).
6. Copy the **Web app URL** it gives you (ends in `/exec`).
7. Paste that URL into `schedule/config.js` as `APPS_SCRIPT_URL`, then commit
   and push.

## Redeploying after edits

If you change `Code.gs` later (in the Apps Script editor, in the Sheet), you
must create a **new deployment version** for changes to take effect:
**Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy**.
The Web app URL stays the same across versions.

## Adding a new poll

Open the Sheet and use the **Scheduler → Create new poll...** menu (only
appears after the script above is installed). It scaffolds the
`<slug>_Config` / `<slug>_Responses` tabs for you — just fill in the Date/Label
rows in `<slug>_Config` afterward.

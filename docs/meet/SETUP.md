# Meet — setting it up

Meet is the scheduling poll at `amesgrawert.com/meet/`. The page itself is on the
website; the answers are kept in a Google Sheet in your Drive. A short script attached
to that Sheet (`Code.gs`, in this folder) acts as the go-between: the page hands it
"Jo said yes to Friday," and it writes the row.

This is a one-time setup, about 10 minutes.

## 1. Make the Sheet

1. Go to [sheets.new](https://sheets.new) while signed in to your Google account.
2. Name it something like **Meet — scheduling polls**.

You don't need to add any tabs or headings. The script makes an **Events** tab and a
**Responses** tab the first time it's used.

## 2. Paste in the script

1. In the Sheet: **Extensions → Apps Script**. A code editor opens in a new tab.
2. Delete the few lines that are already there.
3. Open `Code.gs` from this folder, copy all of it, and paste it in.
4. Near the top, fill in the two settings in quotes:
   - `CREATE_PASSCODE`: a word only you know, e.g. `'tuesday'`. Anyone making a *new*
     poll has to type it once per device. Friends answering a poll never need it.
     (Leaving it as `''` lets anyone who finds the page make polls in your Sheet.)
   - `NOTIFY_EMAIL`: your email address if you'd like a note each time someone
     answers, or leave it as `''` for no emails.
5. Click the **Save** (disk) icon.

Only change the script in Google, not in the website's files. The website's copy
is public, so the passcode must never go there.

## 3. Turn it on (deploy)

1. Top right: **Deploy → New deployment**.
2. Click the gear next to "Select type" and choose **Web app**.
3. Set **Execute as: Me** and **Who has access: Anyone**.
   "Anyone" means friends can answer without a Google account. They can only do what
   the script allows (answer polls). They can't see or open the Sheet.
4. Click **Deploy**. Google will ask you to **Authorize access**: pick your account.
   Because this is your own script rather than an app Google has reviewed, it shows a
   warning. Click **Advanced → Go to (project name) (unsafe)**, then **Allow**.
   What it asks for: to edit this spreadsheet, and to send email as you (used only
   for the notifications in step 2, and only if you turned them on).
5. Copy the **Web app URL**. It starts `https://script.google.com/macros/s/` and
   ends in `/exec`.

**Check it:** paste that address into a browser tab. You should see
`{"ok":true,"service":"meet",...}`.

## 4. Connect the page

Put the address into `meet/js/config.js`, between the quotes on the `API_URL` line,
and publish the site. (Or just send the address to Claude and it'll do this step.)

## Day to day

- **Make a poll:** go to `amesgrawert.com/meet/`, fill it in, and press Create. You
  land on your **organizer view**. Send friends the link shown in the box (it has
  no key in it).
- **Your organizer link** is the page's own address (`...?e=…&k=…`). It's remembered on
  the device you made the poll on (listed under "Your polls" on the Meet home page),
  emailed to you with each notification if those are on, and recoverable from the
  `admin_key` column in the Events tab: it's
  `https://amesgrawert.com/meet/?e=EVENT_ID&k=ADMIN_KEY`.
- **Wrap up:** in the organizer view, press **Close the poll**, then **Choose this time**
  on the winner. Everyone with the link sees it, with "Add to calendar" buttons.
- **Fix things by hand:** the Sheet is the record. You can fix a misspelled name in
  the Responses tab or delete rows. Leave the `event_id`, `participant_id` and
  `option_id` columns alone.
- **Clean out old polls:** delete their rows from both tabs (filter by `event_id`).
  There's no need to wipe the whole Sheet: polls are kept apart by their IDs.

## Changing the script later

After editing `Code.gs` in Google: **Deploy → Manage deployments → (pencil) → Version:
New version → Deploy**. That keeps the same web address. Choosing "New deployment"
again would give you a *new* address, and the page would need updating.

## Good to know

- Saving takes a second or two. Google's script service isn't instant.
- Times are "wall clock" times, as typed. Someone opening the poll in another time
  zone sees the same numbers, and calendar invites land at that local time.
- The page is hidden, not locked. Nothing links to it and search engines are told
  to skip it, but anyone with a poll link can answer that poll, as with Doodle.
  Don't use it for anything sensitive.
- Limits: 30 times per poll and 200 people per poll.

# Handoff: "Token Table" — a Magic: The Gathering token tray for the Sandbox

**Status:** built (2026-09-18) at `sandbox/`, following this plan. Kept as the design record and for the day-one verification list in section 3, which still applies. Deviations from the plan are listed in `sandbox/README.md`.
**Audience:** the model (or person) who will build it. Written so it can be followed step by step without re-doing the research. Read the whole thing once before touching code.
**Owner:** Ames Grawert (a lawyer, not a programmer). Every message to the owner should be in plain English. The "For the owner" section below is the part the owner needs; the rest is for the builder.

---

## 0. For the owner: what this is, in plain English

You asked for a small web page, living in the Sandbox corner of amesgrawert.com, that works on an iPad or iPhone and replaces the physical dice, coins and scraps of paper Magic players use to keep track of **tokens** (creatures and objects that are created by cards during a game but are not themselves cards).

The page will let you:

- Tap a button such as **Goblin** and get a token that already knows it is a 1/1 red Goblin creature, because that is what the overwhelming majority of Goblin-making cards produce. Same for Zombie (2/2 black), Soldier (1/1 white), Treasure, Food, Clue and about 830 other token types.
- Optionally dress that token in **official card art** pulled from Scryfall, the standard public Magic database, including the Wizard of Barge Goblin from the 2026 "Goblin Storm" Secret Lair deck, or leave it as a plain coloured card.
- **Tap** a token with one touch (turn it sideways, the way Magic shows a creature has attacked or been used), raise or lower its **power and toughness**, and make **duplicates** that live as one **stack** with a number on it, so "12 Goblins" is one object, not twelve.
- **Split** a stack (for example, send 7 of 12 Goblins to attack while 5 stay home), and merge it back.
- **Delete** tokens, and when you sacrifice a Treasure or a Food the page reminds you what you get (one mana of any colour, or three life) and can add it to a small mana/life tray for you.

Everything runs in the browser. There is no account, no server, no cost, and no data leaves your device except requests to Scryfall for card art. Your game state is saved on the device so a phone call or a locked screen does not wipe your board.

**Two decisions I made on your behalf** (easy to reverse, say the word):

1. The app will live at **`amesgrawert.com/sandbox/`** and the old city-builder at `/game/` will be deleted, since you said to overwrite it. The footer link on the home page changes from "Sandbox → /game/" to "Sandbox → /sandbox/". If you would rather keep the city-builder reachable, the builder can leave `/game/` in place and only change the link.
2. The page will carry the standard Wizards of the Coast fan-content notice and will credit the artist under any card art. This keeps the site inside Wizards' Fan Content Policy and Scryfall's image rules; both are free for non-commercial personal use, and your site is exactly that.

**One thing I could not do from here:** the sandbox this plan was written in blocks scryfall.com and most Magic websites. I worked around it (details in section 3) and every fact in this document is either verified from a source I could reach or marked as "verify on day one." Nothing here is guessed.

---

## 1. The product in one page

**Name (working):** Token Table.
**URL:** `https://amesgrawert.com/sandbox/`
**Devices:** iPhone (portrait first) and iPad (landscape first). Desktop should also work but is not the target.
**Tech:** one static HTML page, one CSS file, a few plain JavaScript modules, one JSON data file. No build step, no framework, no server, no accounts. Same posture as the rest of the site (see `CLAUDE.md`).
**Persistence:** `localStorage` for the board, `IndexedDB` for user-uploaded art.
**External services:** Scryfall's public API and image CDN, and nothing else.

### Core loop

1. Player opens the page at the table.
2. Taps a token in the **palette** (a row of the most common tokens, plus search) → a stack of 1 appears on the **board**.
3. One-touch actions on a stack: tap/untap, +1 count, –1 count, +1/+1, –1/–1.
4. Long-press (or the ⋯ button) opens the stack menu: split, duplicate, choose art, rename/edit, sacrifice, delete.
5. "Next turn" button untaps everything and clears summoning sickness.
6. State autosaves; "New game" wipes the board after a confirmation.

### Must-have features (the owner's list, restated as acceptance criteria)

| # | Feature | Done when… |
|---|---|---|
| F1 | Create a known token by name | Tapping "Goblin" creates a 1/1 red Goblin creature with no art. Tapping "Treasure" creates a colorless Treasure artifact with its sacrifice text. |
| F2 | Add art or leave blank | Stack menu → "Choose art" shows a gallery of every official printing of that token (from the catalog), plus a Scryfall search for more, plus "upload a photo." Blank is the default and always available. |
| F3 | One-touch tap | A single tap on the card rotates it 90° and marks it tapped. Tapping again untaps. A stack taps as a unit. |
| F4 | One-touch P/T change | +1/+1 and –1/–1 buttons on the card change the displayed P/T immediately. |
| F5 | Duplicates as a stack | "+" on a stack raises its count; the card shows "×N". All tokens in a stack share tapped state, counters and art. |
| F6 | Split a stack | Stack menu → "Split" → pick how many move to a new stack (slider + "half" shortcut). Also: "tap 7 of 12" splits automatically into a tapped 7 and an untapped 5. |
| F7 | Delete | Swipe or menu → "Remove" (count –1) or "Remove all". A stack at count 0 disappears. |
| F8 | Sacrifice reminders | Sacrificing Treasure → "Add one mana of any color" with a colour picker that adds to the mana tray. Food → "You gain 3 life (Food costs {2} and a tap to use)." Clue → "Draw a card." Etc. Full table in section 6.3. |
| F9 | Works on iPad and iPhone | Layout tested in Playwright at iPhone 15 and iPad (10th gen) sizes, portrait and landscape, no horizontal scroll, all controls ≥ 44 px. |

### Should-have features (what players expect; from the app survey in section 5)

- Summoning-sickness marker on new creature tokens, cleared by "Next turn."
- "Untap all" / "Next turn" button.
- Attack helper: tap N of a stack in one gesture.
- Undo (last 30 actions).
- Board summary line: "14 creatures · 9 tapped · 3 Treasure · 2 Food".
- Custom token: name, type, P/T, colour, text.
- Keep the screen awake while the page is open (Wake Lock API).
- "Add to Home Screen" support (web-app manifest, icon, standalone display).
- Works offline once loaded (optional service worker; catalog is bundled anyway).

### Explicitly out of scope for v1

Life totals for multiple players, commander damage, a full game log, drag-and-drop, syncing between devices, non-token permanents, damage marked on creatures. Mention them in the README as "maybe later." A single **life counter** and a **mana tray** are in scope only because Food and Treasure reminders need somewhere to put their result.

---

## 2. Decisions already made (do not re-open without a reason)

| Decision | Choice | Why |
|---|---|---|
| Location | `/sandbox/` (new folder); delete `/game/`; change footer link | Owner said "overwrite the current one." A neutral folder name survives future swaps. |
| Framework | None. Vanilla ES modules, one `<script type="module">` | Site has no build step; keep it that way. |
| Styling | Reuse the site's tokens (paper `#f3ede1`, ink `#1a1814`, accent `#a8201a`, Cormorant Garamond + Source Serif 4) for the chrome; tokens themselves use Magic's five colours | Feels like part of the site. |
| Data source for "what is a Goblin" | Bundled `data/tokens.json`, generated from the Cockatrice community token database | Works offline, no API call needed to create a token, updated by volunteers within days of every set release. |
| Data source for art | Scryfall image CDN via `<img src>`; Scryfall API for search and artist credit | The standard; free; explicit CORS support. |
| Persistence | `localStorage` (board JSON) + `IndexedDB` (uploaded images) | `localStorage` is capped around 5 MB and is synchronous; images do not belong there. |
| Rules authority | Comprehensive Rules effective 2026-08-07 (mirror URL in section 4) | Section 111 defines tokens; 111.10 defines Treasure, Food, Clue, etc. verbatim. |
| Licensing posture | Non-commercial fan content; artist credit shown with any art; Wizards notice in footer | Required by Scryfall's image rules and the Wizards Fan Content Policy. |

---

## 3. The hard problem and how it was solved: network access

The Claude sandbox that produced this plan sits behind a proxy that returns `403` for `scryfall.com`, `cards.scryfall.io`, `mtgjson.com`, `magic.wizards.com`, `mtg.wiki`, `mtg.fandom.com` and essentially every Magic site. **Only `raw.githubusercontent.com` and `api.github.com` were reachable** (plus npm and PyPI).

What that means for the builder:

1. **You may be in the same sandbox.** Assume `fetch("https://api.scryfall.com/...")` fails during development. Do not conclude Scryfall is down; it is the proxy. Check with:
   ```bash
   curl -sS "$HTTPS_PROXY/__agentproxy/status" | head -40
   curl -sS -o /dev/null -w "%{http_code}\n" https://api.scryfall.com/cards/sld/2421
   ```
   A `403`/`000` here is the sandbox, not the internet.
2. **Everything the app needs at build time is already in this folder** (see section 4.1). The catalog was built from GitHub-hosted data precisely so that no Scryfall call is needed to ship v1.
3. **What still has to be verified from a real browser on day one** (the owner's laptop, or any session whose network policy allows scryfall.com). Put these first in the build order (milestone M0):
   - `fetch("https://api.scryfall.com/cards/sld/2421", {headers:{Accept:"application/json"}})` from a page served on `localhost` returns JSON with `access-control-allow-origin` present. Scryfall documents that it does; confirm.
   - An `<img src="https://cards.scryfall.io/art_crop/front/e/2/e265ca24-96c0-4654-a8f3-bbffe288970a.jpg">` renders (a Goblin token art crop from the Tarkir: Dragonstorm token set; the ID comes from the catalog).
   - Run `node enrich-from-scryfall.mjs tokens.json` once to fill in artist names (section 4.1). Until that has run, the gallery must fetch the artist name live when it shows an image, because the catalog ships with `artist: null`.
4. **Playwright in the sandbox cannot load Scryfall images either.** For automated tests, intercept `cards.scryfall.io` and `api.scryfall.com` with `page.route()` and serve fixtures. There is a fixture list in section 9.

---

## 4. Resource inventory

### 4.1 Files in this folder (`docs/mtg-tokens/`)

| File | What it is | How to use it |
|---|---|---|
| `HANDOFF.md` | This document. | Read first. |
| `tokens.json` | The token catalog: 834 distinct token "shapes" (name + type line + P/T + colours + rules text), each with every known official printing's Scryfall ID. 517 KB raw, 127 KB gzipped (GitHub Pages compresses). Sorted by popularity (how many real cards create that token). Source version `20260831f`. | Copy to `sandbox/data/tokens.json`. Load once, cache in memory. Schema in section 6.1. |
| `build-token-catalog.py` | Regenerates `tokens.json` from the Cockatrice database. Python 3, no dependencies. Works from the sandbox (GitHub is reachable). | `python3 build-token-catalog.py --out tokens.json`. Re-run after each new Magic set (roughly quarterly). |
| `enrich-from-scryfall.mjs` | Fills `artist`, `released_at`, `set_name`, `illustration_id` and an authoritative `art_crop` URL for every printing, using Scryfall's batch endpoint with the required headers and rate limiting. Node 18+, no dependencies. Syntax-checked; **not run** (network). | Run on a machine that can reach Scryfall: `node enrich-from-scryfall.mjs tokens.json`. Commit the result. |

Catalog facts worth knowing:

- Names are display names ("Goblin", not "Goblin Token"). Scryfall uses the same convention.
- 475 distinct names; the extra records are variants (there are 24 different "Spirit" tokens). The first record for a name is always the most common shape, so **"the default Goblin" = the first record named Goblin** (1/1 red, 58 creator cards, 47 printings). Same rule for every name.
- 77 of 2,284 printings have no Scryfall ID: old sets where the token never existed as a physical card. Skip them in the gallery.
- Image URLs are derived from the ID: `https://cards.scryfall.io/{size}/front/{id[0]}/{id[1]}/{id}.jpg` with `size ∈ small | normal | large | art_crop | border_crop`. Scryfall prefers apps to take URLs from the API rather than build them; the enrichment script replaces the derived `art_crop` with the API's own value. Until then the derived form works (it is the same pattern Cockatrice uses for every image it shows).
- The **Wizard of Barge Goblin (Secret Lair Drop, collector number 2421, released with the "Goblin Storm" Secret Lair Commander deck on 18 May 2026)** is *not* in the catalog yet (the Cockatrice file predates it or has not merged it). Add it as a hard-coded "featured art" entry that resolves at runtime via `GET https://api.scryfall.com/cards/sld/2421`, and add its ID to the Goblin record once the enrichment script or a manual lookup gives it. Do not confuse it with SLD #219, an earlier Secret Lair Goblin token by Brandi Milne.
- Wizard of Barge also sells an independent "Tome of Tokens" deck. Those illustrations are not Wizards products and are not on Scryfall. The "upload a photo" path covers players who own them.

### 4.2 External sources (all free)

| Resource | URL | Reachable from the planning sandbox? | Use |
|---|---|---|---|
| Cockatrice Magic-Token database | `https://raw.githubusercontent.com/Cockatrice/Magic-Token/master/tokens.xml` (repo: `https://github.com/Cockatrice/Magic-Token`) | **Yes** | Source of the catalog. 1,021 entries incl. emblems, counters, dungeons; the build script keeps only true tokens. Each `<set uuid=… num=…>` is a Scryfall card ID + collector number; each `<reverse-related>` is a card that creates the token. Variant tokens with the same name are distinguished by trailing spaces in `<name>`; the script strips them. |
| Comprehensive Rules, plain text mirror (effective 7 Aug 2026) | `https://raw.githubusercontent.com/nwgarne/mtg-data/data/rules.txt` (official: `https://magic.wizards.com/en/rules`) | **Yes** (official site: no) | Rule 111 (tokens), 111.10 (predefined tokens), 122 (counters), 302.6 (summoning sickness), 502.3 (untap step), 508.1f (attacking taps), 701.21 (sacrifice), 701.26 (tap/untap), 704.5d/f/q (state-based actions), 707.2 (copies). Excerpts in Appendix B. |
| Forge token scripts | `https://raw.githubusercontent.com/Card-Forge/forge/master/forge-gui/res/tokenscripts/` e.g. `r_1_1_goblin.txt`, `c_a_treasure_sac.txt` | **Yes** | Second opinion on default P/T and text if the catalog looks wrong. Not needed otherwise. |
| nwgarne/mtg-data | `https://raw.githubusercontent.com/nwgarne/mtg-data/data/mtg.db.gz` (SQLite, ~20 MB, built nightly from Scryfall bulk data) | **Yes** | Only if you need oracle text or type lines for *non-token* cards (e.g., to show which cards create a token). Not needed for v1. |
| Scryfall REST API | `https://api.scryfall.com` — docs `https://scryfall.com/docs/api` | **No** (proxy) | Live search, artist credit, featured art. Rules in section 7. |
| Scryfall image CDN | `https://cards.scryfall.io/...` — docs `https://scryfall.com/docs/api/images` | **No** (proxy) | All card images, via plain `<img>`. |
| Scryfall search syntax | `https://scryfall.com/docs/syntax` | No | Cheat sheet in Appendix C. |
| Scryfall header requirement (blog, 2024) | `https://scryfall.com/blog/user-agent-and-accept-header-now-required-on-the-api-225` | No | Browsers: do not touch User-Agent; **do** send `Accept`. |
| Scryfall CORS/CSP notes | `https://scryfall.com/docs/api/http-concerns` | No | API and image origins send CORS headers for GET/HEAD/POST/OPTIONS when an `Origin` header is present (browsers always send it). |
| Scryfall terms | `https://scryfall.com/docs/terms` | No | No paywalls, no implying endorsement, no cropping off artist/copyright, show artist and copyright next to art crops. |
| Wizards Fan Content Policy | `https://company.wizards.com/en/legal/fancontentpolicy` | No | Non-commercial only; mark as unofficial; the notice text is in section 10. |
| MTGJSON (alternative data) | `https://mtgjson.com` | No | Not needed; Cockatrice covers it. Mentioned in case a future builder prefers it. |
| Wizard of Barge Goblin token page | `https://scryfall.com/card/sld/2421/goblin` | No | Featured art. API: `https://api.scryfall.com/cards/sld/2421`. |
| Goblin Storm decklist (product context) | `https://magic.wizards.com/en/news/announcements/secret-lair-commander-deck-goblin-storm-decklist` | No | Confirms 4 foil Goblin tokens with new Wizard of Barge art ship in the deck. |

---

## 5. What players actually want (research summary)

Sources: App Store and Google Play listings for *MTG Token Tracker*, *MTG Tokens*, *MTGTokens – Token Manager*, *Lifetap*, *Dragon Counter*; MTG Salvation and BoardGameGeek threads on tracking tokens and counters in Commander; Draftsim and MTG.onl token popularity write-ups; the Cockatrice data itself (which cards create which tokens).

Findings that drive the design:

1. **Tokens come in armies.** Treasure is created by 359 distinct cards, Clue by 162, Food by 153, Zombie by 104, Saproling 86, Soldier 83, Spirit 72, Goblin 58. A Commander game routinely has 10–30 identical tokens. Hence stacks with a count, not one card per token.
2. **The two states players lose track of are "tapped" and "summoning sick."** Physical players sort tokens into two piles for exactly this reason. The app must show both at a glance and must clear both with one "Next turn" press (untap step: rule 502.3).
3. **Counters pile up unevenly.** After effects like Cathars' Crusade, some Goblins have three +1/+1 counters and others have one. That is why split must be cheap: any time one subset of a stack diverges, split it. Store counters per stack, not per token.
4. **Attacks are the moment of truth.** "Attack with 7 of my 12" must be one gesture. Implement "tap N" as split-then-tap.
5. **Table etiquette:** other players are waiting. Every core action must be one touch with no confirmation; only "New game" and "Remove all" confirm. Undo replaces confirmation dialogs.
6. **Artifact tokens have costs players forget.** Food costs {2} plus a tap, Clue costs {2}, Blood costs {1} plus a tap plus a discard, Map costs {1} plus a tap and is sorcery-speed. The sacrifice reminder must show the cost as well as the payoff.
7. **Art is a joy, not a requirement.** Existing apps advertise "hundreds of token images" and custom art. Players like picking the printing they own. Blank must stay the default because art slows creation.
8. **Existing iPad apps are paid or ad-supported and want an install.** A free, install-free web page that works from a home-screen icon is a real gap.

---

## 6. Data model

### 6.1 Catalog record (`tokens.json`, already generated)

```json
{
  "generated_at": "2026-09-18T14:45:00Z",
  "source": "https://raw.githubusercontent.com/Cockatrice/Magic-Token/master/tokens.xml",
  "source_version": "20260831f",
  "count": 834,
  "tokens": [
    {
      "id": "goblin-r-1-1-292",
      "name": "Goblin",
      "type_line": "Token Creature — Goblin",
      "types": ["Creature"],
      "subtypes": ["Goblin"],
      "is_creature": true,
      "is_artifact": false,
      "power": "1", "toughness": "1",
      "colors": ["R"],
      "text": "",
      "keywords": [],
      "makers_count": 58,
      "makers_sample": ["A Killer Among Us", "Ainok Strike Leader", "Ardoz, Cobbler of War", "..."],
      "printings_count": 47,
      "printings": [
        { "set": "tdm", "cn": "12", "id": "e265ca24-96c0-4654-a8f3-bbffe288970a", "artist": null }
      ]
    }
  ]
}
```

Notes: `power`/`toughness` are strings because some tokens are `*/*` or `0/0`-with-counters. `colors` uses W U B R G letters in that order; empty means colorless. `text` is the Oracle text; `keywords` is a convenience list pulled from single-word lines (Flying, Vigilance, …). `printings` are in Cockatrice's order, which is newest first.

### 6.2 Board state (what the app saves)

```json
{
  "version": 1,
  "turn": 7,
  "life": 40,
  "mana": { "W": 0, "U": 0, "B": 0, "R": 2, "G": 0, "C": 1 },
  "stacks": [
    {
      "uid": "s_01J8...",
      "catalog_id": "goblin-r-1-1-292",
      "name": "Goblin",
      "type_line": "Token Creature — Goblin",
      "colors": ["R"],
      "base_power": 1, "base_toughness": 1,
      "text": "",
      "count": 7,
      "tapped": true,
      "sick": false,
      "counters": { "+1/+1": 2, "-1/-1": 0 },
      "custom_counters": { "loyalty": 0 },
      "art": { "kind": "scryfall", "id": "e265ca24-...", "artist": "Kev Walker", "set": "tdm" },
      "created_turn": 5,
      "order": 3
    }
  ],
  "history": []
}
```

Rules encoded here:

- **Displayed P/T** = base + (+1/+1 counters) − (−1/−1 counters). Rule 122.1a.
- When both counter kinds are present, cancel them pairwise (rule 704.5q). Do this whenever counters change.
- If displayed toughness ≤ 0 on a creature stack, show a red warning "toughness 0: this dies" and offer Remove (rule 704.5f). Do not auto-delete; players sometimes have effects that prevent it.
- `sick` is true for creature stacks created on the current turn; "Next turn" sets `sick=false` and `tapped=false` on every stack (rules 302.6 and 502.3). Tokens with haste in `text` skip sickness.
- A stack is a set of tokens with **identical** copiable values and identical status. Merging two stacks is allowed only when everything but `count` and `uid` is equal. Split copies everything and moves `k` of `count`.
- `art.kind` is `"none" | "scryfall" | "upload"`. For uploads, `art.blob_key` points at an IndexedDB record.
- `history` holds up to 30 previous `stacks` snapshots for undo. Do not persist history.

### 6.3 Sacrifice / use reminders (verbatim from Comprehensive Rules 111.10 unless noted)

Trigger the reminder when the player chooses **Sacrifice** (or **Use**) on a stack whose `subtypes` contains one of these. Show the cost first, then the effect, then a button that applies the effect to the tray where sensible.

| Subtype | Cost to activate | Effect on sacrifice/use | Tray action offered |
|---|---|---|---|
| Treasure | {T} | Add one mana of any color | Five colour buttons; adds 1 to `mana[X]` |
| Food | {2}, {T} | You gain 3 life | "Life +3" |
| Clue | {2} | Draw a card | none (just the reminder) |
| Blood | {1}, {T}, discard a card | Draw a card | none |
| Gold | none | Add one mana of any color | colour buttons |
| Powerstone | {T} (not sacrificed) | Add {C}; can't be spent on nonartifact spells | "Colorless +1"; treat as tap, not sacrifice |
| Map | {1}, {T}; sorcery speed | Target creature you control explores | none |
| Junk | {T}; sorcery speed | Exile top card of library; you may play it this turn | none |
| Lander | {2}, {T} | Search for a basic land, put it onto the battlefield tapped, shuffle | none |
| Mutagen | {1}, {T}; sorcery speed | Put a +1/+1 counter on target creature | "Pick a stack to +1/+1" |
| Shard | {2} | Scry 1, then draw a card | none |
| Incubator | {2} | Transform into Phyrexian 0/0 artifact creature (keeps its +1/+1 counters) | "Transform": becomes a creature stack named Phyrexian Token, 0/0, with the counters it had |
| Eldrazi Spawn / Eldrazi Scion (catalog text, not 111.10) | none | Add {C} | "Colorless +1" |
| Walker (111.10d) | n/a | It is a 2/2 black Zombie creature, not an artifact | no reminder |
| Any Role (111.10j–r) | n/a | Aura attached to a creature; not sacrificed for value | no reminder |

For any other token, "Sacrifice" simply decrements the count and shows the token's own text if it has any (e.g., Pest: "When this creature dies, you gain 1 life" → offer Life +1).

---

## 7. Scryfall API cookbook (the rules that will bite you)

**Read `https://scryfall.com/docs/api` when you can reach it. Until then these are the load-bearing facts, each confirmed from Scryfall's own docs/blog via search:**

1. **Headers.** Every API request must carry an `Accept` header. From a browser, do **not** set `User-Agent` (the browser's own is fine; Scryfall says so explicitly). From Node or curl, set a descriptive one: `User-Agent: amesgrawert-token-table/1.0`. Missing headers get HTTP 400.
2. **Rate.** At most 10 requests/second; Scryfall asks for a 50–100 ms gap. Use a tiny queue (`await sleep(100)` between calls). Debounce the search box to 300 ms. Cache every response in memory and in `localStorage` with a 7-day TTL keyed by URL.
3. **CORS.** `api.scryfall.com` and all image origins send CORS headers when the request carries an `Origin` (browsers always do). `<img>` tags need no CORS at all.
4. **Tokens are "extras."** Searches exclude tokens unless you add `include_extras=true` or the query itself asks for tokens (`t:token` / `is:token`). Always pass both to be safe.
5. **Images.** Sizes: `small` (146×204), `normal` (488×680), `large` (672×936), `png` (745×1040, transparent corners), `art_crop` (varies, art only), `border_crop`. Use `art_crop` on the token face and `normal` in the gallery. Do not overlay anything on the copyright line of a full-card image; when you show an `art_crop`, print "Illus. {artist} · © Wizards of the Coast" visibly nearby (this is Scryfall's stated condition for art crops).
6. **Double-faced tokens** (Incubator // Phyrexian, Day // Night helpers) put their images under `card_faces[0].image_uris`, not `image_uris`. Check both.

### Endpoints you need

| Purpose | Request |
|---|---|
| All art for the default Goblin, newest first, one per distinct illustration | `GET https://api.scryfall.com/cards/search?q=!"Goblin" t:token c=r pow=1 tou=1&unique=art&order=released&dir=desc&include_extras=true` |
| Generic: art for any catalog token | `q = !"{name}" t:token` + (`c={colors}` or `c=c` for colorless) + (`pow={p} tou={t}` if creature) |
| Featured: the Wizard of Barge Goblin | `GET https://api.scryfall.com/cards/sld/2421` |
| One card by ID (artist name for a catalog printing) | `GET https://api.scryfall.com/cards/{id}` |
| Up to 75 cards in one call (gallery artist names) | `POST https://api.scryfall.com/cards/collection` body `{"identifiers":[{"id":"…"},…]}` |
| Search-as-you-type | `GET https://api.scryfall.com/cards/autocomplete?q=gob&include_extras=true` (returns names only; then search `!"{name}" t:token`) |
| Free-text token search from the "Any token" box | `GET https://api.scryfall.com/cards/search?q={user text} t:token&unique=cards&include_extras=true` |
| "What does card X make?" (stretch) | `GET https://api.scryfall.com/cards/named?fuzzy=krenko mob boss` → read `all_parts[]` with `component == "token"` |

Response shape you rely on: `data[]` of Card objects with `id`, `name`, `type_line`, `oracle_text`, `power`, `toughness`, `colors`, `artist`, `illustration_id`, `set`, `set_name`, `collector_number`, `released_at`, `image_uris{small,normal,large,png,art_crop,border_crop}` (or `card_faces[]`). Pagination: `has_more` + `next_page`. A 404 with `object: "error"` means zero results, not a failure.

### Minimal client (`js/scryfall.js`)

```js
const BASE = "https://api.scryfall.com";
const queue = []; let running = false;
function schedule(fn) { return new Promise((res, rej) => { queue.push({ fn, res, rej }); pump(); }); }
async function pump() {
  if (running) return; running = true;
  while (queue.length) { const { fn, res, rej } = queue.shift();
    try { res(await fn()); } catch (e) { rej(e); } await new Promise(r => setTimeout(r, 100)); }
  running = false;
}
export function api(path, init = {}) {
  const url = path.startsWith("http") ? path : BASE + path;
  const cached = readCache(url); if (cached) return Promise.resolve(cached);
  return schedule(async () => {
    const r = await fetch(url, { ...init, headers: { Accept: "application/json", ...(init.headers || {}) } });
    if (r.status === 404) return { object: "list", data: [], has_more: false };
    if (!r.ok) throw new Error(`Scryfall ${r.status}`);
    const j = await r.json(); writeCache(url, j); return j;
  });
}
export const imgUrl = (id, size = "art_crop") => `https://cards.scryfall.io/${size}/front/${id[0]}/${id[1]}/${id}.jpg`;
```

`readCache`/`writeCache`: `localStorage` key `sf:` + url, value `{t: Date.now(), j}`; ignore entries older than 7 days; wrap in try/catch (private mode throws).

---

## 8. Interface design

### 8.1 Layout

```
iPhone, portrait (390×844)                iPad, landscape (1180×820)
┌──────────────────────────────┐          ┌──────────────────────────────────────────────────┐
│ ← amesgrawert.com  Token Table│          │ ← amesgrawert.com  Token Table   turn 7  [Next ▶]│
│ turn 7  [Undo] [Next turn ▶]  │          ├──────────┬───────────────────────────────────────┤
├──────────────────────────────┤          │ PALETTE  │ BOARD (wrapping grid of stacks)       │
│ BOARD                        │          │ Goblin   │ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│ ┌────────┐ ┌────────┐        │          │ Zombie   │ │ ×7  │ │ ×5  │ │ ×3  │ │ ×1  │       │
│ │  ×7    │ │  ×5    │        │          │ Soldier  │ │Gobln│ │Gobln│ │Treas│ │Angel│       │
│ │ Goblin │ │ Goblin │        │          │ Spirit   │ │ 3/3 │ │ 1/1 │ │     │ │ 4/4 │       │
│ │  3/3   │ │  1/1   │        │          │ Treasure │ └─────┘ └─────┘ └─────┘ └─────┘       │
│ │[-][+][+1/+1][⋯]│ ...       │          │ Food     │                                       │
│ └────────┘ └────────┘        │          │ Clue     │                                       │
│ ...                          │          │ Zombie   │                                       │
├──────────────────────────────┤          │ + Any…   │                                       │
│ TRAY  life 40  W0 U0 B0 R2 G0 C1│        │ + Custom │                                       │
├──────────────────────────────┤          ├──────────┴───────────────────────────────────────┤
│ PALETTE (horizontal scroll)  │          │ TRAY  life 40 [–][+]   mana W U B R G C  [clear] │
│ [Goblin][Zombie][Soldier]…[+]│          └──────────────────────────────────────────────────┘
└──────────────────────────────┘
```

- **Stack card** is a rounded rectangle in the Magic colour of the token (white = cream, blue, black = dark grey, red, green, colorless = light grey, multicolour = gold), 2.5:3.5 aspect like a card, minimum 140 px wide on phone, 180 px on iPad. Art crop fills the top 55 % when present. Name, type line (small), P/T bottom-right (big), count badge top-left ("×7"), tapped = rotate 90° (CSS transform) with a 150 ms ease, sick = small "zzz" badge top-right.
- **On-card buttons** (always visible, ≥ 44 px): `−` count, `+` count, `+1/+1`, `−1/−1`, `⋯`. Tapping the art/name area taps or untaps the whole stack.
- **Long-press** anywhere on the card also opens the `⋯` menu (use `pointerdown` + 450 ms timer; cancel on `pointermove` > 8 px).
- **Menu** (bottom sheet on phone, popover on iPad): Tap N of X · Split… · Duplicate (new stack, same state) · Choose art… · Edit (name/P/T/text/colours) · Sacrifice / Use · Remove one · Remove all · Merge into… (lists compatible stacks).
- **Split sheet:** a slider from 1 to count−1, "Half" and "All but one" shortcuts, a toggle "tap the moved ones."
- **Palette:** first 16 catalog tokens by popularity, filtered to ones players actually create in numbers (drop Orc Army / Zombie Army 0/0 "Army" tokens from the quick row; they are one-per-player amass tokens), then "Any token…" (search box over the catalog, with a "Search Scryfall" fallback) and "Custom…".
- **Tray:** life with −/+ (long-press for ±5), six mana pips with tap to spend (−1) and long-press to add, "Clear mana" (end of phase reminder, since unspent mana empties).
- **Header:** turn number, Undo, Next turn, overflow menu with New game, Keep screen awake toggle, About/credits.

### 8.2 Touch and iOS specifics (all verified against current Safari behaviour as of 2026)

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`; pad with `env(safe-area-inset-*)`.
- `html { touch-action: manipulation; -webkit-text-size-adjust: 100%; }` removes the 300 ms double-tap-zoom delay; supported on iOS Safari.
- `.card, button { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }` so long-press does not select text or pop the image save sheet.
- Use Pointer Events, not touch/mouse events. Prevent ghost clicks by handling `pointerup` only.
- `min-height: 100dvh` for the shell; avoid `100vh` (Safari toolbar bug).
- Home-screen install: `<link rel="manifest" href="manifest.webmanifest">` with `display: "standalone"`, `background_color: "#f3ede1"`, icons 192/512; plus `<meta name="apple-mobile-web-app-capable" content="yes">`, `<meta name="apple-mobile-web-app-status-bar-style" content="default">`, `<link rel="apple-touch-icon" href="/apple-touch-icon.png">` (the site already has one; a token-specific one is nicer but optional). iOS 26 opens any home-screen site as a web app by default.
- Wake Lock: `navigator.wakeLock?.request("screen")` on first user gesture; re-request on `visibilitychange` → visible. Works in Safari 16.4+ and inside home-screen web apps since iOS 18.4. Feature-detect; never error if absent.
- Save state on every mutation (`localStorage.setItem`, debounced 100 ms) **and** on `visibilitychange` → hidden and `pagehide`; iOS kills background tabs.
- No hover-only affordances. No `alert()`/`confirm()` (ugly on iOS; build an in-page sheet).
- Prefer `prefers-reduced-motion` check before rotating cards with animation.

---

## 9. Build plan (milestones with acceptance checks)

Work on branch `claude/beautiful-lamport-gonpaz` unless told otherwise. Commit after each milestone. Do not open a PR unless asked.

**M0 — Verify the network assumptions (30 min, needs a real browser or an unblocked session).**
Run the three checks listed in section 3 (item 3). If CORS fails (it should not), fall back: gallery uses catalog printings only via `<img>`; search box uses catalog only; note it in README.

**M1 — Skeleton (1–2 h).**
Create `sandbox/index.html`, `sandbox/css/tokens.css`, `sandbox/js/{app,state,catalog,scryfall,store,ui}.js`, `sandbox/data/tokens.json` (copy), `sandbox/manifest.webmanifest`. `<meta name="robots" content="noindex">` like the old game. Header with back-link to `/`. Delete `game/`. Change the footer link in `index.html` from `/game/` to `/sandbox/`. Update `CLAUDE.md` file layout and add a "Sandbox" section. *Check:* page loads on `python3 -m http.server` at the repo root, no console errors, catalog parses (834 tokens).

**M2 — Palette and stacks (2–3 h).**
Palette buttons create stacks; card renders name/type/P/T/colour; count +/−; tap/untap by tapping the card; `Next turn` untaps all and clears sickness; autosave/restore. *Check:* create Goblin → shows "1/1", red frame, "zzz"; tap → rotates; reload → still there.

**M3 — Counters and P/T (1 h).**
+1/+1 and −1/−1 buttons; pairwise cancellation; toughness-0 warning; per-stack custom counter (name + number) in Edit. *Check:* Goblin with two +1/+1 and one −1/−1 shows 2/2 and counters read "+1/+1 ×1".

**M4 — Split, merge, tap-N, duplicate, undo (2 h).**
Split sheet; merge into compatible stack; "Tap 7 of 12" produces two stacks; Duplicate; Undo with 30 snapshots. *Check:* the 12-Goblin scenario in section 11.

**M5 — Sacrifice/use reminders and tray (1–2 h).**
Section 6.3 table; life and mana tray; Treasure → colour picker adds mana; Food → Life +3; Powerstone taps instead of sacrificing; Incubator transforms. *Check:* each row of the table manually.

**M6 — Art gallery (2–3 h).**
"Choose art" sheet: (a) Featured (hard-coded list: `sld/2421` Wizard of Barge Goblin; add 3–5 more crowd favourites later), (b) Catalog printings for this token as a grid of `normal` images lazy-loaded (`loading="lazy"`), each labelled with set code and, once known, artist, (c) "More on Scryfall" button running the section 7 search, (d) "Upload photo" (`<input type="file" accept="image/*">`, downscale to 600 px longest side with `<canvas>`, store the Blob in IndexedDB, keep a `blob_key`). Artist credit line under any art on the card (fetch via `/cards/{id}` if the catalog has `artist: null`; cache). *Check:* pick art for Goblin → art crop on card, "Illus. …" line present; offline reload still shows uploaded art.

**M7 — Any token and custom tokens (1–2 h).**
Catalog search (name + subtype, case-insensitive, first 30 results, most popular first), then Scryfall fallback search; Custom form. *Check:* type "sap" → Saproling; type "Mite" → Phyrexian Mite 1/1 toxic; custom "Shrimp 3/3 blue" works.

**M8 — Mobile polish and install (1–2 h).**
Section 8.2 list; manifest; wake lock toggle; safe areas; landscape/portrait; reduced-motion. *Check:* Playwright screenshots at iPhone 15 (393×852), iPhone SE (375×667), iPad 10th gen (820×1180 and 1180×820); no horizontal scroll; all hit targets ≥ 44 px (script it: iterate `button` bounding boxes).

**M9 — Credits, README, CLAUDE.md, push.**
Footer of the app: fan-content notice (section 10), "Card data via Scryfall and the Cockatrice Magic-Token project," link back to the site. README in `sandbox/` for the owner. Commit, `git push -u origin claude/beautiful-lamport-gonpaz`.

**Stretch (only after M9):** service worker for offline shell; "what does this card make" via `all_parts`; multiple boards (one per player); share board as a link (state in URL hash); damage marked on creatures; keyboard shortcuts on desktop.

### Playwright fixtures (for the sandbox)

```js
await page.route("https://api.scryfall.com/**", r => r.fulfill({ json: fixtureFor(r.request().url()) }));
await page.route("https://cards.scryfall.io/**", r => r.fulfill({ path: "tests/fixtures/art.jpg", contentType: "image/jpeg" }));
```
`fixtureFor` returns a Card object for `/cards/sld/2421` (name "Goblin", artist "Wizard of Barge", `image_uris.art_crop` any URL) and a `list` for `/cards/search`. Chromium is preinstalled at `/opt/pw-browsers`; do not run `playwright install`.

---

## 10. Legal and attribution text (put this in the app footer, verbatim)

> Token Table is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. © Wizards of the Coast LLC.
>
> Card images and data courtesy of Scryfall (scryfall.com). Token definitions from the Cockatrice Magic-Token project. Rules text from the Magic: The Gathering Comprehensive Rules. Artwork is credited to its illustrator wherever shown.

Rules to honour in code: never crop or cover the artist/copyright line of a full-card image; when using `art_crop`, show the artist's name next to it; no ads, no paywall, no logos of Wizards or Scryfall; do not present the page as official.

---

## 11. Worked scenario (use it as the manual test script)

1. New game. Tap **Goblin** twelve times, or tap once and press `+` eleven times. Board shows one stack "Goblin ×12, 1/1", red, "zzz".
2. Press **Next turn**. "zzz" disappears, turn = 2.
3. Menu → **Tap 7 of 12**. Board now shows "Goblin ×7" rotated and "Goblin ×5" upright.
4. On the ×7 stack press **+1/+1** twice. It reads 3/3, counters "+1/+1 ×2". The ×5 stack still reads 1/1.
5. Tap **Treasure** three times (three Treasures). Menu on Treasure → **Sacrifice** → pick red. Treasure ×2 remains; tray shows R 1.
6. Tap **Food**. Menu → **Sacrifice**. Reminder shows "{2}, {T}: you gain 3 life" → **Life +3**. Life 43.
7. Press **Undo** twice. Life 40, Food back, Treasure ×3, tray R 0.
8. Choose art on the ×7 Goblins → Featured → Wizard of Barge. Card shows art, "Illus. Wizard of Barge" underneath.
9. Press **Next turn**. Both Goblin stacks untap. Menu on ×5 → **Merge into ×7**? Should be refused: counters differ ("Stacks differ: +1/+1 counters"). Remove the counters, merge → "Goblin ×12".
10. Lock the phone, unlock, reload. Board identical.

---

## 12. Risks and open questions for the owner

| Item | Why it matters | Default if no answer |
|---|---|---|
| Keep `/game/` alive? | Deleting is what "overwrite" implies, but the city-builder was real work. | Delete; it stays in git history. |
| Life counter for one player only? | Multi-player life tracking is a different app. | One life total, one mana tray. |
| Which "featured" art beyond Wizard of Barge? | Taste. | Ship the one; add more on request. |
| Hotlinking Scryfall images at volume | Scryfall allows it for normal use; a personal site is far below any threshold. | Lazy-load, cache, use `small`/`normal` in galleries. |
| Scryfall changes its header or CORS rules | Would break search/art, not the core tray. | The app must degrade to catalog-only and blank tokens without errors. |
| Cockatrice data lags new sets by days to weeks | New tokens (e.g., the 2026 Goblin) missing from the palette. | Re-run the build script quarterly; the Scryfall search fallback covers the gap. |

---

## Appendix A — The 45 most-created tokens (from the catalog; "cards that make it" counts distinct real cards)

| # | Token | Type line | P/T | Color | Rules text / keywords | Cards that make it | Printings |
|---|---|---|---|---|---|---|---|
| 1 | Treasure | Token Artifact - Treasure | — | colorless | {T}, Sacrifice this token: Add one mana of any color. | 359 | 57 |
| 2 | Clue | Token Artifact - Clue | — | colorless | {2}, Sacrifice this token: Draw a card. | 162 | 37 |
| 3 | Food | Token Artifact - Food | — | colorless | {2}, {T}, Sacrifice this token: You gain 3 life. | 153 | 32 |
| 4 | Zombie | Token Creature - Zombie | 2/2 | black | — | 104 | 62 |
| 5 | Saproling | Token Creature - Saproling | 1/1 | green | — | 86 | 43 |
| 6 | Soldier | Token Creature - Soldier | 1/1 | white | — | 83 | 50 |
| 7 | Spirit | Token Creature - Spirit | 1/1 | white | Flying | 72 | 43 |
| 8 | Goblin | Token Creature - Goblin | 1/1 | red | — | 58 | 47 |
| 9 | Human Soldier | Token Creature - Human Soldier | 1/1 | white | — | 51 | 17 |
| 10 | Thopter | Token Artifact Creature - Thopter | 1/1 | colorless | Flying | 49 | 29 |
| 11 | Wolf | Token Creature - Wolf | 2/2 | green | — | 43 | 26 |
| 12 | Blood | Token Artifact - Blood | — | colorless | {1}, {T}, Discard a card, Sacrifice this artifact: Draw a card. | 39 | 8 |
| 13 | Servo | Token Artifact Creature - Servo | 1/1 | colorless | — | 37 | 12 |
| 14 | Squirrel | Token Creature - Squirrel | 1/1 | green | — | 35 | 15 |
| 15 | Eldrazi Spawn | Token Creature - Eldrazi Spawn | 0/1 | colorless | Sacrifice this creature: Add {C}. | 33 | 11 |
| 16 | Incubator | Token Artifact - Incubator | — | colorless | {2}: Transform this artifact. | 33 | 2 |
| 17 | Powerstone | Token Artifact - Powerstone | — | colorless | {T}: Add {C}. This mana can't be spent to cast a nonartifact spell. | 33 | 2 |
| 18 | Human | Token Creature - Human | 1/1 | white | — | 32 | 19 |
| 19 | Orc Army | Token Creature - Orc Army | 0/0 | black | — | 30 | 1 |
| 20 | Elf Warrior | Token Creature - Elf Warrior | 1/1 | green | — | 29 | 15 |
| 21 | Hero | Token Creature - Hero | 1/1 | colorless | — | 28 | 8 |
| 22 | Insect | Token Creature - Insect | 1/1 | green | — | 28 | 17 |
| 23 | Ally | Token Creature - Ally | 1/1 | white | — | 26 | 5 |
| 24 | Fractal | Token Creature - Fractal | 0/0 | blue/green | — | 26 | 4 |
| 25 | Knight | Token Creature - Knight | 2/2 | white | Vigilance | 25 | 12 |
| 26 | Beast | Token Creature - Beast | 3/3 | green | — | 24 | 42 |
| 27 | Eldrazi Scion | Token Creature - Eldrazi Scion | 1/1 | colorless | Sacrifice this creature: Add {C}. | 24 | 12 |
| 28 | Zombie Army | Token Creature - Zombie Army | 0/0 | black | — | 24 | 7 |
| 29 | Citizen | Token Creature - Citizen | 1/1 | white/green | — | 22 | 3 |
| 30 | Bird | Token Creature - Bird | 1/1 | white | Flying | 21 | 18 |
| 31 | Phyrexian Germ | Token Creature - Phyrexian Germ | 0/0 | black | — | 21 | 14 |
| 32 | Warrior | Token Creature - Warrior | 1/1 | red | — | 21 | 2 |
| 33 | Lander | Token Artifact - Lander | — | colorless | {2}, {T}, Sacrifice this token: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle. | 20 | 5 |
| 34 | Spirit | Token Creature - Spirit | 1/1 | white/black | Flying | 20 | 11 |
| 35 | Mutagen | Token Artifact - Mutagen | — | colorless | {1}, {T}, Sacrifice this token: Put a +1/+1 counter on target creature. Activate only as a sorcery. | 19 | 1 |
| 36 | Spirit | Token Creature - Spirit | 1/1 | colorless | — | 19 | 7 |
| 37 | Angel | Token Creature - Angel | 4/4 | white | Flying | 18 | 27 |
| 38 | Dragon | Token Creature - Dragon | 5/5 | red | Flying | 16 | 15 |
| 39 | Mercenary | Token Creature - Mercenary | 1/1 | red | {T}: Target creature you control gets +1/+0 until end of turn. Activate only as a sorcery. | 16 | 1 |
| 40 | Pest | Token Creature - Pest | 1/1 | black/green | When this creature dies, you gain 1 life. | 16 | 4 |
| 41 | Rat | Token Creature - Rat | 1/1 | black | This creature can't block. | 16 | 2 |
| 42 | Rebel | Token Creature - Rebel | 2/2 | red | — | 16 | 2 |
| 43 | Wicked // Cursed | Token Enchantment - Aura Role // Aura Role | — | colorless | Role tokens (Auras) | 16 | 1 |
| 44 | Zombie (Decayed) | Token Creature - Zombie | 2/2 | black | Decayed (can't block; sacrifice at end of combat when it attacks) | 16 | 3 |
| 45 | Goblin Army | Token Creature - Goblin Army | 0/0 | black | — | 15 | 2 |

Suggested **quick palette** (16): Goblin, Zombie, Soldier, Spirit, Saproling, Elf Warrior, Thopter, Human, Wolf, Beast, Angel, Dragon, Treasure, Food, Clue, Blood. Everything else is one search away.

## Appendix B — Rules excerpts (Comprehensive Rules effective 7 August 2026, verbatim)

**111.1.** Some effects put tokens onto the battlefield. A token is a marker used to represent any permanent that isn't represented by a card.

**111.4.** A spell or ability that creates a token sets both its name and its subtype(s). If the spell or ability doesn't specify the name of the token, its name is the same as its subtype(s) plus the word "Token." Once a token is on the battlefield, changing its name doesn't change its subtype(s), and vice versa.

**111.7.** A token that's in a zone other than the battlefield ceases to exist. This is a state-based action; see rule 704.

**111.8.** A token that has left the battlefield can't move to another zone or come back onto the battlefield.

**111.10.** Some effects instruct a player to create a predefined token. These effects use the definition below to determine the characteristics the token is created with.
- 111.10a A Treasure token is a colorless Treasure artifact token with "{T}, Sacrifice this token: Add one mana of any color."
- 111.10b A Food token is a colorless Food artifact token with "{2}, {T}, Sacrifice this token: You gain 3 life."
- 111.10c A Gold token is a colorless Gold artifact token with "Sacrifice this token: Add one mana of any color."
- 111.10d A Walker token is a 2/2 black Zombie creature token named Walker.
- 111.10e A Shard token is a colorless Shard enchantment token with "{2}, Sacrifice this token: Scry 1, then draw a card."
- 111.10f A Clue token is a colorless Clue artifact token with "{2}, Sacrifice this token: Draw a card."
- 111.10g A Blood token is a colorless Blood artifact token with "{1}, {T}, Discard a card, Sacrifice this token: Draw a card."
- 111.10h A Powerstone token is a colorless Powerstone artifact token with "{T}: Add {C}. This mana can't be spent to cast a nonartifact spell."
- 111.10i An Incubator token is a double-faced token. Its front face is a colorless Incubator artifact with "{2}: Transform this token." Its back face is a 0/0 colorless Phyrexian artifact creature named Phyrexian Token.
- 111.10j–r Role tokens (Cursed, Monster, Royal, Sorcerer, Virtuous, Wicked, Young Hero): colorless Aura Role enchantment tokens with enchant creature and the listed effect.
- 111.10s A Map token is a colorless Map artifact token with "{1}, {T}, Sacrifice this token: Target creature you control explores. Activate only as a sorcery."
- 111.10t A Junk token is a colorless Junk artifact token with "{T}, Sacrifice this token: Exile the top card of your library. You may play that card this turn. Activate only as a sorcery."
- 111.10u A Lander token is a colorless Lander artifact token with "{2}, {T}, Sacrifice this token: Search your library for a basic land card, put it onto the battlefield tapped, then shuffle."
- 111.10v A Mutagen token is a colorless Mutagen artifact token with "{1}, {T}, Sacrifice this token: Put a +1/+1 counter on target creature. Activate only as a sorcery."
- 111.10w A Vibranium token is a colorless Vibranium artifact token with indestructible and "{T}: Add {C}. This mana can't be spent to cast a nonartifact spell."

**122.1.** A counter is a marker placed on an object or player that modifies its characteristics and/or interacts with a rule, ability, or effect. … Notably, a counter is not a token, and a token is not a counter.
**122.1a** A +X/+Y counter on a creature … adds X to that object's power and Y to that object's toughness. Similarly, -X/-Y counters subtract from power and toughness.
**122.3.** If a permanent has both a +1/+1 counter and a -1/-1 counter on it, N +1/+1 and N -1/-1 counters are removed from it as a state-based action, where N is the smaller of the number of +1/+1 and -1/-1 counters on it.

**302.6.** A creature's activated ability with the tap symbol or the untap symbol in its activation cost can't be activated unless the creature has been under its controller's control continuously since their most recent turn began. A creature can't attack unless it has been under its controller's control continuously since their most recent turn began. This rule is informally called the "summoning sickness" rule.

**502.3.** Third, the active player determines which permanents they control will untap. Then they untap them all simultaneously.

**508.1f** The active player taps the chosen creatures. Tapping a creature when it's declared as an attacker isn't a cost; attacking simply causes creatures to become tapped.

**701.21a** To sacrifice a permanent, its controller moves it from the battlefield directly to its owner's graveyard. … Sacrificing a permanent doesn't destroy it.

**701.26a** To tap a permanent, turn it sideways from an upright position. Only untapped permanents can be tapped.
**701.26b** To untap a permanent, rotate it back to the upright position from a sideways position. Only tapped permanents can be untapped.

**704.5d** If a token is in a zone other than the battlefield, it ceases to exist.
**704.5f** If a creature has toughness 0 or less, it's put into its owner's graveyard. Regeneration can't replace this event.

**707.2.** When copying an object, the copy acquires the copiable values of the original object's characteristics … Other effects (including type-changing and text-changing effects), status, counters, and stickers are not copied. *(So "Duplicate" in the app should offer "copy as printed" as well as "copy with counters"; the former is what Magic's copy effects do, the latter is what players mean when they say "give me five more of these.")*

## Appendix C — Scryfall search cheat sheet for tokens

| Want | Query |
|---|---|
| All tokens named exactly Goblin | `!"Goblin" t:token` |
| Only the 1/1 red one | `!"Goblin" t:token c=r pow=1 tou=1` |
| One result per distinct illustration | add `unique:art` (or `&unique=art` in the API URL) |
| Newest first | `order:released` + `dir:desc` (API: `&order=released&dir=desc`) |
| Colorless | `c=c` ; multicolour exactly W and B: `c=wb` |
| By artist | `a:"Wizard of Barge" t:token` |
| From a specific token set | `set:tsld` / `set:tblb` (token sets are usually `t` + the parent set code; Secret Lair tokens live in `sld` itself) |
| Creature type across all tokens | `t:token t:goblin` |
| Free text | `goblin t:token` |
| Include tokens in any search | API param `include_extras=true` |
| Cards that create a token (stretch) | fetch the card, read `all_parts[].component == "token"` |

## Appendix D — Glossary for the owner

- **Token:** a game piece created by a card effect, not a card itself. Ceases to exist if it leaves the battlefield.
- **Tap:** turn a permanent sideways to show it has been used (attacked, or paid a cost). Everything untaps at the start of your turn.
- **Summoning sickness:** a creature cannot attack or use tap abilities the turn it arrives. Tokens are creatures; the rule applies to them.
- **Power/Toughness (P/T):** damage it deals / damage it can take, written 1/1. Counters change it.
- **+1/+1 counter:** a marker that raises P/T by one each. −1/−1 lowers it. One of each cancel out.
- **Sacrifice:** put your own permanent in the graveyard as a cost. Treasure, Food and Clue are sacrificed to use them.
- **Scryfall:** the free, community-run database and image archive of every Magic card, with a public programming interface.
- **Cockatrice:** free online Magic-playing software; its volunteers maintain the token list this app uses.
- **Secret Lair:** Wizards' direct-to-consumer line of special-art reprints. The "Goblin Storm" Commander deck (May 2026) features Wizard of Barge's art, including the Goblin token.

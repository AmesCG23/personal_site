# CLAUDE.md — amesgrawert.com

Personal site for Ames Grawert. Static HTML/CSS, hosted on GitHub Pages at `amesgrawert.com`.

## Stack

- **Hosting**: GitHub Pages, deployed via `.github/workflows/deploy.yml` on every push to `main`
- **Domain**: `amesgrawert.com` — custom domain in `CNAME`, DNS via four A records in Route 53 pointing at GitHub Pages IPs (185.199.108–111.153) plus a `www` CNAME to `amescg23.github.io`
- **Fonts**: Cormorant Garamond (display) + Source Serif 4 (body), loaded from Google Fonts
- **No build step.** `index.html` and `assets/css/style.css` are the whole site.

## Design

Implements **wireframe direction G — Hybrid + Photo**:

- **Intro**: two-column CSS grid (`1fr auto`) — text column (name, role, bio) on the left, portrait flush right. No float.
- **Name**: Cormorant Garamond, 56px, weight 500
- **Role line**: italic, 15px, `--ink-soft-text`
- **Bio**: Source Serif 4, 16px
- **Selected Writing**: typeset entries in a `64px 1fr` grid — year / title (display font, 24px) / dek / source, ordered reverse-chronologically
- **Press & Video**: `1fr 260px` grid — press citations on the left (display font links, outlet + date below), 16:9 YouTube embed on the right
- **Footer**: `email · linkedin · bluesky · makerworld · github`, all external links open in new tab

Color tokens (defined in `assets/css/style.css`):

| Token | Value | Role |
|---|---|---|
| `--paper` | `#f3ede1` | Page background |
| `--ink` | `#1a1814` | Primary text / borders |
| `--ink-soft` | `#c9c1b1` | Subtle borders |
| `--ink-soft-text` | `#5e564a` | Secondary text, deks, captions |
| `--accent` | `#a8201a` | Hover underlines |
| `--display` | Cormorant Garamond | Name, article titles, press links |
| `--body` | Source Serif 4 | Everything else |

## Metadata, SEO & favicon

The `<head>` of `index.html` carries the discoverability layer:

- **Title**: `Ames Grawert · Policy Attorney & Public Affairs Expert`; matching `meta description` and `canonical` (`https://amesgrawert.com/`)
- **Open Graph + Twitter card**: `og:type profile`, title/description mirroring the meta tags, `og:image` = absolute URL to `assets/img/portrait.jpg` (1200×801), `twitter:card summary_large_image` — so LinkedIn/Bluesky shares unfurl with the portrait
- **JSON-LD**: `Person` schema (name, jobTitle, worksFor Brennan Center, `sameAs` → LinkedIn/Bluesky/MakerWorld/GitHub) for Google name-search results
- **Favicon**: "AG" monogram, Cormorant Garamond Bold, accent red `#a8201a` on paper `#f3ede1`. Three files at repo root: `favicon.svg` (true vector, built from glyph outlines), `favicon.ico` (48/32/16), `apple-touch-icon.png` (180×180). Regenerate by re-running the generator script against the Cormorant Garamond TTF if the palette or monogram changes.

## Content

All content is live — no placeholders remain.

- **Portrait**: `assets/img/portrait.jpg` (1200×801, 182 KB). Cropped and framed via `object-fit: cover` + `object-position: center 30%`.
- **Selected Writing**: 7 entries (2020–2026), Brennan Center and NY Daily News
- **Press & Video**: 4 citations (chronological, most recent first); Atlantic Festival 2022 YouTube embed at `t=1491`
- **Footer links**: `ames.grawert@gmail.com` · LinkedIn · Bluesky · MakerWorld · GitHub

## Under Construction banner

The banner is **commented out** — the code is preserved for future use but nothing displays. To re-enable:

1. Uncomment the `<link>` tag in `index.html` `<head>` marked `<!-- UC-BANNER-LINK -->`
2. Uncomment the `<div id="uc-banner">` block between `<!-- UC-BANNER-START -->` and `<!-- UC-BANNER-END -->`

To remove it permanently:

1. Delete the `<link>` tag in `<head>` marked `UC-BANNER-LINK`
2. Delete everything between `<!-- UC-BANNER-START -->` and `<!-- UC-BANNER-END -->` in `index.html`
3. Delete `assets/css/uc-banner.css`

Nothing in `style.css` or the main markup depends on any of the above.

## File layout

```
index.html                 Main page
favicon.svg                Vector favicon ("AG" monogram)
favicon.ico                Legacy favicon (48/32/16)
apple-touch-icon.png       iOS home-screen icon (180×180)
assets/
  css/
    style.css              All page styles + design tokens
    uc-banner.css          Geocities UC banner (commented out — keep or delete)
  img/
    portrait.jpg           Headshot (1200×801)
sandbox/                   Token Table (see below)
meet/                      Meet scheduling poll (hidden; see below)
docs/mtg-tokens/           Token Table plan, catalog builder, enrichment script
docs/meet/                 Meet's Google Apps Script (Code.gs), SETUP.md, icon + preview-card generators
CNAME                      Custom domain (amesgrawert.com)
.nojekyll                  Disables Jekyll processing on GitHub Pages
.github/
  workflows/
    deploy.yml             Deploys repo root to GitHub Pages on push to main
```

## Sandbox: Token Table (`/sandbox/`)

A Magic: The Gathering token tray for iPad/iPhone, linked from the footer as "Sandbox". Static, no build step, vanilla ES modules. Plan and research: `docs/mtg-tokens/HANDOFF.md`.

- `sandbox/index.html`, `sandbox/css/tokens.css`, `sandbox/js/` (`app.js` entry; `state.js` board, undo, and the anthem power/toughness math; `ui.js` rendering and sheets; `catalog.js` token lookup; `scryfall.js` API client; `store.js` localStorage + IndexedDB; `reminders.js` sacrifice text; `anthems.js` the 16 anthem enchantment/artifact definitions, toggled under ⋯ → "Anthems & effects")
- `sandbox/data/tokens.json` — token catalog (834 token shapes, Scryfall printing ids). Regenerate with `python3 docs/mtg-tokens/build-token-catalog.py --out sandbox/data/tokens.json`; then optionally `node docs/mtg-tokens/enrich-from-scryfall.mjs sandbox/data/tokens.json` on a machine that can reach api.scryfall.com to fill in artist names.
- `sandbox/manifest.webmanifest` + `sandbox/icons/` — home-screen install. Regenerate PNG icons with `node sandbox/tests/make-icons.mjs` after editing `icon.svg`.
- `sandbox/tests/smoke.mjs` — Playwright smoke test (run a static server on the repo root at port 8123, then `node sandbox/tests/smoke.mjs`). Stubs Scryfall; checks the handoff's worked scenario, layout at phone/tablet sizes, 44 px hit targets.
- Legal: unofficial Fan Content notice and Scryfall/Cockatrice credits live in the About sheet (`ui.js`, `aboutSheet`). Keep artist credit next to any art crop.
- The old `/game/` city-builder was removed in favour of this (still in git history).

## Hidden page: Meet (`/meet/`)

A Doodle-style scheduling poll. **Not linked from anywhere** on the site and marked `noindex`. Keep it that way: don't add it to the footer or a robots.txt (a robots.txt entry would itself advertise the path). Details: `meet/README.md`. Owner-facing setup guide: `docs/meet/SETUP.md`.

- Static page (`meet/index.html`, `meet/css/meet.css`, `meet/js/`) talks to a Google Apps Script web app (`docs/meet/Code.gs`) that stores polls in a Google Sheet. One Sheet holds every poll, kept apart by event ID, so there's no wiping between events. Tabs: `Events`, `Responses` (one row per person per time).
- `meet/js/config.js` holds the Apps Script `/exec` URL. It's empty until the owner deploys the script; the page then shows a "not connected" note.
- The creator passcode and notification email are set **only in the Google copy** of `Code.gs`. Never commit them: the repo copy is published on the site.
- Links: `?e=ID` is the friend link; `?e=ID&k=ADMINKEY` is the organizer view (close/reopen, choose the final time, remove answers).
- **Own icon, not the site's:** pixel-art Magic card back (`meet/icons/`, plus `meet/manifest.webmanifest` for "Add to Home Screen"). The main site keeps the AG monogram. Regenerate with `python3 docs/meet/make-icons.py`.
- **Link preview:** `meet/img/social-card.jpg` (1200×630), set as `og:image`. Built from `docs/meet/card-art-opt.webp` (*Opt*, by John Howe, © Wizards of the Coast) by `node docs/meet/make-card.mjs`. The artist credit is on the card, and the Fan Content notice is in the page footer. Keep both.
- Tests: `node meet/tests/backend.test.mjs` (Code.gs against a pretend Sheet), then `node meet/tests/smoke.mjs` with a static server on port 8123 (full browser run against the same pretend Sheet).

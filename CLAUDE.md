# CLAUDE.md — amesgrawert.com

Personal site for Ames Grawert. Static HTML/CSS, hosted on GitHub Pages at `amesgrawert.com`.

## Stack

- **Hosting**: GitHub Pages, deployed via `.github/workflows/deploy.yml` on every push to `main`
- **Domain**: `amesgrawert.com` — custom domain registered in `CNAME`, DNS pointed at GitHub Pages via four A records in Route 53
- **Fonts**: Cormorant Garamond (display) + Source Serif 4 (body), loaded from Google Fonts
- **No build step.** `index.html` and `assets/css/style.css` are the whole site.

## Design

Implements **wireframe direction G — Hybrid + Photo** from the `Personal_Website_2.zip` wireframe set:

- Floating portrait (right), name and role wrap around it
- Large serif wordmark (Cormorant Garamond, 56px)
- Bio paragraph below
- **Selected Writing** — typeset entries: year / title / dek / source in a 64px + 1fr grid
- **Press & Video** — two pull quotes on the left, compact 16:9 video tile on the right; "Also quoted or cited in…" sentence below
- **Footer** — email · linkedin · ssrn · cv ↓

Color tokens (defined in `assets/css/style.css`):

| Token | Value | Role |
|---|---|---|
| `--paper` | `#f3ede1` | Page background |
| `--ink` | `#1a1814` | Primary text / borders |
| `--ink-soft` | `#c9c1b1` | Subtle borders, hatching |
| `--ink-soft-text` | `#5e564a` | Secondary text, deks, captions |
| `--accent` | `#a8201a` | Hover underlines |

## Placeholder content still to fill in

Search `index.html` for `[brackets]` — each one needs a real value:

- `src="[portrait.jpg]"` — add photo to repo (e.g. `assets/img/portrait.jpg`) and update `src`
- Bio paragraph text
- `href="#"` on all writing titles, press outlets, and footer links
- `mailto:[email]`
- Two pull quote texts and their attribution
- Video link and thumbnail

## Under Construction banner

A Geocities-style banner is currently live at the top of the page. It is fully self-contained — removing it requires exactly three steps and leaves zero trace:

1. **Delete the `<link>` tag** in `index.html` `<head>` marked `UC-BANNER-LINK`
2. **Delete the `<div id="uc-banner">` block** in `index.html` — everything between `<!-- UC-BANNER-START -->` and `<!-- UC-BANNER-END -->`
3. **Delete the file** `assets/css/uc-banner.css`

Nothing in `style.css` or the main markup depends on any of the above.

## File layout

```
index.html                 Main page
assets/
  css/
    style.css              All page styles + design tokens
    uc-banner.css          Under construction banner — DELETE when done (see above)
CNAME                      Custom domain (amesgrawert.com)
.nojekyll                  Disables Jekyll processing on GitHub Pages
.github/
  workflows/
    deploy.yml             Deploys repo root to GitHub Pages on push to main
```

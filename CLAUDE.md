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
- **Favicon**: "AG" monogram, Cormorant Garamond SemiBold, paper `#f3ede1` on ink `#1a1814`. Three files at repo root: `favicon.svg` (true vector, built from glyph outlines), `favicon.ico` (48/32/16), `apple-touch-icon.png` (180×180). Regenerate by re-running the generator script against the Cormorant Garamond TTF if the palette or monogram changes.

## Content

All content is live — no placeholders remain.

- **Portrait**: `assets/img/portrait.jpg` (1200×801, 182 KB). Cropped and framed via `object-fit: cover` + `object-position: center 30%`.
- **Selected Writing**: 6 entries (2020–2026), Brennan Center and NY Daily News
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
CNAME                      Custom domain (amesgrawert.com)
.nojekyll                  Disables Jekyll processing on GitHub Pages
.github/
  workflows/
    deploy.yml             Deploys repo root to GitHub Pages on push to main
```

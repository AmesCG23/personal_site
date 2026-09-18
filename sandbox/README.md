# Token Table

A token tray for Magic: The Gathering that runs in the browser on an iPad or iPhone. Lives at `https://amesgrawert.com/sandbox/`. Plan and research: `../docs/mtg-tokens/HANDOFF.md`.

## Using it

- **Make a token:** tap a name in the palette. Tap it again to add another; the count badge goes up. "Any token…" searches 834 token types by name or creature type. "Custom…" builds one from scratch.
- **Tap / untap:** tap the card. Hold the card (or press ⋯) for the menu: tap some of them, split, duplicate, choose art, edit, sacrifice, merge, remove.
- **Power / toughness:** the +1/+1 and −1/−1 buttons add counters; one of each cancels out, and a creature at 0 toughness shows a red warning.
- **Next turn:** untaps everything and clears the "zzz" summoning-sickness marker.
- **Sacrifice:** Treasure, Food, Clue, Blood, Map, Powerstone and the other predefined tokens show their cost and payoff, and can add mana or life to the tray at the bottom.
- **Anthems & effects** (under ⋯): flip on Glorious Anthem, Coat of Arms, a tribal lord, Bad Moon and 12 other common anthem enchantments/artifacts. The bonus is folded straight into every token's power/toughness, marked with a ⚡. Active ones also show as a strip under the header — tap one there to turn it off.
- **Undo** covers the last 30 actions. **New game** is under ⋯ in the header, with "keep the screen awake" and credits.
- **Install:** Safari → Share → Add to Home Screen. Everything is saved on the device.

## Files

- `index.html`, `css/tokens.css`, `manifest.webmanifest`, `icons/`
- `js/app.js` (entry), `js/state.js` (board, undo, and the anthem power/toughness math), `js/ui.js` (rendering, touch, sheets), `js/catalog.js`, `js/scryfall.js`, `js/store.js`, `js/reminders.js`, `js/anthems.js` (the 16 anthem definitions)
- `data/tokens.json` — the token catalog, built by `../docs/mtg-tokens/build-token-catalog.py`
- `tests/smoke.mjs` — Playwright smoke test; `tests/make-icons.mjs` — renders the icon PNGs

## Testing

```
python3 -m http.server 8123 --bind 127.0.0.1   # from the repo root
node sandbox/tests/smoke.mjs                    # needs Playwright + Chromium
```

## Deviations from the handoff

- The on-card action buttons sit in two rows (count on top; counters and menu below) so every button is at least 44 px wide on a phone.
- A sacrifice and its payoff (for example Treasure → red mana) are one undo step.
- Tapping a palette name twice in the same turn adds to the existing stack instead of making a second one, as long as the two would be identical.
- Still unverified from the build sandbox (its network blocks Scryfall): live Scryfall calls from a browser, and the artist-name enrichment script. The app degrades to blank tokens and the bundled catalog if Scryfall is unreachable, and fetches artist names on demand until the catalog is enriched.
- Anthems added 2026-09-18, 14 cards; extended 2026-09-19 to 16 with Banner of Kinship and Chronicle of Victory: common anthem enchantments/artifacts (`js/anthems.js`), toggled under ⋯ → "Anthems & effects". Global, color, tribal (choose-a-type) and Coat of Arms's cross-type count all recompute live from the tokens on the board. Path of Bravery's own condition (life ≥ starting life) is checked automatically against the life tray; Beastmaster Ascension has no equivalent state to check against, so it's a plain manual switch. This app only tracks your own board, so a "symmetric" card like Bad Moon (which really pumps every black creature, opponents' included) only ever affects what's shown here.

## Credits

Token Table is unofficial Fan Content permitted under the Fan Content Policy. Not approved/endorsed by Wizards. Portions of the materials used are property of Wizards of the Coast. © Wizards of the Coast LLC. Card images and data courtesy of Scryfall. Token definitions from the Cockatrice Magic-Token project. Rules text from the Magic: The Gathering Comprehensive Rules.

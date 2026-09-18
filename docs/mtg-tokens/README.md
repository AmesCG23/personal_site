# MTG token app — planning package

Everything needed to build the Magic: The Gathering token tray for `/sandbox/` on amesgrawert.com.

- **`HANDOFF.md`** — the plan. Start here.
- **`tokens.json`** — the token catalog (834 token shapes, 2,284 official printings with Scryfall IDs). Generated 2026-09-18 from the Cockatrice Magic-Token database, version `20260831f`.
- **`build-token-catalog.py`** — regenerates `tokens.json` (Python 3, no dependencies, needs only GitHub access).
- **`enrich-from-scryfall.mjs`** — fills in artist names and verified image URLs from Scryfall (Node 18+, needs access to api.scryfall.com; not yet run).

Data licences: token metadata from the Cockatrice project (community); images and rules text are Wizards of the Coast property used as unofficial fan content under the Wizards Fan Content Policy and Scryfall's terms.

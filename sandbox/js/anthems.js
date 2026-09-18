// anthems.js — the "anthem" enchantments/artifacts a player can flag as being in play.
// Oracle text confirmed against Scryfall/Gatherer on 2026-09-18 (not fetched live —
// this app's environment blocks scryfall.com — but hand-checked against search results).
//
// Each entry describes a static team-wide (or tribal) power/toughness boost. `state.js`
// reads this list to fold the bonus into every token's displayed power/toughness; `ui.js`
// reads it to build the "Anthems & effects" sheet. Nothing here mutates state — it's data.
//
// group meanings:
//   global      — creatures you control, no further condition
//   color       — creatures you control of one color (Bad Moon is marked symmetric: the
//                 real card pumps ALL black creatures, opponents' included, but this app
//                 only tracks your own board, so the math is the same either way)
//   tribal      — you choose a creature type when you turn it on; applies to that type only
//   crosstribal — Coat of Arms: no chosen type, computed from creature types already on the board
//   token       — token-specific (in this app every creature IS a token, so this behaves
//                 like "global" for creatures, but is kept separate since the card's own
//                 text is token-specific and it also grants vigilance)
//   conditional — the boost only holds while some condition is true; Path of Bravery's
//                 condition (life ≥ starting life) is checked automatically since the app
//                 already tracks life; Beastmaster Ascension's condition (a creature with
//                 7+ quest counters) isn't tracked anywhere in this app, so it's a plain
//                 on/off switch you flip yourself.
export const ANTHEMS = [
  { key: "glorious-anthem", name: "Glorious Anthem", group: "global", bonus: { p: 1, t: 1 },
    cards: ["Glorious Anthem"], text: "Creatures you control get +1/+1." },
  { key: "gaeas-anthem", name: "Gaea's Anthem", group: "global", bonus: { p: 1, t: 1 },
    cards: ["Gaea's Anthem"], text: "Creatures you control get +1/+1." },
  { key: "spear-of-heliod", name: "Spear of Heliod", group: "global", bonus: { p: 1, t: 1 },
    cards: ["Spear of Heliod"], text: "Creatures you control get +1/+1. Also: {1}{W}{W}, {T}: destroy target creature that dealt damage to you this turn." },
  { key: "immortal-sun", name: "The Immortal Sun", group: "global", bonus: { p: 1, t: 1 },
    cards: ["The Immortal Sun"], text: "Creatures you control get +1/+1. Also: extra card each draw step, spells cost {1} less, opponents' planeswalkers can't activate loyalty abilities." },

  { key: "honor-of-the-pure", name: "Honor of the Pure", group: "color", color: "W", bonus: { p: 1, t: 1 },
    cards: ["Honor of the Pure"], text: "White creatures you control get +1/+1." },
  { key: "crusade", name: "Crusade", group: "color", color: "W", bonus: { p: 1, t: 1 },
    cards: ["Crusade"], text: "White creatures you control get +1/+1. (Banned in sanctioned play.)" },
  { key: "bad-moon", name: "Bad Moon", group: "color", color: "B", bonus: { p: 1, t: 1 }, symmetric: true,
    cards: ["Bad Moon"], text: "All black creatures get +1/+1 — including opponents' black creatures, which this app can't see." },

  { key: "vanquishers-banner", name: "Vanquisher's Banner", group: "tribal", needsType: true, bonus: { p: 1, t: 1 },
    cards: ["Vanquisher's Banner"], text: "Creatures you control of the chosen type get +1/+1. Draws a card whenever you cast one." },
  { key: "shared-triumph", name: "Shared Triumph", group: "tribal", needsType: true, bonus: { p: 1, t: 1 },
    cards: ["Shared Triumph"], text: "Creatures of the chosen type get +1/+1." },
  { key: "radiant-destiny", name: "Radiant Destiny", group: "tribal", needsType: true, bonus: { p: 1, t: 1 },
    cards: ["Radiant Destiny"], text: "Creatures you control of the chosen type get +1/+1, and vigilance once you have the city's blessing (10+ permanents)." },
  { key: "obelisk-of-urd", name: "Obelisk of Urd", group: "tribal", needsType: true, bonus: { p: 2, t: 2 },
    cards: ["Obelisk of Urd"], text: "Creatures you control of the chosen type get +2/+2." },
  { key: "icon-of-ancestry", name: "Icon of Ancestry", group: "tribal", needsType: true, bonus: { p: 1, t: 1 },
    cards: ["Icon of Ancestry"], text: "Creatures you control of the chosen type get +1/+1. Also a card-selection ability." },
  { key: "adaptive-automaton", name: "Adaptive Automaton", group: "tribal", needsType: true, bonus: { p: 1, t: 1 },
    cards: ["Adaptive Automaton"], text: "Other creatures you control of the chosen type get +1/+1. (It's an artifact creature itself, a 2/2 of the chosen type.)" },
  { key: "door-of-destinies", name: "Door of Destinies", group: "tribal", needsType: true, scaling: true,
    cards: ["Door of Destinies"], text: "Creatures you control of the chosen type get +1/+1 for each charge counter (one per spell of that type you've cast since it entered). Set the counter count yourself." },
  { key: "banner-of-kinship", name: "Banner of Kinship", group: "tribal", needsType: true, scaling: true, snapshotCount: true,
    cards: ["Banner of Kinship"], text: "As it enters, choose a creature type; it gets a fellowship counter for each creature you already control of that type. Creatures you control of the chosen type get +1/+1 for each fellowship counter. The count is set once, when it enters — use “Match board count” below to set it, then adjust by hand if it changes later." },
  { key: "chronicle-of-victory", name: "Chronicle of Victory", group: "tribal", needsType: true, bonus: { p: 2, t: 2 },
    cards: ["Chronicle of Victory"], text: "Creatures you control of the chosen type get +2/+2 and have first strike and trample (this app applies only the +2/+2). Draws a card whenever you cast one." },

  { key: "coat-of-arms", name: "Coat of Arms", group: "crosstribal",
    cards: ["Coat of Arms"], text: "Each creature gets +1/+1 for every other creature on the battlefield sharing a creature type with it. Computed automatically from the tokens on your board." },

  { key: "intangible-virtue", name: "Intangible Virtue", group: "token", bonus: { p: 1, t: 1 },
    cards: ["Intangible Virtue"], text: "Creature tokens you control get +1/+1 and vigilance." },

  { key: "path-of-bravery", name: "Path of Bravery", group: "conditional", bonus: { p: 1, t: 1 }, autoLifeCheck: true,
    cards: ["Path of Bravery"], text: "While your life total is at least your starting life, creatures you control get +1/+1. Checked automatically against the life tray." },
  { key: "beastmaster-ascension", name: "Beastmaster Ascension", group: "conditional", bonus: { p: 5, t: 5 },
    cards: ["Beastmaster Ascension"], text: "Once a creature you control has attacked with seven or more quest counters on it, creatures you control get +5/+5. This app can't detect that on its own — flip it on once it happens." },
];

export const GROUP_LABELS = {
  global: "Global — every creature you control",
  color: "Color-restricted",
  tribal: "Tribal — choose a creature type",
  crosstribal: "Cross-tribal count",
  token: "Token-specific",
  conditional: "Conditional — you judge when it applies",
};
export const GROUP_ORDER = ["global", "color", "tribal", "crosstribal", "token", "conditional"];

export const byKey = (key) => ANTHEMS.find((a) => a.key === key) || null;

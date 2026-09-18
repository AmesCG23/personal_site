// reminders.js — what you get when you sacrifice or use a token.
// Text follows Comprehensive Rules 111.10 (predefined tokens) where one exists.
// `action` tells the UI what tray button to offer: mana | life | counter | transform | none

export const REMINDERS = {
  Treasure:  { cost: "{T}", effect: "Add one mana of any color.", action: "mana", verb: "Sacrifice" },
  Food:      { cost: "{2}, {T}", effect: "You gain 3 life.", action: "life", amount: 3, verb: "Sacrifice" },
  Clue:      { cost: "{2}", effect: "Draw a card.", action: "none", verb: "Sacrifice" },
  Blood:     { cost: "{1}, {T}, discard a card", effect: "Draw a card.", action: "none", verb: "Sacrifice" },
  Gold:      { cost: "none", effect: "Add one mana of any color.", action: "mana", verb: "Sacrifice" },
  Powerstone:{ cost: "{T}", effect: "Add {C}. This mana can't be spent to cast a nonartifact spell.", action: "colorless", verb: "Tap", keep: true },
  Map:       { cost: "{1}, {T} — sorcery speed only", effect: "Target creature you control explores.", action: "none", verb: "Sacrifice" },
  Junk:      { cost: "{T} — sorcery speed only", effect: "Exile the top card of your library. You may play that card this turn.", action: "none", verb: "Sacrifice" },
  Lander:    { cost: "{2}, {T}", effect: "Search your library for a basic land card, put it onto the battlefield tapped, then shuffle.", action: "none", verb: "Sacrifice" },
  Mutagen:   { cost: "{1}, {T} — sorcery speed only", effect: "Put a +1/+1 counter on target creature.", action: "counter", verb: "Sacrifice" },
  Shard:     { cost: "{2}", effect: "Scry 1, then draw a card.", action: "none", verb: "Sacrifice" },
  Incubator: { cost: "{2}", effect: "Transform: it becomes a 0/0 colorless Phyrexian artifact creature and keeps its +1/+1 counters.", action: "transform", verb: "Transform", keep: true },
  Vibranium: { cost: "{T}", effect: "Add {C}. This mana can't be spent to cast a nonartifact spell.", action: "colorless", verb: "Tap", keep: true },
  Spawn:     { cost: "none", effect: "Add {C}.", action: "colorless", verb: "Sacrifice", match: "Eldrazi Spawn" },
  Scion:     { cost: "none", effect: "Add {C}.", action: "colorless", verb: "Sacrifice", match: "Eldrazi Scion" },
};

// Find the reminder for a stack, if any.
export function reminderFor(stack) {
  const subs = stack.subtypes || [];
  for (const key of Object.keys(REMINDERS)) {
    const r = REMINDERS[key];
    if (r.match ? subs.join(" ") === r.match : subs.includes(key)) return { key, ...r };
  }
  // Fallback: tokens whose own text mentions a "dies" or sacrifice payoff.
  const t = (stack.text || "");
  const m = t.match(/When this (?:creature|token|permanent) dies, you gain (\d+) life/i);
  if (m) return { key: "dies", cost: "none", effect: `When it dies: you gain ${m[1]} life.`, action: "life", amount: +m[1], verb: "Sacrifice" };
  return null;
}

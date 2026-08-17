// Scripted historical timeline, 1918-1981. Each event fires once, in the
// January of its `year`. `auto` events just apply `effect` and show a
// notice. `choice` events pause the game and let the player pick between
// `options`, each with its own `effect`.
//
// Effects are small deltas applied to the sim's global modifiers object
// (see sim.js applyEffect) — treasury cash deltas, temporary multipliers,
// district-scoped population/happiness hits, and tech unlock flags.

export const EVENTS = [
  {
    year: 1918, type: 'auto', title: 'Greater New York, 1918',
    body: "The five boroughs, consolidated since 1898, are booming. The IRT subway has run since 1904, the Dual Contracts are rapidly expanding rapid transit, and els rattle over Manhattan and Brooklyn streets. Your job: grow the city and keep its people happy, all the way to 1981.",
    effect: {},
  },
  {
    year: 1920, type: 'auto', title: 'Prohibition Begins',
    body: "The Volstead Act takes effect. Speakeasies proliferate; officially, nothing has changed.",
    effect: { happiness: -0.01 },
  },
  {
    year: 1927, type: 'auto', title: 'Holland Tunnel Opens',
    body: "The first vehicular tunnel under the Hudson River links Lower Manhattan to Jersey City. It is an immediate sensation — and immediately congested.",
    effect: { unlockCrossing: 'holland-tunnel' },
  },
  {
    year: 1929, type: 'auto', title: 'Stock Market Crash',
    body: "Black Tuesday wipes out fortunes overnight. Construction stalls and demand for housing and commerce cools citywide as the Depression sets in.",
    effect: { treasuryMult: -0.25, demandMult: { R: -0.3, C: -0.4, I: -0.3 }, durationMonths: 48 },
  },
  {
    year: 1931, type: 'auto', title: 'George Washington Bridge Opens',
    body: "At 3,500 feet, the longest suspension span in the world connects Washington Heights to New Jersey. Othmar Ammann's bridge proves cars can leap the Hudson.",
    effect: { unlockCrossing: 'gw-bridge' },
  },
  {
    year: 1932, type: 'auto', title: 'The Independent (IND) Subway Opens',
    body: "The city-built, city-run IND line opens its first stretch, a publicly financed answer to the privately-run IRT and BMT. Subway construction costs drop citywide.",
    effect: { transitCostMult: { subway: -0.15 }, durationMonths: 999 },
  },
  {
    year: 1933, type: 'auto', title: 'The New Deal Arrives',
    body: "Federal relief and public works money — the WPA and PWA — flow into the city: parks, pools, housing, and transit projects. Civic building costs fall for the rest of the decade.",
    effect: { civicCostMult: -0.25, durationMonths: 72 },
  },
  {
    year: 1936, type: 'choice', title: "Robert Moses's Public Works Program",
    body: "Parks Commissioner Robert Moses proposes a sweeping program of parkways, bridges, and public works to remake the metropolis around the automobile — starting with the Triborough Bridge. Do you back his highway-building vision, or push city money toward expanding the subway and bus network instead?",
    options: [
      {
        label: 'Back the highway program',
        result: "Moses gets his bridges. Expressway construction becomes cheaper and the Triborough opens on schedule, but the city commits itself to a car-centric future.",
        effect: { unlockCrossing: 'triborough-1', transitCostMult: { highway: -0.2 }, durationMonths: 999, tag: 'moses-highways' },
      },
      {
        label: 'Prioritize transit instead',
        result: "The Triborough still opens — Moses has the political muscle to see it through regardless — but city hall quietly redirects extra funding toward the subway and bus system.",
        effect: { unlockCrossing: 'triborough-1', transitCostMult: { subway: -0.15, bus: -0.15 }, durationMonths: 999, tag: 'transit-first' },
      },
    ],
  },
  {
    year: 1936, type: 'auto', title: 'Triborough Bridge Opens (Bronx Span)',
    body: "The Bronx approach of the Triborough complex opens, linking Randall's Island to the mainland Bronx.",
    effect: { unlockCrossing: 'triborough-2' },
  },
  {
    year: 1937, type: 'auto', title: 'Lincoln Tunnel Opens',
    body: "A second Hudson River vehicular tunnel opens from Hell's Kitchen to New Jersey, further cementing the automobile's place in the region's commute.",
    effect: { unlockCrossing: 'lincoln-tunnel' },
  },
  {
    year: 1939, type: 'auto', title: "The World's Fair",
    body: '"The World of Tomorrow" opens in Flushing Meadows, Queens, drawing millions and a wave of civic optimism.',
    effect: { happiness: 0.03, districtBonus: { flushing: { population: 8 } } },
  },
  {
    year: 1940, type: 'auto', title: 'Subway Unification',
    body: "The city buys out the private IRT and BMT companies, merging them with the municipal IND into one unified system under a single fare. Subway upkeep drops.",
    effect: { transitUpkeepMult: { subway: -0.2 }, durationMonths: 999 },
  },
  {
    year: 1941, type: 'auto', title: 'Wartime Mobilization',
    body: "America enters the war. Shipyards and war plants surge with production — but gasoline and rubber rationing sharply cuts civilian car use.",
    effect: { demandMult: { I: 0.5 }, roadPollutionMult: -0.5, durationMonths: 48 },
  },
  {
    year: 1945, type: 'auto', title: 'Peacetime Returns',
    body: "The war ends. Servicemen return home, rationing lifts, and a housing boom begins.",
    effect: { demandMult: { R: 0.3 }, durationMonths: 36 },
  },
  {
    year: 1948, type: 'choice', title: 'The Cross-Bronx Expressway',
    body: "Robert Moses's proposed Cross-Bronx Expressway would run directly through the densely settled East Tremont section of the South Bronx — 1,530 apartments, thousands of residents. A costlier alternate routing exists a few blocks north, through a less-populated rail yard corridor, but would take years longer and cost far more.",
    options: [
      {
        label: 'Approve the direct route',
        result: "The expressway cuts straight through East Tremont. Thousands are displaced; the South Bronx's population and happiness take a lasting hit, but the road opens years sooner.",
        effect: { unlockTech: 'highway', districtBonus: { 'south-bronx': { population: -60, happiness: -0.2 } }, tag: 'cross-bronx-direct' },
      },
      {
        label: 'Approve the costlier alternate route',
        result: "The city pays more and waits longer, but far fewer families are displaced.",
        effect: { unlockTech: 'highway', treasuryMult: -0.1, districtBonus: { 'south-bronx': { population: -12, happiness: -0.05 } }, tag: 'cross-bronx-alt' },
      },
    ],
  },
  {
    year: 1955, type: 'auto', title: 'Third Avenue El Comes Down',
    body: "Manhattan's last elevated line north of 59th Street is demolished, seen by many as a blighted relic. Sunlight returns to Third Avenue — and thousands of straphangers lose their nearest rapid transit.",
    effect: { happiness: 0.01 },
  },
  {
    year: 1956, type: 'choice', title: 'The Federal Interstate Highway Act',
    body: "Congress creates the Interstate Highway System, funding 90% of new expressway construction with federal dollars. Do you lean into the federal money and expand the expressway network aggressively, or hold the line and keep growth transit-oriented?",
    options: [
      {
        label: 'Take the federal highway money',
        result: "Expressway construction becomes dramatically cheaper, funded almost entirely by Washington. The city's road network grows fast — and so, eventually, does its traffic.",
        effect: { transitCostMult: { highway: -0.5 }, durationMonths: 999, tag: 'interstate-highways' },
      },
      {
        label: 'Decline, invest locally in transit',
        result: "The city passes on most federal highway funds and instead bonds against future fare revenue to expand its own subway and bus fleet.",
        effect: { transitCostMult: { subway: -0.2, bus: -0.2 }, durationMonths: 999, tag: 'interstate-declined' },
      },
    ],
  },
  {
    year: 1961, type: 'auto', title: 'Throgs Neck Bridge Opens',
    body: "A second crossing between the Bronx and Queens opens to relieve congestion on the Whitestone Bridge. Within a few years, traffic on both bridges is just as heavy as before.",
    effect: { unlockCrossing: 'throgs-neck-bridge' },
  },
  {
    year: 1962, type: 'choice', title: 'The Lower Manhattan Expressway (LOMEX)',
    body: "Robert Moses proposes a ten-lane elevated expressway slicing across Lower Manhattan, connecting the Holland Tunnel to the bridges — demolishing much of Greenwich Village and SoHo along the way. A coalition led by the writer and activist Jane Jacobs is organizing fierce opposition.",
    options: [
      {
        label: 'Approve LOMEX',
        result: "The expressway is built. Cross-Manhattan car capacity soars, but hundreds of buildings in the Village and SoHo are razed, and the neighborhood never fully recovers.",
        effect: { districtBonus: { 'village-soho': { population: -90, happiness: -0.25 } }, transitCostMult: { highway: -0.1 }, durationMonths: 999, tag: 'lomex-built' },
      },
      {
        label: 'Reject LOMEX',
        result: "Community opposition prevails and the project is shelved, just as it was in reality in 1969. The Village and SoHo are preserved, and the win emboldens preservationists citywide.",
        effect: { happiness: 0.03, tag: 'lomex-rejected' },
      },
    ],
  },
  {
    year: 1963, type: 'auto', title: 'Penn Station Demolished',
    body: "McKim, Mead & White's monumental Pennsylvania Station is torn down to make way for Madison Square Garden and an office tower — the era's starkest lesson in what car- and commerce-oriented redevelopment can cost a city's civic fabric.",
    effect: { happiness: -0.02 },
  },
  {
    year: 1964, type: 'auto', title: 'Verrazzano-Narrows Bridge Opens',
    body: "The last great crossing of the era links Staten Island to Brooklyn for the first time by road. Staten Island's population, isolated by water for centuries, begins to boom.",
    effect: { unlockCrossing: 'verrazzano-bridge', districtBonus: { 'st-george': { growthMult: 1.6 }, 'todt-hill': { growthMult: 1.6 }, tottenville: { growthMult: 1.6 } }, durationMonths: 999 },
  },
  {
    year: 1968, type: 'auto', title: 'The MTA Is Created',
    body: "The state creates the Metropolitan Transportation Authority, unifying the subway, city buses, and commuter railroads under one authority for the first time.",
    effect: { transitUpkeepMult: { subway: -0.1, bus: -0.1 }, durationMonths: 999 },
  },
  {
    year: 1973, type: 'auto', title: 'The Oil Crisis',
    body: "An OPEC oil embargo quadruples gas prices almost overnight. Long lines snake around gas stations; car commuting suddenly looks a lot less appealing than the subway.",
    effect: { roadPollutionMult: 0.2, transitDemandShift: 0.15, durationMonths: 30 },
  },
  {
    year: 1975, type: 'choice', title: 'The Fiscal Crisis', subtitle: '"Ford to City: Drop Dead"',
    body: "New York teeters on bankruptcy. The city cannot pay its bills, President Ford initially refuses a federal bailout, and the subway's maintenance backlog is growing. Do you raise taxes sharply to protect services and keep the subway maintained, or slash the budget and let deferred maintenance pile up?",
    options: [
      {
        label: 'Raise taxes to protect services',
        result: "Tax hikes are deeply unpopular, but the subway stays maintained and city services survive largely intact.",
        effect: { taxRateDelta: 0.03, happiness: -0.03, tag: 'fiscal-taxes' },
      },
      {
        label: 'Slash the budget',
        result: "The budget balances, but deferred maintenance piles up. The subway system will spend years in visible decline — grime, graffiti, and breakdowns — before it recovers.",
        effect: { transitUpkeepMult: { subway: 0.25, elevated: 0.25 }, happiness: -0.06, durationMonths: 96, tag: 'fiscal-cuts' },
      },
    ],
  },
  {
    year: 1977, type: 'auto', title: 'The Blackout of 1977',
    body: "A lightning strike triggers a 25-hour citywide blackout. Looting and unrest hit already-struggling neighborhoods hard.",
    effect: { happiness: -0.03, durationMonths: 6 },
  },
  {
    year: 1981, type: 'auto', title: 'End of an Era',
    body: "Sixty-three years after the Dual Contracts, New York stands at a crossroads heading into the 1980s — battered by the fiscal crisis, but still the greatest transit city in the Western Hemisphere. This is your final report for the historical era. Keep playing in free mode to see how far the city can grow.",
    effect: { finalReport: true },
  },
];

export function eventsForYear(year) {
  return EVENTS.filter(e => e.year === year);
}

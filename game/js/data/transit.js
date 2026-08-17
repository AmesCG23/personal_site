// Transit technology tree and fixed river/harbor crossings.
// Dates and capacities are simplified for gameplay but anchored to real
// NYC transit history.

// costPerTile: treasury cost to build one tile of line
// upkeepPerTile: monthly maintenance cost
// capacity: relative rider/vehicle throughput per tile
// speed: relative trip speed (affects commute quality)
// pollution: relative pollution generated per unit of use (0 = none)
// inducedDemand: if true, building more of this type gradually grows total
//   car trips in the district (induced demand feedback), rather than simply
//   relieving existing congestion
// needsRoad: line can only be built on a tile that already has a road
export const TRANSIT_TYPES = {
  road: {
    id: 'road', name: 'Street', mode: 'road', color: '#8a97a3',
    unlockYear: 1918, costPerTile: 8, upkeepPerTile: 0.15,
    capacity: 20, speed: 1.0, pollution: 0.4, inducedDemand: false,
    description: 'Paved streets. Required for buses, cars, and zone access.',
  },
  trolley: {
    id: 'trolley', name: 'Trolley Line', mode: 'rail', color: '#d98a3d',
    unlockYear: 1918, costPerTile: 14, upkeepPerTile: 0.25,
    capacity: 35, speed: 1.1, pollution: 0, inducedDemand: false,
    needsRoad: true,
    description: 'Electric streetcars sharing the road. Cheap, clean, modest capacity. Largely phased out by the late 1950s.',
    obsoleteYear: 1957, obsoleteNote: 'Most NYC trolley lines were replaced by buses by 1957.',
  },
  elevated: {
    id: 'elevated', name: 'Elevated Railway (El)', mode: 'rail', color: '#6b6558',
    unlockYear: 1918, costPerTile: 30, upkeepPerTile: 0.4,
    capacity: 70, speed: 1.6, pollution: 0, inducedDemand: false,
    blight: true,
    description: 'Steam/electric els on iron trestles. High capacity, fast, but casts shade and noise on the street below (small happiness penalty on tiles directly beneath).',
  },
  subway: {
    id: 'subway', name: 'Subway', mode: 'rail', color: '#2f9fd6',
    unlockYear: 1918, costPerTile: 70, upkeepPerTile: 0.5,
    capacity: 140, speed: 2.2, pollution: 0, inducedDemand: false,
    description: 'Underground rapid transit. Expensive, but fast, high-capacity, and no surface footprint. The IRT has run since 1904.',
  },
  bus: {
    id: 'bus', name: 'Motor Bus Route', mode: 'road', color: '#5b7a8c',
    unlockYear: 1925, costPerTile: 6, upkeepPerTile: 0.2,
    capacity: 40, speed: 1.2, pollution: 0.2, inducedDemand: false,
    needsRoad: true,
    description: 'Flexible gasoline bus routes running on existing streets. Available once motor buses see wide adoption in the mid-1920s.',
  },
  highway: {
    id: 'highway', name: 'Expressway', mode: 'road', color: '#14212e',
    unlockYear: 1936, costPerTile: 55, upkeepPerTile: 0.6,
    capacity: 160, speed: 2.0, pollution: 1.4, inducedDemand: true,
    canDemolish: true,
    description: "Limited-access, high-speed auto expressways in the Robert Moses mold. High car capacity — but new expressway capacity reliably fills back up with new car trips (induced demand), raises pollution sharply, and can be routed straight through built-up neighborhoods, demolishing everything in its path.",
  },
};

// Bridges, tunnels, and ferries. Distance is a schematic district-to-district
// link, not a tile path — it feeds the district-level commuting model so
// that (for example) Staten Island stays commute-isolated until the
// Verrazzano-Narrows Bridge opens in 1964.
export const CROSSINGS = [
  { id: 'brooklyn-bridge',    name: 'Brooklyn Bridge',            a: 'village-soho',  b: 'downtown-bk',    mode: 'bridge', carries: ['road','rail'], yearBuilt: 1883, capacity: 90 },
  { id: 'williamsburg-bridge',name: 'Williamsburg Bridge',        a: 'les-financial', b: 'greenpoint-wmsburg', mode: 'bridge', carries: ['road','rail'], yearBuilt: 1903, capacity: 90 },
  { id: 'manhattan-bridge',   name: 'Manhattan Bridge',           a: 'les-financial', b: 'downtown-bk',    mode: 'bridge', carries: ['road','rail'], yearBuilt: 1909, capacity: 90 },
  { id: 'queensboro-bridge',  name: 'Queensboro Bridge',          a: 'midtown',       b: 'lic-astoria',    mode: 'bridge', carries: ['road','rail'], yearBuilt: 1909, capacity: 80 },
  { id: 'hell-gate-bridge',   name: 'Hell Gate Bridge',           a: 'south-bronx',   b: 'lic-astoria',    mode: 'bridge', carries: ['rail'],        yearBuilt: 1916, capacity: 60 },
  { id: 'si-ferry',           name: 'Staten Island Ferry',        a: 'les-financial', b: 'st-george',      mode: 'ferry',  carries: ['road'],        yearBuilt: 1905, capacity: 20 },
  { id: 'bk-si-ferry',        name: '69th St Ferry',              a: 'bay-ridge',     b: 'st-george',      mode: 'ferry',  carries: ['road'],        yearBuilt: 1912, capacity: 15 },
  { id: 'hoboken-ferry',      name: 'Hoboken Ferry',              a: 'hellskitchen',  b: 'hoboken',        mode: 'ferry',  carries: ['road'],        yearBuilt: 1900, capacity: 15 },
  { id: 'jc-ferry',           name: 'Jersey City Ferry',          a: 'les-financial', b: 'jersey-city',    mode: 'ferry',  carries: ['road'],        yearBuilt: 1900, capacity: 15 },
  { id: 'holland-tunnel',     name: 'Holland Tunnel',             a: 'village-soho',  b: 'jersey-city',    mode: 'tunnel', carries: ['road'],        yearBuilt: 1927, capacity: 100, inducedDemand: true },
  { id: 'goethals-bridge',    name: 'Goethals Bridge',            a: 'tottenville',   b: 'newark',         mode: 'bridge', carries: ['road'],        yearBuilt: 1928, capacity: 60, inducedDemand: true },
  { id: 'gw-bridge',          name: 'George Washington Bridge',   a: 'wash-heights',  b: 'hoboken',        mode: 'bridge', carries: ['road'],        yearBuilt: 1931, capacity: 130, inducedDemand: true },
  { id: 'triborough-1',       name: 'Triborough Bridge (Harlem span)', a: 'harlem',    b: 'lic-astoria',   mode: 'bridge', carries: ['road'],        yearBuilt: 1936, capacity: 110, inducedDemand: true },
  { id: 'triborough-2',       name: 'Triborough Bridge (Bronx span)',  a: 'south-bronx', b: 'lic-astoria', mode: 'bridge', carries: ['road'],        yearBuilt: 1936, capacity: 110, inducedDemand: true },
  { id: 'lincoln-tunnel',     name: 'Lincoln Tunnel',             a: 'hellskitchen',  b: 'jersey-city',    mode: 'tunnel', carries: ['road'],        yearBuilt: 1937, capacity: 130, inducedDemand: true },
  { id: 'whitestone-bridge',  name: 'Bronx-Whitestone Bridge',    a: 'pelham-bay',    b: 'bayside',        mode: 'bridge', carries: ['road'],        yearBuilt: 1939, capacity: 100, inducedDemand: true },
  { id: 'throgs-neck-bridge', name: 'Throgs Neck Bridge',         a: 'pelham-bay',    b: 'bayside',        mode: 'bridge', carries: ['road'],        yearBuilt: 1961, capacity: 100, inducedDemand: true },
  { id: 'verrazzano-bridge',  name: 'Verrazzano-Narrows Bridge',  a: 'bay-ridge',     b: 'st-george',      mode: 'bridge', carries: ['road'],        yearBuilt: 1964, capacity: 140, inducedDemand: true },
];

export function transitTypesUnlockedByYear(year) {
  return Object.values(TRANSIT_TYPES).filter(t => t.unlockYear <= year);
}

export function crossingsBuiltByYear(year) {
  return CROSSINGS.filter(c => c.yearBuilt <= year);
}

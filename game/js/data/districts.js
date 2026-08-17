// Historical NYC-metro district data, 1918 baseline.
// Population figures are order-of-magnitude approximations drawn from 1920
// census returns for NYC's five boroughs, Nassau County, and the NJ cities
// across the Hudson; they are simplified for gameplay, not a rigorous source.
// GRID is 70 x 56 tiles. Rects are half-open: {x0,x1,y0,y1}.

export const GRID_W = 70;
export const GRID_H = 56;

// character controls growth caps & starting devLevel texture (see buildings.js)
//   'dense-tenement'  - can reach devLevel 4, starts partly built up
//   'rowhouse'        - caps around devLevel 3
//   'industrial-core' - strong I-zone bonus
//   'suburban'        - caps around devLevel 2, low starting density
//   'rural'           - caps around devLevel 1, mostly empty at start

// Boroughs are shaped as stacked horizontal strips of varying width rather
// than one bounding rectangle per borough, so the coastline steps in and
// out (an approximation of the real silhouette) instead of running dead
// straight. Gaps between strips are intentional -- unclaimed grid cells
// default to water in map.js, so a strip drawn narrower than its neighbors
// opens a bay/inlet for free. Manhattan tapers to a point at both ends;
// Staten Island is a rounded diamond; Queens/Brooklyn cut a Jamaica Bay
// notch around the Rockaways; the Bronx bulges out at Throgs Neck; New
// Jersey's waterfront steps toward Manhattan at Hoboken/Jersey City and
// falls back at a Newark Bay notch. Still axis-aligned (no grid rotation)
// and still schematic, not traced from real coastline data.
export const DISTRICTS = [
  // ---------------- Manhattan (tapered north-south, widest at the park) ----------------
  { id: 'wash-heights',  name: "Washington Heights",         borough: 'manhattan', rect: { x0: 21, x1: 24, y0: 6,  y1: 13 }, startPopK: 140, character: 'rowhouse' },
  { id: 'harlem',        name: "Harlem & East Harlem",       borough: 'manhattan', rect: { x0: 24, x1: 28, y0: 6,  y1: 13 }, startPopK: 260, character: 'dense-tenement' },
  { id: 'morningside',   name: "Morningside Heights",        borough: 'manhattan', rect: { x0: 20, x1: 24, y0: 13, y1: 20 }, startPopK: 90,  character: 'rowhouse' },
  { id: 'yorkville',     name: "Yorkville & Carnegie Hill",  borough: 'manhattan', rect: { x0: 24, x1: 28, y0: 13, y1: 20 }, startPopK: 220, character: 'dense-tenement' },
  { id: 'uws',           name: "Upper West Side",            borough: 'manhattan', rect: { x0: 19, x1: 23, y0: 20, y1: 27 }, startPopK: 260, character: 'rowhouse' },
  { id: 'ues',           name: "Upper East Side",            borough: 'manhattan', rect: { x0: 23, x1: 28, y0: 20, y1: 27 }, startPopK: 240, character: 'rowhouse' },
  { id: 'hellskitchen',  name: "Hell's Kitchen & Chelsea",   borough: 'manhattan', rect: { x0: 19, x1: 23, y0: 27, y1: 34 }, startPopK: 200, character: 'dense-tenement' },
  { id: 'midtown',       name: "Midtown & Murray Hill",      borough: 'manhattan', rect: { x0: 23, x1: 28, y0: 27, y1: 34 }, startPopK: 130, character: 'industrial-core' },
  { id: 'village-soho',  name: "Greenwich Village & SoHo",   borough: 'manhattan', rect: { x0: 20, x1: 28, y0: 34, y1: 39 }, startPopK: 280, character: 'dense-tenement' },
  { id: 'les-financial', name: "Lower East Side & Financial",borough: 'manhattan', rect: { x0: 22, x1: 27, y0: 39, y1: 44 }, startPopK: 350, character: 'dense-tenement' },

  // ---------------- Bronx (Pelham Bay bulges out toward the Sound) ----------------
  { id: 'riverdale',   name: "Riverdale & Kingsbridge",    borough: 'bronx', rect: { x0: 19, x1: 24, y0: 0, y1: 4 }, startPopK: 40,  character: 'suburban' },
  { id: 'fordham',     name: "Fordham & Bronx Park",       borough: 'bronx', rect: { x0: 24, x1: 28, y0: 0, y1: 4 }, startPopK: 130, character: 'rowhouse' },
  { id: 'concourse',   name: "Grand Concourse & Tremont",  borough: 'bronx', rect: { x0: 28, x1: 33, y0: 0, y1: 4 }, startPopK: 220, character: 'dense-tenement' },
  { id: 'south-bronx', name: "South Bronx & Mott Haven",   borough: 'bronx', rect: { x0: 33, x1: 38, y0: 0, y1: 4 }, startPopK: 250, character: 'industrial-core' },
  { id: 'pelham-bay',  name: "Pelham Bay & Throgs Neck",   borough: 'bronx', rect: { x0: 38, x1: 44, y0: 0, y1: 5 }, startPopK: 92,  character: 'suburban' },

  // ---------------- Queens (Flushing bulges north into the Sound; Jamaica Bay notch south of Rockaway) ----------------
  { id: 'lic-astoria',    name: "Long Island City & Astoria",  borough: 'queens', rect: { x0: 31, x1: 40, y0: 6,  y1: 14 }, startPopK: 95,  character: 'industrial-core' },
  { id: 'jackson-corona', name: "Jackson Heights & Corona",    borough: 'queens', rect: { x0: 40, x1: 49, y0: 6,  y1: 14 }, startPopK: 60,  character: 'suburban' },
  { id: 'flushing',       name: "Flushing",                    borough: 'queens', rect: { x0: 49, x1: 58, y0: 4,  y1: 14 }, startPopK: 45,  character: 'suburban' },
  { id: 'forest-hills',   name: "Forest Hills & Rego Park",    borough: 'queens', rect: { x0: 31, x1: 45, y0: 14, y1: 22 }, startPopK: 55,  character: 'suburban' },
  { id: 'bayside',        name: "Bayside & Whitestone",        borough: 'queens', rect: { x0: 45, x1: 58, y0: 14, y1: 22 }, startPopK: 35,  character: 'rural' },
  { id: 'jamaica',        name: "Jamaica",                     borough: 'queens', rect: { x0: 31, x1: 45, y0: 22, y1: 30 }, startPopK: 110, character: 'rowhouse' },
  { id: 'rockaway',       name: "Rockaway Peninsula",          borough: 'queens', rect: { x0: 46, x1: 58, y0: 26, y1: 30 }, startPopK: 69,  character: 'suburban' },

  // ---------------- Brooklyn (bay notches west of Coney Island and south of Flatbush) ----------------
  { id: 'greenpoint-wmsburg', name: "Greenpoint & Williamsburg",     borough: 'brooklyn', rect: { x0: 28, x1: 36, y0: 30, y1: 42 }, startPopK: 310, character: 'dense-tenement' },
  { id: 'bushwick-bedstuy',   name: "Bushwick & Bedford-Stuyvesant", borough: 'brooklyn', rect: { x0: 36, x1: 44, y0: 30, y1: 42 }, startPopK: 340, character: 'dense-tenement' },
  { id: 'crown-heights',      name: "Crown Heights & Prospect Hts",  borough: 'brooklyn', rect: { x0: 44, x1: 51, y0: 30, y1: 42 }, startPopK: 260, character: 'rowhouse' },
  { id: 'east-new-york',      name: "East New York & Brownsville",   borough: 'brooklyn', rect: { x0: 51, x1: 58, y0: 30, y1: 42 }, startPopK: 270, character: 'dense-tenement' },
  { id: 'downtown-bk',        name: "Downtown Brooklyn & Park Slope",borough: 'brooklyn', rect: { x0: 28, x1: 36, y0: 42, y1: 54 }, startPopK: 300, character: 'dense-tenement' },
  { id: 'bay-ridge',          name: "Bay Ridge & Sunset Park",       borough: 'brooklyn', rect: { x0: 36, x1: 44, y0: 42, y1: 54 }, startPopK: 190, character: 'industrial-core' },
  { id: 'flatbush',           name: "Flatbush & Flatlands",          borough: 'brooklyn', rect: { x0: 44, x1: 51, y0: 42, y1: 51 }, startPopK: 210, character: 'rowhouse' },
  { id: 'coney-island',       name: "Coney Island & Brighton Beach", borough: 'brooklyn', rect: { x0: 51, x1: 58, y0: 46, y1: 54 }, startPopK: 138, character: 'suburban' },

  // ---------------- Staten Island (rounded diamond, wide at Todt Hill) ----------------
  { id: 'st-george',  name: "St. George & North Shore",  borough: 'staten-island', rect: { x0: 12, x1: 19, y0: 40, y1: 46 }, startPopK: 55, character: 'rowhouse' },
  { id: 'todt-hill',  name: "Todt Hill & Mid-Island",    borough: 'staten-island', rect: { x0: 8,  x1: 24, y0: 46, y1: 51 }, startPopK: 32, character: 'suburban' },
  { id: 'tottenville',name: "Tottenville & South Shore", borough: 'staten-island', rect: { x0: 12, x1: 22, y0: 51, y1: 56 }, startPopK: 30, character: 'rural' },

  // ---------------- Nassau County ----------------
  { id: 'elmont',    name: "Elmont & Floral Park", borough: 'nassau', rect: { x0: 58, x1: 70, y0: 6,  y1: 13 }, startPopK: 30, character: 'suburban' },
  { id: 'hempstead', name: "Hempstead",            borough: 'nassau', rect: { x0: 58, x1: 70, y0: 13, y1: 20 }, startPopK: 55, character: 'suburban' },
  { id: 'mineola',   name: "Garden City & Mineola",borough: 'nassau', rect: { x0: 58, x1: 70, y0: 20, y1: 26 }, startPopK: 41, character: 'suburban' },

  // ---------------- New Jersey (waterfront steps toward Manhattan; Newark Bay notch) ----------------
  { id: 'hoboken',     name: "Hoboken",     borough: 'new-jersey', rect: { x0: 11, x1: 17, y0: 10, y1: 18 }, startPopK: 70,  character: 'dense-tenement' },
  { id: 'jersey-city', name: "Jersey City", borough: 'new-jersey', rect: { x0: 9,  x1: 17, y0: 18, y1: 30 }, startPopK: 298, character: 'industrial-core' },
  { id: 'bayonne',     name: "Bayonne",     borough: 'new-jersey', rect: { x0: 9,  x1: 16, y0: 30, y1: 38 }, startPopK: 76,  character: 'industrial-core' },
  { id: 'newark',      name: "Newark",      borough: 'new-jersey', rect: { x0: 0,  x1: 9,  y0: 14, y1: 32 }, startPopK: 414, character: 'industrial-core' },
];

export const BOROUGHS = {
  'manhattan':     { name: 'Manhattan',     color: '#c96a3f' },
  'bronx':         { name: 'The Bronx',     color: '#8a9b5e' },
  'queens':        { name: 'Queens',        color: '#c9a63f' },
  'brooklyn':      { name: 'Brooklyn',      color: '#a85c9e' },
  'staten-island': { name: 'Staten Island', color: '#5c8ba8' },
  'nassau':        { name: 'Nassau County', color: '#7fa8a0' },
  'new-jersey':    { name: 'New Jersey',    color: '#a3773f' },
};

export function districtById(id) {
  return DISTRICTS.find(d => d.id === id);
}

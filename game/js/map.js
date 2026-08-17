import { GRID_W, GRID_H, DISTRICTS, districtById } from './data/districts.js';
import { CHARACTER_TRAITS, characterCap } from './data/buildings.js';

// Deterministic PRNG so "New Game" always generates the same starting map.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Rough historical rapid-transit spines present at game start, 1918.
const STARTING_RAIL = [
  { districts: ['wash-heights','harlem','morningside','yorkville','uws','ues','hellskitchen','midtown','village-soho','les-financial'], mode: 'subway', offset: 0 },
  { districts: ['harlem','yorkville','hellskitchen','midtown','village-soho','les-financial'], mode: 'elevated', offset: 2 },
  { districts: ['greenpoint-wmsburg','bushwick-bedstuy','crown-heights','downtown-bk'], mode: 'elevated', offset: 0 },
  { districts: ['fordham','concourse','south-bronx'], mode: 'elevated', offset: 0 },
  { districts: ['lic-astoria','jackson-corona'], mode: 'elevated', offset: 0 },
];

function makeTile(terrain, districtId) {
  return {
    terrain,               // 'land' | 'water'
    districtId,            // string | null
    zone: null,            // null | 'R' | 'C' | 'I'
    devLevel: 0,           // 0-4
    civic: null,           // civic building id | null
    road: false,
    transit: null,         // 'trolley' | 'elevated' | 'subway' | 'bus' | 'highway' | null
    // computed each sim tick, cached for render/UI:
    landValue: 0.5,
    pollution: 0,
    access: 0,
  };
}

export function createGrid() {
  const tiles = [];
  for (let y = 0; y < GRID_H; y++) {
    const row = [];
    for (let x = 0; x < GRID_W; x++) row.push(makeTile('water', null));
    tiles.push(row);
  }

  for (const d of DISTRICTS) {
    const { x0, x1, y0, y1 } = d.rect;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        tiles[y][x] = makeTile('land', d.id);
      }
    }
  }
  return { w: GRID_W, h: GRID_H, tiles };
}

export function tileAt(grid, x, y) {
  if (x < 0 || y < 0 || x >= grid.w || y >= grid.h) return null;
  return grid.tiles[y][x];
}

export function districtTiles(grid, districtId) {
  const d = districtById(districtId);
  const out = [];
  for (let y = d.rect.y0; y < d.rect.y1; y++) {
    for (let x = d.rect.x0; x < d.rect.x1; x++) {
      const t = tileAt(grid, x, y);
      if (t && t.terrain === 'land') out.push({ x, y, tile: t });
    }
  }
  return out;
}

export function neighbors4(x, y) {
  return [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]];
}

// Seed the 1918 starting city: a base street grid, mixed R/C/I development
// roughly matched to each district's historical population, and a handful
// of legacy els/subway spines.
export function seedStartingCity(grid) {
  const rng = mulberry32(190118);

  for (const d of DISTRICTS) {
    const traits = CHARACTER_TRAITS[d.character];
    const cap = characterCap(d.character);
    const cells = districtTiles(grid, d.id);
    if (!cells.length) continue;

    // Base street grid: every third row/column gets a street.
    for (const { x, y, tile } of cells) {
      const lx = x - d.rect.x0, ly = y - d.rect.y0;
      if (lx % 3 === 0 || ly % 3 === 0) tile.road = true;
    }

    // Zone + develop a fraction of tiles to hit ~startPopK (in thousands,
    // 1 devLevel unit == 1000 residents/jobs) split 70% R / 15% C / 15% I.
    const numToSeed = Math.round(cells.length * traits.startFill);
    const shuffled = cells.slice().sort(() => rng() - 0.5);
    const seedCells = shuffled.slice(0, numToSeed);

    let remainingPop = d.startPopK;
    for (let i = 0; i < seedCells.length; i++) {
      const { tile } = seedCells[i];
      const roll = rng();
      const zone = roll < 0.7 ? 'R' : (roll < 0.85 ? 'C' : 'I');
      tile.zone = zone;
      tile.road = true;
      if (zone === 'R' && remainingPop > 0) {
        const share = remainingPop / (seedCells.length - i);
        const level = Math.max(1, Math.min(cap, Math.round(share / 2)));
        tile.devLevel = level;
        remainingPop -= level * 2; // rough capacity/level for R at seed time
      } else {
        tile.devLevel = Math.max(1, Math.min(cap, 1 + Math.floor(rng() * (cap - 1))));
      }
      tile.landValue = traits.baseLandValue;
    }
  }

  // Legacy rail spines.
  for (const line of STARTING_RAIL) {
    for (const distId of line.districts) {
      const d = districtById(distId);
      const midX = Math.min(d.rect.x1 - 1, d.rect.x0 + Math.floor((d.rect.x1 - d.rect.x0) / 2) + line.offset);
      for (let y = d.rect.y0; y < d.rect.y1; y++) {
        const t = tileAt(grid, midX, y);
        if (t && t.terrain === 'land') {
          t.transit = line.mode;
          t.road = true;
        }
      }
    }
  }

  return grid;
}

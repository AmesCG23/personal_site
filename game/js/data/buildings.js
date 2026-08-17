// Zone types (R/C/I) and civic buildings.
// devLevel runs 0 (empty lot) .. 4 (fully built out). Each level has a
// population/job capacity in "pop units" (1 unit ~= 100 residents/jobs)
// and a base land value it needs to grow to the next level.

export const ZONE_TYPES = {
  R: { id: 'R', name: 'Residential', color: '#5f9e5a', costPerTile: 4 },
  C: { id: 'C', name: 'Commercial',  color: '#2f8f9c', costPerTile: 6 },
  I: { id: 'I', name: 'Industrial',  color: '#b06a2f', costPerTile: 5 },
};

// Capacity (pop units) per devLevel, by zone type.
export const CAPACITY = {
  R: [0, 1, 2, 4, 8],
  C: [0, 1, 2, 3, 5],
  I: [0, 1, 3, 5, 7],
};

// Max devLevel a tile can reach, by district "character".
export const CHARACTER_CAP = {
  'dense-tenement':  4,
  'rowhouse':        3,
  'industrial-core': 4,
  'suburban':        2,
  'rural':           1,
};

// Character multiplier on industrial output/jobs (industrial-core districts
// are more productive per tile) and on base land value.
export const CHARACTER_TRAITS = {
  'dense-tenement':  { industryBonus: 0.9, baseLandValue: 0.55, startFill: 0.55 },
  'rowhouse':        { industryBonus: 1.0, baseLandValue: 0.7,  startFill: 0.35 },
  'industrial-core': { industryBonus: 1.6, baseLandValue: 0.6,  startFill: 0.45 },
  'suburban':        { industryBonus: 0.7, baseLandValue: 0.9,  startFill: 0.15 },
  'rural':           { industryBonus: 0.4, baseLandValue: 1.0,  startFill: 0.05 },
};

export const CIVIC_BUILDINGS = {
  park: {
    id: 'park', name: 'Park', color: '#4f8f3f', cost: 12, upkeep: 0.1, radius: 4,
    effect: { happiness: 0.12, landValue: 0.08 },
    description: 'Green space. Boosts happiness and land value nearby. No service coverage.',
  },
  school: {
    id: 'school', name: 'School', color: '#d4af37', cost: 25, upkeep: 0.35, radius: 6,
    effect: { happiness: 0.1, growthBonus: 0.15 },
    description: 'Boosts happiness and lets residential zones grow further within its radius.',
  },
  hospital: {
    id: 'hospital', name: 'Hospital', color: '#c94a4a', cost: 40, upkeep: 0.5, radius: 7,
    effect: { happiness: 0.14 },
    description: 'Boosts happiness within its radius; reduces the impact of pollution nearby.',
  },
  'power-plant': {
    id: 'power-plant', name: 'Power Plant', color: '#263544', cost: 60, upkeep: 0.6, radius: 20,
    effect: { happiness: -0.08, pollution: 1.2, powersCity: true },
    description: 'Coal-fired power plant. Required for zones beyond devLevel 1 to grow anywhere in the city, but pollutes nearby tiles.',
  },
  'fire-station': {
    id: 'fire-station', name: 'Fire & Police Station', color: '#7a1f1f', cost: 30, upkeep: 0.3, radius: 8,
    effect: { happiness: 0.08, landValue: 0.05 },
    description: 'Public safety coverage. Boosts happiness and land value within its radius.',
  },
};

export function characterCap(character) {
  return CHARACTER_CAP[character] ?? 2;
}

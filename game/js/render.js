import { DISTRICTS, districtById, BOROUGHS } from './data/districts.js';
import { ZONE_TYPES, CIVIC_BUILDINGS } from './data/buildings.js';
import { CROSSINGS, TRANSIT_TYPES } from './data/transit.js';

export const TILE_SIZE = 12;

export function initCanvas(canvas, grid) {
  canvas.width = grid.w * TILE_SIZE;
  canvas.height = grid.h * TILE_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

// NYC flag palette: harbor blue water, warm white land, Dutch orange accent.
const WATER_LIGHT = '#6fa9c9';
const WATER_DARK = '#5a93b3';
const LAND_BASE = '#efece2';
const ROAD_COLOR = '#8a97a3';
const GRID_LINE = 'rgba(13,43,82,0.05)';
const BRIDGE_COLOR = '#1c3a5e';
const FERRY_COLOR = '#39a6b0';

function shade(hex, amt) {
  const c = hex.replace('#', '');
  const num = parseInt(c, 16);
  let r = (num >> 16) + amt, g = ((num >> 8) & 0xff) + amt, b = (num & 0xff) + amt;
  r = Math.max(0, Math.min(255, r)); g = Math.max(0, Math.min(255, g)); b = Math.max(0, Math.min(255, b));
  return `rgb(${r},${g},${b})`;
}

export function render(ctx, state, opts = {}) {
  const { grid } = state;
  const { w, h, tiles } = grid;
  const T = TILE_SIZE;

  ctx.clearRect(0, 0, w * T, h * T);

  // --- terrain + zoning + civic ---
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = tiles[y][x];
      const px = x * T, py = y * T;

      if (t.terrain === 'water') {
        ctx.fillStyle = (x + y) % 2 === 0 ? WATER_LIGHT : WATER_DARK;
        ctx.fillRect(px, py, T, T);
        continue;
      }

      const district = districtById(t.districtId);
      const borough = BOROUGHS[district.borough];
      ctx.fillStyle = LAND_BASE;
      ctx.fillRect(px, py, T, T);

      if (opts.showDistrictTint) {
        ctx.fillStyle = borough.color;
        ctx.globalAlpha = 0.08;
        ctx.fillRect(px, py, T, T);
        ctx.globalAlpha = 1;
      }

      if (t.road) {
        ctx.fillStyle = ROAD_COLOR;
        ctx.fillRect(px + T * 0.35, py, T * 0.3, T);
        ctx.fillRect(px, py + T * 0.35, T, T * 0.3);
      }

      if (t.civic) {
        drawCivic(ctx, px, py, T, t.civic);
      } else if (t.zone && t.devLevel > 0) {
        drawZoned(ctx, px, py, T, t.zone, t.devLevel);
      } else if (t.zone) {
        // zoned but undeveloped: faint outline
        ctx.strokeStyle = ZONE_TYPES[t.zone].color;
        ctx.globalAlpha = 0.5;
        ctx.strokeRect(px + 1.5, py + 1.5, T - 3, T - 3);
        ctx.globalAlpha = 1;
      }

      if (opts.showPollution && t.pollution > 0.15) {
        ctx.fillStyle = '#6a3f1a';
        ctx.globalAlpha = Math.min(0.45, t.pollution * 0.3);
        ctx.fillRect(px, py, T, T);
        ctx.globalAlpha = 1;
      }
    }
  }

  // --- transit lines (drawn over base tiles) ---
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = tiles[y][x];
      if (!t.transit) continue;
      drawTransit(ctx, x * T, y * T, T, t.transit);
    }
  }

  // --- gridlines (subtle) ---
  if (opts.showGrid) {
    ctx.strokeStyle = GRID_LINE;
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x++) { ctx.beginPath(); ctx.moveTo(x * T, 0); ctx.lineTo(x * T, h * T); ctx.stroke(); }
    for (let y = 0; y <= h; y++) { ctx.beginPath(); ctx.moveTo(0, y * T); ctx.lineTo(w * T, y * T); ctx.stroke(); }
  }

  // --- crossings (bridges/tunnels/ferries) ---
  for (const cr of CROSSINGS) {
    if (!state.unlockedCrossings.has(cr.id)) continue;
    const a = districtById(cr.a), b = districtById(cr.b);
    const ax = ((a.rect.x0 + a.rect.x1) / 2) * T, ay = ((a.rect.y0 + a.rect.y1) / 2) * T;
    const bx = ((b.rect.x0 + b.rect.x1) / 2) * T, by = ((b.rect.y0 + b.rect.y1) / 2) * T;
    ctx.strokeStyle = cr.mode === 'ferry' ? FERRY_COLOR : BRIDGE_COLOR;
    ctx.lineWidth = cr.mode === 'bridge' ? 2.5 : 2;
    ctx.setLineDash(cr.mode === 'ferry' ? [2, 4] : (cr.mode === 'tunnel' ? [6, 4] : []));
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(bx, by);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // --- district labels ---
  if (opts.showLabels) {
    ctx.font = '9px "Source Serif 4", serif';
    ctx.fillStyle = 'rgba(13,43,82,0.6)';
    ctx.textAlign = 'center';
    for (const d of DISTRICTS) {
      const cx = ((d.rect.x0 + d.rect.x1) / 2) * T;
      const cy = ((d.rect.y0 + d.rect.y1) / 2) * T;
      ctx.fillText(d.name.split(' & ')[0], cx, cy);
    }
  }

  // --- hover / selection ---
  if (opts.hover) {
    ctx.strokeStyle = '#f2711c';
    ctx.lineWidth = 2;
    ctx.strokeRect(opts.hover.x * T + 1, opts.hover.y * T + 1, T - 2, T - 2);
  }
}

function drawZoned(ctx, px, py, T, zone, level) {
  const base = ZONE_TYPES[zone].color;
  const frac = level / 4;
  const size = T * (0.4 + 0.5 * frac);
  const off = (T - size) / 2;
  ctx.fillStyle = shade(base, -10 * level);
  ctx.fillRect(px + off, py + off, size, size);
  ctx.strokeStyle = shade(base, -50);
  ctx.lineWidth = 1;
  ctx.strokeRect(px + off + 0.5, py + off + 0.5, size - 1, size - 1);
  if (level >= 2) {
    // window dots
    ctx.fillStyle = shade(base, 40);
    const n = level;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        ctx.fillRect(px + off + 2 + i * ((size - 4) / n), py + off + 2 + j * ((size - 4) / n), 1.2, 1.2);
      }
    }
  }
}

function drawCivic(ctx, px, py, T, civicId) {
  const color = CIVIC_BUILDINGS[civicId].color;
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, T - 2, T - 2);
  ctx.strokeStyle = 'rgba(13,43,82,0.5)';
  ctx.strokeRect(px + 1.5, py + 1.5, T - 3, T - 3);
  ctx.fillStyle = '#f5f4f0';
  if (civicId === 'park') {
    ctx.beginPath(); ctx.arc(px + T / 2, py + T / 2, T * 0.22, 0, Math.PI * 2); ctx.fill();
  } else if (civicId === 'hospital') {
    ctx.fillRect(px + T / 2 - 3, py + T / 2 - 1, 6, 2);
    ctx.fillRect(px + T / 2 - 1, py + T / 2 - 3, 2, 6);
  } else if (civicId === 'power-plant') {
    ctx.fillRect(px + T * 0.3, py + T * 0.2, 2, T * 0.5);
    ctx.fillRect(px + T * 0.6, py + T * 0.2, 2, T * 0.5);
  } else if (civicId === 'fire-station') {
    ctx.beginPath(); ctx.moveTo(px + T / 2, py + 2); ctx.lineTo(px + T - 2, py + T - 2); ctx.lineTo(px + 2, py + T - 2); ctx.closePath(); ctx.fill();
  } else if (civicId === 'school') {
    ctx.fillRect(px + T / 2 - 2, py + 2, 4, T - 4);
  }
}

function drawTransit(ctx, px, py, T, type) {
  const color = TRANSIT_TYPES[type].color;
  ctx.strokeStyle = color;
  if (type === 'highway') {
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(px, py + T / 2); ctx.lineTo(px + T, py + T / 2); ctx.stroke();
    ctx.strokeStyle = '#f5f4f0'; ctx.lineWidth = 0.8; ctx.setLineDash([2, 2]);
    ctx.beginPath(); ctx.moveTo(px, py + T / 2); ctx.lineTo(px + T, py + T / 2); ctx.stroke();
    ctx.setLineDash([]);
  } else if (type === 'subway') {
    ctx.lineWidth = 2; ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.moveTo(px, py + T / 2); ctx.lineTo(px + T, py + T / 2); ctx.stroke();
    ctx.setLineDash([]);
  } else if (type === 'elevated') {
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(px, py + T / 2); ctx.lineTo(px + T, py + T / 2); ctx.stroke();
    ctx.fillStyle = color;
    ctx.fillRect(px + T / 2 - 0.75, py + T / 2, 1.5, T / 2);
  } else if (type === 'trolley') {
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(px, py + T / 2); ctx.lineTo(px + T, py + T / 2); ctx.stroke();
  } else if (type === 'bus') {
    ctx.lineWidth = 1.5; ctx.setLineDash([1.5, 2]);
    ctx.beginPath(); ctx.moveTo(px, py + T / 2); ctx.lineTo(px + T, py + T / 2); ctx.stroke();
    ctx.setLineDash([]);
  }
}

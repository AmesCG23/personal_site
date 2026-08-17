import { ZONE_TYPES, CIVIC_BUILDINGS } from './data/buildings.js';
import { TRANSIT_TYPES } from './data/transit.js';
import { DISTRICTS, districtById } from './data/districts.js';
import * as sim from './sim.js';
import { render, TILE_SIZE } from './render.js';
import * as save from './save.js';

const ZONE_DESCRIPTIONS = {
  R: 'Residential lots. Grow into housing when demand, transit access, and land value support it.',
  C: 'Commercial lots. Grow into shops and offices, driven mostly by nearby population.',
  I: 'Industrial lots. Provide jobs and tax base, but pollute nearby tiles.',
};

let app = null;
let selectedTool = { category: 'zone', id: 'R' };
let hoverTile = null;
let selectedDistrictId = null;
let painting = false;
let lastPaintedKey = null;
let renderScheduled = false;
let toolButtons = {}; // "category:id" -> button element
let saveLoadMode = 'save';

const renderOpts = { showPollution: false, showLabels: false, showDistrictTint: true, showGrid: false };

export function initUI(_app) {
  app = _app;
  buildToolPalette();
  bindMapEvents();
  bindTopBar();
  bindLayerToggles();
  bindModals();
  refreshAll();
}

// ---------------------------------------------------------------- palette

function toolButton(category, def, extra) {
  const btn = document.createElement('button');
  btn.className = 'tool-btn';
  btn.dataset.category = category;
  btn.dataset.id = def.id;
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.style.background = extra.color;
  const name = document.createElement('span');
  name.className = 'tool-name';
  name.textContent = extra.name;
  const cost = document.createElement('span');
  cost.className = 'tool-cost';
  cost.textContent = extra.costLabel;
  btn.append(swatch, name, cost);
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    selectedTool = { category, id: def.id };
    updateSelectedToolUI();
    showToolDetail(category, def);
  });
  toolButtons[`${category}:${def.id}`] = btn;
  return btn;
}

function buildToolPalette() {
  const zoneWrap = document.getElementById('tools-zone');
  for (const z of Object.values(ZONE_TYPES)) {
    zoneWrap.appendChild(toolButton('zone', z, { color: z.color, name: z.name, costLabel: `$${z.costPerTile}/tile` }));
  }

  const transitWrap = document.getElementById('tools-transit');
  for (const t of Object.values(TRANSIT_TYPES)) {
    transitWrap.appendChild(toolButton('transit', t, { color: transitSwatchColor(t.id), name: t.name, costLabel: `$${t.costPerTile}/tile` }));
  }

  const civicWrap = document.getElementById('tools-civic');
  for (const c of Object.values(CIVIC_BUILDINGS)) {
    civicWrap.appendChild(toolButton('civic', c, { color: civicSwatchColor(c.id), name: c.name, costLabel: `$${c.cost}` }));
  }

  const miscWrap = document.getElementById('tools-misc');
  const bulldoze = document.createElement('button');
  bulldoze.className = 'tool-btn';
  bulldoze.dataset.category = 'bulldoze';
  bulldoze.dataset.id = 'bulldoze';
  bulldoze.innerHTML = '<span class="swatch" style="background:#a8201a"></span><span class="tool-name">Bulldoze</span><span class="tool-cost">$3/tile</span>';
  bulldoze.addEventListener('click', () => {
    selectedTool = { category: 'bulldoze', id: 'bulldoze' };
    updateSelectedToolUI();
    document.getElementById('tool-detail').innerHTML = '<div class="tool-detail-title">Bulldoze</div><p>Clear a tile back to an empty lot.</p>';
  });
  toolButtons['bulldoze:bulldoze'] = bulldoze;
  miscWrap.appendChild(bulldoze);

  updateSelectedToolUI();
  showToolDetail('zone', ZONE_TYPES.R);
}

function transitSwatchColor(id) {
  return { road: '#93897a', trolley: '#c9954a', elevated: '#5e564a', subway: '#2b6fa8', bus: '#6a8f5e', highway: '#1a1814' }[id];
}
function civicSwatchColor(id) {
  return { park: '#5f8f4e', school: '#c9a63f', hospital: '#c94a4a', 'power-plant': '#3a3630', 'fire-station': '#a8201a' }[id];
}

function updateSelectedToolUI() {
  for (const btn of Object.values(toolButtons)) {
    btn.classList.toggle('selected', btn.dataset.category === selectedTool.category && btn.dataset.id === selectedTool.id);
  }
}

function showToolDetail(category, def) {
  const el = document.getElementById('tool-detail');
  const desc = category === 'zone' ? ZONE_DESCRIPTIONS[def.id] : def.description;
  const unlockNote = category === 'transit' ? unlockNoteFor(def) : '';
  el.innerHTML = `<div class="tool-detail-title">${def.name}</div><p>${desc || ''}</p>${unlockNote}`;
}

function unlockNoteFor(def) {
  const state = app.getState();
  if (def.unlockYear > state.year && !state.forceUnlockedTech.has(def.id)) {
    return `<p class="muted">Unlocks in ${def.unlockYear}.</p>`;
  }
  if (def.obsoleteYear && state.year >= def.obsoleteYear) {
    return `<p class="muted">${def.obsoleteNote || 'Largely phased out by this era.'}</p>`;
  }
  return '';
}

function refreshToolAvailability() {
  const state = app.getState();
  for (const t of Object.values(TRANSIT_TYPES)) {
    const btn = toolButtons[`transit:${t.id}`];
    const unlocked = t.unlockYear <= state.year || state.forceUnlockedTech.has(t.id);
    btn.disabled = !unlocked;
  }
}

// ---------------------------------------------------------------- map interaction

function bindMapEvents() {
  const canvas = document.getElementById('map-canvas');
  const tooltip = document.getElementById('tile-tooltip');

  canvas.addEventListener('mousemove', (e) => {
    const { x, y } = tileFromEvent(canvas, e);
    if (x == null) { hoverTile = null; tooltip.classList.add('hidden'); scheduleRender(); return; }
    if (!hoverTile || hoverTile.x !== x || hoverTile.y !== y) {
      hoverTile = { x, y };
      scheduleRender();
    }
    positionTooltip(tooltip, e, x, y);
    if (painting) paintAt(x, y);
  });

  canvas.addEventListener('mouseleave', () => {
    hoverTile = null;
    tooltip.classList.add('hidden');
    scheduleRender();
  });

  canvas.addEventListener('mousedown', (e) => {
    const { x, y } = tileFromEvent(canvas, e);
    if (x == null) return;
    painting = true;
    lastPaintedKey = null;
    paintAt(x, y);
  });

  window.addEventListener('mouseup', () => {
    if (painting) {
      painting = false;
      sim.recomputeDerived(app.getState());
      refreshAll();
    }
  });
}

function tileFromEvent(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width, scaleY = canvas.height / rect.height;
  const px = (e.clientX - rect.left) * scaleX, py = (e.clientY - rect.top) * scaleY;
  const x = Math.floor(px / TILE_SIZE), y = Math.floor(py / TILE_SIZE);
  const state = app.getState();
  if (x < 0 || y < 0 || x >= state.grid.w || y >= state.grid.h) return { x: null, y: null };
  return { x, y };
}

function positionTooltip(tooltip, e, x, y) {
  const state = app.getState();
  const t = state.grid.tiles[y][x];
  if (t.terrain !== 'land') {
    tooltip.classList.add('hidden');
    return;
  }
  const d = districtById(t.districtId);
  let lines = [`<strong>${d.name}</strong>`];
  if (t.civic) lines.push(CIVIC_BUILDINGS[t.civic].name);
  else if (t.zone) lines.push(`${ZONE_TYPES[t.zone].name} &middot; level ${t.devLevel}/4`);
  else lines.push('Empty lot');
  if (t.transit) lines.push(TRANSIT_TYPES[t.transit].name);
  else if (t.road) lines.push('Street');
  lines.push(`Access ${(t.access * 100).toFixed(0)}% &middot; Pollution ${(t.pollution * 100).toFixed(0)}% &middot; Land value ${(t.landValue * 100).toFixed(0)}%`);
  tooltip.innerHTML = lines.join('<br/>');
  tooltip.classList.remove('hidden');
  tooltip.style.left = `${e.clientX + 16}px`;
  tooltip.style.top = `${e.clientY + 16}px`;
}

function paintAt(x, y) {
  const key = `${x},${y}`;
  if (key === lastPaintedKey) return;
  lastPaintedKey = key;
  const state = app.getState();
  let acted = false;
  if (selectedTool.category === 'zone') acted = sim.zoneTile(state, x, y, selectedTool.id);
  else if (selectedTool.category === 'bulldoze') acted = sim.bulldozeTile(state, x, y);
  else if (selectedTool.category === 'transit') {
    acted = selectedTool.id === 'road' ? sim.buildRoad(state, x, y) : sim.buildTransit(state, x, y, selectedTool.id);
  } else if (selectedTool.category === 'civic') acted = sim.buildCivic(state, x, y, selectedTool.id);

  const tile = state.grid.tiles[y][x];
  if (tile.terrain === 'land' && tile.districtId) {
    selectedDistrictId = tile.districtId;
    updateDistrictPanel();
  }
  updateTopStats();
  scheduleRender();
  if (acted === false && painting) {
    // treasury too low or invalid placement -- still fine, just no-op
  }
}

function scheduleRender() {
  if (renderScheduled) return;
  renderScheduled = true;
  requestAnimationFrame(() => {
    renderScheduled = false;
    app.requestRender({ ...renderOpts, hover: hoverTile });
  });
}

// ---------------------------------------------------------------- top bar

function bindTopBar() {
  document.querySelectorAll('#speed-controls button').forEach(btn => {
    btn.addEventListener('click', () => {
      app.getState().speed = Number(btn.dataset.speed);
      document.querySelectorAll('#speed-controls button').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  document.getElementById('tax-rate-slider').addEventListener('input', (e) => {
    const state = app.getState();
    state.taxRate = Number(e.target.value) / 100;
    document.getElementById('tax-rate-value').textContent = `${e.target.value}%`;
    sim.recomputeDerived(state);
    updateBudget();
  });
}

function bindLayerToggles() {
  document.getElementById('opt-pollution').addEventListener('change', (e) => { renderOpts.showPollution = e.target.checked; scheduleRender(); });
  document.getElementById('opt-labels').addEventListener('change', (e) => { renderOpts.showLabels = e.target.checked; scheduleRender(); });
  document.getElementById('opt-tint').addEventListener('change', (e) => { renderOpts.showDistrictTint = e.target.checked; scheduleRender(); });
  document.getElementById('opt-grid').addEventListener('change', (e) => { renderOpts.showGrid = e.target.checked; scheduleRender(); });
}

function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
function fmtMoney(n) { return `$${fmt(n)}k`; }

function updateTopStats() {
  const state = app.getState();
  document.getElementById('year-display').textContent = state.year;
  document.getElementById('stat-population').textContent = fmt(state.cityStats.population);
  document.getElementById('stat-happiness').textContent = `${Math.round(state.cityStats.happiness * 100)}%`;
  document.getElementById('stat-treasury').textContent = fmtMoney(state.treasury);
  document.getElementById('stat-score').textContent = fmt(state.cityStats.score);
}

function updateBudget() {
  const state = app.getState();
  document.getElementById('tax-rate-value').textContent = `${Math.round(state.taxRate * 100)}%`;
  document.getElementById('tax-rate-slider').value = Math.round(state.taxRate * 100);
}

function updateDistrictPanel() {
  const panel = document.getElementById('district-panel');
  if (!selectedDistrictId) {
    panel.innerHTML = '<h2>District</h2><p class="muted">Click a tile to inspect its district.</p>';
    return;
  }
  const state = app.getState();
  const d = districtById(selectedDistrictId);
  const s = state.districtStats[selectedDistrictId];
  if (!s) return;
  panel.innerHTML = `
    <h2>District</h2>
    <h3>${d.name}</h3>
    <div class="kv"><span>Population</span><span>${fmt(s.population)}</span></div>
    <div class="kv"><span>Jobs</span><span>${fmt(s.jobs)}</span></div>
    <div class="kv"><span>Happiness</span><span>${Math.round(s.happiness * 100)}%</span></div>
    <div class="kv"><span>Transit access</span><span>${Math.round(s.access * 100)}%</span></div>
    <div class="kv"><span>Pollution</span><span>${Math.round(s.pollution * 100)}%</span></div>
    <div class="kv"><span>Land value</span><span>${Math.round(s.landValue * 100)}%</span></div>
    <div class="kv"><span>Car mode share</span><span>${Math.round((s.carShare || 0) * 100)}%</span></div>
    <div class="kv"><span>Congestion</span><span>${Math.round((s.congestion || 0) * 100)}%</span></div>
  `;
}

function updateEventLogUI() {
  const state = app.getState();
  const list = document.getElementById('event-log');
  list.innerHTML = '';
  const recent = state.eventLog.slice(-40).reverse();
  for (const entry of recent) {
    const li = document.createElement('li');
    li.innerHTML = `<span class="log-year">${entry.year}</span>${entry.title}`;
    li.title = entry.body;
    list.appendChild(li);
  }
}

// ---------------------------------------------------------------- modals

function bindModals() {
  document.getElementById('btn-help').addEventListener('click', () => toggleModal('help-modal', true));
  document.getElementById('help-close').addEventListener('click', () => toggleModal('help-modal', false));

  document.getElementById('btn-save').addEventListener('click', () => openSaveLoad('save'));
  document.getElementById('btn-load').addEventListener('click', () => openSaveLoad('load'));
  document.getElementById('saveload-close').addEventListener('click', () => toggleModal('saveload-modal', false));

  document.getElementById('final-continue-btn').addEventListener('click', () => {
    app.getState().finalReportShown = true;
    toggleModal('final-modal', false);
  });
}

function toggleModal(id, show) {
  document.getElementById(id).classList.toggle('hidden', !show);
}

export function showEventModal(event, year) {
  document.getElementById('event-modal-year').textContent = year;
  document.getElementById('event-modal-title').textContent = event.title + (event.subtitle ? ` — ${event.subtitle}` : '');
  document.getElementById('event-modal-body').textContent = event.body;
  const optWrap = document.getElementById('event-modal-options');
  optWrap.innerHTML = '';
  event.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.textContent = opt.label;
    btn.addEventListener('click', () => {
      sim.resolveEvent(app.getState(), idx);
      toggleModal('event-modal', false);
      refreshAll();
    });
    optWrap.appendChild(btn);
  });
  toggleModal('event-modal', true);
}

export function showNotice(notice) {
  // Auto (non-choice) events: append straight to the log; the log panel
  // itself is the "toast" surface for this vintage-newspaper UI.
  updateEventLogUI();
}

export function showFinalReportIfNeeded() {
  const state = app.getState();
  if (state.finalReportPending && !state.finalReportShown) {
    const body = document.getElementById('final-report-body');
    const top3 = DISTRICTS
      .map(d => ({ d, s: state.districtStats[d.id] }))
      .sort((a, b) => (b.s?.population || 0) - (a.s?.population || 0))
      .slice(0, 3);
    body.innerHTML = `
      <p>New York's metro population stands at <strong>${fmt(state.cityStats.population)}</strong>, with citywide happiness at <strong>${Math.round(state.cityStats.happiness * 100)}%</strong>.</p>
      <p>Final Metro Score: <strong>${fmt(state.cityStats.score)}</strong></p>
      <p>Largest districts: ${top3.map(x => `${x.d.name} (${fmt(x.s.population)})`).join(', ')}.</p>
      <p>The game continues in free play &mdash; keep building, or start a new game from the Help menu's reload instructions.</p>
    `;
    toggleModal('final-modal', true);
    state.finalReportPending = false;
  }
}

function openSaveLoad(mode) {
  saveLoadMode = mode;
  document.getElementById('saveload-title').textContent = mode === 'save' ? 'Save Game' : 'Load Game';
  const wrap = document.getElementById('saveload-slots');
  wrap.innerHTML = '';
  const slots = [...save.SLOT_IDS];
  for (const slotId of slots) {
    const info = save.slotInfo(slotId);
    const row = document.createElement('div');
    row.className = 'save-slot';
    const label = document.createElement('span');
    label.textContent = `Slot ${slotId.toUpperCase()}`;
    const meta = document.createElement('span');
    meta.className = 'slot-meta';
    meta.textContent = info ? `Year ${info.year}` : 'Empty';
    row.append(label, meta);
    row.addEventListener('click', () => {
      const state = app.getState();
      if (mode === 'save') {
        save.saveToSlot(state, slotId);
      } else {
        const loaded = save.loadFromSlot(slotId);
        if (loaded) app.setState(loaded.state);
      }
      toggleModal('saveload-modal', false);
      refreshAll();
    });
    wrap.appendChild(row);
  }
  toggleModal('saveload-modal', true);
}

// ---------------------------------------------------------------- refresh

export function refreshAll() {
  const state = app.getState();
  updateTopStats();
  updateBudget();
  updateDistrictPanel();
  updateEventLogUI();
  refreshToolAvailability();
  updateDemandDisplay();
  scheduleRender();
  if (state.pendingEvent) showEventModal(state.pendingEvent, state.year);
  showFinalReportIfNeeded();
}

function updateDemandDisplay() {
  const state = app.getState();
  const demand = sim.currentCityDemand(state);
  for (const key of ['R', 'C', 'I']) {
    const el = document.getElementById(`demand-${key}`);
    const val = demand[key]; // 0..1, 0.5 = neutral
    const pct = Math.round((val - 0.5) * 200); // -100..100
    el.style.width = `${Math.abs(pct) / 2}%`;
    el.style.left = pct >= 0 ? '50%' : `${50 - Math.abs(pct) / 2}%`;
  }
  document.getElementById('budget-revenue').textContent = fmtMoney(state._lastRevenue || 0);
  document.getElementById('budget-upkeep').textContent = fmtMoney(state._lastUpkeep || 0);
}

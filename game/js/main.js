import * as sim from './sim.js';
import * as save from './save.js';
import { render, initCanvas } from './render.js';
import * as ui from './ui.js';

const SPEED_INTERVAL_MS = { 0: Infinity, 1: 900, 2: 350, 3: 110 };
const AUTOSAVE_EVERY_MONTHS = 6;

let state = null;
let canvas = null;
let ctx = null;
let lastTickAt = 0;
let monthsSinceAutosave = 0;

function boot() {
  const existing = save.loadAutosave();
  state = existing ? existing.state : sim.createInitialState();

  canvas = document.getElementById('map-canvas');
  ctx = initCanvas(canvas, state.grid);

  const app = {
    getState: () => state,
    setState: (s) => { state = s; ctx = initCanvas(canvas, state.grid); },
    requestRender: (opts) => render(ctx, state, opts),
  };

  ui.initUI(app);

  requestAnimationFrame(loop);
}

function loop(ts) {
  const interval = SPEED_INTERVAL_MS[state.speed] ?? SPEED_INTERVAL_MS[1];
  if (!state.pendingEvent && interval !== Infinity && ts - lastTickAt >= interval) {
    lastTickAt = ts;
    sim.tickMonth(state);
    monthsSinceAutosave++;
    if (monthsSinceAutosave >= AUTOSAVE_EVERY_MONTHS) {
      monthsSinceAutosave = 0;
      save.autosave(state);
    }
    ui.refreshAll();
  }
  requestAnimationFrame(loop);
}

boot();

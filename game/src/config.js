// Marigold Galley's tuning numbers, layout and palette, in one place. The screen is a fixed
// 1280x720 logical area the renderer scales to the window, so no rule depends on screen size.

/** The kitchen floor plan: an 11x6 grid of 84px tiles under the order rail. */
export const KITCHEN_GRID = { x: 16, y: 152, tile: 84, cols: 11, rows: 6 };

/** Station art is drawn for a 72px tile and scaled by this. */
export const ART_SCALE = KITCHEN_GRID.tile / 72;

/**
 * The galley, one character per tile. `.` floor, `#` bare counter, `K` chopping board,
 * `S` skillet, `R` rice pot, `1`-`3` plating bench with that plate, `P` serve hatch, `X` scrap bin,
 * lower-case letters are ingredient crates (see CRATE_KEYS).
 */
export const KITCHEN_PLAN = [
  '#togh#efSS#',
  'K.........R',
  '#..#123#..R',
  'K.........X',
  '#.........#',
  '#bi###PP###',
];

export const CRATE_KEYS = { t: 'tomato', o: 'onion', g: 'greens', h: 'cheese', e: 'egg', f: 'fish', b: 'flatbread', i: 'rice' };

/** Mise en place: loose ingredients waiting on bare counters when a shift opens. */
export const COUNTER_STOCK = [
  { col: 3, row: 2, kind: 'tomato' },
  { col: 7, row: 2, kind: 'onion' },
  { col: 5, row: 0, kind: 'cheese' },
  { col: 3, row: 5, kind: 'flatbread' },
  { col: 4, row: 5, kind: 'tomato' },
  { col: 10, row: 4, kind: 'egg' },
  { col: 0, row: 4, kind: 'onion' },
  { col: 0, row: 2, kind: 'greens' },
];

export const STEP = 1 / 60;

export const FIELD = { width: 1280, height: 720 };

export const COOK = { speed: 340, half: 24, chopRepeat: 0.17 };

/** Seconds on the heat until done, and until burnt (the rice pot keeps warm and never burns). */
export const COOK_TIMES = {
  skillet: { done: 4.2, burn: 13 },
  pot: { done: 6.5, burn: Infinity },
};

export const SERVICE = {
  seconds: 180,
  boardSize: 4,
  plateReturn: 1.8,
  bannerSeconds: 2.6,
};

/** Order cadence: everything eases from the first value to the second across a shift. */
export const ORDER_PACE = {
  firstOrderAt: 1,
  openingOrders: 2,
  interval: [26, 13],
  patience: [92, 62],
  rushAt: [0.3, 0.58, 0.82],
  rushSize: 2,
  daySqueeze: 0.88,
};

export const SCORING = {
  perPart: 20,
  tipMax: 25,
  comboStep: 0.25,
  comboMax: 3,
  missPenalty: 15,
  stars: [400, 900, 1500],
};

export const PALETTE = {
  night: '#1d0e22',
  wall: '#341a3b',
  wallTrim: '#55294f',
  floorA: '#d97a50',
  floorB: '#c76a42',
  grout: '#a8522f',
  counterTop: '#fff0d2',
  counterSeam: '#e9d1a6',
  counterFront: '#6a2f4c',
  counterFrontText: '#ffd9a0',
  ink: '#2a1230',
  paper: '#fff8ea',
  cream: '#fff6e5',
  marigold: '#ffb21e',
  marigoldDeep: '#ef8a00',
  teal: '#1fb5a3',
  tealDeep: '#0f7f74',
  amber: '#ffae1a',
  red: '#ec3b33',
  leaf: '#4caf3d',
  leafDark: '#2e7d2a',
  wood: '#c98a4b',
  woodDark: '#8e5a2b',
  iron: '#2b2730',
  brass: '#d9a441',
  muted: '#b89aa8',
};

export const FONT = '"Arial Rounded MT Bold", "Nunito", "Segoe UI", system-ui, sans-serif';

export const BEST_KEY = 'marigold-galley.best';

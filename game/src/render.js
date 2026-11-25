// Painting the galley: the terracotta floor, cream counters with aubergine fronts, each station
// with what sits on it (crates heaped with produce, a board mid-chop, sizzling pans with cook
// rings, plates on the benches, the hatch under its heat lamp), Chef Pim, and the effects. The
// HUD (clock, order rail, cookbook, keys, cards) is hud.js; the food itself is food.js.
import { ART_SCALE, COOK_TIMES, FIELD, FONT, KITCHEN_GRID, PALETTE } from './config.js';
import { INGREDIENTS } from './ingredients.js';
import { STATION, tileCentre } from './kitchen.js';
import { matchRecipe, plateFitsRecipe, RECIPES } from './recipes.js';
import { stationInReach } from './player.js';
import { drawIngredient, drawPlatedDish, roundRect } from './food.js';
import { drawKeyHints, drawOrderBoard, drawRecipeBook, drawResultCard, drawScoreCard, drawServiceTimer, drawTitleCard, drawPauseCard } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const T = KITCHEN_GRID.tile;
const LIP = 17;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function fitToWindow() {
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
    }
    scale = Math.min(width / FIELD.width, height / FIELD.height);
    offsetX = (width - FIELD.width * scale) / 2;
    offsetY = (height - FIELD.height * scale) / 2;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.night;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * offsetX, ratio * offsetY);
  }

  return {
    /** Window pixels to the 1280x720 field (for mouse clicks). */
    toField(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      return { x: (clientX - rect.left - offsetX) / scale, y: (clientY - rect.top - offsetY) / scale };
    },
    paintFrame(state, screen, view = {}) {
      fitToWindow();
      const t = state.clock;
      drawGalleyRoom(ctx);
      drawFloorTiles(ctx, state);
      drawCounters(ctx, state, t);
      drawPlannedRoute(ctx, state, t);
      if (screen === SCREEN_PLAY) drawReachHighlight(ctx, state, t);
      drawCook(ctx, state, t);
      drawEffects(ctx, state);
      drawRushBanner(ctx, state);
      drawServiceTimer(ctx, state, t);
      drawOrderBoard(ctx, state, t);
      drawScoreCard(ctx, state, t);
      drawRecipeBook(ctx, state, t);
      drawKeyHints(ctx, state);
      if (screen === SCREEN_TITLE) drawTitleCard(ctx, view, t);
      else if (screen === SCREEN_PAUSED) drawPauseCard(ctx);
      else if (screen === SCREEN_OVER) drawResultCard(ctx, state, view, t);
    },
  };
}

function drawGalleyRoom(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  sky.addColorStop(0, '#2a1431');
  sky.addColorStop(1, PALETTE.night);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  const x = KITCHEN_GRID.x - 8;
  const y = KITCHEN_GRID.y - 8;
  const w = KITCHEN_GRID.cols * T + 16;
  const h = KITCHEN_GRID.rows * T + 16;
  ctx.fillStyle = PALETTE.wallTrim;
  roundRect(ctx, x, y, w, h, 18);
  ctx.fill();
  ctx.strokeStyle = '#7a3a6a';
  ctx.lineWidth = 3;
  ctx.stroke();
}

function drawFloorTiles(ctx, state) {
  const half = T / 2;
  for (let row = 0; row < KITCHEN_GRID.rows; row += 1) {
    for (let col = 0; col < KITCHEN_GRID.cols; col += 1) {
      if (state.grid[row][col]) continue;
      const x = KITCHEN_GRID.x + col * T;
      const y = KITCHEN_GRID.y + row * T;
      for (let sub = 0; sub < 4; sub += 1) {
        const sx = sub % 2;
        const sy = Math.floor(sub / 2);
        ctx.fillStyle = (col * 2 + sx + row * 2 + sy) % 2 ? PALETTE.floorA : PALETTE.floorB;
        ctx.fillRect(x + sx * half, y + sy * half, half, half);
      }
      ctx.strokeStyle = PALETTE.grout;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 0.75, y + 0.75, T - 1.5, T - 1.5);
    }
  }
  // Shadows the counters cast on the floor below them.
  ctx.fillStyle = 'rgba(60,15,35,0.28)';
  for (let row = 0; row < KITCHEN_GRID.rows; row += 1) {
    for (let col = 0; col < KITCHEN_GRID.cols; col += 1) {
      if (state.grid[row][col] && row + 1 < KITCHEN_GRID.rows && !state.grid[row + 1][col]) {
        ctx.fillRect(KITCHEN_GRID.x + col * T, KITCHEN_GRID.y + (row + 1) * T, T, 10);
      }
    }
  }
}

/** The walk the cook has planned (after a click, a plate key, or the pilot): marigold footsteps to a ring. */
function drawPlannedRoute(ctx, state, t) {
  const cook = state.cook;
  if (cook.route.length === 0) return;
  const points = [{ x: cook.x, y: cook.y }].concat(cook.route.map((tile) => tileCentre(tile.col, tile.row)));
  ctx.fillStyle = 'rgba(255,214,110,0.9)';
  let carry = (t * 60) % 18;
  for (let index = 1; index < points.length; index += 1) {
    const a = points[index - 1];
    const b = points[index];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    for (let d = carry; d < length; d += 18) {
      ctx.beginPath();
      ctx.arc(a.x + ((b.x - a.x) * d) / length, a.y + ((b.y - a.y) * d) / length, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    carry = (carry - length) % 18;
    if (carry < 0) carry += 18;
  }
  const end = points[points.length - 1];
  ctx.strokeStyle = PALETTE.marigold;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(end.x, end.y, 14 + Math.sin(t * 8) * 2, 0, Math.PI * 2);
  ctx.stroke();
  if (cook.pending !== null) {
    const target = state.stations[cook.pending];
    const x = KITCHEN_GRID.x + target.col * T;
    const y = KITCHEN_GRID.y + target.row * T;
    ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(255,214,110,0.95)';
    ctx.lineWidth = 3;
    roundRect(ctx, x + 4, y + 4, T - 8, T - 8, 9);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawCounters(ctx, state, t) {
  for (const station of state.stations) drawCounterSlab(ctx, state, station);
  for (const station of state.stations) drawStationLabel(ctx, state, station);
  for (const station of state.stations) drawStationContents(ctx, state, station, t);
}

function hasLip(state, station) {
  return station.row + 1 >= KITCHEN_GRID.rows || !state.grid[station.row + 1][station.col];
}

const STATION_LABELS = {
  board: 'CHOP',
  skillet: 'SKILLET',
  pot: 'RICE POT',
  bench: 'PLATE',
  pass: 'SERVE',
  bin: 'SCRAPS',
};

function drawCounterSlab(ctx, state, station) {
  const x = KITCHEN_GRID.x + station.col * T;
  const y = KITCHEN_GRID.y + station.row * T;
  const lip = hasLip(state, station);
  const topH = lip ? T - LIP : T;
  ctx.fillStyle = station.kind === STATION.pass ? '#f6d48a' : PALETTE.counterTop;
  ctx.fillRect(x, y, T, topH);
  ctx.strokeStyle = PALETTE.counterSeam;
  ctx.lineWidth = 2;
  ctx.strokeRect(x + 1, y + 1, T - 2, topH - 2);
  if (lip) {
    ctx.fillStyle = station.kind === STATION.pass ? '#b0402a' : PALETTE.counterFront;
    ctx.fillRect(x, y + topH, T, LIP);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(x, y + topH, T, 2);
  }
}

/** The name on a station's front lip (or on a tag when it has no lip): TOMATO, CHOP, PLATE 2... */
function drawStationLabel(ctx, state, station) {
  const x = KITCHEN_GRID.x + station.col * T;
  const y = KITCHEN_GRID.y + station.row * T;
  const lip = hasLip(state, station);
  const topH = lip ? T - LIP : T;
  const label = station.kind === STATION.crate ? INGREDIENTS[station.ingredient].label.toUpperCase().replace('RIVER ', '') : STATION_LABELS[station.kind];
  if (!label) return;
  if (station.kind === STATION.pass && station.number > 1) return;
  const text = station.kind === STATION.bench ? `${label} ${station.number}` : station.kind === STATION.pass ? '▼ SERVE HATCH ▼' : label;
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (lip) {
    ctx.fillStyle = station.kind === STATION.pass ? '#ffe9a8' : PALETTE.counterFrontText;
    ctx.fillText(text, x + (station.kind === STATION.pass ? T : T / 2), y + topH + LIP / 2 + 0.5);
  } else {
    const width = ctx.measureText(text).width + 10;
    ctx.fillStyle = PALETTE.counterFront;
    roundRect(ctx, x + T / 2 - width / 2, y + T - 17, width, 15, 4);
    ctx.fill();
    ctx.fillStyle = PALETTE.counterFrontText;
    ctx.fillText(text, x + T / 2, y + T - 9);
  }
}

function surfaceCentre(state, station) {
  const centre = tileCentre(station.col, station.row);
  return { x: centre.x, y: centre.y - (hasLip(state, station) ? LIP / 2 : 6) };
}

function drawStationContents(ctx, state, station, t) {
  const centre = surfaceCentre(state, station);
  const jiggle = station.shake > 0 ? Math.sin(station.shake * 90) * 3 : 0;
  ctx.save();
  ctx.translate(centre.x + jiggle, centre.y);
  ctx.scale(ART_SCALE, ART_SCALE);
  const x = 0;
  const y = 0;
  switch (station.kind) {
    case STATION.crate:
      drawCrate(ctx, station, x, y);
      break;
    case STATION.board:
      drawChoppingBoard(ctx, state, station, x, y);
      break;
    case STATION.skillet:
      drawSkillet(ctx, station, x, y, t);
      break;
    case STATION.pot:
      drawRicePot(ctx, station, x, y, t);
      break;
    case STATION.bench:
      drawPlatingBench(ctx, station, x, y);
      break;
    case STATION.pass:
      drawServeHatch(ctx, station, x, y, t);
      break;
    case STATION.bin:
      drawScrapBin(ctx, x, y);
      break;
    default:
      if (!station.item && !station.plate) drawCounterDecor(ctx, station, x, y);
  }
  if (station.kind !== STATION.pass && station.kind !== STATION.bench && station.plate) drawPlateOnStation(ctx, station.plate, x, y, 23, t);
  if (station.item && (station.kind === STATION.counter || station.kind === STATION.bench || station.kind === STATION.pass)) drawIngredient(ctx, station.item.kind, station.item.state, x, y, 1.15);
  ctx.restore();
}

function drawPlateOnStation(ctx, plate, x, y, r, t) {
  const recipe = matchRecipe(plate.items);
  const pop = plate.pop > 0 ? 1 + Math.sin((plate.pop / 0.22) * Math.PI) * 0.22 : 1;
  const shake = plate.shake > 0 ? Math.sin(plate.shake * 80) * 4 : 0;
  drawPlatedDish(ctx, plate.items, x + shake, y, r * pop, { complete: Boolean(recipe), colour: recipe ? recipe.colour : undefined, t, glow: Boolean(recipe) });
}

function drawCrate(ctx, station, x, y) {
  ctx.fillStyle = PALETTE.woodDark;
  roundRect(ctx, x - 28, y - 22, 56, 46, 6);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#5e3518';
  roundRect(ctx, x - 23, y - 17, 46, 30, 4);
  ctx.fill();
  const kind = station.ingredient;
  const heap = kind === 'rice' ? [[0, -1, 1.05]] : [[-11, 0, 0.78], [11, 0, 0.78], [0, -6, 0.82]];
  for (const [dx, dy, s] of heap) drawIngredient(ctx, kind, 'raw', x + dx, y + dy, s);
  ctx.fillStyle = PALETTE.wood;
  ctx.fillRect(x - 28, y + 13, 56, 9);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 28, y + 13, 56, 9);
}

function drawChoppingBoard(ctx, state, station, x, y) {
  ctx.fillStyle = '#e0a868';
  roundRect(ctx, x - 29, y - 22, 58, 44, 9);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.strokeStyle = '#c48a4c';
  ctx.lineWidth = 1.5;
  for (const dy of [-10, 0, 10]) {
    ctx.beginPath();
    ctx.moveTo(x - 22, y + dy);
    ctx.lineTo(x + 22, y + dy + 2);
    ctx.stroke();
  }
  const food = station.item;
  const chopping = state.cook.chopPose > 0 && stationInReach(state) === station;
  if (food) {
    const s = station.flash > 0 ? 1.18 : 1.05;
    drawIngredient(ctx, food.kind, food.state, x - 4, y + 1, s);
    const hits = INGREDIENTS[food.kind].chopHits;
    if (food.state === 'raw' && hits > 0) {
      for (let hit = 0; hit < hits; hit += 1) {
        ctx.fillStyle = hit < food.chops ? PALETTE.marigold : 'rgba(42,18,48,0.35)';
        ctx.beginPath();
        ctx.arc(x - (hits - 1) * 5 + hit * 10, y - 27, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }
  }
  // The cleaver rests on the right; mid-chop it is raised over the food.
  ctx.save();
  ctx.translate(x + 20, y - 4);
  ctx.rotate(chopping ? -1.1 : 0.15);
  ctx.fillStyle = '#d8dde6';
  roundRect(ctx, -4, -14, 13, 20, 3);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#3a2430';
  roundRect(ctx, -1, 6, 7, 14, 3);
  ctx.fill();
  ctx.restore();
}

function drawCookRing(ctx, x, y, r, food, times, t) {
  if (food.state === 'burnt') return;
  let share;
  let colour;
  if (food.state !== 'cooked') {
    share = Math.min(1, food.heat / times.done);
    colour = PALETTE.teal;
  } else if (times.burn === Infinity) {
    share = 1;
    colour = PALETTE.leaf;
  } else {
    share = 1 - Math.min(1, (food.heat - times.done) / (times.burn - times.done));
    colour = share > 0.45 ? PALETTE.leaf : share > 0.2 ? PALETTE.amber : PALETTE.red;
    if (share <= 0.2 && Math.floor(t * 8) % 2 === 0) colour = '#ffffff';
  }
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(42,18,48,0.55)';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = colour;
  ctx.lineWidth = 4.5;
  ctx.beginPath();
  ctx.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + share * Math.PI * 2);
  ctx.stroke();
  if (food.state === 'cooked') {
    ctx.fillStyle = share > 0.2 ? PALETTE.leaf : PALETTE.red;
    ctx.beginPath();
    ctx.arc(x + r * 0.72, y - r * 0.72, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    if (share > 0.2) {
      ctx.moveTo(x + r * 0.72 - 4, y - r * 0.72);
      ctx.lineTo(x + r * 0.72 - 1, y - r * 0.72 + 3);
      ctx.lineTo(x + r * 0.72 + 4, y - r * 0.72 - 3);
    } else {
      ctx.moveTo(x + r * 0.72, y - r * 0.72 - 4);
      ctx.lineTo(x + r * 0.72, y - r * 0.72 + 1);
    }
    ctx.stroke();
  }
}

function drawSkillet(ctx, station, x, y, t) {
  ctx.fillStyle = PALETTE.iron;
  roundRect(ctx, x - 30, y - 24, 60, 48, 8);
  ctx.fill();
  const food = station.item;
  if (food && food.state !== 'burnt') {
    const flicker = 0.75 + Math.sin(t * 23 + station.col) * 0.12;
    const flame = ctx.createRadialGradient(x, y, 8, x, y, 28);
    flame.addColorStop(0, `rgba(255,140,30,${flicker})`);
    flame.addColorStop(1, 'rgba(255,60,20,0)');
    ctx.fillStyle = flame;
    ctx.beginPath();
    ctx.arc(x, y, 28, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#5a5560';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#4a3a2a';
  roundRect(ctx, x + 14, y - 4, 22, 8, 4);
  ctx.fill();
  ctx.fillStyle = '#17141a';
  ctx.beginPath();
  ctx.arc(x - 2, y, 19, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#6a6470';
  ctx.lineWidth = 2.5;
  ctx.stroke();
  if (food) {
    drawIngredient(ctx, food.kind, food.state, x - 2, y, 0.95);
    drawCookRing(ctx, x - 2, y, 25, food, COOK_TIMES.skillet, t);
    if (food.state === 'raw' || food.state === 'chopped' || food.state === 'cooked') drawSizzle(ctx, x - 2, y, t);
  }
}

function drawSizzle(ctx, x, y, t) {
  ctx.fillStyle = 'rgba(255,240,200,0.9)';
  for (let spit = 0; spit < 4; spit += 1) {
    const phase = (t * 3 + spit * 0.27) % 1;
    const angle = spit * 1.7 + Math.floor(t * 3 + spit * 0.27) * 2.1;
    ctx.beginPath();
    ctx.arc(x + Math.cos(angle) * (12 + phase * 12), y + Math.sin(angle) * (10 + phase * 10) - phase * 6, 1.8 * (1 - phase) + 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRicePot(ctx, station, x, y, t) {
  ctx.fillStyle = PALETTE.iron;
  roundRect(ctx, x - 30, y - 24, 60, 48, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.tealDeep;
  roundRect(ctx, x - 29, y - 5, 10, 10, 3);
  ctx.fill();
  roundRect(ctx, x + 19, y - 5, 10, 10, 3);
  ctx.fill();
  ctx.fillStyle = PALETTE.teal;
  ctx.beginPath();
  ctx.arc(x, y, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#d9f2ee';
  ctx.beginPath();
  ctx.arc(x, y, 15, 0, Math.PI * 2);
  ctx.fill();
  const food = station.item;
  if (food) {
    if (food.state === 'cooked') drawIngredient(ctx, 'rice', 'cooked', x, y, 0.85);
    else {
      ctx.fillStyle = '#bfe3f0';
      ctx.beginPath();
      ctx.arc(x, y, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      for (let bubble = 0; bubble < 5; bubble += 1) {
        const phase = (t * 1.6 + bubble * 0.2) % 1;
        ctx.beginPath();
        ctx.arc(x + Math.cos(bubble * 2.4) * 8, y + Math.sin(bubble * 2.4) * 7, 1.5 + phase * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    drawCookRing(ctx, x, y, 27, food, COOK_TIMES.pot, t);
    drawWisps(ctx, x, y - 22, t);
  }
}

function drawWisps(ctx, x, y, t) {
  ctx.lineCap = 'round';
  ctx.lineWidth = 3;
  for (let wisp = 0; wisp < 2; wisp += 1) {
    const phase = (t * 0.8 + wisp * 0.5) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - phase)})`;
    const wx = x + (wisp ? 7 : -7);
    const wy = y - phase * 12;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.bezierCurveTo(wx - 5, wy - 5, wx + 5, wy - 9, wx, wy - 14);
    ctx.stroke();
  }
}

function drawPlatingBench(ctx, station, x, y) {
  ctx.fillStyle = '#f7f1ea';
  roundRect(ctx, x - 31, y - 25, 62, 50, 8);
  ctx.fill();
  ctx.strokeStyle = '#d9cdbf';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = '#e6dccf';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 26, y - 14);
  ctx.quadraticCurveTo(x - 6, y - 4, x + 4, y - 20);
  ctx.moveTo(x - 10, y + 20);
  ctx.quadraticCurveTo(x + 8, y + 6, x + 28, y + 12);
  ctx.stroke();
  if (station.plate) {
    drawPlateOnStation(ctx, station.plate, x + 2, y + 1, 28, 0);
    drawPlateProgress(ctx, station.plate, x + 24, y + 20);
  } else {
    ctx.strokeStyle = 'rgba(42,18,48,0.25)';
    ctx.setLineDash([5, 5]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = PALETTE.counterFront;
  ctx.beginPath();
  ctx.arc(x - 25, y - 19, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.marigold;
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(station.number), x - 25, y - 18);
}

/** A "2/3" badge on a half-built plate: parts placed out of the smallest dish it can still become. */
function drawPlateProgress(ctx, plate, x, y) {
  if (plate.items.length === 0 || matchRecipe(plate.items)) return;
  const fits = RECIPES.filter((recipe) => plateFitsRecipe(plate.items, recipe));
  if (fits.length === 0) return;
  const size = Math.min(...fits.map((recipe) => recipe.parts.length));
  ctx.fillStyle = PALETTE.teal;
  roundRect(ctx, x - 17, y - 10, 34, 20, 10);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${plate.items.length}/${size}`, x, y + 1);
}

function drawServeHatch(ctx, station, x, y, t) {
  const lamp = ctx.createRadialGradient(x, y - 4, 4, x, y - 4, 44);
  lamp.addColorStop(0, 'rgba(255,214,120,0.95)');
  lamp.addColorStop(1, 'rgba(255,180,60,0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(x - 36, y - 36, 72, 64);
  ctx.strokeStyle = '#b0402a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let chevron = 0; chevron < 3; chevron += 1) {
    const cy = y + 14 + chevron * 0;
    const cx = x - 12 + chevron * 12;
    ctx.moveTo(cx - 4, cy - 4);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx - 4, cy + 4);
  }
  ctx.stroke();
  if (!station.plate) return;
  const plate = station.plate;
  const recipe = matchRecipe(plate.items);
  drawPlateOnStation(ctx, plate, x, y - 3, 30, t);
  if (recipe) drawServePrompt(ctx, x, y - 56 + Math.sin(t * 5) * 3);
}

/** The bobbing "SPACE - SERVE" bubble over a finished plate on the hatch. */
function drawServePrompt(ctx, x, y) {
  ctx.fillStyle = PALETTE.ink;
  roundRect(ctx, x - 50, y - 15, 100, 30, 10);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(x - 7, y + 14);
  ctx.lineTo(x, y + 22);
  ctx.lineTo(x + 7, y + 14);
  ctx.fill();
  ctx.fillStyle = PALETTE.cream;
  roundRect(ctx, x - 44, y - 10, 44, 20, 5);
  ctx.fill();
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SPACE', x - 22, y + 1);
  ctx.fillStyle = PALETTE.marigold;
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillText('SERVE', x + 24, y + 1);
}

function drawScrapBin(ctx, x, y) {
  ctx.fillStyle = '#2f6b4f';
  ctx.beginPath();
  ctx.arc(x, y + 2, 21, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = '#1d4a35';
  ctx.beginPath();
  ctx.arc(x, y + 2, 14, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#86c9a4';
  ctx.beginPath();
  ctx.ellipse(x, y + 2, 6, 3.5, -0.6, 0, Math.PI * 2);
  ctx.fill();
}

function drawCounterDecor(ctx, station, x, y) {
  const pick = (station.col * 5 + station.row * 3) % 4;
  if (pick === 0) {
    ctx.fillStyle = '#b5532f';
    roundRect(ctx, x - 9, y, 18, 15, 3);
    ctx.fill();
    ctx.fillStyle = PALETTE.leaf;
    for (const [dx, dy] of [[-6, -4], [6, -4], [0, -10]]) {
      ctx.beginPath();
      ctx.ellipse(x + dx, y + dy, 6, 9, dx * 0.08, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (pick === 1) {
    const jars = [['#d9472b', -12], ['#e9b22b', 0], ['#5f9a3a', 12]];
    for (const [colour, dx] of jars) {
      ctx.fillStyle = colour;
      roundRect(ctx, x + dx - 5, y - 8, 10, 16, 3);
      ctx.fill();
      ctx.fillStyle = '#3a2430';
      ctx.fillRect(x + dx - 5, y - 10, 10, 4);
    }
  } else if (pick === 2) {
    ctx.fillStyle = '#c9d98a';
    roundRect(ctx, x - 6, y - 14, 12, 26, 5);
    ctx.fill();
    ctx.fillStyle = '#3a2430';
    ctx.fillRect(x - 2.5, y - 20, 5, 7);
  }
}

function drawReachHighlight(ctx, state, t) {
  const station = stationInReach(state);
  if (!station) return;
  const x = KITCHEN_GRID.x + station.col * T;
  const y = KITCHEN_GRID.y + station.row * T;
  ctx.strokeStyle = `rgba(255,178,30,${0.7 + Math.sin(t * 8) * 0.3})`;
  ctx.lineWidth = 3.5;
  roundRect(ctx, x + 3, y + 3, T - 6, T - 6, 9);
  ctx.stroke();
}

function drawCook(ctx, state, t) {
  const cook = state.cook;
  const moving = cook.route.length > 0;
  const bob = Math.sin(cook.walk * 16) * (moving ? 2 : 0.6);
  ctx.save();
  ctx.translate(cook.x, cook.y);
  ctx.scale(ART_SCALE, ART_SCALE);
  const x = 0;
  const y = bob;
  const face = cook.facing;
  ctx.fillStyle = 'rgba(40,10,30,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 20, 20, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  const holdX = x + face.x * 22;
  const holdY = y + 4 + face.y * 16;
  if (face.y < 0) drawHeld(ctx, cook.held, holdX, holdY - 6, t);
  // Body: chef's whites with a marigold apron band and a teal neckerchief.
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x, y + 4, 19, 17, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.fillStyle = PALETTE.marigold;
  ctx.fillRect(x - 17, y + 8, 34, 6);
  ctx.fillStyle = PALETTE.teal;
  ctx.beginPath();
  ctx.moveTo(x - 9, y - 9);
  ctx.lineTo(x + 9, y - 9);
  ctx.lineTo(x, y + 1);
  ctx.closePath();
  ctx.fill();
  // Arms reach toward what is held, or chop.
  const armReach = cook.chopPose > 0 ? -10 : 0;
  ctx.fillStyle = '#ffffff';
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(x + side * 17 + face.x * 8, y + 4 + face.y * 8 + (side === 1 ? armReach : 0), 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  // Head and toque.
  ctx.fillStyle = '#e9a878';
  ctx.beginPath();
  ctx.arc(x, y - 14, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  if (face.y >= 0) {
    ctx.fillStyle = PALETTE.ink;
    const ex = face.x * 4;
    ctx.beginPath();
    ctx.arc(x - 4 + ex, y - 13 + face.y * 2, 1.9, 0, Math.PI * 2);
    ctx.arc(x + 4 + ex, y - 13 + face.y * 2, 1.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#d8735a';
    ctx.beginPath();
    ctx.arc(x - 7 + ex, y - 9, 2.2, 0, Math.PI * 2);
    ctx.arc(x + 7 + ex, y - 9, 2.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x - 7, y - 30, 7, 0, Math.PI * 2);
  ctx.arc(x + 7, y - 30, 7, 0, Math.PI * 2);
  ctx.arc(x, y - 34, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 2.2;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x - 10, y - 28, 20, 6);
  ctx.strokeRect(x - 10, y - 28, 20, 6);
  if (face.y >= 0) drawHeld(ctx, cook.held, holdX, holdY, t);
  ctx.restore();
}

function drawHeld(ctx, held, x, y, t) {
  if (!held) return;
  if (held.type === 'plate') {
    const recipe = matchRecipe(held.items);
    drawPlatedDish(ctx, held.items, x, y, 20, { complete: Boolean(recipe), colour: recipe ? recipe.colour : undefined, t });
  } else drawIngredient(ctx, held.kind, held.state, x, y, 0.95);
}

function drawEffects(ctx, state) {
  for (const effect of state.effects) {
    const life = effect.t / effect.life;
    switch (effect.kind) {
      case 'dice':
        ctx.save();
        ctx.translate(effect.x, effect.y);
        ctx.rotate(effect.spin + effect.t * 12);
        ctx.fillStyle = effect.colour;
        ctx.fillRect(-4, -4, 8, 8);
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(-4, -4, 8, 8);
        ctx.restore();
        break;
      case 'slash':
        ctx.strokeStyle = `rgba(255,255,255,${1 - life})`;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(effect.x + 6, effect.y - 4, 24, -2.4, -0.6);
        ctx.stroke();
        break;
      case 'ring':
        ctx.strokeStyle = effect.colour;
        ctx.globalAlpha = 1 - life;
        ctx.lineWidth = 5 * (1 - life) + 1;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 22 + life * 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
        break;
      case 'spark':
        ctx.fillStyle = effect.colour;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 3.5 * (1 - life) + 1, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'smoke':
        ctx.fillStyle = effect.dark ? `rgba(40,30,40,${0.6 * (1 - life)})` : `rgba(230,225,230,${0.5 * (1 - life)})`;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, 6 + life * 14, 0, Math.PI * 2);
        ctx.fill();
        break;
      case 'streak':
        drawServeStreak(ctx, effect, life);
        break;
      case 'popup':
        drawPopup(ctx, effect, life);
        break;
      default:
        break;
    }
  }
}

/** A served plate whooshing along the hatch toward the dining deck, speed lines behind it. */
function drawServeStreak(ctx, effect, life) {
  const travel = (life * 0.35 + life * life * 0.65) * 300;
  const x = effect.x + travel;
  const y = effect.y - 4 - Math.sin(life * Math.PI) * 10;
  ctx.globalAlpha = 1 - life * 0.5;
  ctx.strokeStyle = effect.colour;
  ctx.lineCap = 'round';
  for (const [dy, width, length] of [[-14, 4, 0.7], [0, 7, 1], [14, 4, 0.7]]) {
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x - 30 - Math.min(travel, 120) * length, y + dy);
    ctx.lineTo(x - 26, y + dy);
    ctx.stroke();
  }
  drawPlatedDish(ctx, effect.items, x, y, 28, { complete: true, colour: effect.colour });
  ctx.globalAlpha = 1;
}

function drawPopup(ctx, effect, life) {
  const rise = Math.min(1, life * 2.4);
  const scale = life < 0.12 ? 0.6 + life * 4 : 1;
  ctx.save();
  ctx.translate(effect.x, effect.y - rise * 26);
  ctx.scale(scale, scale);
  ctx.globalAlpha = life > 0.75 ? (1 - life) * 4 : 1;
  ctx.font = `bold ${effect.size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = Math.max(4, effect.size * 0.22);
  ctx.strokeText(effect.text, 0, 0);
  ctx.fillStyle = effect.colour;
  ctx.fillText(effect.text, 0, 0);
  ctx.restore();
}

function drawRushBanner(ctx, state) {
  const banner = state.banner;
  if (!banner) return;
  const enter = Math.min(1, banner.t / 0.25);
  const leave = Math.max(0, (banner.t - 2.2) / 0.4);
  const cx = KITCHEN_GRID.x + (KITCHEN_GRID.cols * T) / 2 + (1 - enter) * -600 + leave * 700;
  const cy = KITCHEN_GRID.y + 4.1 * T;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.06);
  ctx.fillStyle = PALETTE.red;
  ctx.fillRect(-330, -34, 660, 68);
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 4;
  ctx.strokeRect(-330, -34, 660, 68);
  ctx.fillStyle = '#ffdf7a';
  ctx.fillRect(-330, -34, 660, 6);
  ctx.fillRect(-330, 28, 660, 6);
  ctx.font = `bold 44px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = PALETTE.ink;
  ctx.lineWidth = 8;
  ctx.strokeText(banner.text, -40, 2);
  ctx.fillStyle = PALETTE.marigold;
  ctx.fillText(banner.text, -40, 2);
  ctx.font = `bold 22px ${FONT}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(banner.sub, 230, 4);
  ctx.restore();
}

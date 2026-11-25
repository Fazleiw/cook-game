// The heads-up display around the kitchen: the big service clock, the order rail of tickets (each
// with its dish, its parts ticked off as plates fill, and a draining patience bar that turns
// amber then red and pulses), the score and combo, the cookbook, the keys, and the title, pause
// and end-of-shift cards.
import { FONT, PALETTE, SCORING, SERVICE } from './config.js';
import { RECIPE_BY_ID, RECIPES, matchRecipe, unlockedRecipes } from './recipes.js';
import { claimPlatesForTickets, shiftShare } from './orders.js';
import { drawIngredient, drawRecipeDish, roundRect } from './food.js';
import { partKey } from './ingredients.js';

const INK = PALETTE.ink;
const RAIL = { x: 280, y: 12, ticketW: 236, ticketH: 128, gap: 10 };
const SIDE = { x: 958, w: 310 };

/** The service clock: mm:ss left in the shift over a thinning bar, red and pulsing at the end. */
export function drawServiceTimer(ctx, state, t) {
  const left = Math.max(0, SERVICE.seconds - state.clock);
  const share = left / SERVICE.seconds;
  const urgent = left <= 30;
  const x = 16;
  const y = 12;
  const w = 252;
  const h = 128;
  panel(ctx, x, y, w, h, '#2a1431');
  ctx.fillStyle = PALETTE.marigold;
  ctx.font = `bold 13px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(`SERVICE CLOCK  ·  DAY ${state.day}`, x + 16, y + 20);
  drawStopwatch(ctx, x + 38, y + 64, urgent ? PALETTE.red : PALETTE.cream, share);
  const minutes = Math.floor(Math.ceil(left) / 60);
  const seconds = Math.ceil(left) % 60;
  const pulse = urgent ? 1 + Math.max(0, Math.sin(t * Math.PI * 2)) * 0.08 : 1;
  ctx.save();
  ctx.translate(x + 160, y + 66);
  ctx.scale(pulse, pulse);
  ctx.font = `bold 60px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = urgent ? PALETTE.red : PALETTE.cream;
  ctx.fillText(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`, 0, 2);
  ctx.restore();
  const barX = x + 16;
  const barY = y + 102;
  const barW = w - 32;
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  roundRect(ctx, barX, barY, barW, 14, 7);
  ctx.fill();
  ctx.fillStyle = share > 0.5 ? PALETTE.teal : share > 0.17 ? PALETTE.amber : PALETTE.red;
  roundRect(ctx, barX, barY, Math.max(14, barW * share), 14, 7);
  ctx.fill();
  ctx.fillStyle = 'rgba(42,18,48,0.6)';
  for (let tick = 1; tick < 6; tick += 1) ctx.fillRect(barX + (barW * tick) / 6 - 1, barY + 2, 2, 10);
}

/** The order rail: up to four tickets with dish, parts, checks and a patience bar each. */
export function drawOrderBoard(ctx, state, t) {
  ctx.fillStyle = PALETTE.brass;
  roundRect(ctx, RAIL.x - 4, RAIL.y - 4, 4 * (RAIL.ticketW + RAIL.gap) + 2, 7, 3);
  ctx.fill();
  const claims = claimPlatesForTickets(state);
  let slot = 0;
  for (const order of state.orders) {
    const x = RAIL.x + slot * (RAIL.ticketW + RAIL.gap);
    drawTicket(ctx, order, claims.get(order.id), x, RAIL.y + 4, t);
    if (order.status === 'open') slot += 1;
    else if (order.leave > 0.45) continue;
    else slot += 1;
    if (slot >= 4) break;
  }
  if (state.queue.length > 0) {
    const x = 1268 - 66;
    const y = RAIL.y + RAIL.ticketH - 18;
    ctx.fillStyle = PALETTE.red;
    roundRect(ctx, x, y, 66, 26, 13);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`+${state.queue.length} WAIT`, x + 33, y + 14);
  }
  if (state.orders.length === 0 && state.queue.length === 0) {
    ctx.fillStyle = 'rgba(255,240,210,0.55)';
    ctx.font = `bold 20px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('The rail is quiet... tickets incoming', RAIL.x + 20, RAIL.y + 64);
  }
}

function drawTicket(ctx, order, plate, x, y, t) {
  const recipe = RECIPE_BY_ID[order.recipeId];
  const w = RAIL.ticketW;
  const h = RAIL.ticketH - 8;
  const share = order.remaining / order.patience;
  const open = order.status === 'open';
  const late = open && share < 0.2;
  const arrive = Math.min(1, order.age / 0.3);
  ctx.save();
  let dy = (1 - arrive) * -40;
  if (!open) dy -= Math.max(0, order.leave - 0.35) * 160;
  ctx.globalAlpha = open ? arrive : Math.max(0, 1 - Math.max(0, order.leave - 0.35) * 2);
  ctx.translate(x + w / 2, y + dy);
  if (late) {
    const throb = 1 + Math.max(0, Math.sin(t * 12)) * 0.035;
    ctx.scale(throb, throb);
  }
  ctx.translate(-w / 2, 0);
  ctx.fillStyle = 'rgba(20,5,20,0.45)';
  roundRect(ctx, 3, 5, w, h, 10);
  ctx.fill();
  ctx.fillStyle = PALETTE.paper;
  roundRect(ctx, 0, 0, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = late ? PALETTE.red : INK;
  ctx.lineWidth = late ? 4 : 2.5;
  ctx.stroke();
  ctx.fillStyle = recipe.colour;
  roundRect(ctx, 0, 0, w, 30, 10);
  ctx.fill();
  ctx.fillRect(0, 18, w, 12);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, 30);
  ctx.lineTo(w, 30);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  roundRect(ctx, 7, 6, 30, 18, 6);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`#${String(order.id).padStart(2, '0')}`, 22, 15.5);
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText(recipe.name, 44, 16);
  drawRecipeDish(ctx, recipe, 42, 70, 30, t);
  const have = new Set((plate ? plate.items : []).map((item) => partKey(item.kind, item.state)));
  const spacing = recipe.parts.length > 3 ? 34 : 40;
  recipe.parts.forEach(([kind, partState], index) => {
    const px = 98 + index * spacing;
    const py = 58;
    ctx.fillStyle = have.has(partKey(kind, partState)) ? '#dff3d3' : '#f3e6cf';
    ctx.beginPath();
    ctx.arc(px, py, 16, 0, Math.PI * 2);
    ctx.fill();
    drawIngredient(ctx, kind, partState, px, py, 0.62);
    if (have.has(partKey(kind, partState))) drawCheck(ctx, px + 11, py + 11);
  });
  const secondsLeft = Math.ceil(order.remaining);
  const barColour = share > 0.5 ? PALETTE.teal : share > 0.2 ? PALETTE.amber : PALETTE.red;
  ctx.fillStyle = late ? PALETTE.red : INK;
  ctx.font = `bold 17px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText(`${secondsLeft}s`, w - 12, 90);
  const ready = open && plate !== undefined && matchRecipe(plate.items) === recipe;
  if (ready) {
    ctx.fillStyle = PALETTE.leaf;
    roundRect(ctx, 86, 80, 66, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('READY ✓', 119, 90.5);
  }
  ctx.fillStyle = 'rgba(42,18,48,0.18)';
  roundRect(ctx, 10, h - 16, w - 20, 9, 4.5);
  ctx.fill();
  ctx.fillStyle = barColour;
  roundRect(ctx, 10, h - 16, Math.max(9, (w - 20) * share), 9, 4.5);
  ctx.fill();
  if (order.status === 'served') stamp(ctx, w / 2, h / 2 + 8, 'SERVED', PALETTE.leafDark);
  if (order.status === 'missed') {
    ctx.fillStyle = 'rgba(60,40,60,0.55)';
    roundRect(ctx, 0, 0, w, h, 10);
    ctx.fill();
    stamp(ctx, w / 2, h / 2 + 8, 'MISSED', PALETTE.red);
  }
  ctx.restore();
}

/** Score, combo and the shift's tally. */
export function drawScoreCard(ctx, state, t) {
  const x = SIDE.x;
  const y = 152;
  const w = SIDE.w;
  const h = 112;
  panel(ctx, x, y, w, h, '#2a1431');
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `bold 13px ${FONT}`;
  ctx.fillText('SCORE', x + 18, y + 22);
  ctx.fillStyle = PALETTE.cream;
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText(state.score.toLocaleString('en-US'), x + 16, y + 60);
  const multiplier = Math.min(SCORING.comboMax, 1 + SCORING.comboStep * Math.max(0, state.combo - 1));
  const hot = state.combo >= 2;
  const cx = x + w - 150;
  ctx.fillStyle = hot ? PALETTE.teal : 'rgba(255,255,255,0.08)';
  roundRect(ctx, cx, y + 14, 134, 56, 12);
  ctx.fill();
  if (hot) {
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    drawFlame(ctx, cx + 22, y + 44, 1 + Math.sin(t * 10) * 0.08);
  }
  ctx.fillStyle = hot ? '#ffffff' : PALETTE.muted;
  ctx.font = `bold 12px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText('COMBO', cx + 82, y + 28);
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillText(`x${multiplier.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')}`, cx + 82, y + 52);
  ctx.textAlign = 'left';
  ctx.font = `bold 14px ${FONT}`;
  ctx.fillStyle = '#9be38a';
  ctx.fillText(`✓ ${state.served} served`, x + 16, y + 94);
  ctx.fillStyle = '#ff8a80';
  ctx.fillText(`✗ ${state.missed} missed`, x + 114, y + 94);
  ctx.fillStyle = PALETTE.marigold;
  ctx.fillText(`★ best ${state.bestCombo}`, x + 216, y + 94);
}

/** Six recipes, one pantry: each dish with the prepared parts that build it. */
export function drawRecipeBook(ctx, state, t) {
  const x = SIDE.x;
  const y = 274;
  const w = SIDE.w;
  const h = 382;
  panel(ctx, x, y, w, h, PALETTE.paper, INK);
  ctx.fillStyle = PALETTE.counterFront;
  roundRect(ctx, x, y, w, 34, 12);
  ctx.fill();
  ctx.fillRect(x, y + 20, w, 14);
  ctx.fillStyle = PALETTE.marigold;
  ctx.font = `bold 15px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('COOKBOOK', x + 16, y + 18);
  ctx.fillStyle = PALETTE.counterFrontText;
  ctx.font = `bold 11px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('one pantry · six plates', x + w - 14, y + 18);
  const open = new Set(unlockedRecipes(shiftShare(state), state.day).map((recipe) => recipe.id));
  const onRail = new Set(state.orders.filter((order) => order.status === 'open').map((order) => order.recipeId));
  RECIPES.forEach((recipe, index) => {
    const ry = y + 44 + index * 56;
    const unlocked = open.has(recipe.id);
    if (onRail.has(recipe.id)) {
      ctx.fillStyle = 'rgba(255,178,30,0.22)';
      roundRect(ctx, x + 6, ry - 2, w - 12, 52, 8);
      ctx.fill();
    }
    ctx.globalAlpha = unlocked ? 1 : 0.38;
    drawRecipeDish(ctx, recipe, x + 32, ry + 24, 21, t);
    ctx.fillStyle = INK;
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(recipe.name, x + 62, ry + 11);
    recipe.parts.forEach(([kind, partState], part) => {
      const px = x + 74 + part * 32;
      const py = ry + 34;
      drawIngredient(ctx, kind, partState, px, py, 0.52);
      if (partState !== 'raw') drawProcessGlyph(ctx, px + 10, py + 8, partState === 'cooked' && kind !== 'rice' ? 'flame' : kind === 'rice' ? 'pot' : 'knife', kind);
    });
    ctx.globalAlpha = 1;
    if (!unlocked) {
      ctx.fillStyle = PALETTE.counterFront;
      ctx.font = `bold 11px ${FONT}`;
      ctx.textAlign = 'right';
      const at = Math.max(0, recipe.unlockAt - Math.min(0.5, (state.day - 1) * 0.2));
      const clockAt = SERVICE.seconds * (1 - at);
      ctx.fillText(`🔒 opens ${Math.floor(clockAt / 60)}:${String(Math.round(clockAt % 60)).padStart(2, '0')}`, x + w - 12, ry + 34);
    }
  });
}

/** The control strip along the bottom: restaurant name, then every key as a keycap. */
export function drawKeyHints(ctx) {
  const y = 668;
  panel(ctx, 16, y, 1252, 44, '#2a1431');
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  ctx.fillStyle = PALETTE.marigold;
  ctx.font = `bold 19px ${FONT}`;
  ctx.fillText('✿ MARIGOLD GALLEY', 30, y + 23);
  let x = 250;
  const groups = [
    [['W', 'A', 'S', 'D'], 'move'],
    [['E'], 'use · hold to chop'],
    [['1', '2', '3'], 'go to plate'],
    [['SPACE'], 'serve hatch'],
    [['CLICK'], 'walk & use'],
    [['P'], 'pause'],
  ];
  for (const [keys, label] of groups) {
    for (const key of keys) x = keycap(ctx, key, x, y + 10) + 4;
    ctx.fillStyle = PALETTE.cream;
    ctx.font = `bold 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 2, y + 23);
    x += ctx.measureText(label).width + 22;
  }
}

export function drawTitleCard(ctx, view, t) {
  dim(ctx);
  const x = 250;
  const y = 170;
  const w = 780;
  const h = 400;
  panel(ctx, x, y, w, h, PALETTE.paper, INK);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.counterFront;
  ctx.font = `bold 64px ${FONT}`;
  ctx.fillText('Marigold Galley', x + w / 2, y + 70);
  ctx.fillStyle = PALETTE.marigoldDeep;
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText('a riverboat kitchen · one cook · one dinner service', x + w / 2, y + 116);
  RECIPES.forEach((recipe, index) => drawRecipeDish(ctx, recipe, x + 115 + index * 110, y + 180, 34, t));
  ctx.fillStyle = INK;
  ctx.font = `bold 17px ${FONT}`;
  const lines = [
    'Tickets hang on the rail. Fetch from the crates, chop, sear, steam,',
    'build each plate on a bench, set it under the hatch lamp, ring it out with SPACE.',
    'Fast plates earn tips; serve in a row for a combo. Rushes come at the bell.',
  ];
  lines.forEach((line, index) => ctx.fillText(line, x + w / 2, y + 252 + index * 28));
  const blink = Math.sin(t * 5) > -0.3;
  ctx.fillStyle = blink ? PALETTE.red : PALETTE.counterFront;
  ctx.font = `bold 24px ${FONT}`;
  ctx.fillText('Press ENTER or click to open the hatch', x + w / 2, y + 352);
  if (view.best) {
    ctx.fillStyle = PALETTE.muted;
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillText(`Best shift: ${view.best}`, x + w / 2, y + 382);
  }
}

export function drawPauseCard(ctx) {
  dim(ctx);
  panel(ctx, 440, 300, 400, 140, PALETTE.paper, INK);
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText('Paused', 640, 352);
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText('P or ENTER to get back on the line', 640, 400);
}

/** End of shift: stars, the tally, every dish served, and the next day's button. */
export function drawResultCard(ctx, state, view, t) {
  dim(ctx);
  const x = 200;
  const y = 120;
  const w = 880;
  const h = 520;
  panel(ctx, x, y, w, h, PALETTE.paper, INK);
  ctx.fillStyle = PALETTE.counterFront;
  roundRect(ctx, x, y, w, 70, 12);
  ctx.fill();
  ctx.fillRect(x, y + 50, w, 20);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.marigold;
  ctx.font = `bold 36px ${FONT}`;
  ctx.fillText(`Day ${state.day} · Shift Over`, x + w / 2, y + 37);
  const stars = SCORING.stars.filter((needed) => state.score >= needed).length;
  for (let star = 0; star < 3; star += 1) drawStar(ctx, x + w / 2 - 90 + star * 90, y + 128, star === 1 ? 40 : 32, star < stars, t + star * 0.2);
  ctx.fillStyle = INK;
  ctx.font = `bold 20px ${FONT}`;
  ctx.fillText(['The river was quiet tonight.', 'A tidy service. The crew nods.', 'The deck is buzzing about you!', 'Legend of the river! Plates still talked about downstream.'][stars], x + w / 2, y + 186);
  const rows = [
    ['Dishes served', String(state.served), PALETTE.leafDark],
    ['Tickets missed', String(state.missed), PALETTE.red],
    ['Best combo run', `${state.bestCombo} in a row`, PALETTE.tealDeep],
    ['Tips earned', `${state.tips}`, PALETTE.marigoldDeep],
  ];
  rows.forEach(([label, value, colour], index) => {
    const ry = y + 232 + index * 38;
    ctx.fillStyle = index % 2 ? 'rgba(42,18,48,0.04)' : 'rgba(42,18,48,0.08)';
    roundRect(ctx, x + 40, ry - 16, 380, 32, 8);
    ctx.fill();
    ctx.textAlign = 'left';
    ctx.fillStyle = INK;
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillText(label, x + 56, ry);
    ctx.textAlign = 'right';
    ctx.fillStyle = colour;
    ctx.fillText(value, x + 404, ry);
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = INK;
  ctx.font = `bold 16px ${FONT}`;
  ctx.fillText('PLATES OUT OF THE HATCH', x + 470, y + 220);
  let index = 0;
  for (const recipe of RECIPES) {
    const count = state.dishLog[recipe.id] ?? 0;
    const col = index % 3;
    const row = Math.floor(index / 3);
    const px = x + 510 + col * 120;
    const py = y + 272 + row * 92;
    ctx.globalAlpha = count ? 1 : 0.3;
    drawRecipeDish(ctx, recipe, px, py, 30, t);
    ctx.globalAlpha = 1;
    ctx.fillStyle = count ? recipe.colour : PALETTE.muted;
    ctx.font = `bold 20px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(`×${count}`, px + 34, py + 16);
    index += 1;
  }
  ctx.fillStyle = PALETTE.counterFront;
  roundRect(ctx, x + 40, y + 410, 380, 80, 14);
  ctx.fill();
  ctx.fillStyle = PALETTE.muted;
  ctx.font = `bold 14px ${FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('SHIFT SCORE', x + 60, y + 432);
  ctx.fillStyle = PALETTE.marigold;
  ctx.font = `bold 44px ${FONT}`;
  ctx.fillText(state.score.toLocaleString('en-US'), x + 58, y + 468);
  if (view.best) {
    ctx.fillStyle = PALETTE.counterFrontText;
    ctx.font = `bold 14px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(state.score >= view.best ? 'NEW BEST!' : `best ${view.best}`, x + 404, y + 432);
  }
  ctx.fillStyle = PALETTE.teal;
  roundRect(ctx, x + 470, y + 420, 370, 60, 14);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold 22px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.fillText(`ENTER ▸ Day ${state.day + 1}: faster tickets`, x + 655, y + 451);
}

function panel(ctx, x, y, w, h, fill, stroke = '#4b2547') {
  ctx.fillStyle = 'rgba(10,0,10,0.35)';
  roundRect(ctx, x + 3, y + 4, w, h, 12);
  ctx.fill();
  ctx.fillStyle = fill;
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2.5;
  ctx.stroke();
}

function dim(ctx) {
  ctx.fillStyle = 'rgba(20,5,25,0.62)';
  ctx.fillRect(0, 0, 1280, 720);
}

function keycap(ctx, label, x, y) {
  ctx.font = `bold 12px ${FONT}`;
  const w = Math.max(24, ctx.measureText(label).width + 14);
  ctx.fillStyle = '#120712';
  roundRect(ctx, x, y + 3, w, 24, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.cream;
  roundRect(ctx, x, y, w, 24, 6);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x + w / 2, y + 12.5);
  return x + w;
}

function stamp(ctx, x, y, text, colour) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.18);
  ctx.strokeStyle = colour;
  ctx.lineWidth = 4;
  roundRect(ctx, -78, -22, 156, 44, 8);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.font = `bold 30px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 0, 2);
  ctx.restore();
}

function drawCheck(ctx, x, y) {
  ctx.fillStyle = PALETTE.leaf;
  ctx.beginPath();
  ctx.arc(x, y, 7.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(x - 3.5, y);
  ctx.lineTo(x - 1, y + 3);
  ctx.lineTo(x + 4, y - 3);
  ctx.stroke();
}

function drawProcessGlyph(ctx, x, y, glyph) {
  ctx.fillStyle = glyph === 'flame' ? PALETTE.red : glyph === 'pot' ? PALETTE.teal : PALETTE.ink;
  ctx.beginPath();
  ctx.arc(x, y, 6.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.6;
  if (glyph === 'flame') {
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.quadraticCurveTo(x + 4, y, x, y + 4);
    ctx.quadraticCurveTo(x - 4, y, x, y - 4);
    ctx.fill();
  } else if (glyph === 'pot') {
    ctx.fillRect(x - 3.5, y - 1, 7, 4);
    ctx.fillRect(x - 4.5, y - 2.5, 9, 1.5);
  } else {
    ctx.beginPath();
    ctx.moveTo(x - 3.5, y + 3.5);
    ctx.lineTo(x + 3.5, y - 3.5);
    ctx.stroke();
  }
}

function drawStopwatch(ctx, x, y, colour, share) {
  ctx.fillStyle = colour;
  ctx.fillRect(x - 4, y - 28, 8, 6);
  ctx.beginPath();
  ctx.arc(x, y, 22, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1431';
  ctx.beginPath();
  ctx.arc(x, y, 17, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.arc(x, y, 14, -Math.PI / 2, -Math.PI / 2 + share * Math.PI * 2);
  ctx.closePath();
  ctx.fill();
}

function drawFlame(ctx, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = PALETTE.marigold;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.quadraticCurveTo(14, -2, 9, 8);
  ctx.quadraticCurveTo(0, 16, -9, 8);
  ctx.quadraticCurveTo(-13, -2, 0, -18);
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = '#fff1b0';
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.quadraticCurveTo(6, 2, 4, 7);
  ctx.quadraticCurveTo(0, 10, -4, 7);
  ctx.quadraticCurveTo(-6, 2, 0, -6);
  ctx.fill();
  ctx.restore();
}

function drawStar(ctx, x, y, r, filled, t) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(t * 2) * 0.06);
  ctx.beginPath();
  for (let point = 0; point < 10; point += 1) {
    const radius = point % 2 ? r * 0.45 : r;
    const angle = -Math.PI / 2 + (point * Math.PI) / 5;
    if (point === 0) ctx.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
    else ctx.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? PALETTE.marigold : '#e6d9c6';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();
}

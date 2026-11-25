// Food art, drawn in code: every ingredient in every state (a whole tomato, its dice, a fried egg,
// a seared fillet) as a bold-outlined sticker that still reads at a third of its size, and the
// plated dish, built up in layers (base, main, toppings) so a half-built plate looks half-built
// and a finished one gets its garnish, sauce dots and steam.
import { PALETTE } from './config.js';

const INK = PALETTE.ink;

/** A plate with these parts at (x, y), radius r. Finished plates get garnish and steam. */
export function drawPlatedDish(ctx, items, x, y, r, options = {}) {
  const { complete = false, colour = PALETTE.marigold, t = 0, glow = false } = options;
  ctx.save();
  ctx.translate(x, y);
  if (glow) {
    const halo = ctx.createRadialGradient(0, 0, r * 0.6, 0, 0, r * 1.6);
    halo.addColorStop(0, 'rgba(255,190,60,0.55)');
    halo.addColorStop(1, 'rgba(255,190,60,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(40,10,40,0.28)';
  ctx.beginPath();
  ctx.ellipse(0, r * 0.18, r * 1.02, r * 0.95, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fffdf8';
  ctx.strokeStyle = INK;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = '#ffc95c';
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
  ctx.stroke();
  // The galley's own crockery: a pale river-teal glaze in the well, so white rice and egg still pop.
  ctx.fillStyle = '#cfe8e4';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.76, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.32, -r * 0.4, r * 0.22, r * 0.09, -0.7, 0, Math.PI * 2);
  ctx.fill();

  const s = r / 30;
  const kinds = new Set(items.map((item) => `${item.kind}:${item.state}`));
  const hasBase = kinds.has('flatbread:raw') || kinds.has('rice:cooked');
  if (complete) drawSauceDots(ctx, s, colour);
  if (kinds.has('flatbread:raw')) drawFlatbreadBase(ctx, s);
  if (kinds.has('rice:cooked')) drawRiceMound(ctx, 0, 2 * s, s * 1.15);
  if (kinds.has('greens:chopped') && !hasBase) drawLeafBed(ctx, s);
  if (kinds.has('fish:cooked')) drawSearedFillet(ctx, hasBase ? -2 * s : 0, -1 * s, s * 1.05, -0.35);
  if (kinds.has('egg:cooked')) drawFriedEgg(ctx, kinds.has('onion:cooked') ? -5 * s : 3 * s, kinds.has('rice:cooked') ? -5 * s : -2 * s, s * 1.0);
  if (kinds.has('onion:cooked')) drawJammyOnion(ctx, 9 * s, 7 * s, s * 0.9);
  if (kinds.has('greens:chopped') && hasBase) drawGreenShreds(ctx, -11 * s, 8 * s, s * 0.9);
  if (kinds.has('tomato:chopped')) drawTomatoDice(ctx, kinds.has('fish:cooked') ? 11 * s : -9 * s, kinds.has('fish:cooked') ? 9 * s : -7 * s, s * 0.85, hasBase || kinds.has('greens:chopped'));
  if (kinds.has('cheese:chopped')) drawGratedCheese(ctx, 6 * s, -9 * s, s * 0.95);
  if (kinds.has('onion:chopped')) drawOnionRings(ctx, kinds.has('greens:chopped') ? 9 * s : 10 * s, kinds.has('greens:chopped') ? 8 * s : 6 * s, s * 0.8);
  if (complete) {
    drawHerbSprig(ctx, 15 * s, -16 * s, s);
    drawSteam(ctx, 0, -r * 0.9, s, t);
  }
  ctx.restore();
}

/** The finished dish for a recipe (tickets, the cookbook, the results card). */
export function drawRecipeDish(ctx, recipe, x, y, r, t = 0) {
  const items = recipe.parts.map(([kind, state]) => ({ kind, state }));
  drawPlatedDish(ctx, items, x, y, r, { complete: true, colour: recipe.colour, t });
}

/** One loose ingredient (in a crate, on a board, in a pan, in the cook's hands). s = 1 is ~16px. */
export function drawIngredient(ctx, kind, state, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const key = `${kind}:${state}`;
  switch (key) {
    case 'tomato:raw':
      drawWholeTomato(ctx, s);
      break;
    case 'tomato:chopped':
      drawTomatoDice(ctx, 0, 0, s, false);
      break;
    case 'onion:raw':
      drawWholeOnion(ctx, s);
      break;
    case 'onion:chopped':
      drawOnionRings(ctx, 0, 0, s);
      break;
    case 'onion:cooked':
      drawJammyOnion(ctx, 0, 0, s);
      break;
    case 'greens:raw':
      drawLettuceHead(ctx, s);
      break;
    case 'greens:chopped':
      drawGreenShreds(ctx, 0, 0, s);
      break;
    case 'cheese:raw':
      drawCheeseWedge(ctx, s);
      break;
    case 'cheese:chopped':
      drawGratedCheese(ctx, 0, 0, s);
      break;
    case 'egg:raw':
      drawWholeEgg(ctx, s);
      break;
    case 'egg:cooked':
      drawFriedEgg(ctx, 0, 0, s);
      break;
    case 'fish:raw':
      drawWholeFish(ctx, s);
      break;
    case 'fish:chopped':
      drawRawFillet(ctx, s);
      break;
    case 'fish:cooked':
      drawSearedFillet(ctx, 0, 0, s, -0.3);
      break;
    case 'flatbread:raw':
      drawFlatbreadLoose(ctx, s);
      break;
    case 'rice:raw':
      drawRiceSack(ctx, s);
      break;
    case 'rice:cooked':
      drawRiceMound(ctx, 0, 0, s);
      break;
    default:
      drawBurntLump(ctx, s);
  }
  ctx.restore();
}

function outline(ctx, width = 2) {
  ctx.strokeStyle = INK;
  ctx.lineWidth = width;
  ctx.stroke();
}

function drawWholeTomato(ctx, s) {
  ctx.fillStyle = '#e63a2e';
  ctx.beginPath();
  ctx.ellipse(0, 1 * s, 14 * s, 12.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 2.2 * Math.min(1.2, s));
  ctx.fillStyle = '#ff8a6b';
  ctx.beginPath();
  ctx.ellipse(-6 * s, -3 * s, 4 * s, 2.6 * s, -0.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3f9e32';
  for (let leaf = 0; leaf < 5; leaf += 1) {
    const angle = (leaf / 5) * Math.PI * 2 - Math.PI / 2;
    ctx.beginPath();
    ctx.ellipse(Math.cos(angle) * 4 * s, -10 * s + Math.sin(angle) * 2.2 * s, 4.2 * s, 1.8 * s, angle, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#2e6b25';
  ctx.lineWidth = 2.4 * s;
  ctx.beginPath();
  ctx.moveTo(0, -10 * s);
  ctx.lineTo(1.5 * s, -14 * s);
  ctx.stroke();
}

function drawTomatoDice(ctx, x, y, s, flat) {
  const spots = flat ? [[-6, 1], [4, 4], [-1, -6], [8, -4], [-8, -7]] : [[-7, 3], [5, 4], [-1, -6], [8, -5]];
  for (const [dx, dy] of spots) {
    const cx = x + dx * s;
    const cy = y + dy * s;
    const size = 8.5 * s;
    ctx.fillStyle = '#d42e24';
    roundRect(ctx, cx - size / 2, cy - size / 2, size, size, 2 * s);
    ctx.fill();
    outline(ctx, 1.6 * Math.min(1.2, s));
    ctx.fillStyle = '#ff6d55';
    roundRect(ctx, cx - size / 2 + 1.5 * s, cy - size / 2 + 1.5 * s, size * 0.55, size * 0.45, 1.2 * s);
    ctx.fill();
    ctx.fillStyle = '#ffd96a';
    ctx.beginPath();
    ctx.arc(cx + 1.5 * s, cy + 1.5 * s, 1.2 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWholeOnion(ctx, s) {
  ctx.fillStyle = '#9b3f86';
  ctx.beginPath();
  ctx.moveTo(0, -16 * s);
  ctx.quadraticCurveTo(4 * s, -9 * s, 12 * s, -3 * s);
  ctx.arc(0, 2 * s, 12.5 * s, -0.5, Math.PI + 0.5);
  ctx.quadraticCurveTo(-4 * s, -9 * s, 0, -16 * s);
  ctx.fill();
  outline(ctx, 2.2 * Math.min(1.2, s));
  ctx.strokeStyle = '#c977b4';
  ctx.lineWidth = 1.8 * s;
  for (const dx of [-5, 0, 5]) {
    ctx.beginPath();
    ctx.moveTo(dx * 0.4 * s, -11 * s);
    ctx.quadraticCurveTo(dx * 1.8 * s, 0, dx * 0.8 * s, 12 * s);
    ctx.stroke();
  }
  ctx.strokeStyle = '#e7d1a4';
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(-3 * s, 14 * s);
  ctx.lineTo(-4 * s, 17 * s);
  ctx.moveTo(0, 14.5 * s);
  ctx.lineTo(0, 18 * s);
  ctx.moveTo(3 * s, 14 * s);
  ctx.lineTo(4 * s, 17 * s);
  ctx.stroke();
}

function drawOnionRings(ctx, x, y, s) {
  const rings = [[-5, -3, 7], [5, 1, 6.5], [-1, 6, 5.5]];
  for (const [dx, dy, size] of rings) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s, size * s, size * 0.8 * s, 0.3, 0, Math.PI * 2);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5.4 * s;
    ctx.stroke();
    ctx.strokeStyle = '#f0c4e6';
    ctx.lineWidth = 3 * s;
    ctx.stroke();
    ctx.strokeStyle = '#a84f93';
    ctx.lineWidth = 1 * s;
    ctx.stroke();
  }
}

function drawJammyOnion(ctx, x, y, s) {
  ctx.lineCap = 'round';
  const curls = [[-7, -3, 0.2], [0, 2, 1.4], [6, -4, 2.5], [-3, 6, 3.6], [5, 6, 4.4]];
  for (const [dx, dy, a] of curls) {
    ctx.beginPath();
    ctx.arc(x + dx * s, y + dy * s, 5 * s, a, a + 3.6);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 5 * s;
    ctx.stroke();
    ctx.strokeStyle = '#a3521c';
    ctx.lineWidth = 3 * s;
    ctx.stroke();
    ctx.strokeStyle = '#e39a45';
    ctx.lineWidth = 1.1 * s;
    ctx.stroke();
  }
}

function drawLettuceHead(ctx, s) {
  const lobes = [[-7, 2, 9, '#3e9a35'], [7, 2, 9, '#3e9a35'], [0, 5, 10, '#4caf3d'], [-4, -5, 8, '#5cc24a'], [5, -5, 8, '#5cc24a'], [0, -1, 7, '#7bd65f']];
  for (const [dx, dy, r, fill] of lobes) {
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(dx * s, dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 1.8 * Math.min(1.2, s));
  }
  ctx.strokeStyle = '#c9f0a8';
  ctx.lineWidth = 1.6 * s;
  ctx.beginPath();
  ctx.moveTo(0, 9 * s);
  ctx.lineTo(0, -4 * s);
  ctx.moveTo(0, 2 * s);
  ctx.lineTo(-5 * s, -2 * s);
  ctx.moveTo(0, 2 * s);
  ctx.lineTo(5 * s, -2 * s);
  ctx.stroke();
}

function drawGreenShreds(ctx, x, y, s) {
  const shreds = [[-8, -4, 0.4, '#4caf3d'], [-2, -7, -0.3, '#6fcf55'], [5, -5, 0.8, '#3e9a35'], [-6, 3, -0.6, '#6fcf55'], [2, 1, 0.2, '#4caf3d'], [8, 3, -0.9, '#5cc24a'], [-1, 7, 0.9, '#3e9a35']];
  ctx.lineCap = 'round';
  for (const [dx, dy, a, fill] of shreds) {
    ctx.save();
    ctx.translate(x + dx * s, y + dy * s);
    ctx.rotate(a);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 6 * s;
    ctx.beginPath();
    ctx.moveTo(-5 * s, 0);
    ctx.quadraticCurveTo(0, -2.5 * s, 5 * s, 0);
    ctx.stroke();
    ctx.strokeStyle = fill;
    ctx.lineWidth = 3.6 * s;
    ctx.stroke();
    ctx.restore();
  }
}

function drawLeafBed(ctx, s) {
  for (let leaf = 0; leaf < 7; leaf += 1) {
    const angle = (leaf / 7) * Math.PI * 2;
    ctx.save();
    ctx.rotate(angle);
    ctx.fillStyle = leaf % 2 ? '#4caf3d' : '#6fcf55';
    ctx.beginPath();
    ctx.ellipse(10 * s, 0, 11 * s, 7 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    outline(ctx, 1.8 * s);
    ctx.strokeStyle = '#c9f0a8';
    ctx.lineWidth = 1.3 * s;
    ctx.beginPath();
    ctx.moveTo(2 * s, 0);
    ctx.lineTo(18 * s, 0);
    ctx.stroke();
    ctx.restore();
  }
}

function drawCheeseWedge(ctx, s) {
  ctx.fillStyle = '#e8a90f';
  ctx.beginPath();
  ctx.moveTo(-14 * s, 9 * s);
  ctx.lineTo(14 * s, 9 * s);
  ctx.lineTo(14 * s, 2 * s);
  ctx.lineTo(-14 * s, 2 * s);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 2 * Math.min(1.2, s));
  ctx.fillStyle = '#ffcb2e';
  ctx.beginPath();
  ctx.moveTo(-14 * s, 2 * s);
  ctx.lineTo(14 * s, 2 * s);
  ctx.lineTo(8 * s, -11 * s);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 2 * Math.min(1.2, s));
  ctx.fillStyle = '#e8a90f';
  for (const [dx, dy, r] of [[2, -3, 2.4], [7, -6, 1.6], [-5, 0, 1.6], [-4, 6, 1.8], [8, 6, 1.5]]) {
    ctx.beginPath();
    ctx.arc(dx * s, dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawGratedCheese(ctx, x, y, s) {
  ctx.lineCap = 'round';
  const sticks = [[-6, -2, 0.5], [-1, -5, -0.4], [4, -2, 1.1], [-4, 4, -0.9], [2, 3, 0.2], [7, 4, -0.5], [0, -1, 1.5], [-8, 2, 1.9]];
  for (const [dx, dy, a] of sticks) {
    const cx = x + dx * s;
    const cy = y + dy * s;
    ctx.beginPath();
    ctx.moveTo(cx - Math.cos(a) * 4 * s, cy - Math.sin(a) * 4 * s);
    ctx.lineTo(cx + Math.cos(a) * 4 * s, cy + Math.sin(a) * 4 * s);
    ctx.strokeStyle = '#b77d00';
    ctx.lineWidth = 4.2 * s;
    ctx.stroke();
    ctx.strokeStyle = '#ffd23f';
    ctx.lineWidth = 2.4 * s;
    ctx.stroke();
  }
}

function drawWholeEgg(ctx, s) {
  ctx.fillStyle = '#fff3d6';
  ctx.beginPath();
  ctx.ellipse(0, 1 * s, 10.5 * s, 13.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 2.2 * Math.min(1.2, s));
  ctx.fillStyle = '#d9b98a';
  for (const [dx, dy] of [[-3, -4], [4, 2], [-1, 6], [3, -8]]) {
    ctx.beginPath();
    ctx.arc(dx * s, dy * s, 1 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.ellipse(-4 * s, -5 * s, 2.5 * s, 4 * s, 0.3, 0, Math.PI * 2);
  ctx.fill();
}

function drawFriedEgg(ctx, x, y, s) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  const points = 9;
  for (let index = 0; index <= points; index += 1) {
    const angle = (index / points) * Math.PI * 2;
    const radius = (12 + (index % 2 ? 2.5 : -1)) * s;
    const px = x + Math.cos(angle) * radius;
    const py = y + Math.sin(angle) * radius * 0.85;
    if (index === 0) ctx.moveTo(px, py);
    else ctx.quadraticCurveTo(x + Math.cos(angle - 0.35) * radius * 1.12, y + Math.sin(angle - 0.35) * radius * 0.95, px, py);
  }
  ctx.closePath();
  ctx.fill();
  outline(ctx, 2 * Math.min(1.2, s));
  ctx.fillStyle = '#ffa800';
  ctx.beginPath();
  ctx.arc(x + 1 * s, y - 1 * s, 5.5 * s, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 1.6 * Math.min(1.2, s));
  ctx.fillStyle = '#ffe08a';
  ctx.beginPath();
  ctx.arc(x - 1 * s, y - 3 * s, 1.8 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawWholeFish(ctx, s) {
  ctx.fillStyle = '#6fa7c9';
  ctx.beginPath();
  ctx.moveTo(10 * s, 0);
  ctx.lineTo(18 * s, -8 * s);
  ctx.lineTo(18 * s, 8 * s);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 2 * Math.min(1.2, s));
  ctx.beginPath();
  ctx.ellipse(-2 * s, 0, 14 * s, 8.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 2.2 * Math.min(1.2, s));
  ctx.fillStyle = '#d6ecf5';
  ctx.beginPath();
  ctx.ellipse(-3 * s, 3.5 * s, 10 * s, 3.5 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#3f7898';
  ctx.lineWidth = 1.5 * s;
  for (const dx of [0, 4, 8]) {
    ctx.beginPath();
    ctx.arc(dx * s - 4 * s, 0, 5 * s, -0.9, 0.9);
    ctx.stroke();
  }
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.arc(-10 * s, -2 * s, 1.8 * s, 0, Math.PI * 2);
  ctx.fill();
}

function drawRawFillet(ctx, s) {
  ctx.fillStyle = '#f59a8b';
  roundRect(ctx, -14 * s, -8 * s, 28 * s, 16 * s, 7 * s);
  ctx.fill();
  outline(ctx, 2 * Math.min(1.2, s));
  ctx.strokeStyle = '#ffe2d8';
  ctx.lineWidth = 2 * s;
  for (const dx of [-7, 0, 7]) {
    ctx.beginPath();
    ctx.moveTo((dx - 3) * s, -6 * s);
    ctx.quadraticCurveTo((dx + 2) * s, 0, (dx - 3) * s, 6 * s);
    ctx.stroke();
  }
}

function drawSearedFillet(ctx, x, y, s, angle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = '#d98a35';
  roundRect(ctx, -15 * s, -8.5 * s, 30 * s, 17 * s, 7.5 * s);
  ctx.fill();
  outline(ctx, 2 * Math.min(1.2, s));
  ctx.fillStyle = '#f2b765';
  roundRect(ctx, -12 * s, -6 * s, 22 * s, 6 * s, 3 * s);
  ctx.fill();
  ctx.strokeStyle = '#6b2e0e';
  ctx.lineWidth = 2.4 * s;
  for (const dx of [-8, -1, 6]) {
    ctx.beginPath();
    ctx.moveTo((dx - 3) * s, -6 * s);
    ctx.lineTo((dx + 3) * s, 6 * s);
    ctx.stroke();
  }
  ctx.restore();
}

function drawFlatbreadLoose(ctx, s) {
  ctx.fillStyle = '#e8b86d';
  ctx.beginPath();
  ctx.ellipse(0, 0, 15 * s, 13 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 2.2 * Math.min(1.2, s));
  ctx.strokeStyle = '#c98b3e';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.ellipse(0, 0, 11 * s, 9.5 * s, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#9c5d22';
  for (const [dx, dy, r] of [[-4, -3, 1.8], [5, 2, 1.5], [-1, 5, 1.3], [6, -5, 1.2]]) {
    ctx.beginPath();
    ctx.ellipse(dx * s, dy * s, r * 1.4 * s, r * s, 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawFlatbreadBase(ctx, s) {
  ctx.fillStyle = '#e8b86d';
  ctx.beginPath();
  ctx.arc(0, 0, 21 * s, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 2 * s);
  ctx.strokeStyle = '#c98b3e';
  ctx.lineWidth = 3 * s;
  ctx.beginPath();
  ctx.arc(0, 0, 17 * s, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#a3622a';
  for (const [dx, dy] of [[-17, -6], [15, -10], [12, 13], [-10, 15], [0, -19]]) {
    ctx.beginPath();
    ctx.ellipse(dx * s, dy * s, 2.4 * s, 1.5 * s, 0.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawRiceSack(ctx, s) {
  ctx.fillStyle = '#d8b47e';
  ctx.beginPath();
  ctx.moveTo(-11 * s, 13 * s);
  ctx.quadraticCurveTo(-15 * s, -2 * s, -7 * s, -9 * s);
  ctx.lineTo(7 * s, -9 * s);
  ctx.quadraticCurveTo(15 * s, -2 * s, 11 * s, 13 * s);
  ctx.closePath();
  ctx.fill();
  outline(ctx, 2.2 * Math.min(1.2, s));
  ctx.fillStyle = '#fbf7ee';
  ctx.beginPath();
  ctx.ellipse(0, -9 * s, 8 * s, 4 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 1.6 * Math.min(1.2, s));
  ctx.strokeStyle = '#a07a45';
  ctx.lineWidth = 2 * s;
  ctx.beginPath();
  ctx.moveTo(-8 * s, -5 * s);
  ctx.lineTo(8 * s, -5 * s);
  ctx.stroke();
  ctx.fillStyle = '#a2402f';
  ctx.font = `bold ${9 * s}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('米', 0, 4 * s);
}

function drawRiceMound(ctx, x, y, s) {
  ctx.fillStyle = '#fbf8f1';
  ctx.beginPath();
  ctx.ellipse(x, y, 15 * s, 12 * s, 0, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 2 * Math.min(1.2, s));
  ctx.fillStyle = '#dcd3c3';
  const grains = [[-8, -3], [-3, -7], [3, -6], [8, -2], [-6, 3], [0, 0], [6, 4], [-2, 6], [10, -7], [-10, 4]];
  for (const [dx, dy] of grains) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s, 2.4 * s, 1.2 * s, dx * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawBurntLump(ctx, s) {
  ctx.fillStyle = '#2b2026';
  ctx.beginPath();
  ctx.ellipse(0, 0, 13 * s, 10 * s, 0.2, 0, Math.PI * 2);
  ctx.fill();
  outline(ctx, 2 * Math.min(1.2, s));
  ctx.fillStyle = '#ff6a1a';
  for (const [dx, dy] of [[-4, -2], [5, 3], [1, -5]]) {
    ctx.beginPath();
    ctx.arc(dx * s, dy * s, 1.6 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawSauceDots(ctx, s, colour) {
  ctx.fillStyle = colour;
  const dots = [[-19, 15, 3.2], [-13, 20, 2.4], [-6, 23, 1.7]];
  for (const [dx, dy, r] of dots) {
    ctx.beginPath();
    ctx.arc(dx * s, dy * s, r * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawHerbSprig(ctx, x, y, s) {
  ctx.strokeStyle = '#2e6b25';
  ctx.lineWidth = 1.8 * s;
  ctx.beginPath();
  ctx.moveTo(x - 5 * s, y + 6 * s);
  ctx.lineTo(x + 3 * s, y - 3 * s);
  ctx.stroke();
  ctx.fillStyle = '#4fc23e';
  for (const [dx, dy, a] of [[-2, 1, -0.9], [2, -3, 0.4], [-4, -3, -2.1]]) {
    ctx.beginPath();
    ctx.ellipse(x + dx * s, y + dy * s, 4 * s, 2.2 * s, a, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2 * s;
    ctx.stroke();
  }
}

function drawSteam(ctx, x, y, s, t) {
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.6 * s;
  for (let wisp = 0; wisp < 3; wisp += 1) {
    const phase = (t * 0.9 + wisp * 0.33) % 1;
    ctx.strokeStyle = `rgba(255,255,255,${0.75 * (1 - phase)})`;
    const wx = x + (wisp - 1) * 9 * s;
    const wy = y - phase * 10 * s;
    ctx.beginPath();
    ctx.moveTo(wx, wy);
    ctx.bezierCurveTo(wx - 5 * s, wy - 5 * s, wx + 5 * s, wy - 9 * s, wx, wy - 14 * s);
    ctx.stroke();
  }
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

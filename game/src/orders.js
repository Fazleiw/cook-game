// The order rail: tickets arrive on a cadence that tightens across the shift, dinner rushes drop
// two at once, every ticket's patience drains, and a plate on the serve hatch is matched to the
// most urgent ticket for its dish. Score = parts x 20 + a tip for speed, times the combo.
import { ORDER_PACE, SCORING, SERVICE } from './config.js';
import { STATION, tileCentre } from './kitchen.js';
import { matchRecipe, plateFitsRecipe, RECIPE_BY_ID, unlockedRecipes } from './recipes.js';
import { spawnScorePopup, spawnServeStreak } from './effects.js';

/** Put `count` new tickets on the rail (or in the queue behind it when the rail is full). */
export function spawnOrderWave(state, count) {
  const share = shiftShare(state);
  const menu = unlockedRecipes(share, state.day);
  for (let index = 0; index < count; index += 1) {
    const onRail = state.orders.filter((order) => order.status === 'open').map((order) => order.recipeId);
    // Newer dishes come up a little more often, and no dish fills more than two tickets.
    const pool = menu.filter((recipe) => onRail.filter((id) => id === recipe.id).length < 2);
    const weights = pool.map((recipe) => 1 + recipe.unlockAt * 2.5);
    let pick = state.random() * weights.reduce((sum, weight) => sum + weight, 0);
    let recipe = pool[pool.length - 1];
    for (let choice = 0; choice < pool.length; choice += 1) {
      pick -= weights[choice];
      if (pick <= 0) {
        recipe = pool[choice];
        break;
      }
    }
    const patience = easeAcross(ORDER_PACE.patience, share) * daySqueeze(state) + recipe.parts.length * 4;
    const order = { id: state.nextOrderNumber, recipeId: recipe.id, patience, remaining: patience, status: 'queued', age: 0, leave: 0 };
    state.nextOrderNumber += 1;
    state.queue.push(order);
  }
  promoteQueuedOrders(state);
}

/** Drain every open ticket's patience; a ticket that runs dry is missed and breaks the combo. */
export function tickOrderTimers(state, dt) {
  for (const order of state.orders) {
    order.age += dt;
    if (order.status !== 'open') {
      order.leave += dt;
      continue;
    }
    order.remaining -= dt;
    if (order.remaining <= 0) {
      order.remaining = 0;
      order.status = 'missed';
      state.missed += 1;
      state.combo = 0;
      state.score = Math.max(0, state.score - SCORING.missPenalty);
      state.events.push({ type: 'missed', order: order.id });
    }
  }
  // Diners still waiting for a spot on the rail lose patience too, at half the rate.
  for (const order of state.queue) order.remaining = Math.max(order.patience * 0.35, order.remaining - dt * 0.5);
  state.orders = state.orders.filter((order) => order.status === 'open' || order.leave < 0.9);
  promoteQueuedOrders(state);
}

/** The cadence: a new ticket every interval (shrinking across the shift) and rush waves on cue. */
export function scheduleOrders(state, dt) {
  state.nextOrderIn -= dt;
  if (state.nextOrderIn <= 0) {
    spawnOrderWave(state, 1);
    state.nextOrderIn += easeAcross(ORDER_PACE.interval, shiftShare(state)) * daySqueeze(state);
  }
  const rushAt = ORDER_PACE.rushAt[state.rushIndex];
  if (rushAt !== undefined && shiftShare(state) >= rushAt) {
    state.rushIndex += 1;
    spawnOrderWave(state, ORDER_PACE.rushSize);
    state.banner = { text: 'DINNER RUSH!', sub: `+${ORDER_PACE.rushSize} tickets`, t: 0 };
    state.events.push({ type: 'rush' });
  }
}

/** Space at the hatch: every finished plate there goes to the most urgent ticket for its dish. */
export function serveDish(state) {
  let servedAny = false;
  for (const station of state.stations) {
    if (station.kind !== STATION.pass || !station.plate) continue;
    const plate = station.plate;
    const recipe = matchRecipe(plate.items);
    const order = recipe && mostUrgentOrder(state, recipe.id);
    const centre = tileCentre(station.col, station.row);
    if (!order) {
      plate.shake = 0.35;
      spawnScorePopup(state, centre.x, centre.y - 36, recipe ? 'No ticket!' : 'Not a dish', '#ec3b33', 18);
      state.events.push({ type: 'deny', station: station.id });
      continue;
    }
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const multiplier = Math.min(SCORING.comboMax, 1 + SCORING.comboStep * (state.combo - 1));
    const base = recipe.parts.length * SCORING.perPart;
    const tip = Math.round(SCORING.tipMax * (order.remaining / order.patience));
    const points = Math.round((base + tip) * multiplier);
    state.score += points;
    state.tips += tip;
    state.served += 1;
    state.dishLog[recipe.id] = (state.dishLog[recipe.id] ?? 0) + 1;
    order.status = 'served';
    spawnServeStreak(state, centre.x, centre.y, plate.items.slice(), recipe.colour);
    spawnScorePopup(state, centre.x, centre.y - 52, `+${points}`, '#ffb21e', 34);
    if (state.combo >= 2) spawnScorePopup(state, centre.x + 64, centre.y - 92, `COMBO x${multiplier.toFixed(2).replace(/0$/, '').replace(/\.0$/, '')}`, '#1fb5a3', 22);
    plate.items = [];
    plate.away = SERVICE.plateReturn;
    station.plate = null;
    state.lastServe = { order: order.id, points, tip, combo: state.combo, t: state.clock };
    state.events.push({ type: 'served', order: order.id, points, combo: state.combo });
    servedAny = true;
  }
  return servedAny;
}

/**
 * Which plate is on its way to which ticket (for the ticks on each ticket): the most urgent
 * ticket claims the fullest plate that fits it, then the next, so one plate never ticks two.
 * Returns Map(order id -> plate).
 */
export function claimPlatesForTickets(state) {
  const claims = new Map();
  const free = state.plates.filter((plate) => plate.away <= 0 && plate.items.length > 0);
  const open = state.orders.filter((order) => order.status === 'open').sort((a, b) => a.remaining - b.remaining);
  for (const order of open) {
    const recipe = RECIPE_BY_ID[order.recipeId];
    let best = null;
    for (const plate of free) {
      if (plateFitsRecipe(plate.items, recipe) && (!best || plate.items.length > best.items.length)) best = plate;
    }
    if (best) {
      claims.set(order.id, best);
      free.splice(free.indexOf(best), 1);
    }
  }
  return claims;
}

export function shiftShare(state) {
  return Math.min(1, state.clock / SERVICE.seconds);
}

function mostUrgentOrder(state, recipeId) {
  let best = null;
  for (const order of state.orders) {
    if (order.status === 'open' && order.recipeId === recipeId && (!best || order.remaining < best.remaining)) best = order;
  }
  return best;
}

function promoteQueuedOrders(state) {
  while (state.queue.length > 0 && state.orders.filter((order) => order.status === 'open').length < SERVICE.boardSize) {
    const order = state.queue.shift();
    order.status = 'open';
    order.age = 0;
    state.orders.push(order);
    state.events.push({ type: 'ticket', order: order.id });
  }
}

function easeAcross([from, to], share) {
  return from + (to - from) * share;
}

function daySqueeze(state) {
  return Math.pow(ORDER_PACE.daySqueeze, state.day - 1);
}

// A chef bot that plays the real rules through the same intents a mouse click sends (walk to a
// station and use it, use, serve). It gives plates to the most urgent tickets, matches what is
// already chopped or on the heat to what those plates still need, and works the next most useful
// station: rescue a cooked pan, run a finished plate to the hatch, chop, fetch from a crate. The
// screenshot scenes and the title screen's attract mode both cook with it.
import { canBecome, canChop, nextProcess } from './ingredients.js';
import { STATION, stationHoldingPlate, tileAt } from './kitchen.js';
import { matchRecipe, missingParts, plateFitsRecipe, RECIPE_BY_ID } from './recipes.js';
import { routeLength } from './routes.js';
import { stationInReach } from './player.js';

/**
 * Returns steerChef(state, dt) -> controls. `focus` is how many tickets it cooks for at once;
 * `holdServe` is how long a finished plate waits under the hatch lamp before it rings it out
 * (unless its ticket is nearly out of time); `reaction` is its pause between decisions.
 */
export function createChefPilot({ focus = 2, holdServe = 0, reaction = 0.12, chopGap = 0.17 } = {}) {
  const assigned = new Map();
  let chopWait = 0;
  let pause = 0;
  return function steerChef(state, dt) {
    const intents = [];
    keepPlateAssignments(state, assigned, focus);
    if (shouldRingHatch(state, holdServe)) intents.push({ type: 'serve' });
    const cook = state.cook;
    if (cook.route.length > 0 || cook.pending !== null) return { direction: { x: 0, y: 0 }, useHeld: false, intents };
    const reach = stationInReach(state);
    if (!cook.held && reach && reach.kind === STATION.board && reach.item && canChop(reach.item)) {
      chopWait -= dt;
      if (chopWait <= 0) {
        intents.push({ type: 'use' });
        chopWait = chopGap;
      }
      return { direction: { x: 0, y: 0 }, useHeld: false, intents };
    }
    pause -= dt;
    if (pause <= 0) {
      const goal = chooseNextStation(state, assigned);
      if (goal) intents.push({ type: 'goUse', stationId: goal.id });
      pause = goal ? reaction : 0.3;
    }
    return { direction: { x: 0, y: 0 }, useHeld: false, intents };
  };
}

/** Keep up to `focus` plates promised to open tickets, most urgent first. */
function keepPlateAssignments(state, assigned, focus) {
  const open = state.orders.filter((order) => order.status === 'open');
  for (const [plateId, orderId] of assigned) {
    const order = open.find((candidate) => candidate.id === orderId);
    const plate = state.plates[plateId];
    if (!order || plate.away > 0 || !plateFitsRecipe(plate.items, RECIPE_BY_ID[order.recipeId])) assigned.delete(plateId);
  }
  const taken = new Set(assigned.values());
  const waiting = open.filter((order) => !taken.has(order.id)).sort((a, b) => a.remaining - b.remaining);
  for (const order of waiting) {
    if (assigned.size >= focus) break;
    const recipe = RECIPE_BY_ID[order.recipeId];
    let best = null;
    for (const plate of state.plates) {
      if (assigned.has(plate.id) || plate.away > 0 || !plateFitsRecipe(plate.items, recipe)) continue;
      if (!best || plate.items.length > best.items.length) best = plate;
    }
    if (best) assigned.set(best.id, order.id);
  }
}

function shouldRingHatch(state, holdServe) {
  for (const station of state.stations) {
    if (station.kind !== STATION.pass || !station.plate) continue;
    const recipe = matchRecipe(station.plate.items);
    if (!recipe) return true;
    const order = state.orders.find((candidate) => candidate.status === 'open' && candidate.recipeId === recipe.id);
    if (!order) return true;
    if (station.plate.passTime >= holdServe || order.remaining / order.patience < 0.22) return true;
  }
  return false;
}

/** What every promised plate still lacks, each matched to the food already on its way to it. */
function matchNeedsToFood(state, assigned) {
  const needs = [];
  for (const [plateId, orderId] of assigned) {
    const plate = state.plates[plateId];
    const order = state.orders.find((candidate) => candidate.id === orderId);
    for (const [kind, target] of missingParts(plate.items, RECIPE_BY_ID[order.recipeId])) needs.push({ plate, kind, target, food: null, where: null });
  }
  // The pilot cooks from the crates and leaves the raw produce on the bare counters alone.
  const supplies = [];
  if (state.cook.held && state.cook.held.type === 'food') supplies.push({ food: state.cook.held, where: null });
  for (const station of state.stations) {
    if (station.item && !(station.kind === STATION.counter && station.item.state === 'raw')) supplies.push({ food: station.item, where: station });
  }
  const used = new Set();
  for (const need of needs) {
    for (const supply of supplies) {
      if (used.has(supply.food) || supply.food.kind !== need.kind || !canBecome(supply.food, need.target)) continue;
      used.add(supply.food);
      need.food = supply.food;
      need.where = supply.where;
      break;
    }
  }
  return needs;
}

function nearest(state, stations) {
  const here = tileAt(state.cook.x, state.cook.y);
  let best = null;
  let bestLength = Infinity;
  for (const station of stations) {
    const length = routeLength(state.grid, here.col, here.row, station);
    if (length < bestLength) {
      best = station;
      bestLength = length;
    }
  }
  return best;
}

function freeStations(state, kind) {
  return state.stations.filter((station) => station.kind === kind && !station.item && !station.plate);
}

function processStationFor(state, food, target) {
  const process = nextProcess(food, target);
  if (process === null) return null;
  return nearest(state, freeStations(state, process));
}

function openOrderFor(state, recipe) {
  return state.orders.some((order) => order.status === 'open' && order.recipeId === recipe.id);
}

function chooseNextStation(state, assigned) {
  const held = state.cook.held;
  const needs = matchNeedsToFood(state, assigned);
  if (held && held.type === 'plate') return placeHeldPlate(state, held);
  if (held) {
    const need = needs.find((candidate) => candidate.food === held);
    if (!need || held.state === 'burnt') return nearest(state, state.stations.filter((station) => station.kind === STATION.bin));
    if (held.state === need.target) return stationHoldingPlate(state.stations, need.plate);
    // No free board or stove: hold on to it and wait for one rather than cluttering a counter.
    return processStationFor(state, held, need.target);
  }
  // Hands empty: the most useful station to walk to, in order of urgency.
  const burnt = state.stations.find((station) => (station.kind === STATION.skillet || station.kind === STATION.pot) && station.item?.state === 'burnt');
  if (burnt) return burnt;
  for (const need of needs) {
    if (need.where && (need.where.kind === STATION.skillet || need.where.kind === STATION.pot) && need.food.state === need.target && stationHoldingPlate(state.stations, need.plate)) return need.where;
  }
  const passFree = freeStations(state, STATION.pass).length > 0;
  if (passFree) {
    const ready = state.stations.find((station) => station.kind !== STATION.pass && station.plate && matchRecipe(station.plate.items) && openOrderFor(state, matchRecipe(station.plate.items)));
    if (ready) return ready;
  }
  for (const need of needs) {
    if (!need.where || need.where.kind === STATION.skillet || need.where.kind === STATION.pot) continue;
    if (need.food.state === need.target && stationHoldingPlate(state.stations, need.plate)) return need.where;
    if (need.where.kind === STATION.board && canChop(need.food)) return need.where;
    if (need.food.state !== need.target && processStationFor(state, need.food, need.target) && need.where.kind !== STATION.board) return need.where;
    if (need.where.kind === STATION.board && !canChop(need.food) && processStationFor(state, need.food, need.target)) return need.where;
  }
  // Fetch what needs the heat first, so the pans work while the knife does.
  const unmet = needs.filter((need) => !need.food).sort((a, b) => heatRank(b) - heatRank(a));
  for (const need of unmet) {
    const fresh = { type: 'food', kind: need.kind, state: 'raw' };
    if (fresh.state !== need.target && !processStationFor(state, fresh, need.target)) continue;
    const crate = state.stations.find((station) => station.kind === STATION.crate && station.ingredient === need.kind);
    if (crate) return crate;
  }
  // A plate with parts no ticket wants blocks a bench: bin its contents.
  const stuck = state.plates.find((plate) => plate.items.length > 0 && plate.away <= 0 && !assigned.has(plate.id) && !(matchRecipe(plate.items) && openOrderFor(state, matchRecipe(plate.items))) && stationHoldingPlate(state.stations, plate)?.kind === STATION.bench);
  if (stuck && state.orders.some((order) => order.status === 'open' && ![...assigned.values()].includes(order.id))) return stationHoldingPlate(state.stations, stuck);
  return null;
}

function heatRank(need) {
  return need.target === 'cooked' ? 1 : 0;
}

function placeHeldPlate(state, plate) {
  const recipe = matchRecipe(plate.items);
  if (recipe && openOrderFor(state, recipe)) return nearest(state, freeStations(state, STATION.pass));
  if (plate.items.length > 0 && !recipe) {
    const fits = state.orders.some((order) => order.status === 'open' && plateFitsRecipe(plate.items, RECIPE_BY_ID[order.recipeId]));
    if (!fits) return nearest(state, state.stations.filter((station) => station.kind === STATION.bin));
  } else if (recipe) return nearest(state, state.stations.filter((station) => station.kind === STATION.bin));
  const home = state.stations[plate.home];
  if (!home.plate && !home.item) return home;
  return nearest(state, freeStations(state, STATION.bench).concat(freeStations(state, STATION.counter)));
}

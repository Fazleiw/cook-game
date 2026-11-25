// What every station does when the cook uses it, and what the stoves do on their own each tick.
// One entry point, interactWithStation, reads what the cook holds and what the station holds and
// does the one obvious thing: take, put down, chop, start cooking, plate, bin.
import { COOK_TIMES } from './config.js';
import { canChop, chopOnce, createFood, INGREDIENTS, stoveAccepts } from './ingredients.js';
import { STATION, stationHoldingPlate, tileCentre } from './kitchen.js';
import { matchRecipe, plateAccepts } from './recipes.js';
import { spawnChopDice, spawnPlatePop, spawnScorePopup, spawnSmokePuff } from './effects.js';

/** The cook uses `station`: returns true when something happened. */
export function interactWithStation(state, station) {
  const cook = state.cook;
  const held = cook.held;
  switch (station.kind) {
    case STATION.crate:
      if (!held) return giveToCook(state, station, createFood(station.ingredient));
      if (held.type === 'food' && held.kind === station.ingredient && held.state === 'raw') {
        cook.held = null;
        return notify(state, 'place', station);
      }
      return deny(state, station);
    case STATION.board:
      if (station.item) {
        if (!held) return canChop(station.item) ? chopIngredient(state, station) : takeItem(state, station);
        if (held.type === 'plate') return plateFromStation(state, held, station);
        return deny(state, station);
      }
      return putDown(state, station);
    case STATION.skillet:
    case STATION.pot:
      if (station.item) {
        if (!held) return takeItem(state, station);
        if (held.type === 'plate') return plateFromStation(state, held, station);
        return deny(state, station);
      }
      if (held && held.type === 'food' && stoveAccepts(station.kind, held)) {
        station.item = held;
        held.heat = 0;
        cook.held = null;
        return notify(state, 'sizzle', station);
      }
      return deny(state, station);
    case STATION.bin:
      return binHeld(state, station);
    case STATION.pass:
      if (station.plate && !held) return takePlate(state, station);
      if (!station.plate && held && held.type === 'plate' && held.items.length > 0) {
        station.plate = held;
        held.passTime = 0;
        cook.held = null;
        notify(state, 'pass', station);
        if (matchRecipe(held.items)) spawnScorePopup(state, tileCentre(station.col, station.row).x, tileCentre(station.col, station.row).y - 40, 'READY!', '#ffb21e', 22);
        return true;
      }
      return deny(state, station);
    default:
      // Bare counters and plating benches hold one thing: a plate or a food.
      if (station.plate) {
        if (held && held.type === 'food') return assemblePlate(state, station.plate, held, station, () => (cook.held = null));
        if (!held) return takePlate(state, station);
        return deny(state, station);
      }
      if (station.item) {
        if (!held) return takeItem(state, station);
        if (held.type === 'plate') return plateFromStation(state, held, station);
        return deny(state, station);
      }
      return putDown(state, station);
  }
}

/** One knife stroke on the board's food: dice fly at once, the chop finishes on the last stroke. */
export function chopIngredient(state, station) {
  const food = station.item;
  if (!food || !canChop(food)) return false;
  const done = chopOnce(food);
  station.flash = 0.12;
  station.shake = 0.1;
  const centre = tileCentre(station.col, station.row);
  spawnChopDice(state, centre.x, centre.y - 6, INGREDIENTS[food.kind].colour);
  state.cook.chopPose = 0.14;
  notify(state, done ? 'chopDone' : 'chop', station);
  return true;
}

/** Snap `food` onto `plate` if the plate can still become a dish with it; `release` empties the giver. */
export function assemblePlate(state, plate, food, station, release) {
  if (!plateAccepts(plate.items, food)) return deny(state, station);
  plate.items.push({ kind: food.kind, state: food.state });
  plate.pop = 0.22;
  release();
  const centre = station ? tileCentre(station.col, station.row) : { x: state.cook.x, y: state.cook.y };
  const recipe = matchRecipe(plate.items);
  spawnPlatePop(state, centre.x, centre.y - 4, recipe ? recipe.colour : INGREDIENTS[food.kind].colour);
  if (recipe) spawnScorePopup(state, centre.x, centre.y - 34, recipe.name, recipe.colour, 18);
  notify(state, recipe ? 'dish' : 'plate', station);
  return true;
}

/** Heat every pan and pot by dt: food turns cooked, then (on a skillet) burnt, with smoke. */
export function tickStoveCooking(state, dt) {
  for (const station of state.stations) {
    if ((station.kind !== STATION.skillet && station.kind !== STATION.pot) || !station.item) continue;
    const food = station.item;
    const times = COOK_TIMES[station.kind];
    if (food.state === 'burnt') {
      if (state.fxRandom() < dt * 5) spawnSmokePuff(state, tileCentre(station.col, station.row).x, tileCentre(station.col, station.row).y - 14, true);
      continue;
    }
    const before = food.heat;
    food.heat += dt;
    if (food.state !== 'cooked' && before < times.done && food.heat >= times.done) {
      food.state = 'cooked';
      notify(state, 'cooked', station);
    } else if (food.state === 'cooked' && before < times.burn && food.heat >= times.burn) {
      food.state = 'burnt';
      notify(state, 'burnt', station);
    }
    if (food.state === 'cooked' && food.heat > times.done + (times.burn - times.done) * 0.55 && state.fxRandom() < dt * 4) {
      spawnSmokePuff(state, tileCentre(station.col, station.row).x, tileCentre(station.col, station.row).y - 14, false);
    }
  }
}

/** Washed plates come back to their own bench (or the first free bench) after a short wait. */
export function tickPlateReturns(state, dt) {
  for (const plate of state.plates) {
    if (plate.pop > 0) plate.pop = Math.max(0, plate.pop - dt);
    if (plate.shake > 0) plate.shake = Math.max(0, plate.shake - dt);
    if (stationHoldingPlate(state.stations, plate)?.kind === STATION.pass) plate.passTime += dt;
    if (plate.away <= 0) continue;
    plate.away -= dt;
    if (plate.away > 0) continue;
    plate.away = 0;
    const home = state.stations[plate.home];
    const spot = !home.plate && !home.item ? home : state.stations.find((station) => station.kind === STATION.bench && !station.plate && !station.item);
    if (spot) spot.plate = plate;
    else plate.away = 0.5;
  }
  for (const station of state.stations) {
    if (station.flash > 0) station.flash = Math.max(0, station.flash - dt);
    if (station.shake > 0) station.shake = Math.max(0, station.shake - dt);
  }
}

function giveToCook(state, station, item) {
  state.cook.held = item;
  return notify(state, 'pickup', station);
}

function takeItem(state, station) {
  state.cook.held = station.item;
  station.item = null;
  return notify(state, 'pickup', station);
}

function takePlate(state, station) {
  state.cook.held = station.plate;
  station.plate = null;
  return notify(state, 'pickup', station);
}

function putDown(state, station) {
  const held = state.cook.held;
  if (!held) return false;
  if (held.type === 'plate') station.plate = held;
  else station.item = held;
  state.cook.held = null;
  return notify(state, 'place', station);
}

function plateFromStation(state, plate, station) {
  const food = station.item;
  if (!food || food.state === 'burnt') return deny(state, station);
  return assemblePlate(state, plate, food, station, () => (station.item = null));
}

function binHeld(state, station) {
  const held = state.cook.held;
  if (!held) return false;
  if (held.type === 'plate') {
    if (held.items.length === 0) return deny(state, station);
    held.items.length = 0;
  } else state.cook.held = null;
  return notify(state, 'bin', station);
}

function deny(state, station) {
  station.shake = 0.18;
  notify(state, 'deny', station);
  return false;
}

function notify(state, type, station) {
  state.events.push({ type, station: station ? station.id : -1 });
  return true;
}

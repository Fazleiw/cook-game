// Chef Pim: walking with the keys (sliding along counters), walking a route after a click, and
// working out which station is in reach — the one the cook faces, else the nearest beside them.
import { COOK, KITCHEN_GRID } from './config.js';
import { isFloor, stationAt, tileAt, tileCentre } from './kitchen.js';
import { findRouteToStation, findRouteToTile } from './routes.js';

export function createCook() {
  const start = tileCentre(5, 3);
  return { x: start.x, y: start.y, facing: { x: 0, y: -1 }, held: null, route: [], pending: null, walk: 0, chopPose: 0, chopTimer: 0 };
}

/** Walk by the keys: direction is { x, y } in -1..1; any key walk cancels a clicked route. */
export function moveCook(state, direction, dt) {
  const cook = state.cook;
  if (direction.x === 0 && direction.y === 0) return false;
  cook.route = [];
  cook.pending = null;
  const length = Math.hypot(direction.x, direction.y);
  const dx = (direction.x / length) * COOK.speed * dt;
  const dy = (direction.y / length) * COOK.speed * dt;
  cook.facing = Math.abs(direction.x) > Math.abs(direction.y) ? { x: Math.sign(direction.x), y: 0 } : { x: 0, y: Math.sign(direction.y) };
  if (canStand(state.grid, cook.x + dx, cook.y)) cook.x += dx;
  if (canStand(state.grid, cook.x, cook.y + dy)) cook.y += dy;
  cook.walk += dt;
  return true;
}

/** Plan a walk to the floor beside a station, then use it on arrival (a click, a plate key, the pilot). */
export function sendCookToStation(state, station) {
  const cook = state.cook;
  const here = tileAt(cook.x, cook.y);
  const route = findRouteToStation(state.grid, here.col, here.row, station);
  if (route === null) return false;
  cook.route = route;
  cook.pending = station.id;
  return true;
}

export function sendCookToTile(state, col, row) {
  const cook = state.cook;
  const here = tileAt(cook.x, cook.y);
  const route = findRouteToTile(state.grid, here.col, here.row, col, row);
  if (route === null) return false;
  cook.route = route;
  cook.pending = null;
  return true;
}

/**
 * Walk the planned route by dt; returns the station to use when the cook has just arrived beside
 * it (facing it), else null.
 */
export function followRoute(state, dt) {
  const cook = state.cook;
  let budget = COOK.speed * dt;
  while (cook.route.length > 0 && budget > 0) {
    const next = tileCentre(cook.route[0].col, cook.route[0].row);
    const dx = next.x - cook.x;
    const dy = next.y - cook.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0.5) cook.facing = Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
    if (distance <= budget) {
      cook.x = next.x;
      cook.y = next.y;
      budget -= distance;
      cook.route.shift();
    } else {
      cook.x += (dx / distance) * budget;
      cook.y += (dy / distance) * budget;
      budget = 0;
    }
    cook.walk += dt;
  }
  if (cook.route.length === 0 && cook.pending !== null) {
    const station = state.stations[cook.pending];
    cook.pending = null;
    const here = tileAt(cook.x, cook.y);
    cook.facing = { x: Math.sign(station.col - here.col), y: Math.sign(station.row - here.row) };
    return station;
  }
  return null;
}

/** The station the cook would use now: the one faced, else the nearest beside the cook's tile. */
export function stationInReach(state) {
  const cook = state.cook;
  const here = tileAt(cook.x, cook.y);
  const ahead = stationAt(state.grid, here.col + cook.facing.x, here.row + cook.facing.y);
  if (ahead) return ahead;
  let best = null;
  let bestDistance = Infinity;
  for (const [dc, dr] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
    const station = stationAt(state.grid, here.col + dc, here.row + dr);
    if (!station) continue;
    const centre = tileCentre(station.col, station.row);
    const distance = Math.hypot(centre.x - cook.x, centre.y - cook.y);
    if (distance < bestDistance && distance < KITCHEN_GRID.tile * 1.3) {
      best = station;
      bestDistance = distance;
    }
  }
  return best;
}

function canStand(grid, x, y) {
  const h = COOK.half;
  for (const [cx, cy] of [[x - h, y - h], [x + h, y - h], [x - h, y + h], [x + h, y + h]]) {
    const tile = tileAt(cx, cy);
    if (!isFloor(grid, tile.col, tile.row)) return false;
  }
  return true;
}

// Walking routes across the galley floor: a breadth-first search over floor tiles to the nearest
// tile beside a station. Mouse clicks, the 1-3 plate keys and the chef autopilot all walk by it.
import { isFloor } from './kitchen.js';

const STEPS = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];

/**
 * The tiles to walk, start excluded, from (col, row) to a floor tile beside `station`; [] when
 * already beside it, null when it cannot be reached.
 */
export function findRouteToStation(grid, col, row, station) {
  return findRoute(grid, col, row, (c, r) => Math.abs(c - station.col) + Math.abs(r - station.row) === 1);
}

/** The tiles to walk to the floor tile (goalCol, goalRow), or null. */
export function findRouteToTile(grid, col, row, goalCol, goalRow) {
  if (!isFloor(grid, goalCol, goalRow)) return null;
  return findRoute(grid, col, row, (c, r) => c === goalCol && r === goalRow);
}

/** How many tiles the walk to a station is (Infinity when there is no way). */
export function routeLength(grid, col, row, station) {
  const route = findRouteToStation(grid, col, row, station);
  return route === null ? Infinity : route.length;
}

function findRoute(grid, col, row, isGoal) {
  if (isGoal(col, row)) return [];
  const key = (c, r) => r * 64 + c;
  const came = new Map([[key(col, row), null]]);
  const queue = [[col, row]];
  for (let head = 0; head < queue.length; head += 1) {
    const [c, r] = queue[head];
    for (const [dc, dr] of STEPS) {
      const nc = c + dc;
      const nr = r + dr;
      if (!isFloor(grid, nc, nr) || came.has(key(nc, nr))) continue;
      came.set(key(nc, nr), [c, r]);
      if (isGoal(nc, nr)) {
        const route = [];
        let at = [nc, nr];
        while (at && !(at[0] === col && at[1] === row)) {
          route.unshift({ col: at[0], row: at[1] });
          at = came.get(key(at[0], at[1]));
        }
        return route;
      }
      queue.push([nc, nr]);
    }
  }
  return null;
}

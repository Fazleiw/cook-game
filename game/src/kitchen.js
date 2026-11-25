// The galley's floor plan turned into stations: it reads KITCHEN_PLAN once per shift and answers
// the spatial questions everyone else asks (which tile is this, is it walkable, where is plate 2).
import { COUNTER_STOCK, CRATE_KEYS, KITCHEN_GRID, KITCHEN_PLAN } from './config.js';
import { createFood } from './ingredients.js';

export const STATION = {
  counter: 'counter',
  crate: 'crate',
  board: 'board',
  skillet: 'skillet',
  pot: 'pot',
  bench: 'bench',
  pass: 'pass',
  bin: 'bin',
};

/** Build the stations and plates for a fresh shift: { stations, grid, plates }. */
export function buildKitchenLayout() {
  const stations = [];
  const plates = [];
  const grid = [];
  let passNumber = 0;
  for (let row = 0; row < KITCHEN_GRID.rows; row += 1) {
    const line = [];
    for (let col = 0; col < KITCHEN_GRID.cols; col += 1) {
      const key = KITCHEN_PLAN[row][col];
      if (key === '.') {
        line.push(null);
        continue;
      }
      const station = { id: stations.length, col, row, kind: STATION.counter, item: null, plate: null, flash: 0, shake: 0 };
      if (CRATE_KEYS[key]) {
        station.kind = STATION.crate;
        station.ingredient = CRATE_KEYS[key];
      } else if (key === 'K') station.kind = STATION.board;
      else if (key === 'S') station.kind = STATION.skillet;
      else if (key === 'R') station.kind = STATION.pot;
      else if (key === 'X') station.kind = STATION.bin;
      else if (key === 'P') {
        station.kind = STATION.pass;
        passNumber += 1;
        station.number = passNumber;
      } else if (key >= '1' && key <= '9') {
        station.kind = STATION.bench;
        station.number = Number(key);
        const plate = { type: 'plate', id: plates.length, number: station.number, items: [], home: station.id, away: 0, pop: 0, passTime: 0, shake: 0 };
        plates.push(plate);
        station.plate = plate;
      }
      stations.push(station);
      line.push(station);
    }
    grid.push(line);
  }
  for (const stock of COUNTER_STOCK) grid[stock.row][stock.col].item = createFood(stock.kind);
  return { stations, grid, plates };
}

export function tileCentre(col, row) {
  return { x: KITCHEN_GRID.x + col * KITCHEN_GRID.tile + KITCHEN_GRID.tile / 2, y: KITCHEN_GRID.y + row * KITCHEN_GRID.tile + KITCHEN_GRID.tile / 2 };
}

export function tileAt(x, y) {
  return { col: Math.floor((x - KITCHEN_GRID.x) / KITCHEN_GRID.tile), row: Math.floor((y - KITCHEN_GRID.y) / KITCHEN_GRID.tile) };
}

export function isFloor(grid, col, row) {
  return row >= 0 && row < KITCHEN_GRID.rows && col >= 0 && col < KITCHEN_GRID.cols && grid[row][col] === null;
}

export function stationAt(grid, col, row) {
  if (row < 0 || row >= KITCHEN_GRID.rows || col < 0 || col >= KITCHEN_GRID.cols) return null;
  return grid[row][col];
}

/** The station a plate sits on, or null while it is carried or away being washed. */
export function stationHoldingPlate(stations, plate) {
  return stations.find((station) => station.plate === plate) ?? null;
}

export function stationsOfKind(stations, kind) {
  return stations.filter((station) => station.kind === kind);
}

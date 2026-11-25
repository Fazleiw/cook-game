// One shift in the galley: the whole game state and the fixed-step rule that advances it. Each
// step reads the cook's controls (a walk direction, held E, and intents: use, go-use a station,
// plate N, serve), applies them in the same tick, then runs the stoves, the order rail and the
// effects. Same seed + same controls = same shift, which is what the screenshot scenes rely on.
import { COOK, SERVICE } from './config.js';
import { createRandom } from './random.js';
import { buildKitchenLayout, stationHoldingPlate } from './kitchen.js';
import { canChop } from './ingredients.js';
import { chopIngredient, interactWithStation, tickPlateReturns, tickStoveCooking } from './stations.js';
import { scheduleOrders, serveDish, spawnOrderWave, tickOrderTimers } from './orders.js';
import { createCook, followRoute, moveCook, sendCookToStation, sendCookToTile, stationInReach } from './player.js';
import { ageEffects } from './effects.js';
import { ORDER_PACE } from './config.js';

export const NO_CONTROLS = Object.freeze({ direction: { x: 0, y: 0 }, useHeld: false, intents: [] });

export function createWorld(seed) {
  const world = {
    state: null,
    /** Open a fresh shift on `day` (1, 2, 3...): empty rail, stocked counters, full clock. */
    reset(day = 1) {
      const layout = buildKitchenLayout();
      world.state = {
        day,
        clock: 0,
        over: false,
        random: createRandom(seed * 7919 + day),
        fxRandom: createRandom(seed * 104729 + day * 31),
        stations: layout.stations,
        grid: layout.grid,
        plates: layout.plates,
        cook: createCook(),
        orders: [],
        queue: [],
        nextOrderNumber: 1,
        nextOrderIn: ORDER_PACE.firstOrderAt,
        openingDone: false,
        rushIndex: 0,
        banner: null,
        score: 0,
        combo: 0,
        bestCombo: 0,
        served: 0,
        missed: 0,
        tips: 0,
        dishLog: {},
        lastServe: null,
        effects: [],
        events: [],
      };
    },
    /** Advance the shift by dt with these controls; returns this step's events. */
    step(dt, controls = NO_CONTROLS) {
      const state = world.state;
      state.events = [];
      if (state.over) return state.events;
      applyCookControls(state, controls, dt);
      state.clock += dt;
      if (!state.openingDone && state.clock >= ORDER_PACE.firstOrderAt) {
        state.openingDone = true;
        spawnOrderWave(state, ORDER_PACE.openingOrders);
        state.nextOrderIn = 14;
      } else if (state.openingDone) scheduleOrders(state, dt);
      tickStoveCooking(state, dt);
      tickOrderTimers(state, dt);
      tickPlateReturns(state, dt);
      ageEffects(state, dt);
      if (state.banner) {
        state.banner.t += dt;
        if (state.banner.t > SERVICE.bannerSeconds) state.banner = null;
      }
      if (state.cook.chopPose > 0) state.cook.chopPose = Math.max(0, state.cook.chopPose - dt);
      if (state.clock >= SERVICE.seconds) {
        state.clock = SERVICE.seconds;
        state.over = true;
        state.events.push({ type: 'over' });
      }
      return state.events;
    },
  };
  world.reset(1);
  return world;
}

/** Seconds left on the service clock. */
export function timeLeft(state) {
  return Math.max(0, SERVICE.seconds - state.clock);
}

/** Every intent is acted on in the tick it arrives, so a press answers in the same frame. */
function applyCookControls(state, controls, dt) {
  const cook = state.cook;
  for (const intent of controls.intents) {
    if (intent.type === 'use') {
      const station = stationInReach(state);
      if (station) interactWithStation(state, station);
    } else if (intent.type === 'goUse') {
      const station = state.stations[intent.stationId];
      if (station && sendCookToStation(state, station) && cook.route.length === 0) {
        const arrived = followRoute(state, 0);
        if (arrived) interactWithStation(state, arrived);
      }
    } else if (intent.type === 'goTo') {
      sendCookToTile(state, intent.col, intent.row);
    } else if (intent.type === 'plate') {
      const plate = state.plates.find((candidate) => candidate.number === intent.number);
      const station = plate && stationHoldingPlate(state.stations, plate);
      if (station && sendCookToStation(state, station) && cook.route.length === 0) {
        const arrived = followRoute(state, 0);
        if (arrived) interactWithStation(state, arrived);
      }
    } else if (intent.type === 'serve') {
      serveDish(state);
    }
  }
  if (!moveCook(state, controls.direction, dt)) {
    const arrived = followRoute(state, dt);
    if (arrived) interactWithStation(state, arrived);
  }
  // Holding E over a board keeps the knife going, one stroke every COOK.chopRepeat seconds
  // (a fresh press already struck this tick, so it restarts the wait).
  cook.chopTimer = Math.max(0, cook.chopTimer - dt);
  if (controls.intents.some((intent) => intent.type === 'use')) cook.chopTimer = COOK.chopRepeat;
  if (controls.useHeld && !cook.held && cook.chopTimer === 0) {
    const station = stationInReach(state);
    if (station && station.item && canChop(station.item) && station.kind === 'board') {
      chopIngredient(state, station);
      cook.chopTimer = COOK.chopRepeat;
    }
  }
}

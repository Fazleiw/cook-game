// The screenshot scenes behind ?shot=cover|rush|combo|result (with &seed=N). Each plays a real
// shift forward from a fresh seeded world with the chef autopilot, scoring every step for how
// well it shows the scene, then replays the same shift to the best step: the frame is a moment
// of a real game, and the same seed always gives the same frame.
import { STEP } from './config.js';
import { createChefPilot } from './autopilot.js';
import { STATION } from './kitchen.js';
import { matchRecipe, plateFitsRecipe, RECIPES } from './recipes.js';
import { SCREEN_OVER, SCREEN_PLAY } from './render.js';

const SCENES = {
  /** Every part of a cooking game in one frame: rail, counter, half-built plate, clock, plate on the hatch. */
  cover: { day: 2, pilot: { holdServe: 9, focus: 3 }, from: 38, to: 150, rate: rateCoverMoment },
  /** A dinner rush landing on a full rail at day 3's pace. */
  rush: { day: 3, pilot: {}, from: 60, to: 150, rate: rateRushMoment },
  /** A plate ringing out on a long combo. */
  combo: { day: 1, pilot: { holdServe: 1.2 }, from: 20, to: 178, rate: rateComboMoment, settle: 0.3 },
};

/** Stage the named scene on `world`; returns the screen to paint and the view extras. */
export function stageShot(name, world) {
  if (name === 'result') {
    world.reset(1);
    const steer = createChefPilot({ holdServe: 0.6 });
    while (!world.state.over) world.step(STEP, steer(world.state, STEP));
    return { screen: SCREEN_OVER, view: { best: 0 } };
  }
  const scene = SCENES[name] ?? SCENES.cover;
  const bestStep = findBestStep(world, scene);
  replayTo(world, scene, bestStep);
  return { screen: SCREEN_PLAY, view: {} };
}

function findBestStep(world, scene) {
  world.reset(scene.day);
  const steer = createChefPilot(scene.pilot);
  let best = -1;
  let bestRating = -Infinity;
  const last = Math.round(scene.to / STEP);
  for (let step = 0; step < last && !world.state.over; step += 1) {
    const events = world.step(STEP, steer(world.state, STEP));
    if (world.state.clock < scene.from) continue;
    const rating = scene.rate(world.state, events);
    if (rating > bestRating) {
      bestRating = rating;
      best = step;
    }
  }
  return best;
}

function replayTo(world, scene, lastStep) {
  world.reset(scene.day);
  const steer = createChefPilot(scene.pilot);
  const settle = Math.round((scene.settle ?? 0) / STEP);
  for (let step = 0; step <= lastStep + settle; step += 1) world.step(STEP, steer(world.state, STEP));
}

function openOrders(state) {
  return state.orders.filter((order) => order.status === 'open');
}

function rateCoverMoment(state) {
  let rating = 0;
  const passReady = state.stations.some((station) => station.kind === STATION.pass && station.plate && matchRecipe(station.plate.items));
  if (passReady) rating += 40;
  // The best half-built plate: two parts down and one to go reads clearest.
  let halfBuilt = 0;
  for (const plate of state.plates) {
    if (plate.away > 0 || plate.items.length === 0 || matchRecipe(plate.items)) continue;
    if (!RECIPES.some((recipe) => plateFitsRecipe(plate.items, recipe))) continue;
    halfBuilt = Math.max(halfBuilt, plate.items.length >= 2 ? 34 : 18);
  }
  rating += halfBuilt;
  const tickets = openOrders(state);
  rating += Math.min(tickets.length, 4) * 8;
  if (tickets.every((order) => order.age > 0.4)) rating += 3;
  if (new Set(tickets.map((order) => order.recipeId)).size >= 3) rating += 4;
  const busyStations = state.stations.filter((station) => (station.kind === STATION.board || station.kind === STATION.skillet || station.kind === STATION.pot) && station.item).length;
  rating += Math.min(busyStations, 3) * 5;
  if (state.stations.some((station) => station.kind === STATION.skillet && station.item && station.item.state !== 'burnt')) rating += 30;
  const looseFood = state.stations.filter((station) => station.kind === STATION.counter && station.item).length;
  rating += Math.min(looseFood, 4) * 2;
  if (state.cook.held) rating += 3;
  if (state.cook.chopPose > 0) rating += 4;
  if (state.effects.some((effect) => effect.kind === 'dice')) rating += 2;
  if (openOrders(state).some((order) => order.remaining / order.patience < 0.5)) rating += 2;
  if (state.missed > 0) rating -= 4;
  return rating;
}

function rateRushMoment(state) {
  let rating = 0;
  if (state.banner && state.banner.t > 0.35 && state.banner.t < 1.6) rating += 40;
  rating += openOrders(state).length * 8 + state.queue.length * 6;
  rating += openOrders(state).filter((order) => order.remaining / order.patience < 0.3).length * 4;
  rating += state.stations.filter((station) => station.item).length * 2;
  return rating;
}

function rateComboMoment(state, events) {
  const served = events.find((event) => event.type === 'served');
  if (!served) return -Infinity;
  return served.combo * 10 + openOrders(state).length;
}

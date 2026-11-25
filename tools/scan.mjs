// Scan seeds and seconds for a frame that shows all six judged elements at once.
import { createWorld } from '/Users/shalmongggmeong/workspace/cook-game/game/src/world.js';
import { createChefPilot } from '/Users/shalmongggmeong/workspace/cook-game/game/src/autopilot.js';
import { STATION } from '/Users/shalmongggmeong/workspace/cook-game/game/src/kitchen.js';
import { matchRecipe, plateFitsRecipe, RECIPES } from '/Users/shalmongggmeong/workspace/cook-game/game/src/recipes.js';
import { STEP } from '/Users/shalmongggmeong/workspace/cook-game/game/src/config.js';

function audit(state) {
  const pass = state.stations.find(
    (s) => s.kind === STATION.pass && s.plate && s.plate.items.length > 0 && matchRecipe(s.plate.items),
  );
  let mid = null;
  for (const plate of state.plates) {
    if (plate.away > 0 || plate.items.length === 0) continue;
    if (matchRecipe(plate.items)) continue;
    if (!RECIPES.some((r) => plateFitsRecipe(plate.items, r))) continue;
    if (!mid || plate.items.length > mid.items.length) mid = plate;
  }
  const tickets = state.orders.filter((o) => o.status === 'open');
  const loose = state.stations.filter((s) => s.kind === STATION.counter && s.item);
  const pans = state.stations.filter((s) => s.kind === STATION.skillet && s.item && s.item.state !== 'burnt');
  return {
    pass: !!pass, passItems: pass ? pass.plate.items.length : 0,
    mid: !!mid, midItems: mid ? mid.items.length : 0,
    tickets: tickets.length, loose: loose.length, pans: pans.length,
    clock: state.clock, served: state.served, missed: state.missed,
    all: !!pass && !!mid && tickets.length >= 2 && loose.length >= 2 && pans.length >= 1,
  };
}

const rows = [];
for (let seed = 1; seed <= 60; seed += 1) {
  for (const day of [1, 2, 3]) {
    for (const hold of [9, 14, 20, 30]) {
      const world = createWorld(seed);
      world.reset(day);
      const steer = createChefPilot({ holdServe: hold, focus: 3 });
      const last = Math.round(160 / STEP);
      for (let step = 0; step < last && !world.state.over; step += 1) {
        world.step(STEP, steer(world.state, STEP));
        if (world.state.clock < 30) continue;
        const a = audit(world.state);
        if (!a.all) continue;
        rows.push({ seed, day, hold, t: +world.state.clock.toFixed(1), ...a });
      }
    }
  }
}

rows.sort((x, y) => {
  // prefer: more tickets, pan busy, 2-part mid plate, fewer missed, later clock (more action)
  const k = (r) => r.tickets * 3 + r.pans * 4 + (r.midItems === 2 ? 5 : 0) + r.loose - r.missed * 6;
  return k(y) - k(x);
});
console.log('frames with all six:', rows.length);
for (const r of rows.slice(0, 18)) {
  console.log(
    `seed ${r.seed} day ${r.day} hold ${r.hold} t=${r.t}s | tickets ${r.tickets} pans ${r.pans} mid ${r.midItems}/3 pass ${r.passItems} loose ${r.loose} served ${r.served} missed ${r.missed}`,
  );
}

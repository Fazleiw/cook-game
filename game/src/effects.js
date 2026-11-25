// The kitchen's juice, as plain data in the world state so a screenshot shows it: flying dice
// from the knife, the pop when a part lands on a plate, the streak of a served dish, score
// popups, smoke from a burning pan. The renderer draws them; this file only spawns and ages them.

const MAX_EFFECTS = 160;

function pushEffect(state, effect) {
  if (state.effects.length >= MAX_EFFECTS) state.effects.shift();
  state.effects.push(effect);
}

/** Five or six diced pieces flying off the board, in the ingredient's colour. */
export function spawnChopDice(state, x, y, colour) {
  const random = state.fxRandom;
  const count = 5 + Math.floor(random() * 2);
  for (let index = 0; index < count; index += 1) {
    const angle = -Math.PI * (0.15 + random() * 0.7);
    const speed = 90 + random() * 120;
    pushEffect(state, { kind: 'dice', x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, t: 0, life: 0.45 + random() * 0.2, colour, spin: random() * 6 });
  }
  pushEffect(state, { kind: 'slash', x, y, t: 0, life: 0.14 });
}

/** A ring and a burst of sparkles where a part snaps onto a plate. */
export function spawnPlatePop(state, x, y, colour) {
  pushEffect(state, { kind: 'ring', x, y, t: 0, life: 0.32, colour });
  for (let index = 0; index < 6; index += 1) {
    const angle = (index / 6) * Math.PI * 2 + state.fxRandom() * 0.4;
    pushEffect(state, { kind: 'spark', x, y, vx: Math.cos(angle) * 140, vy: Math.sin(angle) * 140, t: 0, life: 0.3, colour });
  }
}

/** Floating text: a score, a tip, a combo or a warning. */
export function spawnScorePopup(state, x, y, text, colour, size = 26) {
  pushEffect(state, { kind: 'popup', x, y, t: 0, life: 1.3, text, colour, size });
}

/** The served plate flying out of the hatch with speed lines behind it. */
export function spawnServeStreak(state, x, y, items, colour) {
  pushEffect(state, { kind: 'streak', x, y, t: 0, life: 0.7, items, colour });
}

export function spawnSmokePuff(state, x, y, dark) {
  const random = state.fxRandom;
  pushEffect(state, { kind: 'smoke', x: x + (random() - 0.5) * 18, y, vx: (random() - 0.5) * 20, vy: -40 - random() * 25, t: 0, life: 1.1, dark });
}

/** Move and fade every live effect by dt seconds; drop the finished ones. */
export function ageEffects(state, dt) {
  let write = 0;
  for (const effect of state.effects) {
    effect.t += dt;
    if (effect.t >= effect.life) continue;
    if (effect.vx !== undefined) {
      effect.x += effect.vx * dt;
      effect.y += effect.vy * dt;
      if (effect.kind === 'dice') effect.vy += 520 * dt;
      if (effect.kind === 'spark') {
        effect.vx *= 0.9;
        effect.vy *= 0.9;
      }
    }
    state.effects[write] = effect;
    write += 1;
  }
  state.effects.length = write;
}

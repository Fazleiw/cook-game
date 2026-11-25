// Keyboard and mouse into the cook's controls: a walk direction (WASD / arrows), E held (to keep
// chopping), and intents the world acts on in the same tick — use, serve, go to plate N, and a
// click on a station (walk there and use it) or on the floor (walk there).
import { KITCHEN_GRID } from './config.js';
import { stationAt, tileAt } from './kitchen.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;

const DIRECTION_KEYS = {
  KeyW: [0, -1],
  ArrowUp: [0, -1],
  KeyS: [0, 1],
  ArrowDown: [0, 1],
  KeyA: [-1, 0],
  ArrowLeft: [-1, 0],
  KeyD: [1, 0],
  ArrowRight: [1, 0],
};

export function createInput(canvas, renderer, getState, onFirstGesture) {
  const held = new Set();
  let intents = [];
  let actions = 0;

  window.addEventListener('keydown', (event) => {
    onFirstGesture();
    const code = event.code;
    if (DIRECTION_KEYS[code] || code === 'Space') event.preventDefault();
    if (event.repeat && code !== 'KeyE') return;
    held.add(code);
    if (code === 'KeyE' && !event.repeat) intents.push({ type: 'use' });
    else if (code === 'Space') intents.push({ type: 'serve' });
    else if (code >= 'Digit1' && code <= 'Digit3') intents.push({ type: 'plate', number: Number(code.slice(5)) });
    else if (code === 'Enter') actions |= ACTION_CONFIRM;
    else if (code === 'KeyP' || code === 'Escape') actions |= ACTION_PAUSE;
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => held.clear());

  canvas.addEventListener('pointerdown', (event) => {
    onFirstGesture();
    actions |= ACTION_CONFIRM;
    const point = renderer.toField(event.clientX, event.clientY);
    const state = getState();
    const tile = tileAt(point.x, point.y);
    if (tile.col < 0 || tile.row < 0 || tile.col >= KITCHEN_GRID.cols || tile.row >= KITCHEN_GRID.rows) return;
    const station = stationAt(state.grid, tile.col, tile.row);
    intents.push(station ? { type: 'goUse', stationId: station.id } : { type: 'goTo', col: tile.col, row: tile.row });
  });

  return {
    /** This frame's controls; intents are handed over once. */
    takeControls() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const direction = DIRECTION_KEYS[code];
        if (direction) {
          x += direction[0];
          y += direction[1];
        }
      }
      const controls = { direction: { x: Math.sign(x), y: Math.sign(y) }, useHeld: held.has('KeyE'), intents };
      intents = [];
      return controls;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    dropIntents() {
      intents = [];
    },
  };
}

// Boot and the one loop for Marigold Galley: controls are read every frame, the shift advances in
// fixed 1/60 s steps, and the renderer paints what is there. Screens: title (the chef autopilot
// cooks behind the card), play, paused, and the end-of-shift card that leads to the next day.
//
// ?seed=N fixes the order stream. ?shot=cover|rush|combo|result (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { createWorld, NO_CONTROLS, timeLeft } from './world.js';
import { createChefPilot } from './autopilot.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createKitchenAudio } from './audio.js';
import { stageShot } from './shots.js';
import { BEST_KEY, STEP } from './config.js';
import { RECIPE_BY_ID } from './recipes.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 100000);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(seed);
const renderer = createRenderer(canvas);

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  // A screenshot is always the full 1280x720 field at 1:1, whatever the headless viewport says.
  Object.assign(canvas.style, { width: '1280px', height: '720px', inset: 'auto', left: '0', top: '0' });
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.paintFrame(world.state, scene.screen, scene.view);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const audio = createKitchenAudio();
  const input = createInput(canvas, renderer, () => world.state, () => audio.unlock());
  let screen = SCREEN_TITLE;
  let best = readBest();
  let attract = createChefPilot({ holdServe: 1 });
  let accumulator = 0;
  let last = performance.now();
  let lastWholeSecond = Infinity;

  function announce(message) {
    status.textContent = message;
  }

  function startShift(day) {
    world.reset(day);
    accumulator = 0;
    screen = SCREEN_PLAY;
    input.dropIntents();
    announce(`Day ${day}. The hatch is open. Tickets are coming.`);
  }

  function endShift() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`Shift over. ${world.state.served} dishes served, score ${world.state.score}. Press Enter for day ${world.state.day + 1}.`);
  }

  function readScreenActions() {
    const actions = input.takeActions();
    if (actions & ACTION_CONFIRM && screen === SCREEN_TITLE) startShift(1);
    else if (actions & ACTION_CONFIRM && screen === SCREEN_OVER) startShift(world.state.day + 1);
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Back on the line.');
    }
  }

  function stepShift() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, attract(world.state, STEP));
      if (world.state.over) {
        world.reset(1);
        attract = createChefPilot({ holdServe: 1 });
      }
      return;
    }
    const controls = input.takeControls();
    const events = world.step(STEP, controls);
    audio.playEvents(events);
    for (const event of events) {
      if (event.type === 'served') announce(`Served ticket ${event.order}. +${event.points}. Combo ${event.combo}.`);
      else if (event.type === 'missed') announce(`Ticket ${event.order} missed.`);
      else if (event.type === 'rush') announce('Dinner rush!');
      else if (event.type === 'ticket') {
        const order = world.state.orders.find((candidate) => candidate.id === event.order);
        if (order) announce(`New ticket: ${RECIPE_BY_ID[order.recipeId].name}.`);
      }
    }
    const whole = Math.ceil(timeLeft(world.state));
    if (whole < lastWholeSecond && whole <= 10 && whole > 0) audio.playTick();
    lastWholeSecond = whole;
    if (world.state.over) endShift();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    readScreenActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        stepShift();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
      input.takeControls();
      world.step(0, NO_CONTROLS);
    }
    renderer.paintFrame(world.state, screen, { best });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Marigold Galley. Press Enter or click to open the hatch.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

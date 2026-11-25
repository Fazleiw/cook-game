// Marigold Galley — hand-in program (Node 22, standard library only).
//
// The game is game/: plain static files a desktop browser loads with no network request
// (game/index.html and its ES modules, no library, no build step). This program copies game/
// and screenshots/ beside it to the output directory and writes dossier.json there with the
// vendored make.fun library — the dossier is what the judge reads: a contact sheet of the
// screenshots plus an outline of the game's own source.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

/** The scorer's own caps, from reference/gate.json: a hand-in over these is refused outright. */
const LIMITS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

/**
 * Refuse the hand-in before the scorer does when screenshots/ is wrong: the gate wants 3 or 4
 * images, each within its byte cap, and a name the gate accepts. A run that would be refused is
 * cheaper to fail here than to discover it after an upload.
 */
function checkScreenshots(dir) {
  if (!existsSync(dir)) throw new Error('screenshots/ is missing: the judge reads it first');
  const names = readdirSync(dir)
    .filter((name) => !name.startsWith('.'))
    .filter((name) => /^[A-Za-z0-9._-]{1,128}$/.test(name) && !name.startsWith('-'))
    .sort();
  if (names.length < 3 || names.length > LIMITS.screenshots.max) {
    throw new Error(`screenshots/ holds ${names.length} images: the gate wants 3 or 4`);
  }
  for (const name of names) {
    const bytes = statSync(join(dir, name)).size;
    if (bytes > LIMITS.screenshots.max_bytes) {
      throw new Error(`screenshots/${name} is ${bytes} bytes, over the ${LIMITS.screenshots.max_bytes} the gate allows`);
    }
  }
  return names;
}

/**
 * Walk game/ once to report what is being handed in: the file count and total bytes the gate caps
 * at 993 and 48 MiB, and the widest path it caps at 1,000 UTF-8 bytes.
 */
function measureGame(dir) {
  let files = 0;
  let bytes = 0;
  let widest = 0;
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      const rel = full.slice(dir.length + 1);
      widest = Math.max(widest, Buffer.byteLength(rel, 'utf8'));
      if (entry.isDirectory()) walk(full);
      else {
        files += 1;
        bytes += statSync(full).size;
      }
    }
  };
  walk(dir);
  if (files > LIMITS.game_max_files) throw new Error(`game/ holds ${files} files, over the gate's ${LIMITS.game_max_files}`);
  if (bytes > LIMITS.game_max_bytes) throw new Error(`game/ is ${bytes} bytes, over the gate's ${LIMITS.game_max_bytes}`);
  if (widest > LIMITS.game_path_max_bytes) throw new Error(`a game/ path is ${widest} bytes, over the gate's ${LIMITS.game_path_max_bytes}`);
  return { files, bytes };
}

const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
if (!existsSync(join(gameDir, 'index.html'))) throw new Error('game/index.html is missing: nothing would open');

const shots = checkScreenshots(shotsDir);
const game = measureGame(gameDir);

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

writeFileSync(join(out, 'dossier.json'), buildDossier(out, LIMITS));

console.log(`handed in game/ (${game.files} files, ${game.bytes} bytes) and ${shots.length} screenshots: ${shots.join(', ')}`);

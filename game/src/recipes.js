// The Marigold Galley menu: six plates built from one shared pantry of eight ingredients, so the
// same diced tomato can finish a flatbread, a salad or a fish rice. A plate is a list of parts
// ({ kind, state }); it becomes a dish the moment its parts are exactly one recipe's.
import { partKey } from './ingredients.js';

export const RECIPES = [
  {
    id: 'flatbread',
    name: 'Dockside Flatbread',
    parts: [['flatbread', 'raw'], ['tomato', 'chopped'], ['cheese', 'chopped']],
    unlockAt: 0,
    colour: '#e2552c',
  },
  {
    id: 'sunrise',
    name: 'Sunrise Rice Bowl',
    parts: [['rice', 'cooked'], ['egg', 'cooked'], ['onion', 'chopped']],
    unlockAt: 0,
    colour: '#f29b0c',
  },
  {
    id: 'salad',
    name: 'Deckhand Salad',
    parts: [['greens', 'chopped'], ['tomato', 'chopped'], ['onion', 'chopped']],
    unlockAt: 0,
    colour: '#3c9a37',
  },
  {
    id: 'wrap',
    name: 'Lantern Fish Wrap',
    parts: [['flatbread', 'raw'], ['fish', 'cooked'], ['greens', 'chopped']],
    unlockAt: 0.18,
    colour: '#2a8fb0',
  },
  {
    id: 'fishrice',
    name: 'Marigold Fish Rice',
    parts: [['rice', 'cooked'], ['fish', 'cooked'], ['tomato', 'chopped']],
    unlockAt: 0.38,
    colour: '#c7366f',
  },
  {
    id: 'melt',
    name: "Ferryman's Melt",
    parts: [['flatbread', 'raw'], ['egg', 'cooked'], ['cheese', 'chopped'], ['onion', 'cooked']],
    unlockAt: 0.58,
    colour: '#7a3fb0',
  },
];

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((recipe) => [recipe.id, recipe]));

const RECIPE_KEYS = new Map(RECIPES.map((recipe) => [recipe.id, new Set(recipe.parts.map(([kind, state]) => partKey(kind, state)))]));

function keysOf(items) {
  return items.map((item) => partKey(item.kind, item.state));
}

/** The recipe these plate parts are exactly, or null while the plate is unfinished or wrong. */
export function matchRecipe(items) {
  const keys = keysOf(items);
  for (const recipe of RECIPES) {
    const wanted = RECIPE_KEYS.get(recipe.id);
    if (wanted.size === keys.length && keys.every((key) => wanted.has(key))) return recipe;
  }
  return null;
}

/** True when every part on the plate belongs to this recipe (so the plate is on its way to it). */
export function plateFitsRecipe(items, recipe) {
  const wanted = RECIPE_KEYS.get(recipe.id);
  const seen = new Set();
  for (const key of keysOf(items)) {
    if (!wanted.has(key) || seen.has(key)) return false;
    seen.add(key);
  }
  return true;
}

/** True when adding `food` to the plate still leaves a path to at least one recipe on the menu. */
export function plateAccepts(items, food) {
  if (food.type !== 'food') return false;
  const next = items.concat([food]);
  return RECIPES.some((recipe) => plateFitsRecipe(next, recipe));
}

/** The recipe's parts the plate does not hold yet. */
export function missingParts(items, recipe) {
  const have = new Set(keysOf(items));
  return recipe.parts.filter(([kind, state]) => !have.has(partKey(kind, state)));
}

/** The recipes on the menu once this share of the shift has gone by. */
export function unlockedRecipes(shiftShare, day) {
  const head = Math.min(0.5, (day - 1) * 0.2);
  return RECIPES.filter((recipe) => recipe.unlockAt <= shiftShare + head);
}

// The pantry: every raw ingredient, what the chopping board and the stoves turn it into, and the
// one food object the whole game passes around ({ type: 'food', kind, state, chops, heat }).
// A food's state only ever moves forward: raw -> chopped -> cooked -> burnt.

export const INGREDIENTS = {
  tomato: { label: 'Tomato', chopHits: 4, cookOn: null, colour: '#e63a2e' },
  onion: { label: 'Onion', chopHits: 4, cookOn: 'skillet', cookFrom: 'chopped', colour: '#9b3f86' },
  greens: { label: 'Greens', chopHits: 3, cookOn: null, colour: '#4caf3d' },
  cheese: { label: 'Cheese', chopHits: 3, cookOn: null, colour: '#ffcb2e' },
  egg: { label: 'Egg', chopHits: 0, cookOn: 'skillet', cookFrom: 'raw', colour: '#fff3d6' },
  fish: { label: 'River fish', chopHits: 5, cookOn: 'skillet', cookFrom: 'chopped', colour: '#6fa7c9' },
  flatbread: { label: 'Flatbread', chopHits: 0, cookOn: null, colour: '#e3b46b' },
  rice: { label: 'Rice', chopHits: 0, cookOn: 'pot', cookFrom: 'raw', colour: '#f6f1e6' },
};

/** What a prepared part is called on a ticket or in the cookbook. */
export const PART_NAMES = {
  'tomato:chopped': 'diced tomato',
  'onion:chopped': 'onion rings',
  'onion:cooked': 'jammy onion',
  'greens:chopped': 'shredded greens',
  'cheese:chopped': 'grated cheese',
  'egg:cooked': 'fried egg',
  'fish:cooked': 'seared fish',
  'flatbread:raw': 'flatbread',
  'rice:cooked': 'steamed rice',
};

const STATE_ORDER = { raw: 0, chopped: 1, cooked: 2, burnt: 3 };

export function createFood(kind) {
  return { type: 'food', kind, state: 'raw', chops: 0, heat: 0 };
}

/** True when a chopping board has work to do on this food. */
export function canChop(food) {
  return food.type === 'food' && food.state === 'raw' && INGREDIENTS[food.kind].chopHits > 0;
}

/** One knife stroke; returns true on the stroke that finishes the chop. */
export function chopOnce(food) {
  food.chops += 1;
  if (food.chops >= INGREDIENTS[food.kind].chopHits) {
    food.state = 'chopped';
    return true;
  }
  return false;
}

/** True when this stove kind ('skillet' or 'pot') cooks this food as it is now. */
export function stoveAccepts(stoveKind, food) {
  const info = INGREDIENTS[food.kind];
  return food.type === 'food' && info.cookOn === stoveKind && food.state === info.cookFrom;
}

/** True when food in this state can still be turned into `target` by the kitchen's stations. */
export function canBecome(food, target) {
  if (food.state === 'burnt') return false;
  if (food.state === target) return true;
  const info = INGREDIENTS[food.kind];
  if (STATE_ORDER[food.state] > STATE_ORDER[target]) return false;
  if (target === 'chopped') return info.chopHits > 0;
  if (target === 'cooked') {
    if (info.cookFrom === 'raw') return food.state === 'raw';
    return info.cookFrom === 'chopped' && (food.state === 'chopped' || info.chopHits > 0);
  }
  return false;
}

/** The station kind that moves this food one step closer to `target`, or null when it is there. */
export function nextProcess(food, target) {
  if (food.state === target) return null;
  if (food.state === 'raw' && INGREDIENTS[food.kind].chopHits > 0) return 'board';
  return INGREDIENTS[food.kind].cookOn;
}

export function partKey(kind, state) {
  return `${kind}:${state}`;
}

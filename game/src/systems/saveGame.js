// Save and load to localStorage: progress, money, respect, weapons and ammo, armour, owned
// cars, wild orchids found and where the player stood, plus a summary (rank, completion) the
// title screen's save card reads. Every read and write is guarded so a blocked storage never
// breaks the game.
import { SAVE_KEY } from '../config.js';

export function hasSave() {
  try { return !!localStorage.getItem(SAVE_KEY); } catch { return false; }
}

export function readSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/** Snapshot the game into storage; returns true on success. */
export function writeSave(game) {
  const p = game.progress;
  const player = game.player;
  const ammo = {};
  for (const [k, v] of Object.entries(player.ammo)) if (k !== 'fists') ammo[k] = v;
  const data = {
    version: 1,
    savedAt: new Date().toISOString(),
    money: p.money,
    respect: p.respect,
    story: p.story,
    raceBest: p.raceBest,
    deliveriesDone: p.deliveriesDone,
    ownedCars: p.ownedCars,
    orchids: p.orchids,
    exported: p.exported,
    rank: p.rank.title,
    completion: p.completion(),
    stats: p.stats,
    ammo,
    weapon: player.weapon,
    armor: player.armor,
    health: player.health,
    pos: { x: player.pos.x, z: player.pos.z, heading: player.heading },
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

/** Apply a save object to a freshly reset game. */
export function applySave(game, data) {
  const p = game.progress;
  p.money = data.money ?? 300;
  p.respect = data.respect ?? 0;
  p.story = data.story ?? 0;
  p.raceBest = data.raceBest ?? null;
  p.deliveriesDone = data.deliveriesDone ?? 0;
  p.ownedCars = data.ownedCars ?? [];
  p.orchids = Array.isArray(data.orchids) ? data.orchids.filter((i) => Number.isInteger(i)) : [];
  p.exported = Array.isArray(data.exported) ? data.exported.filter((t) => typeof t === 'string') : [];
  Object.assign(p.stats, data.stats ?? {});
  const player = game.player;
  player.ammo = { fists: Infinity, ...(data.ammo ?? {}) };
  player.weapon = player.ammo[data.weapon] > 0 ? data.weapon : 'fists';
  player.armor = data.armor ?? 0;
  player.health = Math.max(40, data.health ?? 100);
  if (data.pos) player.placeAt(data.pos.x, data.pos.z, data.pos.heading ?? 0);
}

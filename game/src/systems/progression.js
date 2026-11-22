// Money, respect and the street-rank titles respect earns, plus the career stats shown in the
// pause menu. Respect unlocks better guns at Gulfside Arms and faster cars at Tiko's.
import { emit } from '../core/eventBus.js';

export const RANKS = [
  { respect: 0, title: 'Fresh Out' },
  { respect: 10, title: 'Street Name' },
  { respect: 25, title: 'Known Face' },
  { respect: 45, title: 'Island Fixer' },
  { respect: 70, title: 'Keys Legend' },
];

export class Progression {
  constructor() {
    this.reset();
  }

  reset() {
    this.money = 300;
    this.respect = 0;
    this.story = 0;              // index of the next story mission
    this.raceBest = null;
    this.deliveriesDone = 0;
    this.ownedCars = [];
    this.orchids = [];           // indices of the wild orchids found
    this.exported = [];          // car types shipped off Tiko's export list
    this.stats = { carsStolen: 0, kills: 0, copsEvaded: 0, missionsPassed: 0, racesWon: 0, distanceDriven: 0 };
  }

  /**
   * Share of the game done, 0-100: the story weighs most, then the orchids, Tiko's export
   * list, races won, courier shifts and the cars in your garage.
   */
  completion(storyCount = 7, orchidCount = 24, exportCount = 6) {
    const part = (n, of) => Math.min(1, n / of);
    const pct = 55 * part(this.story, storyCount) + 18 * part(this.orchids.length, orchidCount) + 9 * part(this.exported.length, exportCount)
      + 7 * part(this.stats.racesWon, 3) + 6 * part(this.deliveriesDone, 5) + 5 * part(this.ownedCars.length, 3);
    return Math.floor(pct);
  }

  get rank() {
    let r = RANKS[0];
    for (const k of RANKS) if (this.respect >= k.respect) r = k;
    return r;
  }

  get nextRank() { return RANKS.find((k) => k.respect > this.respect) ?? null; }

  addMoney(amount, reason = '') {
    this.money = Math.max(0, this.money + amount);
    emit('moneyChanged', { amount, reason, total: this.money });
  }

  spend(amount) {
    if (this.money < amount) return false;
    this.addMoney(-amount);
    return true;
  }

  addRespect(amount) {
    const before = this.rank.title;
    this.respect += amount;
    emit('respectChanged', { amount, total: this.respect });
    if (this.rank.title !== before) emit('rankUp', { title: this.rank.title });
  }
}

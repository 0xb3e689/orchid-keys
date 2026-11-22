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
    this.stats = { carsStolen: 0, kills: 0, copsEvaded: 0, missionsPassed: 0, racesWon: 0, distanceDriven: 0 };
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

// The 5-star wanted level. Crimes add heat; heat thresholds give stars; while no OKPD unit can
// see the player an evasion timer runs, and when it fills the heat drops to nothing. Missions
// can force a minimum level (an alarm, an ambush).
import { POLICE } from '../config.js';
import { emit, on } from '../core/eventBus.js';

const THRESHOLDS = [0, 8, 45, 100, 170, 260];
const MAX_HEAT = 320;

/** How much heat each crime is worth, and the least stars it brings. */
export const CRIMES = {
  carjack: { heat: 9, min: 1 },
  gunfire: { heat: 4, min: 1 },
  assault: { heat: 6, min: 1 },
  hitPedestrian: { heat: 12, min: 1 },
  murder: { heat: 30, min: 2 },
  assaultCop: { heat: 30, min: 2 },
  copKilled: { heat: 55, min: 3 },
  policeCarDamaged: { heat: 14, min: 2 },
  explosion: { heat: 25, min: 2 },
  theftAlarm: { heat: 50, min: 2 },
};

export class WantedSystem {
  constructor() {
    this.heat = 0;
    this.stars = 0;
    this.evadeTimer = 0;
    this.seen = false;
    this.minStars = 0;
    this.locked = false;
    on('crime', (e) => this.report(e.type, e.witnessed ?? true));
  }

  starsForHeat(h) {
    let s = 0;
    for (let i = 1; i < THRESHOLDS.length; i++) if (h >= THRESHOLDS[i]) s = i;
    return s;
  }

  report(type, witnessed = true) {
    const c = CRIMES[type];
    if (!c || !witnessed) return;
    const before = this.stars;
    this.heat = Math.min(MAX_HEAT, Math.max(this.heat + c.heat * (1 + this.stars * 0.15), THRESHOLDS[c.min]));
    this.evadeTimer = 0;
    this.refresh(before);
  }

  /** Force at least `stars` (mission alarms, ambushes). */
  setAtLeast(stars) {
    const before = this.stars;
    this.heat = Math.max(this.heat, THRESHOLDS[stars] + 1);
    this.evadeTimer = 0;
    this.refresh(before);
  }

  clear() {
    const before = this.stars;
    this.heat = 0;
    this.stars = 0;
    this.evadeTimer = 0;
    if (before > 0) emit('wantedCleared', {});
  }

  refresh(before) {
    this.stars = Math.max(this.minStars, this.starsForHeat(this.heat));
    if (before === 0) this.peakStars = 0;
    this.peakStars = Math.max(this.peakStars ?? 0, this.stars);
    if (this.stars > before) emit('wantedUp', { stars: this.stars });
  }

  /** True while the stars blink: police have lost sight and the evasion timer is running. */
  get evading() { return this.stars > 0 && !this.seen; }

  get evadeProgress() { return this.stars ? this.evadeTimer / POLICE.evadeSeconds[this.stars] : 0; }

  update(dt, seenByPolice) {
    this.seen = seenByPolice;
    if (this.stars === 0) return;
    if (seenByPolice) {
      this.evadeTimer = Math.max(0, this.evadeTimer - dt * 2);
      return;
    }
    if (this.minStars >= this.stars) return;
    this.evadeTimer += dt;
    if (this.evadeTimer >= POLICE.evadeSeconds[this.stars]) {
      this.clear();
      emit('wantedEvaded', {});
    }
  }
}

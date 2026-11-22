// Runs one job at a time (a story mission, a street race or a courier run): shows giver
// markers for whatever is available next, steps through the active job's objectives with
// their timers, fails it when Dez dies, is busted or loses a vital car, pays out rewards and
// cleans up its markers, crews and cars.
import { emit, on } from '../core/eventBus.js';
import { formatMoney } from '../core/mathUtils.js';
import { LANDMARKS } from '../world/cityPlan.js';
import { CAST } from './cast.js';
import { STORY_MISSIONS } from './storyMissions.js';

const GIVER_COLORS = { safehouse: 0x7cf29a, garage: 0xffd23f, club: 0xc084fc, saltOrchid: 0xffb36b };
const GIVER_WHO = { safehouse: 'ro', garage: 'tiko', club: 'val', saltOrchid: 'ro' };

export class MissionRunner {
  constructor(game) {
    this.game = game;
    this.active = null;
    this.activities = [];       // { id, landmark, label, color, create(game), needsVehicle }
    this.cooldown = 0;
    on('wasted', () => this.fail('You were wasted.'));
    on('busted', () => this.fail('You were busted.'));
  }

  registerActivity(a) { this.activities.push(a); }

  get nextStory() { return STORY_MISSIONS[this.game.progress.story] ?? null; }

  get objective() {
    if (!this.active) return null;
    return this.active.text;
  }

  get timeLeft() { return this.active && this.active.step && this.active.step.timeLimit ? Math.max(0, this.active.timer) : null; }

  /** Giver rings for the next story mission and every activity, shown when no job runs. */
  refreshGivers() {
    const m = this.game.markers;
    m.clear('giver-');
    if (this.active) return;
    const next = this.nextStory;
    if (next && next.giver) {
      const lm = LANDMARKS[next.giver];
      m.add('giver-story', { x: lm.x, z: lm.z, color: GIVER_COLORS[next.giver], radius: 2.2, label: next.title.toUpperCase() });
    }
    for (const a of this.activities) {
      const lm = LANDMARKS[a.landmark];
      m.add('giver-' + a.id, { x: lm.x, z: lm.z, color: a.color, radius: a.needsVehicle ? 4.5 : 2.2, label: a.label });
    }
  }

  /** Where the next story beat is, for the minimap. */
  storyGiverSpot() {
    const next = this.nextStory;
    if (this.active || !next || !next.giver) return null;
    const lm = LANDMARKS[next.giver];
    return { x: lm.x, z: lm.z, who: CAST[GIVER_WHO[next.giver]]?.name };
  }

  start(def) {
    if (this.active) return;
    this.game.markers.clear('giver-');
    this.giversShown = false;
    this.active = { def, index: -1, step: null, state: {}, timer: 0, text: '', vehicles: [] };
    emit('missionStarted', { title: def.title });
    this.game.hud.banner(def.title.toUpperCase(), def.story ? 'Story mission' : def.subtitle ?? '', '#ffd23f');
    this.advance();
  }

  advance() {
    const a = this.active;
    if (a.step && a.step.exit) a.step.exit(this.ctx());
    a.index++;
    if (a.index >= a.def.steps.length) { this.pass(); return; }
    a.step = a.def.steps[a.index];
    a.state = { ...a.state, wait: 0 };
    a.timer = a.step.timeLimit ?? 0;
    if (a.step.text) a.text = a.step.text;
    if (a.step.enter) a.step.enter(this.ctx());
  }

  ctx() { return { game: this.game, state: this.active.state, mission: this.active }; }

  pass() {
    const a = this.active;
    const r = a.def.reward ?? {};
    const p = this.game.progress;
    if (r.money) p.addMoney(r.money, a.def.title);
    if (r.respect) p.addRespect(r.respect);
    if (r.car) p.ownedCars.push({ type: r.car, color: 0xff70a6 });
    if (a.def.story) { p.story++; p.stats.missionsPassed++; }
    if (a.def.onPass) a.def.onPass(this.game);
    this.cleanup();
    const sub = [r.money ? formatMoney(r.money) : null, r.respect ? `+${r.respect} respect` : null].filter(Boolean).join('   ');
    this.game.hud.banner('MISSION PASSED', sub, '#ffd23f', 4.5);
    emit('missionPassed', { title: a.def.title, story: !!a.def.story });
    if (a.def.story && !this.nextStory) emit('storyComplete', {});
    this.game.autosave();
  }

  fail(reason) {
    if (!this.active) return;
    const a = this.active;
    this.cleanup();
    this.game.hud.banner('MISSION FAILED', reason, '#ff4d4d', 4.5);
    emit('missionFailed', { title: a.def.title, reason });
  }

  cleanup() {
    const a = this.active;
    if (!a) return;
    if (a.step && a.step.exit) a.step.exit(this.ctx());
    this.game.markers.clear('step-');
    this.game.markers.clear('race-');
    this.game.gangs.clearAll();
    for (const v of a.vehicles) {
      v.tags.delete('mission');
      if (v.driver !== 'player' && !v.removed && !v.owned) this.game.vehicles.remove(v);
    }
    this.game.dialog.clear();
    this.game.setObjectiveTarget(null);
    if (a.def.onEnd) a.def.onEnd(this.game);
    this.active = null;
    this.cooldown = 3;
  }

  update(dt) {
    const game = this.game;
    const player = game.player;
    if (!this.active) {
      this.cooldown -= dt;
      if (this.cooldown > 0 || player.dead) return;
      if (!this.giversShown) {
        this.refreshGivers();
        this.giversShown = true;
        // a ring you are already standing in only fires after you step out and back in
        this.insideGivers = new Set([...game.markers.items.keys()].filter((id) => id.startsWith('giver-') && game.markers.inside(id, player.pos.x, player.pos.z, 0.5)));
      }
      const entered = (id) => {
        const inside = game.markers.inside(id, player.pos.x, player.pos.z, 0.5);
        const was = this.insideGivers.has(id);
        if (inside) this.insideGivers.add(id);
        else this.insideGivers.delete(id);
        return inside && !was;
      };
      const next = this.nextStory;
      if (next && next.giver && entered('giver-story')) {
        if (game.wanted.stars > 0) game.hud.hint('Lose the cops before starting a mission.');
        else this.start({ ...next, story: true });
        return;
      }
      for (const act of this.activities) {
        if (!entered('giver-' + act.id)) continue;
        if (act.needsVehicle && !player.vehicle) { game.hud.hint(`${act.label}: arrive in a vehicle to start.`); continue; }
        if (game.wanted.stars > 0) { game.hud.hint('Lose the cops before starting a job.'); continue; }
        this.start(act.create(game));
        return;
      }
      return;
    }
    const a = this.active;
    for (const v of a.vehicles) {
      if (v.mustSurvive && v.destroyed) { this.fail(`The ${v.type.name} was destroyed.`); return; }
    }
    const s = a.step;
    if (s.timeLimit) {
      a.timer -= dt;
      if (a.timer <= 0) {
        if (s.survive) { this.advance(); return; }
        this.fail('Out of time.');
        return;
      }
    }
    const r = s.update ? s.update(this.ctx(), dt) : 'done';
    if (!this.active) return;
    if (r === 'done') this.advance();
    else if (typeof r === 'string') this.fail(r);
  }

  /** Begin the first story mission (new game). */
  startStory() {
    const next = this.nextStory;
    if (next && !next.giver) this.start({ ...next, story: true });
  }
}

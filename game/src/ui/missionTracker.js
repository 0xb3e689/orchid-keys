// The mission tracker in the HUD's top-left corner. During a job: what kind of job it is
// (story chapter, race, side job), its title, a segment per objective filling as you go, a live
// readout for the current step (distance to the marker, hostiles left, target damage, wanted
// stars, time left) and what it pays. In free roam: Salt & Neon's chapter progress, who gives
// the next mission and how far away, wild orchids found and the completion percentage.
import { formatMoney } from '../core/mathUtils.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { RACE_CHECKPOINTS } from '../missions/streetRace.js';
import { VEHICLE_TYPES } from '../entities/vehicleModels.js';
import { LANDMARKS } from '../world/cityPlan.js';
import { ORCHID_COUNT } from '../systems/orchidHunt.js';
import { EXPORT_LIST } from '../systems/shops.js';

const STAR = '★';

function distanceTo(game, p) {
  if (!p) return null;
  return Math.round(Math.hypot(p.x - game.player.pos.x, p.z - game.player.pos.z));
}

const metres = (d) => (d === null ? '' : d >= 1000 ? `${(d / 1000).toFixed(1)} km` : `${d} m`);
const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

function segments(total, done, current) {
  let out = '';
  for (let i = 0; i < total; i++) out += `<i class="${i < done ? 'done' : i === current ? 'now' : ''}"></i>`;
  return `<div class="trk-bar">${out}</div>`;
}

/** A one-line live readout for the step being played. */
function stepStatus(game, a) {
  const s = a.step;
  const st = a.state;
  const stars = game.wanted.stars;
  const heat = stars > 0 ? `<span class="trk-stars">${STAR.repeat(stars)}</span> ` : '';
  switch (s.kind) {
    case 'goto': {
      const d = metres(distanceTo(game, st.target));
      const where = s.label ? titleCase(s.label) : 'Marker';
      if (s.noHeat && stars > 0) return `${heat}Lose the cops, then <b>${where}</b> · ${d}`;
      return `${heat}<b>${where}</b> · ${d}`;
    }
    case 'enter': return `Target car · ${metres(distanceTo(game, game.objectiveTarget))}`;
    case 'getcar': return 'Any car will do: walk up and press <kbd>F</kbd>';
    case 'eliminate': return `<b>${st.counter ?? 0}</b> of ${st.total ?? 0} hostiles left`;
    case 'destroy': return `Target damage <b>${Math.round((1 - (st.health ?? 1)) * 100)}%</b> · ${metres(distanceTo(game, game.objectiveTarget))}`;
    case 'pickup': return `Pick it up · ${metres(distanceTo(game, st.pick))}`;
    case 'lose': return `${heat}${game.wanted.evading ? 'Out of sight: stay hidden' : 'Break line of sight with OKPD'}`;
    case 'race': return st.countdown > 0 ? 'Get ready...' : `Checkpoint <b>${Math.min(st.cp + 1, RACE_CHECKPOINTS.length)}</b>/${RACE_CHECKPOINTS.length} · ${metres(distanceTo(game, game.objectiveTarget))}`;
    case 'survive': return `${heat}Stay alive`;
    default: return a.step.text ? '' : '<em>Listen in...</em>';
  }
}

function titleCase(label) {
  return label.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}

function rewardLine(def) {
  const r = def.reward ?? {};
  const parts = [];
  if (r.money) parts.push(formatMoney(r.money));
  if (r.respect) parts.push(`+${r.respect} respect`);
  if (r.car) parts.push(VEHICLE_TYPES[r.car]?.name ?? r.car);
  if (def.id === 'race') parts.push('up to $1,500');
  return parts.length ? `Pays ${parts.join(' · ')}` : '';
}

export class MissionTracker {
  constructor(root) {
    this.root = root;
    this.last = '';
  }

  update(game) {
    const html = game.missions.active ? this.missionHtml(game, game.missions.active) : this.freeRoamHtml(game);
    if (html !== this.last) {
      this.root.innerHTML = html;
      this.last = html;
    }
  }

  missionHtml(game, a) {
    const def = a.def;
    const chip = def.story ? `Story ${game.progress.story + 1}/${STORY_MISSIONS.length}`
      : def.id === 'race' ? 'Street race' : 'Side job';
    const objectives = def.steps.map((s, i) => (s.text ? i : -1)).filter((i) => i >= 0);
    const done = objectives.filter((i) => i < a.index).length;
    const current = a.step && a.step.text ? done : -1;
    const timer = game.missions.timeLeft;
    const status = stepStatus(game, a) + (timer !== null ? ` · <span class="trk-time">${clock(timer)}</span>` : '');
    const reward = rewardLine(def);
    return `<div class="trk-head"><span class="trk-chip">${chip}</span><b>${def.title}</b></div>`
      + segments(objectives.length, done, current)
      + `<div class="trk-line">${status}</div>`
      + (reward ? `<div class="trk-sub">${reward}</div>` : '');
  }

  freeRoamHtml(game) {
    const p = game.progress;
    const next = game.missions.nextStory;
    const giver = game.missions.storyGiverSpot();
    let line;
    if (game.wanted.stars > 0) line = `<span class="trk-stars">${STAR.repeat(game.wanted.stars)}</span> Lose OKPD before taking a job`;
    else if (next && giver) {
      const place = LANDMARKS[next.giver].name;
      const who = place.startsWith(giver.who) ? place : `${giver.who}, ${place}`;
      line = `Next: <b>${next.title}</b> · ${who} · ${metres(distanceTo(game, giver))}`;
    }
    else if (!next) line = 'Story complete: the island is yours';
    else line = `Next: <b>${next.title}</b>`;
    return `<div class="trk-head"><span class="trk-chip">Salt &amp; Neon</span><b>Chapter ${Math.min(p.story + 1, STORY_MISSIONS.length)} of ${STORY_MISSIONS.length}</b></div>`
      + segments(STORY_MISSIONS.length, p.story, next ? p.story : -1)
      + `<div class="trk-line">${line}</div>`
      + `<div class="trk-sub"><span class="trk-orchid">✿</span> Orchids ${p.orchids.length}/${ORCHID_COUNT} · Tiko's exports ${p.exported.length}/${EXPORT_LIST.length} · ${p.completion(STORY_MISSIONS.length, ORCHID_COUNT, EXPORT_LIST.length)}% done</div>`;
  }
}

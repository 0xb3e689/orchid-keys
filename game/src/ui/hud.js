// Drives the HUD overlay each frame: money ticking toward its new value, wanted stars (blinking
// while evading), weapon and ammo, health and armour, vehicle speed and radio, district name
// on entering a new area, objective with countdown, banners, toasts, hints and damage flash.
import { formatMoney } from '../core/mathUtils.js';
import { on } from '../core/eventBus.js';
import { WEAPONS } from '../combat/weapons.js';
import { DISTRICTS, districtAt } from '../world/cityPlan.js';

const $ = (id) => document.getElementById(id);

export class Hud {
  constructor() {
    this.root = $('hud');
    this.el = {
      money: $('hud-money'), stars: $('hud-stars'), weapon: $('hud-weapon-name'), ammo: $('hud-ammo'), rank: $('hud-rank'),
      health: $('hud-health'), armor: $('hud-armor'), location: $('hud-location'), vehicle: $('hud-vehicle'),
      objective: $('hud-objective'), objectiveText: $('hud-objective-text'), timer: $('hud-timer'),
      banner: $('hud-banner'), bannerTitle: $('hud-banner-title'), bannerSub: $('hud-banner-sub'),
      hint: $('hud-hint'), toasts: $('hud-toasts'), crosshair: $('hud-crosshair'), damage: $('hud-damage'), status: $('status'),
    };
    this.shownMoney = 0;
    this.bannerTimer = 0;
    this.hintTimer = 0;
    this.locationTimer = 0;
    this.lastDistrict = null;
    this.damageFlash = 0;
    this.radioName = '';
    this.radioTimer = 0;
    on('playerHurt', (e) => { this.damageFlash = Math.min(1, this.damageFlash + e.amount / 40); });
    on('moneyChanged', (e) => { if (e.amount > 0 && e.reason) this.toast(`+${formatMoney(e.amount)}  ${e.reason}`); });
    on('rankUp', (e) => this.toast(`New street rank: ${e.title}`));
  }

  show(v) { this.root.classList.toggle('hidden', !v); }

  banner(title, sub = '', color = '#ffd23f', seconds = 3) {
    this.el.bannerTitle.textContent = title;
    this.el.bannerTitle.style.color = color;
    this.el.bannerSub.textContent = sub;
    this.el.banner.classList.add('show');
    this.bannerTimer = seconds;
    this.el.status.textContent = `${title}. ${sub}`;
  }

  hint(html, seconds = 3.5) {
    if (this.el.hint.innerHTML !== html) this.el.hint.innerHTML = html;
    this.el.hint.classList.add('show');
    this.hintTimer = seconds;
  }

  toast(text) {
    const d = document.createElement('div');
    d.textContent = text;
    this.el.toasts.appendChild(d);
    setTimeout(() => d.remove(), 4200);
    while (this.el.toasts.children.length > 4) this.el.toasts.firstChild.remove();
  }

  showRadio(name) { this.radioName = name; this.radioTimer = 3; }

  update(dt, game) {
    const p = game.progress;
    const player = game.player;
    // money counts up like a till
    const diff = p.money - this.shownMoney;
    this.shownMoney = Math.abs(diff) < 1 ? p.money : this.shownMoney + diff * Math.min(1, dt * 6);
    this.el.money.textContent = formatMoney(this.shownMoney);
    const stars = game.wanted.stars;
    [...this.el.stars.children].forEach((s, i) => s.classList.toggle('on', i < stars));
    this.el.stars.classList.toggle('flash', game.wanted.evading);
    this.el.rank.textContent = `${p.rank.title} · ${p.respect} respect`;
    const w = WEAPONS[player.weapon];
    this.el.weapon.textContent = w.name;
    this.el.ammo.textContent = w.melee ? '' : String(player.ammo[player.weapon] ?? 0);
    this.el.health.style.width = Math.max(0, player.health) + '%';
    this.el.armor.style.width = Math.max(0, player.armor) + '%';
    this.el.crosshair.classList.toggle('show', player.aiming);

    const v = player.vehicle;
    if (v) {
      const kmh = Math.round(Math.abs(v.speed) * 3.6);
      const radio = this.radioTimer > 0 ? `<br><small>♪ ${this.radioName}</small>` : '';
      this.el.vehicle.innerHTML = `${v.type.name}<br><b>${kmh}</b> km/h${radio}`;
    } else {
      this.el.vehicle.innerHTML = this.radioTimer > 0 && this.radioName ? `<small>♪ ${this.radioName}</small>` : '';
    }
    this.radioTimer -= dt;

    const obj = game.missions.objective;
    if (obj) {
      if (this.el.objectiveText.innerHTML !== obj) this.el.objectiveText.innerHTML = obj;
      const t = game.missions.timeLeft;
      this.el.timer.textContent = t !== null ? `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}` : '';
      this.el.objective.classList.remove('none');
    } else {
      const free = game.freeRoamObjective();
      this.el.objectiveText.innerHTML = free;
      this.el.timer.textContent = '';
      this.el.objective.classList.toggle('none', !free);
    }

    // district name when crossing into a new area
    const d = districtAt(player.pos.x, player.pos.z);
    if (d !== this.lastDistrict) {
      this.lastDistrict = d;
      this.el.location.innerHTML = `${DISTRICTS[d].name}<small>ORCHID KEYS</small>`;
      this.el.location.classList.add('show');
      this.locationTimer = 4;
    }
    if ((this.locationTimer -= dt) <= 0) this.el.location.classList.remove('show');
    if (this.bannerTimer > 0 && (this.bannerTimer -= dt) <= 0) this.el.banner.classList.remove('show');
    if (this.hintTimer > 0 && (this.hintTimer -= dt) <= 0) this.el.hint.classList.remove('show');
    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.5);
    this.el.damage.style.opacity = String(Math.max(this.damageFlash, player.health < 25 ? 0.35 + Math.sin(performance.now() / 200) * 0.15 : 0));
  }
}

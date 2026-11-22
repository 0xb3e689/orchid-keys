// Full-screen menus: title (continue / new game / controls, with a save card showing the
// story's chapters and completion), pause (resume, map, save, load, controls, quit) with career
// stats, the island map, shop counters, and the WASTED / BUSTED fades. While any of these is
// open the world is paused.
import { formatMoney } from '../core/mathUtils.js';
import { hasSave, readSave } from '../systems/saveGame.js';
import { ORCHID_COUNT } from '../systems/orchidHunt.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { EXPORT_LIST, shopItems, SHOPS } from '../systems/shops.js';
import { VEHICLE_TYPES } from '../entities/vehicleModels.js';
import { BLIPS } from './mapRenderer.js';

const $ = (id) => document.getElementById(id);

export class Menus {
  constructor(game) {
    this.game = game;
    this.screens = ['start-screen', 'pause-screen', 'map-screen', 'controls-screen', 'shop-screen', 'fade-screen'].map($);
    this.open = null;
    this.returnTo = null;
    this.shopId = null;
    $('start-menu').addEventListener('click', (e) => this.onStart(e.target.dataset.action));
    $('pause-menu').addEventListener('click', (e) => this.onPause(e.target.dataset.action));
    $('controls-screen').addEventListener('click', (e) => { if (e.target.dataset.action === 'back') this.show(this.returnTo); });
    $('shop-items').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (b && !b.disabled) this.buy(Number(b.dataset.index));
    });
    const legend = $('map-legend');
    legend.innerHTML = Object.values(BLIPS).map((b) => `<span style="--c:${b.color}">${b.label}</span>`).join('');
  }

  get blocking() { return this.open !== null && this.open !== 'fade-screen'; }

  show(id) {
    for (const s of this.screens) s.classList.toggle('hidden', s.id !== id);
    this.open = id;
    if (id && id !== 'fade-screen') this.game.input.releaseLock();
  }

  hide() {
    this.show(null);
    this.game.input.requestLock();
  }

  showStart() {
    $('btn-continue').classList.toggle('hidden', !hasSave());
    this.renderSaveCard(readSave());
    this.show('start-screen');
  }

  /** The Continue card: where the save left off and the story's chapter list. */
  renderSaveCard(save) {
    const card = $('save-card');
    card.classList.toggle('hidden', !save);
    if (!save) return;
    const story = Math.min(save.story ?? 0, STORY_MISSIONS.length);
    const next = STORY_MISSIONS[story];
    const chapters = STORY_MISSIONS.map((m, i) => `<li class="${i < story ? 'done' : i === story ? 'next' : ''}">${m.title}</li>`).join('');
    card.innerHTML = `
      <span class="pct">${save.completion ?? 0}%</span>
      <h3>Saved game</h3>
      <div class="save-main">${next ? `Next: ${next.title}` : 'Story complete'}</div>
      <div class="save-meta"><b>${formatMoney(save.money ?? 0)}</b> · ${save.rank ?? 'Fresh Out'} · ✿ ${(save.orchids ?? []).length}/${ORCHID_COUNT} orchids</div>
      <h3>Salt &amp; Neon · ${story}/${STORY_MISSIONS.length}</h3>
      <ol>${chapters}</ol>`;
  }

  onStart(action) {
    if (!action) return;
    this.game.sound.unlock();
    this.game.sound.blip(true);
    if (action === 'new') { this.hide(); this.game.newGame(); }
    else if (action === 'continue') { this.hide(); this.game.loadGame(); }
    else if (action === 'controls') { this.returnTo = 'start-screen'; this.show('controls-screen'); }
  }

  openPause() {
    const p = this.game.progress;
    const s = p.stats;
    $('pause-stats').innerHTML = `
      <div>Street rank <b>${p.rank.title}</b> (${p.respect} respect)</div>
      <div>Money <b>${formatMoney(p.money)}</b></div>
      <div>Story <b>${p.story}/${STORY_MISSIONS.length}</b> missions · <b>${p.completion(STORY_MISSIONS.length, ORCHID_COUNT, EXPORT_LIST.length)}%</b> complete</div>
      <div>Wild orchids <b>${p.orchids.length}/${ORCHID_COUNT}</b></div>
      <div>Tiko's export list <b>${p.exported.length}/${EXPORT_LIST.length}</b>${p.exported.length < EXPORT_LIST.length ? ` · wants a <b>${VEHICLE_TYPES[EXPORT_LIST.find((t) => !p.exported.includes(t))].name}</b>` : ''}</div>
      <div>Cars stolen <b>${s.carsStolen}</b></div>
      <div>Races won <b>${s.racesWon}</b> · Deliveries <b>${p.deliveriesDone}</b></div>
      <div>Cops evaded <b>${s.copsEvaded}</b></div>
      <div>Garage <b>${p.ownedCars.length ? p.ownedCars.map((c) => c.type).join(', ') : 'empty'}</b></div>`;
    this.show('pause-screen');
    this.game.sound.suspend(true);
  }

  onPause(action) {
    if (!action) return;
    this.game.sound.blip();
    if (action === 'resume') this.resume();
    else if (action === 'map') this.openMap('pause-screen');
    else if (action === 'save') { this.game.saveNow(); this.resume(); }
    else if (action === 'load') { this.resume(); this.game.loadGame(); }
    else if (action === 'controls') { this.returnTo = 'pause-screen'; this.show('controls-screen'); }
    else if (action === 'title') { this.game.sound.suspend(false); this.game.quitToTitle(); }
  }

  resume() {
    this.game.sound.suspend(false);
    this.hide();
  }

  openMap(returnTo = null) {
    this.returnTo = returnTo;
    this.show('map-screen');
    this.game.drawFullMap($('map-canvas'));
  }

  closeMap() {
    if (this.returnTo === 'pause-screen') this.show('pause-screen');
    else this.resume();
  }

  openShop(shopId) {
    this.shopId = shopId;
    $('shop-title').textContent = SHOPS[shopId].title;
    this.renderShop();
    this.show('shop-screen');
  }

  renderShop() {
    const items = shopItems(this.game, this.shopId);
    this.items = items;
    $('shop-money').textContent = formatMoney(this.game.progress.money);
    $('shop-items').innerHTML = items.map((it, i) => {
      const cant = it.disabled || it.price > this.game.progress.money;
      return `<button data-index="${i}" ${cant ? 'disabled' : ''}><b>${it.label}</b><small>${it.detail}</small><em>${it.priceText || 'FREE'}</em></button>`;
    }).join('');
  }

  buy(i) {
    const it = this.items[i];
    if (!it || !this.game.progress.spend(it.price)) return;
    it.buy();
    this.game.sound.cash();
    this.renderShop();
  }

  /** Big centred title over the world (WASTED, BUSTED, THE END). */
  fade(kind, title, sub) {
    const el = $('fade-screen');
    el.className = 'screen ' + kind;
    $('fade-title').textContent = title;
    $('fade-sub').textContent = sub;
    this.show('fade-screen');
  }

  /** Esc / M handling while a menu is open. */
  handleKeys(input) {
    if (this.open === 'pause-screen' && input.wasPressedRaw('Escape')) this.resume();
    else if (this.open === 'map-screen' && (input.wasPressedRaw('Escape') || input.wasPressedRaw('KeyM'))) this.closeMap();
    else if (this.open === 'controls-screen' && input.wasPressedRaw('Escape')) this.show(this.returnTo);
    else if (this.open === 'shop-screen' && input.wasPressedRaw('Escape')) this.resume();
  }
}

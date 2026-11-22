// Places to spend money: Gulfside Arms (guns, ammo, body armour), Tiko's Body Shop (repair,
// a respray that shakes the cops, and a car lot gated by respect) and Mama Ro's laundromat,
// the safehouse where the game is saved. Each returns menu items for the shop menu UI.
import { LANDMARKS } from '../world/cityPlan.js';
import { WEAPONS } from '../combat/weapons.js';
import { VEHICLE_TYPES } from '../entities/vehicleModels.js';
import { formatMoney } from '../core/mathUtils.js';

const CAR_LOT = [
  { type: 'marlin', respect: 0 },
  { type: 'sandpiper', respect: 5 },
  { type: 'manta', respect: 15 },
  { type: 'kestrel', respect: 30 },
];

export const SHOPS = {
  gunShop: { landmark: 'gunShop', title: 'Gulfside Arms', onFoot: true, color: 0xff6b6b, label: 'GULFSIDE ARMS' },
  garage: { landmark: 'garage', title: "Tiko's Body Shop", onFoot: false, color: 0xffd23f, label: 'BODY SHOP' },
  safehouse: { landmark: 'safehouse', title: "Mama Ro's Safehouse", onFoot: true, color: 0x7cf29a, label: 'SAVE' },
};

/** Menu entries for a shop: { label, detail, price, disabled, buy() }. */
export function shopItems(game, shopId) {
  const p = game.progress;
  const player = game.player;
  const items = [];
  if (shopId === 'gunShop') {
    for (const [id, w] of Object.entries(WEAPONS)) {
      if (id === 'fists') continue;
      const owned = (player.ammo[id] ?? 0) > 0 || player.ownedWeapons?.has(id);
      const locked = p.respect < w.respect;
      items.push({
        label: owned ? `${w.name} ammo (${w.ammoPack})` : w.name,
        detail: locked ? `Needs ${w.respect} respect` : owned ? `You carry ${player.ammo[id]} rounds` : `Damage ${w.damage}${w.pellets ? '×' + w.pellets : ''} · range ${w.range} m`,
        price: owned ? w.ammoPrice : w.price,
        disabled: locked,
        buy: () => { player.giveWeapon(id, w.ammoPack); player.weapon = id; },
      });
    }
    items.push({ label: 'Body armour', detail: `Armour ${Math.round(player.armor)}/100`, price: 400, disabled: player.armor >= 100, buy: () => { player.armor = 100; } });
  } else if (shopId === 'garage') {
    const v = player.vehicle;
    items.push({
      label: 'Repair',
      detail: v ? `${v.type.name} at ${Math.round((v.health / v.maxHealth) * 100)}%` : 'Bring a car',
      price: 150,
      disabled: !v || v.health >= v.maxHealth,
      buy: () => { v.health = v.maxHealth; },
    });
    items.push({
      label: 'Respray',
      detail: game.wanted.stars ? 'New colour, and the cops lose your description' : 'New colour',
      price: 400,
      disabled: !v || v.isPolice,
      buy: () => { game.resprayVehicle(v); game.wanted.clear(); },
    });
    for (const c of CAR_LOT) {
      const t = VEHICLE_TYPES[c.type];
      const owned = p.ownedCars.some((o) => o.type === c.type);
      items.push({
        label: `Buy ${t.name}`,
        detail: p.respect < c.respect ? `Needs ${c.respect} respect` : owned ? 'Already in your garage' : `Top speed ${Math.round(t.maxSpeed * 3.6)} km/h`,
        price: t.price,
        disabled: p.respect < c.respect || owned,
        buy: () => { p.ownedCars.push({ type: c.type, color: 0xff70a6 }); game.deliverOwnedCar(c.type); },
      });
    }
    for (const o of p.ownedCars) {
      items.push({ label: `Take out your ${VEHICLE_TYPES[o.type].name}`, detail: 'Parked outside', price: 0, disabled: false, buy: () => game.deliverOwnedCar(o.type) });
    }
  } else if (shopId === 'safehouse') {
    items.push({ label: 'Save game', detail: 'Also heals you', price: 0, disabled: false, buy: () => { player.heal(100); game.saveNow(); } });
    items.push({ label: 'Rest until healed', detail: `Health ${Math.round(player.health)}/100`, price: 0, disabled: player.health >= 100, buy: () => player.heal(100) });
  }
  return items.map((it) => ({ ...it, priceText: it.price ? formatMoney(it.price) : '' }));
}

/** Where a shop's trigger ring sits. */
export function shopSpot(shopId) {
  const lm = LANDMARKS[SHOPS[shopId].landmark];
  // keep the save ring clear of the story giver ring at the same door
  const dx = shopId === 'safehouse' ? -6 : shopId === 'garage' ? 7 : 0;
  return { x: lm.x + dx, z: lm.z };
}

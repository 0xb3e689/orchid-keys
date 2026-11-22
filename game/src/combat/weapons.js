// The arsenal sold at Gulfside Arms and carried by OKPD and Shore's crew.
// spread is the cone half-angle in radians; cooldown is seconds between shots.

export const WEAPONS = {
  fists: { name: 'Fists', damage: 14, range: 1.9, cooldown: 0.45, spread: 0, melee: true, auto: false, price: 0, ammoPack: 0 },
  pistol: { name: 'Viper 9 Pistol', damage: 28, range: 75, cooldown: 0.26, spread: 0.012, auto: false, price: 500, ammoPack: 36, ammoPrice: 60, respect: 0 },
  smg: { name: 'Hornet SMG', damage: 16, range: 60, cooldown: 0.085, spread: 0.035, auto: true, price: 1800, ammoPack: 120, ammoPrice: 150, respect: 10 },
  shotgun: { name: 'Breaker Shotgun', damage: 15, pellets: 7, range: 30, cooldown: 0.85, spread: 0.08, auto: false, price: 2600, ammoPack: 24, ammoPrice: 120, respect: 20 },
  carbine: { name: 'Gale Carbine', damage: 32, range: 120, cooldown: 0.13, spread: 0.014, auto: true, price: 5500, ammoPack: 90, ammoPrice: 220, respect: 40 },
};

export const WEAPON_ORDER = ['fists', 'pistol', 'smg', 'shotgun', 'carbine'];

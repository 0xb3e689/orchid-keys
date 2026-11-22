// Reusable mission steps. A mission is a list of these; each shows an objective, may place
// markers, and reports 'done' or a failure reason from update(). The story missions and the
// side jobs are all written with this small vocabulary.

const MARK = 'step-';

/** Play dialog lines; done once they have all been shown. */
export const say = (...lines) => ({
  text: null,
  enter(ctx) { ctx.game.dialog.queue(lines); },
  update(ctx) { return ctx.game.dialog.idle ? 'done' : null; },
});

/** Run code once and move on. */
export const action = (fn) => ({ text: null, enter(ctx) { fn(ctx); }, update() { return 'done'; } });

/** Wait a few seconds (with the previous objective still shown). */
export const wait = (seconds) => ({ text: null, enter(ctx) { ctx.state.wait = seconds; }, update(ctx, dt) { return (ctx.state.wait -= dt) <= 0 ? 'done' : null; } });

/** Get behind the wheel of anything. */
export const getAnyCar = (text = 'Get a car: walk up to one and press F.') => ({
  text,
  update(ctx) { return ctx.game.player.vehicle ? 'done' : null; },
});

/**
 * Go to a place. opts.vehicle: 'any' (must be driving), 'none' (on foot), a tag (that car),
 * or null (either). opts.timeLimit fails the mission when it runs out.
 */
export const goTo = (place, text, opts = {}) => ({
  text,
  timeLimit: opts.timeLimit,
  enter(ctx) {
    const p = typeof place === 'function' ? place(ctx) : place;
    ctx.state.target = p;
    ctx.game.markers.add(MARK + 'goto', { x: p.x, z: p.z, radius: opts.radius ?? 4, color: opts.color ?? 0xffd23f, label: opts.label ?? null });
    ctx.game.setObjectiveTarget(p);
  },
  update(ctx) {
    const pl = ctx.game.player;
    const v = pl.vehicle;
    if (opts.vehicle === 'any' && !v) return null;
    if (opts.vehicle === 'none' && v) return null;
    if (opts.vehicle && opts.vehicle !== 'any' && opts.vehicle !== 'none' && !(v && v.tags.has(opts.vehicle))) return null;
    if (opts.slow && v && v.absSpeed > 8) return null;
    const there = ctx.game.markers.inside(MARK + 'goto', pl.pos.x, pl.pos.z, v ? 1.5 : 0);
    // some drop-offs refuse to open while OKPD is still on your tail
    if (there && opts.noHeat && ctx.game.wanted.stars > 0) { ctx.game.hud.hint('Lose the cops first: nobody opens the door with OKPD outside.'); return null; }
    return there ? 'done' : null;
  },
  exit(ctx) { ctx.game.markers.remove(MARK + 'goto'); ctx.game.setObjectiveTarget(null); },
});

/** Get into the car carrying `tag`. */
export const enterTagged = (tag, text) => ({
  text,
  enter(ctx) {
    const v = ctx.game.taggedVehicle(tag);
    if (v) ctx.game.markers.add(MARK + 'car', { x: v.pos.x, z: v.pos.z, kind: 'arrow', follow: v, color: 0x5aa9ff });
  },
  update(ctx) {
    const v = ctx.game.taggedVehicle(tag);
    if (!v || v.destroyed) return 'The car was destroyed.';
    ctx.game.setObjectiveTarget(v.pos);
    return ctx.game.player.vehicle === v ? 'done' : null;
  },
  exit(ctx) { ctx.game.markers.remove(MARK + 'car'); ctx.game.setObjectiveTarget(null); },
});

/** Kill every hostile carrying `tag`. */
export const eliminate = (tag, text) => ({
  text,
  update(ctx) {
    const left = ctx.game.gangs.alive(tag);
    for (const e of ctx.game.gangs.members(tag)) {
      if (e.alive && !ctx.game.markers.get(MARK + 'e' + e.id)) ctx.game.markers.add(MARK + 'e' + e.id, { x: e.pos.x, z: e.pos.z, kind: 'arrow', follow: e, color: 0xff4d4d });
      if (!e.alive) ctx.game.markers.remove(MARK + 'e' + e.id);
    }
    ctx.state.counter = left;
    if (left > 0) ctx.game.setObjectiveTarget(ctx.game.gangs.members(tag).find((e) => e.alive)?.pos ?? null);
    return left === 0 ? 'done' : null;
  },
  exit(ctx) { ctx.game.markers.clear(MARK + 'e'); ctx.game.setObjectiveTarget(null); },
});

/** Wreck the car carrying `tag` before it gets away. */
export const destroyTagged = (tag, text, escapeDistance = 280) => ({
  text,
  enter(ctx) {
    const v = ctx.game.taggedVehicle(tag);
    if (v) ctx.game.markers.add(MARK + 'target', { x: v.pos.x, z: v.pos.z, kind: 'arrow', follow: v, color: 0xff4d4d });
  },
  update(ctx) {
    const v = ctx.game.taggedVehicle(tag);
    if (!v || v.destroyed) { ctx.state.wreck = v ? { x: v.pos.x, z: v.pos.z } : null; return 'done'; }
    ctx.game.setObjectiveTarget(v.pos);
    const d = Math.hypot(v.pos.x - ctx.game.player.pos.x, v.pos.z - ctx.game.player.pos.z);
    ctx.state.health = v.health / v.maxHealth;
    return d > escapeDistance ? 'The target got away.' : null;
  },
  exit(ctx) { ctx.game.markers.remove(MARK + 'target'); ctx.game.setObjectiveTarget(null); },
});

/** Walk over a pickup. place may be a function of ctx (e.g. where a wreck stopped). */
export const pickUp = (place, kind, text) => ({
  text,
  enter(ctx) {
    const p = typeof place === 'function' ? place(ctx) : place;
    ctx.state.pick = p;
    ctx.game.markers.add(MARK + 'pick', { x: p.x, z: p.z, kind: 'pickup', pickup: kind, radius: 1.8 });
    ctx.game.setObjectiveTarget(p);
  },
  update(ctx) {
    const pl = ctx.game.player;
    return !pl.vehicle && ctx.game.markers.inside(MARK + 'pick', pl.pos.x, pl.pos.z) ? 'done' : null;
  },
  exit(ctx) { ctx.game.markers.remove(MARK + 'pick'); ctx.game.setObjectiveTarget(null); ctx.game.sound.cash(); },
});

export const loseWanted = (text = 'Lose the cops.') => ({
  text,
  update(ctx) { return ctx.game.wanted.stars === 0 ? 'done' : null; },
});

export const setWanted = (stars) => action((ctx) => ctx.game.wanted.setAtLeast(stars));

/** Stay alive for `seconds`. */
export const survive = (seconds, text) => ({
  text,
  timeLimit: seconds,
  survive: true,
  update() { return null; },
});

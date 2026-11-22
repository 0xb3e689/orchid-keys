// Story subtitles: queued lines shown one at a time with the speaker's name in their colour.
// Missions wait on `idle` before moving to the next objective; Enter skips a line.
import { CAST } from '../missions/cast.js';

export class DialogBox {
  constructor() {
    this.el = document.getElementById('hud-dialog');
    this.who = document.getElementById('hud-dialog-who');
    this.text = document.getElementById('hud-dialog-text');
    this.lines = [];
    this.current = null;
    this.timer = 0;
  }

  queue(lines) {
    this.lines.push(...lines);
    if (!this.current) this.next();
  }

  next() {
    this.current = this.lines.shift() ?? null;
    if (!this.current) {
      this.el.classList.remove('show');
      return;
    }
    const c = CAST[this.current.who] ?? { name: this.current.who, color: '#fff' };
    this.who.textContent = c.name + ':';
    this.who.style.color = c.color;
    this.text.textContent = this.current.text;
    this.el.classList.add('show');
    this.timer = this.current.time;
  }

  skip() { if (this.current) this.next(); }

  clear() {
    this.lines = [];
    this.current = null;
    this.el.classList.remove('show');
  }

  get idle() { return !this.current && this.lines.length === 0; }

  update(dt) {
    if (!this.current) return;
    this.timer -= dt;
    if (this.timer <= 0) this.next();
  }
}

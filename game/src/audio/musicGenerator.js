// Generated music for the car radio and the title screen: a step sequencer scheduled ahead on
// the WebAudio clock, with drum machine, bass, chord pads and a seeded lead melody. Each
// station has its own tempo, groove and chord progression; nothing is a recording.
import { sound } from './soundEngine.js';
import { createRng } from '../core/rng.js';

const NOTE = (n) => 440 * Math.pow(2, (n - 69) / 12);

export const STATIONS = [
  { name: 'Radio Coral 98.1', tag: 'sunset synthwave', bpm: 100, groove: 'four', root: 57, prog: [[0, 3, 7, 10], [-4, 0, 3, 7], [-9, -5, -2, 3], [-2, 2, 5, 9]], lead: 'sawtooth', seed: 11 },
  { name: 'Lagoon 104.5', tag: 'island dembow', bpm: 94, groove: 'dembow', root: 62, prog: [[0, 3, 7], [-4, 0, 3], [-7, -3, 0], [-2, 2, 5]], lead: 'square', seed: 23 },
  { name: 'Keys Jazz Lounge', tag: 'late-night bossa', bpm: 128, groove: 'bossa', root: 60, prog: [[2, 5, 9, 12], [7, 11, 14, 17], [0, 4, 7, 11], [9, 12, 16, 19]], lead: 'triangle', seed: 37 },
];
export const TITLE_THEME = { name: 'Orchid Keys Theme', bpm: 96, groove: 'four', root: 55, prog: [[0, 4, 7, 11], [-3, 0, 4, 7], [5, 9, 12, 16], [2, 5, 9, 12]], lead: 'sawtooth', seed: 5 };

export class MusicGenerator {
  constructor() {
    this.track = null;
    this.step = 0;
    this.nextTime = 0;
    this.timer = null;
    this.melody = [];
  }

  play(track) {
    if (!sound.enabled || this.track === track) return;
    this.stop();
    this.track = track;
    this.step = 0;
    this.nextTime = sound.ctx.currentTime + 0.1;
    const rng = createRng(track.seed);
    // a 32-step melody of scale degrees (-1 = rest) built once per station
    const scale = [0, 3, 5, 7, 10, 12, 15];
    this.melody = Array.from({ length: 32 }, (_, i) => (rng.chance(i % 4 === 0 ? 0.8 : 0.4) ? rng.pick(scale) : -1));
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.track = null;
  }

  schedule() {
    const ctx = sound.ctx;
    if (!ctx || !this.track) return;
    const stepDur = 60 / this.track.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, stepDur);
      this.nextTime += stepDur;
      this.step++;
    }
  }

  voice(type, freq, t, dur, gain, filterFreq = 4000) {
    const ctx = sound.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(f).connect(g).connect(sound.musicBus);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  drum(kind, t) {
    const ctx = sound.ctx;
    if (kind === 'kick') {
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(140, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.16);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.9, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g).connect(sound.musicBus);
      o.start(t);
      o.stop(t + 0.32);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = sound.noise;
    const f = ctx.createBiquadFilter();
    f.type = kind === 'hat' ? 'highpass' : 'bandpass';
    f.frequency.value = kind === 'hat' ? 7000 : 1800;
    const g = ctx.createGain();
    const len = kind === 'hat' ? 0.05 : 0.18;
    g.gain.setValueAtTime(kind === 'hat' ? 0.18 : 0.45, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    src.connect(f).connect(g).connect(sound.musicBus);
    src.start(t, Math.random());
    src.stop(t + len + 0.02);
  }

  playStep(step, t, stepDur) {
    const tr = this.track;
    const s16 = step % 16;
    const bar = Math.floor(step / 16) % tr.prog.length;
    const chord = tr.prog[bar];
    // drums
    if (tr.groove === 'four') {
      if (s16 % 4 === 0) this.drum('kick', t);
      if (s16 === 4 || s16 === 12) this.drum('snare', t);
      if (s16 % 2 === 1) this.drum('hat', t);
    } else if (tr.groove === 'dembow') {
      if (s16 % 4 === 0) this.drum('kick', t);
      if ([3, 6, 11, 14].includes(s16)) this.drum('snare', t);
      if (s16 % 2 === 0) this.drum('hat', t);
    } else {
      if (s16 === 0 || s16 === 10) this.drum('kick', t);
      if ([3, 6, 9, 12, 15].includes(s16)) this.drum('hat', t);
    }
    // bass on the root with octave pops
    if (s16 % 2 === 0) {
      const n = tr.root - 24 + chord[0] + (s16 % 8 === 6 ? 12 : 0);
      this.voice('sawtooth', NOTE(n), t, stepDur * 1.8, 0.16, 500);
    }
    // pad chord at the top of each bar
    if (s16 === 0) for (const c of chord) this.voice('triangle', NOTE(tr.root + c), t, stepDur * 15, 0.05, 1800);
    // lead melody
    const m = this.melody[step % 32];
    if (m >= 0 && step % 64 >= 16) this.voice(tr.lead, NOTE(tr.root + 12 + m + chord[0] % 12), t, stepDur * 1.6, 0.05, 2600);
  }
}

export const music = new MusicGenerator();

// Every sound is synthesized with WebAudio, nothing is loaded: gunshots and explosions from
// shaped noise, a sawtooth engine whose pitch follows the revs, two-tone OKPD sirens that pan
// and fade with distance, impacts, punches and menu blips.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.enabled = false;
    this.sirenLevel = 0;
  }

  /** Must be called from a user gesture (the start button). */
  unlock() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.8;
    const comp = c.createDynamicsCompressor();
    this.master.connect(comp).connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.gain.value = 0.9;
    this.sfx.connect(this.master);
    this.musicBus = c.createGain();
    this.musicBus.gain.value = 0.42;
    this.musicBus.connect(this.master);
    this.noise = this.makeNoiseBuffer();
    this.buildEngine();
    this.buildSiren();
    this.enabled = true;
  }

  makeNoiseBuffer() {
    const c = this.ctx;
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  noiseBurst({ duration = 0.3, gain = 0.6, filter = 'lowpass', freq = 2000, q = 0.7, attack = 0.002, sweepTo = null, delay = 0 }) {
    if (!this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + duration);
    f.Q.value = q;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f).connect(g).connect(this.sfx);
    src.start(t, Math.random() * 1.5);
    src.stop(t + duration + 0.05);
  }

  tone({ type = 'sine', freq = 440, to = null, duration = 0.2, gain = 0.3, delay = 0, bus = null }) {
    if (!this.enabled) return;
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + duration);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(bus ?? this.sfx);
    o.start(t);
    o.stop(t + duration + 0.05);
  }

  /** Loudness falloff for a sound at `distance` metres. */
  falloff(distance) { return 1 / (1 + distance * 0.06); }

  gunshot(weapon, distance = 0) {
    const v = this.falloff(distance);
    if (weapon === 'shotgun') {
      this.noiseBurst({ duration: 0.45, gain: 0.9 * v, freq: 1800, sweepTo: 200 });
      this.tone({ type: 'sine', freq: 90, to: 40, duration: 0.25, gain: 0.6 * v });
    } else if (weapon === 'smg') {
      this.noiseBurst({ duration: 0.1, gain: 0.45 * v, filter: 'bandpass', freq: 2400, q: 0.9 });
      this.tone({ type: 'square', freq: 160, to: 60, duration: 0.06, gain: 0.15 * v });
    } else {
      this.noiseBurst({ duration: 0.2, gain: 0.7 * v, freq: 3200, sweepTo: 400 });
      this.tone({ type: 'sine', freq: 140, to: 50, duration: 0.15, gain: 0.45 * v });
    }
  }

  explosion(distance = 0) {
    const v = this.falloff(distance * 0.6);
    this.noiseBurst({ duration: 1.8, gain: 1.0 * v, freq: 900, sweepTo: 60, attack: 0.01 });
    this.tone({ type: 'sine', freq: 70, to: 25, duration: 1.2, gain: 0.9 * v });
  }

  impact(strength, distance = 0) {
    const v = Math.min(1, strength / 18) * this.falloff(distance);
    this.noiseBurst({ duration: 0.25, gain: 0.7 * v, freq: 700, sweepTo: 120 });
    this.tone({ type: 'triangle', freq: 220, to: 70, duration: 0.18, gain: 0.3 * v });
  }

  punch() {
    this.noiseBurst({ duration: 0.08, gain: 0.5, freq: 600 });
    this.tone({ type: 'sine', freq: 120, to: 60, duration: 0.1, gain: 0.4 });
  }

  blip(high = false) { this.tone({ type: 'square', freq: high ? 1320 : 880, duration: 0.07, gain: 0.08 }); }

  cash() {
    [1046, 1318, 1568].forEach((f, i) => this.tone({ type: 'triangle', freq: f, duration: 0.18, gain: 0.15, delay: i * 0.07 }));
  }

  missionPassed() {
    [523, 659, 784, 1046, 784, 1046].forEach((f, i) => this.tone({ type: 'sawtooth', freq: f, duration: 0.3, gain: 0.09, delay: i * 0.11 }));
  }

  missionFailed() {
    [392, 330, 262].forEach((f, i) => this.tone({ type: 'sawtooth', freq: f, duration: 0.45, gain: 0.1, delay: i * 0.18 }));
  }

  starUp() { this.tone({ type: 'square', freq: 660, to: 990, duration: 0.18, gain: 0.08 }); }

  horn() {
    this.tone({ type: 'sawtooth', freq: 392, duration: 0.35, gain: 0.12 });
    this.tone({ type: 'sawtooth', freq: 494, duration: 0.35, gain: 0.1 });
  }

  buildEngine() {
    const c = this.ctx;
    this.engOsc = c.createOscillator();
    this.engOsc.type = 'sawtooth';
    this.engOsc2 = c.createOscillator();
    this.engOsc2.type = 'square';
    this.engFilter = c.createBiquadFilter();
    this.engFilter.type = 'lowpass';
    this.engFilter.frequency.value = 600;
    this.engGain = c.createGain();
    this.engGain.gain.value = 0;
    this.engOsc.connect(this.engFilter);
    this.engOsc2.connect(this.engFilter);
    this.engFilter.connect(this.engGain).connect(this.sfx);
    this.engOsc.start();
    this.engOsc2.start();
  }

  /** rpm01 0..1 (idle to redline), load 0..1 throttle; on=false silences. */
  setEngine(on, rpm01, load) {
    if (!this.enabled) return;
    const t = this.ctx.currentTime;
    const f = 38 + rpm01 * 120;
    this.engOsc.frequency.setTargetAtTime(f, t, 0.05);
    this.engOsc2.frequency.setTargetAtTime(f * 0.5, t, 0.05);
    this.engFilter.frequency.setTargetAtTime(300 + rpm01 * 1400 + load * 600, t, 0.05);
    this.engGain.gain.setTargetAtTime(on ? 0.07 + load * 0.08 : 0, t, 0.08);
  }

  buildSiren() {
    const c = this.ctx;
    this.sirOsc = c.createOscillator();
    this.sirOsc.type = 'triangle';
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 1.6;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(this.sirOsc.frequency);
    this.sirOsc.frequency.value = 760;
    this.sirGain = c.createGain();
    this.sirGain.gain.value = 0;
    this.sirOsc.connect(this.sirGain).connect(this.sfx);
    this.sirOsc.start();
    lfo.start();
  }

  /** Nearest siren distance in metres, or Infinity for none. */
  setSiren(distance) {
    if (!this.enabled) return;
    const level = distance === Infinity ? 0 : 0.09 * this.falloff(distance * 0.5);
    this.sirGain.gain.setTargetAtTime(level, this.ctx.currentTime, 0.2);
  }

  suspend(paused) {
    if (!this.ctx) return;
    if (paused) this.ctx.suspend();
    else this.ctx.resume();
  }
}

export const sound = new SoundEngine();

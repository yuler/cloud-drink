let ctx = null;
let muted = false;

export function setMuted(v) {
  muted = !!v;
}

export function isMuted() {
  return muted;
}

function audioCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, delay, duration, { type = 'sine', gain = 0.2, freqEnd } = {}) {
  if (muted) return;
  const c = audioCtx();
  const t0 = c.currentTime + delay;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(freqEnd, t0 + duration);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function playClink() {
  tone(1400, 0, 0.15, { type: 'triangle', gain: 0.25 });
  tone(2100, 0, 0.12, { type: 'triangle', gain: 0.12 });
  tone(700, 0.05, 0.2, { type: 'triangle', gain: 0.1 });
}

export function playRattle() {
  for (let i = 0; i < 8; i++) {
    tone(180 + Math.random() * 220, i * 0.05, 0.06, { type: 'square', gain: 0.07 });
  }
}

export function playThud() {
  tone(90, 0, 0.12, { type: 'sine', gain: 0.28, freqEnd: 50 });
  tone(240, 0.02, 0.08, { type: 'triangle', gain: 0.1 });
}

export function playGulp() {
  tone(420, 0, 0.12, { type: 'sine', gain: 0.32, freqEnd: 200 });
  tone(380, 0.18, 0.12, { type: 'sine', gain: 0.28, freqEnd: 180 });
  tone(340, 0.36, 0.16, { type: 'sine', gain: 0.24, freqEnd: 140 });
}

export function playCheer() {
  tone(880, 0, 0.1, { type: 'square', gain: 0.06 });
  tone(880, 0.12, 0.1, { type: 'square', gain: 0.06 });
  tone(660, 0, 0.2, { type: 'triangle', gain: 0.1 });
}

export function playWhistle() {
  tone(1200, 0, 0.3, { type: 'sine', gain: 0.12, freqEnd: 1600 });
}

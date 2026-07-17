// Tiny WebAudio sound engine - synthesized tones, no audio files needed.
let ctx = null;

const getCtx = () => {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
};

export const isMuted = () => localStorage.getItem('dheeth_mute') === 'true';

export const toggleMute = () => {
  const muted = isMuted();
  localStorage.setItem('dheeth_mute', String(!muted));
  return !muted;
};

const tone = (freq, duration, { type = 'triangle', delay = 0, volume = 0.12 } = {}) => {
  try {
    if (isMuted()) return;
    const ac = getCtx();
    if (!ac) return;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const t = ac.currentTime + delay;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + duration + 0.05);
  } catch (_) {
    // Audio unavailable - fail silently
  }
};

export const sounds = {
  // Rising victory arpeggio
  win: () => {
    tone(523.25, 0.15);
    tone(659.25, 0.15, { delay: 0.12 });
    tone(783.99, 0.3, { delay: 0.24 });
  },
  // Grand capture fanfare
  capture: () => {
    tone(392, 0.12);
    tone(523.25, 0.12, { delay: 0.1 });
    tone(659.25, 0.12, { delay: 0.2 });
    tone(1046.5, 0.4, { delay: 0.3 });
  },
  // Bright coin clink
  coin: () => {
    tone(987.77, 0.08, { type: 'square', volume: 0.06 });
    tone(1318.5, 0.18, { type: 'square', delay: 0.08, volume: 0.06 });
  },
  // Low defeat / damage rumble
  damage: () => {
    tone(196, 0.25, { type: 'sawtooth', volume: 0.1 });
    tone(147, 0.35, { type: 'sawtooth', delay: 0.15, volume: 0.1 });
  },
  // Soft UI click
  click: () => tone(880, 0.05, { type: 'square', volume: 0.05 }),
  // Correct answer chime (bright and rewarding)
  correct: () => {
    tone(659.25, 0.1);
    tone(880, 0.22, { delay: 0.08 });
  },
  // Wrong answer buzz
  wrong: () => {
    tone(220, 0.2, { type: 'sawtooth', volume: 0.08 });
    tone(185, 0.3, { type: 'sawtooth', delay: 0.1, volume: 0.08 });
  },
  // Urgent clock tick for the final seconds
  tick: () => tone(1200, 0.04, { type: 'square', volume: 0.04 }),
  // Thunder crack for answer streaks
  streak: () => {
    tone(1567.98, 0.08, { type: 'square', volume: 0.08 });
    tone(1046.5, 0.1, { type: 'sawtooth', delay: 0.06, volume: 0.1 });
    tone(98, 0.5, { type: 'sawtooth', delay: 0.1, volume: 0.12 });
    tone(65.4, 0.7, { type: 'sawtooth', delay: 0.22, volume: 0.1 });
  },
  // Dramatic siege war drums
  siege: () => {
    tone(110, 0.15, { type: 'sawtooth', volume: 0.14 });
    tone(82.4, 0.2, { type: 'sawtooth', delay: 0.12, volume: 0.12 });
    tone(110, 0.12, { type: 'sawtooth', delay: 0.28, volume: 0.14 });
    tone(65.4, 0.35, { type: 'sawtooth', delay: 0.38, volume: 0.1 });
  },
  // Maintenance wrench clink
  maintain: () => {
    tone(740, 0.06, { type: 'square', volume: 0.06 });
    tone(880, 0.06, { type: 'square', delay: 0.08, volume: 0.06 });
    tone(1175, 0.12, { type: 'triangle', delay: 0.16, volume: 0.08 });
  },
};

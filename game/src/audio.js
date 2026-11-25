// Kitchen sounds synthesised with Web Audio (no sound files): the knife's tock, the pop of a part
// landing on a plate, the hatch bell, the sizzle as food hits the pan, the rush horn, the buzz of
// a missed ticket and the last-30-seconds clock tick. Silent until the first key or click.

export function createKitchenAudio() {
  let context = null;
  let noise = null;

  function unlock() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return;
    }
    const Context = window.AudioContext || window.webkitAudioContext;
    if (!Context) return;
    context = new Context();
    noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = noise.getChannelData(0);
    for (let index = 0; index < data.length; index += 1) data[index] = Math.random() * 2 - 1;
  }

  function tone(frequency, duration, type = 'sine', volume = 0.2, slide = 0, delay = 0) {
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slide) oscillator.frequency.exponentialRampToValueAtTime(Math.max(40, frequency + slide), start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function hiss(duration, frequency, volume, q = 1) {
    if (!context) return;
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = context.createGain();
    const start = context.currentTime;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(context.destination);
    source.start(start, Math.random() * 0.5);
    source.stop(start + duration + 0.02);
  }

  const SOUNDS = {
    chop: () => {
      hiss(0.05, 2400, 0.5, 2);
      tone(180, 0.06, 'triangle', 0.25, -60);
    },
    chopDone: () => {
      hiss(0.05, 2400, 0.5, 2);
      tone(520, 0.09, 'triangle', 0.18);
      tone(780, 0.12, 'triangle', 0.14, 0, 0.06);
    },
    pickup: () => tone(440, 0.06, 'sine', 0.12, 120),
    place: () => tone(300, 0.07, 'sine', 0.12, -80),
    plate: () => tone(660, 0.1, 'sine', 0.22, 440),
    dish: () => {
      tone(660, 0.1, 'sine', 0.2, 300);
      tone(990, 0.18, 'sine', 0.16, 0, 0.08);
    },
    sizzle: () => hiss(0.6, 5200, 0.25, 0.7),
    cooked: () => tone(880, 0.12, 'square', 0.06),
    burnt: () => tone(150, 0.4, 'sawtooth', 0.12, -60),
    pass: () => tone(520, 0.08, 'triangle', 0.15),
    served: () => {
      tone(1320, 0.7, 'sine', 0.22);
      tone(1980, 0.5, 'sine', 0.1, 0, 0.01);
      tone(990, 0.2, 'triangle', 0.1, 0, 0.12);
    },
    bin: () => hiss(0.15, 600, 0.3, 1),
    deny: () => tone(140, 0.12, 'square', 0.08),
    ticket: () => tone(1760, 0.05, 'square', 0.05),
    missed: () => tone(110, 0.45, 'sawtooth', 0.14, -30),
    rush: () => {
      tone(220, 0.35, 'sawtooth', 0.12);
      tone(277, 0.35, 'sawtooth', 0.1, 0, 0.18);
      tone(330, 0.5, 'sawtooth', 0.1, 0, 0.36);
    },
    tick: () => tone(1200, 0.03, 'square', 0.05),
    over: () => {
      tone(660, 0.3, 'sine', 0.2);
      tone(880, 0.3, 'sine', 0.2, 0, 0.2);
      tone(1100, 0.6, 'sine', 0.2, 0, 0.4);
    },
  };

  return {
    unlock,
    /** Play the sounds for one step's world events. */
    playEvents(events) {
      if (!context) return;
      for (const event of events) SOUNDS[event.type]?.();
    },
    playTick() {
      SOUNDS.tick();
    },
  };
}

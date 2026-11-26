// Procedural sound, made with the Web Audio API and nothing else: an
// engine hum that follows the throttle, wind that follows the speed, a
// chime for each ring, and a thud for a hard landing. No audio files.
export function makeAudio() {
  let context = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let windSource = null;
  let windGain = null;
  let windFilter = null;
  let muted = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return false;
    context = new AudioContext();
    // Engine: two detuned saws through a low pass, quiet enough to sit
    // under the wind.
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 58;
    engineOsc2 = context.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 87;
    const engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(context.destination);
    engineOsc.start();
    engineOsc2.start();
    // Wind: looped noise through a band pass that opens with speed.
    const noiseLength = context.sampleRate * 2;
    const noiseBuffer = context.createBuffer(1, noiseLength, context.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseLength; i++) data[i] = Math.random() * 2 - 1;
    windSource = context.createBufferSource();
    windSource.buffer = noiseBuffer;
    windSource.loop = true;
    windFilter = context.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 500;
    windFilter.Q.value = 0.6;
    windGain = context.createGain();
    windGain.gain.value = 0;
    windSource.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(context.destination);
    windSource.start();
    return true;
  }

  function tone(freq, startAt, length, volume, type) {
    if (!context || muted) return;
    const osc = context.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.value = freq;
    const gain = context.createGain();
    const t = context.currentTime + startAt;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(volume, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(t);
    osc.stop(t + length + 0.05);
  }

  return {
    // Call from a user gesture: browsers only allow audio after one.
    unlock() {
      ensure();
    },
    setMuted(value) {
      muted = value;
      if (engineGain) engineGain.gain.value = 0;
      if (windGain) windGain.gain.value = 0;
    },
    isMuted() {
      return muted;
    },
    // Continuous layers, called every frame while flying.
    update(throttle, speed01, flying) {
      if (!context || muted || !flying) {
        if (engineGain) engineGain.gain.value = 0;
        if (windGain) windGain.gain.value = 0;
        return;
      }
      const base = 52 + throttle * 46;
      engineOsc.frequency.setTargetAtTime(base, context.currentTime, 0.08);
      engineOsc2.frequency.setTargetAtTime(base * 1.5 + 3, context.currentTime, 0.08);
      engineGain.gain.setTargetAtTime(0.05 + throttle * 0.05, context.currentTime, 0.1);
      windFilter.frequency.setTargetAtTime(320 + speed01 * 900, context.currentTime, 0.1);
      windGain.gain.setTargetAtTime(0.015 + speed01 * 0.075, context.currentTime, 0.12);
    },
    ring() {
      tone(659, 0, 0.35, 0.16);
      tone(988, 0.07, 0.45, 0.16);
      tone(1319, 0.14, 0.6, 0.12);
    },
    warning() {
      tone(220, 0, 0.22, 0.12, 'square');
      tone(220, 0.26, 0.22, 0.12, 'square');
    },
    thud() {
      if (!context || muted) return;
      const osc = context.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, context.currentTime);
      osc.frequency.exponentialRampToValueAtTime(38, context.currentTime + 0.3);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0.35, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + 0.4);
    },
    fanfare() {
      tone(523, 0, 0.3, 0.15);
      tone(659, 0.12, 0.3, 0.15);
      tone(784, 0.24, 0.4, 0.15);
      tone(1047, 0.38, 0.7, 0.15);
    },
  };
}

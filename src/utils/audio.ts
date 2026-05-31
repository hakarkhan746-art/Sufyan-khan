/**
 * Web Audio API synthesizer for realistic rocket engine sound effects.
 * No external file dependencies - fully synthesized in-browser on user ignition.
 */

let audioCtx: AudioContext | null = null;
let noiseNode: AudioWorkletNode | ScriptProcessorNode | null = null;
let filterNode: BiquadFilterNode | null = null;
let gainNode: GainNode | null = null;
let resonanceFilter: BiquadFilterNode | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  return audioCtx;
}

export function startRocketThrustEngine() {
  try {
    const ctx = getAudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    // If already running, clean up first
    stopRocketThrustEngine();

    // Create a noise buffer (Brown noise is perfect for deep combustion rumbles)
    const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Brown noise approximation
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      // Boost volume slightly
      output[i] *= 3.5;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    // Deep combustion lowpass filtering
    filterNode = ctx.createBiquadFilter();
    filterNode.type = 'lowpass';
    filterNode.frequency.setValueAtTime(80, ctx.currentTime); // Low bassy rumble
    filterNode.Q.setValueAtTime(2.0, ctx.currentTime);

    // Mid-high jet stream exhaust resonance
    resonanceFilter = ctx.createBiquadFilter();
    resonanceFilter.type = 'bandpass';
    resonanceFilter.frequency.setValueAtTime(140, ctx.currentTime);
    resonanceFilter.Q.setValueAtTime(1.5, ctx.currentTime);

    // Gain controller
    gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.01, ctx.currentTime); // start quiet

    // Connect nodes
    noiseSource.connect(filterNode);
    filterNode.connect(gainNode);
    
    // Add parallel resonance path for full jet whoosh
    const resonanceSource = ctx.createBufferSource();
    resonanceSource.buffer = noiseBuffer;
    resonanceSource.loop = true;
    resonanceSource.connect(resonanceFilter);
    
    const resonanceGain = ctx.createGain();
    resonanceGain.gain.setValueAtTime(0.4, ctx.currentTime);
    
    resonanceFilter.connect(resonanceGain);
    resonanceGain.connect(gainNode);

    gainNode.connect(ctx.destination);

    // Begin sounds
    noiseSource.start(0);
    resonanceSource.start(0);

    // Save sources inside nodes for stopping later
    (gainNode as any).sources = [noiseSource, resonanceSource];

    // Ramp up rumble on startup
    gainNode.gain.exponentialRampToValueAtTime(0.8, ctx.currentTime + 1.0);
    filterNode.frequency.exponentialRampToValueAtTime(180, ctx.currentTime + 1.5);
  } catch (err) {
    console.warn('Audio synthesis initialized with system constraints:', err);
  }
}

/**
 * Update sound characteristics based on altitude and speed of flight.
 * As altitude goes up, the air gets thinner, so low frequencies disappear
 * and volume gradually dampens.
 */
export function updateEngineSoundFrequency(altitude: number, velocity: number) {
  try {
    if (!audioCtx || !filterNode || !gainNode || !resonanceFilter) return;

    const ctx = getAudioContext();
    const cleanAlt = Math.max(0, altitude);
    
    if (cleanAlt > 250) {
      // In outer space (high vacuum), fade out completely
      gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    } else {
      // Atmospheric sound dampening ratio
      const atmosphereDensity = Math.max(0, (250 - cleanAlt) / 250);
      
      // Pitch/brightness goes up with speed (velocity)
      const baseFreq = 80 + velocity * 15;
      const targetFreq = Math.max(40, baseFreq * atmosphereDensity);
      
      // Let lowpass sound narrower as we go higher
      filterNode.frequency.setValueAtTime(targetFreq, ctx.currentTime);
      resonanceFilter.frequency.setValueAtTime(140 + velocity * 10, ctx.currentTime);
      
      // Volume slightly drops as we lose atmosphere
      const targetGain = Math.max(0.05, 0.8 * (0.3 + 0.7 * atmosphereDensity));
      gainNode.gain.setValueAtTime(targetGain, ctx.currentTime);
    }
  } catch (err) {
    // Fail silently, purely secondary enhancement
  }
}

export function stopRocketThrustEngine() {
  try {
    if (gainNode) {
      const ctx = getAudioContext();
      gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      
      setTimeout(() => {
        if ((gainNode as any).sources) {
          (gainNode as any).sources.forEach((s: any) => {
            try { s.stop(); } catch(e) {}
          });
        }
        gainNode = null;
        filterNode = null;
        resonanceFilter = null;
      }, 500);
    }
  } catch (err) {
    // Fail silently
  }
}

export function playSuccessSignal() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    
    osc.type = 'sine';
    oscGain.gain.setValueAtTime(0.01, ctx.currentTime);
    
    // Play dual high telemetry ping (classic sci-fi satellite bleep)
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    oscGain.gain.setValueAtTime(0.2, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    
    const osc2 = ctx.createOscillator();
    const osc2Gain = ctx.createGain();
    osc2.connect(osc2Gain);
    osc2Gain.connect(ctx.destination);
    osc2.type = 'sine';
    osc2Gain.gain.setValueAtTime(0.01, ctx.currentTime);
    
    setTimeout(() => {
      osc2.frequency.setValueAtTime(1200, ctx.currentTime);
      osc2Gain.gain.setValueAtTime(0.25, ctx.currentTime);
      osc2Gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.5);
    }, 150);

    osc.start();
    osc.stop(ctx.currentTime + 0.4);
  } catch (e) {}
}

export function playTickingCountdownSound() {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();
    
    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1000, ctx.currentTime);
    oscGain.gain.setValueAtTime(0.15, ctx.currentTime);
    oscGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
    
    osc.start();
    osc.stop(ctx.currentTime + 0.1);
  } catch (e) {}
}

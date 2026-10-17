/**
 * Procedural Web Audio API Sound Engine.
 * Synthesizes high-rev internal combustion engine sound, gear shift backfires,
 * sharp tire squeals, aerodynamic wind noise, and curb rumble in real time.
 * Zero external audio files.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Master Gain
  private masterGain: GainNode | null = null;

  // Dual-Oscillator Engine Synthesizer (Sawtooth + Square)
  private oscSaw: OscillatorNode | null = null;     // Mechanical bite & rev texture
  private oscSquare: OscillatorNode | null = null;  // Low/mid harmonic body
  private oscSub: OscillatorNode | null = null;     // Deep engine bass pulse
  private engineFilter: BiquadFilterNode | null = null;
  private engineDistortion: WaveShaperNode | null = null;
  private engineGain: GainNode | null = null;

  // Rev limiter state
  private isRevLimiting: boolean = false;

  // Dual-layer Tire Squeal (Resonant Screech + Rubber Scrub)
  private squealNoise: AudioBufferSourceNode | null = null;
  private squealFilter: BiquadFilterNode | null = null;
  private squealGain: GainNode | null = null;
  private screechOsc: OscillatorNode | null = null;
  private screechGain: GainNode | null = null;

  // Aerodynamic Wind Rush
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  // Curb Rumble
  private curbOsc: OscillatorNode | null = null;
  private curbGain: GainNode | null = null;

  constructor() {}

  public init(): void {
    if (this.isInitialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.75, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);

      this.setupDualOscEngine();
      this.setupSharpTireSqueal();
      this.setupWindSound();
      this.setupCurbSound();

      this.isInitialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  public resume(): void {
    if (!this.isInitialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  /**
   * Dual-Oscillator (Sawtooth + Square) Engine Sound Synthesis.
   * Feeds into WaveShaper distortion and dynamically modulated Lowpass filter.
   */
  private setupDualOscEngine(): void {
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    // 1. Sawtooth Oscillator (fundamental combustion pulse)
    this.oscSaw = this.ctx.createOscillator();
    this.oscSaw.type = 'sawtooth';
    this.oscSaw.frequency.setValueAtTime(65, now);

    // 2. Square Oscillator (detuned by +1.8 cents for natural engine chorusing)
    this.oscSquare = this.ctx.createOscillator();
    this.oscSquare.type = 'square';
    this.oscSquare.frequency.setValueAtTime(65, now);
    this.oscSquare.detune.setValueAtTime(1.8, now);

    // 3. Sub-bass Oscillator (thump under heavy load)
    this.oscSub = this.ctx.createOscillator();
    this.oscSub.type = 'triangle';
    this.oscSub.frequency.setValueAtTime(32.5, now);

    // Sub-mix gains
    const sawGain = this.ctx.createGain();
    sawGain.gain.setValueAtTime(0.42, now);
    this.oscSaw.connect(sawGain);

    const squareGain = this.ctx.createGain();
    squareGain.gain.setValueAtTime(0.28, now);
    this.oscSquare.connect(squareGain);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.30, now);
    this.oscSub.connect(subGain);

    const engineMixer = this.ctx.createGain();
    sawGain.connect(engineMixer);
    squareGain.connect(engineMixer);
    subGain.connect(engineMixer);

    // WaveShaper Saturation / Distortion
    this.engineDistortion = this.ctx.createWaveShaper();
    this.engineDistortion.curve = this.makeDistortionCurve(28);
    this.engineDistortion.oversample = '4x';

    // Dynamic Lowpass Filter
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(550, now);
    this.engineFilter.Q.setValueAtTime(2.8, now);

    // Engine Master Volume
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.25, now);

    // Connection Chain
    engineMixer.connect(this.engineDistortion);
    this.engineDistortion.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.oscSaw.start();
    this.oscSquare.start();
    this.oscSub.start();
  }

  /**
   * Dual-layer sharp tire squeal:
   * Layer A: FM Resonant screech (1200 - 2400 Hz)
   * Layer B: Broadband rubber friction scrub noise
   */
  private setupSharpTireSqueal(): void {
    if (!this.ctx || !this.masterGain) return;

    // Layer A: Screech Oscillator (metallic rubber screech)
    this.screechOsc = this.ctx.createOscillator();
    this.screechOsc.type = 'sawtooth';
    this.screechOsc.frequency.setValueAtTime(1400, this.ctx.currentTime);

    const screechFilter = this.ctx.createBiquadFilter();
    screechFilter.type = 'bandpass';
    screechFilter.frequency.setValueAtTime(1500, this.ctx.currentTime);
    screechFilter.Q.setValueAtTime(6.5, this.ctx.currentTime);

    this.screechGain = this.ctx.createGain();
    this.screechGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.screechOsc.connect(screechFilter);
    screechFilter.connect(this.screechGain);
    this.screechGain.connect(this.masterGain);
    this.screechOsc.start();

    // Layer B: Broadband Scrub Noise
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    this.squealNoise = this.ctx.createBufferSource();
    this.squealNoise.buffer = noiseBuffer;
    this.squealNoise.loop = true;

    this.squealFilter = this.ctx.createBiquadFilter();
    this.squealFilter.type = 'bandpass';
    this.squealFilter.frequency.setValueAtTime(1100, this.ctx.currentTime);
    this.squealFilter.Q.setValueAtTime(3.5, this.ctx.currentTime);

    this.squealGain = this.ctx.createGain();
    this.squealGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.squealNoise.connect(this.squealFilter);
    this.squealFilter.connect(this.squealGain);
    this.squealGain.connect(this.masterGain);

    this.squealNoise.start();
  }

  private setupWindSound(): void {
    if (!this.ctx || !this.masterGain) return;

    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      output[i] = (lastOut + 0.02 * white) / 1.02;
      lastOut = output[i];
      output[i] *= 3.5;
    }

    const windNoise = this.ctx.createBufferSource();
    windNoise.buffer = noiseBuffer;
    windNoise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(400, this.ctx.currentTime);

    this.windGain = this.ctx.createGain();
    this.windGain.gain.setValueAtTime(0, this.ctx.currentTime);

    windNoise.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.masterGain);

    windNoise.start();
  }

  private setupCurbSound(): void {
    if (!this.ctx || !this.masterGain) return;

    this.curbOsc = this.ctx.createOscillator();
    this.curbOsc.type = 'square';
    this.curbOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

    const curbFilter = this.ctx.createBiquadFilter();
    curbFilter.type = 'lowpass';
    curbFilter.frequency.setValueAtTime(180, this.ctx.currentTime);

    this.curbGain = this.ctx.createGain();
    this.curbGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.curbOsc.connect(curbFilter);
    curbFilter.connect(this.curbGain);
    this.curbGain.connect(this.masterGain);

    this.curbOsc.start();
  }

  /**
   * Update continuous audio state based on telemetry.
   */
  public update(rpm: number, throttle: number, speedKmh: number, slipRatio: number, onCurb: boolean): void {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;

    const safeRpm = isFinite(rpm) && !isNaN(rpm) ? rpm : 900;
    const safeThrottle = isFinite(throttle) && !isNaN(throttle) ? Math.max(0, Math.min(1, throttle)) : 0;
    const safeSpeed = isFinite(speedKmh) && !isNaN(speedKmh) ? Math.max(0, speedKmh) : 0;
    const safeSlip = isFinite(slipRatio) && !isNaN(slipRatio) ? Math.max(0, Math.min(1, slipRatio)) : 0;

    const clampedRpm = Math.max(800, Math.min(8800, safeRpm));
    // V8 / 6-cylinder combustion firing rate: (RPM / 60) * 3.6
    let baseFreq = (clampedRpm / 60) * 3.6;
    if (!isFinite(baseFreq)) baseFreq = 65;

    // Rev Limiter Ignition Cut Stutter
    if (clampedRpm >= 8450) {
      if (Math.random() < 0.45) {
        this.isRevLimiting = true;
        baseFreq *= 0.88;
      } else {
        this.isRevLimiting = false;
      }
    } else {
      this.isRevLimiting = false;
    }

    // Update Dual-Oscillator Frequencies
    if (this.oscSaw && this.oscSquare && this.oscSub && isFinite(baseFreq)) {
      this.oscSaw.frequency.setTargetAtTime(baseFreq, now, 0.035);
      this.oscSquare.frequency.setTargetAtTime(baseFreq * 1.995, now, 0.035);
      this.oscSub.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.035);
    }

    // Dynamic Engine Lowpass Filter: opens up with RPM and throttle load
    if (this.engineFilter) {
      const filterFreq = 380 + (clampedRpm / 8500) * 3200 + safeThrottle * 1400;
      if (isFinite(filterFreq)) {
        this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.04);
      }
    }

    // Dynamic Engine Volume: smooth exponential response to throttle & RPM
    if (this.engineGain) {
      let targetVol = 0.16 + (clampedRpm / 8500) * 0.32 + safeThrottle * 0.28;
      if (this.isRevLimiting) {
        targetVol *= 0.35; // Rapid ignition cut drop
      }
      if (isFinite(targetVol)) {
        this.engineGain.gain.setTargetAtTime(targetVol, now, 0.035);
      }
    }

    // 2. Sharp Tire Squeal & Screech
    if (this.squealGain && this.squealFilter && this.screechGain && this.screechOsc) {
      if (safeSlip > 0.18 && safeSpeed > 10) {
        const slipIntensity = Math.min(1.0, (safeSlip - 0.18) / 0.55);
        const squealVol = 0.12 + slipIntensity * 0.38;
        const screechVol = 0.08 + slipIntensity * 0.32;
        const squealFreq = 1050 + slipIntensity * 650;
        const screechFreq = 1350 + slipIntensity * 950;

        this.squealGain.gain.setTargetAtTime(squealVol, now, 0.04);
        this.squealFilter.frequency.setTargetAtTime(squealFreq, now, 0.04);
        this.screechGain.gain.setTargetAtTime(screechVol, now, 0.04);
        this.screechOsc.frequency.setTargetAtTime(screechFreq, now, 0.04);
      } else {
        this.squealGain.gain.setTargetAtTime(0, now, 0.08);
        this.screechGain.gain.setTargetAtTime(0, now, 0.08);
      }
    }

    // 3. Aerodynamic Wind Noise
    if (this.windGain && this.windFilter) {
      const normSpeed = Math.min(1.0, safeSpeed / 280);
      const windVol = Math.pow(normSpeed, 1.8) * 0.36;
      const windFreq = 280 + normSpeed * 1350;
      if (isFinite(windVol)) this.windGain.gain.setTargetAtTime(windVol, now, 0.08);
      if (isFinite(windFreq)) this.windFilter.frequency.setTargetAtTime(windFreq, now, 0.08);
    }

    // 4. Curb Rumble Vibration
    if (this.curbGain && this.curbOsc) {
      if (onCurb && safeSpeed > 15) {
        const curbSpeedFactor = Math.min(1.0, safeSpeed / 160);
        const curbVol = 0.32 * curbSpeedFactor;
        const curbFreq = 40 + curbSpeedFactor * 55;
        if (isFinite(curbVol)) this.curbGain.gain.setTargetAtTime(curbVol, now, 0.035);
        if (isFinite(curbFreq)) this.curbOsc.frequency.setTargetAtTime(curbFreq, now, 0.035);
      } else {
        this.curbGain.gain.setTargetAtTime(0, now, 0.05);
      }
    }
  }

  /**
   * Synthesize multi-burst exhaust backfire pop upon high-rev upshifts.
   */
  public triggerShiftPop(rpm: number): void {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    if (rpm < 4600) return;

    const now = this.ctx.currentTime;
    const popCount = rpm > 6800 ? 3 : 2;

    for (let p = 0; p < popCount; p++) {
      const delay = p * 0.038 + Math.random() * 0.012;
      const popTime = now + delay;

      const burstLength = 0.09;
      const bufferSize = Math.floor(this.ctx.sampleRate * burstLength);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.18));
      }

      const popSource = this.ctx.createBufferSource();
      popSource.buffer = buffer;

      const popFilter = this.ctx.createBiquadFilter();
      popFilter.type = 'bandpass';
      popFilter.frequency.setValueAtTime(750 + (Math.random() - 0.5) * 200, popTime);
      popFilter.Q.setValueAtTime(2.2, popTime);

      const popGain = this.ctx.createGain();
      const intensity = Math.min(0.65, (rpm / 8500) * 0.6) * (1.0 - p * 0.22);
      popGain.gain.setValueAtTime(intensity, popTime);
      popGain.gain.exponentialRampToValueAtTime(0.001, popTime + burstLength);

      popSource.connect(popFilter);
      popFilter.connect(popGain);
      popGain.connect(this.masterGain!);

      popSource.start(popTime);
      popSource.stop(popTime + burstLength);

      // Deep sub thump on the first pop
      if (p === 0) {
        const subOsc = this.ctx.createOscillator();
        subOsc.type = 'triangle';
        subOsc.frequency.setValueAtTime(120, popTime);
        subOsc.frequency.exponentialRampToValueAtTime(32, popTime + 0.09);

        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(intensity * 0.8, popTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, popTime + 0.09);

        subOsc.connect(subGain);
        subGain.connect(this.masterGain!);

        subOsc.start(popTime);
        subOsc.stop(popTime + 0.09);
      }
    }
  }

  /**
   * Visceral crash and impact sound effect:
   * Synthesizes heavy chassis thud + metallic crumple/scrape.
   */
  public triggerCrashSound(impactSpeed: number): void {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    if (impactSpeed < 2.5) return;

    const now = this.ctx.currentTime;
    const intensity = Math.min(1.0, Math.max(0.25, (impactSpeed / 35.0)));
    const duration = 0.22 + intensity * 0.15;

    // 1. Heavy low-frequency body thud (180Hz -> 28Hz)
    const thudOsc = this.ctx.createOscillator();
    thudOsc.type = 'triangle';
    thudOsc.frequency.setValueAtTime(175 * Math.min(1.2, intensity + 0.4), now);
    thudOsc.frequency.exponentialRampToValueAtTime(28, now + duration);

    const thudGain = this.ctx.createGain();
    thudGain.gain.setValueAtTime(intensity * 0.9, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    thudOsc.connect(thudGain);
    thudGain.connect(this.masterGain!);
    thudOsc.start(now);
    thudOsc.stop(now + duration);

    // 2. Metallic scrape / crunch noise burst
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.35));
    }

    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(1200 + Math.random() * 400, now);
    noiseFilter.Q.setValueAtTime(3.5, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(intensity * 0.65, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noiseSource.start(now);
    noiseSource.stop(now + duration);
  }

  private makeDistortionCurve(amount: number = 20): Float32Array<ArrayBuffer> {
    const k = amount;
    const n_samples = 44100;
    const buffer = new ArrayBuffer(n_samples * 4);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.75, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }
}

/**
 * Procedural Web Audio API Sound Engine (Acoustically Balanced Edition).
 * Synthesizes high-fidelity internal combustion engine growl, warm exhaust crackles,
 * authentic rubber tire scrub on asphalt, subtle aerodynamic wind rush, and curb rumble.
 * Features studio-grade DynamicsCompressor, soft-saturation limiter, and non-fatiguing EQ.
 * Zero external audio files required.
 */
export class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isInitialized: boolean = false;

  // Master Dynamics & Volume
  private masterGain: GainNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;

  // Rich Multi-Harmonic Engine Synthesizer (Triangle + Low-cut Sawtooth + Sub)
  private oscSaw: OscillatorNode | null = null;     // Mechanical bite
  private oscTriangle: OscillatorNode | null = null; // Warm combustion fundamental
  private oscSub: OscillatorNode | null = null;      // Deep engine bass pulse
  private sawPreFilter: BiquadFilterNode | null = null; // De-harshing filter for saw
  private engineFilter: BiquadFilterNode | null = null;
  private engineDistortion: WaveShaperNode | null = null;
  private engineGain: GainNode | null = null;

  // Rev limiter state
  private isRevLimiting: boolean = false;

  // Natural Tire Scrub & Asphalt Friction (Non-piercing Pink Noise + Body Rumble)
  private squealNoise: AudioBufferSourceNode | null = null;
  private squealFilter: BiquadFilterNode | null = null;
  private squealGain: GainNode | null = null;
  private scrubRumbleOsc: OscillatorNode | null = null;
  private scrubRumbleGain: GainNode | null = null;

  // Aerodynamic Wind Rush
  private windGain: GainNode | null = null;
  private windFilter: BiquadFilterNode | null = null;

  // Curb Rumble Strip Vibration
  private curbOsc: OscillatorNode | null = null;
  private curbGain: GainNode | null = null;

  // Straight-Cut Transmission Gearbox Whine (Subtle Ambience)
  private gearWhineOsc: OscillatorNode | null = null;
  private gearWhineGain: GainNode | null = null;
  private gearWhineFilter: BiquadFilterNode | null = null;

  constructor() {}

  public init(): void {
    if (this.isInitialized) return;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      // Studio-grade Dynamics Compressor on Master Bus: prevents digital clipping, harsh spikes & booming
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);
      this.compressor.connect(this.ctx.destination);

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.48, this.ctx.currentTime);
      this.masterGain.connect(this.compressor);

      this.setupEngineSound();
      this.setupNaturalTireScrub();
      this.setupWindSound();
      this.setupCurbSound();
      this.setupTransmissionWhine();

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
   * Warm, Powerful Engine Sound Synthesis.
   * Utilizes warm Triangle wave for combustion thump, lowpass-filtered Sawtooth for exhaust rasp,
   * gentle tube-style soft saturation, and smooth Butterworth tracking lowpass filter (Q = 0.85).
   */
  private setupEngineSound(): void {
    if (!this.ctx || !this.masterGain) return;

    const now = this.ctx.currentTime;

    // 1. Warm Triangle wave (primary combustion body)
    this.oscTriangle = this.ctx.createOscillator();
    this.oscTriangle.type = 'triangle';
    this.oscTriangle.frequency.setValueAtTime(55, now);

    // 2. Sawtooth wave (mechanical texture, detuned slightly by +1.5 cents for stereo body)
    this.oscSaw = this.ctx.createOscillator();
    this.oscSaw.type = 'sawtooth';
    this.oscSaw.frequency.setValueAtTime(55, now);
    this.oscSaw.detune.setValueAtTime(1.5, now);

    // Pre-filter on Sawtooth to eliminate harsh buzzy highs before saturation
    this.sawPreFilter = this.ctx.createBiquadFilter();
    this.sawPreFilter.type = 'lowpass';
    this.sawPreFilter.frequency.setValueAtTime(1100, now);
    this.sawPreFilter.Q.setValueAtTime(0.7, now);
    this.oscSaw.connect(this.sawPreFilter);

    // 3. Sub-bass pulse (deep 4-stroke thud under load)
    this.oscSub = this.ctx.createOscillator();
    this.oscSub.type = 'sine';
    this.oscSub.frequency.setValueAtTime(27.5, now);

    // Balance sub-mix gains: smooth body > harsh rasp
    const triGain = this.ctx.createGain();
    triGain.gain.setValueAtTime(0.45, now);
    this.oscTriangle.connect(triGain);

    const sawGain = this.ctx.createGain();
    sawGain.gain.setValueAtTime(0.22, now);
    this.sawPreFilter.connect(sawGain);

    const subGain = this.ctx.createGain();
    subGain.gain.setValueAtTime(0.32, now);
    this.oscSub.connect(subGain);

    const engineMixer = this.ctx.createGain();
    triGain.connect(engineMixer);
    sawGain.connect(engineMixer);
    subGain.connect(engineMixer);

    // Gentle Warm Tube-style WaveShaper Soft Saturation (tanh-like, amount = 3.5)
    this.engineDistortion = this.ctx.createWaveShaper();
    this.engineDistortion.curve = this.makeSmoothSaturationCurve(3.5);
    this.engineDistortion.oversample = '2x';

    // Dynamic Lowpass Filter: smooth non-resonant response (Q = 0.85)
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(450, now);
    this.engineFilter.Q.setValueAtTime(0.85, now);

    // Engine Output Volume
    this.engineGain = this.ctx.createGain();
    this.engineGain.gain.setValueAtTime(0.22, now);

    // Connection Chain
    engineMixer.connect(this.engineDistortion);
    this.engineDistortion.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.oscTriangle.start();
    this.oscSaw.start();
    this.oscSub.start();
  }

  /**
   * Natural Tire Scrub & Asphalt Friction:
   * Replaced ear-piercing 2000Hz sawtooth screech with organic, bandpassed pink noise
   * and low-frequency rubber deformation scrub rumble.
   */
  private setupNaturalTireScrub(): void {
    if (!this.ctx || !this.masterGain) return;

    // Layer A: Organic Pink/Brown Noise Friction Buffer
    const bufferSize = this.ctx.sampleRate * 2;
    const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      // Pink noise filter algorithm
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      output[i] = (b0 + b1 + b2 + white * 0.5362) * 0.12;
    }

    this.squealNoise = this.ctx.createBufferSource();
    this.squealNoise.buffer = noiseBuffer;
    this.squealNoise.loop = true;

    // Bandpass tuned to authentic rubber scrub on tarmac (850 - 1300 Hz, Q = 1.3)
    this.squealFilter = this.ctx.createBiquadFilter();
    this.squealFilter.type = 'bandpass';
    this.squealFilter.frequency.setValueAtTime(950, this.ctx.currentTime);
    this.squealFilter.Q.setValueAtTime(1.3, this.ctx.currentTime);

    this.squealGain = this.ctx.createGain();
    this.squealGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.squealNoise.connect(this.squealFilter);
    this.squealFilter.connect(this.squealGain);
    this.squealGain.connect(this.masterGain);
    this.squealNoise.start();

    // Layer B: Heavy Lateral Tire Load Scrub Rumble (220 Hz low body)
    this.scrubRumbleOsc = this.ctx.createOscillator();
    this.scrubRumbleOsc.type = 'triangle';
    this.scrubRumbleOsc.frequency.setValueAtTime(220, this.ctx.currentTime);

    const rumbleFilter = this.ctx.createBiquadFilter();
    rumbleFilter.type = 'lowpass';
    rumbleFilter.frequency.setValueAtTime(320, this.ctx.currentTime);

    this.scrubRumbleGain = this.ctx.createGain();
    this.scrubRumbleGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.scrubRumbleOsc.connect(rumbleFilter);
    rumbleFilter.connect(this.scrubRumbleGain);
    this.scrubRumbleGain.connect(this.masterGain);
    this.scrubRumbleOsc.start();
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
      output[i] *= 2.4;
    }

    const windNoise = this.ctx.createBufferSource();
    windNoise.buffer = noiseBuffer;
    windNoise.loop = true;

    this.windFilter = this.ctx.createBiquadFilter();
    this.windFilter.type = 'lowpass';
    this.windFilter.frequency.setValueAtTime(320, this.ctx.currentTime);

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
    this.curbOsc.type = 'triangle';
    this.curbOsc.frequency.setValueAtTime(48, this.ctx.currentTime);

    const curbFilter = this.ctx.createBiquadFilter();
    curbFilter.type = 'lowpass';
    curbFilter.frequency.setValueAtTime(150, this.ctx.currentTime);

    this.curbGain = this.ctx.createGain();
    this.curbGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.curbOsc.connect(curbFilter);
    curbFilter.connect(this.curbGain);
    this.curbGain.connect(this.masterGain);

    this.curbOsc.start();
  }

  /**
   * Subtle Straight-Cut Dogbox Whine (Mellow Background Ambiance).
   */
  private setupTransmissionWhine(): void {
    if (!this.ctx || !this.masterGain) return;

    this.gearWhineOsc = this.ctx.createOscillator();
    this.gearWhineOsc.type = 'sine';
    this.gearWhineOsc.frequency.setValueAtTime(350, this.ctx.currentTime);

    this.gearWhineFilter = this.ctx.createBiquadFilter();
    this.gearWhineFilter.type = 'lowpass';
    this.gearWhineFilter.frequency.setValueAtTime(950, this.ctx.currentTime);
    this.gearWhineFilter.Q.setValueAtTime(0.8, this.ctx.currentTime);

    this.gearWhineGain = this.ctx.createGain();
    this.gearWhineGain.gain.setValueAtTime(0, this.ctx.currentTime);

    this.gearWhineOsc.connect(this.gearWhineFilter);
    this.gearWhineFilter.connect(this.gearWhineGain);
    this.gearWhineGain.connect(this.masterGain);

    this.gearWhineOsc.start();
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

    const clampedRpm = Math.max(850, Math.min(8550, safeRpm));
    // V8 firing pulse fundamental frequency: (RPM / 60) * 3.2
    let baseFreq = (clampedRpm / 60) * 3.2;
    if (!isFinite(baseFreq)) baseFreq = 50;

    // Rev Limiter Stutter: gentle ignition cut without harsh ear assault
    if (clampedRpm >= 8450) {
      if (Math.random() < 0.45) {
        this.isRevLimiting = true;
        baseFreq *= 0.92;
      } else {
        this.isRevLimiting = false;
      }
    } else {
      this.isRevLimiting = false;
    }

    // Update Engine Frequencies
    if (this.oscTriangle && this.oscSaw && this.oscSub && isFinite(baseFreq)) {
      this.oscTriangle.frequency.setTargetAtTime(baseFreq, now, 0.035);
      this.oscSaw.frequency.setTargetAtTime(baseFreq * 1.995, now, 0.035);
      this.oscSub.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.035);
    }

    // Dynamic Lowpass Filter: opens warmly with load & RPM (380Hz idle -> 1950Hz redline)
    if (this.engineFilter) {
      const filterFreq = 380 + (clampedRpm / 8500) * 1250 + safeThrottle * 550;
      if (isFinite(filterFreq)) {
        this.engineFilter.frequency.setTargetAtTime(filterFreq, now, 0.04);
      }
    }

    // Dynamic Engine Volume: pleasant non-fatiguing levels
    if (this.engineGain) {
      let targetVol = 0.16 + (clampedRpm / 8500) * 0.16 + safeThrottle * 0.14;
      if (this.isRevLimiting) {
        targetVol *= 0.45;
      }
      if (isFinite(targetVol)) {
        this.engineGain.gain.setTargetAtTime(targetVol, now, 0.035);
      }
    }

    // 2. Tire Scrub & Sliding (Smooth asphalt scrub, no screech)
    if (this.squealGain && this.squealFilter && this.scrubRumbleGain) {
      if (safeSlip > 0.22 && safeSpeed > 10) {
        const slipIntensity = Math.min(1.0, (safeSlip - 0.22) / 0.50);
        const scrubVol = 0.06 + slipIntensity * 0.14;
        const scrubFreq = 850 + slipIntensity * 380;
        const rumbleVol = 0.04 + slipIntensity * 0.10;

        this.squealGain.gain.setTargetAtTime(scrubVol, now, 0.04);
        this.squealFilter.frequency.setTargetAtTime(scrubFreq, now, 0.04);
        this.scrubRumbleGain.gain.setTargetAtTime(rumbleVol, now, 0.04);
      } else {
        this.squealGain.gain.setTargetAtTime(0, now, 0.08);
        this.scrubRumbleGain.gain.setTargetAtTime(0, now, 0.08);
      }
    }

    // 3. Aerodynamic Wind Noise
    if (this.windGain && this.windFilter) {
      const normSpeed = Math.min(1.0, safeSpeed / 280);
      const windVol = Math.pow(normSpeed, 2.0) * 0.18;
      const windFreq = 240 + normSpeed * 750;
      if (isFinite(windVol)) this.windGain.gain.setTargetAtTime(windVol, now, 0.08);
      if (isFinite(windFreq)) this.windFilter.frequency.setTargetAtTime(windFreq, now, 0.08);
    }

    // 4. Curb Rumble Vibration
    if (this.curbGain && this.curbOsc) {
      if (onCurb && safeSpeed > 15) {
        const curbSpeedFactor = Math.min(1.0, safeSpeed / 160);
        const curbVol = 0.20 * curbSpeedFactor;
        const curbFreq = 42 + curbSpeedFactor * 45;
        if (isFinite(curbVol)) this.curbGain.gain.setTargetAtTime(curbVol, now, 0.035);
        if (isFinite(curbFreq)) this.curbOsc.frequency.setTargetAtTime(curbFreq, now, 0.035);
      } else {
        this.curbGain.gain.setTargetAtTime(0, now, 0.05);
      }
    }

    // 5. Straight-Cut Transmission Gearbox Whine (Mellow background ambiance)
    if (this.gearWhineGain && this.gearWhineOsc) {
      if (safeSpeed > 12) {
        const whineFreq = 340 + safeSpeed * 5.8;
        const whineVol = Math.min(0.065, (safeSpeed / 250) * 0.045 + safeThrottle * 0.02);
        this.gearWhineOsc.frequency.setTargetAtTime(whineFreq, now, 0.04);
        this.gearWhineGain.gain.setTargetAtTime(whineVol, now, 0.05);
      } else {
        this.gearWhineGain.gain.setTargetAtTime(0, now, 0.06);
      }
    }
  }

  /**
   * Warm multi-burst exhaust crackle upon high-rev upshifts.
   */
  public triggerShiftPop(rpm: number): void {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    if (rpm < 4800) return;

    const now = this.ctx.currentTime;
    const popCount = rpm > 7000 ? 2 : 1;

    for (let p = 0; p < popCount; p++) {
      const delay = p * 0.045 + Math.random() * 0.015;
      const popTime = now + delay;

      const burstLength = 0.08;
      const bufferSize = Math.floor(this.ctx.sampleRate * burstLength);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.20));
      }

      const popSource = this.ctx.createBufferSource();
      popSource.buffer = buffer;

      const popFilter = this.ctx.createBiquadFilter();
      popFilter.type = 'bandpass';
      popFilter.frequency.setValueAtTime(520 + (Math.random() - 0.5) * 150, popTime);
      popFilter.Q.setValueAtTime(1.8, popTime);

      const popGain = this.ctx.createGain();
      const intensity = Math.min(0.28, (rpm / 8500) * 0.28) * (1.0 - p * 0.25);
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
        subOsc.frequency.setValueAtTime(95, popTime);
        subOsc.frequency.exponentialRampToValueAtTime(28, popTime + 0.08);

        const subGain = this.ctx.createGain();
        subGain.gain.setValueAtTime(intensity * 0.85, popTime);
        subGain.gain.exponentialRampToValueAtTime(0.001, popTime + 0.08);

        subOsc.connect(subGain);
        subGain.connect(this.masterGain!);

        subOsc.start(popTime);
        subOsc.stop(popTime + 0.08);
      }
    }
  }

  /**
   * Heavy low-frequency body thud + crumple for crash sound.
   */
  public triggerCrashSound(impactSpeed: number): void {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    if (impactSpeed < 2.5) return;

    const now = this.ctx.currentTime;
    const intensity = Math.min(0.65, Math.max(0.18, (impactSpeed / 40.0)));
    const duration = 0.24 + intensity * 0.12;

    // 1. Heavy low-frequency body thud (150Hz -> 28Hz)
    const thudOsc = this.ctx.createOscillator();
    thudOsc.type = 'triangle';
    thudOsc.frequency.setValueAtTime(140 * Math.min(1.2, intensity + 0.4), now);
    thudOsc.frequency.exponentialRampToValueAtTime(28, now + duration);

    const thudGain = this.ctx.createGain();
    thudGain.gain.setValueAtTime(intensity * 0.65, now);
    thudGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    thudOsc.connect(thudGain);
    thudGain.connect(this.masterGain!);
    thudOsc.start(now);
    thudOsc.stop(now + duration);

    // 2. Muffled crunch burst
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
    noiseFilter.frequency.setValueAtTime(800 + Math.random() * 250, now);
    noiseFilter.Q.setValueAtTime(2.0, now);

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(intensity * 0.45, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.masterGain!);
    noiseSource.start(now);
    noiseSource.stop(now + duration);
  }

  /**
   * Subtle Turbo blow-off valve (BOV) flutter.
   */
  public triggerBovFlutter(): void {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const flutterCount = 3;
    for (let f = 0; f < flutterCount; f++) {
      const startTime = now + f * 0.055;
      const duration = 0.05;
      const bufferSize = Math.floor(this.ctx.sampleRate * duration);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.22));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800 - f * 220, startTime);
      filter.Q.setValueAtTime(2.8, startTime);

      const gain = this.ctx.createGain();
      const vol = 0.12 * Math.pow(0.70, f);
      gain.gain.setValueAtTime(vol, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain!);

      noise.start(startTime);
      noise.stop(startTime + duration);
    }
  }

  /**
   * Clear, pleasant F1 starting countdown light beeps.
   */
  public playCountdownBeep(isGo: boolean = false): void {
    if (!this.isInitialized || !this.ctx || this.isMuted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (isGo) {
      // High bright start chime
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(880, now); // A5 note
      osc.frequency.setValueAtTime(1174.66, now + 0.10); // D6 note
      gain.gain.setValueAtTime(0.38, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.45);
    } else {
      // Crisp countdown red light beep
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now); // A4 note
      gain.gain.setValueAtTime(0.32, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
      osc.connect(gain);
      gain.connect(this.masterGain!);
      osc.start(now);
      osc.stop(now + 0.14);
    }
  }

  /**
   * Smooth Tube-style Saturation Curve (tanh-like):
   * Softens wave peaks without introducing harsh odd-harmonic distortion.
   */
  private makeSmoothSaturationCurve(amount: number = 3.5): Float32Array<ArrayBuffer> {
    const n_samples = 44100;
    const buffer = new ArrayBuffer(n_samples * 4);
    const curve = new Float32Array(buffer);
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      // Hyperbolic tangent saturation
      curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
    }
    return curve;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(this.isMuted ? 0 : 0.48, this.ctx.currentTime, 0.05);
    }
    return this.isMuted;
  }
}

import { VehicleTelemetry } from '../vehicles/VehicleTypes';
import { CameraViewMode } from '../rendering/CameraController';
import { WeatherMode } from '../rendering/SkyboxGenerator';
import { TrackWaypoints } from '../track/TrackWaypoints';
import { AICarInstance } from '../vehicles/AISystem';

/**
 * Professional Motorsport Telemetry HUD.
 * High-performance SVG/Canvas/HTML5 overlay featuring:
 * - Speedometer & Gear indicator
 * - Dynamic Tachometer with Sequential Shift Light LEDs
 * - Throttle & Brake Pedals telemetry
 * - G-Force telemetry friction circle
 * - Lap & 3-Sector timing board with delta highlights
 * - Real-time Track Mini-map with AI markers
 * - Interactive HUD buttons
 */
export class HUD {
  private container: HTMLDivElement;

  // DOM elements
  private speedEl!: HTMLElement;
  private gearEl!: HTMLElement;
  private modeEl!: HTMLElement;
  private rpmTextEl!: HTMLElement;
  private throttleBarEl!: HTMLElement;
  private brakeBarEl!: HTMLElement;
  private boostBarEl!: HTMLElement;
  private gBallEl!: HTMLElement;

  // Shift light LEDs
  private shiftLeds: HTMLElement[] = [];

  // Timing DOM
  private lapNumEl!: HTMLElement;
  private currentLapTimeEl!: HTMLElement;
  private bestLapTimeEl!: HTMLElement;
  private lastLapTimeEl!: HTMLElement;
  private s1El!: HTMLElement;
  private s2El!: HTMLElement;
  private s3El!: HTMLElement;

  // Mini-map
  private mapCanvas!: HTMLCanvasElement;
  private mapCtx!: CanvasRenderingContext2D;

  // Tachometer Canvas
  private tachCanvas!: HTMLCanvasElement;
  private tachCtx!: CanvasRenderingContext2D;

  // Recovery Alert
  private recoveryTipEl!: HTMLElement;

  // Race Position DOM
  private posBadgeEl!: HTMLElement;

  // FIA Countdown Lights DOM
  public countdownOverlayEl!: HTMLElement;
  private cdBulbs: HTMLElement[] = [];
  private cdBannerEl!: HTMLElement;
  private isCountingDown: boolean = false;

  public startScreenEl!: HTMLElement;
  public onStartClicked?: () => void;
  public onCountdownStage?: (stage: number) => void;
  public onCameraClicked?: () => void;
  public onWeatherClicked?: () => void;
  public onResetClicked?: () => void;
  public onAudioClicked?: () => void;
  public onModeClicked?: () => void;

  constructor(private waypoints: TrackWaypoints) {
    this.container = document.createElement('div');
    this.container.id = 'hud-container';
    document.body.appendChild(this.container);

    this.injectStyles();
    this.buildDOM();
    this.initMiniMap();
  }

  private injectStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box;
        user-select: none;
        -webkit-user-select: none;
      }
      body, html {
        margin: 0;
        padding: 0;
        width: 100%;
        height: 100%;
        overflow: hidden;
        background: #000;
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
      }
      #game-canvas {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 1;
      }
      #hud-container {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 10;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        padding: 16px;
      }
      .interactive {
        pointer-events: auto;
      }

      /* Glass panel styling */
      .hud-panel {
        background: rgba(12, 16, 26, 0.72);
        backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45);
        color: #fff;
      }

      /* Top Bar: Timing & Controls */
      .hud-top {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        width: 100%;
      }
      .timing-board {
        padding: 14px 20px;
        min-width: 280px;
      }
      .timing-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 13px;
        letter-spacing: 0.5px;
      }
      .timing-row.main {
        font-size: 24px;
        font-weight: 700;
        font-family: 'Consolas', 'Courier New', monospace;
        color: #00e5ff;
        margin-bottom: 10px;
      }
      .sector-container {
        display: flex;
        gap: 8px;
        margin-top: 10px;
      }
      .sector-box {
        flex: 1;
        padding: 6px 4px;
        text-align: center;
        background: rgba(255, 255, 255, 0.05);
        border-radius: 4px;
        font-size: 11px;
        font-weight: bold;
        border: 1px solid rgba(255, 255, 255, 0.1);
      }
      .sector-purple { background: rgba(186, 85, 211, 0.4); border-color: #ba55d3; color: #f3c4fb; }
      .sector-green { background: rgba(46, 204, 113, 0.4); border-color: #2ecc71; color: #a3f7c4; }
      .sector-yellow { background: rgba(241, 196, 15, 0.4); border-color: #f1c40f; color: #fef1b8; }

      .pos-badge {
        font-size: 15px;
        font-weight: 900;
        padding: 2px 8px;
        border-radius: 4px;
        background: rgba(255, 204, 0, 0.2);
        border: 1px solid #ffcc00;
        color: #ffcc00;
        letter-spacing: 1px;
        margin-right: 8px;
      }
      .pos-badge.p1 {
        background: linear-gradient(135deg, rgba(255, 215, 0, 0.4), rgba(255, 140, 0, 0.3));
        border-color: #ffd700;
        color: #ffffff;
        text-shadow: 0 0 8px #ffd700;
        box-shadow: 0 0 12px rgba(255, 215, 0, 0.4);
      }

      /* Countdown Lights Overlay */
      .countdown-overlay {
        position: absolute;
        top: 28%;
        left: 50%;
        transform: translate(-50%, -50%);
        display: flex;
        flex-direction: column;
        align-items: center;
        z-index: 200;
        pointer-events: none;
      }
      .countdown-housing {
        display: flex;
        gap: 18px;
        background: rgba(12, 16, 26, 0.95);
        border: 2px solid rgba(255, 255, 255, 0.35);
        border-radius: 20px;
        padding: 18px 30px;
        box-shadow: 0 12px 50px rgba(0, 0, 0, 0.9);
      }
      .cd-bulb {
        width: 44px;
        height: 44px;
        border-radius: 50%;
        background: #1c0505;
        border: 3px solid rgba(255, 255, 255, 0.25);
        transition: background 0.05s, box-shadow 0.05s;
      }
      .cd-bulb.on {
        background: #ff1111;
        box-shadow: 0 0 30px #ff1111, 0 0 60px rgba(255, 20, 20, 0.9);
      }
      .countdown-banner {
        margin-top: 18px;
        font-size: 34px;
        font-weight: 900;
        letter-spacing: 3px;
        color: #00ff66;
        text-shadow: 0 0 25px #00ff66, 0 0 50px rgba(0, 255, 102, 0.6);
        opacity: 0;
        transform: scale(0.85);
        transition: opacity 0.2s, transform 0.2s;
      }
      .countdown-banner.show {
        opacity: 1;
        transform: scale(1.0);
      }

      /* Top Center: Shift Light LEDs */
      .shift-light-bar {
        display: flex;
        gap: 6px;
        padding: 10px 16px;
        border-radius: 20px;
      }
      .shift-led {
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: #222;
        border: 1px solid rgba(255, 255, 255, 0.2);
        transition: background 0.05s, box-shadow 0.05s;
      }
      .shift-led.green { background: #00ff66; box-shadow: 0 0 10px #00ff66; }
      .shift-led.amber { background: #ffaa00; box-shadow: 0 0 10px #ffaa00; }
      .shift-led.red { background: #ff2222; box-shadow: 0 0 12px #ff2222; }
      .shift-led.blue-flash { background: #00e5ff; box-shadow: 0 0 16px #00e5ff; animation: flash 0.1s infinite alternate; }

      @keyframes flash {
        0% { opacity: 0.3; }
        100% { opacity: 1; }
      }

      /* Top Right: Mini-map */
      .map-panel {
        padding: 10px;
        width: 190px;
        height: 190px;
        display: flex;
        justify-content: center;
        align-items: center;
      }
      #minimap-canvas {
        width: 170px;
        height: 170px;
      }

      /* Bottom: Primary Cockpit Telemetry */
      .hud-bottom {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        width: 100%;
      }

      /* G-Force Ball & Pedals (Bottom Left) */
      .telemetry-left {
        display: flex;
        gap: 16px;
        align-items: flex-end;
      }
      .g-meter-panel {
        width: 110px;
        height: 110px;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        position: relative;
      }
      .g-circle {
        width: 74px;
        height: 74px;
        border: 1px dashed rgba(255, 255, 255, 0.3);
        border-radius: 50%;
        position: relative;
      }
      .g-ball {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: #00e5ff;
        box-shadow: 0 0 8px #00e5ff;
        position: absolute;
        top: 31px;
        left: 31px;
        transition: transform 0.05s linear;
      }
      .g-label {
        font-size: 10px;
        color: rgba(255, 255, 255, 0.6);
        margin-top: 4px;
      }

      /* Pedal input bars */
      .pedal-panel {
        display: flex;
        gap: 10px;
        padding: 12px 14px;
        height: 110px;
        align-items: flex-end;
      }
      .pedal-col {
        display: flex;
        flex-direction: column;
        align-items: center;
        height: 100%;
        justify-content: space-between;
      }
      .pedal-track {
        width: 14px;
        height: 72px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 3px;
        position: relative;
        overflow: hidden;
      }
      .pedal-fill {
        position: absolute;
        bottom: 0;
        width: 100%;
        border-radius: 3px;
        transition: height 0.05s linear;
      }
      .throttle-fill { background: linear-gradient(to top, #00bb44, #00ff66); }
      .brake-fill { background: linear-gradient(to top, #bb1111, #ff2222); }
      .pedal-label {
        font-size: 10px;
        font-weight: bold;
        color: rgba(255, 255, 255, 0.6);
      }

      /* Bottom Center: Speedometer & Tachometer */
      .cluster-center {
        display: flex;
        flex-direction: column;
        align-items: center;
        position: relative;
      }
      #tachometer-canvas {
        width: 380px;
        height: 140px;
      }
      .cluster-info {
        position: absolute;
        bottom: 12px;
        display: flex;
        align-items: baseline;
        gap: 14px;
      }
      .gear-box {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .gear-val {
        font-size: 56px;
        font-weight: 900;
        font-family: 'Consolas', monospace;
        color: #ffcc00;
        line-height: 1;
        text-shadow: 0 0 15px rgba(255, 204, 0, 0.4);
      }
      .mode-tag {
        font-size: 12px;
        font-weight: 800;
        padding: 2px 6px;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 4px;
        color: #fff;
        cursor: pointer;
      }
      .speed-box {
        display: flex;
        align-items: baseline;
        gap: 4px;
      }
      .speed-val {
        font-size: 48px;
        font-weight: 800;
        font-family: 'Consolas', monospace;
        color: #fff;
        line-height: 1;
      }
      .speed-unit {
        font-size: 14px;
        font-weight: 600;
        color: rgba(255, 255, 255, 0.5);
      }

      /* Boost DRS Bar */
      .boost-container {
        width: 320px;
        margin-top: 6px;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .boost-track {
        flex: 1;
        height: 8px;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 4px;
        overflow: hidden;
      }
      .boost-fill {
        height: 100%;
        background: linear-gradient(90deg, #0099ff, #00ffff);
        box-shadow: 0 0 8px #00ffff;
        width: 100%;
        transition: width 0.05s linear;
      }
      .boost-tag {
        font-size: 11px;
        font-weight: bold;
        color: #00e5ff;
        letter-spacing: 1px;
      }

      /* Bottom Right: Quick Action Buttons & Shortcuts */
      .action-dock {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 10px;
      }
      .hud-btn {
        background: rgba(255, 255, 255, 0.08);
        border: 1px solid rgba(255, 255, 255, 0.15);
        border-radius: 6px;
        color: #fff;
        padding: 8px 12px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        transition: all 0.15s ease;
      }
      .hud-btn:hover {
        background: rgba(255, 255, 255, 0.2);
        border-color: #00e5ff;
      }
      .hud-btn .key {
        background: rgba(0, 0, 0, 0.5);
        padding: 2px 5px;
        border-radius: 3px;
        font-size: 10px;
        color: #00e5ff;
      }

      /* Start / Unlock Audio Splash Screen */
      #start-screen {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        z-index: 100;
        background: radial-gradient(circle at center, rgba(16, 22, 38, 0.94), rgba(6, 8, 14, 0.98));
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        color: #fff;
        pointer-events: auto;
      }
      .start-title {
        font-size: 44px;
        font-weight: 900;
        letter-spacing: 3px;
        margin-bottom: 8px;
        background: linear-gradient(90deg, #00e5ff, #ffffff, #ffaa00);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
      }
      .start-subtitle {
        font-size: 15px;
        color: rgba(255, 255, 255, 0.7);
        margin-bottom: 28px;
        letter-spacing: 1px;
      }
      .start-btn {
        background: linear-gradient(90deg, #00b4d8, #0077b6);
        border: none;
        padding: 14px 42px;
        border-radius: 30px;
        color: #fff;
        font-size: 18px;
        font-weight: 700;
        cursor: pointer;
        box-shadow: 0 0 25px rgba(0, 180, 216, 0.6);
        transition: transform 0.15s, box-shadow 0.15s;
        letter-spacing: 1px;
      }
      .start-btn:hover {
        transform: scale(1.05);
        box-shadow: 0 0 35px rgba(0, 229, 255, 0.8);
      }
      .start-controls-table {
        margin-top: 32px;
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        border-radius: 8px;
        padding: 16px 24px;
        font-size: 13px;
      }
      .ctrl-row {
        display: flex;
        justify-content: space-between;
        gap: 30px;
        margin: 6px 0;
      }
      .ctrl-key {
        color: #00e5ff;
        font-family: monospace;
        font-weight: bold;
      }
      .recovery-tip {
        position: absolute;
        top: 26%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(180, 20, 20, 0.90);
        color: #ffffff;
        padding: 12px 24px;
        border-radius: 8px;
        font-weight: 700;
        font-size: 15px;
        letter-spacing: 0.5px;
        border: 2px solid #ffcc00;
        box-shadow: 0 0 30px rgba(255, 60, 0, 0.7);
        display: none;
        pointer-events: none;
        z-index: 100;
        text-shadow: 0 1px 4px #000;
      }
    `;
    document.head.appendChild(style);
  }

  private buildDOM(): void {
    // 1. Top Section
    const topBar = document.createElement('div');
    topBar.className = 'hud-top';

    // Timing Board
    const timingBoard = document.createElement('div');
    timingBoard.className = 'hud-panel timing-board';
    timingBoard.innerHTML = `
      <div class="timing-row" style="align-items: center;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span class="pos-badge p1" id="hud-pos-badge">P1</span>
          <span>LAP <b id="hud-lap-num">1</b></span>
        </div>
        <span style="color: rgba(255,255,255,0.6)">BEST: <b id="hud-best-time">--:--.---</b></span>
      </div>
      <div class="timing-row main" id="hud-curr-time">0:00.000</div>
      <div class="timing-row" style="font-size: 11px; color: rgba(255,255,255,0.6)">
        <span>LAST: <b id="hud-last-time">--:--.---</b></span>
      </div>
      <div class="sector-container">
        <div class="sector-box" id="hud-s1">S1</div>
        <div class="sector-box" id="hud-s2">S2</div>
        <div class="sector-box" id="hud-s3">S3</div>
      </div>
    `;
    topBar.appendChild(timingBoard);

    // Shift Light LEDs
    const shiftBar = document.createElement('div');
    shiftBar.className = 'hud-panel shift-light-bar';
    for (let i = 0; i < 12; i++) {
      const led = document.createElement('div');
      led.className = 'shift-led';
      shiftBar.appendChild(led);
      this.shiftLeds.push(led);
    }
    topBar.appendChild(shiftBar);

    // Mini-map
    const mapPanel = document.createElement('div');
    mapPanel.className = 'hud-panel map-panel';
    this.mapCanvas = document.createElement('canvas');
    this.mapCanvas.id = 'minimap-canvas';
    this.mapCanvas.width = 170;
    this.mapCanvas.height = 170;
    this.mapCtx = this.mapCanvas.getContext('2d')!;
    mapPanel.appendChild(this.mapCanvas);
    topBar.appendChild(mapPanel);

    this.container.appendChild(topBar);

    // Countdown Lights Overlay
    this.countdownOverlayEl = document.createElement('div');
    this.countdownOverlayEl.className = 'countdown-overlay';
    this.countdownOverlayEl.style.display = 'none';
    this.countdownOverlayEl.innerHTML = `
      <div class="countdown-housing">
        <div class="cd-bulb" id="cd-0"></div>
        <div class="cd-bulb" id="cd-1"></div>
        <div class="cd-bulb" id="cd-2"></div>
        <div class="cd-bulb" id="cd-3"></div>
        <div class="cd-bulb" id="cd-4"></div>
      </div>
      <div class="countdown-banner" id="cd-banner">LIGHTS OUT AND AWAY WE GO!</div>
    `;
    this.container.appendChild(this.countdownOverlayEl);
    this.cdBulbs = [
      this.countdownOverlayEl.querySelector('#cd-0')!,
      this.countdownOverlayEl.querySelector('#cd-1')!,
      this.countdownOverlayEl.querySelector('#cd-2')!,
      this.countdownOverlayEl.querySelector('#cd-3')!,
      this.countdownOverlayEl.querySelector('#cd-4')!,
    ];
    this.cdBannerEl = this.countdownOverlayEl.querySelector('#cd-banner')!;

    // 2. Bottom Section
    const bottomBar = document.createElement('div');
    bottomBar.className = 'hud-bottom';

    // Telemetry Left (G-meter & Pedals)
    const telemLeft = document.createElement('div');
    telemLeft.className = 'telemetry-left';

    const gPanel = document.createElement('div');
    gPanel.className = 'hud-panel g-meter-panel';
    gPanel.innerHTML = `
      <div class="g-circle">
        <div class="g-ball" id="hud-g-ball"></div>
      </div>
      <span class="g-label">G-FORCE</span>
    `;
    telemLeft.appendChild(gPanel);

    const pedalPanel = document.createElement('div');
    pedalPanel.className = 'hud-panel pedal-panel';
    pedalPanel.innerHTML = `
      <div class="pedal-col">
        <div class="pedal-track">
          <div class="pedal-fill brake-fill" id="hud-brake-bar" style="height: 0%"></div>
        </div>
        <span class="pedal-label">BRK</span>
      </div>
      <div class="pedal-col">
        <div class="pedal-track">
          <div class="pedal-fill throttle-fill" id="hud-throttle-bar" style="height: 0%"></div>
        </div>
        <span class="pedal-label">THR</span>
      </div>
    `;
    telemLeft.appendChild(pedalPanel);
    bottomBar.appendChild(telemLeft);

    // Center Gauge Cluster
    const clusterCenter = document.createElement('div');
    clusterCenter.className = 'cluster-center';

    this.tachCanvas = document.createElement('canvas');
    this.tachCanvas.id = 'tachometer-canvas';
    this.tachCanvas.width = 380;
    this.tachCanvas.height = 140;
    this.tachCtx = this.tachCanvas.getContext('2d')!;
    clusterCenter.appendChild(this.tachCanvas);

    const clusterInfo = document.createElement('div');
    clusterInfo.className = 'cluster-info';
    clusterInfo.innerHTML = `
      <div class="gear-box">
        <span class="gear-val" id="hud-gear">1</span>
        <span class="mode-tag interactive" id="hud-mode">AT</span>
      </div>
      <div class="speed-box">
        <span class="speed-val" id="hud-speed">0</span>
        <span class="speed-unit">KM/H</span>
      </div>
    `;
    clusterCenter.appendChild(clusterInfo);

    // Boost DRS Bar
    const boostBox = document.createElement('div');
    boostBox.className = 'boost-container';
    boostBox.innerHTML = `
      <span class="boost-tag">DRS/BOOST</span>
      <div class="boost-track">
        <div class="boost-fill" id="hud-boost-bar"></div>
      </div>
    `;
    clusterCenter.appendChild(boostBox);

    bottomBar.appendChild(clusterCenter);

    // Action Dock (Right)
    const dock = document.createElement('div');
    dock.className = 'hud-panel action-dock interactive';
    dock.innerHTML = `
      <button class="hud-btn" id="btn-cam"><span>CAMERA</span><span class="key">C</span></button>
      <button class="hud-btn" id="btn-weather"><span>WEATHER</span><span class="key">V</span></button>
      <button class="hud-btn" id="btn-reset"><span>RESET</span><span class="key">R</span></button>
      <button class="hud-btn" id="btn-audio"><span>AUDIO</span><span class="key">U</span></button>
    `;
    bottomBar.appendChild(dock);

    this.container.appendChild(bottomBar);

    // 3. Start / Unlock Audio Splash Screen
    this.startScreenEl = document.createElement('div');
    this.startScreenEl.id = 'start-screen';
    this.startScreenEl.innerHTML = `
      <div class="start-title">APEX GRAND PRIX 3D</div>
      <div class="start-subtitle">HIGH-PRECISION THREE.JS & CANNON-ES SIMULATION</div>
      <button class="start-btn" id="btn-start-race">START ENGINE</button>
      <div class="start-controls-table">
        <div class="ctrl-row"><span class="ctrl-desc">Accelerate / Brake</span><span class="ctrl-key">W / S or Up / Down</span></div>
        <div class="ctrl-row"><span class="ctrl-desc">Steer</span><span class="ctrl-key">A / D or Left / Right</span></div>
        <div class="ctrl-row"><span class="ctrl-desc">Handbrake (Drift)</span><span class="ctrl-key">SPACE</span></div>
        <div class="ctrl-row"><span class="ctrl-desc">DRS / Nitro Boost</span><span class="ctrl-key">B or N</span></div>
        <div class="ctrl-row"><span class="ctrl-desc">Cycle Cameras (4 Modes)</span><span class="ctrl-key">C</span></div>
        <div class="ctrl-row"><span class="ctrl-desc">Manual / Auto Gearbox</span><span class="ctrl-key">M (Shift / Ctrl)</span></div>
        <div class="ctrl-row"><span class="ctrl-desc">Lighting & Weather</span><span class="ctrl-key">V</span></div>
        <div class="ctrl-row"><span class="ctrl-desc">Reset Car</span><span class="ctrl-key">R</span></div>
      </div>
    `;
    document.body.appendChild(this.startScreenEl);

    this.recoveryTipEl = document.createElement('div');
    this.recoveryTipEl.className = 'recovery-tip';
    this.recoveryTipEl.innerHTML = '⚠️ 赛车受阻：按 [R] 键快速重置赛车 / 长按 [S] 倒车脱困';
    this.container.appendChild(this.recoveryTipEl);

    // Cache elements
    this.speedEl = document.getElementById('hud-speed')!;
    this.gearEl = document.getElementById('hud-gear')!;
    this.modeEl = document.getElementById('hud-mode')!;
    this.throttleBarEl = document.getElementById('hud-throttle-bar')!;
    this.brakeBarEl = document.getElementById('hud-brake-bar')!;
    this.boostBarEl = document.getElementById('hud-boost-bar')!;
    this.gBallEl = document.getElementById('hud-g-ball')!;

    this.lapNumEl = document.getElementById('hud-lap-num')!;
    this.currentLapTimeEl = document.getElementById('hud-curr-time')!;
    this.bestLapTimeEl = document.getElementById('hud-best-time')!;
    this.lastLapTimeEl = document.getElementById('hud-last-time')!;
    this.s1El = document.getElementById('hud-s1')!;
    this.s2El = document.getElementById('hud-s2')!;
    this.s3El = document.getElementById('hud-s3')!;
    this.posBadgeEl = document.getElementById('hud-pos-badge')!;

    // Event listeners
    const handleStart = () => {
      if (this.startScreenEl.style.display !== 'none' && !this.isCountingDown) {
        this.isCountingDown = true;
        this.startRaceCountdown(() => {
          this.isCountingDown = false;
          if (this.onStartClicked) this.onStartClicked();
        });
      }
    };

    document.getElementById('btn-start-race')?.addEventListener('click', handleStart);
    this.startScreenEl.addEventListener('click', handleStart);
    window.addEventListener('keydown', (e) => {
      if (['KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(e.code)) {
        handleStart();
      }
    });

    document.getElementById('btn-cam')?.addEventListener('click', () => {
      if (this.onCameraClicked) this.onCameraClicked();
    });

    document.getElementById('btn-weather')?.addEventListener('click', () => {
      if (this.onWeatherClicked) this.onWeatherClicked();
    });

    document.getElementById('btn-reset')?.addEventListener('click', () => {
      if (this.onResetClicked) this.onResetClicked();
    });

    document.getElementById('btn-audio')?.addEventListener('click', () => {
      if (this.onAudioClicked) this.onAudioClicked();
    });

    this.modeEl.addEventListener('click', () => {
      if (this.onModeClicked) this.onModeClicked();
    });
  }

  /**
   * Dramatic 5-stage FIA race countdown light sequence.
   */
  public startRaceCountdown(onLaunch: () => void): void {
    if (this.startScreenEl.style.display !== 'none') {
      this.startScreenEl.style.display = 'none';
    }

    this.countdownOverlayEl.style.display = 'flex';
    this.countdownOverlayEl.style.opacity = '1';
    this.cdBannerEl.classList.remove('show');
    for (const b of this.cdBulbs) {
      b.className = 'cd-bulb';
    }

    // Step 1 to 5: Turn on bulbs one by one
    const stageTimes = [450, 1100, 1750, 2400, 3050];
    stageTimes.forEach((delay, idx) => {
      setTimeout(() => {
        if (this.cdBulbs[idx]) {
          this.cdBulbs[idx].classList.add('on');
        }
        if (this.onCountdownStage) {
          this.onCountdownStage(idx + 1);
        }
      }, delay);
    });

    // Random suspense hold after 5th light (between 800ms and 1500ms)
    const randomHold = 800 + Math.random() * 700;
    const launchTime = 3050 + randomHold;

    setTimeout(() => {
      // ALL LIGHTS OUT!
      for (const b of this.cdBulbs) {
        b.className = 'cd-bulb';
      }
      this.cdBannerEl.classList.add('show');

      if (this.onCountdownStage) {
        this.onCountdownStage(6); // 6 is green / lights out
      }

      onLaunch();

      // Fade out banner after 1.8 seconds
      setTimeout(() => {
        this.countdownOverlayEl.style.opacity = '0';
        this.countdownOverlayEl.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
          this.countdownOverlayEl.style.display = 'none';
          this.countdownOverlayEl.style.opacity = '1';
        }, 500);
      }, 1800);
    }, launchTime);
  }

  private initMiniMap(): void {
    // Render static track path on minimap canvas once, then dynamic blips on top
  }

  /**
   * Update full telemetry HUD in real time.
   */
  public update(telemetry: VehicleTelemetry, aiCars: AICarInstance[]): void {
    // 0. Calculate Live Race Position (P1 to P4)
    let position = 1;
    // Normalize lap 1 grid positions where waypoint index is near 500 (just behind start line)
    const normPlayerT = (telemetry.lapNumber === 1 && telemetry.trackProgress > 0.90)
      ? telemetry.trackProgress - 1.0
      : (telemetry.trackProgress || 0);
    const playerProgress = (telemetry.lapNumber || 1) + normPlayerT;

    const totalWaypoints = this.waypoints.waypoints.length || 500;
    for (const ai of aiCars) {
      const aiWpT = (ai.currentWaypointIdx || 0) / totalWaypoints;
      const normAiT = ((ai.controller?.lapNumber || 1) === 1 && aiWpT > 0.90)
        ? aiWpT - 1.0
        : aiWpT;
      const aiProgress = (ai.controller?.lapNumber || 1) + normAiT;
      if (aiProgress > playerProgress) {
        position++;
      }
    }
    if (this.posBadgeEl) {
      this.posBadgeEl.textContent = `P${position}`;
      this.posBadgeEl.className = position === 1 ? 'pos-badge p1' : 'pos-badge';
    }

    // 1. Digital Speed & Gear
    this.speedEl.textContent = Math.round(telemetry.speedKmh).toString();

    let gearStr = telemetry.gear.toString();
    if (telemetry.gear === -1) {
      gearStr = 'R';
      this.gearEl.style.color = '#ffaa00'; // High-visibility amber for Reverse
    } else if (telemetry.gear === 0) {
      gearStr = 'N';
      this.gearEl.style.color = '#ffffff';
    } else {
      this.gearEl.style.color = '#ffcc00';
    }
    this.gearEl.textContent = gearStr;
    this.modeEl.textContent = telemetry.isAuto ? 'AT' : 'MT';

    // Show recovery prompt when car is stuck
    if (this.recoveryTipEl) {
      this.recoveryTipEl.style.display = telemetry.isStuck ? 'block' : 'none';
    }

    // 2. Pedals
    this.throttleBarEl.style.height = `${Math.round(telemetry.throttle * 100)}%`;
    this.brakeBarEl.style.height = `${Math.round(telemetry.brake * 100)}%`;

    // 3. Boost
    this.boostBarEl.style.width = `${Math.round(telemetry.boostLevel)}%`;

    // 4. G-Force Ball
    // Max G range +/- 2.0g -> +/- 28px offset
    const offsetX = Math.max(-28, Math.min(28, telemetry.gForceLat * 14));
    const offsetY = Math.max(-28, Math.min(28, -telemetry.gForceLong * 14));
    this.gBallEl.style.transform = `translate(${offsetX}px, ${offsetY}px)`;

    // 5. Shift Light LEDs (12 LEDs across top)
    const rpm = telemetry.rpm;
    // 4 Green (3800-5800), 4 Amber (5800-7200), 4 Red (7200-8100), Flash Blue (8100+)
    const totalLeds = this.shiftLeds.length;
    let litCount = 0;
    if (rpm > 3800) {
      litCount = Math.floor(((rpm - 3800) / (8200 - 3800)) * totalLeds);
    }
    const isRedline = rpm >= 8100;

    for (let i = 0; i < totalLeds; i++) {
      const led = this.shiftLeds[i];
      led.className = 'shift-led';
      if (i < litCount) {
        if (isRedline) {
          led.classList.add('blue-flash');
        } else if (i < 4) {
          led.classList.add('green');
        } else if (i < 8) {
          led.classList.add('amber');
        } else {
          led.classList.add('red');
        }
      }
    }

    // 6. Tachometer Arc Canvas
    this.renderTachometer(telemetry.rpm);

    // 7. Timing Board
    this.lapNumEl.textContent = telemetry.lapNumber.toString();
    this.currentLapTimeEl.textContent = this.formatTime(telemetry.currentLapTime);
    this.bestLapTimeEl.textContent = telemetry.bestLapTime > 0 ? this.formatTime(telemetry.bestLapTime) : '--:--.---';
    this.lastLapTimeEl.textContent = telemetry.lastLapTime > 0 ? this.formatTime(telemetry.lastLapTime) : '--:--.---';

    // Sector status classes
    this.applySectorStyle(this.s1El, telemetry.s1Status, telemetry.currentSector === 1);
    this.applySectorStyle(this.s2El, telemetry.s2Status, telemetry.currentSector === 2);
    this.applySectorStyle(this.s3El, telemetry.s3Status, telemetry.currentSector === 3);

    // 8. Mini-map update
    this.renderMiniMap(telemetry.trackProgress, aiCars);
  }

  private applySectorStyle(el: HTMLElement, status: string, isCurrent: boolean): void {
    el.className = 'sector-box';
    if (status === 'purple') el.classList.add('sector-purple');
    else if (status === 'green') el.classList.add('sector-green');
    else if (status === 'yellow') el.classList.add('sector-yellow');
    else if (isCurrent) el.style.borderColor = '#00e5ff';
  }

  private renderTachometer(rpm: number): void {
    const ctx = this.tachCtx;
    const w = this.tachCanvas.width;
    const h = this.tachCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h - 10;
    const radius = 135;
    const startAngle = Math.PI * 0.95;
    const endAngle = Math.PI * 2.05;
    const totalAngle = endAngle - startAngle;

    // Background track arc
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, endAngle);
    ctx.stroke();

    // Active RPM progress arc
    const rpmRatio = Math.max(0, Math.min(1.0, rpm / 8500));
    const currentAngle = startAngle + totalAngle * rpmRatio;

    if (rpmRatio > 0.01) {
      const grad = ctx.createLinearGradient(0, cy, w, cy);
      grad.addColorStop(0, '#00e5ff');
      grad.addColorStop(0.65, '#00ff66');
      grad.addColorStop(0.85, '#ffaa00');
      grad.addColorStop(1.0, '#ff1133');

      ctx.strokeStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, startAngle, currentAngle);
      ctx.stroke();
    }

    // Tick marks and RPM numbers (0 to 8)
    ctx.font = '10px Consolas, monospace';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.textAlign = 'center';

    for (let i = 0; i <= 8; i++) {
      const tickAngle = startAngle + totalAngle * (i / 8.5);
      const innerR = radius - 16;
      const outerR = radius - 8;

      const x1 = cx + Math.cos(tickAngle) * innerR;
      const y1 = cy + Math.sin(tickAngle) * innerR;
      const x2 = cx + Math.cos(tickAngle) * outerR;
      const y2 = cy + Math.sin(tickAngle) * outerR;

      ctx.strokeStyle = i >= 7 ? '#ff2222' : 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();

      const tx = cx + Math.cos(tickAngle) * (radius - 26);
      const ty = cy + Math.sin(tickAngle) * (radius - 26) + 4;
      ctx.fillText(i.toString(), tx, ty);
    }
  }

  private renderMiniMap(playerT: number, aiCars: AICarInstance[]): void {
    const ctx = this.mapCtx;
    const w = this.mapCanvas.width;
    const h = this.mapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    // Track bounds mapping: Track X is ~ -160 to 640 (span 800, center 240)
    // Z is ~ -530 to 550 (span 1080, center 10)
    // Scale 1:1 isometric projection
    const scale = 0.122;
    const cx = w / 2;
    const cy = h / 2;
    const mapX = (x: number) => cx + (x - 240) * scale;
    const mapY = (z: number) => cy + (z - 10) * scale;

    // Draw track circuit outline
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.beginPath();

    const wps = this.waypoints.waypoints;
    for (let i = 0; i < wps.length; i += 4) {
      const pos = wps[i].position;
      const mx = mapX(pos.x);
      const my = mapY(pos.z);
      if (i === 0) ctx.moveTo(mx, my);
      else ctx.lineTo(mx, my);
    }
    ctx.closePath();
    ctx.stroke();

    // Start / Finish Line marker
    const startPos = wps[0].position;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(mapX(startPos.x) - 3, mapY(startPos.z) - 3, 6, 6);

    // Draw AI cars (Colored circles with team liveries)
    const aiColorMap: Record<string, string> = {
      '77': '#ef4444', // Apex Raptor - Red
      '12': '#3b82f6', // Cobalt Ghost - Blue
      '33': '#f59e0b', // Viper Strike - Orange
      '88': '#10b981', // Neon Phantom - Green
      '99': '#a855f7', // Titan Storm - Purple
    };

    for (const ai of aiCars) {
      const chassisPos = ai.physics.chassisBody.position;
      const ax = mapX(chassisPos.x);
      const ay = mapY(chassisPos.z);

      ctx.fillStyle = aiColorMap[ai.number] || '#ffffff';
      ctx.beginPath();
      ctx.arc(ax, ay, 4.0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Draw Player Car (Cyan arrowhead with heading direction)
    const wpIdx = ((Math.floor(playerT * wps.length) % wps.length) + wps.length) % wps.length;
    const playerWp = this.waypoints.getWaypoint(wpIdx);
    const px = mapX(playerWp.position.x);
    const py = mapY(playerWp.position.z);
    const dir = playerWp.tangent;
    const angle = Math.atan2(dir.z, dir.x);

    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(angle);
    ctx.fillStyle = '#00e5ff';
    ctx.shadowColor = '#00e5ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-3, 0);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const millis = Math.floor((seconds * 1000) % 1000);
    return `${mins}:${secs.toString().padStart(2, '0')}.${millis.toString().padStart(3, '0')}`;
  }
}

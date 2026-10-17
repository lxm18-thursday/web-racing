import { VehicleInput } from './VehicleTypes';

/**
 * High-performance Keyboard and Controller Input Manager.
 * Handles continuous inputs (throttle/steer/brake) with smooth rise/fall rates
 * and edge-triggered single keypress actions (camera, weather, manual shifting).
 */
export class InputManager {
  private keyState: Map<string, boolean> = new Map();
  private justPressed: Set<string> = new Set();

  // Smooth keyboard input filters
  private currentThrottle: number = 0;
  private currentBrake: number = 0;
  private currentSteer: number = 0;

  constructor() {
    window.addEventListener('keydown', (e) => this.onKeyDown(e));
    window.addEventListener('keyup', (e) => this.onKeyUp(e));
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (!this.keyState.get(e.code)) {
      this.justPressed.add(e.code);
    }
    this.keyState.set(e.code, true);

    // Prevent scrolling page on arrow keys & space
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
      e.preventDefault();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keyState.set(e.code, false);
  }

  private isDown(code: string): boolean {
    return !!this.keyState.get(code);
  }

  private wasPressed(code: string): boolean {
    return this.justPressed.has(code);
  }

  /**
   * Sample current inputs with rise/fall rate smoothing.
   */
  public sample(dt: number): VehicleInput {
    // 1. Throttle input
    const targetThrottle = (this.isDown('KeyW') || this.isDown('ArrowUp')) ? 1.0 : 0.0;
    const throttleRate = targetThrottle > this.currentThrottle ? 8.0 : 12.0;
    this.currentThrottle += (targetThrottle - this.currentThrottle) * Math.min(1.0, dt * throttleRate);

    // 2. Brake input
    const targetBrake = (this.isDown('KeyS') || this.isDown('ArrowDown')) ? 1.0 : 0.0;
    const brakeRate = targetBrake > this.currentBrake ? 10.0 : 14.0;
    this.currentBrake += (targetBrake - this.currentBrake) * Math.min(1.0, dt * brakeRate);

    // 3. Steer input (-1 to +1)
    let targetSteer = 0;
    if (this.isDown('KeyA') || this.isDown('ArrowLeft')) targetSteer -= 1.0;
    if (this.isDown('KeyD') || this.isDown('ArrowRight')) targetSteer += 1.0;
    const steerRate = targetSteer !== 0 ? 8.0 : 10.0;
    this.currentSteer += (targetSteer - this.currentSteer) * Math.min(1.0, dt * steerRate);

    const input: VehicleInput = {
      throttle: this.currentThrottle,
      brake: this.currentBrake,
      steer: this.currentSteer,
      handbrake: this.isDown('Space'),
      boost: this.isDown('KeyB') || this.isDown('KeyN'),
      shiftUp: this.wasPressed('ShiftLeft') || this.wasPressed('ShiftRight') || this.wasPressed('KeyE'),
      shiftDown: this.wasPressed('ControlLeft') || this.wasPressed('ControlRight') || this.wasPressed('KeyQ'),
      toggleAuto: this.wasPressed('KeyM'),
      reset: this.wasPressed('KeyR'),
    };

    return input;
  }

  public checkCameraToggle(): boolean {
    return this.wasPressed('KeyC');
  }

  public checkWeatherToggle(): boolean {
    return this.wasPressed('KeyV');
  }

  public checkHeadlightToggle(): boolean {
    return this.wasPressed('KeyH');
  }

  public checkAudioToggle(): boolean {
    return this.wasPressed('KeyU');
  }

  /**
   * Reset single-frame edge triggers. Call at the end of each game frame.
   */
  public endFrame(): void {
    this.justPressed.clear();
  }
}

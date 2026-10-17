import * as THREE from 'three';

export type CameraViewMode = 'chase' | 'hood' | 'cockpit' | 'helicopter';

/**
 * 4-Mode Dynamic Racing Camera Controller.
 * Features spring damping, dynamic speed-based FOV expansion, lateral G head tilt,
 * and high-speed / curb camera shake.
 */
export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public currentMode: CameraViewMode = 'chase';

  private currentCamPos: THREE.Vector3 = new THREE.Vector3();
  private currentLookTarget: THREE.Vector3 = new THREE.Vector3();
  private readonly BASE_FOV = 60.0;
  private readonly MAX_FOV = 78.0;
  private isInitialized: boolean = false;
  private elapsedTime: number = 0;
  private prevMode: CameraViewMode = 'chase';

  constructor(aspectRatio: number) {
    this.camera = new THREE.PerspectiveCamera(this.BASE_FOV, aspectRatio, 0.05, 3000);
  }

  public cycleMode(): CameraViewMode {
    const modes: CameraViewMode[] = ['chase', 'hood', 'cockpit', 'helicopter'];
    const idx = modes.indexOf(this.currentMode);
    this.currentMode = modes[(idx + 1) % modes.length];
    this.isInitialized = false; // Snap on view switch
    return this.currentMode;
  }

  public setMode(mode: CameraViewMode): void {
    if (this.currentMode !== mode) {
      this.currentMode = mode;
      this.isInitialized = false;
    }
  }

  /**
   * Update camera position and orientation based on vehicle transforms and telemetry.
   */
  public update(
    dt: number,
    vehiclePos: THREE.Vector3,
    vehicleQuat: THREE.Quaternion,
    speedKmh: number,
    gForceLat: number,
    onCurb: boolean
  ): void {
    this.elapsedTime += dt;

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(vehicleQuat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(vehicleQuat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(vehicleQuat);

    // 1. Dynamic FOV with Speed
    const speedRatio = Math.min(1.0, Math.max(0, speedKmh) / 260);
    const targetFov = this.BASE_FOV + speedRatio * (this.MAX_FOV - this.BASE_FOV);
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1.0, dt * 6.0);
    this.camera.updateProjectionMatrix();

    // 2. High-Frequency Camera Shake (Speed buffeting + Curb micro-vibration)
    let shakeX = 0;
    let shakeY = 0;
    let shakeZ = 0;

    if (onCurb) {
      // 48 Hz rumble strip tactile frequency with harmonic jitter
      const curbPhase = this.elapsedTime * 48.0 * Math.PI * 2;
      const curbAmp = Math.min(0.065, Math.max(0.02, (speedKmh / 150) * 0.055));
      shakeY += Math.sin(curbPhase) * curbAmp;
      shakeX += Math.cos(curbPhase * 0.65) * (curbAmp * 0.6);
      shakeZ += (Math.random() - 0.5) * curbAmp * 0.35;
    }

    if (speedKmh > 180) {
      // High-speed aerodynamic buffeting
      const speedBuffet = Math.min(0.035, (speedKmh - 180) * 0.0003);
      shakeX += (Math.random() - 0.5) * speedBuffet;
      shakeY += (Math.random() - 0.5) * speedBuffet;
      shakeZ += (Math.random() - 0.5) * speedBuffet;
    }

    const shakeOffset = new THREE.Vector3(shakeX, shakeY, shakeZ);

    // Horizontal forward vector for stable chase cam pitch/yaw
    const flatForward = new THREE.Vector3(forward.x, 0, forward.z);
    if (flatForward.lengthSq() > 0.001) flatForward.normalize();
    else flatForward.set(0, 0, 1);

    // 3. View Mode Placement
    if (this.currentMode === 'chase') {
      // Third-person dynamic spring follow
      // Position: 6.2m behind, 2.3m above
      const desiredPos = vehiclePos.clone()
        .addScaledVector(flatForward, -6.2)
        .add(new THREE.Vector3(0, 2.3, 0))
        .add(shakeOffset);

      // Aim target: 12m ahead of car
      const desiredLook = vehiclePos.clone()
        .addScaledVector(flatForward, 12.0)
        .add(new THREE.Vector3(0, 1.1, 0));

      if (!this.isInitialized || this.prevMode !== 'chase') {
        this.currentCamPos.copy(desiredPos);
        this.currentLookTarget.copy(desiredLook);
        this.isInitialized = true;
        this.prevMode = 'chase';
      } else {
        const lagFactor = Math.min(1.0, dt * 8.0);
        this.currentCamPos.lerp(desiredPos, lagFactor);
        this.currentLookTarget.lerp(desiredLook, lagFactor * 1.5);
      }

      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookTarget);

    } else if (this.currentMode === 'hood') {
      // Front bonnet / roof camera overlooking hood and road ahead
      const hoodPos = vehiclePos.clone()
        .addScaledVector(forward, 0.42)
        .addScaledVector(up, 1.12)
        .add(shakeOffset);

      const hoodLook = vehiclePos.clone()
        .addScaledVector(forward, 45.0)
        .addScaledVector(up, 0.95);

      this.camera.position.copy(hoodPos);
      this.camera.lookAt(hoodLook);
      this.prevMode = 'hood';

    } else if (this.currentMode === 'cockpit') {
      // Driver cockpit seat at visor eye level overlooking steering wheel
      const gTilt = Math.max(-0.06, Math.min(0.06, gForceLat * 0.025));
      const cockpitPos = vehiclePos.clone()
        .addScaledVector(right, -0.32)
        .addScaledVector(forward, -0.02)
        .addScaledVector(up, 0.88)
        .add(shakeOffset);

      const cockpitLook = vehiclePos.clone()
        .addScaledVector(right, -0.32 + gTilt * 2.0)
        .addScaledVector(forward, 40.0)
        .addScaledVector(up, 0.85);

      this.camera.position.copy(cockpitPos);
      this.camera.lookAt(cockpitLook);
      this.prevMode = 'cockpit';

    } else {
      // Broadcast Helicopter Drone dynamic chase tracking view
      const rightVec = new THREE.Vector3(-flatForward.z, 0, flatForward.x);
      const dronePos = vehiclePos.clone()
        .addScaledVector(flatForward, -22.0)
        .addScaledVector(rightVec, 10.0)
        .add(new THREE.Vector3(0, 24.0, 0));

      const droneLook = vehiclePos.clone().addScaledVector(flatForward, 8.0);

      if (!this.isInitialized || this.prevMode !== 'helicopter') {
        this.currentCamPos.copy(dronePos);
        this.currentLookTarget.copy(droneLook);
        this.isInitialized = true;
        this.prevMode = 'helicopter';
      } else {
        const lagFactor = Math.min(1.0, dt * 4.0);
        this.currentCamPos.lerp(dronePos, lagFactor);
        this.currentLookTarget.lerp(droneLook, lagFactor * 2.5);
      }

      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookTarget);
    }
  }

  public updateAspect(aspectRatio: number): void {
    this.camera.aspect = aspectRatio;
    this.camera.updateProjectionMatrix();
  }
}

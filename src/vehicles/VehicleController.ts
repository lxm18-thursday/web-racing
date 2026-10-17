import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { RaycastVehiclePhysics } from './RaycastVehiclePhysics';
import { CarModelInstance } from './CarModelGenerator';
import { VehicleInput, VehicleTelemetry } from './VehicleTypes';
import { SoundEngine } from '../audio/SoundEngine';
import { TrackWaypoints } from '../track/TrackWaypoints';
import { ParticleManager } from '../rendering/ParticleManager';
import { SkidMarkManager } from '../rendering/SkidMarkManager';

/**
 * High-fidelity Vehicle Controller:
 * Implements 6-speed sequential transmission, realistic engine torque curve,
 * 8500 RPM redline, speed-sensitive steering, DRS/Nitro boost, and telemetry sync.
 */
export class VehicleController {
  // Powertrain specifications
  public static readonly IDLE_RPM = 900;
  public static readonly REDLINE_RPM = 8500;
  public static readonly MAX_TORQUE = 580; // Nm

  // 6-speed ratios + Reverse
  private readonly gearRatios = [-3.4, 0, 3.6, 2.5, 1.85, 1.4, 1.12, 0.92]; // Index 0 is R, 1 is N, 2-7 is 1st-6th
  private readonly finalDrive = 3.45;

  public currentGearIndex: number = 2; // Starts in 1st gear (index 2)
  public currentRpm: number = 900;
  public isAuto: boolean = true;

  // Gear shift delay (power cut)
  private shiftCutTimer: number = 0;
  private readonly SHIFT_CUT_DURATION = 0.14; // 140ms shift cut

  // Nitro / DRS Boost
  public boostLevel: number = 100.0; // 0 to 100%
  public isBoosting: boolean = false;

  // Steering & input smoothing
  private currentSteerAngle: number = 0;
  private wheelSpinAngle: number = 0;

  // Anti-stuck and reverse state
  public isStuck: boolean = false;
  private stuckTimer: number = 0;
  private reverseHoldTimer: number = 0;

  // Inputs
  private lastThrottle: number = 0;
  private lastBrake: number = 0;

  // G-Force measurement
  private prevVelocity: CANNON.Vec3 = new CANNON.Vec3();
  private gForceLat: number = 0;
  private gForceLong: number = 0;

  // Track progress
  public closestWaypointIdx: number = 0;
  public lapNumber: number = 1;
  public currentLapTime: number = 0;
  public lastLapTime: number = 0;
  public bestLapTime: number = 0;
  public currentSector: number = 1;
  private prevProgressT: number = 0;

  // Sector timing state
  public s1Time: number = 0;
  public s2Time: number = 0;
  public s3Time: number = 0;
  public bestS1: number = 0;
  public bestS2: number = 0;
  public bestS3: number = 0;
  public s1Status: 'none' | 'yellow' | 'green' | 'purple' = 'none';
  public s2Status: 'none' | 'yellow' | 'green' | 'purple' = 'none';
  public s3Status: 'none' | 'yellow' | 'green' | 'purple' = 'none';

  constructor(
    public physics: RaycastVehiclePhysics,
    public model: CarModelInstance,
    private soundEngine: SoundEngine | null = null,
    private waypoints: TrackWaypoints | null = null,
    private particleManager: ParticleManager | null = null,
    private skidMarkManager: SkidMarkManager | null = null
  ) {
    // Connect collision sound & spark emitter
    if (this.physics) {
      this.physics.onCollision = (impactSpeed: number, pos: CANNON.Vec3) => {
        if (this.soundEngine) {
          this.soundEngine.triggerCrashSound(impactSpeed);
        }
        if (this.particleManager) {
          const p = new THREE.Vector3(pos.x, pos.y, pos.z);
          const vel = this.physics.chassisBody.velocity;
          const v = new THREE.Vector3(vel.x, vel.y, vel.z).normalize();
          this.particleManager.emitSparks(p, v, Math.floor(Math.min(18, impactSpeed * 0.8)));
        }
      };
    }
  }

  public update(dt: number, input: VehicleInput): void {
    // Detect aggressive throttle lift-off at high RPM for Turbo Blow-Off Valve flutter
    if (this.lastThrottle > 0.6 && input.throttle < 0.15 && this.currentRpm > 4200) {
      this.soundEngine?.triggerBovFlutter();
    }
    this.lastThrottle = input.throttle;
    this.lastBrake = input.brake;

    // 1. Aerodynamics
    this.physics.applyAerodynamics();

    // 2. Speed and G-Force calculations
    const vel = this.physics.chassisBody.velocity;
    const speedMs = vel.length();
    const speedKmh = speedMs * 3.6;

    // Calculate longitudinal and lateral acceleration in vehicle local space
    if (dt > 0.0001) {
      const accelWorld = vel.vsub(this.prevVelocity).scale(1 / dt);
      const quat = this.physics.chassisBody.quaternion;
      // Local acceleration vector
      const invQuat = quat.inverse();
      const accelLocal = invQuat.vmult(accelWorld);

      // Convert to Gs (1g = 9.81 m/s^2)
      const targetGForceLong = accelLocal.z / 9.81;
      const targetGForceLat = accelLocal.x / 9.81;

      // Smooth G values
      this.gForceLong += (targetGForceLong - this.gForceLong) * 0.2;
      this.gForceLat += (targetGForceLat - this.gForceLat) * 0.2;
    }
    this.prevVelocity.copy(vel);

    // 3. Transmission Mode Toggle & Manual Shifts
    if (input.toggleAuto) {
      this.isAuto = !this.isAuto;
    }

    if (!this.isAuto) {
      if (input.shiftUp && this.currentGearIndex < 7) {
        this.changeGear(this.currentGearIndex + 1);
      } else if (input.shiftDown && this.currentGearIndex > 0) {
        this.changeGear(this.currentGearIndex - 1);
      }
    }

    // 4. Boost / DRS Logic
    if (input.boost && this.boostLevel > 2.0 && input.throttle > 0.5) {
      this.isBoosting = true;
      this.boostLevel = Math.max(0, this.boostLevel - dt * 20.0); // 5 seconds continuous boost
      // Forward push force (applied at center of mass)
      const forwardVec = this.physics.chassisBody.quaternion.vmult(new CANNON.Vec3(0, 0, 1));
      this.physics.chassisBody.applyForce(forwardVec.scale(6000));
    } else {
      this.isBoosting = false;
      // Passive recharge
      if (this.boostLevel < 100.0) {
        this.boostLevel = Math.min(100.0, this.boostLevel + dt * 4.0);
      }
    }

    // 5. Powertrain & Gear Ratios
    if (this.shiftCutTimer > 0) {
      this.shiftCutTimer -= dt;
    }

    // Automatic transmission logic
    if (this.isAuto) {
      this.handleAutomaticTransmission(speedKmh, input.throttle, input.brake);
    }

    // Calculate RPM based on vehicle and wheel speed
    const activeRatio = this.gearRatios[this.currentGearIndex] ?? 0;
    if (activeRatio === 0) {
      // Neutral free revving
      const targetRpm = (input.throttle * 7500) + VehicleController.IDLE_RPM;
      this.currentRpm += (targetRpm - this.currentRpm) * (dt * 6);
    } else {
      // Drive wheels connected to drivetrain
      // Base wheel angular speed (rad/s) from ground speed: omega = v / r
      let wheelSpeed = speedMs / 0.35;
      if (dt > 0.0005) {
        const w2 = this.physics.vehicle.wheelInfos[2];
        const w3 = this.physics.vehicle.wheelInfos[3];
        if (w2 && w3 && isFinite(w2.deltaRotation) && isFinite(w3.deltaRotation)) {
          const deltaRotSpeed = Math.abs((w2.deltaRotation + w3.deltaRotation) / (2 * dt));
          if (isFinite(deltaRotSpeed) && deltaRotSpeed > 0) {
            wheelSpeed = Math.max(wheelSpeed, deltaRotSpeed);
          }
        }
      }

      const wheelRpm = (wheelSpeed / (2 * Math.PI)) * 60;
      let targetRpm = Math.abs(wheelRpm * activeRatio * this.finalDrive);
      if (!isFinite(targetRpm) || isNaN(targetRpm)) {
        targetRpm = VehicleController.IDLE_RPM;
      }

      // Clutch slip at low speed
      const baseRpm = Math.max(VehicleController.IDLE_RPM, targetRpm);
      if (input.throttle > 0.1 && baseRpm < 3000 && speedKmh < 25) {
        this.currentRpm += (3500 - this.currentRpm) * (dt * 4);
      } else {
        this.currentRpm += (baseRpm - this.currentRpm) * (dt * 15);
      }
    }

    // Safety checks against NaN
    if (!isFinite(this.currentRpm) || isNaN(this.currentRpm)) {
      this.currentRpm = VehicleController.IDLE_RPM;
    }

    // Engine Redline Rev-Limiter clamp
    if (this.currentRpm >= VehicleController.REDLINE_RPM) {
      this.currentRpm = VehicleController.REDLINE_RPM;
    }
    this.currentRpm = Math.max(VehicleController.IDLE_RPM, Math.min(VehicleController.REDLINE_RPM, this.currentRpm));

    // Calculate Engine Torque based on RPM curve
    // In Automatic Mode when in Reverse: 'S' pedal (input.brake) acts as reverse throttle, 'W' pedal (input.throttle) acts as brake
    let activeThrottle = input.throttle;
    let activeBrake = input.brake;

    if (this.isAuto && this.currentGearIndex === 0) {
      activeThrottle = input.brake;
      activeBrake = input.throttle;
    }

    const rpmNorm = (this.currentRpm - VehicleController.IDLE_RPM) / (VehicleController.REDLINE_RPM - VehicleController.IDLE_RPM);
    const torqueCurve = Math.sin(Math.max(0, Math.min(Math.PI, rpmNorm * Math.PI))) * 0.8 + 0.2;
    let engineTorque = VehicleController.MAX_TORQUE * torqueCurve * activeThrottle;

    if (this.shiftCutTimer > 0) {
      engineTorque = 0; // Cut power during gear change
    }

    // Drive Force to Rear Wheels
    const totalRatio = activeRatio * this.finalDrive;
    let wheelDriveForce = (engineTorque * Math.abs(totalRatio)) / 0.35; // F = Torque / radius

    if (this.isBoosting) {
      wheelDriveForce *= 1.45;
    }

    // Launch control / grid staging hold: allow full throttle revving without creeping forward
    if (input.handbrake && input.brake >= 0.85 && speedKmh < 1.5) {
      wheelDriveForce = 0;
    }

    // Apply Engine Force to Cannon-es Vehicle
    // In our coordinate system with indexRightAxis: 0 (X), indexUpAxis: 1 (Y), forwardWS is (0, 0, -1).
    // Positive engineForce propels backward (-Z in world), negative engineForce propels forward (+Z in world).
    if (this.currentGearIndex === 0) {
      // Reverse: positive engine force drives backwards with full torque
      this.physics.vehicle.applyEngineForce(wheelDriveForce * 0.85, 2);
      this.physics.vehicle.applyEngineForce(wheelDriveForce * 0.85, 3);
    } else if (activeRatio > 0) {
      // Forward: negative engine force drives forwards
      this.physics.vehicle.applyEngineForce(-wheelDriveForce * 0.5, 2);
      this.physics.vehicle.applyEngineForce(-wheelDriveForce * 0.5, 3);
    } else {
      this.physics.vehicle.applyEngineForce(0, 2);
      this.physics.vehicle.applyEngineForce(0, 3);
    }

    // 6. Braking System (60% Front, 40% Rear bias)
    // Cannon-es RaycastVehicle setBrake expects impulse per step (N*s).
    // Maximum racing deceleration ~1.4g (18,000 N total -> ~75 N*s per wheel at 60Hz)
    const maxBrakeImpulse = 120;
    let frontBrake = activeBrake * maxBrakeImpulse * 0.6;
    let rearBrake = activeBrake * maxBrakeImpulse * 0.4;

    if (input.handbrake) {
      rearBrake = maxBrakeImpulse * 1.8; // Handbrake locks rear wheels for drifting
    }

    this.physics.vehicle.setBrake(frontBrake, 0);
    this.physics.vehicle.setBrake(frontBrake, 1);
    this.physics.vehicle.setBrake(rearBrake, 2);
    this.physics.vehicle.setBrake(rearBrake, 3);

    // Dynamic brake lights
    this.model.setBrakeState(activeBrake > 0.05 || input.handbrake);

    // 7. Progressive Speed-Sensitive Steering
    // In our coordinate system: Key A (input.steer < 0) turns left, Key D (input.steer > 0) turns right.
    const speedNorm = Math.min(1.0, speedKmh / 280);
    const steerFactor = 1.0 / (1.0 + speedNorm * 1.1); // Retains 48% steer authority at 280 km/h for crisp apex carving
    const maxSteerRad = 0.54 * steerFactor;
    // Inverted sign aligns steering with track coordinates: Key A (input.steer < 0) turns left, Key D (input.steer > 0) turns right
    const targetSteerAngle = -input.steer * maxSteerRad;

    // Speed-adaptive steering response rate: fast at low speed, rock-solid at high speed
    const slewRate = 18.0 - speedNorm * 6.0;
    this.currentSteerAngle += (targetSteerAngle - this.currentSteerAngle) * Math.min(1.0, dt * slewRate);
    this.physics.vehicle.setSteeringValue(this.currentSteerAngle, 0);
    this.physics.vehicle.setSteeringValue(this.currentSteerAngle, 1);

    // 8. Vehicle Reset & Anti-Stuck System
    if (input.reset && this.waypoints) {
      const nearestWp = this.waypoints.getWaypoint(this.closestWaypointIdx);
      this.physics.resetTo(nearestWp.position, nearestWp.tangent);
      this.currentGearIndex = 2; // Reset to 1st gear
      this.skidMarkManager?.reset();
      this.stuckTimer = 0;
      this.isStuck = false;
    }

    // Auto-rescue detection: only if car is trapped against a wall with forward throttle pressed without braking
    if (input.throttle > 0.5 && input.brake < 0.2 && speedKmh < 1.2) {
      this.stuckTimer += dt;
      if (this.stuckTimer > 1.8) {
        this.isStuck = true;
      }
      if (this.stuckTimer > 3.0 && this.waypoints) {
        // Nudge vehicle up and away from obstacle to unjam
        this.physics.chassisBody.position.y += 0.35;
        this.physics.chassisBody.angularVelocity.set(0, 0, 0);
        this.stuckTimer = 1.2;
      }
    } else {
      this.stuckTimer = 0;
      this.isStuck = false;
    }

    // 9. Sync 3D Visual Mesh
    this.syncVisuals(dt, speedKmh, input.brake);

    // 10. Lap Timing and Sectors
    this.updateLapTracking(dt);

    // 11. Surface interaction, Skid Marks, Particles & Audio
    const detailedTelem = this.physics.updateSurfaceAndTelemetry(this.waypoints, this.closestWaypointIdx);

    // Update dynamic skid marks & particles for each wheel
    for (let i = 0; i < 4; i++) {
      const wheelSlip = detailedTelem.wheelSlips[i] ?? 0;
      const surface = detailedTelem.wheelSurfaces[i] ?? 'asphalt';
      const contactPos = detailedTelem.wheelContactPoints[i];
      const axleDir = detailedTelem.wheelAxles[i];
      const isSliding = (wheelSlip > 0.20 || input.handbrake || (input.brake > 0.7 && speedKmh > 12)) && speedKmh > 6;

      // Skid Marks on tarmac & curb surfaces
      if (this.skidMarkManager && contactPos && axleDir) {
        if (surface === 'asphalt' || surface === 'curb') {
          this.skidMarkManager.updateWheel(i, contactPos, axleDir, isSliding, wheelSlip);
        } else {
          this.skidMarkManager.updateWheel(i, contactPos, axleDir, false, 0);
        }
      }

      // Particle FX emission
      if (this.particleManager && contactPos) {
        if (isSliding) {
          if (surface === 'asphalt' || surface === 'curb') {
            // White tire smoke on tarmac
            if (Math.random() < 0.65) {
              this.particleManager.emitTireSmoke(contactPos, wheelSlip);
            }
          } else if (surface === 'grass' || surface === 'gravel') {
            // Dust and grass debris
            this.particleManager.emitOfftrackDust(contactPos, surface, wheelSlip);
          }
        } else if ((surface === 'grass' || surface === 'gravel') && speedKmh > 15) {
          // Off-track rolling churn
          if (Math.random() < 0.35) {
            this.particleManager.emitOfftrackDust(contactPos, surface, 0.4);
          }
        }
      }
    }

    // Boost flame particles
    if (this.isBoosting && this.particleManager && Math.random() < 0.35) {
      const q = this.physics.chassisBody.quaternion;
      const tq = new THREE.Quaternion(q.x, q.y, q.z, q.w);
      const exhaustOffset = new THREE.Vector3(0, 0.32, -2.15).applyQuaternion(tq);
      const exhaustPos = new THREE.Vector3(
        this.physics.chassisBody.position.x,
        this.physics.chassisBody.position.y,
        this.physics.chassisBody.position.z
      ).add(exhaustOffset);
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(tq);
      this.particleManager.emitExhaustFlame(exhaustPos, fwd, true);
    }

    if (this.soundEngine) {
      this.soundEngine.update(this.currentRpm, input.throttle, speedKmh, detailedTelem.slipRatio, detailedTelem.onCurb);
    }
  }

  private handleAutomaticTransmission(speedKmh: number, throttle: number, brake: number): void {
    // 1. Shift to Reverse: car is stopped or nearly stopped and holding brake / S pedal
    if (this.currentGearIndex !== 0) {
      if (speedKmh < 2.5 && brake > 0.35) {
        this.reverseHoldTimer += 0.016;
        if (this.reverseHoldTimer > 0.15) {
          this.changeGear(0); // Engage Reverse
          this.reverseHoldTimer = 0;
        }
      } else {
        this.reverseHoldTimer = 0;
      }
    }

    // 2. Shift from Reverse to 1st Gear: car is stopped or nearly stopped and pressing throttle / W pedal
    if (this.currentGearIndex === 0) {
      if (speedKmh < 2.5 && throttle > 0.35) {
        this.changeGear(2); // Engage 1st gear
        this.reverseHoldTimer = 0;
        return;
      }
    }

    // Upshifts: near 7500 RPM
    if (this.currentGearIndex >= 2 && this.currentGearIndex < 7) {
      if (this.currentRpm > 7500 && throttle > 0.4) {
        this.changeGear(this.currentGearIndex + 1);
      }
    }

    // Downshifts: under 2900 RPM
    if (this.currentGearIndex > 2) {
      if (this.currentRpm < 2900 || (brake > 0.6 && this.currentRpm < 3800)) {
        this.changeGear(this.currentGearIndex - 1);
      }
    }
  }

  private changeGear(targetGearIndex: number): void {
    if (targetGearIndex === this.currentGearIndex) return;

    const oldGear = this.currentGearIndex;
    this.currentGearIndex = targetGearIndex;
    this.shiftCutTimer = this.SHIFT_CUT_DURATION;

    // Trigger exhaust pop sound and fiery flame burst on aggressive upshifts
    if (targetGearIndex > oldGear) {
      if (this.soundEngine) {
        this.soundEngine.triggerShiftPop(this.currentRpm);
      }
      if (this.particleManager && this.currentRpm > 4800) {
        const q = this.physics.chassisBody.quaternion;
        const tq = new THREE.Quaternion(q.x, q.y, q.z, q.w);
        const exhaustOffset = new THREE.Vector3(0, 0.32, -2.15).applyQuaternion(tq);
        const exhaustPos = new THREE.Vector3(
          this.physics.chassisBody.position.x,
          this.physics.chassisBody.position.y,
          this.physics.chassisBody.position.z
        ).add(exhaustOffset);
        const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(tq);
        this.particleManager.emitExhaustFlame(exhaustPos, fwd, this.isBoosting);
      }
    }
  }

  /**
   * Sync Cannon-es physics body transforms with Three.js rendering meshes.
   */
  private syncVisuals(dt: number, speedKmh: number, inputBrake: number): void {
    const chassisBody = this.physics.chassisBody;

    // Sync chassis mesh position
    this.model.chassisMesh.position.set(chassisBody.position.x, chassisBody.position.y, chassisBody.position.z);

    // Weight transfer body pitch (dive on braking, squat on acceleration) and roll on high-G cornering
    const baseQuat = new THREE.Quaternion(chassisBody.quaternion.x, chassisBody.quaternion.y, chassisBody.quaternion.z, chassisBody.quaternion.w);
    const pitch = Math.max(-0.045, Math.min(0.045, -this.gForceLong * 0.024));
    const roll = Math.max(-0.04, Math.min(0.04, this.gForceLat * 0.020));
    const tiltEuler = new THREE.Euler(pitch, 0, roll, 'XYZ');
    const tiltQuat = new THREE.Quaternion().setFromEuler(tiltEuler);
    baseQuat.multiply(tiltQuat);
    this.model.chassisMesh.quaternion.copy(baseQuat);

    // Wheel axle spin based on speed
    const spinRate = (speedKmh / 3.6 / 0.35) * dt;
    this.wheelSpinAngle += spinRate;

    for (let i = 0; i < 4; i++) {
      const wheelInfo = this.physics.vehicle.wheelInfos[i];
      const steerGroup = this.model.wheelGroups[i];
      const hubGroup = this.model.wheelHubs[i];

      // Update position from Cannon-es Raycast vehicle transform
      this.physics.vehicle.updateWheelTransform(i);
      const t = wheelInfo.worldTransform;

      steerGroup.position.set(t.position.x, t.position.y, t.position.z);

      // Separate steering yaw from axle spin:
      // steerGroup handles chassis orientation + steering angle
      // hubGroup handles axle spin around X axis (prevents caliper from spinning!)
      const steerQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), wheelInfo.steering);
      const wheelChassisQuat = new THREE.Quaternion(chassisBody.quaternion.x, chassisBody.quaternion.y, chassisBody.quaternion.z, chassisBody.quaternion.w);
      steerGroup.quaternion.copy(wheelChassisQuat).multiply(steerQuat);

      // Inner axle spin (spins tire, rim and brake disc, not the caliper)
      hubGroup.rotation.x = this.wheelSpinAngle;
    }

    // Cockpit interior steering wheel rotation (aligned with wheel turn direction)
    if (this.model.steeringWheel) {
      this.model.steeringWheel.rotation.z = this.currentSteerAngle * 2.8;
    }

    // Dynamic brake rotors heat glow simulation
    this.model.updateBrakeHeat(inputBrake, speedKmh, dt);

    // Dynamic DRS active aero flap
    this.model.setDrsState(this.isBoosting);

    // Dynamic 3D steering wheel cockpit OLED display
    let gearNumber = this.currentGearIndex - 1;
    if (this.currentGearIndex === 0) gearNumber = -1;
    this.model.updateCockpitDash(gearNumber, speedKmh, this.currentRpm);
  }

  /**
   * Track lap time, sector splits, and circuit progress.
   */
  private updateLapTracking(dt: number): void {
    this.currentLapTime += dt;

    if (!this.waypoints) return;

    const cp = this.physics.chassisBody.position;
    const chassisPos = new THREE.Vector3(cp.x, cp.y, cp.z);
    this.closestWaypointIdx = this.waypoints.getClosestWaypointIndex(chassisPos, this.closestWaypointIdx);
    const wp = this.waypoints.getWaypoint(this.closestWaypointIdx);
    const t = wp.t;

    // Check Sector crossings
    if (this.prevProgressT < 0.32 && t >= 0.32) {
      // Sector 1 completed
      this.currentSector = 2;
      this.s1Time = this.currentLapTime;
      if (this.bestS1 === 0 || this.s1Time < this.bestS1) {
        this.s1Status = 'purple';
        this.bestS1 = this.s1Time;
      } else {
        this.s1Status = 'green';
      }
    } else if (this.prevProgressT < 0.68 && t >= 0.68) {
      // Sector 2 completed
      this.currentSector = 3;
      this.s2Time = this.currentLapTime - this.s1Time;
      if (this.bestS2 === 0 || this.s2Time < this.bestS2) {
        this.s2Status = 'purple';
        this.bestS2 = this.s2Time;
      } else {
        this.s2Status = 'green';
      }
    }

    // Check Lap crossing (from t ~ 0.95 to t ~ 0.05)
    if (this.prevProgressT > 0.90 && t < 0.10) {
      this.s3Time = this.currentLapTime - (this.s1Time + this.s2Time);
      this.lastLapTime = this.currentLapTime;

      if (this.bestLapTime === 0 || this.lastLapTime < this.bestLapTime) {
        this.bestLapTime = this.lastLapTime;
        this.s3Status = 'purple';
      } else {
        this.s3Status = 'green';
      }

      this.lapNumber++;
      this.currentLapTime = 0;
      this.currentSector = 1;
    }

    this.prevProgressT = t;
  }

  /**
   * Export structured telemetry for the HUD overlay.
   */
  public getTelemetry(): VehicleTelemetry {
    const speedKmh = this.physics.chassisBody.velocity.length() * 3.6;
    let gearNumber = this.currentGearIndex - 1; // 0 is R (-1), 1 is N (0), 2 is 1st (1)...
    if (this.currentGearIndex === 0) gearNumber = -1;

    return {
      speedKmh,
      rpm: this.currentRpm,
      gear: gearNumber,
      isAuto: this.isAuto,
      throttle: this.lastThrottle,
      brake: this.lastBrake,
      steer: this.currentSteerAngle,
      gForceLat: this.gForceLat,
      gForceLong: this.gForceLong,
      boostLevel: this.boostLevel,
      isBoosting: this.isBoosting,
      isBraking: this.physics.vehicle.wheelInfos[0].brake > 10,
      slipRatio: this.physics.maxSlip,
      onCurb: this.physics.onCurb,
      lapNumber: this.lapNumber,
      currentLapTime: this.currentLapTime,
      lastLapTime: this.lastLapTime,
      bestLapTime: this.bestLapTime,
      currentSector: this.currentSector,
      s1Delta: this.s1Time > 0 ? this.s1Time - this.bestS1 : null,
      s2Delta: this.s2Time > 0 ? this.s2Time - this.bestS2 : null,
      s3Delta: this.s3Time > 0 ? this.s3Time - this.bestS3 : null,
      s1Status: this.s1Status,
      s2Status: this.s2Status,
      s3Status: this.s3Status,
      trackProgress: this.prevProgressT,
      isStuck: this.isStuck,
    };
  }
}

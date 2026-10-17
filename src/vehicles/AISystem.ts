import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { CarModelGenerator } from './CarModelGenerator';
import { RaycastVehiclePhysics } from './RaycastVehiclePhysics';
import { VehicleController } from './VehicleController';
import { TrackWaypoints } from '../track/TrackWaypoints';
import { VehicleInput } from './VehicleTypes';

export interface AICarInstance {
  name: string;
  number: string;
  physics: RaycastVehiclePhysics;
  controller: VehicleController;
  currentWaypointIdx: number;
  lateralOffset: number; // Current Lane offset in meters
  targetLateralOffset: number; // Target Lane offset in meters
  speedSkillFactor: number; // 0.90 to 1.05
  laneChangeCooldown: number;
  stuckTimer: number;
}

/**
 * High-Performance AI Opponent Racing Subsystem.
 * Manages 5 distinct, competitive AI racers positioned on the starting grid,
 * featuring realistic path navigation, pack racing, slipstream overtaking,
 * and intelligent collision avoidance.
 */
export class AISystem {
  public aiCars: AICarInstance[] = [];

  constructor(
    private scene: THREE.Scene,
    private physicsWorld: PhysicsWorld,
    private waypoints: TrackWaypoints
  ) {
    this.spawnAICars();
  }

  private spawnAICars(): void {
    // 5 Opponents arranged in authentic staggered Grand Prix starting grid:
    // Row 1: P1 (Ahead Left) & P2 (Ahead Right)
    // Row 2: Player (P3 Left) & P4 (Row 2 Right)
    // Row 3: P5 (Row 3 Left) & P6 (Row 3 Right)
    const aiConfigs = [
      {
        name: 'Apex Raptor',
        number: '77',
        bodyColor: 0xd91414,  // Scuderia Crimson Red
        accentColor: 0xffd700, // Gold Aero
        caliperColor: 0xffcc00,
        lateralOffset: -2.4,  // P1: Pole Position (Ahead Left, Row 1)
        speedSkill: 1.02,
        startWpOffset: 3,     // 18m ahead of player
      },
      {
        name: 'Cobalt Ghost',
        number: '12',
        bodyColor: 0x0055ff,  // Electric Blue
        accentColor: 0x00ffff, // Cyan Neon
        caliperColor: 0xff3300,
        lateralOffset: 2.4,   // P2: Front Row (Ahead Right, Row 1)
        speedSkill: 0.99,
        startWpOffset: 2,     // 12m ahead of player
      },
      {
        name: 'Viper Strike',
        number: '33',
        bodyColor: 0xff9900,  // Acid Sunset Orange
        accentColor: 0x111111,
        caliperColor: 0x00ffcc,
        lateralOffset: 2.4,   // P4: Second Row alongside player (Row 2 Right)
        speedSkill: 0.96,
        startWpOffset: -1,    // Alongside / 6m behind
      },
      {
        name: 'Neon Phantom',
        number: '88',
        bodyColor: 0x10b981,  // Emerald Mint Green
        accentColor: 0xffffff,
        caliperColor: 0xff4444,
        lateralOffset: -2.4,  // P5: Third Row (Row 3 Left)
        speedSkill: 0.94,
        startWpOffset: -3,    // 18m behind
      },
      {
        name: 'Titan Storm',
        number: '99',
        bodyColor: 0x4f46e5,  // Deep Indigo / Anthracite
        accentColor: 0xa855f7, // Purple Accent
        caliperColor: 0x38bdf8,
        lateralOffset: 2.4,   // P6: Third Row (Row 3 Right)
        speedSkill: 0.92,
        startWpOffset: -4,    // 24m behind
      },
    ];

    for (const cfg of aiConfigs) {
      // 1. Procedural 3D model
      const model = CarModelGenerator.createCar({
        bodyColor: cfg.bodyColor,
        accentColor: cfg.accentColor,
        caliperColor: cfg.caliperColor,
        raceNumber: cfg.number,
      });
      this.scene.add(model.rootGroup);

      // 2. Physics & Controller with elevated chassis to prevent bottoming out
      const physics = new RaycastVehiclePhysics(this.physicsWorld, {
        mass: 1320,
        suspensionStiffness: 44,
        dampingRelaxation: 3.2,
        dampingCompression: 5.2,
        frictionSlipFront: 9.5,
        frictionSlipRear: 10.0,
        rollInfluence: 0.05,
        downforceFactor: 1.85,
        dragFactor: 0.38,
      });

      const controller = new VehicleController(physics, model, null, this.waypoints);

      // 3. Initial Position on Starting Grid
      const count = this.waypoints.waypoints.length;
      const wpIdx = ((cfg.startWpOffset % count) + count) % count;
      const wp = this.waypoints.getWaypoint(wpIdx);

      const spawnPos = wp.position.clone().addScaledVector(wp.binormal, cfg.lateralOffset).add(new THREE.Vector3(0, 0.4, 0));
      physics.resetTo(spawnPos, wp.tangent);

      this.aiCars.push({
        name: cfg.name,
        number: cfg.number,
        physics,
        controller,
        currentWaypointIdx: wpIdx,
        lateralOffset: cfg.lateralOffset,
        targetLateralOffset: cfg.lateralOffset,
        speedSkillFactor: cfg.speedSkill,
        laneChangeCooldown: 0,
        stuckTimer: 0,
      });
    }
  }

  /**
   * Update AI behavior, path navigation, collision avoidance, and vehicle physics.
   */
  public update(dt: number, playerPos: THREE.Vector3, raceActive: boolean = true): void {
    const totalWps = this.waypoints.waypoints.length;

    for (const ai of this.aiCars) {
      if (!raceActive) {
        // Parked on starting grid waiting for green flag
        const idleInput: VehicleInput = {
          throttle: 0,
          brake: 1.0,
          steer: 0,
          handbrake: true,
          boost: false,
          shiftUp: false,
          shiftDown: false,
          toggleAuto: false,
          reset: false,
        };
        ai.controller.update(dt, idleInput);
        continue;
      }

      // Smooth lane transition towards target offset
      ai.lateralOffset += (ai.targetLateralOffset - ai.lateralOffset) * Math.min(1.0, dt * 3.5);

      const cp = ai.physics.chassisBody.position;
      const chassisPos = new THREE.Vector3(cp.x, cp.y, cp.z);
      ai.currentWaypointIdx = this.waypoints.getClosestWaypointIndex(chassisPos, ai.currentWaypointIdx);

      // Speed measurements
      const speedMs = ai.physics.chassisBody.velocity.length();
      const speedKmh = speedMs * 3.6;

      // Look-ahead waypoint target (dynamically scales with speed: 12m at low speed, 30m at high speed)
      const lookAheadSteps = Math.floor(4 + (speedKmh / 240) * 10);
      const targetWpIdx = (ai.currentWaypointIdx + lookAheadSteps) % totalWps;
      const targetWp = this.waypoints.getWaypoint(targetWpIdx);

      // Compute target position including lateral lane offset
      const targetPos = targetWp.position.clone().addScaledVector(targetWp.binormal, ai.lateralOffset);

      // Vector to target in world space
      const toTarget = targetPos.clone().sub(chassisPos);

      // Transform into vehicle local space
      const cq = ai.physics.chassisBody.quaternion;
      const carQuat = new THREE.Quaternion(cq.x, cq.y, cq.z, cq.w);
      const invQuat = carQuat.clone().invert();
      const localTarget = toTarget.clone().applyQuaternion(invQuat);

      // Correct Steering angle calculation: localTarget.x > 0 means turn right (+), localTarget.x < 0 means turn left (-)
      const angle = Math.atan2(localTarget.x, Math.max(0.1, localTarget.z));
      const steer = Math.max(-1.0, Math.min(1.0, angle * 2.2));

      // Speed regulation & Corner Braking
      let skill = ai.speedSkillFactor;
      // Subtle rubber-banding: if AI is trailing player, give slight draft boost
      const toPlayer = playerPos.clone().sub(chassisPos);
      const forwardVec = new THREE.Vector3(0, 0, 1).applyQuaternion(carQuat);
      const fwdToPlayer = toPlayer.dot(forwardVec);
      if (fwdToPlayer > 18.0) {
        skill *= 1.06; // Catch-up draft
      }

      const desiredSpeedKmh = targetWp.targetSpeedKmh * skill;
      let throttle = 0;
      let brake = 0;

      if (speedKmh < desiredSpeedKmh - 6) {
        throttle = 1.0;
        brake = 0.0;
      } else if (speedKmh > desiredSpeedKmh + 6) {
        throttle = 0.0;
        brake = Math.min(0.85, (speedKmh - desiredSpeedKmh) / 25);
      } else {
        throttle = 0.65;
        brake = 0.0;
      }

      // Dynamic collision avoidance & slipstream overtaking:
      // Only avoid if a car is directly in front IN THE SAME LANE
      let leadCarAhead = false;
      let leadCarDist = Infinity;

      // Check player distance
      const latDistPlayer = Math.abs(toPlayer.dot(targetWp.binormal));
      if (fwdToPlayer > 0.5 && fwdToPlayer < 9.0 && latDistPlayer < 2.4) {
        leadCarAhead = true;
        leadCarDist = Math.min(leadCarDist, fwdToPlayer);
      }

      // Check other AI cars
      for (const other of this.aiCars) {
        if (other === ai) continue;
        const otherPos = new THREE.Vector3(
          other.physics.chassisBody.position.x,
          other.physics.chassisBody.position.y,
          other.physics.chassisBody.position.z
        );
        const toOther = otherPos.clone().sub(chassisPos);
        const fwdDist = toOther.dot(forwardVec);
        const latDist = Math.abs(toOther.dot(targetWp.binormal));

        if (fwdDist > 0.5 && fwdDist < 8.0 && latDist < 2.4) {
          leadCarAhead = true;
          leadCarDist = Math.min(leadCarDist, fwdDist);
        }
      }

      if (ai.laneChangeCooldown > 0) {
        ai.laneChangeCooldown -= dt;
      }

      if (leadCarAhead) {
        // Modulate pace without coming to an abrupt stop
        if (leadCarDist < 4.0) {
          throttle = 0.45;
          brake = 0.20;
        } else {
          throttle = 0.70;
          brake = 0.0;
        }

        // Switch to the open lane to overtake
        if (ai.laneChangeCooldown <= 0) {
          ai.targetLateralOffset = ai.lateralOffset > 0 ? -2.4 : 2.4;
          ai.laneChangeCooldown = 1.6; // Quick 1.6s lane decision
        }
      }

      // Anti-stuck rescue: if trapped at low speed during active race, unjam with full throttle
      if (speedKmh < 4.0) {
        ai.stuckTimer += dt;
        throttle = 1.0;
        brake = 0.0;
        if (ai.stuckTimer > 2.0) {
          // Reposition upright on waypoint
          const currentWp = this.waypoints.getWaypoint(ai.currentWaypointIdx);
          ai.physics.resetTo(
            currentWp.position.clone().addScaledVector(currentWp.binormal, ai.lateralOffset),
            currentWp.tangent
          );
          ai.stuckTimer = 0;
        }
      } else {
        ai.stuckTimer = 0;
      }

      const input: VehicleInput = {
        throttle,
        brake,
        steer,
        handbrake: false,
        boost: speedKmh > 110 && targetWp.curvature < 0.0006 && Math.random() < 0.02,
        shiftUp: false,
        shiftDown: false,
        toggleAuto: false,
        reset: false,
      };

      ai.controller.update(dt, input);
    }
  }
}

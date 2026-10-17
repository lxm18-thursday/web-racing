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
  speedSkillFactor: number; // 0.85 to 1.05
  laneChangeCooldown: number;
}

/**
 * AI Opponent Racing Subsystem.
 * Manages 3 distinct AI competitors with procedural liveries, waypoint navigation,
 * PID steering, corner braking, and dynamic overtaking behavior.
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
    const aiConfigs = [
      {
        name: 'Apex Raptor',
        number: '77',
        bodyColor: 0xd91414,  // Crimson Red
        accentColor: 0xffffff,
        caliperColor: 0xffcc00,
        lateralOffset: 2.4,   // P2 (Right slot, row 1)
        speedSkill: 0.98,
        startWpOffset: -2,
      },
      {
        name: 'Cobalt Ghost',
        number: '12',
        bodyColor: 0x0055ff,  // Electric Blue
        accentColor: 0x44ff88,
        caliperColor: 0xff3300,
        lateralOffset: -2.4,  // P3 (Left slot, row 2)
        speedSkill: 0.95,
        startWpOffset: -4,
      },
      {
        name: 'Viper Strike',
        number: '33',
        bodyColor: 0xffaa00,  // Acid Sunset Yellow
        accentColor: 0x1a1a1a,
        caliperColor: 0x00ffcc,
        lateralOffset: 2.4,   // P4 (Right slot, row 2)
        speedSkill: 0.93,
        startWpOffset: -6,
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

      // 2. Physics & Controller
      const physics = new RaycastVehiclePhysics(this.physicsWorld, {
        mass: 1300,
        suspensionStiffness: 32,
        dampingRelaxation: 2.5,
        dampingCompression: 4.2,
        frictionSlipFront: 8.5,
        frictionSlipRear: 9.0,
        rollInfluence: 0.0,
        downforceFactor: 1.75,
        dragFactor: 0.38,
      });

      const controller = new VehicleController(physics, model, null, this.waypoints);

      // 3. Initial Position on Starting Grid
      const count = this.waypoints.waypoints.length;
      const wpIdx = ((cfg.startWpOffset % count) + count) % count;
      const wp = this.waypoints.getWaypoint(wpIdx);

      const spawnPos = wp.position.clone().addScaledVector(wp.binormal, cfg.lateralOffset);
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
      });
    }
  }

  /**
   * Update AI behavior and vehicle physics for each AI car.
   */
  public update(dt: number, playerPos: THREE.Vector3, raceActive: boolean = true): void {
    const totalWps = this.waypoints.waypoints.length;

    for (const ai of this.aiCars) {
      if (!raceActive) {
        // Parked on grid waiting for green flag
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
      ai.lateralOffset += (ai.targetLateralOffset - ai.lateralOffset) * Math.min(1.0, dt * 2.0);

      const cp = ai.physics.chassisBody.position;
      const chassisPos = new THREE.Vector3(cp.x, cp.y, cp.z);
      ai.currentWaypointIdx = this.waypoints.getClosestWaypointIndex(chassisPos, ai.currentWaypointIdx);

      // Look-ahead waypoint target (dynamically scales with speed: 12m at low speed, 28m at high speed)
      const speedMs = ai.physics.chassisBody.velocity.length();
      const speedKmh = speedMs * 3.6;
      const lookAheadSteps = Math.floor(4 + (speedKmh / 250) * 10);
      const targetWpIdx = (ai.currentWaypointIdx + lookAheadSteps) % totalWps;
      const targetWp = this.waypoints.getWaypoint(targetWpIdx);

      // Compute target position including lateral lane offset
      const targetPos = targetWp.position.clone().addScaledVector(targetWp.binormal, ai.lateralOffset);

      // Vector to target in world space
      const toTarget = targetPos.clone().sub(chassisPos);

      // Transform into vehicle local space
      const cq = ai.physics.chassisBody.quaternion;
      const carQuat = new THREE.Quaternion(cq.x, cq.y, cq.z, cq.w);
      const invQuat = carQuat.invert();
      const localTarget = toTarget.clone().applyQuaternion(invQuat);

      // Steering angle calculation (local X / local Z)
      const angle = Math.atan2(localTarget.x, Math.max(0.1, localTarget.z));
      const steer = Math.max(-1.0, Math.min(1.0, -angle * 1.8));

      // Speed regulation & Corner Braking
      const desiredSpeedKmh = targetWp.targetSpeedKmh * ai.speedSkillFactor;
      let throttle = 0;
      let brake = 0;

      if (speedKmh < desiredSpeedKmh - 5) {
        throttle = 1.0;
        brake = 0.0;
      } else if (speedKmh > desiredSpeedKmh + 5) {
        throttle = 0.0;
        brake = Math.min(1.0, (speedKmh - desiredSpeedKmh) / 30);
      } else {
        throttle = 0.45;
        brake = 0.0;
      }

      // Avoid getting permanently stuck: if speed is nearly zero for long, give full throttle
      if (speedKmh < 5) {
        throttle = 0.9;
      }

      // Dynamic collision avoidance: detect car directly ahead
      const forwardVec = new THREE.Vector3(0, 0, 1).applyQuaternion(carQuat);
      let minAheadDist = Infinity;

      // Check player distance
      const toPlayer = playerPos.clone().sub(chassisPos);
      const distToPlayer = toPlayer.length();
      if (distToPlayer > 0.1 && distToPlayer < 16.0) {
        const dotP = toPlayer.clone().normalize().dot(forwardVec);
        if (dotP > 0.65) {
          minAheadDist = Math.min(minAheadDist, distToPlayer);
        }
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
        const distToOther = toOther.length();
        if (distToOther > 0.1 && distToOther < 14.0) {
          const dotO = toOther.clone().normalize().dot(forwardVec);
          if (dotO > 0.65) {
            minAheadDist = Math.min(minAheadDist, distToOther);
          }
        }
      }

      if (ai.laneChangeCooldown > 0) {
        ai.laneChangeCooldown -= dt;
      }

      // Apply collision avoidance
      if (minAheadDist < 9.0) {
        // Too close, brake and try overtaking on the other lane if cooldown elapsed
        throttle = 0.1;
        brake = 0.7;
        if (ai.laneChangeCooldown <= 0) {
          if (ai.targetLateralOffset > 0) {
            ai.targetLateralOffset = Math.max(-3.2, ai.targetLateralOffset - 2.6);
          } else {
            ai.targetLateralOffset = Math.min(3.2, ai.targetLateralOffset + 2.6);
          }
          ai.laneChangeCooldown = 4.0; // 4s lane cooldown
        }
      } else if (minAheadDist < 16.0) {
        // Approaching, modulate throttle
        throttle = Math.min(throttle, 0.4);
      }

      const input: VehicleInput = {
        throttle,
        brake,
        steer,
        handbrake: false,
        boost: speedKmh > 120 && targetWp.curvature < 0.0005 && Math.random() < 0.02,
        shiftUp: false,
        shiftDown: false,
        toggleAuto: false,
        reset: false,
      };

      ai.controller.update(dt, input);
    }
  }
}

import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { TrackWaypoints } from '../track/TrackWaypoints';

export type SurfaceType = 'asphalt' | 'curb' | 'gravel' | 'grass';

export interface VehiclePhysicsConfig {
  mass: number;
  suspensionStiffness: number;
  dampingRelaxation: number;
  dampingCompression: number;
  frictionSlipFront: number;
  frictionSlipRear: number;
  rollInfluence: number;
  downforceFactor: number; // Aero downforce scaling
  dragFactor: number;      // Aero drag scaling
}

export interface DetailedWheelTelemetry {
  onCurb: boolean;
  slipRatio: number;
  wheelSlips: number[];
  wheelSurfaces: SurfaceType[];
  wheelContactPoints: THREE.Vector3[];
  wheelAxles: THREE.Vector3[];
}

/**
 * Encapsulates Cannon-es RaycastVehicle setup, chassis physics,
 * aerodynamics, surface friction scaling (40% grip on grass/gravel), and rolling resistance.
 */
export class RaycastVehiclePhysics {
  public vehicle: CANNON.RaycastVehicle;
  public chassisBody: CANNON.Body;

  // Track curb vibration & slip
  public onCurb: boolean = false;
  public maxSlip: number = 0;
  public currentSurface: SurfaceType = 'asphalt';

  // Collision callback for impact sound & sparks
  public onCollision: ((impactSpeed: number, pos: CANNON.Vec3) => void) | null = null;
  private lastCollisionTime: number = 0;

  constructor(
    private physicsWorld: PhysicsWorld,
    private config: VehiclePhysicsConfig = {
      mass: 1320,
      suspensionStiffness: 38,
      dampingRelaxation: 2.8,
      dampingCompression: 4.5,
      frictionSlipFront: 8.5,
      frictionSlipRear: 9.0,
      rollInfluence: 0.0,
      downforceFactor: 1.85,
      dragFactor: 0.38,
    }
  ) {
    // 1. Create Chassis Rigid Body with elevated belly clearance to prevent road snagging / launching
    // Shape A: Main lower hull
    const chassisHull = new CANNON.Box(new CANNON.Vec3(0.88, 0.20, 1.95));
    // Shape B: Upper cockpit cabin (guarantees solid collision with overhead gantries & barriers)
    const chassisCabin = new CANNON.Box(new CANNON.Vec3(0.65, 0.22, 0.90));

    this.chassisBody = new CANNON.Body({
      mass: this.config.mass,
      material: this.physicsWorld.chassisMaterial,
      linearDamping: 0.04,
      angularDamping: 0.6,
    });
    // Elevated shape relative to center of mass: bottom is at 0.40 - 0.20 = +0.20m, clear of road trimesh
    this.chassisBody.addShape(chassisHull, new CANNON.Vec3(0, 0.40, 0));
    this.chassisBody.addShape(chassisCabin, new CANNON.Vec3(0, 0.74, -0.2));
    this.physicsWorld.world.addBody(this.chassisBody);

    // Collision listener for metal thud & sparks
    this.chassisBody.addEventListener('collide', () => {
      const speed = this.chassisBody.velocity.length();
      const now = performance.now();
      if (speed > 2.0 && now - this.lastCollisionTime > 120) {
        this.lastCollisionTime = now;
        if (this.onCollision) {
          this.onCollision(speed, this.chassisBody.position);
        }
      }
    });

    // 2. Initialize RaycastVehicle
    this.vehicle = new CANNON.RaycastVehicle({
      chassisBody: this.chassisBody,
      indexRightAxis: 0,    // X
      indexUpAxis: 1,       // Y
      indexForwardAxis: 2,  // Z is forward
    });

    // 3. Configure 4 Wheels (Firm GT3 suspension damping prevents bottoming out)
    const wheelRadius = 0.35;
    const commonWheelOptions = {
      radius: wheelRadius,
      directionLocal: new CANNON.Vec3(0, -1, 0),
      suspensionStiffness: this.config.suspensionStiffness || 44,
      suspensionRestLength: 0.36,
      dampingRelaxation: this.config.dampingRelaxation || 3.2,
      dampingCompression: this.config.dampingCompression || 5.2,
      maxSuspensionForce: 350000,
      rollInfluence: 0.05,
      axleLocal: new CANNON.Vec3(-1, 0, 0),
      maxSuspensionTravel: 0.18,
      useCustomSlidingRotationalSpeed: false,
    };

    // Front-Left (0)
    this.vehicle.addWheel({
      ...commonWheelOptions,
      chassisConnectionPointLocal: new CANNON.Vec3(-0.92, 0.25, 1.35),
      frictionSlip: this.config.frictionSlipFront || 9.5,
    });

    // Front-Right (1)
    this.vehicle.addWheel({
      ...commonWheelOptions,
      chassisConnectionPointLocal: new CANNON.Vec3(0.92, 0.25, 1.35),
      frictionSlip: this.config.frictionSlipFront || 9.5,
    });

    // Rear-Left (2)
    this.vehicle.addWheel({
      ...commonWheelOptions,
      chassisConnectionPointLocal: new CANNON.Vec3(-0.95, 0.25, -1.35),
      frictionSlip: this.config.frictionSlipRear || 10.0,
    });

    // Rear-Right (3)
    this.vehicle.addWheel({
      ...commonWheelOptions,
      chassisConnectionPointLocal: new CANNON.Vec3(0.95, 0.25, -1.35),
      frictionSlip: this.config.frictionSlipRear || 10.0,
    });

    this.vehicle.addToWorld(this.physicsWorld.world);
  }

  /**
   * Apply aerodynamic downforce, air drag, and roll/pitch righting stabilization.
   */
  public applyAerodynamics(): void {
    const vel = this.chassisBody.velocity;
    const speedMs = vel.length();

    // 1. Roll & Pitch Righting Stabilization (keeps race car planted on track)
    const localUp = this.chassisBody.quaternion.vmult(new CANNON.Vec3(0, 1, 0));
    if (localUp.y < 0.96) {
      const worldUp = new CANNON.Vec3(0, 1, 0);
      const torqueAxis = localUp.cross(worldUp);
      this.chassisBody.torque.vadd(torqueAxis.scale(8500), this.chassisBody.torque);
    }

    if (speedMs > 2.0) {
      // 2. Aerodynamic Downforce: glued to track at high speeds (applied at center of mass)
      const downforceMagnitude = this.config.downforceFactor * speedMs * speedMs;
      const downVector = this.chassisBody.quaternion.vmult(new CANNON.Vec3(0, -1, 0));
      downVector.scale(downforceMagnitude, downVector);
      this.chassisBody.applyForce(downVector);

      // 3. Aerodynamic Air Drag: opposes velocity vector (applied at center of mass)
      const dragMagnitude = this.config.dragFactor * speedMs * speedMs;
      const dragForce = vel.unit().scale(-dragMagnitude);
      this.chassisBody.applyForce(dragForce);
    }
  }

  /**
   * Surface detection, grip scaling, rolling resistance, and wheel telemetry.
   * Gras/gravel drops grip to 40% of asphalt and adds rolling resistance drag.
   */
  public updateSurfaceAndTelemetry(
    waypoints: TrackWaypoints | null,
    hintWpIdx: number
  ): DetailedWheelTelemetry {
    let maxSlip = 0;
    let onCurb = false;

    const wheelSlips: number[] = [];
    const wheelSurfaces: SurfaceType[] = [];
    const wheelContactPoints: THREE.Vector3[] = [];
    const wheelAxles: THREE.Vector3[] = [];

    const vel = this.chassisBody.velocity;
    const speedMs = vel.length();
    let offTrackWheelCount = 0;
    let totalRollingResistance = 0;

    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      const wheel = this.vehicle.wheelInfos[i];
      const wp = wheel.worldTransform.position;
      const wheelWorldPos = new THREE.Vector3(wp.x, wp.y, wp.z);
      const axleW = wheel.axleWorld;
      const axleDir = new THREE.Vector3(axleW.x, axleW.y, axleW.z).normalize();

      // Contact point is bottom of wheel
      const contactPos = wheelWorldPos.clone().sub(new THREE.Vector3(0, wheel.radius, 0));
      wheelContactPoints.push(contactPos);
      wheelAxles.push(axleDir);

      // 1. Detect surface type via lateral distance from track centerline
      let surface: SurfaceType = 'asphalt';
      let gripMultiplier = 1.0;

      if (waypoints) {
        const closestIdx = waypoints.getClosestWaypointIndex(wheelWorldPos, hintWpIdx);
        const refWp = waypoints.getWaypoint(closestIdx);
        const toWheel = wheelWorldPos.clone().sub(refWp.position);
        const latDist = Math.abs(toWheel.dot(refWp.binormal));

        if (latDist <= 7.0) {
          surface = 'asphalt';
          gripMultiplier = 1.0;
        } else if (latDist <= 8.8) {
          surface = 'curb';
          gripMultiplier = 0.90;
          onCurb = true;
        } else if (latDist <= 14.8) {
          surface = 'gravel';
          gripMultiplier = 0.55; // Gravel runoff
          offTrackWheelCount++;
          totalRollingResistance += 1800;
        } else {
          surface = 'grass';
          gripMultiplier = 0.40; // Exactly 40% grip on grass
          offTrackWheelCount++;
          totalRollingResistance += 3200;
        }
      }

      wheelSurfaces.push(surface);

      // 2. Modulate tire friction slip based on surface grip
      const baseSlip = i < 2 ? this.config.frictionSlipFront : this.config.frictionSlipRear;
      wheel.frictionSlip = baseSlip * gripMultiplier;

      // 3. Compute wheel physical slip
      let slip = 0;
      if (wheel.isInContact) {
        // Lateral skid / slip angle from skidInfo
        const baseSkid = Math.abs(1.0 - wheel.skidInfo);
        // Calculate lateral velocity at wheel contact
        const contactVelocity = new CANNON.Vec3();
        this.chassisBody.getVelocityAtWorldPoint(wheel.chassisConnectionPointWorld, contactVelocity);
        const latVel = Math.abs(contactVelocity.dot(new CANNON.Vec3(axleDir.x, axleDir.y, axleDir.z)));
        const fwdVel = Math.max(1.0, speedMs);
        const dynamicSlip = Math.min(1.0, (latVel / fwdVel) * 1.6 + baseSkid * 0.5);

        slip = Math.max(slip, dynamicSlip);
        if (slip > maxSlip) maxSlip = slip;

        // Suspension compression curb detection
        if (wheel.suspensionLength < 0.25) {
          onCurb = true;
        }
      }

      wheelSlips.push(slip);
    }

    // 4. Apply extra rolling resistance when off-track in grass/gravel
    if (offTrackWheelCount > 0 && speedMs > 0.5) {
      const avgResistance = totalRollingResistance / 4;
      const dragUnit = vel.unit();
      const rollingDrag = dragUnit.scale(-avgResistance);
      this.chassisBody.applyForce(rollingDrag);
    }

    // 5. Impenetrable Boundary Safety Containment & Fall-Through Prevention:
    // Outer guardrail sits at 14.8m from centerline. Prevent any barrier tunneling or falling off elevated track.
    if (waypoints) {
      const cp = this.chassisBody.position;
      const chassisPos = new THREE.Vector3(cp.x, cp.y, cp.z);
      const cIdx = waypoints.getClosestWaypointIndex(chassisPos, hintWpIdx);
      const refWp = waypoints.getWaypoint(cIdx);
      const toChassis = chassisPos.clone().sub(refWp.position);
      const latSigned = toChassis.dot(refWp.binormal);
      const absLat = Math.abs(latSigned);

      // A. Lateral guardrail containment: reflect outward velocity and clamp
      if (absLat > 14.85) {
        const binormalVec = new CANNON.Vec3(refWp.binormal.x, 0, refWp.binormal.z);
        const latVel = this.chassisBody.velocity.dot(binormalVec);
        // If moving outward towards or beyond barrier, rebound inward
        if ((latSigned > 0 && latVel > 0) || (latSigned < 0 && latVel < 0)) {
          const reflectImpulse = binormalVec.scale(-latVel * 1.35 * this.chassisBody.mass);
          this.chassisBody.applyImpulse(reflectImpulse);
        }

        // Hard clamp position so chassis never pierces through guardrail
        if (absLat > 15.1) {
          const clampedPos = refWp.position.clone().addScaledVector(refWp.binormal, (latSigned > 0 ? 1 : -1) * 14.9);
          this.chassisBody.position.x = clampedPos.x;
          this.chassisBody.position.z = clampedPos.z;
        }
      }

      // B. Elevation Safety (prevents dropping through elevated sections of track into the void)
      const expectedY = refWp.position.y;
      if (this.chassisBody.position.y < expectedY - 0.4) {
        this.chassisBody.position.y = expectedY + 0.35;
        if (this.chassisBody.velocity.y < 0) {
          this.chassisBody.velocity.y = 0;
        }
      }
    }

    this.maxSlip = Math.min(1.0, maxSlip);
    this.onCurb = onCurb;
    this.currentSurface = wheelSurfaces[2] ?? 'asphalt';

    return {
      onCurb,
      slipRatio: this.maxSlip,
      wheelSlips,
      wheelSurfaces,
      wheelContactPoints,
      wheelAxles,
    };
  }

  /**
   * Reset vehicle to upright position above track.
   */
  public resetTo(position: THREE.Vector3, forwardDirection: THREE.Vector3): void {
    this.chassisBody.velocity.set(0, 0, 0);
    this.chassisBody.angularVelocity.set(0, 0, 0);

    // Place at suspension equilibrium height so vehicle is immediately planted without bouncing
    this.chassisBody.position.set(position.x, position.y + 0.40, position.z);

    // Align along track direction
    const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), forwardDirection);
    this.chassisBody.quaternion.set(rot.x, rot.y, rot.z, rot.w);

    // Reset wheel rotations
    for (let i = 0; i < this.vehicle.wheelInfos.length; i++) {
      this.vehicle.wheelInfos[i].rotation = 0;
      this.vehicle.wheelInfos[i].deltaRotation = 0;
    }
  }
}

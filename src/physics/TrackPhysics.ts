import * as CANNON from 'cannon-es';
import * as THREE from 'three';
import { PhysicsWorld } from './PhysicsWorld';
import { TrackData } from '../track/TrackData';
import { TrackMeshGenerator } from '../track/TrackMeshGenerator';

/**
 * Static physical colliders for the track:
 * - Trimesh road surface for RaycastVehicle suspension ray detection.
 * - Solid guardrail barriers to prevent cars flying off-track.
 * - Catch-all safety ground plane.
 */
export class TrackPhysics {
  public roadBody: CANNON.Body;
  public groundPlaneBody: CANNON.Body;
  public barrierBodies: CANNON.Body[] = [];

  constructor(
    private physicsWorld: PhysicsWorld,
    private trackData: TrackData,
    private meshGen: TrackMeshGenerator
  ) {
    // 1. Road Surface Trimesh Collider
    const verts = Array.from(this.meshGen.collisionVertices);
    const indices = Array.from(this.meshGen.collisionIndices);

    const roadTrimesh = new CANNON.Trimesh(verts, indices);
    this.roadBody = new CANNON.Body({
      mass: 0, // Static
      material: this.physicsWorld.groundMaterial,
    });
    this.roadBody.addShape(roadTrimesh);
    this.physicsWorld.world.addBody(this.roadBody);

    // 2. Catch-all Safety Ground Plane
    this.groundPlaneBody = new CANNON.Body({
      mass: 0,
      material: this.physicsWorld.groundMaterial,
    });
    const groundShape = new CANNON.Plane();
    // Rotate plane to face +Y
    this.groundPlaneBody.addShape(groundShape);
    this.groundPlaneBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    this.groundPlaneBody.position.set(0, -0.2, 0);
    this.physicsWorld.world.addBody(this.groundPlaneBody);

    // 3. High-Density Segmented Solid Armco Guardrail Colliders (Impenetrable)
    this.createBarrierColliders();

    // 4. Solid Scenery Architecture Colliders (Gantry, Grandstands, Lighting Towers)
    this.createSceneryColliders();
  }

  private createBarrierColliders(): void {
    const barrierSegments = 300; // High resolution sampling along 2.8km track (~9.7m per segment)
    const totalDist = this.trackData.totalLength;
    const segLen = totalDist / barrierSegments;
    const halfWidth = TrackData.TRACK_WIDTH / 2 + TrackData.CURB_WIDTH + TrackData.RUNOFF_WIDTH; // 14.8m

    // Solid Armco barrier box: 3.0m thick (X=1.5), 7.0m tall (Y=3.5), with 45% segment length overlap
    const boxShape = new CANNON.Box(new CANNON.Vec3(1.5, 3.5, segLen * 0.725));

    for (let i = 0; i < barrierSegments; i++) {
      const t = i / barrierSegments;
      const frame = this.trackData.getFrameAt(t);

      // Orthonormal rotation basis: X = binormal, Y = normal, Z = tangent
      const m = new THREE.Matrix4().makeBasis(frame.binormal, frame.normal, frame.tangent);
      const rot = new THREE.Quaternion().setFromRotationMatrix(m);

      // Left Barrier Box: inner face aligns flush at 14.8m outer runoff
      const pLeft = frame.position.clone()
        .addScaledVector(frame.binormal, -halfWidth - 1.5)
        .addScaledVector(frame.normal, 2.0);

      const leftBody = new CANNON.Body({
        mass: 0,
        material: this.physicsWorld.barrierMaterial,
      });
      leftBody.addShape(boxShape);
      leftBody.position.set(pLeft.x, pLeft.y, pLeft.z);
      leftBody.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      this.physicsWorld.world.addBody(leftBody);
      this.barrierBodies.push(leftBody);

      // Right Barrier Box: inner face aligns flush at 14.8m outer runoff
      const pRight = frame.position.clone()
        .addScaledVector(frame.binormal, halfWidth + 1.5)
        .addScaledVector(frame.normal, 2.0);

      const rightBody = new CANNON.Body({
        mass: 0,
        material: this.physicsWorld.barrierMaterial,
      });
      rightBody.addShape(boxShape);
      rightBody.position.set(pRight.x, pRight.y, pRight.z);
      rightBody.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      this.physicsWorld.world.addBody(rightBody);
      this.barrierBodies.push(rightBody);
    }
  }

  private createSceneryColliders(): void {
    // 1. Start Gantry Pillars
    const gantryFrame = this.trackData.getFrameAt(0);
    const span = TrackData.TRACK_WIDTH + 8;
    const gantryHeight = 7.5;
    const pillarShape = new CANNON.Box(new CANNON.Vec3(0.6, gantryHeight / 2, 0.6));

    const leftPillarPos = gantryFrame.position.clone()
      .addScaledVector(gantryFrame.binormal, -span / 2)
      .add(new THREE.Vector3(0, gantryHeight / 2, 0));
    const leftPillarBody = new CANNON.Body({ mass: 0, material: this.physicsWorld.barrierMaterial });
    leftPillarBody.addShape(pillarShape);
    leftPillarBody.position.set(leftPillarPos.x, leftPillarPos.y, leftPillarPos.z);
    this.physicsWorld.world.addBody(leftPillarBody);
    this.barrierBodies.push(leftPillarBody);

    const rightPillarPos = gantryFrame.position.clone()
      .addScaledVector(gantryFrame.binormal, span / 2)
      .add(new THREE.Vector3(0, gantryHeight / 2, 0));
    const rightPillarBody = new CANNON.Body({ mass: 0, material: this.physicsWorld.barrierMaterial });
    rightPillarBody.addShape(pillarShape);
    rightPillarBody.position.set(rightPillarPos.x, rightPillarPos.y, rightPillarPos.z);
    this.physicsWorld.world.addBody(rightPillarBody);
    this.barrierBodies.push(rightPillarBody);

    // 2. Grandstand Solid Base Colliders
    const standTVals = [0.03, 0.07, 0.11];
    const standShape = new CANNON.Box(new CANNON.Vec3(13.0, 4.5, 9.0));
    for (const t of standTVals) {
      const frame = this.trackData.getFrameAt(t);
      const standPos = frame.position.clone()
        .addScaledVector(frame.binormal, 25)
        .add(new THREE.Vector3(0, 4.5, 0));

      const standBody = new CANNON.Body({ mass: 0, material: this.physicsWorld.barrierMaterial });
      standBody.addShape(standShape);
      standBody.position.set(standPos.x, standPos.y, standPos.z);
      const standRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, -1), frame.binormal.clone().negate());
      standBody.quaternion.set(standRot.x, standRot.y, standRot.z, standRot.w);
      this.physicsWorld.world.addBody(standBody);
      this.barrierBodies.push(standBody);
    }

    // 3. Floodlight Towers (12 towers)
    const towerShape = new CANNON.Box(new CANNON.Vec3(1.2, 9.0, 1.2));
    for (let i = 0; i < 12; i++) {
      const t = i / 12;
      const frame = this.trackData.getFrameAt(t);
      const towerPos = frame.position.clone()
        .addScaledVector(frame.binormal, 22)
        .add(new THREE.Vector3(0, 9.0, 0));

      const towerBody = new CANNON.Body({ mass: 0, material: this.physicsWorld.barrierMaterial });
      towerBody.addShape(towerShape);
      towerBody.position.set(towerPos.x, towerPos.y, towerPos.z);
      this.physicsWorld.world.addBody(towerBody);
      this.barrierBodies.push(towerBody);
    }
  }
}

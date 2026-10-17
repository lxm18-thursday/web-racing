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

    // 3. Segmented Solid Armco Guardrail Colliders
    this.createBarrierColliders();
  }

  private createBarrierColliders(): void {
    const barrierSegments = 120; // 120 barrier segments along the 2.8km track
    const totalDist = this.trackData.totalLength;
    const segLen = totalDist / barrierSegments;
    const halfWidth = TrackData.TRACK_WIDTH / 2 + TrackData.CURB_WIDTH + TrackData.RUNOFF_WIDTH;

    for (let i = 0; i < barrierSegments; i++) {
      const t = i / barrierSegments;
      const frame = this.trackData.getFrameAt(t);

      // Left Barrier Box
      const pLeft = frame.position.clone().addScaledVector(frame.binormal, -halfWidth - 0.4);
      const leftBody = new CANNON.Body({
        mass: 0,
        material: this.physicsWorld.barrierMaterial,
      });
      // Box half-extents: width=0.5m, height=1.5m, length=segLen/2 + 0.5m
      const boxShape = new CANNON.Box(new CANNON.Vec3(0.5, 1.5, segLen * 0.55));
      leftBody.addShape(boxShape);
      leftBody.position.set(pLeft.x, pLeft.y + 0.75, pLeft.z);

      // Align box along tangent
      const rot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), frame.tangent);
      leftBody.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      this.physicsWorld.world.addBody(leftBody);
      this.barrierBodies.push(leftBody);

      // Right Barrier Box
      const pRight = frame.position.clone().addScaledVector(frame.binormal, halfWidth + 0.4);
      const rightBody = new CANNON.Body({
        mass: 0,
        material: this.physicsWorld.barrierMaterial,
      });
      rightBody.addShape(boxShape);
      rightBody.position.set(pRight.x, pRight.y + 0.75, pRight.z);
      rightBody.quaternion.set(rot.x, rot.y, rot.z, rot.w);
      this.physicsWorld.world.addBody(rightBody);
      this.barrierBodies.push(rightBody);
    }
  }
}

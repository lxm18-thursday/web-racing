import * as THREE from 'three';
import { TrackData } from './TrackData';
import { TextureGenerator } from '../rendering/TextureGenerator';

export interface CurbSegment {
  tMin: number;
  tMax: number;
  isLeft: boolean;
  box: THREE.Box3;
}

/**
 * Procedural Track Mesh Generator.
 * Constructs track ribbon, 3D curbs, runoff borders, armco barriers, and grass terrain.
 */
export class TrackMeshGenerator {
  public roadMesh!: THREE.Mesh;
  public curbLeftMesh!: THREE.Mesh;
  public curbRightMesh!: THREE.Mesh;
  public runoffMesh!: THREE.Mesh;
  public guardrailMesh!: THREE.Mesh;
  public terrainMesh!: THREE.Mesh;
  public startLineMesh!: THREE.Mesh;

  public curbSegments: CurbSegment[] = [];
  public trackGroup: THREE.Group = new THREE.Group();

  // Low-resolution vertices for physics collision trimesh
  public collisionVertices: Float32Array = new Float32Array(0);
  public collisionIndices: Uint32Array = new Uint32Array(0);

  constructor(private trackData: TrackData) {
    this.generate();
  }

  private generate(): void {
    const segments = 600; // High resolution sampling along 2.8km track
    const halfW = TrackData.TRACK_WIDTH / 2;
    const curbW = TrackData.CURB_WIDTH;
    const runoffW = TrackData.RUNOFF_WIDTH;

    // Buffers for Road Surface
    const roadPositions: number[] = [];
    const roadNormals: number[] = [];
    const roadUvs: number[] = [];
    const roadIndices: number[] = [];

    // Buffers for Left Curb
    const curbLPositions: number[] = [];
    const curbLNormals: number[] = [];
    const curbLUvs: number[] = [];
    const curbLIndices: number[] = [];

    // Buffers for Right Curb
    const curbRPositions: number[] = [];
    const curbRNormals: number[] = [];
    const curbRUvs: number[] = [];
    const curbRIndices: number[] = [];

    // Buffers for Run-off Areas
    const runoffPositions: number[] = [];
    const runoffNormals: number[] = [];
    const runoffUvs: number[] = [];
    const runoffIndices: number[] = [];

    // Buffers for Guardrail
    const railPositions: number[] = [];
    const railNormals: number[] = [];
    const railUvs: number[] = [];
    const railIndices: number[] = [];

    // Sample track frames
    const frames: Array<{
      pos: THREE.Vector3;
      binormal: THREE.Vector3;
      normal: THREE.Vector3;
      tangent: THREE.Vector3;
      curvature: number;
    }> = [];

    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) % 1;
      const frame = this.trackData.getFrameAt(t);
      frames.push({
        pos: frame.position,
        binormal: frame.binormal,
        normal: frame.normal,
        tangent: frame.tangent,
        curvature: frame.curvature
      });
    }

    // Build Road geometry
    let roadVertCount = 0;
    let curbLVertCount = 0;
    let curbRVertCount = 0;
    let runoffVertCount = 0;
    let railVertCount = 0;

    const vRepeat = this.trackData.totalLength / 8.0;

    for (let i = 0; i <= segments; i++) {
      const f = frames[i];
      const v = (i / segments) * vRepeat;

      // Road cross section: Left edge (-halfW), Center (0), Right edge (+halfW)
      const pLeft = f.pos.clone().addScaledVector(f.binormal, -halfW);
      const pMid = f.pos.clone();
      const pRight = f.pos.clone().addScaledVector(f.binormal, halfW);

      // Road Vertices (3 columns across road for smooth surface & collision)
      roadPositions.push(pLeft.x, pLeft.y, pLeft.z);
      roadNormals.push(f.normal.x, f.normal.y, f.normal.z);
      roadUvs.push(0, v);

      roadPositions.push(pMid.x, pMid.y, pMid.z);
      roadNormals.push(f.normal.x, f.normal.y, f.normal.z);
      roadUvs.push(0.5, v);

      roadPositions.push(pRight.x, pRight.y, pRight.z);
      roadNormals.push(f.normal.x, f.normal.y, f.normal.z);
      roadUvs.push(1, v);

      if (i < segments) {
        const row1 = i * 3;
        const row2 = (i + 1) * 3;
        // Quad 1: Left to Mid (Upward Normal CCW)
        roadIndices.push(row1, row2, row1 + 1);
        roadIndices.push(row1 + 1, row2, row2 + 1);
        // Quad 2: Mid to Right (Upward Normal CCW)
        roadIndices.push(row1 + 1, row2 + 1, row1 + 2);
        roadIndices.push(row1 + 2, row2 + 1, row2 + 2);
      }

      // Curbs: Raised by +0.06m with beveled edge for genuine physical curb feedback
      const curbH = 0.06;
      const curbLOuter = pLeft.clone().addScaledVector(f.binormal, -curbW).addScaledVector(f.normal, curbH);
      const curbLInner = pLeft.clone();

      curbLPositions.push(curbLOuter.x, curbLOuter.y, curbLOuter.z);
      curbLNormals.push(f.normal.x, f.normal.y, f.normal.z);
      curbLUvs.push(0, (i / segments) * 60);

      curbLPositions.push(curbLInner.x, curbLInner.y, curbLInner.z);
      curbLNormals.push(f.normal.x, f.normal.y, f.normal.z);
      curbLUvs.push(1, (i / segments) * 60);

      const curbRInner = pRight.clone();
      const curbROuter = pRight.clone().addScaledVector(f.binormal, curbW).addScaledVector(f.normal, curbH);

      curbRPositions.push(curbRInner.x, curbRInner.y, curbRInner.z);
      curbRNormals.push(f.normal.x, f.normal.y, f.normal.z);
      curbRUvs.push(0, (i / segments) * 60);

      curbRPositions.push(curbROuter.x, curbROuter.y, curbROuter.z);
      curbRNormals.push(f.normal.x, f.normal.y, f.normal.z);
      curbRUvs.push(1, (i / segments) * 60);

      if (i < segments) {
        const c1 = i * 2;
        const c2 = (i + 1) * 2;
        curbLIndices.push(c1, c2, c1 + 1);
        curbLIndices.push(c1 + 1, c2, c2 + 1);

        curbRIndices.push(c1, c2, c1 + 1);
        curbRIndices.push(c1 + 1, c2, c2 + 1);
      }

      // Run-off buffers (beyond curbs)
      const runoffLOuter = curbLOuter.clone().addScaledVector(f.binormal, -runoffW);
      runoffPositions.push(runoffLOuter.x, runoffLOuter.y - 0.02, runoffLOuter.z);
      runoffNormals.push(f.normal.x, f.normal.y, f.normal.z);
      runoffUvs.push(0, (i / segments) * 30);

      runoffPositions.push(curbLOuter.x, curbLOuter.y - 0.02, curbLOuter.z);
      runoffNormals.push(f.normal.x, f.normal.y, f.normal.z);
      runoffUvs.push(1, (i / segments) * 30);

      const runoffROuter = curbROuter.clone().addScaledVector(f.binormal, runoffW);
      runoffPositions.push(curbROuter.x, curbROuter.y - 0.02, curbROuter.z);
      runoffNormals.push(f.normal.x, f.normal.y, f.normal.z);
      runoffUvs.push(0, (i / segments) * 30);

      runoffPositions.push(runoffROuter.x, runoffROuter.y - 0.02, runoffROuter.z);
      runoffNormals.push(f.normal.x, f.normal.y, f.normal.z);
      runoffUvs.push(1, (i / segments) * 30);

      if (i < segments) {
        const r1 = i * 4;
        const r2 = (i + 1) * 4;
        // Left runoff (Upward CCW)
        runoffIndices.push(r1, r2, r1 + 1);
        runoffIndices.push(r1 + 1, r2, r2 + 1);
        // Right runoff (Upward CCW)
        runoffIndices.push(r1 + 2, r2 + 2, r1 + 3);
        runoffIndices.push(r1 + 3, r2 + 2, r2 + 3);
      }

      // Armco Guardrails (outer edge of runoff, height 1.2m)
      const railH = 1.2;
      const railLBottom = runoffLOuter.clone();
      const railLTop = runoffLOuter.clone().add(new THREE.Vector3(0, railH, 0));
      const railRBottom = runoffROuter.clone();
      const railRTop = runoffROuter.clone().add(new THREE.Vector3(0, railH, 0));

      railPositions.push(railLBottom.x, railLBottom.y, railLBottom.z);
      railNormals.push(f.binormal.x, 0, f.binormal.z); // Facing inward
      railUvs.push((i / segments) * 200, 0);

      railPositions.push(railLTop.x, railLTop.y, railLTop.z);
      railNormals.push(f.binormal.x, 0, f.binormal.z);
      railUvs.push((i / segments) * 200, 1);

      railPositions.push(railRBottom.x, railRBottom.y, railRBottom.z);
      railNormals.push(-f.binormal.x, 0, -f.binormal.z);
      railUvs.push((i / segments) * 200, 0);

      railPositions.push(railRTop.x, railRTop.y, railRTop.z);
      railNormals.push(-f.binormal.x, 0, -f.binormal.z);
      railUvs.push((i / segments) * 200, 1);

      if (i < segments) {
        const g1 = i * 4;
        const g2 = (i + 1) * 4;
        // Left rail (inner face)
        railIndices.push(g1, g2, g1 + 1);
        railIndices.push(g1 + 1, g2, g2 + 1);
        // Right rail
        railIndices.push(g1 + 2, g1 + 3, g2 + 2);
        railIndices.push(g1 + 3, g2 + 3, g2 + 2);
      }
    }

    // Build unified 7-column collision mesh across road + curbs + runoffs
    const colPositions: number[] = [];
    const colIndices: number[] = [];

    for (let i = 0; i <= segments; i++) {
      const f = frames[i];
      const pLeft = f.pos.clone().addScaledVector(f.binormal, -halfW);
      const pMid = f.pos.clone();
      const pRight = f.pos.clone().addScaledVector(f.binormal, halfW);

      const curbLOuter = pLeft.clone().addScaledVector(f.binormal, -curbW).addScaledVector(f.normal, 0.06);
      const curbROuter = pRight.clone().addScaledVector(f.binormal, curbW).addScaledVector(f.normal, 0.06);

      const runoffLOuter = curbLOuter.clone().addScaledVector(f.binormal, -runoffW);
      const runoffROuter = curbROuter.clone().addScaledVector(f.binormal, runoffW);

      // 7 points across: RunoffLeft -> CurbLeft -> RoadLeft -> RoadMid -> RoadRight -> CurbRight -> RunoffRight
      const pts = [runoffLOuter, curbLOuter, pLeft, pMid, pRight, curbROuter, runoffROuter];
      for (const p of pts) {
        colPositions.push(p.x, p.y, p.z);
      }

      if (i < segments) {
        for (let col = 0; col < 6; col++) {
          const v0 = i * 7 + col;
          const v1 = i * 7 + col + 1;
          const v2 = (i + 1) * 7 + col;
          const v3 = (i + 1) * 7 + col + 1;
          // Upward normals CCW
          colIndices.push(v0, v2, v1);
          colIndices.push(v1, v2, v3);
        }
      }
    }

    this.collisionVertices = new Float32Array(colPositions);
    this.collisionIndices = new Uint32Array(colIndices);

    // Create Road Mesh
    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNormals, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUvs, 2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();

    const asphaltTex = TextureGenerator.createAsphaltTexture();
    const roadMat = new THREE.MeshStandardMaterial({
      map: asphaltTex,
      roughness: 0.85,
      metalness: 0.1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    this.roadMesh = new THREE.Mesh(roadGeo, roadMat);
    this.roadMesh.receiveShadow = true;
    this.trackGroup.add(this.roadMesh);

    // Create Curb Meshes
    const curbTex = TextureGenerator.createCurbTexture();
    const curbMat = new THREE.MeshStandardMaterial({
      map: curbTex,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    const curbLGeo = new THREE.BufferGeometry();
    curbLGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbLPositions, 3));
    curbLGeo.setAttribute('normal', new THREE.Float32BufferAttribute(curbLNormals, 3));
    curbLGeo.setAttribute('uv', new THREE.Float32BufferAttribute(curbLUvs, 2));
    curbLGeo.setIndex(curbLIndices);
    curbLGeo.computeVertexNormals();
    this.curbLeftMesh = new THREE.Mesh(curbLGeo, curbMat);
    this.curbLeftMesh.receiveShadow = true;
    this.trackGroup.add(this.curbLeftMesh);

    const curbRGeo = new THREE.BufferGeometry();
    curbRGeo.setAttribute('position', new THREE.Float32BufferAttribute(curbRPositions, 3));
    curbRGeo.setAttribute('normal', new THREE.Float32BufferAttribute(curbRNormals, 3));
    curbRGeo.setAttribute('uv', new THREE.Float32BufferAttribute(curbRUvs, 2));
    curbRGeo.setIndex(curbRIndices);
    curbRGeo.computeVertexNormals();
    this.curbRightMesh = new THREE.Mesh(curbRGeo, curbMat);
    this.curbRightMesh.receiveShadow = true;
    this.trackGroup.add(this.curbRightMesh);

    // Create Run-off Mesh
    const gravelTex = TextureGenerator.createGravelTexture();
    const runoffMat = new THREE.MeshStandardMaterial({
      map: gravelTex,
      roughness: 0.95,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });
    const runoffGeo = new THREE.BufferGeometry();
    runoffGeo.setAttribute('position', new THREE.Float32BufferAttribute(runoffPositions, 3));
    runoffGeo.setAttribute('normal', new THREE.Float32BufferAttribute(runoffNormals, 3));
    runoffGeo.setAttribute('uv', new THREE.Float32BufferAttribute(runoffUvs, 2));
    runoffGeo.setIndex(runoffIndices);
    runoffGeo.computeVertexNormals();
    this.runoffMesh = new THREE.Mesh(runoffGeo, runoffMat);
    this.runoffMesh.receiveShadow = true;
    this.trackGroup.add(this.runoffMesh);

    // Create Armco Guardrail Mesh
    const armcoTex = TextureGenerator.createArmcoTexture();
    const armcoMat = new THREE.MeshStandardMaterial({
      map: armcoTex,
      roughness: 0.35,
      metalness: 0.85,
      side: THREE.DoubleSide
    });
    const railGeo = new THREE.BufferGeometry();
    railGeo.setAttribute('position', new THREE.Float32BufferAttribute(railPositions, 3));
    railGeo.setAttribute('normal', new THREE.Float32BufferAttribute(railNormals, 3));
    railGeo.setAttribute('uv', new THREE.Float32BufferAttribute(railUvs, 2));
    railGeo.setIndex(railIndices);
    this.guardrailMesh = new THREE.Mesh(railGeo, armcoMat);
    this.guardrailMesh.castShadow = true;
    this.guardrailMesh.receiveShadow = true;
    this.trackGroup.add(this.guardrailMesh);

    // Create Start/Finish Line Checkerboard
    const checkTex = TextureGenerator.createCheckeredLineTexture();
    const checkGeo = new THREE.PlaneGeometry(TrackData.TRACK_WIDTH, 4);
    const checkMat = new THREE.MeshBasicMaterial({
      map: checkTex,
      transparent: true,
      depthWrite: false,
    });
    this.startLineMesh = new THREE.Mesh(checkGeo, checkMat);
    this.startLineMesh.rotation.x = -Math.PI / 2;
    this.startLineMesh.position.set(0, 0.04, 0); // At start point
    this.trackGroup.add(this.startLineMesh);

    // Create Sculpted Procedural Terrain (Embankment following track elevation)
    const terrainResolution = 100;
    const terrainGeo = new THREE.PlaneGeometry(2800, 2800, terrainResolution, terrainResolution);
    const grassTex = TextureGenerator.createGrassTexture();
    const terrainMat = new THREE.MeshStandardMaterial({
      map: grassTex,
      roughness: 0.9,
      metalness: 0.05,
    });

    const posAttr = terrainGeo.attributes.position;
    const totalCorridorHalfW = halfW + curbW + runoffW; // 14.8m

    for (let k = 0; k < posAttr.count; k++) {
      const wx = posAttr.getX(k);
      const wz = -posAttr.getY(k);

      // Find closest track point among sampled frames
      let minDistSq = Infinity;
      let nearestY = 0;
      for (let s = 0; s < segments; s += 2) {
        const fp = frames[s].pos;
        const dx = wx - fp.x;
        const dz = wz - fp.z;
        const dSq = dx * dx + dz * dz;
        if (dSq < minDistSq) {
          minDistSq = dSq;
          nearestY = fp.y;
        }
      }
      const dist = Math.sqrt(minDistSq);

      let groundY = 0;
      const innerR = totalCorridorHalfW + 2.0; // 16.8m
      const outerR = 90.0;                   // 90m falloff to natural landscape

      if (dist <= innerR) {
        groundY = nearestY - 0.28;
      } else if (dist < outerR) {
        const t = (dist - innerR) / (outerR - innerR);
        const smoothT = 0.5 * (1 + Math.cos(t * Math.PI));
        const rolling = Math.sin(wx * 0.005) * Math.cos(wz * 0.005) * 2.0;
        groundY = (nearestY - 0.28) * smoothT + rolling * (1 - smoothT);
      } else {
        groundY = Math.sin(wx * 0.005) * Math.cos(wz * 0.005) * 2.0;
      }

      posAttr.setZ(k, groundY);
    }
    terrainGeo.computeVertexNormals();

    this.terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
    this.terrainMesh.rotation.x = -Math.PI / 2;
    this.terrainMesh.receiveShadow = true;
    this.trackGroup.add(this.terrainMesh);
  }
}

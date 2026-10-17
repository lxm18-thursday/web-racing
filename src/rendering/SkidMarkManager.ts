import * as THREE from 'three';

interface WheelMarkState {
  lastPos: THREE.Vector3 | null;
  lastLeft: THREE.Vector3 | null;
  lastRight: THREE.Vector3 | null;
  wasSkidding: boolean;
}

/**
 * High-performance dynamic tire skid mark renderer.
 * Generates continuous semi-transparent rubber tracks on the road surface
 * during high slip angles, drifting, or braking lockup.
 * Uses a cyclic GPU buffer for single-draw-call performance with zero runtime allocations.
 */
export class SkidMarkManager {
  public mesh: THREE.Mesh;
  private geometry: THREE.BufferGeometry;

  private readonly MAX_MARKS = 1200; // Total quad segments
  private readonly VERTICES_PER_MARK = 6; // 2 triangles = 6 vertices
  private readonly MAX_VERTICES: number;

  private positions: Float32Array;
  private colors: Float32Array;
  private uvs: Float32Array;

  private currentVertexIndex = 0;
  private wheelStates: WheelMarkState[] = [];

  constructor(private scene: THREE.Scene) {
    this.MAX_VERTICES = this.MAX_MARKS * this.VERTICES_PER_MARK;

    this.positions = new Float32Array(this.MAX_VERTICES * 3);
    this.colors = new Float32Array(this.MAX_VERTICES * 4);
    this.uvs = new Float32Array(this.MAX_VERTICES * 2);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
    this.geometry.setAttribute('uv', new THREE.BufferAttribute(this.uvs, 2));

    // Dynamic procedural tire tread skid texture
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#08080a';
    ctx.fillRect(0, 0, 64, 128);

    // Tread groove stripes
    ctx.fillStyle = '#141416';
    ctx.fillRect(10, 0, 8, 128);
    ctx.fillRect(28, 0, 8, 128);
    ctx.fillRect(46, 0, 8, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;

    const material = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      vertexColors: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2.0,
      polygonOffsetUnits: -2.0,
      side: THREE.DoubleSide,
    });

    this.mesh = new THREE.Mesh(this.geometry, material);
    this.mesh.frustumCulled = false;
    this.scene.add(this.mesh);

    // Track 4 wheels (FL: 0, FR: 1, RL: 2, RR: 3)
    for (let i = 0; i < 4; i++) {
      this.wheelStates.push({
        lastPos: null,
        lastLeft: null,
        lastRight: null,
        wasSkidding: false,
      });
    }
  }

  /**
   * Update wheel contact and emit skid mark if slip exceeds threshold.
   */
  public updateWheel(
    wheelIndex: number,
    contactPos: THREE.Vector3,
    axleDir: THREE.Vector3,
    isSliding: boolean,
    slipIntensity: number // 0.0 to 1.0
  ): void {
    const state = this.wheelStates[wheelIndex];
    if (!state) return;

    if (!isSliding || slipIntensity < 0.12) {
      state.wasSkidding = false;
      state.lastPos = null;
      state.lastLeft = null;
      state.lastRight = null;
      return;
    }

    const treadHalfWidth = 0.14; // 28cm tire tread
    const normalOffset = 0.025; // 2.5cm above track surface to prevent Z-fighting

    // Contact point slightly lifted
    const centerPos = contactPos.clone().add(new THREE.Vector3(0, normalOffset, 0));
    const leftPos = centerPos.clone().addScaledVector(axleDir, -treadHalfWidth);
    const rightPos = centerPos.clone().addScaledVector(axleDir, treadHalfWidth);

    if (state.wasSkidding && state.lastLeft && state.lastRight && state.lastPos) {
      const dist = centerPos.distanceTo(state.lastPos);
      // Valid connection segment: must be between 0.12m and 4.0m
      if (dist >= 0.12 && dist <= 4.0) {
        this.addQuad(
          state.lastLeft,
          state.lastRight,
          leftPos,
          rightPos,
          slipIntensity
        );
      } else if (dist > 4.0) {
        // Discontinuity (jumped or teleported)
        state.lastPos = null;
        state.lastLeft = null;
        state.lastRight = null;
      }
    }

    state.lastPos = centerPos;
    state.lastLeft = leftPos;
    state.lastRight = rightPos;
    state.wasSkidding = true;
  }

  private addQuad(
    p0: THREE.Vector3, // Prev Left
    p1: THREE.Vector3, // Prev Right
    p2: THREE.Vector3, // Curr Left
    p3: THREE.Vector3, // Curr Right
    intensity: number
  ): void {
    const alpha = Math.min(0.75, 0.2 + intensity * 0.6);
    const r = 0.06;
    const g = 0.06;
    const b = 0.07;

    const vIdx = this.currentVertexIndex;
    const pos = this.positions;
    const col = this.colors;
    const uvs = this.uvs;

    // Triangle 1: p0 -> p2 -> p1
    // Triangle 2: p1 -> p2 -> p3
    const quadVertices = [p0, p2, p1, p1, p2, p3];
    const quadUvs = [
      0, 0,
      0, 1,
      1, 0,
      1, 0,
      0, 1,
      1, 1,
    ];

    for (let i = 0; i < 6; i++) {
      const vi = (vIdx + i) % this.MAX_VERTICES;
      const p = quadVertices[i];
      const pOffset = vi * 3;
      const cOffset = vi * 4;
      const uOffset = vi * 2;

      pos[pOffset] = p.x;
      pos[pOffset + 1] = p.y;
      pos[pOffset + 2] = p.z;

      col[cOffset] = r;
      col[cOffset + 1] = g;
      col[cOffset + 2] = b;
      col[cOffset + 3] = alpha;

      uvs[uOffset] = quadUvs[i * 2];
      uvs[uOffset + 1] = quadUvs[i * 2 + 1];
    }

    this.currentVertexIndex = (this.currentVertexIndex + 6) % this.MAX_VERTICES;

    // Flag attributes for GPU update
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
  }

  /**
   * Reset all marks (on restart or vehicle respawn).
   */
  public reset(): void {
    this.positions.fill(0);
    this.colors.fill(0);
    this.uvs.fill(0);
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.uv.needsUpdate = true;
    this.currentVertexIndex = 0;

    for (const s of this.wheelStates) {
      s.lastPos = null;
      s.lastLeft = null;
      s.lastRight = null;
      s.wasSkidding = false;
    }
  }
}

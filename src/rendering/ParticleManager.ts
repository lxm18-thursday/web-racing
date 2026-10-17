import * as THREE from 'three';

interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  baseScale: number;
  rotationSpeed: number;
  type: 'smoke' | 'flame' | 'dust_grass' | 'dust_gravel' | 'spark';
}

/**
 * Procedural Particle Manager.
 * Handles:
 * - Asphalt Tire Smoke (white billowy puffs on drift/lockup)
 * - Off-track Dust (brownish dirt and green grass debris when running on grass/gravel)
 * - Exhaust Backfire Flame Bursts
 * Zero external sprite images — 100% Canvas procedurally generated textures.
 */
export class ParticleManager {
  private particleGroup: THREE.Group = new THREE.Group();
  private particles: Particle[] = [];

  private smokeTex: THREE.CanvasTexture;
  private dustTex: THREE.CanvasTexture;
  private grassTex: THREE.CanvasTexture;

  private planeGeo: THREE.PlaneGeometry;
  private flameGeo: THREE.SphereGeometry;

  private readonly MAX_PARTICLES = 160;

  constructor(private scene: THREE.Scene) {
    this.scene.add(this.particleGroup);

    this.planeGeo = new THREE.PlaneGeometry(1, 1);
    this.flameGeo = new THREE.SphereGeometry(0.09, 8, 8);

    // 1. Procedural Soft Tire Smoke Texture (White/Grey)
    const smokeCanvas = document.createElement('canvas');
    smokeCanvas.width = 64;
    smokeCanvas.height = 64;
    const sCtx = smokeCanvas.getContext('2d')!;
    const sGrad = sCtx.createRadialGradient(32, 32, 2, 32, 32, 30);
    sGrad.addColorStop(0, 'rgba(240, 240, 245, 0.85)');
    sGrad.addColorStop(0.45, 'rgba(210, 212, 218, 0.45)');
    sGrad.addColorStop(1, 'rgba(180, 185, 190, 0)');
    sCtx.fillStyle = sGrad;
    sCtx.fillRect(0, 0, 64, 64);
    this.smokeTex = new THREE.CanvasTexture(smokeCanvas);

    // 2. Procedural Earthy Dust Texture (Tan/Brown)
    const dustCanvas = document.createElement('canvas');
    dustCanvas.width = 64;
    dustCanvas.height = 64;
    const dCtx = dustCanvas.getContext('2d')!;
    const dGrad = dCtx.createRadialGradient(32, 32, 3, 32, 32, 28);
    dGrad.addColorStop(0, 'rgba(185, 160, 125, 0.85)');
    dGrad.addColorStop(0.5, 'rgba(150, 125, 95, 0.45)');
    dGrad.addColorStop(1, 'rgba(120, 95, 70, 0)');
    dCtx.fillStyle = dGrad;
    dCtx.fillRect(0, 0, 64, 64);
    this.dustTex = new THREE.CanvasTexture(dustCanvas);

    // 3. Procedural Grass Debris Texture (Greenish specks)
    const grassCanvas = document.createElement('canvas');
    grassCanvas.width = 32;
    grassCanvas.height = 32;
    const gCtx = grassCanvas.getContext('2d')!;
    gCtx.fillStyle = '#4c7828';
    gCtx.beginPath();
    gCtx.arc(16, 16, 12, 0, Math.PI * 2);
    gCtx.fill();
    gCtx.fillStyle = '#78a838';
    gCtx.beginPath();
    gCtx.arc(14, 14, 7, 0, Math.PI * 2);
    gCtx.fill();
    this.grassTex = new THREE.CanvasTexture(grassCanvas);
  }

  /**
   * Spawn billowy white tire smoke puff at tire contact point.
   */
  public emitTireSmoke(position: THREE.Vector3, intensity: number): void {
    if (this.particles.length >= this.MAX_PARTICLES) return;

    const mat = new THREE.MeshBasicMaterial({
      map: this.smokeTex,
      transparent: true,
      opacity: 0.65,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.planeGeo, mat);
    mesh.position.copy(position).add(new THREE.Vector3(0, 0.12, 0));

    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 1.8,
      0.9 + Math.random() * 1.4,
      (Math.random() - 0.5) * 1.8
    );

    this.particleGroup.add(mesh);
    this.particles.push({
      mesh,
      velocity: vel,
      life: 0,
      maxLife: 0.6 + Math.random() * 0.4,
      baseScale: 0.8 + intensity * 1.4,
      rotationSpeed: (Math.random() - 0.5) * 2.0,
      type: 'smoke',
    });
  }

  /**
   * Spawn off-track dust / grass / gravel debris at spinning wheel contact.
   */
  public emitOfftrackDust(
    position: THREE.Vector3,
    surface: 'grass' | 'gravel',
    intensity: number
  ): void {
    if (this.particles.length >= this.MAX_PARTICLES) return;

    const isGrass = surface === 'grass';
    const tex = isGrass && Math.random() < 0.4 ? this.grassTex : this.dustTex;

    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: isGrass ? 0.85 : 0.65,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.planeGeo, mat);
    mesh.position.copy(position).add(new THREE.Vector3(
      (Math.random() - 0.5) * 0.2,
      0.1,
      (Math.random() - 0.5) * 0.2
    ));

    // Particles kick backwards and upwards
    const vel = new THREE.Vector3(
      (Math.random() - 0.5) * 2.2,
      1.2 + Math.random() * 2.0,
      (Math.random() - 0.5) * 2.2
    );

    this.particleGroup.add(mesh);
    this.particles.push({
      mesh,
      velocity: vel,
      life: 0,
      maxLife: 0.5 + Math.random() * 0.4,
      baseScale: (isGrass ? 0.35 : 0.75) + intensity * 1.1,
      rotationSpeed: (Math.random() - 0.5) * 4.0,
      type: isGrass ? 'dust_grass' : 'dust_gravel',
    });
  }

  /**
   * Spawn fiery exhaust backfire flame burst at exhaust tips.
   */
  public emitExhaustFlame(position: THREE.Vector3, forwardDir: THREE.Vector3, isBoost: boolean = false): void {
    if (this.particles.length >= this.MAX_PARTICLES) return;

    for (let i = 0; i < 4; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: isBoost ? 0x00d9ff : (Math.random() > 0.4 ? 0xff4400 : 0xffcc00),
        transparent: true,
        opacity: 0.95,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.flameGeo, mat);
      mesh.position.copy(position).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08,
        (Math.random() - 0.5) * 0.08
      ));

      const flameVel = forwardDir.clone().negate().multiplyScalar(4.5 + Math.random() * 4.5)
        .add(new THREE.Vector3((Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0));

      this.particleGroup.add(mesh);
      this.particles.push({
        mesh,
        velocity: flameVel,
        life: 0,
        maxLife: 0.16 + Math.random() * 0.08,
        baseScale: 1.0,
        rotationSpeed: 0,
        type: 'flame',
      });
    }
  }

  /**
   * Spawn bright glowing golden sparks on collision impact or barrier scrape.
   */
  public emitSparks(position: THREE.Vector3, velocityDir: THREE.Vector3, count: number = 8): void {
    if (this.particles.length >= this.MAX_PARTICLES) return;

    for (let i = 0; i < count; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: Math.random() > 0.3 ? 0xffcc22 : 0xff7700,
        transparent: true,
        opacity: 1.0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(this.flameGeo, mat);
      mesh.position.copy(position).add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1,
        (Math.random() - 0.5) * 0.1
      ));

      const sparkVel = velocityDir.clone().multiplyScalar(3.0 + Math.random() * 6.0)
        .add(new THREE.Vector3(
          (Math.random() - 0.5) * 5.0,
          1.5 + Math.random() * 3.5,
          (Math.random() - 0.5) * 5.0
        ));

      this.particleGroup.add(mesh);
      this.particles.push({
        mesh,
        velocity: sparkVel,
        life: 0,
        maxLife: 0.15 + Math.random() * 0.2,
        baseScale: 0.45,
        rotationSpeed: 0,
        type: 'spark',
      });
    }
  }

  /**
   * Animate particle positions, scales, billboarding, and fade-outs.
   */
  public update(dt: number, camera: THREE.Camera): void {
    const camQuat = camera.quaternion;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) {
        this.particleGroup.remove(p.mesh);
        p.mesh.material = undefined as unknown as THREE.Material;
        this.particles.splice(i, 1);
        continue;
      }

      p.mesh.position.addScaledVector(p.velocity, dt);
      const progress = p.life / p.maxLife;

      if (p.type === 'flame' || p.type === 'spark') {
        const fScale = (1.0 - progress) * (p.type === 'spark' ? 0.6 : 1.6);
        p.mesh.scale.set(fScale, fScale, fScale);
        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        mat.opacity = 1.0 - progress;
      } else {
        // Smoke & Dust expand and fade
        const s = p.baseScale * (1.0 + progress * 2.8);
        p.mesh.scale.set(s, s, s);
        p.mesh.quaternion.copy(camQuat); // Billboard facing camera
        p.mesh.rotateZ(p.rotationSpeed * dt);

        const mat = p.mesh.material as THREE.MeshBasicMaterial;
        const maxOpacity = p.type === 'dust_grass' ? 0.75 : 0.5;
        mat.opacity = (1.0 - progress) * maxOpacity;
      }
    }
  }
}

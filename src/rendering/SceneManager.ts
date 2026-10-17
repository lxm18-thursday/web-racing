import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SpeedEffectShader } from './SpeedEffectShader';

/**
 * High-performance Three.js Scene, Renderer, and Post-Processing Manager.
 * Configures PCF Soft Shadows, ACES Filmic Tone Mapping, UnrealBloomPass for emissives/lights,
 * and dynamic radial speed blur / speed lines when speed > 180 km/h.
 */
export class SceneManager {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public composer: EffectComposer;
  public renderPass: RenderPass;
  public bloomPass: UnrealBloomPass;
  public speedPass: ShaderPass;
  public canvas: HTMLCanvasElement;

  private elapsedTime: number = 0;

  constructor() {
    this.scene = new THREE.Scene();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      stencil: false,
      depth: true,
    });

    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(dpr);

    // High fidelity shadow mapping and filmic color reproduction
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.canvas = this.renderer.domElement;
    this.canvas.id = 'game-canvas';
    document.body.appendChild(this.canvas);

    // --- Post-Processing Pipeline ---
    this.composer = new EffectComposer(this.renderer);

    // 1. Scene Render Pass (dummy camera initially, replaced in render loop)
    const dummyCam = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
    this.renderPass = new RenderPass(this.scene, dummyCam);
    this.composer.addPass(this.renderPass);

    // 2. UnrealBloomPass: Realistic HDR bloom for brake lights, headlights, and neon HUD
    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(width, height),
      0.42, // Strength
      0.28, // Radius
      0.94  // Threshold (only high luminance emissives bloom)
    );
    this.composer.addPass(this.bloomPass);

    // 3. High-Speed Radial Blur & Speed Lines Pass (> 180 km/h)
    this.speedPass = new ShaderPass(SpeedEffectShader);
    this.speedPass.uniforms.uResolution.value.set(width, height);
    this.composer.addPass(this.speedPass);

    window.addEventListener('resize', () => this.onResize());
  }

  private onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);

    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(dpr);

    this.composer.setSize(width, height);
    this.bloomPass.setSize(width, height);
    this.speedPass.uniforms.uResolution.value.set(width, height);
  }

  public getAspectRatio(): number {
    return window.innerWidth / window.innerHeight;
  }

  /**
   * Render frame through post-processing pipeline with speed-sensitive effects.
   */
  public render(camera: THREE.Camera, dt: number = 0.016, speedKmh: number = 0): void {
    this.elapsedTime += dt;
    this.renderPass.camera = camera;

    // Dynamically modulate speed lines & peripheral radial blur above 180 km/h
    const speedRatio = speedKmh > 180 ? Math.min(1.0, (speedKmh - 180) / 95) : 0;
    this.speedPass.uniforms.uSpeedRatio.value = speedRatio;
    this.speedPass.uniforms.uTime.value = this.elapsedTime;

    this.composer.render();
  }
}

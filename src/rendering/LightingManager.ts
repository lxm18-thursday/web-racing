import * as THREE from 'three';
import { WeatherMode, SkyboxGenerator } from './SkyboxGenerator';
import { TrackScenery } from '../track/TrackScenery';

/**
 * Dynamic Environment Lighting Manager.
 * Configures Directional Sunlight, PCF Soft Shadows, Ambient illumination,
 * and handles transitions between Sunny, Sunset, and Night.
 */
export class LightingManager {
  public sunLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  public hemiLight: THREE.HemisphereLight;

  public currentMode: WeatherMode = 'sunny';

  constructor(
    private scene: THREE.Scene,
    private skybox: SkyboxGenerator,
    private scenery: TrackScenery | null
  ) {
    // 1. Directional Sun Light
    this.sunLight = new THREE.DirectionalLight(0xfff5e6, 2.5);
    this.sunLight.position.set(120, 250, 100);
    this.sunLight.castShadow = true;

    // Shadow Map Frustum for high quality shadows around vehicle
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 600;
    const shadowD = 80;
    this.sunLight.shadow.camera.left = -shadowD;
    this.sunLight.shadow.camera.right = shadowD;
    this.sunLight.shadow.camera.top = shadowD;
    this.sunLight.shadow.camera.bottom = -shadowD;
    this.sunLight.shadow.bias = -0.0005;
    this.scene.add(this.sunLight);

    // 2. Hemisphere Light
    this.hemiLight = new THREE.HemisphereLight(0xddeeff, 0x334422, 0.6);
    this.scene.add(this.hemiLight);

    // 3. Ambient Fill Light
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
    this.scene.add(this.ambientLight);

    // 4. Atmospheric Fog
    this.scene.fog = new THREE.FogExp2(0xcce2ff, 0.001);

    this.applyMode('sunny');
  }

  public setMode(mode: WeatherMode): void {
    this.currentMode = mode;
    this.skybox.setMode(mode);
    this.applyMode(mode);
  }

  public cycleMode(): WeatherMode {
    if (this.currentMode === 'sunny') {
      this.setMode('sunset');
    } else if (this.currentMode === 'sunset') {
      this.setMode('night');
    } else {
      this.setMode('sunny');
    }
    return this.currentMode;
  }

  private applyMode(mode: WeatherMode): void {
    if (mode === 'sunny') {
      this.sunLight.intensity = 2.5;
      this.sunLight.color.setHex(0xfff5e6);
      this.sunLight.position.set(120, 250, 100);
      this.ambientLight.intensity = 0.4;
      this.hemiLight.intensity = 0.6;
      this.hemiLight.color.setHex(0xddeeff);
      this.hemiLight.groundColor.setHex(0x334422);

      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0xb2d9ff);
        this.scene.fog.density = 0.0008;
      }

      if (this.scenery) this.scenery.setNightMode(false);

    } else if (mode === 'sunset') {
      this.sunLight.intensity = 1.6;
      this.sunLight.color.setHex(0xff7733);
      this.sunLight.position.set(280, 60, -200); // Low golden angle
      this.ambientLight.intensity = 0.3;
      this.hemiLight.intensity = 0.4;
      this.hemiLight.color.setHex(0xff9966);
      this.hemiLight.groundColor.setHex(0x442211);

      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0xd06c40);
        this.scene.fog.density = 0.0012;
      }

      if (this.scenery) this.scenery.setNightMode(false);

    } else {
      // Night Mode
      this.sunLight.intensity = 0.15;
      this.sunLight.color.setHex(0x6688cc); // Cool moonlight
      this.sunLight.position.set(-100, 150, 100);
      this.ambientLight.intensity = 0.1;
      this.hemiLight.intensity = 0.12;
      this.hemiLight.color.setHex(0x223355);
      this.hemiLight.groundColor.setHex(0x050a14);

      if (this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog.color.setHex(0x070c1a);
        this.scene.fog.density = 0.002;
      }

      if (this.scenery) this.scenery.setNightMode(true);
    }
  }

  /**
   * Keep shadow camera centered around the player vehicle.
   */
  public updateFollowTarget(targetPos: THREE.Vector3): void {
    if (this.currentMode === 'sunny') {
      this.sunLight.position.set(targetPos.x + 120, targetPos.y + 250, targetPos.z + 100);
    } else if (this.currentMode === 'sunset') {
      this.sunLight.position.set(targetPos.x + 280, targetPos.y + 60, targetPos.z - 200);
    } else {
      this.sunLight.position.set(targetPos.x - 100, targetPos.y + 150, targetPos.z + 100);
    }
    this.sunLight.target.position.copy(targetPos);
    this.sunLight.target.updateMatrixWorld();
  }
}

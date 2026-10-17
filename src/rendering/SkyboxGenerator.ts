import * as THREE from 'three';

export type WeatherMode = 'sunny' | 'sunset' | 'night';

/**
 * Procedural Sky Dome and atmospheric lighting generator.
 * Eliminates all external skybox image dependencies.
 */
export class SkyboxGenerator {
  public skyMesh: THREE.Mesh;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private skyTexture: THREE.CanvasTexture;

  constructor(private scene: THREE.Scene) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 1024;
    this.canvas.height = 512;
    this.ctx = this.canvas.getContext('2d')!;

    this.skyTexture = new THREE.CanvasTexture(this.canvas);
    this.skyTexture.mapping = THREE.EquirectangularReflectionMapping;

    // Inverted Sky Dome
    const skyGeo = new THREE.SphereGeometry(1800, 32, 16);
    const skyMat = new THREE.MeshBasicMaterial({
      map: this.skyTexture,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });
    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.scene.add(this.skyMesh);

    this.setMode('sunny');
  }

  public setMode(mode: WeatherMode): void {
    const w = this.canvas.width;
    const h = this.canvas.height;
    const ctx = this.ctx;

    if (mode === 'sunny') {
      // Crisp azure blue sky with bright horizon haze
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1050a0');    // Deep zenith blue
      grad.addColorStop(0.45, '#3b8cd9'); // Mid sky
      grad.addColorStop(0.7, '#88c8f7');  // Horizon haze
      grad.addColorStop(0.85, '#d8eefc'); // Ground blend
      grad.addColorStop(1, '#a0c490');    // Far terrain
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Bright sun glare circle
      const sunGrad = ctx.createRadialGradient(w * 0.4, h * 0.35, 5, w * 0.4, h * 0.35, 120);
      sunGrad.addColorStop(0, 'rgba(255, 255, 245, 1)');
      sunGrad.addColorStop(0.3, 'rgba(255, 250, 220, 0.6)');
      sunGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, w, h);

      // Soft procedural cumulus clouds
      ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
      for (let i = 0; i < 25; i++) {
        const cx = Math.random() * w;
        const cy = h * 0.4 + Math.random() * (h * 0.25);
        const cr = 40 + Math.random() * 80;
        ctx.beginPath();
        ctx.ellipse(cx, cy, cr, cr * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
      }

    } else if (mode === 'sunset') {
      // Golden hour / fiery twilight
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#1d1135');    // Indigo zenith
      grad.addColorStop(0.4, '#561c56');  // Violet
      grad.addColorStop(0.65, '#b83b28'); // Fiery orange
      grad.addColorStop(0.78, '#e67329'); // Golden horizon
      grad.addColorStop(0.88, '#f7b05b'); // Sun glow
      grad.addColorStop(1, '#2c1e18');    // Silhouette ground
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Low sunset sun orb
      const sunGrad = ctx.createRadialGradient(w * 0.45, h * 0.72, 5, w * 0.45, h * 0.72, 160);
      sunGrad.addColorStop(0, 'rgba(255, 240, 180, 1)');
      sunGrad.addColorStop(0.2, 'rgba(255, 140, 50, 0.8)');
      sunGrad.addColorStop(1, 'rgba(200, 50, 20, 0)');
      ctx.fillStyle = sunGrad;
      ctx.fillRect(0, 0, w, h);

    } else {
      // Night Mode: Dark navy starry night
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, '#03050c');
      grad.addColorStop(0.6, '#060a17');
      grad.addColorStop(0.85, '#0b1329');
      grad.addColorStop(1, '#020308');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Procedural starry sky
      ctx.fillStyle = '#ffffff';
      for (let i = 0; i < 400; i++) {
        const sx = Math.random() * w;
        const sy = Math.random() * (h * 0.75);
        const radius = Math.random() * 1.5;
        const alpha = 0.3 + Math.random() * 0.7;
        ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // Crescent Moon
      ctx.fillStyle = 'rgba(240, 245, 255, 0.9)';
      ctx.beginPath();
      ctx.arc(w * 0.7, h * 0.25, 25, 0, Math.PI * 2);
      ctx.fill();
      // Moon shadow cutout
      ctx.fillStyle = '#060a17';
      ctx.beginPath();
      ctx.arc(w * 0.7 + 10, h * 0.25 - 4, 22, 0, Math.PI * 2);
      ctx.fill();
    }

    this.skyTexture.needsUpdate = true;
  }
}

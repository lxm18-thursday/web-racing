import * as THREE from 'three';

/**
 * Procedural PBR Texture Generator using HTML5 Canvas.
 * Generates all track, car, and environment textures in-memory without external image assets.
 */
export class TextureGenerator {
  private static cache: Map<string, THREE.CanvasTexture> = new Map();

  /**
   * Procedural dark asphalt track texture with FIA track limits, center dashed line,
   * tire rubber racing grooves, and multi-octave aggregate stone noise.
   */
  public static createAsphaltTexture(): THREE.CanvasTexture {
    const key = 'asphalt_diffuse';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const width = 512;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    // 1. Base dark charcoal tarmac
    ctx.fillStyle = '#1c1e22';
    ctx.fillRect(0, 0, width, height);

    // 2. Multi-octave stone aggregate noise
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 32;
      const grain = (Math.random() - 0.5) * 16;
      const val = 30 + noise + grain;
      data[i] = Math.min(255, Math.max(0, val));
      data[i + 1] = Math.min(255, Math.max(0, val + 1));
      data[i + 2] = Math.min(255, Math.max(0, val + 2));
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    // 3. Dark rubbered-in racing groove tire tracks (where high-downforce cars lay rubber)
    const grooveGrad1 = ctx.createLinearGradient(width * 0.18, 0, width * 0.38, 0);
    grooveGrad1.addColorStop(0, 'rgba(12, 13, 16, 0)');
    grooveGrad1.addColorStop(0.5, 'rgba(10, 11, 14, 0.45)');
    grooveGrad1.addColorStop(1, 'rgba(12, 13, 16, 0)');
    ctx.fillStyle = grooveGrad1;
    ctx.fillRect(width * 0.18, 0, width * 0.20, height);

    const grooveGrad2 = ctx.createLinearGradient(width * 0.62, 0, width * 0.82, 0);
    grooveGrad2.addColorStop(0, 'rgba(12, 13, 16, 0)');
    grooveGrad2.addColorStop(0.5, 'rgba(10, 11, 14, 0.45)');
    grooveGrad2.addColorStop(1, 'rgba(12, 13, 16, 0)');
    ctx.fillStyle = grooveGrad2;
    ctx.fillRect(width * 0.62, 0, width * 0.20, height);

    // 4. Outer FIA Track Limit Solid White Lines (Outer boundaries)
    ctx.fillStyle = '#f0f2f5';
    // Left border solid line (width ~4% of track)
    ctx.fillRect(0, 0, 18, height);
    // Right border solid line
    ctx.fillRect(width - 18, 0, 18, height);

    // 5. Center Dashed White Passing Line (Stippled dashes)
    ctx.fillStyle = '#eaecf0';
    const dashLength = 64;
    const dashGap = 64;
    for (let y = 0; y < height; y += (dashLength + dashGap)) {
      ctx.fillRect(width / 2 - 5, y, 10, dashLength);
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Procedural Red & White racing curb texture (FIA standard alternating pattern).
   */
  public static createCurbTexture(): THREE.CanvasTexture {
    const key = 'curb_diffuse';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const width = 256;
    const height = 512;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const stripes = 8;
    const stripeH = height / stripes;

    for (let i = 0; i < stripes; i++) {
      const isRed = i % 2 === 0;
      ctx.fillStyle = isRed ? '#e01818' : '#f5f5f7';
      ctx.fillRect(0, i * stripeH, width, stripeH);

      // Inner bevel / 3D shadow gradient across each curb block
      const grad = ctx.createLinearGradient(0, i * stripeH, width, i * stripeH);
      grad.addColorStop(0, 'rgba(0,0,0,0.4)');
      grad.addColorStop(0.12, 'rgba(255,255,255,0.25)');
      grad.addColorStop(0.85, 'rgba(0,0,0,0.1)');
      grad.addColorStop(1, 'rgba(0,0,0,0.45)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, i * stripeH, width, stripeH);
    }

    // Dirt & rubber scuffs
    for (let j = 0; j < 40; j++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const r = Math.random() * 8 + 2;
      ctx.fillStyle = 'rgba(15, 15, 18, 0.2)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Procedural grass texture for trackside terrain.
   */
  public static createGrassTexture(): THREE.CanvasTexture {
    const key = 'grass_diffuse';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#2a5424';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 45;
      data[i] = Math.min(255, Math.max(0, 42 + n * 0.7));
      data[i + 1] = Math.min(255, Math.max(0, 88 + n));
      data[i + 2] = Math.min(255, Math.max(0, 36 + n * 0.6));
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(40, 40);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Procedural Gravel Run-off Trap texture.
   */
  public static createGravelTexture(): THREE.CanvasTexture {
    const key = 'gravel_diffuse';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#8f7e62';
    ctx.fillRect(0, 0, size, size);

    const imgData = ctx.getImageData(0, 0, size, size);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = (Math.random() - 0.5) * 60;
      data[i] = Math.min(255, Math.max(0, 145 + n));
      data[i + 1] = Math.min(255, Math.max(0, 128 + n));
      data[i + 2] = Math.min(255, Math.max(0, 98 + n));
      data[i + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 1);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Procedural Carbon Fiber weave texture (2x2 twill).
   */
  public static createCarbonFiberTexture(): THREE.CanvasTexture {
    const key = 'carbon_fiber';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#0f0f11';
    ctx.fillRect(0, 0, size, size);

    const tileSize = 8;
    for (let x = 0; x < size; x += tileSize) {
      for (let y = 0; y < size; y += tileSize) {
        const isLight = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        ctx.fillStyle = isLight ? '#28292e' : '#121214';
        ctx.fillRect(x, y, tileSize, tileSize);

        ctx.strokeStyle = isLight ? '#3a3c44' : '#08080a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + tileSize, y + tileSize);
        ctx.stroke();
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(6, 6);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Procedural Tire Tread texture for realistic sidewalls and contact patch.
   */
  public static createTireTreadTexture(): THREE.CanvasTexture {
    const key = 'tire_tread';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const width = 256;
    const height = 256;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    ctx.fillStyle = '#161618';
    ctx.fillRect(0, 0, width, height);

    // Tread longitudinal grooves
    ctx.fillStyle = '#0a0a0b';
    ctx.fillRect(35, 0, 18, height);
    ctx.fillRect(95, 0, 18, height);
    ctx.fillRect(145, 0, 18, height);
    ctx.fillRect(205, 0, 18, height);

    // Lateral grip sipes
    ctx.strokeStyle = '#0e0e10';
    ctx.lineWidth = 4;
    for (let y = 0; y < height; y += 24) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(35, y + 12);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(113, y);
      ctx.lineTo(145, y + 12);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(223, y);
      ctx.lineTo(256, y + 12);
      ctx.stroke();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 4);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Procedural Brake Disc Rotor texture with cross-drilled holes and radial brushed steel.
   */
  public static createBrakeDiscTexture(): THREE.CanvasTexture {
    const key = 'brake_disc';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const center = size / 2;

    const grad = ctx.createRadialGradient(center, center, 30, center, center, 120);
    grad.addColorStop(0, '#555558');
    grad.addColorStop(0.3, '#bbbbbe');
    grad.addColorStop(0.5, '#77777a');
    grad.addColorStop(0.8, '#cccccc');
    grad.addColorStop(1, '#444446');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(center, center, 120, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#111111';
    for (let ring = 50; ring < 115; ring += 15) {
      const count = Math.floor(ring / 4);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + (ring * 0.1);
        const hx = center + Math.cos(angle) * ring;
        const hy = center + Math.sin(angle) * ring;
        ctx.beginPath();
        ctx.arc(hx, hy, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.fillStyle = '#222225';
    ctx.beginPath();
    ctx.arc(center, center, 40, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Start / Finish Line Checkered Grid Texture.
   */
  public static createCheckeredLineTexture(): THREE.CanvasTexture {
    const key = 'checkered_line';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    const cols = 8;
    const rows = 4;
    const w = size / cols;
    const h = size / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#f5f5f7' : '#18181b';
        ctx.fillRect(c * w, r * h, w, h);
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    this.cache.set(key, texture);
    return texture;
  }

  /**
   * Armco barrier galvanized steel texture.
   */
  public static createArmcoTexture(): THREE.CanvasTexture {
    const key = 'armco_barrier';
    if (this.cache.has(key)) return this.cache.get(key)!;

    const width = 64;
    const height = 128;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d')!;

    const grad = ctx.createLinearGradient(0, 0, 0, height);
    grad.addColorStop(0, '#5a5e66');
    grad.addColorStop(0.25, '#c5cad4');
    grad.addColorStop(0.5, '#40434a');
    grad.addColorStop(0.75, '#c5cad4');
    grad.addColorStop(1, '#5a5e66');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 1);
    this.cache.set(key, texture);
    return texture;
  }
}

import * as THREE from 'three';

/**
 * Custom Post-Processing Shader for High-Speed Dynamics (Speed > 180 km/h):
 * - Peripheral Radial Motion Blur
 * - High-speed Edge Chromatic Aberration
 * - Inward Streaking Speed Lines
 * - Speed Tunnel Vignette
 */
export const SpeedEffectShader = {
  name: 'SpeedEffectShader',
  uniforms: {
    tDiffuse: { value: null },
    uSpeedRatio: { value: 0.0 }, // 0.0 at <= 180 km/h, 1.0 at >= 280 km/h
    uTime: { value: 0.0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uSpeedRatio;
    uniform float uTime;
    uniform vec2 uResolution;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5, 0.5);
      vec2 uv = vUv;
      vec2 dir = uv - center;
      float dist = length(dir);

      vec4 color = texture2D(tDiffuse, uv);

      if (uSpeedRatio > 0.005) {
        // 1. Radial Motion Blur towards periphery (leaves center windshield sharp)
        float blurStrength = uSpeedRatio * smoothstep(0.3, 0.9, dist) * 0.028;
        vec4 blurSum = color;
        const int SAMPLES = 6;
        for (int i = 1; i <= SAMPLES; i++) {
          float scale = 1.0 - blurStrength * (float(i) / float(SAMPLES));
          vec2 sampleUv = center + dir * scale;
          blurSum += texture2D(tDiffuse, sampleUv);
        }
        color = blurSum / float(SAMPLES + 1);

        // 2. High-speed Chromatic Aberration at outer edges
        float chroma = uSpeedRatio * smoothstep(0.4, 0.95, dist) * 0.008;
        float r = texture2D(tDiffuse, center + dir * (1.0 + chroma)).r;
        float b = texture2D(tDiffuse, center + dir * (1.0 - chroma)).b;
        color.r = mix(color.r, r, 0.5);
        color.b = mix(color.b, b, 0.5);

        // 3. Dynamic High-Speed Streaks / Speed Lines
        float angle = atan(dir.y, dir.x);
        float streakNoise = sin(angle * 60.0 + uTime * 25.0) * cos(angle * 30.0 - uTime * 15.0);
        float streakMask = smoothstep(0.5, 0.92, dist) * smoothstep(0.75, 0.98, streakNoise);
        vec3 streakColor = vec3(0.9, 0.95, 1.0);
        color.rgb += streakColor * streakMask * uSpeedRatio * 0.25;

        // 4. Subtle Speed Tunnel Vignette
        float vignette = smoothstep(0.95, 0.55, dist);
        color.rgb *= mix(1.0, 0.88 + 0.12 * vignette, uSpeedRatio);
      }

      gl_FragColor = color;
    }
  `
};

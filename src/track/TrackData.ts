import * as THREE from 'three';

/**
 * Track layout specification and CatmullRomCurve3 path.
 * Meets requirements of length >= 2.5km, technical S-curves, hairpin, elevation, and 3 sectors.
 */
export class TrackData {
  public static readonly TRACK_WIDTH = 14.0; // 14 meters wide FIA Grade 1 standard
  public static readonly CURB_WIDTH = 1.8;   // 1.8m curb stripes on inside/outside
  public static readonly RUNOFF_WIDTH = 6.0; // 6m gravel/asphalt runoff

  public curve: THREE.CatmullRomCurve3;
  public totalLength: number = 0;

  // Sector boundaries along curve parameter t in [0, 1]
  public sector1End: number = 0.32;
  public sector2End: number = 0.68;

  constructor() {
    // 24 control points designing a professional ~2.8km international closed racing circuit:
    // - Long Main Straight with Start/Finish (Z: 0 to 500)
    // - High-speed Turn 1 & 2 Sweeper
    // - Technical S-chicane (Turn 3, 4, 5) with crest elevation
    // - Uphill Straight
    // - 180-degree Hairpin Turn 7 (heavy braking zone)
    // - Downhill High-Speed S-bends (Turns 8, 9, 10)
    // - Fast Backstraight
    // - Sweeping Parabolica return to Main Straight
    const controlPoints: THREE.Vector3[] = [
      // Main Straight (Start / Finish line at index 0)
      new THREE.Vector3(0, 0, 0),        // t ~ 0.00 (Start/Finish)
      new THREE.Vector3(0, 0, 150),
      new THREE.Vector3(0, 0, 320),      // End of straight, high speed
      new THREE.Vector3(25, 2, 430),     // Turn 1 entry
      new THREE.Vector3(90, 4, 520),     // Turn 1 apex (right sweeper)
      new THREE.Vector3(180, 6, 540),    // Turn 2 exit

      // Technical S-Bends (Sector 1 transition)
      new THREE.Vector3(260, 8, 480),    // Turn 3 entry (left)
      new THREE.Vector3(280, 9, 390),    // S-bend chicane
      new THREE.Vector3(340, 11, 330),   // Turn 4 right
      new THREE.Vector3(420, 12, 310),   // Turn 5 left

      // Sector 2: Uphill approach & Hairpin
      new THREE.Vector3(520, 14, 270),   // Crest of hill
      new THREE.Vector3(600, 15, 200),   // Braking zone for Hairpin
      new THREE.Vector3(630, 14, 110),   // Turn 6 hairpin entry
      new THREE.Vector3(600, 12, 30),    // Turn 7 Hairpin apex (tight 180)
      new THREE.Vector3(510, 10, 20),    // Hairpin exit acceleration

      // Downhill technical sweepers
      new THREE.Vector3(400, 7, -30),    // Downhill
      new THREE.Vector3(320, 5, -110),   // Turn 8 left
      new THREE.Vector3(280, 4, -220),   // Turn 9 right
      new THREE.Vector3(220, 3, -340),   // Turn 10 left

      // Sector 3: Back Straight & Parabolica
      new THREE.Vector3(140, 2, -450),   // Back straight entry
      new THREE.Vector3(40, 1, -520),    // High-speed back straight
      new THREE.Vector3(-80, 0, -480),   // Parabolica entry
      new THREE.Vector3(-140, 0, -320),  // Parabolica apex
      new THREE.Vector3(-110, 0, -180),  // Parabolica exit
      new THREE.Vector3(-40, 0, -120),   // Final turn sweep
      new THREE.Vector3(0, 0, -60),      // Straight approach
    ];

    // Create smooth closed cubic curve with Centripetal parametrization to avoid loops
    this.curve = new THREE.CatmullRomCurve3(controlPoints, true, 'centripetal', 0.5);
    this.totalLength = this.curve.getLength();
    console.log(`[TrackData] Circuit generated with length: ${Math.round(this.totalLength)} meters.`);
  }

  /**
   * Get point, tangent, and normal frame along curve parameter t (0 <= t <= 1).
   */
  public getFrameAt(t: number): {
    position: THREE.Vector3;
    tangent: THREE.Vector3;
    normal: THREE.Vector3;
    binormal: THREE.Vector3;
    curvature: number;
  } {
    const normT = ((t % 1) + 1) % 1;
    const position = this.curve.getPointAt(normT);
    const tangent = this.curve.getTangentAt(normT).normalize();

    // Up vector with gentle banking into corners
    const worldUp = new THREE.Vector3(0, 1, 0);
    // Binormal (perpendicular to track centerline on road plane)
    const binormal = new THREE.Vector3().crossVectors(tangent, worldUp).normalize();
    // Recompute normal perpendicular to road surface
    const normal = new THREE.Vector3().crossVectors(binormal, tangent).normalize();

    // Curvature estimation by sampling delta tangent
    const dt = 0.005;
    const tNext = ((normT + dt) % 1 + 1) % 1;
    const tanNext = this.curve.getTangentAt(tNext).normalize();
    const curvature = tangent.angleTo(tanNext) / (dt * this.totalLength);

    return { position, tangent, normal, binormal, curvature };
  }

  /**
   * Determine which sector a parameter t is in (1, 2, or 3).
   */
  public getSector(t: number): number {
    const normT = ((t % 1) + 1) % 1;
    if (normT < this.sector1End) return 1;
    if (normT < this.sector2End) return 2;
    return 3;
  }

  /**
   * Find closest point on curve and parameter t for any 3D position.
   */
  public getClosestT(pos: THREE.Vector3, samples: number = 200): { t: number; distance: number; point: THREE.Vector3 } {
    let closestT = 0;
    let minDistSq = Infinity;
    let closestPt = new THREE.Vector3();

    // Coarse search
    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const pt = this.curve.getPointAt(t);
      const dSq = pt.distanceToSquared(pos);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        closestT = t;
        closestPt = pt;
      }
    }

    // Refinement search
    const step = 1 / samples;
    const refineSamples = 16;
    for (let j = -refineSamples; j <= refineSamples; j++) {
      const t = ((closestT + (j / refineSamples) * step) % 1 + 1) % 1;
      const pt = this.curve.getPointAt(t);
      const dSq = pt.distanceToSquared(pos);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        closestT = t;
        closestPt = pt;
      }
    }

    return { t: closestT, distance: Math.sqrt(minDistSq), point: closestPt };
  }
}

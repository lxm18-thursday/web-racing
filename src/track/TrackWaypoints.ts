import * as THREE from 'three';
import { TrackData } from './TrackData';

export interface Waypoint {
  index: number;
  t: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  binormal: THREE.Vector3;
  normal: THREE.Vector3;
  curvature: number;
  targetSpeedKmh: number; // Suggested AI apex/straight speed
  distanceFromStart: number;
}

/**
 * Pre-calculated track waypoints for AI pathfinding, racing line optimization,
 * telemetry progress tracking, and minimap visualization.
 */
export class TrackWaypoints {
  public waypoints: Waypoint[] = [];
  public totalLength: number = 0;

  constructor(private trackData: TrackData, sampleCount: number = 500) {
    this.generate(sampleCount);
  }

  private generate(samples: number): void {
    this.waypoints = [];
    this.totalLength = this.trackData.totalLength;

    let accumDist = 0;
    let prevPos: THREE.Vector3 | null = null;

    for (let i = 0; i < samples; i++) {
      const t = i / samples;
      const frame = this.trackData.getFrameAt(t);

      if (prevPos) {
        accumDist += prevPos.distanceTo(frame.position);
      }
      prevPos = frame.position.clone();

      // Calculate safe cornering speed based on lateral acceleration formula:
      // a_lat = v^2 / R = v^2 * curvature <= 1.8g (~17.6 m/s^2 for racing slicks + downforce)
      // v_max = sqrt(17.6 / max(curvature, 0.0001))
      const maxLatAcc = 19.0; // m/s^2
      const safeSpeedMs = Math.sqrt(maxLatAcc / Math.max(frame.curvature, 0.0002));
      let targetKmh = Math.min(270, Math.max(65, safeSpeedMs * 3.6));

      // Fine-tune specific technical zones
      if (t >= 0.52 && t <= 0.60) {
        // Hairpin Turn 7 heavy braking & apex
        targetKmh = Math.min(targetKmh, 68);
      } else if (t >= 0.28 && t <= 0.38) {
        // Technical chicane
        targetKmh = Math.min(targetKmh, 115);
      } else if (t <= 0.12 || (t >= 0.78 && t <= 0.88)) {
        // High speed straights
        targetKmh = Math.max(targetKmh, 250);
      }

      this.waypoints.push({
        index: i,
        t,
        position: frame.position,
        tangent: frame.tangent,
        binormal: frame.binormal,
        normal: frame.normal,
        curvature: frame.curvature,
        targetSpeedKmh: targetKmh,
        distanceFromStart: accumDist
      });
    }
  }

  /**
   * Find nearest waypoint index from a given 3D position.
   */
  public getClosestWaypointIndex(pos: THREE.Vector3, hintIndex: number = -1): number {
    const count = this.waypoints.length;
    let bestIdx = 0;
    let minDistSq = Infinity;

    // If hint is available, search nearby window first for O(1) performance
    if (hintIndex >= 0 && hintIndex < count) {
      const windowSize = 30;
      for (let offset = -windowSize; offset <= windowSize; offset++) {
        const idx = ((hintIndex + offset) % count + count) % count;
        const dSq = this.waypoints[idx].position.distanceToSquared(pos);
        if (dSq < minDistSq) {
          minDistSq = dSq;
          bestIdx = idx;
        }
      }
      if (minDistSq < 400) { // Within 20m of track
        return bestIdx;
      }
    }

    // Fallback global search
    for (let i = 0; i < count; i++) {
      const dSq = this.waypoints[i].position.distanceToSquared(pos);
      if (dSq < minDistSq) {
        minDistSq = dSq;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  public getWaypoint(index: number): Waypoint {
    const count = this.waypoints.length;
    return this.waypoints[((index % count) + count) % count];
  }
}

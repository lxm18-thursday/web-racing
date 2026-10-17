import * as THREE from 'three';
import { TrackData } from './TrackData';

/**
 * Procedural Track Scenery & Architectural Props.
 * Generates Start/Finish Gantry with countdown lights, Grandstands, Distance markers,
 * Floodlight towers, and low-poly trees.
 */
export class TrackScenery {
  public sceneryGroup: THREE.Group = new THREE.Group();
  public floodlights: THREE.SpotLight[] = [];
  public gantryLights: THREE.Mesh[] = [];

  constructor(private trackData: TrackData) {
    this.buildGantry();
    this.buildGrandstands();
    this.buildDistanceMarkers();
    this.buildFloodlightTowers();
    this.buildTrees();
  }

  /**
   * Overhead Start/Finish Gantry with start lights.
   */
  private buildGantry(): void {
    const gantry = new THREE.Group();
    const frame = this.trackData.getFrameAt(0);
    const pos = frame.position;
    const tangent = frame.tangent;
    const binormal = frame.binormal;

    const span = TrackData.TRACK_WIDTH + 8;
    const height = 7.5;

    // Truss structure material
    const trussMat = new THREE.MeshStandardMaterial({
      color: 0x2c3038,
      metalness: 0.8,
      roughness: 0.3
    });

    // Left and Right Vertical pillars
    const pillarGeo = new THREE.BoxGeometry(0.8, height, 0.8);
    const leftPillar = new THREE.Mesh(pillarGeo, trussMat);
    leftPillar.position.addScaledVector(binormal, -span / 2).add(new THREE.Vector3(0, height / 2, 0));
    leftPillar.castShadow = true;
    gantry.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeo, trussMat);
    rightPillar.position.addScaledVector(binormal, span / 2).add(new THREE.Vector3(0, height / 2, 0));
    rightPillar.castShadow = true;
    gantry.add(rightPillar);

    // Cross beam
    const beamGeo = new THREE.BoxGeometry(span + 1.6, 1.0, 1.2);
    const crossBeam = new THREE.Mesh(beamGeo, trussMat);
    crossBeam.position.set(0, height, 0);
    crossBeam.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), binormal);
    crossBeam.castShadow = true;
    gantry.add(crossBeam);

    // 5 Start lights
    const lightHousingGeo = new THREE.BoxGeometry(0.5, 1.2, 0.4);
    const housingMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
    const bulbGeo = new THREE.SphereGeometry(0.2, 16, 16);

    for (let i = -2; i <= 2; i++) {
      const housing = new THREE.Mesh(lightHousingGeo, housingMat);
      housing.position.addScaledVector(binormal, i * 1.5).add(new THREE.Vector3(0, height - 1.2, 0));

      const bulbMat = new THREE.MeshStandardMaterial({
        color: 0xff0000,
        emissive: 0xff1111,
        emissiveIntensity: 1.5,
        roughness: 0.2
      });
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      bulb.position.addScaledVector(tangent, -0.22);
      housing.add(bulb);
      this.gantryLights.push(bulb);

      gantry.add(housing);
    }

    gantry.position.copy(pos);
    this.sceneryGroup.add(gantry);
  }

  /**
   * Main straight grandstands with roof canopy.
   */
  private buildGrandstands(): void {
    const grandstandMat = new THREE.MeshStandardMaterial({ color: 0x474b54, roughness: 0.6 });
    const seatMat1 = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.8 });
    const seatMat2 = new THREE.MeshStandardMaterial({ color: 0x2244cc, roughness: 0.8 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xdde2ea, roughness: 0.3, metalness: 0.5 });

    // Place grandstand along the main straight (t between 0.03 and 0.12)
    const tValues = [0.03, 0.07, 0.11];
    for (const t of tValues) {
      const frame = this.trackData.getFrameAt(t);
      const stand = new THREE.Group();

      // Base stepped wedge
      const tiers = 6;
      for (let r = 0; r < tiers; r++) {
        const stepGeo = new THREE.BoxGeometry(24, 1.2, 2.5);
        const step = new THREE.Mesh(stepGeo, grandstandMat);
        step.position.set(0, r * 1.2 + 0.6, r * 2.2);
        step.castShadow = true;
        stand.add(step);

        // Crowd blocks
        const crowdGeo = new THREE.BoxGeometry(22, 0.8, 1.2);
        const crowd = new THREE.Mesh(crowdGeo, r % 2 === 0 ? seatMat1 : seatMat2);
        crowd.position.set(0, r * 1.2 + 1.4, r * 2.2);
        stand.add(crowd);
      }

      // Roof canopy
      const roofGeo = new THREE.BoxGeometry(26, 0.4, 16);
      const roof = new THREE.Mesh(roofGeo, roofMat);
      roof.position.set(0, tiers * 1.2 + 3.5, 6);
      roof.rotation.x = -0.1;
      roof.castShadow = true;
      stand.add(roof);

      // Support pillars
      const pillarGeo = new THREE.CylinderGeometry(0.3, 0.3, tiers * 1.2 + 3.5);
      const p1 = new THREE.Mesh(pillarGeo, grandstandMat);
      p1.position.set(-11, (tiers * 1.2 + 3.5) / 2, 13);
      const p2 = new THREE.Mesh(pillarGeo, grandstandMat);
      p2.position.set(11, (tiers * 1.2 + 3.5) / 2, 13);
      stand.add(p1);
      stand.add(p2);

      // Orient towards track
      stand.position.copy(frame.position).addScaledVector(frame.binormal, 25);
      stand.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), frame.binormal.clone().negate());
      this.sceneryGroup.add(stand);
    }
  }

  /**
   * Distance countdown marker boards (150m, 100m, 50m before braking zones).
   */
  private buildDistanceMarkers(): void {
    const boardMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f7, roughness: 0.3 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x333333 });

    // Turn 1 braking zone (around t ~ 0.13)
    const markerDistances = [
      { t: 0.125, text: '150' },
      { t: 0.130, text: '100' },
      { t: 0.135, text: '50' }
    ];

    for (const m of markerDistances) {
      const frame = this.trackData.getFrameAt(m.t);
      const boardGroup = new THREE.Group();

      const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.2);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.y = 1.1;
      boardGroup.add(post);

      const boardGeo = new THREE.BoxGeometry(1.6, 1.0, 0.1);
      const board = new THREE.Mesh(boardGeo, boardMat);
      board.position.y = 1.8;
      boardGroup.add(board);

      boardGroup.position.copy(frame.position).addScaledVector(frame.binormal, -(TrackData.TRACK_WIDTH / 2 + 3.5));
      boardGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), frame.tangent);
      this.sceneryGroup.add(boardGroup);
    }
  }

  /**
   * Floodlight towers distributed around the circuit for night racing.
   */
  private buildFloodlightTowers(): void {
    const towerMat = new THREE.MeshStandardMaterial({ color: 0x3a3f47, metalness: 0.7, roughness: 0.4 });
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffee, emissiveIntensity: 2.0 });

    const towerCount = 12;
    for (let i = 0; i < towerCount; i++) {
      const t = i / towerCount;
      const frame = this.trackData.getFrameAt(t);
      const towerGroup = new THREE.Group();

      const height = 18;
      const poleGeo = new THREE.CylinderGeometry(0.3, 0.6, height, 8);
      const pole = new THREE.Mesh(poleGeo, towerMat);
      pole.position.y = height / 2;
      pole.castShadow = true;
      towerGroup.add(pole);

      // Light head
      const headGeo = new THREE.BoxGeometry(3.5, 1.2, 0.8);
      const head = new THREE.Mesh(headGeo, lampMat);
      head.position.y = height;
      towerGroup.add(head);

      // SpotLight for night mode
      const spot = new THREE.SpotLight(0xffeedd, 0, 120, Math.PI / 4, 0.4, 1.2);
      spot.position.copy(frame.position).addScaledVector(frame.binormal, 22).add(new THREE.Vector3(0, height, 0));
      spot.target.position.copy(frame.position);
      spot.castShadow = false; // Disabled on many track lights for peak FPS, main lights use shadows

      towerGroup.position.copy(frame.position).addScaledVector(frame.binormal, 22);
      this.sceneryGroup.add(towerGroup);
      this.sceneryGroup.add(spot.target);
      this.sceneryGroup.add(spot);
      this.floodlights.push(spot);
    }
  }

  /**
   * Low-poly decorative trees along outer perimeter and infield.
   */
  private buildTrees(): void {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a3219, roughness: 0.9 });
    const foliageMat1 = new THREE.MeshStandardMaterial({ color: 0x23521b, roughness: 0.8, flatShading: true });
    const foliageMat2 = new THREE.MeshStandardMaterial({ color: 0x316927, roughness: 0.8, flatShading: true });

    const trunkGeo = new THREE.CylinderGeometry(0.3, 0.5, 3.5, 6);
    const foliageGeo = new THREE.ConeGeometry(2.5, 5.5, 6);

    const treeCount = 70;
    for (let i = 0; i < treeCount; i++) {
      const t = Math.random();
      const frame = this.trackData.getFrameAt(t);
      const side = Math.random() > 0.5 ? 1 : -1;
      const offset = 26 + Math.random() * 80;

      const tree = new THREE.Group();
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 1.75;
      trunk.castShadow = true;
      tree.add(trunk);

      const foliage = new THREE.Mesh(foliageGeo, Math.random() > 0.5 ? foliageMat1 : foliageMat2);
      foliage.position.y = 5.2;
      foliage.castShadow = true;
      tree.add(foliage);

      const scale = 0.8 + Math.random() * 0.7;
      tree.scale.set(scale, scale, scale);

      tree.position.copy(frame.position).addScaledVector(frame.binormal, side * offset);
      tree.position.y = frame.position.y;
      this.sceneryGroup.add(tree);
    }
  }

  public setNightMode(isNight: boolean): void {
    const intensity = isNight ? 120.0 : 0.0;
    for (const spot of this.floodlights) {
      spot.intensity = intensity;
    }
  }
}

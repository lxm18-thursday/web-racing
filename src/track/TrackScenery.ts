import * as THREE from 'three';
import { TrackData } from './TrackData';
import { TextureGenerator } from '../rendering/TextureGenerator';

/**
 * Procedural Track Scenery & Architectural Props.
 * Generates Start/Finish Gantry with countdown lights, Grandstands, Distance markers,
 * Sponsor billboards, Tire barrier stacks, Floodlight towers, and low-poly trees.
 */
export class TrackScenery {
  public sceneryGroup: THREE.Group = new THREE.Group();
  public floodlights: THREE.SpotLight[] = [];
  public gantryLights: THREE.Mesh[] = [];

  constructor(private trackData: TrackData) {
    this.buildGantry();
    this.buildGrandstands();
    this.buildDistanceMarkers();
    this.buildSponsorBillboards();
    this.buildTireBarriers();
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
   * Set Gantry countdown light stage (0: off, 1-5: progressive red, 6: all out / green).
   */
  public setStartLightStage(stage: number): void {
    for (let i = 0; i < this.gantryLights.length; i++) {
      const bulb = this.gantryLights[i];
      const mat = bulb.material as THREE.MeshStandardMaterial;
      if (stage >= 1 && stage <= 5) {
        if (i < stage) {
          mat.color.setHex(0xff0000);
          mat.emissive.setHex(0xff1111);
          mat.emissiveIntensity = 4.0;
        } else {
          mat.color.setHex(0x220505);
          mat.emissive.setHex(0x110000);
          mat.emissiveIntensity = 0.1;
        }
      } else if (stage === 6) {
        // LIGHTS OUT: all go dark or green launch flash
        mat.color.setHex(0x00ff44);
        mat.emissive.setHex(0x00ff44);
        mat.emissiveIntensity = 4.0;
      } else {
        // All off / dark
        mat.color.setHex(0x220505);
        mat.emissive.setHex(0x110000);
        mat.emissiveIntensity = 0.1;
      }
    }
  }

  /**
   * Distance countdown marker boards (150m, 100m, 50m before braking zones).
   */
  private buildDistanceMarkers(): void {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8, roughness: 0.3 });
    const backMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5 });

    const brakingZones = [
      // Turn 1
      { t: 0.122, text: '150' },
      { t: 0.128, text: '100' },
      { t: 0.134, text: '50' },
      // Hairpin
      { t: 0.428, text: '150' },
      { t: 0.434, text: '100' },
      { t: 0.440, text: '50' },
      // Final Chicane
      { t: 0.865, text: '150' },
      { t: 0.872, text: '100' },
      { t: 0.879, text: '50' },
    ];

    for (const m of brakingZones) {
      const frame = this.trackData.getFrameAt(m.t);
      const boardGroup = new THREE.Group();

      const postGeo = new THREE.CylinderGeometry(0.08, 0.08, 2.4);
      const post = new THREE.Mesh(postGeo, postMat);
      post.position.y = 1.2;
      boardGroup.add(post);

      const markerTex = TextureGenerator.createDistanceMarkerTexture(m.text);
      const frontMat = new THREE.MeshStandardMaterial({
        map: markerTex,
        roughness: 0.3,
        metalness: 0.1,
      });

      const materials = [
        backMat, backMat, backMat, backMat,
        frontMat, // Front face (Z+)
        backMat   // Back face (Z-)
      ];

      const boardGeo = new THREE.BoxGeometry(1.5, 1.5, 0.08);
      const board = new THREE.Mesh(boardGeo, materials);
      board.position.y = 1.9;
      boardGroup.add(board);

      boardGroup.position.copy(frame.position).addScaledVector(frame.binormal, -(TrackData.TRACK_WIDTH / 2 + 3.5));
      boardGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), frame.tangent);
      this.sceneryGroup.add(boardGroup);
    }
  }

  /**
   * Trackside Sponsor Advertising Billboards mounted along Armco barriers.
   */
  private buildSponsorBillboards(): void {
    const postMat = new THREE.MeshStandardMaterial({ color: 0x22262e, metalness: 0.8, roughness: 0.4 });
    const backMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.6 });

    const billboardTValues = [
      0.02, 0.04, 0.06, 0.08, 0.10, 0.15, 0.22, 0.28, 0.35, 0.41,
      0.47, 0.52, 0.58, 0.64, 0.70, 0.76, 0.82, 0.88, 0.92, 0.95, 0.98
    ];

    for (let i = 0; i < billboardTValues.length; i++) {
      const t = billboardTValues[i];
      const frame = this.trackData.getFrameAt(t);
      const side = i % 2 === 0 ? 1 : -1;
      const group = new THREE.Group();

      const bannerTex = TextureGenerator.createSponsorBannerTexture(i);
      const bannerMat = new THREE.MeshStandardMaterial({
        map: bannerTex,
        roughness: 0.25,
        metalness: 0.2,
      });

      const boardGeo = new THREE.BoxGeometry(7.0, 1.8, 0.12);
      const materials = [
        backMat, backMat, backMat, backMat,
        bannerMat,
        backMat
      ];
      const board = new THREE.Mesh(boardGeo, materials);
      board.position.y = 1.6;
      board.castShadow = true;
      group.add(board);

      const legGeo = new THREE.BoxGeometry(0.18, 2.2, 0.18);
      const legL = new THREE.Mesh(legGeo, postMat);
      legL.position.set(-2.8, 1.1, 0);
      group.add(legL);

      const legR = new THREE.Mesh(legGeo, postMat);
      legR.position.set(2.8, 1.1, 0);
      group.add(legR);

      const offsetDist = side * (TrackData.TRACK_WIDTH / 2 + 3.8);
      group.position.copy(frame.position).addScaledVector(frame.binormal, offsetDist);
      group.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 0, 1),
        side === 1 ? frame.binormal.clone().negate() : frame.binormal
      );
      this.sceneryGroup.add(group);
    }
  }

  /**
   * Procedural Tire Barrier Stacks (Red & White) placed at corner run-off zones.
   */
  private buildTireBarriers(): void {
    const tireTex = TextureGenerator.createTireBarrierTexture();
    const barrierMat = new THREE.MeshStandardMaterial({
      map: tireTex,
      roughness: 0.85,
      metalness: 0.1,
    });

    const hairpinCorners = [0.155, 0.165, 0.455, 0.465, 0.735, 0.745, 0.885, 0.895];
    const tireStackGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.4, 16);

    for (const t of hairpinCorners) {
      const frame = this.trackData.getFrameAt(t);
      const outerOffset = TrackData.TRACK_WIDTH / 2 + 5.0;
      for (let s = -3; s <= 3; s++) {
        const stack = new THREE.Mesh(tireStackGeo, barrierMat);
        const stackPos = frame.position.clone()
          .addScaledVector(frame.binormal, outerOffset)
          .addScaledVector(frame.tangent, s * 1.5);
        stackPos.y += 0.7;
        stack.position.copy(stackPos);
        stack.castShadow = true;
        this.sceneryGroup.add(stack);
      }
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

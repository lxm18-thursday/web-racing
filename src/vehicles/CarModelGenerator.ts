import * as THREE from 'three';
import { CarVisualConfig } from './VehicleTypes';
import { TextureGenerator } from '../rendering/TextureGenerator';

export interface CarModelInstance {
  rootGroup: THREE.Group;
  chassisMesh: THREE.Group;
  wheelGroups: THREE.Group[];       // [FL, FR, RL, RR]
  wheelHubs: THREE.Group[];         // Inner rotation groups for axle spin
  steeringWheel: THREE.Mesh | null; // Cockpit steering wheel
  brakeLights: THREE.Mesh[];
  headlights: THREE.SpotLight[];
  exhaustPipes: THREE.Vector3[];
  setBrakeState: (isBraking: boolean) => void;
  setReverseState: (isReversing: boolean) => void;
}

/**
 * Procedural 3D Racing Car Model Generator.
 * Constructs sleek GT3/Hypercar composite geometry, PBR materials, carbon fiber aero,
 * 4 detailed rotating & steering wheels, brake calipers, interior steering wheel,
 * and dynamic light emitters without any external 3D files.
 */
export class CarModelGenerator {
  public static createCar(config: CarVisualConfig): CarModelInstance {
    const root = new THREE.Group();
    const chassis = new THREE.Group();
    root.add(chassis);

    // Common PBR Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: config.bodyColor,
      metalness: 0.85,
      roughness: 0.18,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: config.accentColor,
      metalness: 0.7,
      roughness: 0.25,
    });

    const carbonTex = TextureGenerator.createCarbonFiberTexture();
    const carbonMat = new THREE.MeshStandardMaterial({
      map: carbonTex,
      metalness: 0.4,
      roughness: 0.4,
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0x112233,
      metalness: 0.1,
      roughness: 0.05,
      transmission: 0.92,
      transparent: true,
      opacity: 0.35,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      metalness: 0.95,
      roughness: 0.1,
    });

    // --- 1. Main Aerodynamic Chassis Body ---
    // Lower body base
    const lowerBodyGeo = new THREE.BoxGeometry(1.85, 0.45, 4.3);
    const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyMat);
    lowerBody.position.set(0, 0.35, 0);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    chassis.add(lowerBody);

    // Front sloping hood / nose cone
    const hoodGeo = new THREE.BoxGeometry(1.7, 0.28, 1.4);
    const hood = new THREE.Mesh(hoodGeo, bodyMat);
    hood.position.set(0, 0.42, 1.4);
    hood.rotation.x = -0.12; // Sloping downwards
    hood.castShadow = true;
    chassis.add(hood);

    // Side air pods / side skirts
    const podGeo = new THREE.BoxGeometry(0.25, 0.35, 2.2);
    const podL = new THREE.Mesh(podGeo, accentMat);
    podL.position.set(-0.95, 0.32, -0.2);
    podL.castShadow = true;
    chassis.add(podL);

    const podR = new THREE.Mesh(podGeo, accentMat);
    podR.position.set(0.95, 0.32, -0.2);
    podR.castShadow = true;
    chassis.add(podR);

    // --- 2. Cockpit Canopy & Dashboard ---
    const dashGeo = new THREE.BoxGeometry(1.2, 0.22, 0.45);
    const dash = new THREE.Mesh(dashGeo, carbonMat);
    dash.position.set(0, 0.58, 0.35);
    dash.castShadow = true;
    chassis.add(dash);

    const cabinGeo = new THREE.BoxGeometry(1.3, 0.52, 1.8);
    const cabin = new THREE.Mesh(cabinGeo, glassMat);
    cabin.position.set(0, 0.72, -0.2);
    cabin.castShadow = true;
    chassis.add(cabin);

    // Roof scoop intake
    const scoopGeo = new THREE.BoxGeometry(0.35, 0.18, 0.8);
    const scoop = new THREE.Mesh(scoopGeo, carbonMat);
    scoop.position.set(0, 1.04, -0.1);
    scoop.castShadow = true;
    chassis.add(scoop);

    // --- 3. Front Splitter & Canards (Carbon Fiber) ---
    const splitterGeo = new THREE.BoxGeometry(1.95, 0.06, 0.8);
    const splitter = new THREE.Mesh(splitterGeo, carbonMat);
    splitter.position.set(0, 0.15, 2.15);
    splitter.castShadow = true;
    chassis.add(splitter);

    // --- 4. Massive Rear GT Wing & Diffuser ---
    // Wing blade
    const wingGeo = new THREE.BoxGeometry(2.1, 0.06, 0.45);
    const wing = new THREE.Mesh(wingGeo, carbonMat);
    wing.position.set(0, 1.15, -2.05);
    wing.rotation.x = 0.08; // Downforce angle of attack
    wing.castShadow = true;
    chassis.add(wing);

    // Wing endplates
    const endplateGeo = new THREE.BoxGeometry(0.04, 0.35, 0.55);
    const endplateL = new THREE.Mesh(endplateGeo, carbonMat);
    endplateL.position.set(-1.05, 1.15, -2.05);
    chassis.add(endplateL);

    const endplateR = new THREE.Mesh(endplateGeo, carbonMat);
    endplateR.position.set(1.05, 1.15, -2.05);
    chassis.add(endplateR);

    // Swan-neck upright mounts
    const mountGeo = new THREE.BoxGeometry(0.06, 0.55, 0.25);
    const mountL = new THREE.Mesh(mountGeo, carbonMat);
    mountL.position.set(-0.45, 0.85, -1.95);
    chassis.add(mountL);

    const mountR = new THREE.Mesh(mountGeo, carbonMat);
    mountR.position.set(0.45, 0.85, -1.95);
    chassis.add(mountR);

    // Rear Diffuser
    const diffuserGeo = new THREE.BoxGeometry(1.7, 0.2, 0.6);
    const diffuser = new THREE.Mesh(diffuserGeo, carbonMat);
    diffuser.position.set(0, 0.22, -2.05);
    diffuser.rotation.x = -0.25;
    chassis.add(diffuser);

    // Exhaust pipes (dual chrome tips)
    const exhaustGeo = new THREE.CylinderGeometry(0.065, 0.065, 0.2, 16);
    const exhaustL = new THREE.Mesh(exhaustGeo, chromeMat);
    exhaustL.rotation.x = Math.PI / 2;
    exhaustL.position.set(-0.16, 0.32, -2.18);
    chassis.add(exhaustL);

    const exhaustR = new THREE.Mesh(exhaustGeo, chromeMat);
    exhaustR.rotation.x = Math.PI / 2;
    exhaustR.position.set(0.16, 0.32, -2.18);
    chassis.add(exhaustR);

    const exhaustPipes = [
      new THREE.Vector3(-0.16, 0.32, -2.25),
      new THREE.Vector3(0.16, 0.32, -2.25),
    ];

    // --- 5. Cockpit Interior & Steering Wheel ---
    let steeringWheelMesh: THREE.Mesh | null = null;
    const wheelRimGeo = new THREE.TorusGeometry(0.18, 0.025, 8, 24);
    const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0x222225, roughness: 0.6 });
    steeringWheelMesh = new THREE.Mesh(wheelRimGeo, wheelRimMat);
    steeringWheelMesh.position.set(-0.32, 0.72, 0.15); // Left-hand drive cockpit position
    steeringWheelMesh.rotation.x = 0.35;
    chassis.add(steeringWheelMesh);

    // --- 6. Dynamic Headlights & Taillights ---
    const brakeLights: THREE.Mesh[] = [];
    const headlights: THREE.SpotLight[] = [];

    // Front Headlight Lenses
    const headLensGeo = new THREE.BoxGeometry(0.3, 0.1, 0.1);
    const headLensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xeeffff,
      emissiveIntensity: 1.5,
      roughness: 0.1,
    });
    const headLLens = new THREE.Mesh(headLensGeo, headLensMat);
    headLLens.position.set(-0.65, 0.45, 2.05);
    chassis.add(headLLens);

    const headRLens = new THREE.Mesh(headLensGeo, headLensMat);
    headRLens.position.set(0.65, 0.45, 2.05);
    chassis.add(headRLens);

    // SpotLights for illumination
    const spotL = new THREE.SpotLight(0xffffff, 80, 90, Math.PI / 6, 0.3, 1.5);
    spotL.position.set(-0.65, 0.45, 2.1);
    const spotTargetL = new THREE.Object3D();
    spotTargetL.position.set(-0.65, 0.2, 30);
    chassis.add(spotL);
    chassis.add(spotTargetL);
    spotL.target = spotTargetL;
    headlights.push(spotL);

    const spotR = new THREE.SpotLight(0xffffff, 80, 90, Math.PI / 6, 0.3, 1.5);
    spotR.position.set(0.65, 0.45, 2.1);
    const spotTargetR = new THREE.Object3D();
    spotTargetR.position.set(0.65, 0.2, 30);
    chassis.add(spotR);
    chassis.add(spotTargetR);
    spotR.target = spotTargetR;
    headlights.push(spotR);

    // Rear Taillight / Brake Light Bar
    const brakeBarGeo = new THREE.BoxGeometry(0.6, 0.08, 0.06);
    const brakeMatL = new THREE.MeshStandardMaterial({
      color: 0xaa1111,
      emissive: 0x550000,
      emissiveIntensity: 0.4,
      roughness: 0.2,
    });
    const brakeMatR = new THREE.MeshStandardMaterial({
      color: 0xaa1111,
      emissive: 0x550000,
      emissiveIntensity: 0.4,
      roughness: 0.2,
    });

    const brakeL = new THREE.Mesh(brakeBarGeo, brakeMatL);
    brakeL.position.set(-0.55, 0.52, -2.15);
    chassis.add(brakeL);
    brakeLights.push(brakeL);

    const brakeR = new THREE.Mesh(brakeBarGeo, brakeMatR);
    brakeR.position.set(0.55, 0.52, -2.15);
    chassis.add(brakeR);
    brakeLights.push(brakeR);

    // --- 7. Wheels & Assemblies ---
    // [FL, FR, RL, RR]
    const wheelPositions = [
      new THREE.Vector3(-0.92, 0.35, 1.35),  // FL
      new THREE.Vector3(0.92, 0.35, 1.35),   // FR
      new THREE.Vector3(-0.95, 0.36, -1.35), // RL
      new THREE.Vector3(0.95, 0.36, -1.35),  // RR
    ];

    const wheelGroups: THREE.Group[] = [];
    const wheelHubs: THREE.Group[] = [];

    const tireTex = TextureGenerator.createTireTreadTexture();
    const tireMat = new THREE.MeshStandardMaterial({
      map: tireTex,
      roughness: 0.8,
      metalness: 0.1,
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: config.rimColor ?? 0x1f2228,
      metalness: 0.9,
      roughness: 0.2,
    });

    const discTex = TextureGenerator.createBrakeDiscTexture();
    const discMat = new THREE.MeshStandardMaterial({
      map: discTex,
      metalness: 0.85,
      roughness: 0.3,
    });

    const caliperMat = new THREE.MeshStandardMaterial({
      color: config.caliperColor ?? 0xffcc00, // Brembo racing yellow
      roughness: 0.3,
      metalness: 0.4,
    });

    for (let i = 0; i < 4; i++) {
      const isLeft = i === 0 || i === 2;
      const isFront = i < 2;

      // Outer group handles steering (Y rotation)
      const steerGroup = new THREE.Group();
      steerGroup.position.copy(wheelPositions[i]);
      root.add(steerGroup);
      wheelGroups.push(steerGroup);

      // Inner hub group handles axle spin (X rotation)
      const hubGroup = new THREE.Group();
      steerGroup.add(hubGroup);
      wheelHubs.push(hubGroup);

      // Tire cylinder
      const tireRadius = 0.35;
      const tireWidth = isFront ? 0.28 : 0.32;
      const tireGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, tireWidth, 24);
      const tireMesh = new THREE.Mesh(tireGeo, tireMat);
      tireMesh.rotation.z = Math.PI / 2;
      tireMesh.castShadow = true;
      hubGroup.add(tireMesh);

      // Alloy Rim Face
      const rimGeo = new THREE.CylinderGeometry(tireRadius * 0.72, tireRadius * 0.72, tireWidth + 0.01, 16);
      const rimMesh = new THREE.Mesh(rimGeo, rimMat);
      rimMesh.rotation.z = Math.PI / 2;
      hubGroup.add(rimMesh);

      // Brake Rotor Disc (mounted to hub)
      const discGeo = new THREE.CylinderGeometry(tireRadius * 0.62, tireRadius * 0.62, 0.03, 16);
      const discMesh = new THREE.Mesh(discGeo, discMat);
      discMesh.rotation.z = Math.PI / 2;
      discMesh.position.x = isLeft ? 0.04 : -0.04;
      hubGroup.add(discMesh);

      // Brake Caliper (static relative to steering, doesn't spin with axle)
      const caliperGeo = new THREE.BoxGeometry(0.06, 0.12, 0.18);
      const caliperMesh = new THREE.Mesh(caliperGeo, caliperMat);
      caliperMesh.position.set(isLeft ? 0.06 : -0.06, 0.16, 0);
      steerGroup.add(caliperMesh);
    }

    // Callbacks for dynamic state
    const setBrakeState = (isBraking: boolean): void => {
      for (const light of brakeLights) {
        const mat = light.material as THREE.MeshStandardMaterial;
        if (isBraking) {
          mat.emissive.setHex(0xff0000);
          mat.emissiveIntensity = 3.5;
        } else {
          mat.emissive.setHex(0x550000);
          mat.emissiveIntensity = 0.4;
        }
      }
    };

    const setReverseState = (isReversing: boolean): void => {
      // Reverse indicator can modulate rear lights or white accents
    };

    return {
      rootGroup: root,
      chassisMesh: chassis,
      wheelGroups,
      wheelHubs,
      steeringWheel: steeringWheelMesh,
      brakeLights,
      headlights,
      exhaustPipes,
      setBrakeState,
      setReverseState,
    };
  }
}

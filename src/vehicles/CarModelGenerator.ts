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
  brakeDiscs: THREE.Mesh[];         // 4 Brake rotor meshes for heat glow
  headlights: THREE.SpotLight[];
  exhaustPipes: THREE.Vector3[];
  setBrakeState: (isBraking: boolean) => void;
  setReverseState: (isReversing: boolean) => void;
  updateBrakeHeat: (brakePressure: number, speedKmh: number, dt: number) => void;
  setDrsState: (open: boolean) => void;
  updateCockpitDash: (gear: number, speedKmh: number, rpm: number) => void;
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

    // Common PBR Materials & Procedural Livery
    const liveryTex = TextureGenerator.createCarLiveryTexture(
      config.bodyColor,
      config.accentColor,
      config.raceNumber || '01'
    );

    const bodyMat = new THREE.MeshStandardMaterial({
      color: config.bodyColor,
      map: liveryTex,
      metalness: 0.85,
      roughness: 0.20,
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
    const wheelRimGeo = new THREE.TorusGeometry(0.15, 0.022, 8, 24);
    const wheelRimMat = new THREE.MeshStandardMaterial({ color: 0x1f1f22, roughness: 0.6 });
    steeringWheelMesh = new THREE.Mesh(wheelRimGeo, wheelRimMat);
    steeringWheelMesh.position.set(-0.32, 0.67, 0.25); // GT3 cockpit column position
    steeringWheelMesh.rotation.x = -0.25;
    chassis.add(steeringWheelMesh);

    // Center hub & OLED dash screen
    const hubCapGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.02, 16);
    const hubCap = new THREE.Mesh(hubCapGeo, carbonMat);
    hubCap.rotation.x = Math.PI / 2;
    steeringWheelMesh.add(hubCap);

    const dashCanvas = document.createElement('canvas');
    dashCanvas.width = 128;
    dashCanvas.height = 64;
    const dashCtx = dashCanvas.getContext('2d')!;
    const dashTex = new THREE.CanvasTexture(dashCanvas);
    const dashScreenMat = new THREE.MeshBasicMaterial({ map: dashTex, side: THREE.DoubleSide });
    const dashScreenGeo = new THREE.PlaneGeometry(0.10, 0.05);
    const dashScreenMesh = new THREE.Mesh(dashScreenGeo, dashScreenMat);
    dashScreenMesh.position.set(0, 0, -0.015);
    dashScreenMesh.rotation.y = Math.PI;
    dashScreenMesh.scale.x = -1;
    steeringWheelMesh.add(dashScreenMesh);

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
    const caliperMat = new THREE.MeshStandardMaterial({
      color: config.caliperColor ?? 0xffcc00, // Brembo racing yellow
      roughness: 0.3,
      metalness: 0.4,
    });

    const brakeDiscs: THREE.Mesh[] = [];

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

      // Brake Rotor Disc (mounted to hub with independent material for heat glow)
      const discGeo = new THREE.CylinderGeometry(tireRadius * 0.62, tireRadius * 0.62, 0.03, 16);
      const wheelDiscMat = new THREE.MeshStandardMaterial({
        map: discTex,
        metalness: 0.85,
        roughness: 0.3,
        emissive: new THREE.Color(0x000000),
        emissiveIntensity: 0,
      });
      const discMesh = new THREE.Mesh(discGeo, wheelDiscMat);
      discMesh.rotation.z = Math.PI / 2;
      discMesh.position.x = isLeft ? 0.04 : -0.04;
      hubGroup.add(discMesh);
      brakeDiscs.push(discMesh);

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

    // Realistic brake rotor heating & cooling simulation
    let brakeTemp = 25; // ambient temperature in °C
    const updateBrakeHeat = (brakePressure: number, speedKmh: number, dt: number): void => {
      if (brakePressure > 0.05 && speedKmh > 8) {
        brakeTemp += brakePressure * (speedKmh / 200) * dt * 550;
      }
      const coolRate = 0.5 + (speedKmh / 160) * 0.9;
      brakeTemp = Math.max(25, brakeTemp - (brakeTemp - 25) * dt * coolRate * 0.28);
      brakeTemp = Math.min(1100, brakeTemp);

      // When brakeTemp > 240°C, the rotors visibly glow red-hot to fiery orange
      if (brakeTemp > 240) {
        const factor = Math.min(1.0, (brakeTemp - 240) / 600);
        const r = Math.min(1.0, factor * 1.5);
        const g = Math.max(0, (factor - 0.25) * 0.65);
        const b = Math.max(0, (factor - 0.65) * 0.35);
        for (const disc of brakeDiscs) {
          const mat = disc.material as THREE.MeshStandardMaterial;
          mat.emissive.setRGB(r, g, b);
          mat.emissiveIntensity = factor * 3.8;
        }
      } else {
        for (const disc of brakeDiscs) {
          const mat = disc.material as THREE.MeshStandardMaterial;
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0;
        }
      }
    };

    const setDrsState = (open: boolean): void => {
      wing.rotation.x = open ? -0.04 : 0.08;
    };

    const updateCockpitDash = (gear: number, speedKmh: number, rpm: number): void => {
      dashCtx.fillStyle = '#060913';
      dashCtx.fillRect(0, 0, 128, 64);

      // Top multi-color LED RPM bar
      const maxRpm = 8500;
      const rpmRatio = Math.min(1.0, Math.max(0, rpm / maxRpm));
      const barWidth = Math.floor(rpmRatio * 120);
      dashCtx.fillStyle = rpm > 7800 ? '#ff1111' : (rpm > 6500 ? '#ffaa00' : '#00e5ff');
      dashCtx.fillRect(4, 4, barWidth, 6);

      // Large Gear Indicator
      dashCtx.fillStyle = '#ffcc00';
      dashCtx.font = '900 36px "Consolas", monospace';
      dashCtx.textAlign = 'center';
      dashCtx.textBaseline = 'middle';
      const gearText = gear === -1 ? 'R' : (gear === 0 ? 'N' : gear.toString());
      dashCtx.fillText(gearText, 40, 38);

      // Digital Speed km/h
      dashCtx.fillStyle = '#ffffff';
      dashCtx.font = '700 16px "Consolas", monospace';
      dashCtx.textAlign = 'right';
      dashCtx.fillText(`${Math.round(speedKmh)}`, 122, 32);

      dashCtx.fillStyle = '#64748b';
      dashCtx.font = '600 10px sans-serif';
      dashCtx.fillText('KM/H', 122, 48);

      dashTex.needsUpdate = true;
    };

    return {
      rootGroup: root,
      chassisMesh: chassis,
      wheelGroups,
      wheelHubs,
      steeringWheel: steeringWheelMesh,
      brakeLights,
      brakeDiscs,
      headlights,
      exhaustPipes,
      setBrakeState,
      setReverseState,
      updateBrakeHeat,
      setDrsState,
      updateCockpitDash,
    };
  }
}

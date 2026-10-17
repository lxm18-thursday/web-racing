import * as THREE from 'three';
import { SceneManager } from './rendering/SceneManager';
import { SkyboxGenerator } from './rendering/SkyboxGenerator';
import { LightingManager } from './rendering/LightingManager';
import { CameraController } from './rendering/CameraController';
import { ParticleManager } from './rendering/ParticleManager';
import { TrackData } from './track/TrackData';
import { TrackMeshGenerator } from './track/TrackMeshGenerator';
import { TrackScenery } from './track/TrackScenery';
import { TrackWaypoints } from './track/TrackWaypoints';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { TrackPhysics } from './physics/TrackPhysics';
import { CarModelGenerator } from './vehicles/CarModelGenerator';
import { RaycastVehiclePhysics } from './vehicles/RaycastVehiclePhysics';
import { VehicleController } from './vehicles/VehicleController';
import { AISystem } from './vehicles/AISystem';
import { InputManager } from './vehicles/InputManager';
import { SoundEngine } from './audio/SoundEngine';
import { HUD } from './ui/HUD';
import { SkidMarkManager } from './rendering/SkidMarkManager';

/**
 * Main Game Application Bootstrap and High-Performance Render Loop.
 */
class GameApp {
  private sceneManager: SceneManager;
  private skybox: SkyboxGenerator;
  private trackData: TrackData;
  private waypoints: TrackWaypoints;
  private trackMeshGen: TrackMeshGenerator;
  private trackScenery: TrackScenery;
  private physicsWorld: PhysicsWorld;
  private trackPhysics: TrackPhysics;
  private lighting: LightingManager;
  private soundEngine: SoundEngine;
  private particleManager: ParticleManager;
  private skidMarkManager: SkidMarkManager;
  private cameraController: CameraController;
  private inputManager: InputManager;
  private playerVehicle: VehicleController;
  private aiSystem: AISystem;
  private hud: HUD;

  private clock: THREE.Clock;
  private isStarted: boolean = false;

  constructor() {
    this.clock = new THREE.Clock();

    // 1. Rendering Context
    this.sceneManager = new SceneManager();
    this.skybox = new SkyboxGenerator(this.sceneManager.scene);
    this.cameraController = new CameraController(this.sceneManager.getAspectRatio());
    this.particleManager = new ParticleManager(this.sceneManager.scene);

    // 2. Track & Environment
    this.trackData = new TrackData();
    this.waypoints = new TrackWaypoints(this.trackData, 500);
    this.trackMeshGen = new TrackMeshGenerator(this.trackData);
    this.sceneManager.scene.add(this.trackMeshGen.trackGroup);

    this.trackScenery = new TrackScenery(this.trackData);
    this.sceneManager.scene.add(this.trackScenery.sceneryGroup);

    // 3. Lighting & Shadows
    this.lighting = new LightingManager(this.sceneManager.scene, this.skybox, this.trackScenery);

    // 4. Physics World
    this.physicsWorld = new PhysicsWorld();
    this.trackPhysics = new TrackPhysics(this.physicsWorld, this.trackData, this.trackMeshGen);

    // 5. Audio Synthesizer
    this.soundEngine = new SoundEngine();

    // 6. Player Vehicle
    const playerModel = CarModelGenerator.createCar({
      bodyColor: 0x00c4cc,   // Gulf Cyber Cyan
      accentColor: 0xff6600, // Vibrant Orange
      rimColor: 0x181a1f,
      caliperColor: 0xffdd00,
      raceNumber: '01',
    });
    this.sceneManager.scene.add(playerModel.rootGroup);

    const playerPhysics = new RaycastVehiclePhysics(this.physicsWorld, {
      mass: 1320,
      suspensionStiffness: 35,
      dampingRelaxation: 2.6,
      dampingCompression: 4.4,
      frictionSlipFront: 8.5,
      frictionSlipRear: 9.0,
      rollInfluence: 0.0,
      downforceFactor: 1.85,
      dragFactor: 0.38,
    });

    this.skidMarkManager = new SkidMarkManager(this.sceneManager.scene);

    this.playerVehicle = new VehicleController(
      playerPhysics,
      playerModel,
      this.soundEngine,
      this.waypoints,
      this.particleManager,
      this.skidMarkManager
    );

    // Spawn Player on Pole Position (Start Line, P1 Left Slot)
    const startWp = this.waypoints.getWaypoint(0);
    this.playerVehicle.physics.resetTo(
      startWp.position.clone().addScaledVector(startWp.binormal, -2.2).add(new THREE.Vector3(0, 0.4, 0)),
      startWp.tangent
    );

    // 7. AI Opponents
    this.aiSystem = new AISystem(this.sceneManager.scene, this.physicsWorld, this.waypoints);

    // 8. Inputs & HUD
    this.inputManager = new InputManager();
    this.hud = new HUD(this.waypoints);

    // Connect HUD callbacks
    this.hud.onStartClicked = () => {
      this.isStarted = true;
      this.playerVehicle.currentLapTime = 0;
      this.soundEngine.resume();
    };

    this.hud.onCountdownStage = (stage: number) => {
      this.soundEngine.resume();
      this.trackScenery.setStartLightStage(stage);
      if (stage >= 1 && stage <= 5) {
        this.soundEngine.playCountdownBeep(false);
      } else if (stage === 6) {
        this.soundEngine.playCountdownBeep(true);
      }
    };

    this.hud.onCameraClicked = () => {
      this.cameraController.cycleMode();
    };

    this.hud.onWeatherClicked = () => {
      this.lighting.cycleMode();
    };

    this.hud.onResetClicked = () => {
      const nearestWp = this.waypoints.getWaypoint(this.playerVehicle.closestWaypointIdx);
      this.playerVehicle.physics.resetTo(nearestWp.position, nearestWp.tangent);
      this.skidMarkManager.reset();
    };

    this.hud.onAudioClicked = () => {
      this.soundEngine.toggleMute();
    };

    this.hud.onModeClicked = () => {
      this.playerVehicle.isAuto = !this.playerVehicle.isAuto;
    };

    // Responsive camera aspect ratio
    window.addEventListener('resize', () => {
      this.cameraController.updateAspect(this.sceneManager.getAspectRatio());
    });

    // Expose app on window for test diagnostics
    (window as unknown as { __app: unknown }).__app = this;

    // Start Main Loop
    this.animate();
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);

    try {
      const rawDt = this.clock.getDelta();
      // Clamp dt to strictly positive finite range (prevents division by zero on frame 0)
      const dt = Math.max(0.001, Math.min(isFinite(rawDt) ? rawDt : 0.016, 0.05));

      // Sample User Inputs
      const input = this.inputManager.sample(dt);

      // Hold vehicle stationary in starting box before green flag while allowing throttle revving
      if (!this.isStarted) {
        input.brake = 1.0;
        input.handbrake = true;
      }

      // Quick single-press actions
      if (this.inputManager.checkCameraToggle()) {
        this.cameraController.cycleMode();
      }
      if (this.inputManager.checkWeatherToggle()) {
        this.lighting.cycleMode();
      }
      if (this.inputManager.checkAudioToggle()) {
        this.soundEngine.toggleMute();
      }

      // Step Physics World
      this.physicsWorld.step(dt);

      // Update Player Vehicle
      this.playerVehicle.update(dt, input);
      if (!this.isStarted) {
        this.playerVehicle.currentLapTime = 0;
      }

      // Update AI Opponents
      const pp = this.playerVehicle.physics.chassisBody.position;
      const playerPos = new THREE.Vector3(pp.x, pp.y, pp.z);
      this.aiSystem.update(dt, playerPos, this.isStarted);

      // Emit Tire Smoke on drifting / burnouts
      const telemetry = this.playerVehicle.getTelemetry();
      if (telemetry.slipRatio > 0.35 && telemetry.speedKmh > 20) {
        // Rear wheels smoke
        const rl = this.playerVehicle.model.wheelGroups[2].position;
        const rr = this.playerVehicle.model.wheelGroups[3].position;
        this.particleManager.emitTireSmoke(rl, telemetry.slipRatio);
        this.particleManager.emitTireSmoke(rr, telemetry.slipRatio);
      }

      const pq = this.playerVehicle.physics.chassisBody.quaternion;
      const playerQuat = new THREE.Quaternion(pq.x, pq.y, pq.z, pq.w);

      // Emit Boost Flame
      if (telemetry.isBoosting) {
        const pipes = this.playerVehicle.model.exhaustPipes;
        const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(playerQuat);
        for (const p of pipes) {
          const worldPos = p.clone().applyQuaternion(playerQuat).add(playerPos);
          this.particleManager.emitExhaustFlame(worldPos, forward, true);
        }
      }

      // Update Particles
      this.particleManager.update(dt, this.cameraController.camera);

      // Update Lighting & Shadow follow target
      this.lighting.updateFollowTarget(playerPos);

      // Update Camera
      this.cameraController.update(
        dt,
        playerPos,
        playerQuat,
        telemetry.speedKmh,
        telemetry.gForceLat,
        telemetry.onCurb
      );

      // Update Telemetry HUD
      this.hud.update(telemetry, this.aiSystem.aiCars);

      // Render 3D Scene with UnrealBloom and Speed Blur
      this.sceneManager.render(this.cameraController.camera, dt, telemetry.speedKmh);

      // End of frame cleanup
      this.inputManager.endFrame();
    } catch (err) {
      console.error('Frame loop error caught:', err);
    }
  };
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    new GameApp();
  });
} else {
  new GameApp();
}

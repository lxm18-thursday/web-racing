import * as CANNON from 'cannon-es';

/**
 * Cannon-es Physics World manager.
 * Configures gravity, SAP broadphase, contact materials, and fixed substepping.
 */
export class PhysicsWorld {
  public world: CANNON.World;

  public groundMaterial: CANNON.Material;
  public wheelMaterial: CANNON.Material;
  public chassisMaterial: CANNON.Material;
  public barrierMaterial: CANNON.Material;

  constructor() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.82, 0);

    // SAPBroadphase for high performance multi-body collision detection
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    (this.world.solver as CANNON.GSSolver).iterations = 12;
    this.world.defaultContactMaterial.friction = 0.5;
    this.world.defaultContactMaterial.restitution = 0.1;

    // Dedicated physical materials
    this.groundMaterial = new CANNON.Material('ground');
    this.wheelMaterial = new CANNON.Material('wheel');
    this.chassisMaterial = new CANNON.Material('chassis');
    this.barrierMaterial = new CANNON.Material('barrier');

    // Wheel to Ground contact material (high grip racing slick friction)
    const wheelGroundContact = new CANNON.ContactMaterial(this.wheelMaterial, this.groundMaterial, {
      friction: 1.6,
      restitution: 0.05,
      contactEquationStiffness: 1e7,
      contactEquationRelaxation: 3,
    });
    this.world.addContactMaterial(wheelGroundContact);

    // Chassis to Ground contact material (smooth skidplate, prevents snagging/flipping)
    const chassisGroundContact = new CANNON.ContactMaterial(this.chassisMaterial, this.groundMaterial, {
      friction: 0.05,
      restitution: 0.05,
    });
    this.world.addContactMaterial(chassisGroundContact);

    // Chassis to Barrier contact material (low friction slide, lively bounce preventing sticking)
    const chassisBarrierContact = new CANNON.ContactMaterial(this.chassisMaterial, this.barrierMaterial, {
      friction: 0.08,
      restitution: 0.35,
    });
    this.world.addContactMaterial(chassisBarrierContact);

    // Chassis to Chassis vehicle collision (realistic kinetic impact and rebound)
    const chassisChassisContact = new CANNON.ContactMaterial(this.chassisMaterial, this.chassisMaterial, {
      friction: 0.20,
      restitution: 0.40,
    });
    this.world.addContactMaterial(chassisChassisContact);

    // Wheel to Barrier
    const wheelBarrierContact = new CANNON.ContactMaterial(this.wheelMaterial, this.barrierMaterial, {
      friction: 0.20,
      restitution: 0.25,
    });
    this.world.addContactMaterial(wheelBarrierContact);
  }

  public step(dt: number): void {
    // Sub-stepping for maximum vehicle physics stability at high speeds
    const fixedTimeStep = 1 / 60;
    const maxSubSteps = 3;
    this.world.step(fixedTimeStep, Math.min(dt, 0.1), maxSubSteps);
  }
}

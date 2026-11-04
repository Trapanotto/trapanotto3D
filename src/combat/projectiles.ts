import * as THREE from 'three';
import type { WorldQuery } from '../core/world-query.ts';

export type ProjectileKind = 'shot' | 'heavy' | 'rocket';
export type Owner = 'player' | 'enemy';

export interface Projectile {
  kind: ProjectileKind;
  owner: Owner;
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  life: number;
}

export interface ProjectileHandlers {
  /** Returns true when the projectile hit something it collides with (player or enemy). */
  hitsTarget(projectile: Projectile): boolean;
  /** Called once when a projectile ends: on a target, a wall, or at the end of its life. */
  impact(projectile: Projectile, point: THREE.Vector3, hitWall: boolean): void;
}

const GEOMETRY: Record<ProjectileKind, THREE.BufferGeometry> = {
  shot: new THREE.SphereGeometry(0.15, 10, 8),
  heavy: new THREE.SphereGeometry(0.26, 12, 10),
  rocket: new THREE.SphereGeometry(0.18, 8, 6),
};

function material(kind: ProjectileKind): THREE.Material {
  if (kind === 'rocket')
    return new THREE.MeshStandardMaterial({ color: 0xe1a044, emissive: 0x843000 });
  // Bright and untonemapped so bloom makes incoming fire easy to read and dodge.
  return new THREE.MeshBasicMaterial({
    color: kind === 'heavy' ? 0xff6a2a : 0xffa04a,
    toneMapped: false,
  });
}

/** Moving projectiles with pooled meshes. Simulation and rendering are separate. */
export class ProjectileSystem {
  readonly active: Projectile[] = [];
  private readonly free: Record<ProjectileKind, THREE.Mesh[]> = { shot: [], heavy: [], rocket: [] };
  private readonly materials: Record<ProjectileKind, THREE.Material> = {
    shot: material('shot'),
    heavy: material('heavy'),
    rocket: material('rocket'),
  };
  private readonly parent: THREE.Object3D;
  private readonly world: WorldQuery;
  private readonly handlers: ProjectileHandlers;
  private readonly point = new THREE.Vector3();

  constructor(parent: THREE.Object3D, world: WorldQuery, handlers: ProjectileHandlers) {
    this.parent = parent;
    this.world = world;
    this.handlers = handlers;
  }

  spawn(
    kind: ProjectileKind,
    owner: Owner,
    origin: THREE.Vector3,
    velocity: THREE.Vector3,
    damage: number,
    life: number,
    scale = 1,
  ): void {
    const mesh = this.free[kind].pop() ?? new THREE.Mesh(GEOMETRY[kind], this.materials[kind]);
    mesh.scale.setScalar(scale);
    mesh.position.copy(origin);
    mesh.visible = true;
    this.parent.add(mesh);
    this.active.push({
      kind,
      owner,
      mesh,
      pos: origin.clone(),
      prev: origin.clone(),
      velocity: velocity.clone(),
      damage,
      life,
    });
  }

  tick(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.prev.copy(p.pos);
      p.life -= dt;
      p.pos.addScaledVector(p.velocity, dt);
      const wall = this.world.solidAt(p.pos.x, p.pos.y, p.pos.z, 0.12);
      if (!wall && p.life > 0 && !this.handlers.hitsTarget(p)) continue;
      // Wall hits explode at the last free position, not inside the wall.
      this.handlers.impact(p, this.point.copy(wall ? p.prev : p.pos), wall);
      this.release(i);
    }
  }

  render(alpha: number): void {
    for (const p of this.active) p.mesh.position.lerpVectors(p.prev, p.pos, alpha);
  }

  clear(): void {
    for (let i = this.active.length - 1; i >= 0; i--) this.release(i);
  }

  private release(index: number): void {
    const [p] = this.active.splice(index, 1);
    p.mesh.visible = false;
    this.parent.remove(p.mesh);
    this.free[p.kind].push(p.mesh);
  }
}

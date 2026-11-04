import * as THREE from 'three';
import {
  ROCKET_LIFETIME,
  ROCKET_SPEED,
  STARTING_AMMO,
  WEAPONS,
  WEAPON_ORDER,
} from '../config/weapons.ts';
import type { AmmoType, WeaponId } from '../config/weapons.ts';
import { LINES } from '../config/text.ts';
import type { SoundPlayer } from '../audio/audio.ts';
import type { WorldQuery } from '../core/world-query.ts';
import type { EnemySystem, Enemy } from '../ai/enemy-system.ts';
import type { ProjectileSystem } from '../combat/projectiles.ts';
import type { ParticlePool } from '../fx/particles.ts';
import type { TracerPool } from '../fx/tracers.ts';
import { VIEWMODEL, applyRevolverPlacement } from '../render/models.ts';
import type { Viewmodel } from '../render/models.ts';
import { eyePosition, viewDirection } from '../player/player.ts';
import type { PlayerState } from '../player/player.ts';

export const HEADSHOT_MULTIPLIER = 2;

/** Hit zones as [share of body height, share of radius, is head]. */
type Zone = readonly [number, number, boolean];
const HUMAN_ZONES: Zone[] = [
  [0.9, 0.42, true],
  [0.6, 1, false],
];
const DRONE_ZONES: Zone[] = [[0.62, 1, false]];

export interface WeaponDeps {
  player: PlayerState;
  world: WorldQuery;
  enemies: EnemySystem;
  projectiles: ProjectileSystem;
  particles: ParticlePool;
  tracers: TracerPool;
  sound: SoundPlayer;
  message(text: string): void;
  /** Builds the hand-held model; null without a renderer (tests). */
  createViewmodel(type: WeaponId): Viewmodel | null;
  camera: THREE.Object3D | null;
}

interface RayHit {
  enemy: Enemy;
  distance: number;
  headshot: boolean;
}

export class WeaponSystem {
  current: WeaponId = 'pistol';
  readonly inventory = new Set<WeaponId>(['fist', 'pistol']);
  ammo: Record<AmmoType, number> = { ...STARTING_AMMO };
  cooldown = 0;
  recoil = 0;
  muzzleTime = 0;
  viewmodel: Viewmodel | null = null;
  private readonly deps: WeaponDeps;
  private readonly eye = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly ray = new THREE.Ray();
  private readonly point = new THREE.Vector3();
  private readonly from = new THREE.Vector3();
  private readonly to = new THREE.Vector3();
  private readonly centre = new THREE.Vector3();
  private readonly toCentre = new THREE.Vector3();

  constructor(deps: WeaponDeps) {
    this.deps = deps;
  }

  get def() {
    return WEAPONS[this.current];
  }

  /** Rounds for the HUD; melee shows infinity. */
  get ammoCount(): number | '∞' {
    const type = this.def.ammo;
    return type ? this.ammo[type] : '∞';
  }

  reset(inventory: Iterable<WeaponId>, ammo: Partial<Record<AmmoType, number>>, weapon: WeaponId) {
    this.inventory.clear();
    for (const w of inventory) this.inventory.add(w);
    this.ammo = { ...STARTING_AMMO, ...ammo };
    this.cooldown = 0;
    this.recoil = 0;
    this.equip(weapon, true);
  }

  equip(type: WeaponId, force = false): void {
    if (!force && !this.inventory.has(type)) return;
    this.current = type;
    const camera = this.deps.camera;
    if (this.viewmodel && camera) camera.remove(this.viewmodel.root);
    this.viewmodel = this.deps.createViewmodel(type);
    if (this.viewmodel && camera) camera.add(this.viewmodel.root);
    this.recoil = 0;
  }

  cycle(direction: 1 | -1): void {
    const owned = WEAPON_ORDER.filter((w) => this.inventory.has(w));
    const index = owned.indexOf(this.current);
    this.equip(owned[(index + direction + owned.length) % owned.length]);
  }

  tick(dt: number, triggerHeld: boolean): void {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.recoil = Math.max(0, this.recoil - dt * 4.8);
    this.muzzleTime = Math.max(0, this.muzzleTime - dt);
    if (triggerHeld) this.fire();
  }

  fire(): void {
    if (this.cooldown > 0) return;
    const gun = this.def;
    if (gun.ammo && this.ammo[gun.ammo] <= 0) {
      this.cooldown = 0.2;
      this.deps.message(LINES.noAmmo);
      return;
    }
    if (gun.ammo) this.ammo[gun.ammo]--;
    this.cooldown = gun.delay;
    this.recoil = 1;
    this.muzzleTime = gun.muzzleFlash;
    this.viewmodel?.fireAction?.reset().play();
    this.deps.sound.play(this.current);
    const { player } = this.deps;
    if (gun.alertRadius) this.deps.enemies.alert(player.x, player.z, gun.alertRadius);

    const eye = eyePosition(player, 1, this.eye);
    const forward = viewDirection(player, this.forward);
    if (gun.pellets === 0) {
      const origin = this.point.copy(eye).addScaledVector(forward, 0.65);
      const velocity = this.direction.copy(forward).multiplyScalar(ROCKET_SPEED);
      this.deps.projectiles.spawn(
        'rocket',
        'player',
        origin,
        velocity,
        gun.damage,
        ROCKET_LIFETIME,
      );
      return;
    }
    for (let i = 0; i < gun.pellets; i++) this.hitscan(eye, forward, i === 0);
  }

  /** Places the hand-held weapon with bob and recoil. Called every rendered frame. */
  render(dt: number, moving: boolean, time: number): void {
    const view = this.viewmodel;
    if (!view) return;
    const bobX = moving ? Math.sin(time * 5) * 0.015 : 0;
    const bobY = moving ? Math.abs(Math.sin(time * 5)) * 0.012 : 0;
    const offset = this.current === 'pistol' ? VIEWMODEL.pistolOffset : VIEWMODEL.offset;
    view.root.position.set(
      offset.x + bobX,
      offset.y + bobY - this.recoil * 0.12,
      offset.z + this.recoil * 0.2,
    );
    view.root.rotation.set(this.recoil * 0.18, VIEWMODEL.yaw, 0);
    if (view.revolver) applyRevolverPlacement(view.revolver);
    view.mixer?.update(dt);
  }

  private hitscan(eye: THREE.Vector3, forward: THREE.Vector3, showTracer: boolean): void {
    const gun = this.def;
    const spread = gun.spread;
    const direction = this.direction
      .copy(forward)
      .add(
        this.point
          .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
          .multiplyScalar(spread),
      )
      .normalize();
    this.ray.set(eye, direction);
    const hit = this.findTarget(gun.range);
    let distance = gun.range;
    if (hit) {
      distance = hit.distance;
      const damage = gun.damage * (hit.headshot ? HEADSHOT_MULTIPLIER : 1);
      this.deps.enemies.damage(hit.enemy, damage, this.deps.player, hit.headshot);
    } else {
      // March the ray to find where it hits the level.
      for (let t = 0.5; t < gun.range; t += 0.3) {
        this.ray.at(t, this.point);
        if (!this.deps.world.solidAt(this.point.x, this.point.y, this.point.z)) continue;
        distance = Math.max(0.5, t - 0.3);
        if (showTracer)
          this.deps.particles.emit(this.point.x, this.point.y, this.point.z, 0xffbd79, 5);
        break;
      }
    }
    if (showTracer && this.current !== 'fist')
      this.deps.tracers.add(this.ray.at(0.8, this.from), this.ray.at(distance, this.to));
  }

  /** Nearest enemy hit by the current ray, checking a head sphere and a body sphere. */
  private findTarget(range: number): RayHit | null {
    const { world } = this.deps;
    const origin = this.ray.origin;
    let best: RayHit | null = null;
    for (const enemy of this.deps.enemies.enemies) {
      if (enemy.health <= 0) continue;
      const { height, radius, hover } = enemy.model;
      for (const [heightShare, radiusShare, head] of hover ? DRONE_ZONES : HUMAN_ZONES) {
        const zoneRadius = radius * radiusShare;
        this.centre.copy(enemy.pos).setY(enemy.pos.y + height * heightShare);
        const t = this.toCentre.subVectors(this.centre, origin).dot(this.ray.direction);
        if (t < 0 || t > (best?.distance ?? range)) continue;
        if (this.ray.distanceSqToPoint(this.centre) > zoneRadius * zoneRadius) continue;
        if (!world.canSee(origin.x, origin.z, this.centre.x, this.centre.z)) continue;
        best = { enemy, distance: t, headshot: head && this.current !== 'fist' };
        break;
      }
    }
    return best;
  }
}

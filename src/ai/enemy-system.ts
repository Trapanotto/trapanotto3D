import * as THREE from 'three';
import { AWARENESS_TIME, BOSS_RAGE, ENEMIES, SIGHT_RANGE } from '../config/enemies.ts';
import type { EnemyDef, EnemyType } from '../config/enemies.ts';
import type { Difficulty } from '../config/tuning.ts';
import type { SoundId } from '../audio/audio.ts';
import type { WorldQuery } from '../core/world-query.ts';
import type { EnemyModel } from '../render/models.ts';
import type { PlayerState } from '../player/player.ts';
import { chooseTactic, detectsPlayer, findPath } from '../world/navigation.ts';
import type { Waypoint } from '../world/navigation.ts';
import { worldToTile } from '../world/level.ts';
import { AI } from './tuning.ts';

export interface Enemy {
  id: number;
  type: EnemyType;
  def: EnemyDef;
  model: EnemyModel;
  /** Simulation position; the model is drawn interpolated between prev and pos. */
  pos: THREE.Vector3;
  prev: THREE.Vector3;
  yaw: number;
  prevYaw: number;
  health: number;
  maxHealth: number;
  home: Waypoint;

  /** Seconds left of hunting the player's last known position. */
  aware: number;
  lastSeen: Waypoint | null;
  /** Has spotted the player in this encounter and finished reacting. */
  engaged: boolean;
  reaction: number;
  route: Waypoint[];
  routeTimer: number;
  routeKey: string;

  attackCooldown: number;
  windup: number;
  windupTotal: number;
  burstLeft: number;
  burstTimer: number;
  hasToken: boolean;
  /** Runner dash: seconds left, direction and whether it already connected. */
  lunge: number;
  lungeX: number;
  lungeZ: number;
  lungeHit: boolean;
  recover: number;

  strafeDirection: number;
  strafeTimer: number;
  wanderTarget: Waypoint | null;
  wanderTimer: number;

  stagger: number;
  recentDamage: number;
  knockX: number;
  knockZ: number;
  hitFlash: number;
  flinch: number;
  walk: number;
  moved: boolean;
  deathTime: number;
}

export interface EnemyDeps {
  world: WorldQuery;
  player: PlayerState;
  container: THREE.Object3D;
  createModel(type: EnemyType): EnemyModel;
  /** Fire a projectile from origin along velocity. */
  shoot(enemy: Enemy, origin: THREE.Vector3, velocity: THREE.Vector3): void;
  damagePlayer(amount: number): void;
  sound(id: SoundId): void;
  sparks(x: number, y: number, z: number, colour: number, count: number): void;
  message(text: string): void;
  difficulty(): Difficulty;
  /** After every hit on an enemy, for the hit marker. */
  onHit?(enemy: Enemy, killed: boolean, headshot: boolean): void;
}

const UP = new THREE.Vector3(0, 1, 0);
const WINDUP_GLOW = new THREE.Color(0xff5a1e);
const HIT_GLOW = new THREE.Color(0xffd2b0);

function angleLerp(from: number, to: number, t: number): number {
  const delta = Math.atan2(Math.sin(to - from), Math.cos(to - from));
  return from + delta * t;
}

/**
 * Enemy perception, decisions, movement and attacks.
 *
 * Fair-fight rules: enemies need a moment to react when they first spot you,
 * only a few may attack at the same time (attack tokens), every attack is
 * announced by a glow and a sound, and enough damage during the wind-up
 * staggers the enemy and cancels the attack.
 */
export class EnemySystem {
  readonly enemies: Enemy[] = [];
  bossAwake = false;
  bossPhase = false;
  /** Freezes all enemies (debug panel). */
  frozen = false;
  private time = 0;
  private readonly tokens = new Set<Enemy>();
  private readonly deps: EnemyDeps;
  private readonly origin = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();
  private readonly velocity = new THREE.Vector3();

  constructor(deps: EnemyDeps) {
    this.deps = deps;
  }

  get boss(): Enemy | undefined {
    return this.enemies.find((e) => e.type === 'boss' && e.health > 0);
  }

  spawn(type: EnemyType, x: number, z: number, id: number): Enemy {
    const model = this.deps.createModel(type);
    model.group.rotation.order = 'YXZ';
    model.group.position.set(x, 0, z);
    this.deps.container.add(model.group);
    const def = ENEMIES[type];
    const enemy: Enemy = {
      id,
      type,
      def,
      model,
      pos: new THREE.Vector3(x, 0, z),
      prev: new THREE.Vector3(x, 0, z),
      yaw: 0,
      prevYaw: 0,
      health: def.health,
      maxHealth: def.health,
      home: { x, z },
      aware: 0,
      lastSeen: null,
      engaged: false,
      reaction: 0,
      route: [],
      routeTimer: 0,
      routeKey: '',
      attackCooldown: Math.random() * 1.1 + 0.5,
      windup: 0,
      windupTotal: 0,
      burstLeft: 0,
      burstTimer: 0,
      hasToken: false,
      lunge: 0,
      lungeX: 0,
      lungeZ: 0,
      lungeHit: false,
      recover: 0,
      strafeDirection: id % 2 ? 1 : -1,
      strafeTimer: 1.4 + (id % 3) * 0.5,
      wanderTarget: null,
      wanderTimer: 1 + (id % 5),
      stagger: 0,
      recentDamage: 0,
      knockX: 0,
      knockZ: 0,
      hitFlash: 0,
      flinch: 0,
      walk: Math.random() * 6,
      moved: false,
      deathTime: 0,
    };
    this.enemies.push(enemy);
    return enemy;
  }

  clear(): void {
    for (const enemy of this.enemies) this.deps.container.remove(enemy.model.group);
    this.enemies.length = 0;
    this.tokens.clear();
    this.bossAwake = false;
    this.bossPhase = false;
  }

  /** Gunfire draws enemies in. Walls muffle it, but a nearby shot still carries. */
  alert(x: number, z: number, radius: number): void {
    for (const enemy of this.enemies) {
      if (enemy.health <= 0 || (enemy.type === 'boss' && !this.bossAwake)) continue;
      const dist = Math.hypot(enemy.pos.x - x, enemy.pos.z - z);
      if (dist > radius) continue;
      if (dist > radius * 0.46 && !this.deps.world.wallsClear(enemy.pos.x, enemy.pos.z, x, z))
        continue;
      enemy.aware = Math.max(enemy.aware, AWARENESS_TIME);
      enemy.lastSeen = { x, z };
      enemy.routeTimer = 0;
    }
  }

  /** Applies damage from a hit at the given point. Returns true when the enemy died. */
  damage(enemy: Enemy, amount: number, from: Waypoint, headshot = false): boolean {
    if (enemy.health <= 0) return false;
    const { player } = this.deps;
    enemy.health -= amount;
    enemy.aware = Math.max(enemy.aware, 8);
    enemy.lastSeen = { x: player.x, z: player.z };
    enemy.hitFlash = 0.14;
    enemy.flinch = 0.22;
    enemy.recentDamage += amount;
    const away = Math.hypot(enemy.pos.x - from.x, enemy.pos.z - from.z) || 1;
    const push =
      Math.min(AI.maxKnockback, amount * AI.knockbackPerDamage) / (enemy.def.health / 60);
    enemy.knockX += ((enemy.pos.x - from.x) / away) * push;
    enemy.knockZ += ((enemy.pos.z - from.z) / away) * push;
    this.deps.sound(headshot ? 'headshot' : 'hit');
    this.deps.sparks(
      enemy.pos.x,
      enemy.pos.y + enemy.model.height * 0.62,
      enemy.pos.z,
      0xffb569,
      4,
    );

    const killed = enemy.health <= 0;
    if (killed) {
      enemy.windup = 0;
      enemy.burstLeft = 0;
      this.releaseToken(enemy);
      this.deps.sound('enemy');
      this.deps.sparks(enemy.pos.x, enemy.model.height * 0.55, enemy.pos.z, 0xed7d4b, 14);
    } else if (enemy.recentDamage >= AI.staggerThreshold[enemy.type]) {
      // Enough damage in a short time interrupts the enemy, including a charged attack.
      enemy.recentDamage = 0;
      enemy.stagger = AI.staggerTime[enemy.type];
      enemy.windup = 0;
      enemy.burstLeft = 0;
      enemy.lunge = 0;
      this.releaseToken(enemy);
    }
    this.deps.onHit?.(enemy, killed, headshot);
    return killed;
  }

  tick(dt: number): void {
    this.time += dt;
    for (const enemy of this.enemies) {
      enemy.prev.copy(enemy.pos);
      enemy.prevYaw = enemy.yaw;
      if (!this.frozen) this.think(enemy, dt);
    }
  }

  /** Places models between the last two simulation steps and drives the simple animation. */
  render(alpha: number, dt: number): void {
    for (const enemy of this.enemies) {
      const { group, parts, legBase } = enemy.model;
      group.position.lerpVectors(enemy.prev, enemy.pos, alpha);
      group.rotation.y = angleLerp(enemy.prevYaw, enemy.yaw, alpha);
      if (enemy.health <= 0) {
        // Falls backwards, away from the shot.
        if (!enemy.model.hover) group.rotation.x = -Math.min(1.48, enemy.deathTime * 3.7);
        this.glow(enemy, 0, 0);
        continue;
      }
      // Rocks back when hit, leans forward while charging.
      const charge = enemy.windupTotal > 0 ? 1 - enemy.windup / enemy.windupTotal : 0;
      const lean = enemy.windup > 0 ? charge * 0.18 : 0;
      group.rotation.x = lean - enemy.flinch * 1.1 - (enemy.stagger > 0 ? 0.15 : 0);
      if (parts.legL && parts.legR) {
        if (enemy.moved) enemy.walk += dt * (enemy.lunge > 0 ? 16 : 7);
        const swing = enemy.moved ? Math.sin(enemy.walk) * 0.34 : 0;
        parts.legL.rotation.x = legBase.left + swing;
        parts.legR.rotation.x = legBase.right - swing;
      }
      if (enemy.hitFlash > 0) this.glow(enemy, 1, 1.8);
      else if (enemy.windup > 0)
        this.glow(enemy, 2, 0.4 + charge * 2.2 + Math.sin(this.time * 40) * 0.25);
      else this.glow(enemy, 0, 0);
    }
  }

  // --- decisions --------------------------------------------------------

  private think(enemy: Enemy, dt: number): void {
    const { player, world } = this.deps;
    const pos = enemy.pos;
    if (enemy.health <= 0) {
      enemy.deathTime += dt;
      if (enemy.model.hover) pos.y = Math.max(0, pos.y - dt * 2);
      this.applyKnockback(enemy, dt);
      return;
    }
    const dx = player.x - pos.x;
    const dz = player.z - pos.z;
    const dist = Math.hypot(dx, dz);
    const clear = dist < SIGHT_RANGE && world.canSee(pos.x, pos.z, player.x, player.z);
    const visible = detectsPlayer({
      dx,
      dz,
      facing: enemy.yaw,
      visible: clear,
      alert: enemy.aware > 0,
    });
    if (enemy.type === 'boss' && !this.bossAwake) return;

    enemy.attackCooldown -= dt;
    enemy.routeTimer -= dt;
    enemy.strafeTimer -= dt;
    enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);
    enemy.flinch = Math.max(0, enemy.flinch - dt);
    enemy.recentDamage *= Math.exp(-dt * AI.staggerDecay);
    if (enemy.model.hover) pos.y = Math.sin(this.time * 3 + enemy.id) * 0.16;
    enemy.moved = this.applyKnockback(enemy, dt);
    if (enemy.stagger > 0) {
      enemy.stagger -= dt;
      return;
    }

    if (visible) {
      if (!enemy.engaged) this.engage(enemy);
      enemy.aware = AWARENESS_TIME;
      enemy.lastSeen = { x: player.x, z: player.z };
    } else {
      enemy.aware = Math.max(0, enemy.aware - dt);
      if (enemy.aware === 0) enemy.engaged = false;
    }

    if (!enemy.aware || !enemy.lastSeen) {
      this.cancelAttack(enemy);
      this.idle(enemy, dt);
      return;
    }

    if (!visible) {
      this.cancelAttack(enemy);
      this.search(enemy, dt);
      return;
    }

    this.turnTowards(enemy, Math.atan2(dx, dz), dt);
    if (enemy.reaction > 0) {
      enemy.reaction -= dt;
      return;
    }
    if (enemy.def.melee) this.meleeCombat(enemy, dx, dz, dist, dt);
    else this.rangedCombat(enemy, dx, dz, dist, dt);
    this.checkBossRage(enemy);
  }

  /** First sight of the player: shout to nearby allies, then a short reaction delay. */
  private engage(enemy: Enemy): void {
    const { player, world } = this.deps;
    const wasAlerted = enemy.aware > 0;
    enemy.engaged = true;
    enemy.reaction =
      AI.reactionTime[this.deps.difficulty()] *
      (wasAlerted ? 0.5 : 1) *
      (0.8 + Math.random() * 0.4);
    this.deps.sound('alert');
    for (const ally of this.enemies) {
      if (ally === enemy || ally.health <= 0 || ally.aware > 0) continue;
      if (ally.type === 'boss' && !this.bossAwake) continue;
      const d = Math.hypot(ally.pos.x - enemy.pos.x, ally.pos.z - enemy.pos.z);
      if (d > AI.shoutRadius || !world.wallsClear(ally.pos.x, ally.pos.z, enemy.pos.x, enemy.pos.z))
        continue;
      ally.aware = AWARENESS_TIME * 0.6;
      ally.lastSeen = { x: player.x, z: player.z };
      ally.routeTimer = 0;
    }
  }

  private meleeCombat(enemy: Enemy, dx: number, dz: number, dist: number, dt: number): void {
    const { player } = this.deps;
    if (enemy.lunge > 0) {
      enemy.lunge -= dt;
      enemy.moved = this.move(enemy, enemy.lungeX, enemy.lungeZ, dt, AI.lungeSpeed) || enemy.moved;
      if (
        !enemy.lungeHit &&
        Math.hypot(player.x - enemy.pos.x, player.z - enemy.pos.z) < AI.lungeHitRange
      ) {
        enemy.lungeHit = true;
        this.deps.damagePlayer(enemy.def.damage);
      }
      if (enemy.lunge <= 0) {
        enemy.recover = AI.lungeRecover;
        enemy.attackCooldown = enemy.def.delay;
        this.releaseToken(enemy);
      }
      return;
    }
    if (enemy.recover > 0) {
      // Backs off after a lunge, which gives the player a window to punish.
      enemy.recover -= dt;
      enemy.moved = this.move(enemy, -dx, -dz, dt, enemy.def.speed * 0.45) || enemy.moved;
      return;
    }
    if (enemy.windup > 0) {
      enemy.windup -= dt;
      if (enemy.windup <= 0) {
        enemy.lunge = AI.lungeTime;
        enemy.lungeX = dx / (dist || 1);
        enemy.lungeZ = dz / (dist || 1);
        enemy.lungeHit = false;
      }
      return;
    }
    if (dist < AI.lungeRange && enemy.attackCooldown <= 0 && this.takeToken(enemy)) {
      this.startWindup(enemy);
      return;
    }
    // Weaves on the approach instead of running in a straight line.
    const weave = dist > 5 ? Math.sin(this.time * 2.6 + enemy.id * 1.7) * 0.75 : 0;
    const cos = Math.cos(weave);
    const sin = Math.sin(weave);
    enemy.moved = this.move(enemy, dx * cos - dz * sin, dx * sin + dz * cos, dt) || enemy.moved;
  }

  private rangedCombat(enemy: Enemy, dx: number, dz: number, dist: number, dt: number): void {
    if (enemy.burstLeft > 0) {
      enemy.burstTimer -= dt;
      if (enemy.burstTimer <= 0) {
        this.fireVolley(enemy, dist);
        enemy.burstLeft--;
        enemy.burstTimer = AI.burstInterval;
        if (enemy.burstLeft === 0) {
          const rage = enemy.type === 'boss' && this.bossPhase;
          enemy.attackCooldown = enemy.def.delay * (rage ? BOSS_RAGE.delayMultiplier : 1);
          this.releaseToken(enemy);
        }
      }
      return;
    }
    if (enemy.windup > 0) {
      // Plants its feet while aiming: the tell that a shot is coming.
      enemy.windup -= dt;
      if (enemy.windup <= 0) {
        enemy.burstLeft = AI.burst[enemy.type];
        enemy.burstTimer = 0;
      }
      return;
    }
    if (enemy.attackCooldown <= 0 && dist < enemy.def.attackRange && this.takeToken(enemy)) {
      this.startWindup(enemy);
      return;
    }
    const tactic = chooseTactic(enemy.type, dist, true);
    const pace = enemy.hasToken ? 1 : 0.85;
    if (tactic === 'chase')
      enemy.moved = this.move(enemy, dx, dz, dt, undefined, pace) || enemy.moved;
    else if (tactic === 'retreat')
      enemy.moved = this.move(enemy, -dx, -dz, dt, undefined, pace) || enemy.moved;
    else if (tactic === 'strafe') {
      if (enemy.strafeTimer <= 0) {
        enemy.strafeDirection *= -1;
        enemy.strafeTimer = 1.4 + (enemy.id % 4) * 0.35;
      }
      const sideways = this.move(
        enemy,
        -dz * enemy.strafeDirection,
        dx * enemy.strafeDirection,
        dt,
        undefined,
        0.6,
      );
      if (!sideways) {
        enemy.strafeDirection *= -1;
        enemy.strafeTimer = 1;
      }
      enemy.moved = sideways || enemy.moved;
    }
  }

  /** Follows a path to where the player was last seen or heard. */
  private search(enemy: Enemy, dt: number): void {
    const { world } = this.deps;
    const pos = enemy.pos;
    const goal = enemy.lastSeen;
    if (!goal) return;
    const key = `${worldToTile(goal.x)},${worldToTile(goal.z)},${world.openDoors.size}`;
    if (enemy.routeTimer <= 0 || enemy.routeKey !== key) {
      enemy.route = findPath(
        world.level,
        pos.x,
        pos.z,
        goal.x,
        goal.z,
        world.openDoors,
        world.obstacles,
      );
      enemy.routeTimer = 0.8 + (enemy.id % 4) * 0.13;
      enemy.routeKey = key;
    }
    while (
      enemy.route.length &&
      Math.hypot(enemy.route[0].x - pos.x, enemy.route[0].z - pos.z) < 0.5
    )
      enemy.route.shift();
    const sameTile =
      worldToTile(pos.x) === worldToTile(goal.x) && worldToTile(pos.z) === worldToTile(goal.z);
    const target = enemy.route[0] ?? (sameTile ? goal : null);
    if (target) {
      const mx = target.x - pos.x;
      const mz = target.z - pos.z;
      this.turnTowards(enemy, Math.atan2(mx, mz), dt);
      enemy.moved = this.move(enemy, mx, mz, dt) || enemy.moved;
    } else {
      // Arrived and nothing there: look around.
      enemy.yaw += Math.sin(this.time * 1.3 + enemy.id) * dt * 1.6;
    }
  }

  /** Unaware: drifts around its post and looks about, so the room feels inhabited. */
  private idle(enemy: Enemy, dt: number): void {
    if (enemy.type === 'boss') return;
    enemy.wanderTimer -= dt;
    if (enemy.wanderTimer <= 0) {
      enemy.wanderTimer = AI.wanderPause + Math.random() * AI.wanderPause;
      const angle = Math.random() * Math.PI * 2;
      const radius = 0.8 + Math.random() * AI.wanderRadius;
      const target = {
        x: enemy.home.x + Math.sin(angle) * radius,
        z: enemy.home.z + Math.cos(angle) * radius,
      };
      const { world } = this.deps;
      enemy.wanderTarget =
        world.canMove(target.x, target.z, enemy.model.radius * 0.7) &&
        world.canSee(enemy.pos.x, enemy.pos.z, target.x, target.z)
          ? target
          : null;
    }
    const target = enemy.wanderTarget;
    if (target) {
      const mx = target.x - enemy.pos.x;
      const mz = target.z - enemy.pos.z;
      if (Math.hypot(mx, mz) < 0.3) enemy.wanderTarget = null;
      else {
        this.turnTowards(enemy, Math.atan2(mx, mz), dt, 2.5);
        enemy.moved = this.move(enemy, mx, mz, dt, undefined, AI.wanderPace) || enemy.moved;
      }
    } else enemy.yaw += Math.sin(this.time * 0.45 + enemy.id * 2.1) * dt * 0.5;
  }

  // --- attacks ----------------------------------------------------------

  private startWindup(enemy: Enemy): void {
    const rage = enemy.type === 'boss' && this.bossPhase;
    enemy.windupTotal = AI.windup[enemy.type] * (rage ? 0.75 : 1);
    enemy.windup = enemy.windupTotal;
    this.deps.sound('charge');
  }

  private fireVolley(enemy: Enemy, dist: number): void {
    const { player } = this.deps;
    const def = enemy.def;
    const pos = enemy.pos;
    this.origin.set(
      pos.x,
      enemy.model.hover ? pos.y + 1.65 : pos.y + enemy.model.height * 0.65,
      pos.z,
    );
    // Lead the target a little, with aim error that grows with distance.
    const flight = dist / def.projectileSpeed;
    const lead = AI.lead[this.deps.difficulty()];
    const error = AI.aimError * (0.5 + dist / 25);
    this.aim.set(
      player.x + player.vx * flight * lead + (Math.random() - 0.5) * error,
      player.feet + 1.25 + (Math.random() - 0.5) * error * 0.4,
      player.z + player.vz * flight * lead + (Math.random() - 0.5) * error,
    );
    const base = this.velocity
      .copy(this.aim)
      .sub(this.origin)
      .normalize()
      .multiplyScalar(def.projectileSpeed);
    const rage = enemy.type === 'boss' && this.bossPhase;
    const angles = rage ? [-BOSS_RAGE.volleySpread, 0, BOSS_RAGE.volleySpread] : [0];
    for (const angle of angles) {
      const velocity = angle ? base.clone().applyAxisAngle(UP, angle) : base;
      this.deps.shoot(enemy, this.origin, velocity);
    }
  }

  private cancelAttack(enemy: Enemy): void {
    enemy.windup = 0;
    enemy.burstLeft = 0;
    this.releaseToken(enemy);
  }

  /** Only a few enemies attack at once; the rest keep moving until a slot frees up. */
  private takeToken(enemy: Enemy): boolean {
    if (enemy.type === 'boss' || enemy.hasToken) return true;
    if (this.tokens.size >= AI.attackTokens[this.deps.difficulty()]) return false;
    this.tokens.add(enemy);
    enemy.hasToken = true;
    return true;
  }

  private releaseToken(enemy: Enemy): void {
    enemy.hasToken = false;
    this.tokens.delete(enemy);
  }

  private checkBossRage(enemy: Enemy): void {
    if (
      enemy.type !== 'boss' ||
      this.bossPhase ||
      enemy.health >= enemy.maxHealth * BOSS_RAGE.healthFraction
    )
      return;
    this.bossPhase = true;
    this.deps.message('REAKTOR INSTABIL · SIEGRIST GREIFT AN');
    for (const [id, offset] of [
      [1001, -12],
      [1002, 12],
    ] as const) {
      const drone = this.spawn('drone', enemy.home.x + offset, enemy.home.z - 4, id);
      drone.aware = AWARENESS_TIME;
      drone.engaged = true;
      drone.lastSeen = { x: this.deps.player.x, z: this.deps.player.z };
    }
  }

  // --- movement ---------------------------------------------------------

  private turnTowards(enemy: Enemy, target: number, dt: number, rate = AI.turnRate): void {
    const delta = Math.atan2(Math.sin(target - enemy.yaw), Math.cos(target - enemy.yaw));
    enemy.yaw += Math.sign(delta) * Math.min(Math.abs(delta), rate * dt);
  }

  private applyKnockback(enemy: Enemy, dt: number): boolean {
    const speed = Math.hypot(enemy.knockX, enemy.knockZ);
    if (speed < 0.05) {
      enemy.knockX = enemy.knockZ = 0;
      return false;
    }
    const moved = this.move(enemy, enemy.knockX, enemy.knockZ, dt, speed);
    const decay = Math.exp(-dt * AI.knockbackDecay);
    enemy.knockX *= decay;
    enemy.knockZ *= decay;
    return moved;
  }

  /** Moves towards (dx, dz) at the enemy's speed, sliding along walls and around machines. */
  private move(
    enemy: Enemy,
    dx: number,
    dz: number,
    dt: number,
    speed?: number,
    pace = 1,
  ): boolean {
    const length = Math.hypot(dx, dz);
    if (length < 0.01) return false;
    const rage = enemy.type === 'boss' && this.bossPhase ? BOSS_RAGE.speedMultiplier : 1;
    const step = Math.min(length, (speed ?? enemy.def.speed * rage) * pace * dt);
    const mx = (dx / length) * step;
    const mz = (dz / length) * step;
    const r = enemy.model.radius * 0.7;
    const pos = enemy.pos;
    const { world } = this.deps;
    let moved = false;
    if (world.canMove(pos.x + mx, pos.z, r)) {
      pos.x += mx;
      moved ||= Math.abs(mx) > 0.0001;
    }
    if (world.canMove(pos.x, pos.z + mz, r)) {
      pos.z += mz;
      moved ||= Math.abs(mz) > 0.0001;
    }
    if (!moved) {
      // Sliding sideways gives the pathfinder room to clear a small machine or corner.
      const sx = -mz * enemy.strafeDirection;
      const sz = mx * enemy.strafeDirection;
      if (world.canMove(pos.x + sx, pos.z + sz, r)) {
        pos.x += sx;
        pos.z += sz;
        moved = true;
      } else enemy.strafeDirection *= -1;
    }
    return moved;
  }

  private glow(enemy: Enemy, mode: 0 | 1 | 2, intensity: number): void {
    const state = mode * 100 + Math.round(intensity * 20);
    const group = enemy.model.group;
    if (group.userData.glow === state) return;
    group.userData.glow = state;
    for (const { material, baseEmissive, baseIntensity } of enemy.model.materials) {
      if (mode === 0) {
        material.emissive.copy(baseEmissive);
        material.emissiveIntensity = baseIntensity;
      } else {
        material.emissive.copy(mode === 1 ? HIT_GLOW : WINDUP_GLOW);
        material.emissiveIntensity = intensity * 0.35;
      }
    }
  }
}

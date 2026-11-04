import * as THREE from 'three';
import type { GameAudio } from './audio/audio.ts';
import { EnemySystem } from './ai/enemy-system.ts';
import type { Enemy } from './ai/enemy-system.ts';
import { ProjectileSystem } from './combat/projectiles.ts';
import type { Projectile } from './combat/projectiles.ts';
import { AREA_NAMES, AREA_STORY, LINES, PICKUP_NAMES } from './config/text.ts';
import { DIFFICULTY_DAMAGE, LIGHTING, SIM_STEP } from './config/tuning.ts';
import {
  AMMO_CAPS,
  AMMO_PICKUP,
  EXPLOSION_RADIUS,
  WEAPONS,
  WEAPON_PICKUP_AMMO,
} from './config/weapons.ts';
import type { AmmoType, WeaponId } from './config/weapons.ts';
import { Input } from './core/input.ts';
import { FixedLoop } from './core/loop.ts';
import { WorldQuery } from './core/world-query.ts';
import { ParticlePool } from './fx/particles.ts';
import { TracerPool } from './fx/tracers.ts';
import { PickupSystem } from './game/pickups.ts';
import type { Pickup } from './game/pickups.ts';
import type { Snapshot } from './game/snapshot.ts';
import { PlayerController, createPlayer, eyePosition } from './player/player.ts';
import type { PlayerState } from './player/player.ts';
import type { GameAssets } from './render/assets.ts';
import { makeEnemy, makePickup, makeWeapon } from './render/models.ts';
import { RenderPipeline } from './render/pipeline.ts';
import { buildWorld } from './render/world-builder.ts';
import type { BuiltWorld } from './render/world-builder.ts';
import type { Settings } from './settings.ts';
import { WeaponSystem } from './weapons/weapon-system.ts';
import {
  CHECKPOINT,
  DOORS,
  ENEMY_SPAWNS,
  EXIT,
  PICKUP_SPAWNS,
  SECRET_COUNT,
  SPAWN,
  TRIGGERS,
  areaAt,
  createLevel,
  inTileRect,
  tileCenter,
} from './world/level.ts';
import type { Door, KeyColor } from './world/level.ts';

export type Mode = 'menu' | 'playing' | 'paused' | 'dead' | 'won' | 'qa-complete';
export type HitKind = 'none' | 'hit' | 'head' | 'kill';

export interface HudState {
  health: number;
  armor: number;
  weapon: string;
  ammo: number | '∞';
  keys: ReadonlySet<KeyColor>;
  objective: string;
  area: string;
  time: number;
  inventory: ReadonlySet<WeaponId>;
  /** Boss health 0–1 while the fight is on, otherwise null. */
  boss: number | null;
  hit: HitKind;
  hurt: number;
  interaction: Door | null;
  kills: number;
  secrets: number;
}

export interface RunResult {
  time: number;
  kills: number;
  secrets: number;
}

export interface GameCallbacks {
  onUpdate(state: HudState): void;
  onMessage(text: string): void;
  onDeath(hasCheckpoint: boolean): void;
  onWin(result: RunResult): void;
}

const DOOR_REACH = 4.15;
const PLAYER_HIT_RADIUS = 0.8;
const HEAVY_SPLASH = 2.2;

export class Game {
  readonly pipeline: RenderPipeline;
  readonly input: Input;
  readonly world: WorldQuery;
  readonly built: BuiltWorld;
  readonly player: PlayerState;
  readonly controller: PlayerController;
  readonly enemies: EnemySystem;
  readonly weapons: WeaponSystem;
  readonly projectiles: ProjectileSystem;
  readonly particles: ParticlePool;
  readonly tracers: TracerPool;
  readonly pickups: PickupSystem;
  readonly keys = new Set<KeyColor>();
  /** Called after every rendered frame (performance overlay). */
  readonly afterRender = new Set<() => void>();
  mode: Mode = 'menu';
  settings: Settings;
  snapshot: Snapshot | null = null;
  godMode = false;

  playTime = 0;
  killCount = 0;
  secretCount = 0;
  bossDead = false;
  checkpointReached = false;
  killedIds = new Set<number>();
  collectedIds = new Set<number>();
  storyEvents = new Set<string>();
  readonly exitMesh: THREE.Group;

  private readonly audio: GameAudio;
  private readonly callbacks: GameCallbacks;
  private readonly dynamic = new THREE.Group();
  private readonly loop = new FixedLoop(SIM_STEP);
  private hitTime = 0;
  private hitKind: HitKind = 'none';
  private hurtTime = 0;
  private visualTime = 0;
  private lastFrame = performance.now();
  private readonly cameraPos = new THREE.Vector3();

  constructor(
    viewport: HTMLElement,
    audio: GameAudio,
    callbacks: GameCallbacks,
    settings: Settings,
    assets: GameAssets,
  ) {
    this.audio = audio;
    this.callbacks = callbacks;
    this.settings = settings;
    this.pipeline = new RenderPipeline(viewport, settings.fov, settings.quality);
    const { scene, camera } = this.pipeline;
    const level = createLevel();
    this.built = buildWorld(scene, level, assets);
    this.world = new WorldQuery(level, this.built.obstacles);
    scene.add(this.dynamic);

    this.input = new Input(this.pipeline.canvas, {
      onKey: (code) => this.keyPressed(code),
      onLook: (dx, dy) => this.controller.look(dx, dy, this.settings.sensitivity),
      onWheel: (direction) => this.weapons.cycle(direction),
    });
    this.player = createPlayer(tileCenter(SPAWN.x), tileCenter(SPAWN.z));
    this.controller = new PlayerController(this.player, this.world, this.input, audio);
    this.particles = new ParticlePool(scene);
    this.tracers = new TracerPool(scene);
    this.projectiles = new ProjectileSystem(this.dynamic, this.world, {
      hitsTarget: (p) => this.projectileHits(p),
      impact: (p, point, wall) => this.projectileImpact(p, point, wall),
    });
    this.enemies = new EnemySystem({
      world: this.world,
      player: this.player,
      container: this.dynamic,
      createModel: (type) => makeEnemy(type, assets),
      shoot: (enemy, origin, velocity) => this.enemyShoots(enemy, origin, velocity),
      damagePlayer: (amount) => this.damagePlayer(amount),
      sound: (id) => audio.play(id),
      sparks: (x, y, z, colour, count) => this.particles.emit(x, y, z, colour, count),
      message: (text) => this.message(text),
      difficulty: () => this.settings.difficulty,
      onHit: (enemy, killed, headshot) => this.enemyHit(enemy, killed, headshot),
    });
    this.weapons = new WeaponSystem({
      player: this.player,
      world: this.world,
      enemies: this.enemies,
      projectiles: this.projectiles,
      particles: this.particles,
      tracers: this.tracers,
      sound: audio,
      message: (text) => this.message(text),
      createViewmodel: (type) => makeWeapon(type, assets),
      camera,
    });
    this.pickups = new PickupSystem(this.dynamic, makePickup);
    this.exitMesh = this.buildExit();
    this.applyLighting();
    this.reset();
    requestAnimationFrame((t) => this.frame(t));
  }

  get canvas(): HTMLCanvasElement {
    return this.pipeline.canvas;
  }

  // --- lifecycle ----------------------------------------------------------

  reset(snapshot: Snapshot | null = null): void {
    this.enemies.clear();
    this.projectiles.clear();
    this.pickups.clear();
    this.particles.clear();
    this.tracers.clear();
    this.loop.reset();
    this.world.openDoors.clear();
    for (const id of snapshot?.openDoors ?? []) this.world.openDoors.add(id);
    for (const [id, panel] of Object.entries(this.built.doors))
      panel.visible = !this.world.openDoors.has(id);

    const start = snapshot ? CHECKPOINT : SPAWN;
    Object.assign(
      this.player,
      createPlayer(
        tileCenter(start.x),
        tileCenter(start.z),
        snapshot?.health ?? 100,
        snapshot?.armor ?? 0,
      ),
    );
    this.keys.clear();
    for (const key of snapshot?.keys ?? []) this.keys.add(key);
    this.weapons.reset(
      snapshot?.inventory ?? ['fist', 'pistol'],
      snapshot?.ammo ?? {},
      snapshot?.weapon ?? 'pistol',
    );
    this.playTime = snapshot?.playTime ?? 0;
    this.killCount = snapshot?.killCount ?? 0;
    this.secretCount = snapshot?.secretCount ?? 0;
    this.killedIds = new Set(snapshot?.killedIds);
    this.collectedIds = new Set(snapshot?.collectedIds);
    this.storyEvents = new Set(snapshot?.storyEvents);
    this.bossDead = false;
    this.checkpointReached = Boolean(snapshot);
    this.hitTime = this.hurtTime = 0;
    this.input.clear();
    if (!snapshot) this.snapshot = null;

    ENEMY_SPAWNS.forEach(([type, x, z], id) => {
      if (!this.killedIds.has(id)) this.enemies.spawn(type, tileCenter(x), tileCenter(z), id);
    });
    PICKUP_SPAWNS.forEach(([type, x, z], id) => {
      if (!this.collectedIds.has(id)) this.pickups.spawn(type, tileCenter(x), tileCenter(z), id);
    });
    this.exitMesh.visible = false;
    this.render(0, 1);
    this.emit();
  }

  setMode(mode: Mode): void {
    this.mode = mode;
    this.input.enabled = mode === 'playing';
    this.input.clear();
    this.audio.setAmbient(mode === 'playing');
  }

  updateSettings(settings: Settings): void {
    this.settings = settings;
    this.pipeline.setFov(settings.fov);
    this.pipeline.setQuality(settings.quality);
    this.audio.setVolume(settings.volume / 100);
  }

  /** Re-applies LIGHTING to renderer and lamps. Used by the debug panel. */
  applyLighting(): void {
    this.pipeline.applyLighting();
    for (const lamp of this.built.lamps)
      lamp.light.intensity = lamp.baseIntensity * LIGHTING.lampIntensity;
  }

  // --- player actions -----------------------------------------------------

  private keyPressed(code: string): void {
    if (code === 'Space') this.controller.jump();
    if (code === 'KeyE') this.interact();
    const slot = /^Digit([1-5])$/.exec(code);
    if (slot)
      this.weapons.equip(
        (['fist', 'pistol', 'shotgun', 'nailgun', 'launcher'] as const)[Number(slot[1]) - 1],
      );
  }

  interact(): void {
    const door = this.nearestDoor();
    if (!door) return;
    if (door.kind === 'key' && door.key && !this.keys.has(door.key)) {
      this.message(`ZUGANG GESPERRT · ${door.key === 'red' ? 'ROTE' : 'GELBE'} KARTE BENÖTIGT`);
      this.audio.play('hurt');
      return;
    }
    this.world.openDoors.add(door.id);
    this.built.doors[door.id].visible = false;
    this.audio.play('door');
    if (door.kind === 'secret') {
      this.secretCount++;
      this.message(`GEHEIMNIS GEFUNDEN · ${this.secretCount} / ${SECRET_COUNT}`);
    } else this.message(LINES.doorOpen);
  }

  nearestDoor(): Door | null {
    let best: Door | null = null;
    let distance = DOOR_REACH;
    for (const door of DOORS) {
      if (this.world.openDoors.has(door.id)) continue;
      for (const [x, z] of door.cells) {
        const d = Math.hypot(this.player.x - tileCenter(x), this.player.z - tileCenter(z));
        if (d < distance) {
          distance = d;
          best = door;
        }
      }
    }
    return best;
  }

  collect(pickup: Pickup): boolean {
    const p = this.player;
    const type = pickup.type;
    if (type === 'health') {
      if (p.health >= 100) return false;
      p.health = Math.min(100, p.health + 25);
    } else if (type === 'armor') {
      if (p.armor >= 100) return false;
      p.armor = Math.min(100, p.armor + 25);
    } else if (type === 'red' || type === 'yellow') this.keys.add(type);
    else if (type in AMMO_CAPS) {
      const ammo = type as AmmoType;
      if (this.weapons.ammo[ammo] >= AMMO_CAPS[ammo]) return false;
      this.weapons.ammo[ammo] = Math.min(
        AMMO_CAPS[ammo],
        this.weapons.ammo[ammo] + AMMO_PICKUP[ammo],
      );
    } else {
      const weapon = type as WeaponId;
      const ammoType = WEAPONS[weapon].ammo;
      this.weapons.inventory.add(weapon);
      if (ammoType) this.weapons.ammo[ammoType] += WEAPON_PICKUP_AMMO[weapon] ?? 0;
      this.weapons.equip(weapon);
    }
    this.collectedIds.add(pickup.id);
    this.audio.play(type === 'red' || type === 'yellow' ? 'key' : 'pickup');
    this.message(PICKUP_NAMES[type]);
    return true;
  }

  damagePlayer(amount: number): void {
    if (this.mode !== 'playing' || this.godMode) return;
    let damage = amount * DIFFICULTY_DAMAGE[this.settings.difficulty];
    const p = this.player;
    if (p.armor > 0) {
      const absorbed = Math.min(p.armor, damage * 0.4);
      p.armor -= absorbed;
      damage -= absorbed;
    }
    p.health = Math.max(0, p.health - damage);
    this.hurtTime = 0.35;
    this.audio.play('hurt');
    if (p.health <= 0) {
      this.setMode('dead');
      this.audio.play('death');
      this.callbacks.onDeath(Boolean(this.snapshot));
    }
  }

  saveCheckpoint(): void {
    this.player.health = Math.max(75, this.player.health);
    this.checkpointReached = true;
    this.snapshot = {
      health: this.player.health,
      armor: this.player.armor,
      keys: [...this.keys],
      inventory: [...this.weapons.inventory],
      ammo: { ...this.weapons.ammo },
      weapon: this.weapons.current,
      openDoors: [...this.world.openDoors],
      killedIds: [...this.killedIds],
      collectedIds: [...this.collectedIds],
      storyEvents: [...this.storyEvents],
      secretCount: this.secretCount,
      killCount: this.killCount,
      playTime: this.playTime,
    };
    this.message(LINES.checkpoint);
    this.audio.play('key');
  }

  objective(): string {
    if (this.bossDead) return 'VERLASSE DAS WERK';
    if (this.enemies.bossAwake) return 'SCHALTE DEN REAKTOR AB';
    if (!this.keys.has('red')) return 'FINDE DIE ROTE ZUGANGSKARTE';
    if (!this.keys.has('yellow')) return 'FINDE DIE GELBE ZUGANGSKARTE';
    return 'ERREICHE DEN REAKTOR';
  }

  // --- combat callbacks ---------------------------------------------------

  private enemyShoots(enemy: Enemy, origin: THREE.Vector3, velocity: THREE.Vector3): void {
    const heavy = enemy.type === 'tank';
    this.projectiles.spawn(
      heavy ? 'heavy' : 'shot',
      'enemy',
      origin,
      velocity,
      enemy.def.damage,
      5,
      enemy.type === 'boss' ? 1.7 : 1,
    );
  }

  private enemyHit(enemy: Enemy, killed: boolean, headshot: boolean): void {
    this.hitTime = 0.13;
    this.hitKind = killed ? 'kill' : headshot ? 'head' : 'hit';
    if (!killed) return;
    this.killedIds.add(enemy.id);
    this.killCount++;
    if (enemy.type === 'boss') {
      this.bossDead = true;
      this.exitMesh.visible = true;
      this.message(LINES.bossDead);
    }
  }

  private projectileHits(p: Projectile): boolean {
    if (p.owner === 'enemy') {
      const pl = this.player;
      const hit =
        Math.hypot(p.pos.x - pl.x, p.pos.y - (pl.feet + 1.1), p.pos.z - pl.z) < PLAYER_HIT_RADIUS;
      if (hit) this.damagePlayer(p.damage);
      return hit;
    }
    return this.enemies.enemies.some(
      (e) =>
        e.health > 0 &&
        Math.hypot(
          p.pos.x - e.pos.x,
          p.pos.y - (e.pos.y + e.model.height * 0.6),
          p.pos.z - e.pos.z,
        ) < e.model.radius,
    );
  }

  private projectileImpact(p: Projectile, point: THREE.Vector3, _wall: boolean): void {
    if (p.owner === 'player') {
      this.explode(point, p.damage);
      return;
    }
    this.particles.emit(
      point.x,
      point.y,
      point.z,
      p.kind === 'heavy' ? 0xff6a2a : 0xf48749,
      p.kind === 'heavy' ? 10 : 4,
    );
    if (p.kind === 'heavy') {
      // Heavy rounds burst on impact: near misses still hurt a little.
      const pl = this.player;
      const d = Math.hypot(point.x - pl.x, point.z - pl.z);
      const direct =
        Math.hypot(point.x - pl.x, point.y - (pl.feet + 1.1), point.z - pl.z) < PLAYER_HIT_RADIUS;
      if (!direct && d < HEAVY_SPLASH && this.world.canSee(point.x, point.z, pl.x, pl.z))
        this.damagePlayer(p.damage * 0.45 * (1 - d / HEAVY_SPLASH));
    }
  }

  explode(point: THREE.Vector3, damage: number): void {
    this.audio.play('explosion');
    this.particles.emit(point.x, point.y, point.z, 0xffa44c, 24, 1.6);
    for (const enemy of this.enemies.enemies) {
      if (enemy.health <= 0) continue;
      const cy = enemy.pos.y + enemy.model.height * 0.55;
      const d = Math.hypot(point.x - enemy.pos.x, point.y - cy, point.z - enemy.pos.z);
      if (d < EXPLOSION_RADIUS && this.world.canSee(point.x, point.z, enemy.pos.x, enemy.pos.z))
        this.enemies.damage(enemy, damage * (1 - d / 5), point);
    }
    const pl = this.player;
    const d = Math.hypot(point.x - pl.x, point.z - pl.z, point.y - (pl.feet + 1));
    if (d < 3.5 && this.world.canSee(point.x, point.z, pl.x, pl.z))
      this.damagePlayer(damage * 0.35 * (1 - d / 4));
  }

  // --- main loop ----------------------------------------------------------

  /** One fixed simulation step. */
  tick(dt: number): void {
    this.playTime += dt;
    this.hitTime = Math.max(0, this.hitTime - dt);
    this.hurtTime = Math.max(0, this.hurtTime - dt);
    this.controller.tick(dt);
    this.weapons.tick(dt, this.input.triggerHeld);
    this.enemies.tick(dt);
    this.projectiles.tick(dt);
    this.pickups.tick(this.player.x, this.player.z, (item) => this.collect(item));
    this.missionEvents();
  }

  private missionEvents(): void {
    const { x, z } = this.player;
    const area = areaAt(this.world.level, x, z);
    const story = area ? AREA_STORY[area] : undefined;
    if (area && story && !this.storyEvents.has(area)) {
      this.storyEvents.add(area);
      this.message(story);
    }
    if (!this.checkpointReached && inTileRect(TRIGGERS.checkpoint, x, z)) this.saveCheckpoint();
    if (!this.enemies.bossAwake && inTileRect(TRIGGERS.bossArena, x, z)) {
      this.enemies.bossAwake = true;
      this.message(LINES.bossWakes);
    }
    if (this.bossDead && Math.hypot(x - tileCenter(EXIT.x), z - tileCenter(EXIT.z)) < 1.5) {
      this.setMode('won');
      this.callbacks.onWin({
        time: this.playTime,
        kills: this.killCount,
        secrets: this.secretCount,
      });
    }
  }

  frame(now: number): void {
    const dt = Math.min(0.1, Math.max(0, (now - this.lastFrame) / 1000));
    this.lastFrame = now;
    this.visualTime += dt;
    let alpha = 1;
    if (this.mode === 'playing') {
      alpha = this.loop.advance(dt, (step) => {
        if (this.mode === 'playing') this.tick(step);
      });
    } else if (this.mode === 'menu') {
      this.player.yaw = Math.PI + Math.sin(this.visualTime * 0.18) * 0.12;
    }
    this.render(dt, alpha);
    if (this.mode === 'playing') this.emit();
    for (const hook of this.afterRender) hook();
    requestAnimationFrame((t) => this.frame(t));
  }

  private render(dt: number, alpha: number): void {
    const p = this.player;
    const camera = this.pipeline.camera;
    const moving = this.controller.moving && this.mode === 'playing';
    eyePosition(p, alpha, this.cameraPos);
    if (moving && p.feet === 0) this.cameraPos.y += Math.sin(this.playTime * 10) * 0.035;
    camera.position.copy(this.cameraPos);
    camera.rotation.set(p.pitch, p.yaw, 0, 'YXZ');
    this.enemies.render(alpha, dt);
    this.projectiles.render(alpha);
    if (this.mode === 'playing') {
      this.particles.update(dt);
      this.tracers.update(dt);
    }
    this.pickups.render(this.visualTime, dt);
    this.weapons.render(dt, moving, this.playTime);
    this.pipeline.muzzleLight.intensity = this.weapons.muzzleTime > 0 ? 14 : 0;
    this.exitMesh.rotation.y += dt * 0.6;
    this.pipeline.render();
  }

  private emit(): void {
    const boss = this.enemies.boss;
    const area = areaAt(this.world.level, this.player.x, this.player.z);
    this.callbacks.onUpdate({
      health: Math.ceil(this.player.health),
      armor: Math.ceil(this.player.armor),
      weapon: this.weapons.def.label,
      ammo: this.weapons.ammoCount,
      keys: this.keys,
      objective: this.objective(),
      area: area ? AREA_NAMES[area] : 'WERK',
      time: this.playTime,
      inventory: this.weapons.inventory,
      boss: this.enemies.bossAwake && boss ? boss.health / boss.maxHealth : null,
      hit: this.hitTime > 0 ? this.hitKind : 'none',
      hurt: this.settings.screenEffects ? this.hurtTime : 0,
      interaction: this.nearestDoor(),
      kills: this.killCount,
      secrets: this.secretCount,
    });
  }

  private message(text: string): void {
    this.callbacks.onMessage(text);
  }

  private buildExit(): THREE.Group {
    const exit = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.05, 0.07, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x85e3ba }),
    );
    ring.rotation.x = Math.PI / 2;
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.9, 3, 12, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x70d9a4,
        transparent: true,
        opacity: 0.14,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    );
    beam.position.y = 1.5;
    exit.add(ring, beam);
    exit.position.set(tileCenter(EXIT.x), 0.08, tileCenter(EXIT.z));
    this.pipeline.scene.add(exit);
    return exit;
  }
}

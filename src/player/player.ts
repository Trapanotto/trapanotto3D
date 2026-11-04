import * as THREE from 'three';
import { PLAYER_TUNING } from '../config/tuning.ts';
import type { WorldQuery } from '../core/world-query.ts';
import type { Input } from '../core/input.ts';
import type { SoundPlayer } from '../audio/audio.ts';

export interface PlayerState {
  x: number;
  z: number;
  /** Height of the feet above the floor. */
  feet: number;
  vy: number;
  /** Horizontal velocity of the last step, for enemies that lead their shots. */
  vx: number;
  vz: number;
  yaw: number;
  pitch: number;
  health: number;
  armor: number;
  /** Position at the previous simulation step, for render interpolation. */
  prevX: number;
  prevZ: number;
  prevFeet: number;
}

export function createPlayer(x: number, z: number, health = 100, armor = 0): PlayerState {
  return {
    x,
    z,
    feet: 0,
    vy: 0,
    vx: 0,
    vz: 0,
    yaw: Math.PI,
    pitch: 0,
    health,
    armor,
    prevX: x,
    prevZ: z,
    prevFeet: 0,
  };
}

const PITCH_LIMIT = 1.42;

export class PlayerController {
  readonly state: PlayerState;
  moving = false;
  private stepTimer = 0;
  private readonly world: WorldQuery;
  private readonly input: Input;
  private readonly sound: SoundPlayer;

  constructor(state: PlayerState, world: WorldQuery, input: Input, sound: SoundPlayer) {
    this.state = state;
    this.world = world;
    this.input = input;
    this.sound = sound;
  }

  look(dx: number, dy: number, sensitivity: number): void {
    const scale = PLAYER_TUNING.lookSensitivity * sensitivity;
    this.state.yaw -= dx * scale;
    this.state.pitch = THREE.MathUtils.clamp(
      this.state.pitch - dy * scale,
      -PITCH_LIMIT,
      PITCH_LIMIT,
    );
  }

  jump(): void {
    if (this.state.feet <= 0.001) this.state.vy = PLAYER_TUNING.jumpVelocity;
  }

  tick(dt: number): void {
    const p = this.state;
    p.prevX = p.x;
    p.prevZ = p.z;
    p.prevFeet = p.feet;
    const { forward, strafe } = this.input.moveAxes();
    const length = Math.hypot(forward, strafe) || 1;
    const step = (PLAYER_TUNING.speed * dt) / length;
    const dx = (-Math.sin(p.yaw) * forward + Math.cos(p.yaw) * strafe) * step;
    const dz = (-Math.cos(p.yaw) * forward - Math.sin(p.yaw) * strafe) * step;
    // Each axis separately, so the player slides along walls.
    if (this.world.canMove(p.x + dx, p.z, PLAYER_TUNING.radius)) p.x += dx;
    if (this.world.canMove(p.x, p.z + dz, PLAYER_TUNING.radius)) p.z += dz;
    p.vy -= PLAYER_TUNING.gravity * dt;
    p.feet = Math.max(0, p.feet + p.vy * dt);
    if (p.feet === 0 && p.vy < 0) p.vy = 0;
    p.vx = (p.x - p.prevX) / dt;
    p.vz = (p.z - p.prevZ) / dt;

    this.moving = Math.hypot(p.x - p.prevX, p.z - p.prevZ) > 0.0001;
    this.stepTimer -= dt;
    if (this.moving && p.feet === 0 && this.stepTimer <= 0) {
      this.sound.play('step');
      this.stepTimer = PLAYER_TUNING.stepInterval;
    }
    if (!this.moving) this.stepTimer = Math.min(this.stepTimer, 0.12);
  }
}

/** Eye position, interpolated between the last two simulation steps. */
export function eyePosition(p: PlayerState, alpha: number, target: THREE.Vector3): THREE.Vector3 {
  return target.set(
    p.prevX + (p.x - p.prevX) * alpha,
    PLAYER_TUNING.eyeHeight + p.prevFeet + (p.feet - p.prevFeet) * alpha,
    p.prevZ + (p.z - p.prevZ) * alpha,
  );
}

/** Unit vector the player is looking along (camera rotation order YXZ). */
export function viewDirection(p: PlayerState, target: THREE.Vector3): THREE.Vector3 {
  const cos = Math.cos(p.pitch);
  return target.set(-Math.sin(p.yaw) * cos, Math.sin(p.pitch), -Math.cos(p.yaw) * cos);
}

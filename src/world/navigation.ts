import type { EnemyType } from '../config/enemies.ts';
import { SIGHT_RANGE } from '../config/enemies.ts';
import { MAP_HEIGHT, MAP_WIDTH, tileBlocked, tileCenter, worldToTile } from './level.ts';
import type { Level } from './level.ts';

export interface Obstacle {
  x: number;
  z: number;
  radius: number;
}
export interface Waypoint {
  x: number;
  z: number;
}
export type Tactic = 'investigate' | 'chase' | 'attack' | 'retreat' | 'strafe';

const NEIGHBOURS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export function intersectsObstacle(
  x: number,
  z: number,
  radius: number,
  obstacles: readonly Obstacle[] = [],
): boolean {
  return obstacles.some((o) => Math.hypot(x - o.x, z - o.z) < radius + o.radius);
}

export function clearOfObstacles(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  obstacles: readonly Obstacle[] = [],
): boolean {
  const dx = bx - ax;
  const dz = bz - az;
  const lengthSq = dx * dx + dz * dz;
  return !obstacles.some((o) => {
    const t = lengthSq
      ? Math.max(0, Math.min(1, ((o.x - ax) * dx + (o.z - az) * dz) / lengthSq))
      : 0;
    return Math.hypot(ax + dx * t - o.x, az + dz * t - o.z) < o.radius;
  });
}

/**
 * Breadth-first search over walkable tiles. Four-way movement cannot cut
 * across the corners of closed doors or walls.
 */
export function findPath(
  level: Level,
  fromX: number,
  fromZ: number,
  toX: number,
  toZ: number,
  openDoors: ReadonlySet<string>,
  obstacles: readonly Obstacle[] = [],
): Waypoint[] {
  const sx = worldToTile(fromX);
  const sz = worldToTile(fromZ);
  const tx = worldToTile(toX);
  const tz = worldToTile(toZ);
  if (tileBlocked(level, sx, sz, openDoors) || tileBlocked(level, tx, tz, openDoors)) return [];
  const start = sz * MAP_WIDTH + sx;
  const target = tz * MAP_WIDTH + tx;
  const previous = new Int32Array(MAP_WIDTH * MAP_HEIGHT).fill(-1);
  const queue = new Int32Array(previous.length);
  let read = 0;
  let write = 0;
  queue[write++] = start;
  previous[start] = start;
  while (read < write && previous[target] < 0) {
    const current = queue[read++];
    const x = current % MAP_WIDTH;
    const z = Math.floor(current / MAP_WIDTH);
    for (const [ox, oz] of NEIGHBOURS) {
      const nx = x + ox;
      const nz = z + oz;
      if (nx < 0 || nz < 0 || nx >= MAP_WIDTH || nz >= MAP_HEIGHT) continue;
      const index = nz * MAP_WIDTH + nx;
      if (previous[index] !== -1 || tileBlocked(level, nx, nz, openDoors)) continue;
      if (index !== target && intersectsObstacle(tileCenter(nx), tileCenter(nz), 0.7, obstacles))
        continue;
      previous[index] = current;
      queue[write++] = index;
    }
  }
  if (previous[target] < 0) return [];
  const route: Waypoint[] = [];
  for (let index = target; index !== start; index = previous[index]) {
    route.push({ x: tileCenter(index % MAP_WIDTH), z: tileCenter(Math.floor(index / MAP_WIDTH)) });
  }
  return route.reverse();
}

export interface SightQuery {
  dx: number;
  dz: number;
  /** Enemy yaw. Enemies face local +Z. */
  facing: number;
  /** True when nothing blocks the line between enemy and player. */
  visible: boolean;
  alert: boolean;
  range?: number;
}

export function detectsPlayer({
  dx,
  dz,
  facing,
  visible,
  alert,
  range = SIGHT_RANGE,
}: SightQuery): boolean {
  const distance = Math.hypot(dx, dz);
  if (!visible || distance > range) return false;
  if (alert || distance < 7) return true;
  // Outside their peripheral vision, shots can still alert them.
  return (Math.sin(facing) * dx + Math.cos(facing) * dz) / distance > 0.15;
}

export function chooseTactic(type: EnemyType, distance: number, hasSight: boolean): Tactic {
  if (!hasSight) return 'investigate';
  if (type === 'runner') return distance > 1.8 ? 'chase' : 'attack';
  const ideal = type === 'tank' ? 8 : type === 'boss' ? 11 : 13;
  if (distance > ideal + 2) return 'chase';
  if (distance < ideal * 0.48 && type !== 'tank' && type !== 'boss') return 'retreat';
  return 'strafe';
}

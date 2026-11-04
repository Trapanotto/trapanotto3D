import type { EnemyType } from '../config/enemies.ts';
import type { AmmoType, WeaponId } from '../config/weapons.ts';

export const TILE = 4;
export const MAP_WIDTH = 49;
export const MAP_HEIGHT = 46;
export const WALL_HEIGHT = 5;

export type Area = 'arrival' | 'hub' | 'foundry' | 'service' | 'archive' | 'reactor';
export type KeyColor = 'red' | 'yellow';
export type PickupType =
  'health' | 'armor' | AmmoType | Exclude<WeaponId, 'fist' | 'pistol'> | KeyColor;

export interface Door {
  id: string;
  kind: 'key' | 'secret';
  key?: KeyColor;
  cells: [number, number][];
  /** Axis the door panel faces along. */
  axis: 'x' | 'z';
}

export interface TilePoint {
  x: number;
  z: number;
}

export interface Level {
  cells: (Area | null)[][];
  doorLookup: Map<string, string>;
}

// Rectangles of walkable tiles: x0, z0, x1, z1 (inclusive), area.
const ROOMS: [number, number, number, number, Area][] = [
  [22, 2, 28, 8, 'arrival'],
  [24, 8, 26, 15, 'arrival'],
  [18, 14, 32, 24, 'hub'],
  [14, 18, 18, 20, 'hub'],
  [4, 12, 14, 24, 'foundry'],
  [5, 24, 7, 28, 'service'],
  [2, 27, 12, 34, 'service'],
  [12, 30, 19, 32, 'service'],
  [18, 23, 20, 32, 'service'],
  [32, 18, 36, 20, 'archive'],
  [36, 11, 46, 23, 'archive'],
  [24, 24, 26, 35, 'reactor'],
  [20, 34, 30, 43, 'reactor'],
  [30, 3, 35, 7, 'arrival'],
  [28, 5, 30, 5, 'arrival'],
  [1, 16, 2, 20, 'foundry'],
  [2, 18, 4, 18, 'foundry'],
  [39, 4, 44, 8, 'archive'],
  [41, 8, 41, 11, 'archive'],
];

export const DOORS: Door[] = [
  {
    id: 'red',
    kind: 'key',
    key: 'red',
    cells: [
      [34, 18],
      [34, 19],
      [34, 20],
    ],
    axis: 'x',
  },
  {
    id: 'yellow',
    kind: 'key',
    key: 'yellow',
    cells: [
      [24, 29],
      [25, 29],
      [26, 29],
    ],
    axis: 'z',
  },
  { id: 'secret-arrival', kind: 'secret', cells: [[29, 5]], axis: 'x' },
  { id: 'secret-foundry', kind: 'secret', cells: [[3, 18]], axis: 'x' },
  { id: 'secret-archive', kind: 'secret', cells: [[41, 10]], axis: 'z' },
];
export const SECRET_COUNT = DOORS.filter((door) => door.kind === 'secret').length;

export const SPAWN: TilePoint = { x: 25, z: 5 };
export const CHECKPOINT: TilePoint = { x: 25, z: 32 };
export const EXIT: TilePoint = { x: 25, z: 42 };

export const ENEMY_SPAWNS: [EnemyType, number, number][] = [
  ['guard', 25, 7],
  ['runner', 24, 12],
  ['guard', 21, 16],
  ['runner', 29, 22],
  ['drone', 30, 16],
  ['runner', 13, 19],
  ['guard', 11, 15],
  ['runner', 7, 14],
  ['guard', 6, 21],
  ['tank', 9, 18],
  ['runner', 12, 22],
  ['runner', 6, 29],
  ['drone', 10, 31],
  ['guard', 4, 33],
  ['runner', 16, 31],
  ['drone', 19, 27],
  ['guard', 37, 19],
  ['runner', 39, 20],
  ['guard', 40, 14],
  ['drone', 44, 13],
  ['tank', 44, 20],
  ['runner', 38, 16],
  ['guard', 43, 17],
  ['runner', 45, 22],
  ['guard', 41, 22],
  ['guard', 25, 27],
  ['runner', 23, 35],
  ['drone', 28, 36],
  ['boss', 25, 40],
];

/** type, tile x, tile z, and the secret door that hides it (if any). */
export const PICKUP_SPAWNS: [PickupType, number, number, string?][] = [
  ['health', 23, 4],
  ['bullets', 27, 7],
  ['armor', 32, 5, 'secret-arrival'],
  ['bullets', 34, 5, 'secret-arrival'],
  ['health', 20, 21],
  ['armor', 30, 15],
  ['bullets', 19, 18],
  ['shotgun', 8, 19],
  ['shells', 12, 14],
  ['health', 5, 15],
  ['red', 6, 23],
  ['armor', 2, 17, 'secret-foundry'],
  ['shells', 2, 19, 'secret-foundry'],
  ['health', 4, 30],
  ['rockets', 11, 33],
  ['bullets', 17, 31],
  ['nailgun', 39, 13],
  ['nails', 45, 15],
  ['health', 38, 22],
  ['yellow', 45, 21],
  ['armor', 43, 19],
  ['launcher', 42, 6, 'secret-archive'],
  ['rockets', 40, 6, 'secret-archive'],
  ['launcher', 23, 35],
  ['rockets', 27, 35],
  ['health', 21, 36],
  ['armor', 29, 36],
  ['shells', 21, 41],
  ['nails', 29, 41],
];

/** Tile rectangles that trigger mission events: x0, z0, x1, z1 (inclusive). */
export const TRIGGERS = {
  checkpoint: [24, 32, 26, 33],
  bossArena: [20, 34, 30, 45],
} satisfies Record<string, [number, number, number, number]>;

export function createLevel(): Level {
  const cells: (Area | null)[][] = Array.from({ length: MAP_HEIGHT }, () =>
    Array<Area | null>(MAP_WIDTH).fill(null),
  );
  for (const [x0, z0, x1, z1, area] of ROOMS) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) cells[z][x] = area;
  }
  const doorLookup = new Map<string, string>();
  for (const door of DOORS) for (const [x, z] of door.cells) doorLookup.set(`${x},${z}`, door.id);
  return { cells, doorLookup };
}

export function tileBlocked(
  level: Level,
  x: number,
  z: number,
  openDoors: ReadonlySet<string> = new Set(),
): boolean {
  if (x < 0 || z < 0 || x >= MAP_WIDTH || z >= MAP_HEIGHT || !level.cells[z][x]) return true;
  const door = level.doorLookup.get(`${x},${z}`);
  return Boolean(door && !openDoors.has(door));
}

export function worldToTile(value: number): number {
  return Math.floor(value / TILE);
}
export function tileCenter(value: number): number {
  return (value + 0.5) * TILE;
}

export function areaAt(level: Level, x: number, z: number): Area | null {
  return level.cells[worldToTile(z)]?.[worldToTile(x)] ?? null;
}

export function inTileRect(
  [x0, z0, x1, z1]: readonly [number, number, number, number],
  worldX: number,
  worldZ: number,
): boolean {
  const tx = worldToTile(worldX);
  const tz = worldToTile(worldZ);
  return tx >= x0 && tx <= x1 && tz >= z0 && tz <= z1;
}

export function canStand(
  level: Level,
  x: number,
  z: number,
  radius: number,
  openDoors?: ReadonlySet<string>,
): boolean {
  return ![
    [x - radius, z - radius],
    [x + radius, z - radius],
    [x - radius, z + radius],
    [x + radius, z + radius],
  ].some(([px, pz]) => tileBlocked(level, worldToTile(px), worldToTile(pz), openDoors));
}

export function lineClear(
  level: Level,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  openDoors?: ReadonlySet<string>,
): boolean {
  const length = Math.hypot(bx - ax, bz - az);
  const steps = Math.ceil(length / 0.7);
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const tx = worldToTile(ax + (bx - ax) * t);
    const tz = worldToTile(az + (bz - az) * t);
    if (tileBlocked(level, tx, tz, openDoors)) return false;
  }
  return true;
}

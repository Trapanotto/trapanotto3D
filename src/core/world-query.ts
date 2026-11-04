import { canStand, lineClear, tileBlocked, worldToTile, WALL_HEIGHT } from '../world/level.ts';
import type { Level } from '../world/level.ts';
import { clearOfObstacles, intersectsObstacle } from '../world/navigation.ts';
import type { Obstacle } from '../world/navigation.ts';

/** Collision and visibility questions about the static world and its doors. */
export class WorldQuery {
  readonly level: Level;
  /** Mutated in place when doors open, so every system sees the same set. */
  readonly openDoors: Set<string>;
  obstacles: Obstacle[];

  constructor(level: Level, obstacles: Obstacle[] = [], openDoors = new Set<string>()) {
    this.level = level;
    this.obstacles = obstacles;
    this.openDoors = openDoors;
  }

  canMove(x: number, z: number, radius: number): boolean {
    return (
      canStand(this.level, x, z, radius, this.openDoors) &&
      !intersectsObstacle(x, z, radius, this.obstacles)
    );
  }

  /** Line of sight at body height: blocked by walls, closed doors and machinery. */
  canSee(ax: number, az: number, bx: number, bz: number): boolean {
    return (
      lineClear(this.level, ax, az, bx, bz, this.openDoors) &&
      clearOfObstacles(ax, az, bx, bz, this.obstacles)
    );
  }

  /** Only walls and doors. Sound carries past machinery. */
  wallsClear(ax: number, az: number, bx: number, bz: number): boolean {
    return lineClear(this.level, ax, az, bx, bz, this.openDoors);
  }

  /** True when a point is inside a wall, the floor, the ceiling, a closed door or a machine. */
  solidAt(x: number, y: number, z: number, radius = 0): boolean {
    return (
      y < 0.05 ||
      y > WALL_HEIGHT - 0.05 ||
      tileBlocked(this.level, worldToTile(x), worldToTile(z), this.openDoors) ||
      intersectsObstacle(x, z, radius, this.obstacles)
    );
  }
}

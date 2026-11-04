import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLevel,
  tileCenter,
  tileBlocked,
  worldToTile,
  ENEMY_SPAWNS,
  PICKUP_SPAWNS,
  DOORS,
  SPAWN,
} from '../src/world/level.ts';
import {
  findPath,
  detectsPlayer,
  chooseTactic,
  intersectsObstacle,
  clearOfObstacles,
} from '../src/world/navigation.ts';
import { INDUSTRY_OBSTACLES } from '../src/world/layout.ts';

const level = createLevel();
const point = (n: number) => tileCenter(n);

test('pursuit takes a legal route around walls', () => {
  const route = findPath(level, point(25), point(5), point(6), point(23), new Set());
  assert.ok(route.length > 20, 'the foundry cannot be reached in a straight line');
  assert.deepEqual(route.at(-1), { x: point(6), z: point(23) });
  for (const p of route)
    assert.equal(tileBlocked(level, worldToTile(p.x), worldToTile(p.z), new Set()), false);
});

test('pursuit respects locked doors and updates after a door opens', () => {
  const start: [number, number] = [point(33), point(19)],
    target: [number, number] = [point(37), point(19)];
  assert.deepEqual(findPath(level, ...start, ...target, new Set()), []);
  const path = findPath(level, ...start, ...target, new Set(['red']));
  assert.ok(path.some((p) => worldToTile(p.x) === 34));
  assert.deepEqual(path.at(-1), { x: target[0], z: target[1] });
});

test('sight respects obstacles, range and peripheral vision, but alert enemies track behind them', () => {
  const sight = { dx: 0, dz: 15, facing: 0, visible: true, alert: false };
  assert.equal(detectsPlayer(sight), true);
  assert.equal(detectsPlayer({ ...sight, dz: -15 }), false);
  assert.equal(detectsPlayer({ ...sight, dz: -15, alert: true }), true);
  assert.equal(detectsPlayer({ ...sight, visible: false, alert: true }), false);
  assert.equal(detectsPlayer({ ...sight, dz: 50 }), false);
});

test('enemy types choose different tactics and investigate lost targets', () => {
  assert.equal(chooseTactic('runner', 9, true), 'chase');
  assert.equal(chooseTactic('guard', 9, true), 'strafe');
  assert.equal(chooseTactic('guard', 3, true), 'retreat');
  assert.equal(chooseTactic('tank', 3, true), 'strafe');
  assert.equal(chooseTactic('guard', 9, false), 'investigate');
});

test('machinery blocks movement and sight but can be navigated around', () => {
  const obstacles = [{ x: point(25), z: point(6), radius: 1 }];
  assert.equal(intersectsObstacle(point(25), point(6), 0.4, obstacles), true);
  assert.equal(clearOfObstacles(point(25), point(5), point(25), point(7), obstacles), false);
  assert.equal(clearOfObstacles(point(24), point(5), point(24), point(7), obstacles), true);
  const route = findPath(level, point(25), point(5), point(25), point(7), new Set(), obstacles);
  assert.ok(route.length > 2);
  assert.equal(
    route.some((p) => p.x === point(25) && p.z === point(6)),
    false,
  );
});

test('machinery leaves spawns and mission items reachable', () => {
  const open = new Set(DOORS.map((door) => door.id));
  for (const [type, x, z] of [...ENEMY_SPAWNS, ...PICKUP_SPAWNS]) {
    assert.equal(
      intersectsObstacle(point(x), point(z), 0.42, INDUSTRY_OBSTACLES),
      false,
      `${type} at ${x},${z} is clear`,
    );
    const route = findPath(
      level,
      point(SPAWN.x),
      point(SPAWN.z),
      point(x),
      point(z),
      open,
      INDUSTRY_OBSTACLES,
    );
    assert.ok(
      route.length > 0 || (x === SPAWN.x && z === SPAWN.z),
      `${type} at ${x},${z} is reachable`,
    );
  }
});

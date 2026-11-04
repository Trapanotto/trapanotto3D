import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLevel,
  tileBlocked,
  SPAWN,
  DOORS,
  ENEMY_SPAWNS,
  PICKUP_SPAWNS,
} from '../src/world/level.ts';

const level = createLevel();
function reaches(target: [number, number], doors: string[] = []) {
  const open = new Set(doors),
    todo: [number, number][] = [[SPAWN.x, SPAWN.z]],
    seen = new Set<string>();
  while (todo.length) {
    const [x, z] = todo.shift()!,
      id = `${x},${z}`;
    if (seen.has(id) || tileBlocked(level, x, z, open)) continue;
    if (x === target[0] && z === target[1]) return true;
    seen.add(id);
    todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return false;
}

test('keys gate their intended areas without blocking the critical path', () => {
  assert.equal(reaches([6, 23]), true, 'red key is reachable');
  assert.equal(reaches([45, 21]), false, 'archive is locked initially');
  assert.equal(reaches([45, 21], ['red']), true, 'red key unlocks yellow key');
  assert.equal(reaches([25, 40], ['red']), false, 'reactor requires yellow key');
  assert.equal(reaches([25, 40], ['red', 'yellow']), true, 'both keys unlock the boss');
});

test('all enemies and pickups are on walkable tiles', () => {
  for (const [, x, z] of [...ENEMY_SPAWNS, ...PICKUP_SPAWNS]) {
    assert.equal(
      tileBlocked(level, x, z, new Set(DOORS.map((d) => d.id))),
      false,
      `blocked spawn at ${x},${z}`,
    );
  }
});

test('each secret can be reached only when its hidden door opens', () => {
  const base = ['red', 'yellow'];
  const secrets: [string, [number, number]][] = [
    ['secret-arrival', [32, 5]],
    ['secret-foundry', [2, 17]],
    ['secret-archive', [42, 6]],
  ];
  for (const [door, target] of secrets) {
    assert.equal(reaches(target, base), false, `${door} is hidden`);
    assert.equal(reaches(target, [...base, door]), true, `${door} opens`);
  }
});

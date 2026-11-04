import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnemySystem } from '../src/ai/enemy-system.ts';
import type { Enemy, EnemyDeps } from '../src/ai/enemy-system.ts';
import { AI } from '../src/ai/tuning.ts';
import type { EnemyType } from '../src/config/enemies.ts';
import { WorldQuery } from '../src/core/world-query.ts';
import { createPlayer } from '../src/player/player.ts';
import type { SoundId } from '../src/audio/audio.ts';
import { createLevel, tileCenter } from '../src/world/level.ts';

const STEP = 1 / 60;

function scenario(obstacles = [{ x: tileCenter(25), z: tileCenter(7), radius: 1 }]) {
  const world = new WorldQuery(createLevel(), obstacles);
  const player = createPlayer(tileCenter(25), tileCenter(9));
  const log = { shots: 0, playerDamage: 0, sounds: [] as SoundId[] };
  const deps: EnemyDeps = {
    world,
    player,
    container: new THREE.Group(),
    createModel: () => ({
      group: new THREE.Group(),
      parts: {},
      legBase: { left: 0, right: 0 },
      radius: 0.53,
      height: 1.9,
      materials: [],
      hover: false,
    }),
    shoot: () => log.shots++,
    damagePlayer: (amount) => (log.playerDamage += amount),
    sound: (id) => log.sounds.push(id),
    sparks: () => {},
    message: () => {},
    difficulty: () => 'normal',
  };
  const system = new EnemySystem(deps);
  const spawn = (type: EnemyType, tx: number, tz: number, id = system.enemies.length) =>
    system.spawn(type, tileCenter(tx), tileCenter(tz), id);
  const run = (seconds: number, each?: () => void) => {
    for (let t = 0; t < seconds; t += STEP) {
      system.tick(STEP);
      each?.();
    }
  };
  return { world, player, system, spawn, run, log };
}

function hunt(enemy: Enemy, x: number, z: number) {
  enemy.aware = 12;
  enemy.lastSeen = { x, z };
}

test('an alerted guard follows a path around machinery and attacks after regaining sight', () => {
  const { world, player, spawn, run, log } = scenario();
  const guard = spawn('guard', 25, 6, 1);
  hunt(guard, player.x, player.z);
  assert.equal(world.canSee(guard.pos.x, guard.pos.z, player.x, player.z), false);
  let sidestepped = false;
  run(13, () => {
    sidestepped ||= Math.abs(guard.pos.x - tileCenter(25)) > 2;
    assert.equal(
      world.canMove(guard.pos.x, guard.pos.z, guard.model.radius * 0.7),
      true,
      'enemy stays outside obstacles',
    );
  });
  assert.ok(sidestepped, 'guard went around the machine');
  assert.ok(log.shots > 0, 'guard fires after reaching a clear line of sight');
});

test('a wall muffles distant gunfire while nearby shots alert the guard', () => {
  const { system, spawn } = scenario();
  const guard = spawn('guard', 25, 6, 1);
  system.alert(tileCenter(35), tileCenter(5), 60);
  assert.equal(guard.aware, 0);
  system.alert(tileCenter(25), tileCenter(8), 28);
  assert.ok(guard.aware > 0);
  assert.deepEqual(guard.lastSeen, { x: tileCenter(25), z: tileCenter(8) });
});

test('an alerted guard cannot cross a locked door but follows after it opens', () => {
  const { world, player, spawn, run } = scenario([]);
  const guard = spawn('guard', 33, 19, 1);
  player.x = tileCenter(38);
  player.z = tileCenter(19);
  hunt(guard, player.x, player.z);
  run(1.5);
  assert.ok(guard.pos.x < tileCenter(34) - 2, 'closed door blocks pursuit');
  world.openDoors.add('red');
  run(5);
  assert.ok(guard.pos.x > tileCenter(34) - 2, 'guard entered the opened doorway');
});

test('spotting the player costs a reaction delay and alerts nearby allies', () => {
  const { player, spawn, run, log } = scenario([]);
  // Open hall of the hub, guard facing the player.
  player.x = tileCenter(25);
  player.z = tileCenter(20);
  const guard = spawn('guard', 25, 16, 0);
  const ally = spawn('guard', 29, 16, 1);
  ally.yaw = Math.PI; // looking away
  run(0.2);
  assert.ok(log.sounds.includes('alert'), 'guard calls out');
  assert.equal(guard.windup, 0, 'no instant attack');
  assert.ok(ally.aware > 0, 'ally joins in');
  run(2);
  assert.ok(log.shots > 0, 'attacks after the reaction delay');
});

test('only a limited number of enemies attack at the same time', () => {
  const { player, system, spawn, run } = scenario([]);
  player.x = tileCenter(25);
  player.z = tileCenter(19);
  for (let i = 0; i < 5; i++) spawn('guard', 20 + i * 2, 15, i);
  let peak = 0;
  run(6, () => {
    const attacking = system.enemies.filter((e) => e.windup > 0 || e.burstLeft > 0).length;
    peak = Math.max(peak, attacking);
  });
  assert.ok(peak >= 1, 'someone attacks');
  assert.ok(
    peak <= AI.attackTokens.normal,
    `at most ${AI.attackTokens.normal} at once, saw ${peak}`,
  );
});

test('heavy damage during the wind-up staggers the enemy and cancels the attack', () => {
  const { player, system, spawn, run, log } = scenario([]);
  player.x = tileCenter(25);
  player.z = tileCenter(20);
  const guard = spawn('guard', 25, 16, 0);
  guard.attackCooldown = 0;
  for (let t = 0; t < 3 && guard.windup <= 0; t += STEP) system.tick(STEP);
  assert.ok(guard.windup > 0, 'guard winds up an attack');
  system.damage(guard, 30, player);
  assert.ok(guard.stagger > 0, 'stagger');
  assert.equal(guard.windup, 0, 'attack cancelled');
  run(AI.staggerTime.guard * 0.9);
  assert.equal(log.shots, 0, 'no shot while staggered');
});

test('a runner lunges, hits once, then backs off', () => {
  const { player, spawn, run, log } = scenario([]);
  player.x = tileCenter(25);
  player.z = tileCenter(20);
  const runner = spawn('runner', 25, 18, 0);
  runner.attackCooldown = 0;
  let lunged = false;
  let recovered = false;
  run(3, () => {
    lunged ||= runner.lunge > 0;
    recovered ||= runner.recover > 0;
  });
  assert.ok(lunged && recovered);
  assert.ok(log.playerDamage > 0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { FixedLoop } from '../src/core/loop.ts';

test('the simulation advances in equal steps independent of frame time', () => {
  const loop = new FixedLoop(1 / 60);
  const steps: number[] = [];
  let alpha = 0;
  for (let frame = 0; frame < 144; frame++) alpha = loop.advance(1 / 144, (dt) => steps.push(dt));
  assert.ok(Math.abs(steps.length - 60) <= 1, `${steps.length} steps for one second`);
  assert.ok(steps.every((dt) => dt === 1 / 60));
  assert.ok(alpha >= 0 && alpha < 1);
});

test('a long hitch is capped instead of running hundreds of steps', () => {
  const loop = new FixedLoop(1 / 60, 5);
  let steps = 0;
  loop.advance(3, () => steps++);
  assert.equal(steps, 5);
  steps = 0;
  loop.advance(1 / 60, () => steps++);
  assert.ok(steps <= 2, 'backlog was dropped');
});

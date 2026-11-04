import type { EnemyType } from '../config/enemies.ts';
import type { Difficulty } from '../config/tuning.ts';

/** Enemy behaviour numbers. Kept apart from the stat sheet so they can be tuned live. */
export const AI = {
  /** Seconds between first spotting the player and the first attack decision. */
  reactionTime: { easy: 0.85, normal: 0.6, hard: 0.38 } as Record<Difficulty, number>,
  /** How many enemies may attack at the same time (the boss is exempt). */
  attackTokens: { easy: 1, normal: 2, hard: 3 } as Record<Difficulty, number>,
  /** Share of the player's movement enemies aim ahead of. */
  lead: { easy: 0.2, normal: 0.5, hard: 0.8 } as Record<Difficulty, number>,
  /** Aim scatter in metres at 25 m. */
  aimError: 1.1,
  /** Allies within this radius join the fight when one spots the player. */
  shoutRadius: 16,
  turnRate: 7,

  /** Visible charge-up before every attack, in seconds. */
  windup: { runner: 0.38, guard: 0.6, drone: 0.5, tank: 0.85, boss: 0.5 } as Record<
    EnemyType,
    number
  >,
  /** Shots per attack. */
  burst: { runner: 0, guard: 3, drone: 2, tank: 1, boss: 1 } as Record<EnemyType, number>,
  burstInterval: 0.16,

  lungeRange: 4.4,
  lungeSpeed: 10,
  lungeTime: 0.32,
  lungeHitRange: 1.5,
  lungeRecover: 0.65,

  /** Damage within roughly a third of a second that interrupts an enemy. */
  staggerThreshold: { runner: 16, guard: 22, drone: 20, tank: 70, boss: 170 } as Record<
    EnemyType,
    number
  >,
  staggerTime: { runner: 0.45, guard: 0.4, drone: 0.35, tank: 0.3, boss: 0.25 } as Record<
    EnemyType,
    number
  >,
  staggerDecay: 3,

  knockbackPerDamage: 0.16,
  maxKnockback: 6,
  knockbackDecay: 9,

  wanderRadius: 2.2,
  wanderPause: 2.5,
  wanderPace: 0.35,
};

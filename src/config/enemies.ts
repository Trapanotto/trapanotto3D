export type EnemyType = 'runner' | 'guard' | 'drone' | 'tank' | 'boss';

export interface EnemyDef {
  health: number;
  speed: number;
  damage: number;
  /** Seconds between attacks. */
  delay: number;
  /** Seconds of visible wind-up before an attack lands. */
  windup: number;
  /** Runners hit in melee range, everyone else fires projectiles within this range. */
  attackRange: number;
  melee: boolean;
  projectileSpeed: number;
}

export const ENEMIES: Record<EnemyType, EnemyDef> = {
  runner: {
    health: 48,
    speed: 3.6,
    damage: 13,
    delay: 1.05,
    windup: 0.22,
    attackRange: 2.5,
    melee: true,
    projectileSpeed: 0,
  },
  guard: {
    health: 70,
    speed: 2.0,
    damage: 11,
    delay: 1.8,
    windup: 0.3,
    attackRange: 30,
    melee: false,
    projectileSpeed: 10,
  },
  drone: {
    health: 55,
    speed: 2.8,
    damage: 8,
    delay: 1.35,
    windup: 0.3,
    attackRange: 30,
    melee: false,
    projectileSpeed: 10,
  },
  tank: {
    health: 190,
    speed: 1.25,
    damage: 20,
    delay: 2.25,
    windup: 0.48,
    attackRange: 30,
    melee: false,
    projectileSpeed: 10,
  },
  boss: {
    health: 1000,
    speed: 1.5,
    damage: 19,
    delay: 1.45,
    windup: 0.3,
    attackRange: 30,
    melee: false,
    projectileSpeed: 13,
  },
};

/** Second boss phase: faster movement and attacks, three-way volleys. */
export const BOSS_RAGE = {
  healthFraction: 0.5,
  speedMultiplier: 1.3,
  delayMultiplier: 0.7,
  volleySpread: 0.14,
};

export const SIGHT_RANGE = 38;
/** Seconds an enemy keeps hunting after losing sight. */
export const AWARENESS_TIME = 12;

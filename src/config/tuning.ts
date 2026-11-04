// Values the debug panel can change while the game runs.

export const PLAYER_TUNING = {
  speed: 9.2,
  jumpVelocity: 6.8,
  gravity: 18,
  radius: 0.42,
  eyeHeight: 1.65,
  lookSensitivity: 0.0021,
  stepInterval: 0.38,
};

export const LIGHTING = {
  exposure: 1.15,
  hemisphere: 0.5,
  ambient: 0.08,
  environment: 0.16,
  lampIntensity: 4.5,
  torchIntensity: 60,
  fogDensity: 0.015,
  bloomStrength: 0.32,
};

/** Split-toning colour grade: cool shadows, warm highlights. */
export const GRADE = {
  shadowTint: [0.86, 0.97, 1.12] as [number, number, number],
  highlightTint: [1.1, 1.0, 0.86] as [number, number, number],
  contrast: 1.08,
  saturation: 0.9,
};

/** Simulation runs at a fixed rate; rendering interpolates between steps. */
export const SIM_RATE = 60;
export const SIM_STEP = 1 / SIM_RATE;

export const DIFFICULTY_DAMAGE = { easy: 0.68, normal: 1, hard: 1.35 } as const;
export type Difficulty = keyof typeof DIFFICULTY_DAMAGE;

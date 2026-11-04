import type { Difficulty } from './config/tuning.ts';

export type Quality = 'high' | 'performance';

export interface Settings {
  difficulty: Difficulty;
  quality: Quality;
  sensitivity: number;
  fov: number;
  volume: number;
  screenEffects: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  difficulty: 'normal',
  quality: 'high',
  sensitivity: 1,
  fov: 78,
  volume: 45,
  screenEffects: true,
};

const STORAGE_KEY = 'trapanotto3d-settings';

export function loadSettings(): Settings {
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Private mode or blocked storage: settings stay for this session only.
  }
}

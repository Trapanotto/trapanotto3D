import type { AmmoType, WeaponId } from '../config/weapons.ts';
import type { KeyColor } from '../world/level.ts';

/** Everything needed to restart from the checkpoint. */
export interface Snapshot {
  health: number;
  armor: number;
  keys: KeyColor[];
  inventory: WeaponId[];
  ammo: Record<AmmoType, number>;
  weapon: WeaponId;
  openDoors: string[];
  killedIds: number[];
  collectedIds: number[];
  storyEvents: string[];
  secretCount: number;
  killCount: number;
  playTime: number;
}

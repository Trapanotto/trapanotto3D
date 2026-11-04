export type WeaponId = 'fist' | 'pistol' | 'shotgun' | 'nailgun' | 'launcher';
export type AmmoType = 'bullets' | 'shells' | 'nails' | 'rockets';

export interface WeaponDef {
  label: string;
  /** Seconds between shots. */
  delay: number;
  damage: number;
  range: number;
  ammo: AmmoType | null;
  /** Hitscan rays per shot. Zero means the weapon fires a projectile. */
  pellets: number;
  spread: number;
  /** How far enemies hear the shot. Zero for silent weapons. */
  alertRadius: number;
  muzzleFlash: number;
}

export const WEAPONS: Record<WeaponId, WeaponDef> = {
  fist: {
    label: 'STAHLFAUST',
    delay: 0.48,
    damage: 32,
    range: 2.7,
    ammo: null,
    pellets: 1,
    spread: 0,
    alertRadius: 0,
    muzzleFlash: 0,
  },
  pistol: {
    label: 'SCHROTTREVOLVER',
    delay: 0.26,
    damage: 23,
    range: 75,
    ammo: 'bullets',
    pellets: 1,
    spread: 0,
    alertRadius: 28,
    muzzleFlash: 0.07,
  },
  shotgun: {
    label: 'PUMP-SCHROTFLINTE',
    delay: 0.83,
    damage: 9,
    range: 36,
    ammo: 'shells',
    pellets: 8,
    spread: 0.075,
    alertRadius: 38,
    muzzleFlash: 0.07,
  },
  nailgun: {
    label: 'NAGELWERFER',
    delay: 0.095,
    damage: 9,
    range: 60,
    ammo: 'nails',
    pellets: 1,
    spread: 0.012,
    alertRadius: 28,
    muzzleFlash: 0.07,
  },
  launcher: {
    label: 'RAKETENWERFER',
    delay: 0.9,
    damage: 120,
    range: 70,
    ammo: 'rockets',
    pellets: 0,
    spread: 0,
    alertRadius: 38,
    muzzleFlash: 0.07,
  },
};

export const WEAPON_ORDER: WeaponId[] = ['fist', 'pistol', 'shotgun', 'nailgun', 'launcher'];

export const AMMO_CAPS: Record<AmmoType, number> = {
  bullets: 180,
  shells: 60,
  nails: 300,
  rockets: 30,
};
export const AMMO_PICKUP: Record<AmmoType, number> = {
  bullets: 36,
  shells: 12,
  nails: 75,
  rockets: 6,
};
/** Ammo that comes with a newly found weapon. */
export const WEAPON_PICKUP_AMMO: Partial<Record<WeaponId, number>> = {
  shotgun: 16,
  nailgun: 100,
  launcher: 6,
};

export const STARTING_AMMO: Record<AmmoType, number> = {
  bullets: 72,
  shells: 0,
  nails: 0,
  rockets: 0,
};

export const ROCKET_SPEED = 22;
export const ROCKET_LIFETIME = 4;
export const EXPLOSION_RADIUS = 4;

export function isWeaponId(value: string): value is WeaponId {
  return value in WEAPONS;
}

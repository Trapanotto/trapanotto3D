import { tileCenter } from './level.ts';
import type { Obstacle } from './navigation.ts';

export type IndustryModel = 'crane' | 'compressor' | 'welder' | 'cart' | 'toolchest' | 'drill';

/** model, tile x, tile z, rotation, scale, collision radius, elevation */
export type IndustryPlacement = [IndustryModel, number, number, number, number, number, number?];

export const INDUSTRY_PLACEMENTS: IndustryPlacement[] = [
  ['crane', 25, 5, 0, 1.15, 0, 2.75],
  ['compressor', 22.9, 6.8, 0.3, 1, 0.9],
  ['welder', 27.2, 3.3, -0.3, 1, 0.55],
  ['cart', 27.4, 6.2, 0.15, 1, 0.65],
  ['toolchest', 22.6, 3.4, 0.2, 1, 0.48],
  ['drill', 19.1, 22, 0.25, 1, 0.55],
  ['compressor', 29.4, 20.5, 0.8, 1, 0.9],
  ['cart', 20.2, 16.4, 0.8, 1, 0.65],
  ['toolchest', 31, 22.6, 1, 1, 0.48],
  ['crane', 8, 17, 0, 1.25, 0, 2.6],
  ['drill', 12.8, 13.5, -0.2, 1, 0.55],
  ['welder', 10.6, 22.4, 0.8, 1, 0.55],
  ['compressor', 5.3, 18.7, 0.4, 1, 0.9],
  ['cart', 3.2, 31.4, 0.5, 1, 0.65],
  ['toolchest', 11.1, 28.7, 0.2, 1, 0.48],
  ['drill', 37.4, 13.5, 0.6, 1, 0.55],
  ['cart', 44.2, 16.3, 1.2, 1, 0.65],
  ['toolchest', 39, 22, 0.8, 1, 0.48],
  ['compressor', 28.5, 38, 0.7, 1, 0.9],
  ['welder', 21.5, 40, 0.5, 1, 0.55],
  ['crane', 25, 40, 0, 1.15, 0, 2.75],
];

export const INDUSTRY_OBSTACLES: Obstacle[] = INDUSTRY_PLACEMENTS.filter(
  ([, , , , , radius]) => radius > 0,
).map(([, x, z, , scale, radius]) => ({
  x: tileCenter(x),
  z: tileCenter(z),
  radius: radius * scale,
}));

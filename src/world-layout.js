import { tileCenter } from './level.js';

// name, tile x/z, rotation, scale, collision radius, elevation
export const INDUSTRY_PLACEMENTS = [
  ['crane',25,5,0,1.15,0,2.75],
  ['compressor',22.9,6.8,.3,1,.9], ['welder',27.2,3.3,-.3,1,.55],
  ['cart',27.4,6.2,.15,1,.65], ['toolchest',22.6,3.4,.2,1,.48],
  ['drill',19.1,22,.25,1,.55], ['compressor',29.4,20.5,.8,1,.9],
  ['cart',20.2,16.4,.8,1,.65], ['toolchest',31,22.6,1,1,.48],
  ['crane',8,17,0,1.25,0,2.6], ['drill',12.8,13.5,-.2,1,.55],
  ['welder',10.6,22.4,.8,1,.55], ['compressor',5.3,18.7,.4,1,.9],
  ['cart',3.2,31.4,.5,1,.65], ['toolchest',11.1,28.7,.2,1,.48],
  ['drill',37.4,13.5,.6,1,.55], ['cart',44.2,16.3,1.2,1,.65],
  ['toolchest',39,22,.8,1,.48], ['compressor',28.5,38,.7,1,.9],
  ['welder',21.5,40,.5,1,.55], ['crane',25,40,0,1.15,0,2.75]
];

export const INDUSTRY_OBSTACLES = INDUSTRY_PLACEMENTS
  .filter(([, , , , , radius]) => radius > 0)
  .map(([,x,z,,scale,radius]) => ({x:tileCenter(x),z:tileCenter(z),radius:radius*scale}));

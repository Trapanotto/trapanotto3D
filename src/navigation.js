import { MAP_HEIGHT, MAP_WIDTH, tileBlocked, tileCenter, worldToTile } from './level.js';

// Four-way navigation cannot cut across the corners of closed doors or walls.
export function intersectsObstacle(x, z, radius, obstacles = []) {
  return obstacles.some(obstacle => Math.hypot(x-obstacle.x, z-obstacle.z) < radius+obstacle.radius);
}

export function clearOfObstacles(ax, az, bx, bz, obstacles = []) {
  const dx=bx-ax,dz=bz-az,length=dx*dx+dz*dz;
  return !obstacles.some(obstacle=>{
    const t=length?Math.max(0,Math.min(1,((obstacle.x-ax)*dx+(obstacle.z-az)*dz)/length)):0;
    return Math.hypot(ax+dx*t-obstacle.x,az+dz*t-obstacle.z)<obstacle.radius;
  });
}

export function findPath(level, fromX, fromZ, toX, toZ, openDoors, obstacles = []) {
  const sx = worldToTile(fromX), sz = worldToTile(fromZ);
  const tx = worldToTile(toX), tz = worldToTile(toZ);
  if (tileBlocked(level, sx, sz, openDoors) || tileBlocked(level, tx, tz, openDoors)) return [];
  const start = sz * MAP_WIDTH + sx, target = tz * MAP_WIDTH + tx;
  const previous = new Int32Array(MAP_WIDTH * MAP_HEIGHT).fill(-1);
  const queue = new Int32Array(previous.length);
  let read = 0, write = 0;
  queue[write++] = start;
  previous[start] = start;
  while (read < write && previous[target] < 0) {
    const current = queue[read++], x = current % MAP_WIDTH, z = Math.floor(current / MAP_WIDTH);
    for (const [nx, nz] of [[x+1,z], [x-1,z], [x,z+1], [x,z-1]]) {
      if (nx < 0 || nz < 0 || nx >= MAP_WIDTH || nz >= MAP_HEIGHT) continue;
      const index = nz * MAP_WIDTH + nx;
      if (previous[index] !== -1 || tileBlocked(level, nx, nz, openDoors)) continue;
      if (index !== target && intersectsObstacle(tileCenter(nx),tileCenter(nz),.7,obstacles)) continue;
      previous[index] = current;
      queue[write++] = index;
    }
  }
  if (previous[target] < 0) return [];
  const route = [];
  for (let index = target; index !== start; index = previous[index]) {
    route.push({x: tileCenter(index % MAP_WIDTH), z: tileCenter(Math.floor(index / MAP_WIDTH))});
  }
  return route.reverse();
}

export function detectsPlayer({ dx, dz, facing, visible, alert, range = 38 }) {
  const distance = Math.hypot(dx, dz);
  if (!visible || distance > range) return false;
  if (alert || distance < 7) return true;
  // Enemies face local +Z. Outside their peripheral vision, shots can still alert them.
  return (Math.sin(facing) * dx + Math.cos(facing) * dz) / distance > .15;
}

export function chooseTactic(type, distance, hasSight) {
  if (!hasSight) return 'investigate';
  if (type === 'runner') return distance > 1.8 ? 'chase' : 'attack';
  const ideal = type === 'tank' ? 8 : type === 'boss' ? 11 : 13;
  if (distance > ideal + 2) return 'chase';
  if (distance < ideal * .48 && type !== 'tank' && type !== 'boss') return 'retreat';
  return 'strafe';
}

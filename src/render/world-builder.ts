import * as THREE from 'three';
import { DOORS, MAP_HEIGHT, MAP_WIDTH, TILE, WALL_HEIGHT, tileCenter } from '../world/level.ts';
import type { Area, Level } from '../world/level.ts';
import { INDUSTRY_OBSTACLES, INDUSTRY_PLACEMENTS } from '../world/layout.ts';
import type { Obstacle } from '../world/navigation.ts';
import type { GameAssets } from './assets.ts';

interface AreaStyle {
  wall: number;
  tint: number;
  /** Ceiling lamp colour. Sodium orange in work halls, cold light in tunnels and archive. */
  lamp: number;
  lampPower: number;
}

const AREA_STYLE: Record<Area, AreaStyle> = {
  arrival: { wall: 0x45504f, tint: 0xc6d0cc, lamp: 0xa9c4dd, lampPower: 22 },
  hub: { wall: 0x495452, tint: 0xc8d1c6, lamp: 0xffae5a, lampPower: 24 },
  foundry: { wall: 0x59483e, tint: 0xe2b5a2, lamp: 0xff7a32, lampPower: 36 },
  service: { wall: 0x3b4e4a, tint: 0xb9d2c3, lamp: 0x8fbfd0, lampPower: 20 },
  archive: { wall: 0x3d4d50, tint: 0xbcd2d6, lamp: 0xd2dde0, lampPower: 22 },
  reactor: { wall: 0x45454b, tint: 0xd4c2bf, lamp: 0xff5238, lampPower: 26 },
};

export interface Lamp {
  light: THREE.PointLight;
  baseIntensity: number;
}

export interface BuiltWorld {
  group: THREE.Group;
  doors: Record<string, THREE.Group>;
  obstacles: Obstacle[];
  lamps: Lamp[];
}

function seeded(n: number): number {
  const x = Math.sin(n * 127.1 + 17.47) * 43758.5453;
  return x - Math.floor(x);
}

function instanceBoxes(
  group: THREE.Group,
  positions: [number, number, number][],
  material: THREE.Material,
  geometry: THREE.BufferGeometry,
): THREE.InstancedMesh | null {
  if (!positions.length) return null;
  const mesh = new THREE.InstancedMesh(geometry, material, positions.length);
  const matrix = new THREE.Matrix4();
  const colour = new THREE.Color();
  positions.forEach(([x, y, z], i) => {
    mesh.setMatrixAt(i, matrix.makeTranslation(x, y, z));
    const shade = 0.82 + seeded(i * 1.7 + x + z) * 0.18;
    mesh.setColorAt(i, colour.setScalar(shade));
  });
  mesh.instanceMatrix.needsUpdate = true;
  mesh.receiveShadow = true;
  group.add(mesh);
  return mesh;
}

interface BoxOptions {
  roughness?: number;
  metalness?: number;
  emissive?: number;
  emissiveIntensity?: number;
}

function box(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: number,
  options: BoxOptions = {},
): THREE.Mesh {
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: options.roughness ?? 0.86,
    metalness: options.metalness ?? 0.2,
    emissive: options.emissive ?? 0,
    emissiveIntensity: options.emissiveIntensity ?? 1,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinder(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  color: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 8),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.45 }),
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function sign(
  parent: THREE.Object3D,
  text: string,
  x: number,
  y: number,
  z: number,
  width = 4,
  options: { red?: boolean; rotation?: number } = {},
): void {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const c = canvas.getContext('2d');
  if (!c) return;
  c.fillStyle = options.red ? '#a83930' : '#202a29';
  c.fillRect(0, 0, 512, 128);
  c.fillStyle = options.red ? '#e89a84' : '#d8dccc';
  c.fillRect(0, 0, 12, 128);
  c.font = 'bold 51px Arial';
  c.textBaseline = 'middle';
  c.fillText(text, 30, 66, 460);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(width, width / 4),
    new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = options.rotation ?? Math.PI;
  parent.add(mesh);
}

function hazard(parent: THREE.Object3D, x: number, y: number, z: number, w: number, d: number) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  box(group, 0, 0, 0, w, 0.035, d, 0xb48b41, { emissive: 0x3b2505 });
  const count = Math.floor(w / 0.75);
  for (let i = -count; i <= count; i++) {
    const stripe = box(group, i * 0.75, 0.022, 0, 0.32, 0.02, d, 0x20221e);
    stripe.rotation.y = 0.5;
  }
  parent.add(group);
}

function enableShadows(object: THREE.Object3D): THREE.Object3D {
  object.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = true;
      node.receiveShadow = true;
    }
  });
  return object;
}

function buildShell(group: THREE.Group, level: Level, assets: GameAssets) {
  const wallGeo = new THREE.BoxGeometry(TILE, WALL_HEIGHT, TILE);
  const floorGeo = new THREE.BoxGeometry(TILE, 0.12, TILE);
  const ceilingGeo = new THREE.BoxGeometry(TILE, 0.08, TILE);
  const byArea = {} as Record<
    Area,
    {
      walls: [number, number, number][];
      floors: [number, number, number][];
      ceilings: [number, number, number][];
    }
  >;
  for (const area of Object.keys(AREA_STYLE) as Area[])
    byArea[area] = { walls: [], floors: [], ceilings: [] };
  for (let z = 0; z < MAP_HEIGHT; z++)
    for (let x = 0; x < MAP_WIDTH; x++) {
      const area = level.cells[z][x];
      const wx = tileCenter(x);
      const wz = tileCenter(z);
      if (area) {
        byArea[area].floors.push([wx, -0.06, wz]);
        byArea[area].ceilings.push([wx, WALL_HEIGHT + 0.04, wz]);
        continue;
      }
      // A solid tile becomes a wall in the style of the first room next to it.
      const neighbours: [number, number][] = [
        [x - 1, z],
        [x + 1, z],
        [x, z - 1],
        [x, z + 1],
      ];
      const adjacent = neighbours.map(([nx, nz]) => level.cells[nz]?.[nx]).find(Boolean);
      if (adjacent) byArea[adjacent].walls.push([wx, WALL_HEIGHT / 2, wz]);
    }
  for (const [area, style] of Object.entries(AREA_STYLE) as [Area, AreaStyle][]) {
    const wallSurface = area === 'reactor' ? assets.metalPbr : assets.wallPbr;
    const floorSurface = area === 'service' ? assets.metalPbr : assets.floorPbr;
    const wallMat = new THREE.MeshStandardMaterial({
      ...wallSurface,
      color: style.tint,
      roughness: 0.95,
      metalness: area === 'reactor' ? 0.38 : 0.03,
      normalScale: new THREE.Vector2(0.7, 0.7),
    });
    const floorMat = new THREE.MeshStandardMaterial({
      ...floorSurface,
      color: area === 'foundry' ? 0xcab4a5 : 0xd4dad6,
      roughness: 0.97,
      metalness: area === 'service' ? 0.38 : 0.04,
      normalScale: new THREE.Vector2(0.65, 0.65),
    });
    const ceilingMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(style.wall).multiplyScalar(0.45),
      roughness: 1,
    });
    instanceBoxes(group, byArea[area].walls, wallMat, wallGeo);
    instanceBoxes(group, byArea[area].floors, floorMat, floorGeo);
    instanceBoxes(group, byArea[area].ceilings, ceilingMat, ceilingGeo);
  }
  // Steel corner posts where walls meet.
  const trims: [number, number, number][] = [];
  for (let tz = 1; tz < MAP_HEIGHT - 1; tz++)
    for (let tx = 1; tx < MAP_WIDTH - 1; tx++) {
      if (!level.cells[tz][tx]) continue;
      if (!level.cells[tz][tx - 1]) trims.push([tileCenter(tx) - 1.9, 2.5, tileCenter(tz) - 1.82]);
      if (!level.cells[tz - 1]?.[tx])
        trims.push([tileCenter(tx) - 1.82, 2.5, tileCenter(tz) - 1.9]);
    }
  instanceBoxes(
    group,
    trims,
    new THREE.MeshStandardMaterial({ color: 0x65736d, roughness: 0.65, metalness: 0.72 }),
    new THREE.BoxGeometry(0.13, 4.8, 0.13),
  );
}

function buildDoors(group: THREE.Group): Record<string, THREE.Group> {
  const doors: Record<string, THREE.Group> = {};
  for (const door of DOORS) {
    const panel = new THREE.Group();
    panel.userData = door;
    const secret = door.kind === 'secret';
    const stripe = secret ? 0x8e7560 : door.key === 'red' ? 0xc84235 : 0xd4aa48;
    const glow = { emissive: stripe, emissiveIntensity: 0.14 };
    for (const [x, z] of door.cells) {
      const cx = tileCenter(x);
      const cz = tileCenter(z);
      const alongX = door.axis === 'x';
      box(
        panel,
        cx,
        2.27,
        cz,
        alongX ? 0.32 : 3.95,
        4.54,
        alongX ? 3.95 : 0.32,
        secret ? 0x4c5550 : 0x2c3433,
      );
      for (const side of [-0.18, 0.18]) {
        if (alongX) box(panel, cx + side, 2.1, cz, 0.06, 0.23, 3.65, stripe, glow);
        else box(panel, cx, 2.1, cz + side, 3.65, 0.23, 0.06, stripe, glow);
      }
    }
    group.add(panel);
    doors[door.id] = panel;
  }
  return doors;
}

function buildLamps(group: THREE.Group): Lamp[] {
  const x = tileCenter;
  const z = tileCenter;
  const spots: [number, number, Area][] = [
    [25, 4, 'arrival'],
    [25, 11, 'arrival'],
    [21, 16, 'hub'],
    [29, 16, 'hub'],
    [21, 22, 'hub'],
    [29, 22, 'hub'],
    [7, 14, 'foundry'],
    [11, 22, 'foundry'],
    [6, 30, 'service'],
    [40, 14, 'archive'],
    [44, 21, 'archive'],
    [25, 27, 'reactor'],
    [23, 37, 'reactor'],
    [27, 40, 'reactor'],
  ];
  const lamps: Lamp[] = [];
  for (const [tx, tz, area] of spots) {
    const { lamp: colour, lampPower } = AREA_STYLE[area];
    box(group, x(tx), 4.89, z(tz), 2.1, 0.12, 0.34, 0x252e2c);
    box(group, x(tx), 4.81, z(tz), 1.65, 0.08, 0.18, colour, {
      emissive: colour,
      emissiveIntensity: 2.2,
    });
    const light = new THREE.PointLight(colour, lampPower, 22, 2);
    light.position.set(x(tx), 4.4, z(tz));
    group.add(light);
    lamps.push({ light, baseIntensity: lampPower });
  }
  return lamps;
}

/** Hand-built landmarks that give the first hall and the reactor their silhouettes. */
function buildLandmarks(group: THREE.Group) {
  const x = tileCenter;
  const z = tileCenter;
  // Overhead trusses in the delivery hall.
  for (const tz of [3.5, 6.5, 9.5, 12.5]) {
    const width = tz < 9 ? 26 : 10;
    box(group, x(25), 4.63, z(tz), width, 0.24, 0.32, 0x58645e, { metalness: 0.72 });
    box(group, x(25), 4.47, z(tz), width, 0.055, 0.46, 0x252e2a, { metalness: 0.7 });
    for (const dx of [-width / 2 + 0.3, width / 2 - 0.3])
      box(group, x(25) + dx, 2.35, z(tz), 0.22, 4.55, 0.3, 0x53615a, { metalness: 0.72 });
  }
  // Crane rails along the floor.
  for (const tx of [24.2, 25.8]) {
    box(group, x(tx), 0.015, z(8), 0.13, 0.03, 48, 0x89958a, { metalness: 0.85, roughness: 0.45 });
    box(group, x(tx) + 0.22, 0.014, z(8), 0.045, 0.035, 48, 0x26302c, { metalness: 0.6 });
  }
  // Ribbed wall panels in the corridor to the hub.
  for (const side of [-1, 1])
    for (const tz of [9.5, 11.5, 13.5]) {
      const wx = x(25) + side * 5.88;
      box(group, wx, 2.5, z(tz), 0.09, 3.8, 3.4, 0x333f3a, { metalness: 0.6 });
      for (let row = 0; row < 4; row++)
        box(group, wx - side * 0.06, 1.45 + row * 0.67, z(tz), 0.08, 0.06, 3.1, 0x75847b, {
          metalness: 0.78,
        });
    }
  // Archive cabinets along the east wall.
  for (const tz of [12, 14, 16, 18, 20, 22]) {
    box(group, x(46) + 1.45, 1.5, z(tz), 0.6, 2.8, 3.2, 0x455452);
    for (let k = 0; k < 4; k++)
      box(group, x(46) + 1.1, 0.45 + k * 0.62, z(tz), 0.12, 0.05, 2.8, 0x82938d);
  }
  // Reactor coolant pipes.
  for (const tx of [21, 29]) {
    cylinder(group, x(tx), 2.2, z(41), 0.43, 4.1, 0x59615b);
    cylinder(group, x(tx), 4.2, z(39), 0.3, 8, 0x647169).rotation.x = Math.PI / 2;
  }
  hazard(group, x(25), 0.02, z(14) + 1.3, 8, 0.45);
  hazard(group, x(25), 0.02, z(34) + 0.5, 8, 0.5);
  sign(group, 'ZENTRALE', x(25), 4, z(14) - 1.8, 4.3);
  sign(group, '< SCHMELZE      ARCHIV >', x(25), 4.1, z(17), 6.5);
  sign(group, 'REAKTOR', x(25), 4, z(24) - 1.7, 4.5, { red: true });
  sign(group, 'ZUTRITT NUR MIT AUSWEIS', x(34) - 0.22, 3.5, z(19), 3.4, {
    rotation: -Math.PI / 2,
    red: true,
  });
  sign(group, 'WERK EISENRISS / 02', x(25), 4, z(3) - 1.7, 5.2);
  for (let tz = 4; tz < 14; tz += 2)
    cylinder(group, x(23) + 0.2, 4.5, z(tz), 0.13, 7.8, 0x74807a).rotation.x = Math.PI / 2;
  for (let tx = 20; tx < 32; tx += 2)
    cylinder(group, x(tx), 4.5, z(15) + 0.25, 0.14, 7.8, 0x74807a).rotation.z = Math.PI / 2;
}

function placeProps(group: THREE.Group, assets: GameAssets) {
  const x = tileCenter;
  const z = tileCenter;
  const place = (name: string, wx: number, wz: number, rotation = 0, scale = 1) => {
    const mesh = enableShadows(assets.models[`prop_${name}`].clone(true));
    mesh.position.set(wx, 0, wz);
    mesh.rotation.y = rotation;
    mesh.scale.setScalar(scale);
    group.add(mesh);
  };
  for (const tz of [15.2, 19.2, 22.2]) place('furnace', x(4) - 1.2, z(tz), Math.PI / 2, 0.9);
  for (const tx of [20, 23, 26, 29]) place('console', x(tx), z(23) + 1.15, Math.PI, 1.15);
  place('reactor', x(25), z(43) - 0.25);
  const crates: [number, number, number][] = [
    [23, 3, 0.2],
    [27, 7, 0.7],
    [20, 23, 0.1],
    [30, 22, 0.4],
    [12, 13, -0.2],
    [5, 22, 0.5],
    [3, 33, 0.3],
    [11, 29, 0.8],
    [37, 12, -0.4],
    [44, 22, 0.2],
  ];
  for (const [tx, tz, r] of crates) place('crate', x(tx) + 0.8, z(tz) + 0.8, r, 0.9);
  const barrels: [number, number][] = [
    [22, 4],
    [28, 6],
    [19, 20],
    [31, 17],
    [6, 13],
    [13, 23],
    [3, 29],
    [11, 34],
    [37, 22],
    [45, 12],
    [21, 38],
    [29, 40],
  ];
  for (const [tx, tz] of barrels) place('barrel', x(tx) + 1.1, z(tz) + 1.1, 0, 0.95);
  place('generator', x(3.3), z(28.5), Math.PI / 2);
  place('generator', x(45), z(18.5), -Math.PI / 2);
  place('gantry', x(9), z(17));
  place('gantry', x(25), z(37));

  const detail = (name: string, wx: number, wz: number, rotation: number, scale: number) => {
    const source = assets.details.scene.getObjectByName(`detail_${name}`);
    if (!source) return;
    const model = enableShadows(source.clone(true));
    model.position.set(wx, 0, wz);
    model.rotation.y = rotation;
    model.scale.setScalar(scale);
    group.add(model);
  };
  detail('generator', x(24), z(7), -0.4, 1.35);
  detail('generator', x(11), z(21), 1.1, 1.35);
  detail('generator', x(43), z(13), 0.8, 1.35);
  const utilities: [number, number, number][] = [
    [22.1, 7, Math.PI / 2],
    [31.8, 19, -Math.PI / 2],
    [4.1, 22, Math.PI / 2],
    [45.9, 17, -Math.PI / 2],
    [20.1, 38, Math.PI / 2],
  ];
  for (const [tx, tz, rot] of utilities) detail('utility', x(tx), z(tz), rot, 1.1);

  for (const [name, tx, tz, rotation, scale, , height = 0] of INDUSTRY_PLACEMENTS) {
    const source = assets.industry.scene.getObjectByName(`industry_${name}`);
    if (!source) continue;
    const model = enableShadows(source.clone(true));
    model.position.set(x(tx), height, z(tz));
    model.rotation.y = rotation;
    model.scale.multiplyScalar(scale);
    group.add(model);
  }
}

export function buildWorld(scene: THREE.Scene, level: Level, assets: GameAssets): BuiltWorld {
  const group = new THREE.Group();
  scene.add(group);
  buildShell(group, level, assets);
  const doors = buildDoors(group);
  const lamps = buildLamps(group);
  buildLandmarks(group);
  placeProps(group, assets);
  return { group, doors, obstacles: INDUSTRY_OBSTACLES, lamps };
}

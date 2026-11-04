import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import type { EnemyType } from '../config/enemies.ts';
import type { WeaponId } from '../config/weapons.ts';
import type { PickupType } from '../world/level.ts';
import type { GameAssets } from './assets.ts';

export interface FlashMaterial {
  material: THREE.MeshStandardMaterial;
  baseEmissive: THREE.Color;
  baseIntensity: number;
}

export interface EnemyModel {
  group: THREE.Group;
  parts: {
    legL?: THREE.Object3D;
    legR?: THREE.Object3D;
    armL?: THREE.Object3D;
    armR?: THREE.Object3D;
  };
  /** Rest rotation of the legs, so the walk cycle swings around it. */
  legBase: { left: number; right: number };
  radius: number;
  height: number;
  /** Materials that glow on hits and while winding up an attack. */
  materials: FlashMaterial[];
  hover: boolean;
}

/** Hand-held weapon placement in camera space. The debug panel edits these live. */
export const VIEWMODEL = {
  yaw: -0.08,
  /** Placeholder Blender weapons. */
  offset: { x: 0.46, y: -0.47, z: -0.72 },
  /** The revolver sits higher and closer, pointing at the crosshair. */
  pistolOffset: { x: 0.26, y: -0.26, z: -0.5 },
  revolver: { x: 0, y: -0.08, z: 0.02, rx: -0.18, ry: 1.42, rz: 0, scale: 1.5 },
};

function ownMaterials(
  root: THREE.Object3D,
  tint?: (material: THREE.Material) => void,
): FlashMaterial[] {
  const copies = new Map<THREE.Material, THREE.Material>();
  const flash: FlashMaterial[] = [];
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    node.castShadow = true;
    node.receiveShadow = true;
    const copy = (material: THREE.Material) => {
      let cloned = copies.get(material);
      if (!cloned) {
        cloned = material.clone();
        cloned.onBeforeCompile = material.onBeforeCompile;
        cloned.customProgramCacheKey = material.customProgramCacheKey;
        tint?.(cloned);
        copies.set(material, cloned);
        if (cloned instanceof THREE.MeshStandardMaterial)
          flash.push({
            material: cloned,
            baseEmissive: cloned.emissive.clone(),
            baseIntensity: cloned.emissiveIntensity,
          });
      }
      return cloned;
    };
    node.material = Array.isArray(node.material) ? node.material.map(copy) : copy(node.material);
  });
  return flash;
}

export function makeEnemy(type: EnemyType, assets: GameAssets): EnemyModel {
  if (type === 'drone') {
    const group = assets.models.enemy_drone.clone(true) as THREE.Group;
    group.position.set(0, 0, 0);
    const materials = ownMaterials(group);
    return {
      group,
      parts: {},
      legBase: { left: 0, right: 0 },
      radius: 0.75,
      height: 1.7,
      materials,
      hover: true,
    };
  }
  const group = new THREE.Group();
  const model = cloneSkeleton(assets.human.scene);
  const scale = type === 'boss' ? 1.48 : type === 'tank' ? 1.16 : 1.0;
  model.scale.set(type === 'tank' ? scale * 1.12 : scale, scale, scale);
  group.add(model);
  const materials = ownMaterials(model, (material) => {
    const colour = (material as THREE.MeshStandardMaterial).color;
    if (!colour) return;
    if (/Finley.*(top|bottom)|helmet.*red|reflective lime/i.test(material.name))
      colour.multiply(new THREE.Color(0x737762));
    if (type === 'runner') colour.multiply(new THREE.Color(0x9b7c6a));
    if (type === 'boss') colour.multiply(new THREE.Color(0xc48467));
  });
  const parts = {
    legL: model.getObjectByName('leg_L'),
    legR: model.getObjectByName('leg_R'),
    armL: model.getObjectByName('arm_L'),
    armR: model.getObjectByName('arm_R'),
  };
  return {
    group,
    parts,
    legBase: { left: parts.legL?.rotation.x ?? 0, right: parts.legR?.rotation.x ?? 0 },
    radius: (type === 'boss' ? 0.78 : 0.53) * scale,
    height: 1.9 * scale,
    materials,
    hover: false,
  };
}

// Pickups share geometry and materials between spawns.
const boxGeometries = new Map<string, THREE.BoxGeometry>();
const pickupMaterials = new Map<string, THREE.MeshStandardMaterial>();

function pickupBox(
  parent: THREE.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  colour: number,
  glow = 0,
) {
  const geometryKey = `${w},${h},${d}`;
  let geometry = boxGeometries.get(geometryKey);
  if (!geometry) boxGeometries.set(geometryKey, (geometry = new THREE.BoxGeometry(w, h, d)));
  const materialKey = `${colour},${glow}`;
  let material = pickupMaterials.get(materialKey);
  if (!material)
    pickupMaterials.set(
      materialKey,
      (material = new THREE.MeshStandardMaterial({
        color: colour,
        roughness: 0.86,
        metalness: 0.2,
        emissive: glow ? colour : 0,
        emissiveIntensity: glow,
      })),
    );
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
}

const PICKUP_COLOURS: Record<PickupType, number> = {
  health: 0xf3e5ca,
  armor: 0x74b9b0,
  bullets: 0xd5ab57,
  shells: 0xe45d45,
  nails: 0x8da9a2,
  rockets: 0xe88d43,
  red: 0xf14c3d,
  yellow: 0xe6c455,
  shotgun: 0xb48a64,
  nailgun: 0x7c9991,
  launcher: 0x9c8a68,
};
const ringGeometry = new THREE.RingGeometry(0.48, 0.57, 24);
const ringMaterials = new Map<number, THREE.MeshBasicMaterial>();

export function makePickup(type: PickupType): THREE.Group {
  const group = new THREE.Group();
  const colour = PICKUP_COLOURS[type];
  if (type === 'red' || type === 'yellow') {
    pickupBox(group, 0, 0.35, 0, 0.48, 0.7, 0.1, colour, 0.45);
    pickupBox(group, 0, 0.5, 0.06, 0.3, 0.1, 0.02, 0xe8eadc);
  } else if (type === 'shotgun' || type === 'nailgun' || type === 'launcher') {
    pickupBox(group, 0, 0.4, 0, 1, 0.2, 0.28, 0x313d3a);
    pickupBox(group, 0.2, 0.54, 0, 0.6, 0.2, 0.22, colour);
    pickupBox(group, -0.4, 0.28, 0, 0.18, 0.36, 0.2, 0x594a3a);
  } else {
    pickupBox(group, 0, 0.35, 0, 0.65, 0.55, 0.65, colour);
    if (type === 'health') {
      pickupBox(group, 0, 0.36, 0.34, 0.42, 0.1, 0.03, 0xb12f2b);
      pickupBox(group, 0, 0.36, 0.35, 0.1, 0.4, 0.03, 0xb12f2b);
    } else pickupBox(group, 0, 0.35, 0.34, 0.4, 0.12, 0.03, 0x1d2928);
  }
  let ringMaterial = ringMaterials.get(colour);
  if (!ringMaterial)
    ringMaterials.set(
      colour,
      (ringMaterial = new THREE.MeshBasicMaterial({
        color: colour,
        transparent: true,
        opacity: 0.7,
        side: THREE.DoubleSide,
      })),
    );
  const ring = new THREE.Mesh(ringGeometry, ringMaterial);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.03;
  group.add(ring);
  return group;
}

export interface Viewmodel {
  root: THREE.Group;
  mixer?: THREE.AnimationMixer;
  fireAction?: THREE.AnimationAction;
  /** The revolver mesh, for live placement tweaks. */
  revolver?: THREE.Object3D;
}

function noShadows(object: THREE.Object3D) {
  object.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.castShadow = false;
      node.receiveShadow = false;
    }
  });
}

export function applyRevolverPlacement(revolver: THREE.Object3D) {
  const r = VIEWMODEL.revolver;
  revolver.position.set(r.x, r.y, r.z);
  revolver.rotation.set(r.rx, r.ry, r.rz);
  revolver.scale.setScalar(r.scale);
}

export function makeWeapon(type: WeaponId, assets: GameAssets): Viewmodel {
  const root = new THREE.Group();
  root.rotation.y = VIEWMODEL.yaw;
  if (type === 'pistol') {
    const revolver = cloneSkeleton(assets.revolver.scene);
    applyRevolverPlacement(revolver);
    // The blocky placeholder glove is left out until proper first-person arms exist.
    root.add(revolver);
    noShadows(root);
    const clip = assets.revolver.animations.find((animation) => animation.name === 'Shoot');
    if (!clip) return { root, revolver };
    const mixer = new THREE.AnimationMixer(revolver);
    const fireAction = mixer.clipAction(clip);
    fireAction.setLoop(THREE.LoopOnce, 1);
    return { root, mixer, fireAction, revolver };
  }
  // Blender lays the weapons out side by side; only their tilt is kept.
  const model = assets.models[`weapon_${type}`].clone(true);
  model.position.set(0, 0, 0);
  model.rotation.y = 0;
  root.add(model);
  noShadows(root);
  return { root };
}

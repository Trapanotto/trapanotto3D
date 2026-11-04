import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { gunzipSync } from 'three/addons/libs/fflate.module.js';

export interface PbrSet {
  map: THREE.Texture;
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

export interface GameAssets {
  /** Named nodes from the Blender bundle: enemy_*, weapon_*, prop_*. */
  models: Record<string, THREE.Object3D>;
  revolver: GLTF;
  details: GLTF;
  human: GLTF;
  industry: GLTF;
  floorPbr: PbrSet;
  wallPbr: PbrSet;
  metalPbr: PbrSet;
}

const REQUIRED_MODELS = [
  'enemy_drone',
  'weapon_hand',
  'weapon_fist',
  'weapon_shotgun',
  'weapon_nailgun',
  'weapon_launcher',
  'prop_console',
  'prop_furnace',
  'prop_reactor',
  'prop_crate',
  'prop_barrel',
  'prop_generator',
  'prop_gantry',
];

const base = import.meta.env.BASE_URL;

async function loadTexture(name: string): Promise<THREE.Texture> {
  const texture = await new THREE.TextureLoader().loadAsync(`${base}textures/${name}.png`);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

async function loadPbr(name: string): Promise<PbrSet> {
  const loader = new THREE.TextureLoader();
  const [map, normalMap, roughnessMap] = await Promise.all(
    ['color', 'normal', 'roughness'].map((kind) =>
      loader.loadAsync(`${base}textures/pbr/${name}_${kind}.jpg`),
    ),
  );
  map.colorSpace = THREE.SRGBColorSpace;
  for (const texture of [map, normalMap, roughnessMap]) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.anisotropy = 8;
  }
  return { map, normalMap, roughnessMap };
}

async function loadGltf(filename: string): Promise<GLTF> {
  const response = await fetch(`${base}models/${filename}.glb.gz`);
  if (!response.ok) throw new Error(`3D-Modelle konnten nicht geladen werden (${response.status})`);
  const compressed = new Uint8Array(await response.arrayBuffer());
  // Some servers advertise .gz as Content-Encoding, and the browser has already decompressed it.
  const gzip = compressed[0] === 0x1f && compressed[1] === 0x8b;
  const decoded = gzip ? gunzipSync(compressed) : compressed;
  const buffer = decoded.buffer.slice(
    decoded.byteOffset,
    decoded.byteOffset + decoded.byteLength,
  ) as ArrayBuffer;
  return new Promise((resolve, reject) => new GLTFLoader().parse(buffer, base, resolve, reject));
}

async function loadModels(): Promise<Record<string, THREE.Object3D>> {
  const gltf = await loadGltf('trapanotto_assets');
  const models: Record<string, THREE.Object3D> = {};
  for (const child of gltf.scene.children)
    if (/^(enemy_|weapon_|prop_)/.test(child.name)) models[child.name] = child;
  const missing = REQUIRED_MODELS.filter((name) => !models[name]);
  if (missing.length) throw new Error(`Modelle fehlen: ${missing.join(', ')}`);
  return models;
}

/** Adds painted-steel wear to the Blender bundle's flat-coloured armour and paint materials. */
function applyIndustrialWear(models: Record<string, THREE.Object3D>, steel: THREE.Texture) {
  const steelBump = steel.clone();
  steelBump.colorSpace = THREE.NoColorSpace;
  steelBump.needsUpdate = true;
  const seen = new Set<THREE.Material>();
  for (const model of Object.values(models)) {
    model.traverse((node) => {
      if (!(node instanceof THREE.Mesh)) return;
      const materials: THREE.Material[] = Array.isArray(node.material)
        ? node.material
        : [node.material];
      for (const material of materials) {
        if (seen.has(material) || !(material instanceof THREE.MeshStandardMaterial)) continue;
        seen.add(material);
        if (!/Armor|Steel|Gunmetal|Yellow|Paint/i.test(material.name)) continue;
        material.map = steel;
        material.bumpMap = steelBump;
        material.bumpScale = 0.016;
        material.onBeforeCompile = (shader) => {
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
              vec4 wear = texture2D( map, vMapUv );
              diffuseColor.rgb *= mix( vec3(1.0), wear.rgb * 2.8, 0.42 );
            #endif`,
          );
        };
        material.customProgramCacheKey = () => 'trapanotto-industrial-wear-v1';
        material.needsUpdate = true;
      }
    });
  }
}

export async function loadAssets(): Promise<GameAssets> {
  const [models, revolver, details, human, industry, steel, floorPbr, wallPbr, metalPbr] =
    await Promise.all([
      loadModels(),
      loadGltf('revolver'),
      loadGltf('polyhaven_details'),
      loadGltf('industrial_enemy'),
      loadGltf('industry_set'),
      loadTexture('weathered-steel'),
      loadPbr('concrete_floor_worn_02'),
      loadPbr('concrete_block_wall_02'),
      loadPbr('blue_metal_plate'),
    ]);
  applyIndustrialWear(models, steel);
  return { models, revolver, details, human, industry, floorPbr, wallPbr, metalPbr };
}

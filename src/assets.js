import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { gunzipSync } from 'three/addons/libs/fflate.module.js';

const base=import.meta.env.BASE_URL;
async function loadTexture(name){
  const texture=await new THREE.TextureLoader().loadAsync(`${base}textures/${name}.png`);
  texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.anisotropy=4;texture.generateMipmaps=true;return texture;
}
async function loadPbr(name){
  const loader=new THREE.TextureLoader();
  const maps=await Promise.all(['color','normal','roughness'].map(kind=>loader.loadAsync(`${base}textures/pbr/${name}_${kind}.jpg`)));
  for(const [index,map] of maps.entries()){
    map.colorSpace=index===0?THREE.SRGBColorSpace:THREE.NoColorSpace;
    map.wrapS=map.wrapT=THREE.RepeatWrapping;map.anisotropy=8;
  }
  return {map:maps[0],normalMap:maps[1],roughnessMap:maps[2]};
}
async function loadGltf(filename){
  const response=await fetch(`${base}models/${filename}.glb.gz`);
  if(!response.ok)throw new Error(`3D-Modelle konnten nicht geladen werden (${response.status})`);
  const compressed=new Uint8Array(await response.arrayBuffer());
  // Some servers advertise .gz as Content-Encoding and the browser decompresses it.
  const decoded=compressed[0]===0x1f&&compressed[1]===0x8b?gunzipSync(compressed):compressed;
  const buffer=decoded.buffer.slice(decoded.byteOffset,decoded.byteOffset+decoded.byteLength);
  return new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,base,resolve,reject));
}
async function loadModels(){
  const gltf=await loadGltf('trapanotto_assets');
  const models={};
  for(const child of gltf.scene.children)if(/^(enemy_|weapon_|prop_)/.test(child.name))models[child.name]=child;
  const required=['enemy_guard','enemy_runner','enemy_tank','enemy_drone','enemy_boss','weapon_fist','weapon_hand','weapon_pistol','weapon_shotgun','weapon_nailgun','weapon_launcher','prop_console','prop_furnace','prop_reactor','prop_crate','prop_barrel','prop_forklift','prop_generator','prop_gantry'];
  const missing=required.filter(name=>!models[name]);if(missing.length)throw new Error(`Modelle fehlen: ${missing.join(', ')}`);
  return models;
}
export async function loadAssets(){
  const [models,revolver,details,human,industry,steel,concrete,floorPbr,wallPbr,metalPbr]=await Promise.all([
    loadModels(),loadGltf('revolver'),loadGltf('polyhaven_details'),loadGltf('industrial_enemy'),loadGltf('industry_set'),
    loadTexture('weathered-steel'),loadTexture('industrial-concrete'),loadPbr('concrete_floor_worn_02'),
    loadPbr('concrete_block_wall_02'),loadPbr('blue_metal_plate')]);
  const steelBump=steel.clone();steelBump.colorSpace=THREE.NoColorSpace;steelBump.needsUpdate=true;
  const seen=new Set();
  Object.values(models).forEach(model=>model.traverse(node=>{
    if(!node.isMesh)return;
    const mats=Array.isArray(node.material)?node.material:[node.material];
    for(const material of mats){
      if(seen.has(material))continue;seen.add(material);
      if(/Armor|Steel|Gunmetal|Yellow|Paint/i.test(material.name)){
        material.map=steel;material.bumpMap=steelBump;material.bumpScale=.016;
        material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
          vec4 wear = texture2D( map, vMapUv );
          diffuseColor.rgb *= mix( vec3(1.0), wear.rgb * 2.8, 0.42 );
        #endif`);};
        material.customProgramCacheKey=()=> 'trapanotto-industrial-wear-v1';material.needsUpdate=true;
      }
    }
  }));
  return {models,revolver,details,human,industry,steel,concrete,floorPbr,wallPbr,metalPbr};
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';

function glb(path){
  const bytes=gunzipSync(readFileSync(path));assert.equal(bytes.readUInt32LE(0),0x46546c67,'valid glTF binary');
  const length=bytes.readUInt32LE(12);return JSON.parse(bytes.subarray(20,20+length).toString());
}

test('Blender export contains the game models used by the renderer',()=>{
  const data=glb('public/models/trapanotto_assets.glb.gz');const names=new Set(data.nodes.map(n=>n.name));
  for(const name of ['enemy_runner','enemy_guard','enemy_tank','enemy_drone','enemy_boss','weapon_hand','weapon_fist','weapon_shotgun','weapon_nailgun','weapon_launcher','prop_furnace','prop_reactor','prop_forklift','prop_gantry'])assert.ok(names.has(name),name);
});

test('revolver includes its embedded textures and shoot animation',()=>{
  const data=glb('public/models/revolver.glb.gz');assert.ok(data.images.length>=3);assert.ok(data.animations.some(a=>a.name==='Shoot'));
});

test('PBR industrial details contain both imported models and embedded textures',()=>{
  const data=glb('public/models/polyhaven_details.glb.gz');const names=new Set(data.nodes.map(n=>n.name));
  assert.ok(names.has('detail_generator'));assert.ok(names.has('detail_utility'));assert.ok(data.images.length>=4);
});

test('the Blender enemy has its rig, clothes and embedded textures',()=>{
  const data=glb('public/models/industrial_enemy.glb.gz');const names=new Set(data.nodes.map(n=>n.name));
  assert.ok(names.has('enemy_human'));assert.ok(names.has('leg_L'));assert.ok(data.skins.length>0);assert.ok(data.images.length>=3);
});

test('surface textures are valid PNG assets',()=>{
  for(const path of ['public/textures/weathered-steel.png','public/textures/industrial-concrete.png']){
    const header=readFileSync(path).subarray(0,8);assert.deepEqual([...header],[137,80,78,71,13,10,26,10],path);
  }
});

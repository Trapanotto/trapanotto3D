import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { TILE, MAP_HEIGHT, MAP_WIDTH, DOORS, tileCenter } from './level.js';

const palette = {
  arrival: { wall: '#45504f', floor: '#333b3b', trim: 0x93a29c },
  hub: { wall: '#495452', floor: '#394240', trim: 0xa3b3a3 },
  foundry: { wall: '#59483e', floor: '#4c3e35', trim: 0xe37b3f },
  service: { wall: '#3b4e4a', floor: '#313c39', trim: 0x6a9d89 },
  archive: { wall: '#3d4d50', floor: '#303e40', trim: 0x86bdc0 },
  reactor: { wall: '#45454b', floor: '#33363b', trim: 0xda704c }
};

function seeded(n) { const x = Math.sin(n * 127.1 + 17.47) * 43758.5453; return x - Math.floor(x); }
function texture(area, kind) {
  const canvas = document.createElement('canvas'); canvas.width = 256; canvas.height = 256;
  const c = canvas.getContext('2d'), p = palette[area];
  c.fillStyle = kind === 'wall' ? p.wall : p.floor; c.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = seeded(i + 1) * 256, y = seeded(i + 901) * 256;
    c.fillStyle = i % 2 ? 'rgba(4,8,9,.09)' : 'rgba(218,225,214,.035)';
    c.fillRect(x, y, seeded(i + 52) * 3 + 1, seeded(i + 33) * 2 + 1);
  }
  if (kind === 'wall') {
    c.fillStyle = 'rgba(13,19,19,.6)'; c.fillRect(0, 0, 256, 9); c.fillRect(0, 186, 256, 8);
    c.fillStyle = 'rgba(221,226,208,.08)'; c.fillRect(0, 10, 256, 3); c.fillRect(0, 194, 256, 3);
    c.strokeStyle = 'rgba(11,17,17,.46)'; c.lineWidth = 4;
    c.strokeRect(10, 17, 236, 160); c.beginPath(); c.moveTo(128, 18); c.lineTo(128, 177); c.stroke();
    for (const x of [19, 119, 137, 237]) for (const y of [27, 166, 208, 239]) {
      c.fillStyle = '#202b29'; c.beginPath(); c.arc(x, y, 3, 0, 7); c.fill();
      c.fillStyle = 'rgba(245,244,220,.18)'; c.fillRect(x-1,y-1,2,2);
    }
    c.fillStyle = 'rgba(9,13,12,.22)'; c.fillRect(0, 229, 256, 27);
  } else {
    c.strokeStyle = 'rgba(8,14,13,.6)'; c.lineWidth = 5;
    c.strokeRect(1, 1, 254, 254); c.beginPath(); c.moveTo(128,0); c.lineTo(128,256); c.moveTo(0,128); c.lineTo(256,128); c.stroke();
    c.strokeStyle = 'rgba(215,224,208,.09)'; c.lineWidth = 2;
    for (let i = 15; i < 128; i += 14) { c.beginPath(); c.moveTo(i, 8); c.lineTo(i, 120); c.stroke(); c.beginPath(); c.moveTo(i + 128, 136); c.lineTo(i + 128, 248); c.stroke(); }
    for (const x of [10,118,138,246]) for (const y of [10,118,138,246]) { c.fillStyle='#151d1b';c.fillRect(x,y,4,4); }
  }
  const t = new THREE.CanvasTexture(canvas); t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.anisotropy = 4;
  return t;
}

function instanceBoxes(group, positions, material, geometry) {
  if (!positions.length) return;
  const mesh = new THREE.InstancedMesh(geometry, material, positions.length), matrix = new THREE.Matrix4();
  positions.forEach(([x,y,z], i) => { matrix.makeTranslation(x,y,z); mesh.setMatrixAt(i,matrix); const v = .82 + seeded(i * 1.7 + x + z) * .18; mesh.setColorAt(i,new THREE.Color(v,v,v)); });
  mesh.instanceMatrix.needsUpdate = true; mesh.receiveShadow = false; group.add(mesh);
}

function box(parent, x,y,z, w,h,d, color, options={}) {
  const material = new THREE.MeshStandardMaterial({ color, roughness: options.roughness ?? .86, metalness: options.metalness ?? .2, emissive: options.emissive ?? 0, emissiveIntensity: options.emissiveIntensity ?? 1 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material); m.position.set(x,y,z); parent.add(m); return m;
}
function cylinder(parent,x,y,z,r1,r2,h,color,options={}) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,options.segments ?? 8), new THREE.MeshStandardMaterial({color,roughness:.7,metalness:.45,emissive:options.emissive ?? 0,emissiveIntensity:options.emissiveIntensity ?? 1}));
  mesh.position.set(x,y,z); parent.add(mesh); return mesh;
}
function sign(parent, text, x,y,z, width=4, options={}) {
  const canvas=document.createElement('canvas'); canvas.width=512; canvas.height=128; const c=canvas.getContext('2d');
  c.fillStyle=options.red?'#a83930':'#202a29'; c.fillRect(0,0,512,128); c.fillStyle=options.red?'#e89a84':'#d8dccc'; c.fillRect(0,0,12,128); c.font='bold 51px Arial'; c.textBaseline='middle'; c.fillText(text,30,66,460);
  const t=new THREE.CanvasTexture(canvas); t.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),new THREE.MeshBasicMaterial({map:t,side:THREE.DoubleSide})); m.position.set(x,y,z); m.rotation.y=options.rotation ?? Math.PI; parent.add(m); return m;
}
function hazard(parent,x,y,z,w,d,rotation=0){
  const g=new THREE.Group();g.position.set(x,y,z);g.rotation.y=rotation;
  box(g,0,0,0,w,.035,d,0xb48b41,{emissive:0x3b2505});
  for(let i=-Math.floor(w/.75);i<=Math.floor(w/.75);i++){const stripe=box(g,i*.75,.022,0,.32,.02,d,0x20221e);stripe.rotation.y=.5;}
  parent.add(g); return g;
}

export function buildWorld(scene, level, assets) {
  const group=new THREE.Group(); scene.add(group);
  const light=new THREE.HemisphereLight(0xc4d5ca,0x463d35,2.6); scene.add(light);
  const ambient=new THREE.AmbientLight(0xc4cebe,1.05); scene.add(ambient);
  const wallGeo=new THREE.BoxGeometry(TILE,5,TILE), floorGeo=new THREE.BoxGeometry(TILE,.12,TILE), ceilingGeo=new THREE.BoxGeometry(TILE,.08,TILE);
  const byArea={}; for(const area of Object.keys(palette)) byArea[area]={walls:[],floors:[],ceilings:[]};
  for(let z=0;z<MAP_HEIGHT;z++) for(let x=0;x<MAP_WIDTH;x++){
    const area=level.cells[z][x], wx=tileCenter(x), wz=tileCenter(z);
    if(area){byArea[area].floors.push([wx,-.06,wz]);byArea[area].ceilings.push([wx,5.04,wz]);}
    else {
      const neighbors=[[x-1,z],[x+1,z],[x,z-1],[x,z+1]];
      const adjacent=neighbors.map(([nx,nz])=>level.cells[nz]?.[nx]).find(Boolean);
      if(adjacent)byArea[adjacent].walls.push([wx,2.5,wz]);
    }
  }
  for(const [area,p] of Object.entries(palette)){
    const tint={arrival:0xc6d0cc,hub:0xc8d1c6,foundry:0xe2b5a2,service:0xb9d2c3,archive:0xbcd2d6,reactor:0xd4c2bf}[area];
    const wallMap=assets?.steel??texture(area,'wall'),floorMap=assets?.concrete??texture(area,'floor');
    const wallMat=new THREE.MeshStandardMaterial({map:wallMap,color:tint,roughness:.88,metalness:.34,emissiveMap:wallMap,emissive:0xffffff,emissiveIntensity:.25});
    const floorMat=new THREE.MeshStandardMaterial({map:floorMap,color:0xc9ceca,roughness:.94,metalness:.06,emissiveMap:floorMap,emissive:0xffffff,emissiveIntensity:.04});
    const ceilMat=new THREE.MeshStandardMaterial({color:new THREE.Color(p.wall).multiplyScalar(.45),roughness:1});
    instanceBoxes(group,byArea[area].walls,wallMat,wallGeo);instanceBoxes(group,byArea[area].floors,floorMat,floorGeo);instanceBoxes(group,byArea[area].ceilings,ceilMat,ceilingGeo);
  }
  const doors={};
  for(const door of DOORS){
    const d=new THREE.Group(); d.userData=door; const isSecret=door.kind==='secret';
    for(const [x,z] of door.cells){
      const w=door.axis==='x'?.32:3.95, dep=door.axis==='x'?3.95:.32;
      box(d,tileCenter(x),2.27,tileCenter(z),w,4.54,dep,isSecret?0x4c5550:0x2c3433);
      const color=isSecret?0x8e7560:door.key==='red'?0xc84235:0xd4aa48;
      if(door.axis==='x'){
        box(d,tileCenter(x)-.18,2.1,tileCenter(z),.06,.23,3.65,color,{emissive:color,emissiveIntensity:.14});
        box(d,tileCenter(x)+.18,2.1,tileCenter(z),.06,.23,3.65,color,{emissive:color,emissiveIntensity:.14});
      } else {
        box(d,tileCenter(x),2.1,tileCenter(z)-.18,3.65,.23,.06,color,{emissive:color,emissiveIntensity:.14});
        box(d,tileCenter(x),2.1,tileCenter(z)+.18,3.65,.23,.06,color,{emissive:color,emissiveIntensity:.14});
      }
    }
    group.add(d); doors[door.id]=d;
  }
  // Hand-built landmarks give each part of the factory a distinct silhouette.
  const x=tileCenter, z=tileCenter;
  for(const [tx,tz,area] of [[25,4,'arrival'],[25,11,'arrival'],[21,16,'hub'],[29,16,'hub'],[21,22,'hub'],[29,22,'hub'],[7,14,'foundry'],[11,22,'foundry'],[6,30,'service'],[40,14,'archive'],[44,21,'archive'],[25,27,'reactor'],[23,37,'reactor'],[27,40,'reactor']]){
    const col=palette[area].trim;
    box(group,x(tx),4.89,z(tz),2.1,.12,.34,0x252e2c);
    box(group,x(tx),4.81,z(tz),1.65,.08,.18,col,{emissive:col,emissiveIntensity:1.5});
    const lamp=new THREE.PointLight(col,area==='foundry'?36:22,20,2);lamp.position.set(x(tx),4.4,z(tz));group.add(lamp);
  }
  // Overhead trusses, guide rails and conduits add real silhouettes to the first hall.
  for(const tz of [3.5,6.5,9.5,12.5]){
    const width=tz<9?26:10;
    box(group,x(25),4.63,z(tz),width,.24,.32,0x58645e,{metalness:.72});
    box(group,x(25),4.47,z(tz),width,.055,.46,0x252e2a,{metalness:.7});
    for(const dx of [-width/2+.3,width/2-.3])box(group,x(25)+dx,2.35,z(tz),.22,4.55,.30,0x53615a,{metalness:.72});
  }
  for(const tx of [24.2,25.8]){
    box(group,x(tx),.015,z(8),.13,.03,48,0x89958a,{metalness:.85,roughness:.45});
    box(group,x(tx)+.22,.014,z(8),.045,.035,48,0x26302c,{metalness:.6});
  }
  for(const side of [-1,1])for(const tz of [9.5,11.5,13.5]){
    const wx=x(25)+side*5.88;
    box(group,wx,2.5,z(tz),.09,3.8,3.4,0x333f3a,{metalness:.6});
    for(let row=0;row<4;row++)box(group,wx-side*.06,1.45+row*.67,z(tz),.08,.06,3.1,0x75847b,{metalness:.78});
  }
  // Furnace machinery and consoles are supplied by the Blender asset bundle.
  for(const tz of [12,14,16,18,20,22]){
    box(group,x(46)+1.45,1.5,z(tz),.6,2.8,3.2,0x455452);
    for(let k=0;k<4;k++)box(group,x(46)+1.1,.45+k*.62,z(tz),.12,.05,2.8,0x82938d);
  }
  for(const tx of [21,29]){
    cylinder(group,x(tx),2.2,z(41),.43,.43,4.1,0x59615b);
    cylinder(group,x(tx),4.2,z(39),.3,.3,8,0x647169).rotation.x=Math.PI/2;
  }
  hazard(group,x(25),.02,z(14)+1.3,8,.45); hazard(group,x(25),.02,z(34)+.5,8,.5);
  sign(group,'ZENTRALE',x(25),4,z(14)-1.8,4.3);
  sign(group,'< SCHMELZE      ARCHIV >',x(25),4.1,z(17),6.5);
  sign(group,'REAKTOR',x(25),4,z(24)-1.7,4.5,{red:true});
  sign(group,'ZUTRITT NUR MIT AUSWEIS',x(34)-.22,3.5,z(19),3.4,{rotation:-Math.PI/2,red:true});
  sign(group,'WERK EISENRISS / 02',x(25),4,z(3)-1.7,5.2);
  // Repeating overhead pipework.
  for(let tz=4;tz<14;tz+=2){cylinder(group,x(23)+.2,4.5,z(tz),.13,.13,7.8,0x74807a).rotation.x=Math.PI/2;}
  for(let tx=20;tx<32;tx+=2){cylinder(group,x(tx),4.5,z(15)+.25,.14,.14,7.8,0x74807a).rotation.z=Math.PI/2;}
  const trimPositions=[];
  for(let tz=1;tz<MAP_HEIGHT-1;tz++)for(let tx=1;tx<MAP_WIDTH-1;tx++)if(level.cells[tz][tx]){
    if(!level.cells[tz][tx-1])trimPositions.push([x(tx)-1.9,2.5,z(tz)-1.82]);
    if(!level.cells[tz-1]?.[tx])trimPositions.push([x(tx)-1.82,2.5,z(tz)-1.9]);
  }
  instanceBoxes(group,trimPositions,new THREE.MeshStandardMaterial({color:0x65736d,roughness:.65,metalness:.72}),new THREE.BoxGeometry(.13,4.8,.13));
  if(assets?.models){
    const place=(name,wx,wz,rotation=0,scale=1)=>{const mesh=assets.models[`prop_${name}`].clone(true);mesh.position.set(wx,0,wz);mesh.rotation.y=rotation;mesh.scale.setScalar(scale);group.add(mesh);return mesh;};
    // Each landmark is an editable Blender model rather than a runtime primitive.
    for(const tz of [15.2,19.2,22.2])place('furnace',x(4)-1.2,z(tz),Math.PI/2,.9);
    for(const tx of [20,23,26,29])place('console',x(tx),z(23)+1.15,Math.PI,1.15);
    place('reactor',x(25),z(43)-.25,0,1);
    for(const [tx,tz,r] of [[23,3,.2],[27,7,.7],[20,23,.1],[30,22,.4],[12,13,-.2],[5,22,.5],[3,33,.3],[11,29,.8],[37,12,-.4],[44,22,.2]])place('crate',x(tx)+.8,z(tz)+.8,r,.9);
    for(const [tx,tz] of [[22,4],[28,6],[19,20],[31,17],[6,13],[13,23],[3,29],[11,34],[37,22],[45,12],[21,38],[29,40]])place('barrel',x(tx)+1.1,z(tz)+1.1,0,.95);
    place('generator',x(3.3),z(28.5),Math.PI/2,1);
    place('generator',x(45),z(18.5),-Math.PI/2,1);
    place('gantry',x(9),z(17),0,1);
    place('gantry',x(25),z(37),0,1);
  }
  if(assets?.details){
    const placeDetail=(name,wx,wz,rotation=0,scale=1)=>{
      const source=assets.details.scene.getObjectByName(`detail_${name}`);if(!source)return;
      const model=source.clone(true);model.position.set(wx,0,wz);model.rotation.y=rotation;model.scale.setScalar(scale);group.add(model);
    };
    placeDetail('generator',x(24),z(7),-.4,1.35);
    placeDetail('generator',x(11),z(21),1.1,1.35);
    placeDetail('generator',x(43),z(13),.8,1.35);
    for(const [tx,tz,rot] of [[22.1,7,Math.PI/2],[31.8,19,-Math.PI/2],[4.1,22,Math.PI/2],[45.9,17,-Math.PI/2],[20.1,38,Math.PI/2]])placeDetail('utility',x(tx),z(tz),rot,1.1);
  }
  return {group,doors};
}

export function makeEnemy(type, assets) {
  if(type!=='drone'&&assets?.human){
    const group=new THREE.Group(),model=cloneSkeleton(assets.human.scene);
    const scale=type==='boss'?1.48:type==='tank'?1.16:1.0;
    model.scale.set(type==='tank'?scale*1.12:scale,scale,scale);group.add(model);
    const copyMap=new Map();model.traverse(child=>{
      if(!child.isMesh)return;
      const copy=material=>{
        if(!copyMap.has(material)){
          const cloned=material.clone();
          if(/Finley.*(top|bottom)|helmet.*red|reflective lime/i.test(material.name))cloned.color?.multiply(new THREE.Color(0x737762));
          if(type==='runner')cloned.color?.multiply(new THREE.Color(0x9b7c6a));
          if(type==='boss')cloned.color?.multiply(new THREE.Color(0xc48467));
          copyMap.set(material,cloned);
        }
        return copyMap.get(material);
      };
      child.material=Array.isArray(child.material)?child.material.map(copy):copy(child.material);
    });
    const parts={legL:model.getObjectByName('leg_L'),legR:model.getObjectByName('leg_R'),armL:model.getObjectByName('arm_L'),armR:model.getObjectByName('arm_R')};
    parts.legLBase=parts.legL?.rotation.x??0;parts.legRBase=parts.legR?.rotation.x??0;
    return {group,parts,radius:(type==='boss'?.78:.53)*scale,height:1.9*scale};
  }
  if(assets?.models?.[`enemy_${type}`]){
    const group=assets.models[`enemy_${type}`].clone(true);group.position.set(0,0,0);
    const localMaterials=new Map();group.traverse(child=>{if(!child.isMesh)return;const copy=material=>{if(!localMaterials.has(material)){const cloned=material.clone();cloned.onBeforeCompile=material.onBeforeCompile;cloned.customProgramCacheKey=material.customProgramCacheKey;localMaterials.set(material,cloned);}return localMaterials.get(material);};child.material=Array.isArray(child.material)?child.material.map(copy):copy(child.material);});
    const part=prefix=>{let found;group.traverse(child=>{if(!found&&child.name.startsWith(prefix))found=child;});return found;};
    const parts={legL:part('leg_L'),legR:part('leg_R'),armL:part('arm_L'),armR:part('arm_R'),hover:type==='drone'};
    const scale=type==='boss'?1.62:type==='tank'?1.18:1;
    return {group,parts,radius:type==='drone'?.75:(type==='boss'?.85*scale:type==='tank'?.82:.56),height:type==='drone'?1.7:2.15*scale};
  }
  const group=new THREE.Group(); const parts={};
  const material=(color,emissive=0)=>new THREE.MeshStandardMaterial({color,roughness:.76,metalness:.38,emissive,emissiveIntensity:.6});
  const bodyMat=material(type==='runner'?0x786452:type==='tank'?0x765744:0x526865);
  const darkMat=material(0x242b2b), lightMat=material(0xe6aa6c,0x9e340a), steel=material(0x85928b);
  const add=(geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);group.add(m);return m;};
  if(type==='drone'){
    add(new THREE.OctahedronGeometry(.58,0),darkMat,0,1.65,0);
    add(new THREE.SphereGeometry(.22,8,6),lightMat,0,1.65,.48);
    for(const side of [-1,1]){add(new THREE.BoxGeometry(.8,.1,.16),steel,side*.72,1.7,0);add(new THREE.CylinderGeometry(.3,.3,.07,8),darkMat,side*1.08,1.72,0);}
    parts.hover=true; return {group,parts,radius:.75,height:1.7};
  }
  const big=type==='tank'||type==='boss', scale=type==='boss'?1.65:type==='tank'?1.22:1;
  const legGeo=new THREE.BoxGeometry(.29*scale,.75*scale,.31*scale);
  parts.legL=add(legGeo,darkMat,-.22*scale,.4*scale,0);parts.legR=add(legGeo,darkMat,.22*scale,.4*scale,0);
  add(new THREE.BoxGeometry((big?.98:.72)*scale,.95*scale,.48*scale),bodyMat,0,1.16*scale,0);
  add(new THREE.BoxGeometry(.52*scale,.18*scale,.52*scale),darkMat,0,1.63*scale,0);
  add(new THREE.BoxGeometry(.5*scale,.5*scale,.46*scale),type==='runner'?bodyMat:darkMat,0,1.92*scale,0);
  add(new THREE.BoxGeometry(.37*scale,.1*scale,.035*scale),lightMat,0,1.98*scale,.25*scale);
  parts.armL=add(new THREE.BoxGeometry(.23*scale,.78*scale,.26*scale),bodyMat,-.52*scale,1.22*scale,.02);
  parts.armR=add(new THREE.BoxGeometry(.23*scale,.78*scale,.26*scale),bodyMat,.52*scale,1.22*scale,.02);
  if(type==='runner'){
    add(new THREE.BoxGeometry(.09,.76,.12),steel,.65,1.13,.35,Math.PI/3);
  }else{
    add(new THREE.BoxGeometry(.25*scale,.2*scale,.9*scale),darkMat,.5*scale,1.11*scale,.46*scale);
    add(new THREE.BoxGeometry(.16*scale,.12*scale,.25*scale),steel,.5*scale,1.11*scale,.99*scale);
  }
  if(big){
    add(new THREE.BoxGeometry(1.2*scale,.22*scale,.62*scale),bodyMat,0,1.57*scale,0);
    add(new THREE.SphereGeometry(.19*scale,8,6),lightMat,0,1.2*scale,.29*scale);
  }
  return {group,parts,radius:big?.85*scale:.56,height:2.15*scale};
}

export function makePickup(type) {
  const group=new THREE.Group();
  const colors={health:0xf3e5ca,armor:0x74b9b0,bullets:0xd5ab57,shells:0xe45d45,nails:0x8da9a2,rockets:0xe88d43,red:0xf14c3d,yellow:0xe6c455,shotgun:0xb48a64,nailgun:0x7c9991,launcher:0x9c8a68};
  const color=colors[type]??0xffffff;
  if(type==='red'||type==='yellow'){
    box(group,0,.35,0,.48,.7,.1,color,{emissive:color,emissiveIntensity:.45}); box(group,0,.5,.06,.3,.1,.02,0xe8eadc);
  } else if(['shotgun','nailgun','launcher'].includes(type)){
    box(group,0,.4,0,1,.2,.28,0x313d3a);box(group,.2,.54,0,.6,.2,.22,color);box(group,-.4,.28,0,.18,.36,.2,0x594a3a);
  } else {
    box(group,0,.35,0,.65,.55,.65,color);
    if(type==='health'){box(group,0,.36,.34,.42,.1,.03,0xb12f2b);box(group,0,.36,.35,.1,.4,.03,0xb12f2b);}
    else box(group,0,.35,.34,.4,.12,.03,0x1d2928);
  }
  const ring=new THREE.Mesh(new THREE.RingGeometry(.48,.57,24),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.7,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.03;group.add(ring);
  return group;
}

export function makeWeapon(type, assets) {
  if(type==='pistol'&&assets?.revolver){
    const group=new THREE.Group(),weapon=cloneSkeleton(assets.revolver.scene),hand=assets.models.weapon_hand.clone(true);
    weapon.position.set(0,-.08,.02);weapon.rotation.y=Math.PI/2;weapon.scale.setScalar(2.25);hand.position.set(0,0,0);
    group.add(weapon,hand);group.position.set(.46,-.47,-.72);group.rotation.y=-.08;
    const clip=assets.revolver.animations.find(animation=>animation.name==='Shoot');
    if(clip){const mixer=new THREE.AnimationMixer(weapon),action=mixer.clipAction(clip);action.setLoop(THREE.LoopOnce,1);group.userData.mixer=mixer;group.userData.fireAction=action;}
    return group;
  }
  if(assets?.models?.[`weapon_${type}`]){
    const group=assets.models[`weapon_${type}`].clone(true);group.position.set(.46,-.47,-.72);group.rotation.y=-.08;return group;
  }
  const group=new THREE.Group(); const steel=0x3b4645, dark=0x1b2424, grip=0x655445;
  // View models are deliberately low-poly, like the rest of the world.
  if(type==='fist'){
    box(group,.04,-.09,.05,.24,.26,.45,0x56645c);box(group,.04,.02,-.19,.3,.22,.25,0x9d8c78);
  }else if(type==='pistol'){
    box(group,0,-.03,-.28,.19,.17,.48,steel);box(group,0,-.14,-.08,.13,.27,.14,grip);cylinder(group,0,-.02,-.53,.07,.07,.2,dark).rotation.x=Math.PI/2;
  }else if(type==='shotgun'){
    box(group,0,-.06,-.4,.22,.16,.75,grip);cylinder(group,0,.01,-.63,.075,.075,.7,steel).rotation.x=Math.PI/2;box(group,0,-.14,-.32,.25,.14,.3,0x8a7053);
  }else if(type==='nailgun'){
    box(group,0,-.03,-.4,.28,.25,.66,steel);box(group,0,-.23,-.24,.16,.32,.18,dark);box(group,0,-.22,-.57,.24,.22,.32,0x78633c);cylinder(group,0,.02,-.77,.06,.06,.2,dark).rotation.x=Math.PI/2;
  }else{
    cylinder(group,0,.02,-.43,.19,.22,.85,0x566258).rotation.x=Math.PI/2;cylinder(group,0,.02,-.9,.21,.21,.16,dark).rotation.x=Math.PI/2;box(group,0,-.22,-.2,.16,.35,.2,grip);box(group,0,.24,-.25,.15,.1,.4,0x9a9271);
  }
  if(type!=='fist'){box(group,.13,-.27,-.05,.23,.19,.42,0x65716a);box(group,.08,-.18,-.12,.18,.15,.2,0xa29078);}
  group.position.set(.46,-.47,-.72); group.rotation.y=-.08;
  return group;
}

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { SSAOPass } from 'three/addons/postprocessing/SSAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createLevel, TILE, SPAWN, CHECKPOINT, EXIT, DOORS, ENEMY_SPAWNS, PICKUP_SPAWNS, tileCenter, worldToTile, tileBlocked, canStand, lineClear, areaAt } from './level.js';
import { buildWorld, makeEnemy, makePickup, makeWeapon } from './visuals.js';
import { findPath, detectsPlayer, chooseTactic, intersectsObstacle, clearOfObstacles } from './navigation.js';

const WEAPONS = {
  fist: { label:'STAHLFAUST', delay:.48, damage:32, range:2.7, ammo:null },
  pistol: { label:'SCHROTTREVOLVER', delay:.26, damage:23, range:75, ammo:'bullets' },
  shotgun: { label:'PUMP-SCHROTFLINTE', delay:.83, damage:9, range:36, ammo:'shells' },
  nailgun: { label:'NAGELWERFER', delay:.095, damage:9, range:60, ammo:'nails' },
  launcher: { label:'RAKETENWERFER', delay:.9, damage:120, range:70, ammo:'rockets' }
};
const ORDER=['fist','pistol','shotgun','nailgun','launcher'];
const ENEMIES={
  runner:{health:48,speed:3.6,damage:13,delay:1.05},
  guard:{health:70,speed:2.0,damage:11,delay:1.8},
  drone:{health:55,speed:2.8,damage:8,delay:1.35},
  tank:{health:190,speed:1.25,damage:20,delay:2.25},
  boss:{health:1000,speed:1.5,damage:19,delay:1.45}
};
const AREA_NAMES={arrival:'ANLIEFERUNG',hub:'ZENTRALE',foundry:'SCHMELZE',service:'WARTUNGSTUNNEL',archive:'ARCHIV',reactor:'REAKTOR'};
const pickNames={health:'VERBANDKASTEN +25',armor:'RÜSTUNG +25',bullets:'REVOLVERMUNITION',shells:'SCHROTFLINTENMUNITION',nails:'NÄGEL',rockets:'RAKETEN',shotgun:'PUMP-SCHROTFLINTE GEFUNDEN',nailgun:'NAGELWERFER GEFUNDEN',launcher:'RAKETENWERFER GEFUNDEN',red:'ROTE ZUGANGSKARTE',yellow:'GELBE ZUGANGSKARTE'};
const clamp=THREE.MathUtils.clamp;

export class Game {
  constructor(viewport,audio,callbacks,settings,assets){
    this.audio=audio;this.callbacks=callbacks;this.settings=settings;this.assets=assets;
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.5));this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.16;
    viewport.appendChild(this.renderer.domElement);this.canvas=this.renderer.domElement;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color(0x121b1c);this.scene.fog=new THREE.FogExp2(0x1a2524,.016);
    const environment=new THREE.PMREMGenerator(this.renderer);this.scene.environment=environment.fromScene(new RoomEnvironment(),.04).texture;this.scene.environmentIntensity=.3;environment.dispose();
    this.camera=new THREE.PerspectiveCamera(settings.fov,innerWidth/innerHeight,.08,130);this.camera.rotation.order='YXZ';this.scene.add(this.camera);
    const torch=new THREE.SpotLight(0xdce9d7,43,34,.62,.8,1.6);torch.position.set(0,.16,-.1);torch.target.position.set(0,-.12,-5);this.camera.add(torch,torch.target);
    const handsLight=new THREE.PointLight(0xe3e3cf,2.5,3,2);handsLight.position.set(.35,.1,.15);this.camera.add(handsLight);
    this.muzzleLight=new THREE.PointLight(0xffa34d,0,12,2);this.muzzleLight.position.set(.35,-.3,-1);this.camera.add(this.muzzleLight);this.muzzleTime=0;
    this.composer=new EffectComposer(this.renderer);this.composer.addPass(new RenderPass(this.scene,this.camera));
    this.occlusion=new SSAOPass(this.scene,this.camera,innerWidth,innerHeight,12);this.occlusion.kernelRadius=5;this.occlusion.minDistance=.003;this.occlusion.maxDistance=.12;this.occlusion.enabled=settings.quality!=='performance';this.composer.addPass(this.occlusion);
    this.bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.18,.35,.9);this.composer.addPass(this.bloom);this.composer.addPass(new OutputPass());
    this.level=createLevel();this.world=buildWorld(this.scene,this.level,assets);this.dynamic=new THREE.Group();this.scene.add(this.dynamic);
    this.projectileGeo=new THREE.SphereGeometry(.15,8,6);
    this.projectileMat=new THREE.MeshBasicMaterial({color:0xff8a43});this.rocketMat=new THREE.MeshStandardMaterial({color:0xe1a044,emissive:0x843000});
    this.keys=new Set();this.pointerDown=false;this.fallbackLook=false;this.lastPointer=null;this.mode='menu';this.lastTime=performance.now();this.elapsedVisual=0;
    this.hitTime=0;this.hurtTime=0;this.recoil=0;this.cooldown=0;this.stepTimer=0;this.snapshot=null;
    this.reset();this.mode='menu';
    window.addEventListener('resize',()=>this.resize());
    window.addEventListener('keydown',e=>this.keyDown(e));window.addEventListener('keyup',e=>this.keys.delete(e.code));
    window.addEventListener('mousemove',e=>this.mouseMove(e));
    window.addEventListener('mousedown',e=>{if(e.button===0&&this.mode==='playing'&&(document.pointerLockElement===this.canvas||(this.fallbackLook&&e.target===this.canvas)))this.pointerDown=true;});
    window.addEventListener('mouseup',e=>{if(e.button===0)this.pointerDown=false;});
    window.addEventListener('wheel',e=>{if(this.mode==='playing'){e.preventDefault();this.cycleWeapon(e.deltaY>0?1:-1);}},{passive:false});
    requestAnimationFrame(t=>this.frame(t));
  }
  resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.composer.setSize(innerWidth,innerHeight);}
  updateSettings(settings){this.settings=settings;this.camera.fov=settings.fov;this.camera.updateProjectionMatrix();this.audio.setVolume(settings.volume/100);this.occlusion.enabled=settings.quality!=='performance';this.bloom.enabled=settings.quality!=='performance';}
  reset(snapshot=null){
    this.dynamic.clear();this.enemies=[];this.pickups=[];this.projectiles=[];this.particles=[];this.tracers=[];this.openDoors=new Set(snapshot?.openDoors??[]);
    for(const [id,group] of Object.entries(this.world.doors)) group.visible=!this.openDoors.has(id);
    this.player={x:tileCenter(snapshot?CHECKPOINT.x:SPAWN.x),z:tileCenter(snapshot?CHECKPOINT.z:SPAWN.z),feet:0,vy:0,yaw:Math.PI,pitch:0,health:snapshot?.health??100,armor:snapshot?.armor??0};
    this.red=snapshot?.red??false;this.yellow=snapshot?.yellow??false;
    this.inventory=new Set(snapshot?.inventory??['fist','pistol']);
    this.ammo={bullets:72,shells:0,nails:0,rockets:0,...snapshot?.ammo};
    this.weapon=snapshot?.weapon??'pistol';this.playTime=snapshot?.playTime??0;this.killCount=snapshot?.killCount??0;
    this.secretCount=snapshot?.secretCount??0;this.killedIds=new Set(snapshot?.killedIds??[]);this.collectedIds=new Set(snapshot?.collectedIds??[]);this.storyEvents=new Set(snapshot?.storyEvents??[]);
    this.bossAwake=false;this.bossDead=false;this.bossPhase=false;this.checkpointReached=Boolean(snapshot);this.cooldown=0;this.recoil=0;this.pointerDown=false;this.keys.clear();
    if(!snapshot)this.snapshot=null;
    ENEMY_SPAWNS.forEach(([type,x,z],id)=>{if(!this.killedIds.has(id))this.spawnEnemy(type,x,z,id);});
    PICKUP_SPAWNS.forEach(([type,x,z],id)=>{if(!this.collectedIds.has(id))this.spawnPickup(type,x,z,id);});
    this.exitMesh=new THREE.Group();
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.05,.07,8,32),new THREE.MeshBasicMaterial({color:0x85e3ba}));ring.rotation.x=Math.PI/2;this.exitMesh.add(ring);
    const beam=new THREE.Mesh(new THREE.CylinderGeometry(.45,.9,3,12,1,true),new THREE.MeshBasicMaterial({color:0x70d9a4,transparent:true,opacity:.14,side:THREE.DoubleSide,depthWrite:false}));beam.position.y=1.5;this.exitMesh.add(beam);
    this.exitMesh.position.set(tileCenter(EXIT.x),.08,tileCenter(EXIT.z));this.exitMesh.visible=false;this.dynamic.add(this.exitMesh);
    this.setWeapon(this.weapon,true);this.updateCamera(0,false);this.emit();
  }
  spawnEnemy(type,x,z,id){
    const model=makeEnemy(type,this.assets), stats=ENEMIES[type];model.group.position.set(tileCenter(x),0,tileCenter(z));this.dynamic.add(model.group);
    this.enemies.push({id,type,...model,health:stats.health,maxHealth:stats.health,attack:Math.random()*1.1+.5,aware:0,hitFlash:0,walk:Math.random()*6,
      windup:0, lastSeen:null, route:[], routeTimer:0, routeKey:'', strafeDirection:id%2?1:-1, strafeTimer:1.4+(id%3)*.5, deathTime:0});
  }
  spawnPickup(type,x,z,id){const mesh=makePickup(type);mesh.position.set(tileCenter(x),.05,tileCenter(z));this.dynamic.add(mesh);this.pickups.push({id,type,mesh,baseY:.05,phase:id});}
  setWeapon(type,force=false){
    if(!force&&!this.inventory.has(type))return;
    this.weapon=type;if(this.weaponMesh)this.camera.remove(this.weaponMesh);this.weaponMesh=makeWeapon(type,this.assets);this.camera.add(this.weaponMesh);this.recoil=0;this.emit();
  }
  cycleWeapon(direction){const owned=ORDER.filter(w=>this.inventory.has(w)),i=owned.indexOf(this.weapon);this.setWeapon(owned[(i+direction+owned.length)%owned.length]);}
  keyDown(e){
    if(this.mode!=='playing')return;
    if(['Space','KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
    this.keys.add(e.code);
    if(e.repeat)return;
    if(e.code==='Space'&&this.player.feet<=.001){this.player.vy=6.8;}
    if(e.code==='KeyE')this.interact();
    if(/^Digit[1-5]$/.test(e.code))this.setWeapon(ORDER[Number(e.code.slice(-1))-1]);
  }
  mouseMove(e){
    if(this.mode!=='playing')return;
    if(document.pointerLockElement===this.canvas){this.player.yaw-=e.movementX*.0021*this.settings.sensitivity;this.player.pitch=clamp(this.player.pitch-e.movementY*.0021*this.settings.sensitivity,-1.42,1.42);return;}
    if(this.fallbackLook&&e.target===this.canvas){
      if(this.lastPointer){this.player.yaw-=(e.clientX-this.lastPointer.x)*.0021*this.settings.sensitivity;this.player.pitch=clamp(this.player.pitch-(e.clientY-this.lastPointer.y)*.0021*this.settings.sensitivity,-1.42,1.42);}
      this.lastPointer={x:e.clientX,y:e.clientY};
    }else this.lastPointer=null;
  }
  setMode(mode){this.mode=mode;this.pointerDown=false;this.keys.clear();this.audio.setAmbient(mode==='playing');}
  interact(){
    const near=this.nearestDoor();if(!near)return;
    if(near.kind==='key'&&!this[near.key]){this.message(`ZUGANG GESPERRT · ${near.key==='red'?'ROTE':'GELBE'} KARTE BENÖTIGT`);this.audio.play('hurt');return;}
    this.openDoors.add(near.id);this.world.doors[near.id].visible=false;this.audio.play('door');
    if(near.kind==='secret'){this.secretCount++;this.message(`GEHEIMNIS GEFUNDEN · ${this.secretCount} / 3`);}else this.message('ZUGANG FREIGEGEBEN');
    this.emit();
  }
  nearestDoor(){
    let best=null,distance=4.15;
    for(const door of DOORS){if(this.openDoors.has(door.id))continue;for(const [x,z] of door.cells){const d=Math.hypot(this.player.x-tileCenter(x),this.player.z-tileCenter(z));if(d<distance){distance=d;best=door;}}}
    return best;
  }
  move(dt){
    const p=this.player, f=(this.keys.has('KeyW')?1:0)-(this.keys.has('KeyS')?1:0),s=(this.keys.has('KeyD')?1:0)-(this.keys.has('KeyA')?1:0);
    const len=Math.hypot(f,s)||1, speed=9.2;
    const oldX=p.x,oldZ=p.z;
    const dx=(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)/len*speed*dt,dz=(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)/len*speed*dt;
    if(this.canMove(p.x+dx,p.z,.42))p.x+=dx;
    if(this.canMove(p.x,p.z+dz,.42))p.z+=dz;
    p.vy-=18*dt;p.feet=Math.max(0,p.feet+p.vy*dt);if(p.feet===0&&p.vy<0)p.vy=0;
    const moving=Math.hypot(p.x-oldX,p.z-oldZ)>.0001;this.stepTimer-=dt;
    if(moving&&p.feet===0&&this.stepTimer<=0){this.audio.play('step');this.stepTimer=.38;}
    if(!moving)this.stepTimer=Math.min(this.stepTimer,.12);
    return moving;
  }
  canMove(x,z,radius){return canStand(this.level,x,z,radius,this.openDoors)&&!intersectsObstacle(x,z,radius,this.world.obstacles);}
  canSee(ax,az,bx,bz){return lineClear(this.level,ax,az,bx,bz,this.openDoors)&&clearOfObstacles(ax,az,bx,bz,this.world.obstacles);}
  updateCamera(dt,moving){
    const p=this.player,bob=moving&&p.feet===0?Math.sin(this.playTime*10)*.035:0;
    this.camera.position.set(p.x,1.65+p.feet+bob,p.z);this.camera.rotation.set(p.pitch,p.yaw,0,'YXZ');
    if(this.weaponMesh){this.recoil=Math.max(0,this.recoil-dt*4.8);this.weaponMesh.position.set(.46+(moving?Math.sin(this.playTime*5)*.015:0),-.47+(moving?Math.abs(Math.sin(this.playTime*5))*.012:0)-this.recoil*.12,-.72+this.recoil*.2);this.weaponMesh.rotation.x=this.recoil*.18;this.weaponMesh.userData.mixer?.update(dt);}
  }
  fire(){
    if(this.cooldown>0)return;
    const gun=WEAPONS[this.weapon];
    if(gun.ammo&&this.ammo[gun.ammo]<=0){this.cooldown=.2;this.message('KEINE MUNITION');return;}
    if(gun.ammo)this.ammo[gun.ammo]--;
    this.cooldown=gun.delay;this.recoil=1;this.muzzleTime=this.weapon==='fist'?0:.07;this.weaponMesh?.userData.fireAction?.reset().play();this.audio.play(this.weapon);
    if(this.weapon!=='fist')this.alertEnemies(this.player.x,this.player.z,this.weapon==='shotgun'||this.weapon==='launcher'?38:28);
    if(this.weapon==='launcher'){
      const direction=new THREE.Vector3();this.camera.getWorldDirection(direction);
      const mesh=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),this.rocketMat);mesh.position.copy(this.camera.position).addScaledVector(direction,.65);this.dynamic.add(mesh);
      this.projectiles.push({mesh,velocity:direction.multiplyScalar(22),damage:gun.damage,owner:'player',life:4});
    } else {
      const shots=this.weapon==='shotgun'?8:1,spread=this.weapon==='shotgun'?.075:this.weapon==='nailgun'?.012:0;
      for(let i=0;i<shots;i++)this.hitscan(gun,spread,i===0);
    }
    this.emit();
  }
  hitscan(gun,spread,showTracer=true){
    const direction=new THREE.Vector3();this.camera.getWorldDirection(direction);
    direction.add(new THREE.Vector3((Math.random()-.5)*spread,(Math.random()-.5)*spread,(Math.random()-.5)*spread)).normalize();
    const origin=this.camera.position,ray=new THREE.Ray(origin,direction);let target=null,nearest=gun.range;
    for(const enemy of this.enemies){
      if(enemy.health<=0)continue;
      const center=enemy.group.position.clone().add(new THREE.Vector3(0,enemy.height*.62,0));
      const t=center.clone().sub(origin).dot(direction);if(t<0||t>nearest)continue;
      if(ray.distanceSqToPoint(center)>enemy.radius*enemy.radius)continue;
      if(!this.canSee(origin.x,origin.z,center.x,center.z))continue;
      nearest=t;target=enemy;
    }
    if(target)this.damageEnemy(target,gun.damage);
    let hitDistance=target?nearest:gun.range;
    if(!target){
      for(let t=.5;t<gun.range;t+=.3){const p=origin.clone().addScaledVector(direction,t);if(p.y<.05||p.y>4.95||tileBlocked(this.level,worldToTile(p.x),worldToTile(p.z),this.openDoors)||intersectsObstacle(p.x,p.z,0,this.world.obstacles)){hitDistance=Math.max(.5,t-.3);if(showTracer)this.sparks(p.x,p.y,p.z,0xffbd79,5);break;}}
    }
    if(showTracer&&this.weapon!=='fist'){
      const from=origin.clone().addScaledVector(direction,.8),to=origin.clone().addScaledVector(direction,hitDistance);
      const geometry=new THREE.BufferGeometry().setFromPoints([from,to]);
      const line=new THREE.Line(geometry,new THREE.LineBasicMaterial({color:0xffcb86,transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending}));
      this.dynamic.add(line);this.tracers.push({line,life:.055});
    }
  }
  damageEnemy(enemy,damage){
    if(enemy.health<=0)return;enemy.health-=damage;enemy.aware=8;enemy.lastSeen={x:this.player.x,z:this.player.z};enemy.hitFlash=.14;this.hitTime=.13;this.audio.play('hit');
    this.sparks(enemy.group.position.x,enemy.height*.62,enemy.group.position.z,0xffb569,4);
    if(enemy.health<=0){
      this.killedIds.add(enemy.id);this.killCount++;enemy.windup=0;this.audio.play('enemy');this.sparks(enemy.group.position.x,enemy.height*.55,enemy.group.position.z,0xed7d4b,14);
      if(enemy.type==='boss'){this.bossDead=true;this.exitMesh.visible=true;this.message('REAKTOR ABGESCHALTET · ZUM AUSGANG');}
      this.emit();
    }
  }
  damagePlayer(amount){
    if(this.mode!=='playing')return;
    const difficulty={easy:.68,normal:1,hard:1.35}[this.settings.difficulty]??1;
    let damage=amount*difficulty;if(this.player.armor>0){const absorbed=Math.min(this.player.armor,damage*.4);this.player.armor-=absorbed;damage-=absorbed;}
    this.player.health=Math.max(0,this.player.health-damage);this.hurtTime=.35;this.audio.play('hurt');this.emit();
    if(this.player.health<=0){this.setMode('dead');this.audio.play('death');this.callbacks.onDeath(Boolean(this.snapshot));}
  }
  fireEnemy(enemy,angle=0){
    const start=enemy.group.position.clone().add(new THREE.Vector3(0,enemy.type==='drone'?1.65:enemy.height*.65,0));
    const target=this.camera.position.clone();target.x+=(Math.random()-.5)*.7;target.z+=(Math.random()-.5)*.7;
    const velocity=target.sub(start).normalize().applyAxisAngle(new THREE.Vector3(0,1,0),angle).multiplyScalar(enemy.type==='boss'?13:10);
    const mesh=new THREE.Mesh(this.projectileGeo,this.projectileMat);mesh.position.copy(start);if(enemy.type==='boss')mesh.scale.setScalar(1.7);this.dynamic.add(mesh);
    this.projectiles.push({mesh,velocity,damage:ENEMIES[enemy.type].damage,owner:'enemy',life:5});
  }
  alertEnemies(x,z,radius){
    for(const enemy of this.enemies){
      if(enemy.health<=0||(enemy.type==='boss'&&!this.bossAwake))continue;
      const pos=enemy.group.position,dist=Math.hypot(pos.x-x,pos.z-z);
      if(dist>radius)continue;
      // Walls muffle gunfire, but a nearby shot still attracts attention.
      if(dist>radius*.46&&!lineClear(this.level,pos.x,pos.z,x,z,this.openDoors))continue;
      enemy.aware=Math.max(enemy.aware,12);enemy.lastSeen={x,z};enemy.routeTimer=0;
    }
  }
  moveEnemy(enemy,dx,dz,dt){
    const length=Math.hypot(dx,dz);if(length<.01)return false;
    const speed=ENEMIES[enemy.type].speed*(enemy.type==='boss'&&this.bossPhase?1.3:1);
    const step=Math.min(length,speed*dt),mx=dx/length*step,mz=dz/length*step,r=enemy.radius*.7,pos=enemy.group.position;
    let moved=false;
    if(this.canMove(pos.x+mx,pos.z,r)){pos.x+=mx;moved||=Math.abs(mx)>.0001;}
    if(this.canMove(pos.x,pos.z+mz,r)){pos.z+=mz;moved||=Math.abs(mz)>.0001;}
    if(!moved){
      // Sliding sideways gives the pathfinder room to clear a small machine or corner.
      const sx=-mz*enemy.strafeDirection,sz=mx*enemy.strafeDirection;
      if(this.canMove(pos.x+sx,pos.z+sz,r)){pos.x+=sx;pos.z+=sz;moved=true;}
      else enemy.strafeDirection*=-1;
    }
    return moved;
  }
  updateEnemies(dt){
    const p=this.player;
    for(const enemy of this.enemies){
      if(enemy.health<=0){
        enemy.deathTime+=dt;
        if(enemy.type!=='drone')enemy.group.rotation.x=Math.min(1.48,enemy.deathTime*3.7);
        else enemy.group.position.y=Math.max(0,enemy.group.position.y-dt*2);
        continue;
      }
      const dx=p.x-enemy.group.position.x,dz=p.z-enemy.group.position.z,dist=Math.hypot(dx,dz);
      const clear=dist<38&&this.canSee(enemy.group.position.x,enemy.group.position.z,p.x,p.z);
      const visible=detectsPlayer({dx,dz,facing:enemy.group.rotation.y,visible:clear,alert:enemy.aware>0});
      if(enemy.type==='boss'&&!this.bossAwake)continue;
      if(visible){enemy.aware=12;enemy.lastSeen={x:p.x,z:p.z};}else enemy.aware=Math.max(0,enemy.aware-dt);
      enemy.attack-=dt;enemy.routeTimer-=dt;enemy.strafeTimer-=dt;
      if(enemy.parts.hover)enemy.group.position.y=Math.sin(this.elapsedVisual*3+enemy.id)*.16;
      if(enemy.hitFlash>0){enemy.hitFlash-=dt;enemy.group.traverse(o=>{if(o.isMesh&&o.material.emissive)o.material.emissiveIntensity=enemy.hitFlash>0?1.8:.6;});}
      if(!enemy.aware||!enemy.lastSeen){enemy.windup=0;continue;}
      const tactic=chooseTactic(enemy.type,dist,visible);let moved=false;
      if(visible){
        enemy.group.rotation.y=Math.atan2(dx,dz);
        if(tactic==='chase')moved=this.moveEnemy(enemy,dx,dz,dt);
        else if(tactic==='retreat')moved=this.moveEnemy(enemy,-dx,-dz,dt);
        else if(tactic==='strafe'){
          if(enemy.strafeTimer<=0){enemy.strafeDirection*=-1;enemy.strafeTimer=1.4+(enemy.id%4)*.35;}
          moved=this.moveEnemy(enemy,-dz*enemy.strafeDirection,dx*enemy.strafeDirection,dt*.6);
          if(!moved){enemy.strafeDirection*=-1;enemy.strafeTimer=1;}
        }
      } else {
        const pos=enemy.group.position,goal=enemy.lastSeen;
        const key=`${worldToTile(goal.x)},${worldToTile(goal.z)},${this.openDoors.size}`;
        if(enemy.routeTimer<=0||enemy.routeKey!==key){
          enemy.route=findPath(this.level,pos.x,pos.z,goal.x,goal.z,this.openDoors,this.world.obstacles);
          enemy.routeTimer=.8+(enemy.id%4)*.13;enemy.routeKey=key;
        }
        while(enemy.route.length&&Math.hypot(enemy.route[0].x-pos.x,enemy.route[0].z-pos.z)<.5)enemy.route.shift();
        const target=enemy.route[0]??(worldToTile(pos.x)===worldToTile(goal.x)&&worldToTile(pos.z)===worldToTile(goal.z)?goal:null);
        if(target){const mx=target.x-pos.x,mz=target.z-pos.z;enemy.group.rotation.y=Math.atan2(mx,mz);moved=this.moveEnemy(enemy,mx,mz,dt);}
      }
      if(moved)enemy.walk+=dt*7;
      if(enemy.parts.legL&&enemy.parts.legR){const swing=moved?Math.sin(enemy.walk)*.34:0;enemy.parts.legL.rotation.x=(enemy.parts.legLBase??0)+swing;enemy.parts.legR.rotation.x=(enemy.parts.legRBase??0)-swing;}
      if(enemy.windup>0){
        enemy.windup-=dt;
        if(enemy.windup<=0){
          if(visible&&enemy.type==='runner'&&dist<2.5)this.damagePlayer(ENEMIES.runner.damage);
          else if(visible&&enemy.type!=='runner'&&dist<30){this.fireEnemy(enemy);if(enemy.type==='boss'&&this.bossPhase){this.fireEnemy(enemy,-.14);this.fireEnemy(enemy,.14);}}
          enemy.attack=ENEMIES[enemy.type].delay*(enemy.type==='boss'&&this.bossPhase?.7:1);
        }
      }else if(visible&&enemy.attack<=0&&((enemy.type==='runner'&&dist<2.5)||(enemy.type!=='runner'&&dist<30))){
        enemy.windup=enemy.type==='runner'?.22:enemy.type==='tank'?.48:.3;
      }
      if(enemy.type==='boss'&&!this.bossPhase&&enemy.health<enemy.maxHealth*.5){
        this.bossPhase=true;this.message('REAKTOR INSTABIL · SIEGRIST GREIFT AN');
        this.spawnEnemy('drone',22,39,1001);this.spawnEnemy('drone',28,39,1002);
      }
    }
  }
  updateProjectiles(dt){
    for(let i=this.projectiles.length-1;i>=0;i--){
      const p=this.projectiles[i],prev=p.mesh.position.clone();p.life-=dt;p.mesh.position.addScaledVector(p.velocity,dt);
      const pos=p.mesh.position,wall=pos.y<.05||pos.y>4.95||tileBlocked(this.level,worldToTile(pos.x),worldToTile(pos.z),this.openDoors)||intersectsObstacle(pos.x,pos.z,.12,this.world.obstacles);
      let impact=wall||p.life<=0;
      if(p.owner==='enemy'&&!impact){const target=new THREE.Vector3(this.player.x,this.player.feet+1.1,this.player.z);if(pos.distanceTo(target)<.8){this.damagePlayer(p.damage);impact=true;}}
      if(p.owner==='player'&&!impact)for(const enemy of this.enemies){if(enemy.health>0&&pos.distanceTo(enemy.group.position.clone().add(new THREE.Vector3(0,enemy.height*.6,0)))<enemy.radius){impact=true;break;}}
      if(impact){
        if(p.owner==='player')this.explode(wall?prev:pos,p.damage);
        else this.sparks(pos.x,pos.y,pos.z,0xf48749,4);
        this.dynamic.remove(p.mesh);this.projectiles.splice(i,1);
      }
    }
  }
  explode(position,damage){
    this.audio.play('explosion');this.sparks(position.x,position.y,position.z,0xffa44c,24);
    for(const enemy of this.enemies){if(enemy.health<=0)continue;const center=enemy.group.position.clone().add(new THREE.Vector3(0,enemy.height*.55,0)),d=position.distanceTo(center);if(d<4&&this.canSee(position.x,position.z,center.x,center.z))this.damageEnemy(enemy,damage*(1-d/5));}
    const d=Math.hypot(position.x-this.player.x,position.z-this.player.z,position.y-(this.player.feet+1));if(d<3.5&&this.canSee(position.x,position.z,this.player.x,this.player.z))this.damagePlayer(damage*.35*(1-d/4));
  }
  sparks(x,y,z,color,count){
    for(let i=0;i<count;i++){const mesh=new THREE.Mesh(new THREE.BoxGeometry(.07,.07,.07),new THREE.MeshBasicMaterial({color}));mesh.position.set(x,y,z);this.dynamic.add(mesh);this.particles.push({mesh,v:new THREE.Vector3((Math.random()-.5)*4,Math.random()*3,(Math.random()-.5)*4),life:.35+Math.random()*.35});}
  }
  updateParticles(dt){for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;p.v.y-=8*dt;p.mesh.position.addScaledVector(p.v,dt);if(p.life<=0){this.dynamic.remove(p.mesh);p.mesh.geometry.dispose();p.mesh.material.dispose();this.particles.splice(i,1);}}}
  updateTracers(dt){for(let i=this.tracers.length-1;i>=0;i--){const p=this.tracers[i];p.life-=dt;if(p.life<=0){this.dynamic.remove(p.line);p.line.geometry.dispose();p.line.material.dispose();this.tracers.splice(i,1);}}}
  collect(pickup){
    const p=this.player,t=pickup.type;let obtained=true;
    if(t==='health'){if(p.health>=100)obtained=false;else p.health=Math.min(100,p.health+25);}
    else if(t==='armor'){if(p.armor>=100)obtained=false;else p.armor=Math.min(100,p.armor+25);}
    else if(t==='red'||t==='yellow')this[t]=true;
    else if(['bullets','shells','nails','rockets'].includes(t)){
      const caps={bullets:180,shells:60,nails:300,rockets:30},amount={bullets:36,shells:12,nails:75,rockets:6};
      if(this.ammo[t]>=caps[t])obtained=false;else this.ammo[t]=Math.min(caps[t],this.ammo[t]+amount[t]);
    }else{
      const ammoType=WEAPONS[t].ammo,amount={shotgun:16,nailgun:100,launcher:6}[t];this.inventory.add(t);this.ammo[ammoType]+=amount;
      this.setWeapon(t);
    }
    if(!obtained)return false;
    this.collectedIds.add(pickup.id);this.dynamic.remove(pickup.mesh);this.audio.play(t==='red'||t==='yellow'?'key':'pickup');this.message(pickNames[t]);this.emit();return true;
  }
  updatePickups(dt){for(let i=this.pickups.length-1;i>=0;i--){const p=this.pickups[i];p.mesh.rotation.y+=dt*.8;p.mesh.position.y=p.baseY+Math.sin(this.elapsedVisual*2+p.phase)*.12;if(Math.hypot(p.mesh.position.x-this.player.x,p.mesh.position.z-this.player.z)<1.25&&this.collect(p))this.pickups.splice(i,1);}}
  saveCheckpoint(){
    this.player.health=Math.max(75,this.player.health);this.checkpointReached=true;
    this.snapshot={health:this.player.health,armor:this.player.armor,red:this.red,yellow:this.yellow,inventory:[...this.inventory],ammo:{...this.ammo},weapon:this.weapon,openDoors:[...this.openDoors],killedIds:[...this.killedIds],collectedIds:[...this.collectedIds],storyEvents:[...this.storyEvents],secretCount:this.secretCount,killCount:this.killCount,playTime:this.playTime};
    this.message('KONTROLLPUNKT ERREICHT');this.audio.play('key');this.emit();
  }
  objective(){if(this.bossDead)return 'VERLASSE DAS WERK';if(this.bossAwake)return 'SCHALTE DEN REAKTOR AB';if(!this.red)return 'FINDE DIE ROTE ZUGANGSKARTE';if(!this.yellow)return 'FINDE DIE GELBE ZUGANGSKARTE';return 'ERREICHE DEN REAKTOR';}
  message(text){this.callbacks.onMessage(text);}
  emit(){
    const boss=this.enemies?.find(e=>e.type==='boss'&&e.health>0);
    this.callbacks.onUpdate({health:Math.ceil(this.player.health),armor:Math.ceil(this.player.armor),weapon:WEAPONS[this.weapon].label,ammo:WEAPONS[this.weapon].ammo?this.ammo[WEAPONS[this.weapon].ammo]:'∞',red:this.red,yellow:this.yellow,objective:this.objective(),area:AREA_NAMES[areaAt(this.level,this.player.x,this.player.z)]??'WERK',time:this.playTime,inventory:this.inventory,boss:this.bossAwake&&boss?boss.health/boss.maxHealth:null,hit:this.hitTime>0,hurt:this.settings.screenEffects?this.hurtTime:0,interaction:this.nearestDoor(),kills:this.killCount,secrets:this.secretCount});
  }
  frame(now){
    const dt=Math.min(.033,Math.max(0,(now-this.lastTime)/1000));this.lastTime=now;this.elapsedVisual+=dt;
    if(this.mode==='playing'){
      this.playTime+=dt;this.cooldown=Math.max(0,this.cooldown-dt);this.hitTime=Math.max(0,this.hitTime-dt);this.hurtTime=Math.max(0,this.hurtTime-dt);
      const moving=this.move(dt);this.updateCamera(dt,moving);if(this.pointerDown)this.fire();
      this.updateEnemies(dt);this.updateProjectiles(dt);this.updatePickups(dt);this.updateParticles(dt);this.updateTracers(dt);
      this.muzzleTime=Math.max(0,this.muzzleTime-dt);this.muzzleLight.intensity=this.muzzleTime>0?14:0;
      const tx=worldToTile(this.player.x),tz=worldToTile(this.player.z);
      const area=areaAt(this.level,this.player.x,this.player.z);
      const story={foundry:'WERKPROTOKOLL: DIE ÖFEN LAUFEN OHNE STROMVERSORGUNG.',service:'SIEGRIST: „SIE SIND NOCH HIER. ICH HÖRE SIE.“',archive:'PROTOKOLL: DER HOHLRAUM WIEDERHOLT UNSERE STIMMEN.'};
      if(story[area]&&!this.storyEvents.has(area)){this.storyEvents.add(area);this.message(story[area]);}
      if(!this.checkpointReached&&tx>=24&&tx<=26&&tz>=32&&tz<=33)this.saveCheckpoint();
      if(!this.bossAwake&&tz>=34&&tx>=20&&tx<=30){this.bossAwake=true;this.message('SIEGRIST: „DU VERSTEHST NICHT, WAS DU ABSCHALTEST.“');}
      if(this.bossDead&&Math.hypot(this.player.x-tileCenter(EXIT.x),this.player.z-tileCenter(EXIT.z))<1.5){this.setMode('won');this.callbacks.onWin({time:this.playTime,kills:this.killCount,secrets:this.secretCount});}
      this.emit();
    } else if(this.mode==='menu'){
      this.player.yaw=Math.PI+Math.sin(this.elapsedVisual*.18)*.12;this.updateCamera(dt,false);
    }
    this.composer.render();requestAnimationFrame(t=>this.frame(t));
  }
}

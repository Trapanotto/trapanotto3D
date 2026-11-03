import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Game } from '../src/game.js';
import { createLevel, tileCenter } from '../src/level.js';

function scenario() {
  const game=Object.create(Game.prototype),group=new THREE.Group();
  group.position.set(tileCenter(25),0,tileCenter(6));
  const enemy={id:1,type:'guard',group,parts:{},radius:.53,height:1.9,
    health:70,maxHealth:70,attack:1,aware:12,hitFlash:0,walk:0,windup:0,
    lastSeen:{x:tileCenter(25),z:tileCenter(9)},route:[],routeTimer:0,routeKey:'',
    strafeDirection:1,strafeTimer:1,deathTime:0};
  Object.assign(game,{level:createLevel(),world:{obstacles:[{x:tileCenter(25),z:tileCenter(7),radius:1}]},
    openDoors:new Set(),player:{x:tileCenter(25),z:tileCenter(9)},enemies:[enemy],
    elapsedVisual:0,bossAwake:false,bossPhase:false,shots:0});
  game.fireEnemy=()=>game.shots++;
  game.damagePlayer=()=>{};
  return {game,enemy};
}

test('an alerted guard follows a path around machinery and attacks after regaining sight',()=>{
  const {game,enemy}=scenario();
  assert.equal(game.canSee(enemy.group.position.x,enemy.group.position.z,game.player.x,game.player.z),false);
  let sidestepped=false;
  for(let i=0;i<400;i++){
    game.elapsedVisual+=.033;game.updateEnemies(.033);
    sidestepped ||= Math.abs(enemy.group.position.x-tileCenter(25))>2;
    assert.equal(game.canMove(enemy.group.position.x,enemy.group.position.z,enemy.radius*.7),true,'enemy stays outside obstacles');
  }
  assert.ok(sidestepped,'guard went around the machine');
  assert.ok(game.shots>0,'guard fires after reaching a clear line of sight');
});

test('a wall muffles distant gunfire while nearby shots alert the guard',()=>{
  const {game,enemy}=scenario();
  enemy.aware=0;enemy.lastSeen=null;
  game.alertEnemies(tileCenter(35),tileCenter(5),60);
  assert.equal(enemy.aware,0);
  game.alertEnemies(tileCenter(25),tileCenter(8),28);
  assert.ok(enemy.aware>0);
  assert.deepEqual(enemy.lastSeen,{x:tileCenter(25),z:tileCenter(8)});
});

test('an alerted guard cannot cross a locked door but follows after it opens',()=>{
  const {game,enemy}=scenario();
  game.world.obstacles=[];
  enemy.group.position.set(tileCenter(33),0,tileCenter(19));
  game.player={x:tileCenter(38),z:tileCenter(19)};
  enemy.lastSeen={...game.player};
  for(let i=0;i<45;i++){game.elapsedVisual+=.033;game.updateEnemies(.033);}
  assert.ok(enemy.group.position.x<tileCenter(34)-2,'closed door blocks pursuit');
  game.openDoors.add('red');
  for(let i=0;i<150;i++){game.elapsedVisual+=.033;game.updateEnemies(.033);}
  assert.ok(enemy.group.position.x>tileCenter(34)-2,'guard entered the opened doorway');
});

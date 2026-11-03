// Exercises real game logic in a WebGL browser. This module is loaded only by Vite's dev server.
import { tileCenter } from '../src/level.js';

export function runBrowserChecks(game){
  const results=[];
  const check=(name,condition)=>{results.push({name,pass:Boolean(condition)});if(!condition)throw new Error(name);};
  const move=(x,z)=>{game.player.x=tileCenter(x);game.player.z=tileCenter(z);game.updateCamera(0,false);};
  const take=type=>{const item=game.pickups.find(p=>p.type===type);if(!item)throw new Error(`Missing pickup ${type}`);const ok=game.collect(item);game.pickups=game.pickups.filter(p=>p!==item);return ok;};
  try {
    game.reset();game.setMode('playing');move(25,5);game.player.yaw=Math.PI;game.updateCamera(0,false);
    const guard=game.enemies.find(e=>e.id===0),health=guard.health,ammo=game.ammo.bullets;
    game.fire();check('Revolver trifft den Gegner',guard.health<health);check('Schuss verbraucht Munition',game.ammo.bullets===ammo-1);
    check('Detailliertes Revolvermodell und Schussanimation geladen',Boolean(game.weaponMesh.userData.mixer&&game.weaponMesh.userData.fireAction));
    move(33,19);game.interact();check('Rote Tür bleibt ohne Karte gesperrt',!game.openDoors.has('red'));
    check('Rote Karte kann aufgenommen werden',take('red')&&game.red);game.interact();check('Rote Karte öffnet Archiv',game.openDoors.has('red'));
    move(25,28);game.interact();check('Gelbe Tür bleibt ohne Karte gesperrt',!game.openDoors.has('yellow'));
    check('Gelbe Karte kann aufgenommen werden',take('yellow')&&game.yellow);game.interact();check('Gelbe Karte öffnet Reaktor',game.openDoors.has('yellow'));
    for(const type of ['shotgun','nailgun','launcher'])check(`${type} wird freigeschaltet`,take(type)&&game.inventory.has(type));
    move(28,5);game.interact();check('Geheimraum öffnet sich',game.openDoors.has('secret-arrival')&&game.secretCount===1);
    const armor=game.player.armor=25;game.player.health=100;game.damagePlayer(10);check('Rüstung absorbiert Schaden',game.player.armor<armor&&game.player.health<100&&game.player.health>90);
    move(25,32);game.saveCheckpoint();const saved=game.snapshot;game.reset(saved);
    check('Kontrollpunkt stellt Karten und Waffen wieder her',game.red&&game.yellow&&game.inventory.has('launcher')&&game.openDoors.has('yellow'));
    check('Kontrollpunkt merkt Geheimnisse',game.secretCount===1&&game.openDoors.has('secret-arrival'));
    game.bossAwake=true;const boss=game.enemies.find(e=>e.type==='boss');game.damageEnemy(boss,9999);
    check('Bossniederlage schaltet Ausgang frei',game.bossDead&&game.exitMesh.visible&&game.objective()==='VERLASSE DAS WERK');
    let won=false;game.callbacks.onWin=()=>{won=true;};move(25,42);game.frame(performance.now());check('Ausgang beendet den Einsatz',won&&game.mode==='won');
  } catch(error){results.push({name:`Fehler: ${error.message}`,pass:false});}
  game.setMode('qa-complete');
  const panel=document.createElement('div');panel.id='qa-results';panel.style.cssText='position:fixed;z-index:9999;inset:0;background:#111;color:white;overflow:auto;padding:30px;font:16px monospace';
  const failed=results.filter(r=>!r.pass).length;
  panel.innerHTML=`<h1>Browser-QA: ${failed?'FEHLER':'BESTANDEN'}</h1><p>${results.length-failed}/${results.length} Prüfungen bestanden</p><ul>${results.map(r=>`<li>${r.pass?'✓':'✗'} ${r.name}</li>`).join('')}</ul>`;
  document.body.appendChild(panel);
}

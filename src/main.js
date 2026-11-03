import './style.css';
import { Game } from './game.js';
import { GameAudio } from './audio.js';
import { tileCenter } from './level.js';
import { loadAssets } from './assets.js';

const $=id=>document.getElementById(id);
const screens=['menu-screen','pause-screen','death-screen','win-screen','settings-screen'];
const defaults={difficulty:'normal',quality:'high',sensitivity:1,fov:78,volume:45,screenEffects:true};
let stored={};try{stored=JSON.parse(localStorage.getItem('trapanotto3d-settings')||'{}');}catch{}
const settings={...defaults,...stored};const audio=new GameAudio();audio.setVolume(settings.volume/100);
let game,settingsReturn='menu-screen',messageTimer=0,lastSlots='',hadPointerLock=false;
const formatTime=seconds=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
function showScreen(id){for(const screen of screens)$(screen).classList.toggle('hidden',screen!==id);}
function setPlayingUI(){showScreen(null);$('game-hud').classList.remove('hidden');}
function storeSettings(){try{localStorage.setItem('trapanotto3d-settings',JSON.stringify(settings));}catch{}}
function syncSettings(){
  for(const id of ['difficulty','quality','sensitivity','fov','volume'])$(id).value=settings[id];$('screen-effects').checked=settings.screenEffects;
  $('sensitivity-value').textContent=`${Number(settings.sensitivity).toFixed(1)}×`;$('fov-value').textContent=`${settings.fov}°`;$('volume-value').textContent=`${settings.volume}%`;
}
function message(text){$('message').textContent=text;$('message').classList.add('visible');clearTimeout(messageTimer);messageTimer=setTimeout(()=>$('message').classList.remove('visible'),4300);}
function updateHud(s){
  $('health').textContent=String(s.health).padStart(2,'0');$('armor').textContent=String(s.armor).padStart(2,'0');$('ammo').textContent=String(s.ammo).padStart(2,'0');
  $('weapon-name').textContent=s.weapon;$('objective').textContent=s.objective;$('area-name').textContent=s.area;$('elapsed').textContent=formatTime(s.time);
  $('key-red').classList.toggle('owned',s.red);$('key-yellow').classList.toggle('owned',s.yellow);
  $('boss-bar').classList.toggle('hidden',s.boss===null);if(s.boss!==null)$('boss-fill').style.width=`${Math.max(0,s.boss)*100}%`;
  $('hit-marker').classList.toggle('visible',s.hit);$('hurt-flash').style.opacity=String(Math.min(.6,s.hurt));
  const near=s.interaction;$('interaction').classList.toggle('hidden',!near);
  if(near)$('interaction').textContent=near.kind==='secret'?'[ E ] UNTERSUCHEN':`[ E ] ${near.key==='red'?'ROTER':'GELBER'} ZUGANG`;
  const slots=['fist','pistol','shotgun','nailgun','launcher'].map((w,i)=>s.inventory.has(w)?String(i+1):'·').join('   ');
  if(slots!==lastSlots){$('weapon-slots').textContent=slots;lastSlots=slots;}
}
function unlockPointer(){
  game.fallbackLook=false;
  const fallback=()=>{if(game.mode==='playing'){game.fallbackLook=true;message('MAUSSTEUERUNG AKTIV · KLICKEN ZUM SCHIESSEN');}};
  try{
    const result=game.canvas.requestPointerLock();
    if(result?.catch)result.catch(fallback);
  }catch{fallback();}
}
function start(snapshot=null){
  audio.start().catch(()=>{});game.reset(snapshot);game.setMode('playing');setPlayingUI();unlockPointer();
  message(snapshot?'KONTROLLPUNKT GELADEN':'SIEGRIST: „MARA, FINDE DIE ZUGANGSKARTEN.“');
}
function resume(){audio.start().catch(()=>{});game.setMode('playing');setPlayingUI();unlockPointer();}
function pause(){if(game.mode!=='playing')return;game.setMode('paused');$('game-hud').classList.add('hidden');showScreen('pause-screen');if(document.pointerLockElement)document.exitPointerLock();}
function menu(){if(document.pointerLockElement)document.exitPointerLock();game.setMode('menu');game.reset();game.setMode('menu');$('game-hud').classList.add('hidden');showScreen('menu-screen');}
function settingsScreen(previous){settingsReturn=previous;syncSettings();showScreen('settings-screen');}

try {
  const assets=await loadAssets();
  game=new Game($('viewport'),audio,{
    onUpdate:updateHud,onMessage:message,
    onDeath:checkpoint=>{if(document.pointerLockElement)document.exitPointerLock();$('game-hud').classList.add('hidden');$('checkpoint-button').classList.toggle('hidden',!checkpoint);showScreen('death-screen');},
    onWin:result=>{
      if(document.pointerLockElement)document.exitPointerLock();$('game-hud').classList.add('hidden');
      let best=result.time;try{const storedBest=Number(localStorage.getItem('trapanotto3d-best'));if(storedBest>0)best=Math.min(storedBest,result.time);localStorage.setItem('trapanotto3d-best',String(best));}catch{}
      $('run-stats').innerHTML=`<span>ZEIT <b>${formatTime(result.time)}</b></span><span>BESTZEIT <b>${formatTime(best)}</b></span><span>GEHEIMNISSE <b>${result.secrets}/3</b></span>`;
      showScreen('win-screen');
    }
  },settings,assets);
  $('boot-status').remove();$('start-button').disabled=false;
}catch(error){console.error(error);$('boot-status').textContent=`SPIEL KONNTE NICHT GESTARTET WERDEN: ${error.message || error}`;$('start-button').disabled=true;}

$('start-button').addEventListener('click',()=>start());$('resume-button').addEventListener('click',resume);
$('restart-button').addEventListener('click',()=>start());$('again-button').addEventListener('click',()=>start());
$('checkpoint-button').addEventListener('click',()=>start(game.snapshot));
for(const id of ['quit-button','death-menu-button','win-menu-button'])$(id).addEventListener('click',menu);
$('settings-button').addEventListener('click',()=>settingsScreen('menu-screen'));
$('pause-settings-button').addEventListener('click',()=>settingsScreen('pause-screen'));
$('settings-close').addEventListener('click',()=>showScreen(settingsReturn));
for(const id of ['difficulty','quality','sensitivity','fov','volume','screen-effects'])$(id).addEventListener('input',()=>{
  settings.difficulty=$('difficulty').value;settings.quality=$('quality').value;settings.sensitivity=Number($('sensitivity').value);settings.fov=Number($('fov').value);settings.volume=Number($('volume').value);settings.screenEffects=$('screen-effects').checked;
  syncSettings();storeSettings();game?.updateSettings(settings);
});
document.addEventListener('pointerlockchange',()=>{
  if(!game)return;
  if(document.pointerLockElement===game.canvas){hadPointerLock=true;game.fallbackLook=false;}
  else if(hadPointerLock){hadPointerLock=false;if(game.mode==='playing')pause();}
});
document.addEventListener('pointerlockerror',()=>{if(game?.mode==='playing'){game.fallbackLook=true;message('MAUSSTEUERUNG AKTIV · KLICKEN ZUM SCHIESSEN');}});
window.addEventListener('blur',()=>{if(game?.mode==='playing')pause();});
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&game?.mode==='playing')pause();});

// Only the development server exposes helpers for automated browser checks.
if(import.meta.env.DEV&&game)window.__TRAPANOTTO_TEST__={game,teleport(x,z){game.player.x=tileCenter(x);game.player.z=tileCenter(z);game.updateCamera(0,false);},start};
if(import.meta.env.DEV&&game&&new URLSearchParams(location.search).has('qa'))import('../tests/browser-qa.js').then(module=>module.runBrowserChecks(game));

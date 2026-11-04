// Exercises real game logic in a WebGL browser. Loaded only by the dev server with ?qa.
import type { Game } from '../src/game.ts';
import type { PickupType } from '../src/world/level.ts';
import { tileCenter } from '../src/world/level.ts';

export function runBrowserChecks(game: Game): void {
  const results: { name: string; pass: boolean }[] = [];
  const check = (name: string, condition: unknown) => {
    results.push({ name, pass: Boolean(condition) });
    if (!condition) throw new Error(name);
  };
  const move = (x: number, z: number) => {
    const p = game.player;
    p.x = p.prevX = tileCenter(x);
    p.z = p.prevZ = tileCenter(z);
  };
  const take = (type: PickupType) => {
    const item = game.pickups.items.find((p) => p.type === type);
    if (!item) throw new Error(`Missing pickup ${type}`);
    const ok = game.collect(item);
    game.pickups.remove(item);
    return ok;
  };
  try {
    game.reset();
    game.setMode('playing');
    move(25, 5);
    game.player.yaw = Math.PI;
    const guard = game.enemies.enemies.find((e) => e.id === 0);
    if (!guard) throw new Error('Wache fehlt');
    const health = guard.health;
    const ammo = game.weapons.ammo.bullets;
    game.weapons.fire();
    check('Revolver trifft den Gegner', guard.health < health);
    check('Schuss verbraucht Munition', game.weapons.ammo.bullets === ammo - 1);
    check(
      'Revolvermodell und Schussanimation geladen',
      Boolean(game.weapons.viewmodel?.mixer && game.weapons.viewmodel.fireAction),
    );
    move(33, 19);
    game.interact();
    check('Rote Tür bleibt ohne Karte gesperrt', !game.world.openDoors.has('red'));
    check('Rote Karte kann aufgenommen werden', take('red') && game.keys.has('red'));
    game.interact();
    check('Rote Karte öffnet Archiv', game.world.openDoors.has('red'));
    move(25, 28);
    game.interact();
    check('Gelbe Tür bleibt ohne Karte gesperrt', !game.world.openDoors.has('yellow'));
    check('Gelbe Karte kann aufgenommen werden', take('yellow') && game.keys.has('yellow'));
    game.interact();
    check('Gelbe Karte öffnet Reaktor', game.world.openDoors.has('yellow'));
    for (const type of ['shotgun', 'nailgun', 'launcher'] as const)
      check(`${type} wird freigeschaltet`, take(type) && game.weapons.inventory.has(type));
    move(28, 5);
    game.interact();
    check(
      'Geheimraum öffnet sich',
      game.world.openDoors.has('secret-arrival') && game.secretCount === 1,
    );
    game.player.armor = 25;
    game.player.health = 100;
    game.damagePlayer(10);
    check(
      'Rüstung absorbiert Schaden',
      game.player.armor < 25 && game.player.health < 100 && game.player.health > 90,
    );
    move(25, 32);
    game.saveCheckpoint();
    const saved = game.snapshot;
    game.reset(saved);
    check(
      'Kontrollpunkt stellt Karten und Waffen wieder her',
      game.keys.has('red') &&
        game.keys.has('yellow') &&
        game.weapons.inventory.has('launcher') &&
        game.world.openDoors.has('yellow'),
    );
    check(
      'Kontrollpunkt merkt Geheimnisse',
      game.secretCount === 1 && game.world.openDoors.has('secret-arrival'),
    );
    game.enemies.bossAwake = true;
    const boss = game.enemies.boss;
    if (!boss) throw new Error('Boss fehlt');
    game.enemies.damage(boss, 9999, game.player);
    check(
      'Bossniederlage schaltet Ausgang frei',
      game.bossDead && game.exitMesh.visible && game.objective() === 'VERLASSE DAS WERK',
    );
    let won = false;
    const original = (game as unknown as { callbacks: { onWin: () => void } }).callbacks;
    original.onWin = () => {
      won = true;
    };
    move(25, 42);
    game.tick(1 / 60);
    check('Ausgang beendet den Einsatz', won && game.mode === 'won');
  } catch (error) {
    results.push({
      name: `Fehler: ${error instanceof Error ? error.message : error}`,
      pass: false,
    });
  }
  game.setMode('qa-complete');
  const panel = document.createElement('div');
  panel.id = 'qa-results';
  panel.style.cssText =
    'position:fixed;z-index:9999;inset:0;background:#111;color:white;overflow:auto;padding:30px;font:16px monospace';
  const failed = results.filter((r) => !r.pass).length;
  panel.innerHTML = `<h1>Browser-QA: ${failed ? 'FEHLER' : 'BESTANDEN'}</h1><p>${results.length - failed}/${results.length} Prüfungen bestanden</p><ul>${results.map((r) => `<li>${r.pass ? '✓' : '✗'} ${r.name}</li>`).join('')}</ul>`;
  document.body.appendChild(panel);
}

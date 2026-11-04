import GUI from 'lil-gui';
import Stats from 'stats-gl';
import { AI } from '../ai/tuning.ts';
import { GRADE, LIGHTING, PLAYER_TUNING } from '../config/tuning.ts';
import { WEAPON_ORDER } from '../config/weapons.ts';
import type { Game } from '../game.ts';
import { VIEWMODEL } from '../render/models.ts';
import { tileCenter } from '../world/level.ts';

const TELEPORTS: Record<string, [number, number]> = {
  Anlieferung: [25, 5],
  Zentrale: [25, 19],
  Schmelze: [9, 20],
  Wartungstunnel: [7, 31],
  Archiv: [40, 17],
  Kontrollpunkt: [25, 31],
  Reaktor: [25, 36],
};

/**
 * Live tuning panel and performance overlay. Opens in the dev server, or in
 * any build with ?debug in the URL. Toggle with F2.
 */
export function createDebugPanel(game: Game): void {
  const stats = new Stats({ trackGPU: true, horizontal: true });
  stats.init(game.pipeline.renderer);
  stats.dom.style.cssText += ';position:fixed;left:0;top:0;z-index:100;';
  document.body.appendChild(stats.dom);
  game.afterRender.add(() => stats.update());

  const gui = new GUI({ title: 'Trapanotto Debug (F2)', width: 300 });
  gui.domElement.style.zIndex = '100';
  const relight = () => game.applyLighting();

  const light = gui.addFolder('Licht');
  light.add(LIGHTING, 'exposure', 0.3, 3, 0.01).name('Belichtung').onChange(relight);
  light.add(LIGHTING, 'hemisphere', 0, 2, 0.01).name('Himmelslicht').onChange(relight);
  light.add(LIGHTING, 'ambient', 0, 1, 0.01).name('Grundlicht').onChange(relight);
  light.add(LIGHTING, 'environment', 0, 1, 0.01).name('Reflexionen').onChange(relight);
  light.add(LIGHTING, 'lampIntensity', 0, 5, 0.05).name('Deckenlampen').onChange(relight);
  light.add(LIGHTING, 'torchIntensity', 0, 200, 1).name('Taschenlampe').onChange(relight);
  light.add(LIGHTING, 'fogDensity', 0, 0.08, 0.001).name('Nebel').onChange(relight);
  light.add(LIGHTING, 'bloomStrength', 0, 2, 0.01).name('Bloom').onChange(relight);

  const grade = gui.addFolder('Farbkorrektur').close();
  const tints = {
    shadows: rgbToHex(GRADE.shadowTint),
    highlights: rgbToHex(GRADE.highlightTint),
  };
  grade
    .addColor(tints, 'shadows')
    .name('Schatten')
    .onChange((hex: string) => {
      GRADE.shadowTint = hexToRgb(hex);
      relight();
    });
  grade
    .addColor(tints, 'highlights')
    .name('Lichter')
    .onChange((hex: string) => {
      GRADE.highlightTint = hexToRgb(hex);
      relight();
    });
  grade.add(GRADE, 'contrast', 0.5, 1.6, 0.01).name('Kontrast').onChange(relight);
  grade.add(GRADE, 'saturation', 0, 1.6, 0.01).name('Sättigung').onChange(relight);

  const view = gui.addFolder('Waffe in der Hand').close();
  view.add(VIEWMODEL, 'yaw', -1, 1, 0.005);
  for (const [name, offset] of [
    ['Andere Waffen', VIEWMODEL.offset],
    ['Revolver-Position', VIEWMODEL.pistolOffset],
  ] as const) {
    const folder = view.addFolder(name);
    folder.add(offset, 'x', -1, 1, 0.005);
    folder.add(offset, 'y', -1, 0.5, 0.005);
    folder.add(offset, 'z', -1.5, 0, 0.005);
  }
  const revolver = view.addFolder('Revolver-Modell');
  revolver.add(VIEWMODEL.revolver, 'x', -0.5, 0.5, 0.005);
  revolver.add(VIEWMODEL.revolver, 'y', -0.5, 0.5, 0.005);
  revolver.add(VIEWMODEL.revolver, 'z', -0.5, 0.5, 0.005);
  revolver.add(VIEWMODEL.revolver, 'rx', -Math.PI, Math.PI, 0.01);
  revolver.add(VIEWMODEL.revolver, 'ry', -Math.PI, Math.PI, 0.01);
  revolver.add(VIEWMODEL.revolver, 'rz', -Math.PI, Math.PI, 0.01);
  revolver.add(VIEWMODEL.revolver, 'scale', 0.2, 4, 0.01);
  view
    .add({ log: () => console.log(JSON.stringify(VIEWMODEL, null, 2)) }, 'log')
    .name('Werte in Konsole');

  const move = gui.addFolder('Spieler').close();
  move.add(PLAYER_TUNING, 'speed', 2, 20, 0.1).name('Tempo');
  move.add(PLAYER_TUNING, 'jumpVelocity', 2, 15, 0.1).name('Sprungkraft');
  move.add(PLAYER_TUNING, 'gravity', 5, 40, 0.5).name('Schwerkraft');

  const ai = gui.addFolder('KI').close();
  ai.add(game.enemies, 'frozen').name('Einfrieren');
  ai.add(AI, 'aimError', 0, 4, 0.05).name('Streuung');
  ai.add(AI, 'shoutRadius', 0, 40, 1).name('Rufweite');
  ai.add(AI, 'lungeSpeed', 2, 20, 0.5).name('Runner-Sprung');
  ai.add(AI, 'burstInterval', 0.05, 0.6, 0.01).name('Salvenabstand');
  for (const difficulty of ['easy', 'normal', 'hard'] as const)
    ai.add(AI.attackTokens, difficulty, 1, 8, 1).name(`Angreifer (${difficulty})`);

  const cheats = gui.addFolder('Cheats').close();
  cheats.add(game, 'godMode').name('Unverwundbar');
  cheats
    .add(
      {
        arsenal: () => {
          for (const weapon of WEAPON_ORDER) game.weapons.inventory.add(weapon);
          Object.assign(game.weapons.ammo, { bullets: 180, shells: 60, nails: 300, rockets: 30 });
          game.keys.add('red').add('yellow');
        },
      },
      'arsenal',
    )
    .name('Alle Waffen + Karten');
  const teleport = { ort: 'Anlieferung' };
  cheats
    .add(teleport, 'ort', Object.keys(TELEPORTS))
    .name('Teleport')
    .onChange((name: string) => {
      const [x, z] = TELEPORTS[name];
      game.player.x = game.player.prevX = tileCenter(x);
      game.player.z = game.player.prevZ = tileCenter(z);
    });

  window.addEventListener('keydown', (e) => {
    if (e.code !== 'F2') return;
    e.preventDefault();
    const hidden = gui._hidden;
    gui.show(hidden);
    stats.dom.style.display = hidden ? '' : 'none';
  });
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  // Tints above 1 are shown at half scale, so the colour picker can represent them.
  const channel = (v: number) =>
    Math.round(Math.min(1, v / 2) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${channel(r)}${channel(g)}${channel(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 127.5, ((n >> 8) & 255) / 127.5, (n & 255) / 127.5];
}

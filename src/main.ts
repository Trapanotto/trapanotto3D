import './style.css';
import { Game } from './game.ts';
import type { Snapshot } from './game/snapshot.ts';
import { GameAudio } from './audio/audio.ts';
import { LINES } from './config/text.ts';
import { loadAssets } from './render/assets.ts';
import { loadSettings, saveSettings } from './settings.ts';
import type { Quality, Settings } from './settings.ts';
import type { Difficulty } from './config/tuning.ts';
import { Hud } from './ui/hud.ts';
import { $, formatTime } from './ui/dom.ts';

type ScreenId = 'menu-screen' | 'pause-screen' | 'death-screen' | 'win-screen' | 'settings-screen';
const SCREENS: ScreenId[] = [
  'menu-screen',
  'pause-screen',
  'death-screen',
  'win-screen',
  'settings-screen',
];
const BEST_KEY = 'trapanotto3d-best';

const settings: Settings = loadSettings();
const audio = new GameAudio();
audio.setVolume(settings.volume / 100);
const hud = new Hud();
let game: Game | undefined;
let settingsReturn: ScreenId = 'menu-screen';
let hadPointerLock = false;

function showScreen(id: ScreenId | null): void {
  for (const screen of SCREENS) $(screen).classList.toggle('hidden', screen !== id);
}
function showHud(visible: boolean): void {
  $('game-hud').classList.toggle('hidden', !visible);
}
function releasePointer(): void {
  if (document.pointerLockElement) document.exitPointerLock();
}

function syncSettingsForm(): void {
  $<HTMLSelectElement>('difficulty').value = settings.difficulty;
  $<HTMLSelectElement>('quality').value = settings.quality;
  $<HTMLInputElement>('sensitivity').value = String(settings.sensitivity);
  $<HTMLInputElement>('fov').value = String(settings.fov);
  $<HTMLInputElement>('volume').value = String(settings.volume);
  $<HTMLInputElement>('screen-effects').checked = settings.screenEffects;
  $('sensitivity-value').textContent = `${settings.sensitivity.toFixed(1)}×`;
  $('fov-value').textContent = `${settings.fov}°`;
  $('volume-value').textContent = `${settings.volume}%`;
}

function readSettingsForm(): void {
  settings.difficulty = $<HTMLSelectElement>('difficulty').value as Difficulty;
  settings.quality = $<HTMLSelectElement>('quality').value as Quality;
  settings.sensitivity = Number($<HTMLInputElement>('sensitivity').value);
  settings.fov = Number($<HTMLInputElement>('fov').value);
  settings.volume = Number($<HTMLInputElement>('volume').value);
  settings.screenEffects = $<HTMLInputElement>('screen-effects').checked;
}

function lockPointer(g: Game): void {
  g.input.fallbackLook = false;
  const fallback = () => {
    if (g.mode !== 'playing') return;
    g.input.fallbackLook = true;
    hud.message(LINES.mouseFallback);
  };
  try {
    const result = g.canvas.requestPointerLock() as unknown as Promise<void> | undefined;
    result?.catch?.(fallback);
  } catch {
    fallback();
  }
}

function start(snapshot: Snapshot | null = null): void {
  if (!game) return;
  audio.start().catch(() => {});
  game.reset(snapshot);
  game.setMode('playing');
  showScreen(null);
  showHud(true);
  lockPointer(game);
  hud.message(snapshot ? LINES.checkpointLoaded : LINES.intro);
}

function resume(): void {
  if (!game) return;
  audio.start().catch(() => {});
  game.setMode('playing');
  showScreen(null);
  showHud(true);
  lockPointer(game);
}

function pause(): void {
  if (game?.mode !== 'playing') return;
  game.setMode('paused');
  showHud(false);
  showScreen('pause-screen');
  releasePointer();
}

function toMenu(): void {
  if (!game) return;
  releasePointer();
  game.reset();
  game.setMode('menu');
  showHud(false);
  showScreen('menu-screen');
}

function openSettings(previous: ScreenId): void {
  settingsReturn = previous;
  syncSettingsForm();
  showScreen('settings-screen');
}

function recordBest(time: number): number {
  try {
    const stored = Number(localStorage.getItem(BEST_KEY));
    const best = stored > 0 ? Math.min(stored, time) : time;
    localStorage.setItem(BEST_KEY, String(best));
    return best;
  } catch {
    return time;
  }
}

try {
  const assets = await loadAssets();
  game = new Game(
    $('viewport'),
    audio,
    {
      onUpdate: (state) => hud.update(state),
      onMessage: (text) => hud.message(text),
      onDeath: (hasCheckpoint) => {
        releasePointer();
        showHud(false);
        $('checkpoint-button').classList.toggle('hidden', !hasCheckpoint);
        showScreen('death-screen');
      },
      onWin: (result) => {
        releasePointer();
        showHud(false);
        const best = recordBest(result.time);
        $('run-stats').innerHTML =
          `<span>ZEIT <b>${formatTime(result.time)}</b></span>` +
          `<span>BESTZEIT <b>${formatTime(best)}</b></span>` +
          `<span>GEHEIMNISSE <b>${result.secrets}/3</b></span>`;
        showScreen('win-screen');
      },
    },
    settings,
    assets,
  );
  $('boot-status').remove();
  $<HTMLButtonElement>('start-button').disabled = false;
} catch (error) {
  console.error(error);
  $('boot-status').textContent =
    `SPIEL KONNTE NICHT GESTARTET WERDEN: ${error instanceof Error ? error.message : error}`;
}

$('start-button').addEventListener('click', () => start());
$('resume-button').addEventListener('click', resume);
$('restart-button').addEventListener('click', () => start());
$('again-button').addEventListener('click', () => start());
$('checkpoint-button').addEventListener('click', () => start(game?.snapshot ?? null));
for (const id of ['quit-button', 'death-menu-button', 'win-menu-button'])
  $(id).addEventListener('click', toMenu);
$('settings-button').addEventListener('click', () => openSettings('menu-screen'));
$('pause-settings-button').addEventListener('click', () => openSettings('pause-screen'));
$('settings-close').addEventListener('click', () => showScreen(settingsReturn));
for (const id of ['difficulty', 'quality', 'sensitivity', 'fov', 'volume', 'screen-effects'])
  $(id).addEventListener('input', () => {
    readSettingsForm();
    syncSettingsForm();
    saveSettings(settings);
    game?.updateSettings(settings);
  });

document.addEventListener('pointerlockchange', () => {
  if (!game) return;
  if (document.pointerLockElement === game.canvas) {
    hadPointerLock = true;
    game.input.fallbackLook = false;
  } else if (hadPointerLock) {
    hadPointerLock = false;
    pause();
  }
});
document.addEventListener('pointerlockerror', () => {
  if (game?.mode !== 'playing') return;
  game.input.fallbackLook = true;
  hud.message(LINES.mouseFallback);
});
window.addEventListener('blur', pause);
window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape') pause();
});

// Developer tools: test helpers in the dev server, debug panel with ?debug (also in production).
const params = new URLSearchParams(location.search);
if (game && import.meta.env.DEV) {
  const g = game;
  (window as unknown as Record<string, unknown>).__TRAPANOTTO_TEST__ = { game: g, start };
  if (params.has('qa')) void import('../tests/browser-qa.ts').then((qa) => qa.runBrowserChecks(g));
}
if (game && (import.meta.env.DEV || params.has('debug'))) {
  const g = game;
  void import('./debug/debug-panel.ts').then((debug) => debug.createDebugPanel(g));
}

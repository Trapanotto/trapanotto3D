import type { HudState } from '../game.ts';
import { WEAPON_ORDER } from '../config/weapons.ts';
import { $, formatTime } from './dom.ts';

const pad = (value: number | string) => String(value).padStart(2, '0');

/** Writes game state into the HUD, touching the DOM only where something changed. */
export class Hud {
  private readonly last = new Map<string, string>();
  private messageTimer = 0;

  update(s: HudState): void {
    this.text('health', pad(s.health));
    this.text('armor', pad(s.armor));
    this.text('ammo', pad(s.ammo));
    this.text('weapon-name', s.weapon);
    this.text('objective', s.objective);
    this.text('area-name', s.area);
    this.text('elapsed', formatTime(s.time));
    $('key-red').classList.toggle('owned', s.keys.has('red'));
    $('key-yellow').classList.toggle('owned', s.keys.has('yellow'));
    $('boss-bar').classList.toggle('hidden', s.boss === null);
    if (s.boss !== null) $('boss-fill').style.width = `${Math.max(0, s.boss) * 100}%`;
    const marker = $('hit-marker');
    marker.classList.toggle('visible', s.hit !== 'none');
    marker.classList.toggle('head', s.hit === 'head');
    marker.classList.toggle('kill', s.hit === 'kill');
    $('hurt-flash').style.opacity = String(Math.min(0.6, s.hurt));
    const door = s.interaction;
    $('interaction').classList.toggle('hidden', !door);
    if (door)
      this.text(
        'interaction',
        door.kind === 'secret'
          ? '[ E ] UNTERSUCHEN'
          : `[ E ] ${door.key === 'red' ? 'ROTER' : 'GELBER'} ZUGANG`,
      );
    this.text(
      'weapon-slots',
      WEAPON_ORDER.map((w, i) => (s.inventory.has(w) ? String(i + 1) : '·')).join('   '),
    );
  }

  message(text: string): void {
    const element = $('message');
    element.textContent = text;
    element.classList.add('visible');
    clearTimeout(this.messageTimer);
    this.messageTimer = window.setTimeout(() => element.classList.remove('visible'), 4300);
  }

  private text(id: string, value: string): void {
    if (this.last.get(id) === value) return;
    this.last.set(id, value);
    $(id).textContent = value;
  }
}

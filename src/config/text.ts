import type { Area } from '../world/level.ts';
import type { PickupType } from '../world/level.ts';

export const AREA_NAMES: Record<Area, string> = {
  arrival: 'ANLIEFERUNG',
  hub: 'ZENTRALE',
  foundry: 'SCHMELZE',
  service: 'WARTUNGSTUNNEL',
  archive: 'ARCHIV',
  reactor: 'REAKTOR',
};

export const PICKUP_NAMES: Record<PickupType, string> = {
  health: 'VERBANDKASTEN +25',
  armor: 'RÜSTUNG +25',
  bullets: 'REVOLVERMUNITION',
  shells: 'SCHROTFLINTENMUNITION',
  nails: 'NÄGEL',
  rockets: 'RAKETEN',
  shotgun: 'PUMP-SCHROTFLINTE GEFUNDEN',
  nailgun: 'NAGELWERFER GEFUNDEN',
  launcher: 'RAKETENWERFER GEFUNDEN',
  red: 'ROTE ZUGANGSKARTE',
  yellow: 'GELBE ZUGANGSKARTE',
};

/** Shown once, the first time the player enters an area. */
export const AREA_STORY: Partial<Record<Area, string>> = {
  foundry: 'WERKPROTOKOLL: DIE ÖFEN LAUFEN OHNE STROMVERSORGUNG.',
  service: 'SIEGRIST: „SIE SIND NOCH HIER. ICH HÖRE SIE.“',
  archive: 'PROTOKOLL: DER HOHLRAUM WIEDERHOLT UNSERE STIMMEN.',
};

export const LINES = {
  intro: 'SIEGRIST: „MARA, FINDE DIE ZUGANGSKARTEN.“',
  bossWakes: 'SIEGRIST: „DU VERSTEHST NICHT, WAS DU ABSCHALTEST.“',
  bossRage: 'REAKTOR INSTABIL · SIEGRIST GREIFT AN',
  bossDead: 'REAKTOR ABGESCHALTET · ZUM AUSGANG',
  checkpoint: 'KONTROLLPUNKT ERREICHT',
  checkpointLoaded: 'KONTROLLPUNKT GELADEN',
  noAmmo: 'KEINE MUNITION',
  doorOpen: 'ZUGANG FREIGEGEBEN',
  mouseFallback: 'MAUSSTEUERUNG AKTIV · KLICKEN ZUM SCHIESSEN',
};

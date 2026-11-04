# Trapanotto 3D – Konzept «Nachtschicht 2.0»

Stand: 4. November 2026 · Basis: `main` @ `6cc20cc` (github.com/Trapanotto/trapanotto3D)

---

## 1. Kurzfazit

Das Spiel funktioniert. Es hat Menü, HUD, Schlüsselkarten, Geheimnisse, Checkpoint, Boss und Tests. Es wirkt aber generiert, weil **alles gleich gewichtet ist und nichts zu Ende gedacht wurde**: Jedes System ist da, aber keines ist ausgearbeitet.

Der Weg zu «Triple-A-Gefühl» im Browser führt **nicht über mehr Inhalt**. Er führt über **15 Minuten Spielzeit, in denen jede Sekunde sitzt**. Zuerst entsteht eine «Vertical Slice», also ein kurzer Abschnitt in Endqualität. Erst danach wird der Rest des Werks gebaut.

> Ein Solo-Browserspiel erreicht nicht den Umfang eines AAA-Studios. Es kann aber **AAA-Qualität pro Minute** erreichen: Licht, Klang, Waffengefühl und Gegnerverhalten auf einem Niveau, bei dem niemand mehr an «Browser-Demo» denkt.

---

## 2. Diagnose: Woran man die «generierte Handschrift» erkennt

### Grafik

| Befund | Ursache im Code | Wirkung |
|---|---|---|
| Alles gleich hell, keine Tiefe | `visuals.js:437-438` HemisphereLight 1.8 + AmbientLight 0.45 + `scene.environmentIntensity` | Licht ohne Richtung, Räume wirken wie ausgeleuchtete Lagerhallen statt wie ein verlassenes Werk bei Nacht |
| Keine Schatten | `renderer.shadowMap` ist nie aktiviert | Objekte «schweben», Taschenlampe ohne Drama |
| Kachel-Welt 4 × 4 × 5 m | `level.js` Raster, `visuals.js:439` jede Wand ist eine `BoxGeometry(4,5,4)` | Gleiche Deckenhöhe überall, rechte Winkel, Korridore wie Doom 1993 |
| Asset-Mischmasch | Poly-Haven-Fotoscans + AI-Texturen + Blender-Primitive + Canvas-Schilder | Keine einheitliche Bildsprache |
| Gegner = ein umgefärbter Feuerwehrmann | `visuals.js:562-583` gleiches Modell, nur `color.multiply` | Gegnertypen sind nicht unterscheidbar |
| «Animation» = Beinrotation, Tod = Umkippen | `game.js:237`, `game.js:272` | Wirkt wie ein Prototyp |
| Partikel = Würfel, Tracer = Linie | `game.js:309`, `game.js:180` | Treffer ohne Wucht |
| Waffe falsch im Bild | `visuals.js:645` Revolver-Skalierung/Rotation | Erster Eindruck im Spiel leidet sofort |

### Gameplay

- **Bewegung:** konstant 9,2 m/s, ohne Beschleunigung, Trägheit, Sprint, Ducken oder Rutschen (`game.js:125`). Es fühlt sich an wie ein Cursor, nicht wie ein Körper.
- **Waffen:** reine Zahlenwerte (Schaden, Verzögerung). Es gibt kein Nachladen, kein Rückstossmuster, kein Zielen über Kimme und keine Eigenheit pro Waffe.
- **Treffer:** eine Kugel-Hitbox pro Gegner (`game.js:166-168`), keine Kopftreffer, keine Trefferreaktion, kein Stagger.
- **KI:** Verfolgen, Seitwärtsschritt, Schiessen. Kein Deckungsverhalten, keine Gruppen, keine Ankündigung von Angriffen, die man lesen kann.
- **Encounter:** 29 Gegner sind über die Karte verteilt (`ENEMY_SPAWNS`). Es gibt keine geplanten Kampfsituationen, keine Höhenunterschiede und keine Umgebung, die man nutzen kann.
- **Story:** drei Textzeilen beim Betreten eines Bereichs. Mara und Siegrist haben keine Stimme, keine Präsenz und kein Motiv.

### Code

- `game.js` ist eine 360-zeilige Gott-Klasse in minifiziertem Einzeilerstil. Das ist schwer zu erweitern und schwer zu reviewen.
- Pro Funke und pro Rakete werden neue Geometrien und Materialien erzeugt (`game.js:152`, `game.js:309`). Das erzeugt GC-Ruckler.
- `dt` wird auf 0,033 gekappt (`game.js:341`). Unter 30 fps läuft das Spiel deshalb in Zeitlupe, statt einen festen Simulationstakt zu nutzen.
- Sichtlinien werden nur in 2D geprüft (`lineClear`), die Kollision läuft nur über Kacheln und Kreise.

---

## 3. Zielbild

**Genre:** Atmosphärischer Industrie-Shooter. Etwa *F.E.A.R.* trifft *Prey (2017)* trifft *Amid Evil*, gespielt in einem Schweizer Stahlwerk der 1980er-Jahre.

**Elevator Pitch:**
*Werk Eisenriss, Mittelland, 03:12 Uhr. Feuerwehrfrau Mara Keller folgt einem Notruf, der vor zwölf Jahren abgesetzt wurde. Das Werk läuft noch, ohne Strom und ohne Belegschaft. Und es wiederholt die Stimmen derer, die nie herausgekommen sind.*

### Vier Designsäulen

Jede Entscheidung muss mindestens eine davon stärken:

1. **Schwer und laut.** Jede Waffe, jede Tür und jeder Treffer hat Masse. Stahl dröhnt, Beton staubt.
2. **Licht ist Spielmechanik.** Dunkelheit verbirgt Gegner, die Taschenlampe verrät dich, glühender Stahl blendet.
3. **Das Werk ist eine Waffe.** Kräne, Schmelztiegel, Hochspannung und Pressen sind tödlich, für Gegner wie für dich.
4. **Schweizer Präzision.** Klare Beschilderung, ordentliche Räume, die zerfallen sind. Unheimlich, weil alles so korrekt wirkt.

### Visuelle Referenz (Moodboard-Richtung)

- Farbgebung: Natriumdampf-Orange (589 nm) gegen kaltes Mondlicht-Blau, dazu rote Notbeleuchtung. Kein Grün-Grau mehr.
- Materialien: gelb-schwarze Warnfarbe, abgeplatzter RAL-7035-Lack, verzinktes Gitterrost, Russ.
- Typografie im Spiel: DIN-artige Werksbeschilderung, dreisprachig DE/FR/IT. Das ist ein starkes, eigenes Schweizer Detail.

---

## 4. Grafik

### 4.1 Technik-Stack

| Bereich | Heute | Neu | Warum |
|---|---|---|---|
| Renderer | Three.js WebGL, Add-on-Postprocessing | Three.js r180+ WebGL2 (WebGPU später optional) + `postprocessing` (pmndrs) | Stabile Browserabdeckung, bessere Effektkette |
| Licht | Echtzeit-Punktlichter + Hemisphere | **In Blender gebackene Lightmaps** (Cycles) + wenige Echtzeit-Spots mit Schatten | Grösster einzelner Qualitätssprung, der im Browser möglich ist |
| Indirektes Licht für bewegliche Objekte | keines | Light-Probe-Raster pro Bereich (gebacken) | Gegner und Waffe passen farblich in den Raum |
| Reflexionen | `RoomEnvironment` global | Reflexions-Cubemaps pro Raum (beim Laden gerendert) | Metall sieht nach Metall aus |
| AO | SSAOPass | N8AO (`n8ao`) + gebackene AO | Sauberer, schneller |
| AA | MSAA | SMAA oder TAA + leichtes Nachschärfen | Ruhige Kanten bei Gittern und Rohren |
| Physik | eigene Kachelkollision | **Rapier** (`@dimforge/rapier3d-compat`) | Echte Geometriekollision, Ragdolls, Physik-Objekte |
| Navigation | BFS auf 4-Wege-Raster | **Navmesh** (`recast-navigation` + three-Bindings) | Gegner bewegen sich auf beliebiger Geometrie |
| Assets | gzip-GLB | glTF + **Meshopt** + **KTX2/Basis** über `gltf-transform` | Etwa halbe Downloadgrösse, weniger GPU-Speicher |

### 4.2 Levelgeometrie

- **Das Kachelraster wird aufgegeben.** Das Level wird in Blender aus einem **modularen Kit** gebaut: Wandmodule 2 m / 4 m, Hallenstützen, Treppen, Laufstege, Gitterroste und Fenster-Oberlichter.
- **Höhe ist Pflicht:** Die Schmelze ist 14 m hoch mit Laufstegen auf zwei Ebenen. Die Wartungstunnel sind 2,4 m eng. Das Archiv bekommt Regalschluchten. Diese Kontraste fehlen heute komplett.
- **Trim-Sheets** statt einzelner Texturen. Ein Satz Atlas-Texturen (Metallkanten, Rohre, Warnstreifen, Beton) für das ganze Werk ergibt eine einheitliche Bildsprache und wenige Draw-Calls.
- **Decals** für Russ, Ölflecken, Wasserränder, Beschriftungen und Einschusslöcher. Sie machen aus «Kachel» einen «Ort».
- Trigger, Spawnpunkte und Lichter werden als **benannte Empties mit Custom Properties** in Blender gesetzt. Das Spiel liest sie beim Laden aus. Damit gibt es keine Koordinatenlisten im Code mehr (`world-layout.js`, `ENEMY_SPAWNS`).

### 4.3 Licht und Atmosphäre

- **Grundhelligkeit radikal senken.** Ambient fast auf null. Licht kommt nur aus sichtbaren Quellen: Lampen, Glut, Monitore, Mond durch Oberlichter.
- **Taschenlampe** als Spot mit Schatten (1024er-Shadowmap) und leichter Trägheit beim Schwenken. Die Batterie ist eine Ressource (siehe Gameplay).
- **Volumetrisches Licht:** Lichtkegel als additive Karten mit Rauschen, Staubpartikel in Lichtkegeln, Hitzeflimmern über Schmelzöfen (Distortion-Pass auf Maske).
- **Flackernde Notbeleuchtung**, die mit dem Skript gekoppelt ist. Wenn der Boss spricht, flackert das Licht im Takt seiner Stimme.
- **Farbkorrektur per LUT pro Bereich**, weich überblendet. Anlieferung kühl, Schmelze glühend, Archiv entsättigt, Reaktor tiefrot.

### 4.4 Charaktere

Jeder Gegnertyp bekommt eine **eigene Silhouette**, die man in 30 m Entfernung im Halbdunkel erkennt:

| Typ | Rolle | Silhouette | Ankündigung (Telegraph) |
|---|---|---|---|
| **Echo** (statt Runner) | schneller Nahkämpfer | hagerer Arbeiter, Kopf schief, Overall zerrissen | Kreischen + Kopfruck 0,4 s vor dem Sprung |
| **Werkschutz** (statt Guard) | Schütze, nutzt Deckung | Uniform, Helm mit Visier, Taschenlampe am Gewehr | sein Lichtkegel erfasst dich, bevor er schiesst |
| **Inspektor** (statt Drone) | Späher, ruft Verstärkung | Kugel mit Linse an einer Deckenschiene oder frei schwebend | Scanlinie, dann Alarmton |
| **Giesser** (statt Tank) | Flächenkontrolle | massiv, Schutzanzug, Giesspfanne mit Glut | Pfanne glüht auf, Spritzer im Bogen, dann Lache am Boden |
| **Siegrist, der Ofenkönig** | Boss, 3 Phasen | mit dem Reaktor verwachsen, Kabel und Schläuche | jede Phase ändert die Arena |

- Anforderungen an jedes Modell: Rig mit mindestens Idle, Gehen, Rennen, Angriff, Treffer vorne/hinten/links/rechts, Stagger und Tod. Beim Tod Übergang in einen **Ragdoll** (Rapier).
- Animationen zum Prototypen: Mixamo oder die CC0-Bibliotheken von Quaternius. Später eigene Animationen nachbearbeiten.
- **Wunden:** Shader-Masken für Einschüsse und Verbrennungen am Körper statt Würfelpartikel.

### 4.5 Waffen in der Hand (Viewmodel)

- **Eigene Arme mit Rig** (Handschuhe, Feuerwehrjacke), eine eigene Kamera mit eigenem FOV (etwa 60°), damit die Waffe nicht in Wände ragt.
- Animationen pro Waffe: Ziehen, Idle, Schuss, Nachladen (taktisch und leer), Inspektion, Nahkampfschlag.
- **Prozedurale Schicht** darüber: Federbasiertes Schwanken (Sway), Rückstoss über Feder statt Linear-Abklingen, Neigung beim Seitwärtslaufen, Absenken an Wänden.
- Mündungsfeuer als animierte Sprite-Sheets + kurzes Licht. Hülsen werden als Physikobjekte ausgeworfen.

### 4.6 Treffer- und Umwelteffekte

- **GPU-Partikelsystem** (Instanced, gepoolt) für Funken, Staub, Glut, Betonbrocken und Blut.
- Einschlagsdecals abhängig vom Material: Beton bröckelt, Metall glüht kurz, Holz splittert. Dafür braucht jede Oberfläche ein Material-Tag.
- Explosionen mit Druckwelle (Distortion), Rauchsäule, Lichtblitz, Kamerastoss und physikalisch weggeschleuderten Objekten.

### 4.7 Leistungsbudget

| Ziel | Wert |
|---|---|
| Bildrate | 60 fps auf Mittelklasse-Laptop (integrierte GPU, 2022) bei 1080p mit dynamischer Auflösung; 144 fps auf Desktop-GPU |
| Draw-Calls | < 250 pro Bild |
| Erster Download bis spielbar | < 40 MB, weitere Bereiche werden im Hintergrund nachgeladen |
| Garbage Collection | keine Allokationen im Spiel-Loop (Pools für Projektile, Partikel, Decals) |

---

## 5. Gameplay

### 5.1 Bewegung: «Gewicht mit Kontrolle»

- Beschleunigung und Reibung statt Konstantgeschwindigkeit. Gehen 5,5 m/s, Sprint 8 m/s.
- **Ducken, Rutschen** (aus dem Sprint), **Hochziehen** an Kanten bis 1,5 m, **Lehnen** an Ecken (Q/E, optional).
- Kamerabewegung: weiche Landung mit Federstauchung, leichtes Kopfnicken nur beim Sprint, abschaltbar.
- Schrittgeräusche je nach Untergrund (Beton, Gitterrost, Wasser, Blech).

### 5.2 Waffen: jede mit eigener Idee

Weniger Waffen, dafür jede mit **Primär- und Alternativfunktion** und einer Verbindung zur Umgebung:

| Waffe | Primär | Alternativ | Werks-Synergie |
|---|---|---|---|
| **Stahlfaust** (Pressluft-Handschuh) | Schlag | aufgeladener Pressluftstoss, wirft Gegner zurück | in Öfen, Pressen und Abgründe stossen |
| **Schrottrevolver** | präziser Einzelschuss, Kopftreffer ×2,5 | «Fächern»: 6 Schuss schnell, ungenau | Schuss auf Gasflaschen oder Kettenschlösser von Lasten |
| **Pump-Schrotflinte** | Streuung, starker Rückstoss | Flintenlaufgeschoss für Distanz | Türen und Gitter aufschiessen |
| **Nagelwerfer** | Dauerfeuer | Nagelt Gegner an Wände (pinnen, Ragdoll fixiert) | Kabel an Strom nageln → Stromfalle |
| **Raketenwerfer** | Rakete | Fernzündung in der Luft | Kran-Seile durchtrennen, Lasten fallen lassen |

- **Nachladen** für alle Waffen ausser Faust und Nagelwerfer (der hat Überhitzung).
- **Rückstossmuster** pro Waffe, die man lernen kann.
- **Hitstop** von 30–60 ms bei schweren Treffern, Trefferzeichen mit Unterscheidung Kopf/Körper/Kill, deutlicher Kill-Sound.

### 5.3 Gegner-KI

- Wechsel von festen `if`-Ketten zu **Utility-AI** (jeder Gegner bewertet Optionen wie Angriff, Deckung, Flanke, Rückzug, Verstärkung rufen) oder schlanken **Behavior Trees**.
- **Gruppenkoordination:** Ein «Token»-System erlaubt nur 2 gleichzeitige Angreifer, die anderen positionieren sich. Daraus entsteht das F.E.A.R.-Gefühl, ohne dass das Spiel unfair wird.
- **Funksprüche/Rufe** (Barks): «Sie ist im Tunnel!», «Granate!», «Ich werde getroffen!» So wird die KI für den Spieler lesbar.
- **Wahrnehmung:** Sichtkegel mit Licht-Abhängigkeit (im Dunkeln sieht man dich schlechter, mit Taschenlampe sofort), Geräusche mit Ausbreitung durch Türen statt durch Wände.
- **Stagger und Trefferzonen:** Bein → stolpert, Arm → lässt Waffe fallen, Kopf → Sofortkill bei Echos.

### 5.4 Encounter- und Leveldesign

Statt 29 verstreuter Gegner gibt es **etwa 12 handgebaute Kampfsituationen**. Jede hat:

- einen **Ankündigungsmoment** (Geräusch, Silhouette, Lichtwechsel),
- **mindestens zwei Lösungswege** (frontal, flankierend über Laufsteg, per Umgebungsfalle),
- **eine Ruhephase** danach mit Ressourcen und Story-Fund.

**Neuer Ablauf (gleiches Werk, neue Struktur):**

1. **Anlieferung** (Tutorial, 3 min): Regen, Laderampe, erste Echo-Begegnung im Dunkeln. Man lernt Taschenlampe, Revolver und Stahlfaust.
2. **Zentrale** (Hub, 2 min): Leitstand mit Werksplan. Hier wählt man die Reihenfolge Schmelze/Archiv. Die Zentrale verändert sich bei jeder Rückkehr.
3. **Schmelze** (5 min): Vertikale Arena, Laufstege, Kran-Rätsel, erster Giesser. Rote Karte.
4. **Archiv** (5 min): Stille, Regalschluchten, Inspektoren, Horror-Moment mit Stimmen-Echo. Gelbe Karte.
5. **Wartungstunnel** (3 min): eng, Wasser knöcheltief, Werkschutz-Hinterhalt.
6. **Reaktor** (5 min): Bossarena in 3 Phasen, Phase 2 flutet den Boden mit Glut, Phase 3 fällt der Strom aus und es bleibt nur die Taschenlampe.

### 5.5 Ressourcen und Progression

- **Taschenlampen-Batterie** als zweite Ressource neben Munition. Das erzeugt Spannung in dunklen Bereichen, ohne in Survival-Horror zu kippen.
- **Werkzeugkasten-Upgrades** (6–8 Stück, in Geheimräumen): z. B. schnelleres Nachladen beim Revolver, grössere Pressluftladung. Geheimnisse bekommen dadurch echten Wert.
- Schwierigkeitsgrade ändern auch KI-Aggressivität und Telegraph-Dauer, nicht nur den Schadensmultiplikator.

### 5.6 Story und Präsentation

- **Sprecherinnen und Sprecher** für Mara (wenige, trockene Kommentare) und Siegrist (über Werkslautsprecher, zunehmend verzerrt). Professionelle Sprachaufnahmen sind der günstigste AAA-Hebel überhaupt.
- **Umgebungserzählung:** Stempelkarten, Schichtpläne, Pausenraum mit halb gegessenem Znüni, Unfallstatistik-Tafel «342 Tage ohne Unfall», bei der die Zahl rückwärts läuft.
- **Tonbänder** als sammelbare Audiologs (das Archiv-Thema «der Hohlraum wiederholt unsere Stimmen» wird so hörbar statt lesbar).
- Kurze **In-Engine-Sequenzen** ohne Kontrollverlust (Kamera bleibt beim Spieler, die Welt inszeniert sich): Kran stürzt ab, Licht geht aus, Siegrist erscheint hinter Glas.

---

## 6. Audio

Audio macht die Hälfte des Waffengefühls aus. Heute werden viele Effekte als Oszillator-Pieptöne synthetisiert (`audio.js:516-532`).

- **Geschichtete Schusssounds:** Mechanik (Hahn, Verschluss) + Knall + **raumabhängiger Nachhall** (Tail). Derselbe Revolver klingt im Tunnel anders als in der Halle.
- **Hall-Zonen** per `ConvolverNode` mit Impulsantworten pro Bereich, weich überblendet.
- **3D-Positionierung** mit HRTF-`PannerNode` und Verdeckung (Tiefpass hinter Wänden).
- **Dynamische Musik** in Schichten: Erkunden → Spannung → Kampf → Nachklang, gesteuert über die Anzahl wacher Gegner.
- **Ambiente:** Brummen von Trafos, tropfendes Wasser, Metall, das sich bei Abkühlung verzieht, fernes Echo der Stimmen.
- Sprachausgabe mit Untertiteln (Pflicht für Barrierefreiheit).

---

## 7. UI und UX

- **HUD reduzieren:** Die grossen Boxen unten links/rechts werden zu einem schlanken, halbtransparenten HUD, das bei Inaktivität ausblendet. Munition optional diegetisch auf der Waffe (Nagelwerfer-Zählwerk, Revolver-Trommel).
- **Schadensrichtung** anzeigen statt Vollbild-Rotblitz.
- **Menü:** Das bestehende Menü ist grafisch ordentlich. Der Hintergrund wird eine echte Kamerafahrt durch das gebackene Werk.
- **Einstellungen** auf AAA-Standard: Tastenbelegung, FOV getrennt für Welt und Waffe, Bewegungsunschärfe/Kamerawackeln einzeln, Untertitel-Grösse, Farbenblind-Modi, Gamepad-Unterstützung (Gamepad API).
- **Ladebildschirm** mit Fortschritt und Hinweisen, Streaming der folgenden Bereiche im Hintergrund.

---

## 8. Codebasis

Das Fundament muss vor der Grafik kommen, sonst bricht es unter den neuen Systemen zusammen.

- **TypeScript** und lesbare Formatierung (Prettier, ESLint). Der heutige Einzeilerstil ist der deutlichste sichtbare Fingerabdruck.
- **`game.js` aufteilen** in Systeme: `PlayerController`, `WeaponSystem`, `AIDirector`, `EnemyBrain`, `PhysicsWorld`, `FXPool`, `AudioMixer`, `LevelLoader`, `Encounter`, `SaveSystem`, `HUD`.
- **Feste Simulationsrate** (60 Hz) mit Interpolation beim Rendern.
- **Datengetrieben:** Waffen, Gegner und Encounter als JSON/TS-Konfiguration, Level-Daten aus Blender.
- **Debug-Werkzeuge:** Leistungsanzeige (stats-gl), KI-Visualisierung (Sichtkegel, Pfade), Teleport-Menü, Live-Tweak-Panel (`lil-gui`) für Rückstoss, Bewegung und Licht.
- **Tests erhalten:** Die bestehenden `node --test`-Tests sind gut. Neu hinzu kommen Playwright-Tests für Start, Laden und Leistung (fps-Schwelle in CI).

---

## 9. Roadmap

Grobe Schätzung für eine Person mit KI-Unterstützung. Jede Phase endet mit einem **Abnahmekriterium**. Ohne bestandenes Kriterium geht es nicht weiter.

| Phase | Inhalt | Dauer | Abnahme |
|---|---|---|---|
| **0 – Fundament** | TS, Aufteilung in Systeme, feste Simulationsrate, Pools, Rapier, Debug-Panel | 2 Wochen | Gleiches Spiel wie heute, aber Code lesbar, keine GC-Ruckler, alle Tests grün |
| **1 – Gefühl** | Bewegung, Revolver + Schrotflinte + Faust in Endqualität, Arme, Trefferfeedback, Audio-Schichten in einer **grauen Testarena** | 3–4 Wochen | 3 Testpersonen sagen ohne Vorgabe, dass sich Schiessen «gut» anfühlt. Vergleich per Video mit einer Referenz (z. B. *Prey*, *Dusk*) |
| **2 – Bild** | Anlieferung + Zentrale in Blender neu, Trim-Sheets, Lightmaps, Probes, Post-FX, LUTs, Hall-Zonen | 4–6 Wochen | Screenshot-Test: 10 Standbilder neben dem Moodboard, keins fällt heraus. 60 fps im Leistungsbudget |
| **3 – Gegner** | Echo + Werkschutz final (Modell, Animation, KI, Barks), 3 Encounter in der Anlieferung | 4 Wochen | **Vertical Slice fertig:** 10 Minuten spielbar in Endqualität |
| **4 – Werk** | Schmelze, Archiv, Tunnel, Inspektor, Giesser, Upgrades | 8–10 Wochen | gesamter Ablauf spielbar |
| **5 – Reaktor und Feinschliff** | Boss mit 3 Phasen, Sprachaufnahmen, Musik, Einstellungen, Gamepad, Leistungsoptimierung | 4–6 Wochen | Release-Kandidat |

**Wichtig:** Nach Phase 3 kurz innehalten. Wenn die Vertical Slice überzeugt, lohnt sich der Rest. Wenn nicht, wird nachgebessert, bevor Inhalt entsteht.

---

## 10. Was ab sofort *nicht* mehr passiert

- Keine neuen Waffen, Gegner oder Bereiche vor der fertigen Vertical Slice.
- Keine einzelnen AI-generierten Farbtexturen ohne Normal-/Rauheitskarten. Wenn generiert, dann als komplettes PBR-Set im Stil des Trim-Sheets.
- Keine Assets aus verschiedenen Quellen ohne Anpassung an Palette und Texeldichte.
- Keine Koordinatenlisten im Code für Levelinhalte.
- Keine Einzeiler-Formatierung.

---

## 11. Erste Woche: konkrete Aufgaben

1. Repo auf TypeScript + Prettier/ESLint umstellen, `game.js` in `player/`, `weapons/`, `ai/`, `fx/`, `world/` aufteilen (Verhalten unverändert).
2. Feste Simulationsrate (60 Hz) und Objekt-Pools für Partikel, Tracer und Projektile.
3. Debug-Panel mit `lil-gui` und Leistungsanzeige.
4. Schnelle Sofortverbesserung, damit der Unterschied sichtbar wird: Ambient/Hemisphere fast auf null, Schatten für die Taschenlampe, Revolver-Position und -Grösse korrigieren, Farbkorrektur Orange/Blau.
5. Graue Testarena (Blender-Blockout, 3 Höhenebenen) als Spielwiese für Phase 1.
6. Moodboard mit 20–30 Referenzbildern anlegen (Fotos echter Schweizer Industrieanlagen: Von Roll Gerlafingen, Sulzer Winterthur, Stahl Gerlafingen).

---

## 12. Risiken

| Risiko | Gegenmassnahme |
|---|---|
| Umfang wächst schneller als Qualität | strikte Phasen-Abnahme, Vertical Slice zuerst |
| Lightmap-Workflow ist neu und zeitaufwendig | in Phase 2 mit **einem** Raum beginnen und die Pipeline (Bake → Export → Laden) automatisieren |
| Browser-Leistung auf schwachen Geräten | Qualitätsstufen, dynamische Auflösung, Leistungstest in CI |
| Charakteranimation ist der teuerste Posten | Mixamo/Quaternius für Basis, eigene Arbeit nur für Boss und Viewmodel-Arme |
| Lizenzen bei Fremd-Assets | weiterhin nur CC0 oder klar lizenzierte Quellen, Liste in `CREDITS.md` |

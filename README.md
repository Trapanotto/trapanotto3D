# Trapanotto 3D

Ein eigenständiger Retro-Ego-Shooter im Browser. In einem stillgelegten Schweizer Industriewerk führt ein alter Notruf durch Schmelze, Archiv und Wartungstunnel bis zum Reaktor.

## Spielen

- **W/A/S/D** bewegen, **Maus** zielen, **linke Maustaste** schiessen
- **Leertaste** springen, **E** Türen und verdächtige Wände benutzen
- **1–5** oder **Mausrad** Waffen wechseln, **Esc** pausieren

Das Spiel ist für Desktop-Browser mit WebGL, Maus und Tastatur ausgelegt. Einstellungen und die persönliche Bestzeit bleiben lokal im Browser. Es gibt keinen Spielserver und keine Online-Rangliste. Gegner sehen und hören dich, verfolgen deine letzte bekannte Position auch um Hindernisse und setzen je nach Typ auf Nahkampf oder Abstand.

## Entwicklung

Voraussetzungen: Node.js und npm.

```sh
npm ci
npm run dev
npm run check   # Typprüfung, ESLint und Tests
npm run build
```

Das Projekt ist in TypeScript geschrieben und verwendet Three.js und Vite. Die Tests laufen direkt mit Node (ab 22.18) ohne Build-Schritt.

**Aufbau von `src/`:** `config/` (Waffen, Gegner, Texte, Feineinstellungen), `world/` (Karte, Navigation, Platzierungen), `core/` (fester 60-Hz-Simulationstakt, Eingabe, Kollisionsabfragen), `player/`, `weapons/`, `ai/` (Gegnerverhalten), `combat/` (Projektile), `fx/` (Partikel- und Tracer-Pools), `render/` (Renderer, Nachbearbeitung, Weltaufbau, Modelle), `game/` (Pickups, Spielstand), `ui/` und `debug/`. `game.ts` verbindet die Systeme.

**Debug-Panel:** Im Dev-Server immer aktiv, in jedem Build mit `?debug` in der URL. Es zeigt Leistung (fps, CPU, GPU) und hat Regler für Licht, Farbkorrektur, Waffenposition, Bewegung und KI sowie Cheats und Teleport. Ein- und ausblenden mit **F2**. `?qa` startet im Dev-Server die Browser-Prüfungen.

**Gegner-KI:** Gegner brauchen beim Entdecken einen Moment zum Reagieren und rufen Verbündete in der Nähe. Nur wenige greifen gleichzeitig an (zwei auf «Veteran»). Jeder Angriff wird durch Aufglühen und einen Ton angekündigt, genug Schaden in dieser Phase lässt den Gegner taumeln und bricht den Angriff ab. Runner springen aus kurzer Distanz an und weichen danach zurück. Schützen feuern Salven und halten etwas vor. Kopftreffer zählen doppelt. Der Vite-Basispfad `/trapanotto3D/` entspricht dem GitHub-Pages-Projektpfad. Der Workflow in `.github/workflows/deploy.yml` baut und veröffentlicht Pushes auf `main`.

## 3D-Assets und Texturen

Die eigenen Industrieobjekte, Waffenansätze und Gegnerteile sind in `assets-source/trapanotto_assets.blend` bearbeitbar. Die Blender-Skripte in `tools/` exportieren die komprimierten GLB-Dateien in `public/models/`. Die sichtbare Spielfigur wurde aus einem frei lizenzierten Figurenmodell in Blender mit Arbeitskleidung, Maske und einem einfachen Rig weiterentwickelt. Für den Revolver wurde ein texturiertes Modell mit Schussanimation in Blender aufbereitet. Die sechs zusätzlichen Industriemodelle sind in `assets-source/industry_set.blend` zusammengefasst und für das Spiel skaliert, zentriert und exportiert. Beton und Metall verwenden Farb-, Normal- und Rauheitskarten.

Quellen der CC0-Ausgangsmodelle:

- [Revolver Game Asset von loafbrr_1 / OpenGameArt](https://opengameart.org/content/revolver-game-asset)
- [Firefighter, standing / Innerscene](https://www.innerscene.com/tools/library/3d-parts/firefighter-standing-3d-person-emergency-services-3c007c1f)
- [Portable Generator](https://polyhaven.com/a/portable_generator) und [Utility Box 02](https://polyhaven.com/a/utility_box_02) von Poly Haven, [CC0-Lizenz](https://polyhaven.com/license)
- Maschinen von Poly Haven: [Old Military Compressor](https://polyhaven.com/a/old_military_compressor), [Overhead Crane](https://polyhaven.com/a/overhead_crane), [Portable Welding Cart](https://polyhaven.com/a/portable_welding_cart), [Industrial Storage Cart](https://polyhaven.com/a/industrial_storage_cart), [Metal Tool Chest](https://polyhaven.com/a/metal_tool_chest) und [Drill Press](https://polyhaven.com/a/drill_press_01)
- PBR-Oberflächen von Poly Haven: [Concrete Floor Worn 02](https://polyhaven.com/a/concrete_floor_worn_02), [Concrete Block Wall 02](https://polyhaven.com/a/concrete_block_wall_02) und [Blue Metal Plate](https://polyhaven.com/a/blue_metal_plate)

Die Texturen `public/textures/weathered-steel.png` und `public/textures/industrial-concrete.png` wurden mit der integrierten Bildgenerierung für dieses Projekt erstellt. Die Motive sind nahtloses, abgenutztes graublaues Industriestahlblech mit Rost und Kratzern beziehungsweise ein verschmutzter, fein gerissener Betonboden, jeweils frontal und gleichmässig diffus beleuchtet.

Schussaufnahmen stammen aus [The Free Firearm Sound Library](https://opengameart.org/content/the-free-firearm-sound-library) von Ben Jaszczak, Brian Nelson, Kevin Heras und Matthew Nanney; Schritte aus [Footsteps — shoe on concrete](https://bigsoundbank.com/footsteps-shoe-on-concrete-s0514.html) von Joseph Sardin / BigSoundBank. Die verwendeten Ausschnitte stammen aus dem [Audio-Ordner von hard-lines](https://github.com/yegors/hard-lines/blob/main/public/audio/README.md), der Herkunft und Bearbeitung dokumentiert. Die Aufnahmen sind unter CC0 verfügbar.

Die komprimierten Spielmodelle werden mitgeliefert; Blender ist zum Spielen und für den Web-Build nicht nötig. Die Skripte `build_revolver.py` und `build_enemies.py` benötigen zum erneuten Erzeugen die jeweiligen CC0-Ausgangsdateien. `download_polyhaven.ps1` lädt die ersten Poly-Haven-Modelle für `pack_polyhaven.py`. `python tools/download_industry.py` lädt die zusätzlichen Modelle und Materialkarten, `blender -b --python tools/pack_industry.py` baut daraus das Blender-Set und das Spielmodell.

# Trapanotto 3D

Ein eigenständiger Retro-Ego-Shooter im Browser. In einem stillgelegten Schweizer Industriewerk führt ein alter Notruf durch Schmelze, Archiv und Wartungstunnel bis zum Reaktor.

## Spielen

- **W/A/S/D** bewegen, **Maus** zielen, **linke Maustaste** schiessen
- **Leertaste** springen, **E** Türen und verdächtige Wände benutzen
- **1–5** oder **Mausrad** Waffen wechseln, **Esc** pausieren

Das Spiel ist für Desktop-Browser mit WebGL, Maus und Tastatur ausgelegt. Einstellungen und die persönliche Bestzeit bleiben lokal im Browser. Es gibt keinen Spielserver und keine Online-Rangliste.

## Entwicklung

Voraussetzungen: Node.js und npm.

```sh
npm ci
npm run dev
npm test
npm run build
```

Das Projekt verwendet Three.js und Vite. Der Vite-Basispfad `/trapanotto3D/` entspricht dem GitHub-Pages-Projektpfad. Der Workflow in `.github/workflows/deploy.yml` baut und veröffentlicht Pushes auf `main`.

## 3D-Assets und Texturen

Die eigenen Industrieobjekte, Waffenansätze und Gegnerteile sind in `assets-source/trapanotto_assets.blend` bearbeitbar. Die Blender-Skripte in `tools/` exportieren die komprimierten GLB-Dateien in `public/models/`. Die sichtbare Spielfigur wurde aus einem frei lizenzierten Figurenmodell in Blender mit Arbeitskleidung, Maske und einem einfachen Rig weiterentwickelt. Für den Revolver wurde ein texturiertes Modell mit Schussanimation in Blender aufbereitet. Weitere PBR-Details ergänzen die Industriehalle.

Quellen der CC0-Ausgangsmodelle:

- [Revolver Game Asset von loafbrr_1 / OpenGameArt](https://opengameart.org/content/revolver-game-asset)
- [Firefighter, standing / Innerscene](https://www.innerscene.com/tools/library/3d-parts/firefighter-standing-3d-person-emergency-services-3c007c1f)
- [Portable Generator](https://polyhaven.com/a/portable_generator) und [Utility Box 02](https://polyhaven.com/a/utility_box_02) von Poly Haven, [CC0-Lizenz](https://polyhaven.com/license)

Die Texturen `public/textures/weathered-steel.png` und `public/textures/industrial-concrete.png` wurden mit der integrierten Bildgenerierung für dieses Projekt erstellt. Die Motive sind nahtloses, abgenutztes graublaues Industriestahlblech mit Rost und Kratzern beziehungsweise ein verschmutzter, fein gerissener Betonboden, jeweils frontal und gleichmässig diffus beleuchtet.

Die komprimierten Spielmodelle werden mitgeliefert; Blender ist zum Spielen und für den Web-Build nicht nötig. Die Skripte `build_revolver.py` und `build_enemies.py` benötigen zum erneuten Erzeugen die jeweiligen CC0-Ausgangsdateien. `download_polyhaven.ps1` lädt die Poly-Haven-Modelle für `pack_polyhaven.py`.

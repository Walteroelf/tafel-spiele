# Design der Unterrichts-Apps

Gemeinsames Erscheinungsbild für die Apps der Förderschule KME, angelehnt an die Farben der
Olympischen Spiele München 1972 (Otl Aicher): sieben Farben plus Weiß, kein Rot, kein Schwarz,
ruhige Schrift, flache Flächen.

Die Werte stehen in `design.css`. Diese Datei ist in allen Apps gleich. App-Eigenes gehört in `style.css`.

**Ausnahmen:** TimerTimer7, TimerTimer8, Tasterwelt und Lichtkette behalten ihr eigenes Design.

## Farben

| Name | Variable | Wert | Wofür | Schrift darauf |
|---|---|---|---|---|
| Hellblau (Hauptfarbe) | `--hellblau` | #4DB2E6 | Hauptknopf, Kopfzeile, Auswahl | Dunkelblau (6,0 : 1) |
| Blau | `--blau` | #0067B1 | nur Schrift, Links, Linien, Symbole auf Weiß | ist selbst Schrift (5,9 : 1 auf Weiß) |
| Grün | `--gruen` | #46A84A | „Richtig“, Weiter | Dunkelblau (4,7 : 1) |
| Hellgrün | `--hellgruen` | #A6D27A | Flächen, Erfolg leise | Dunkelblau (8,2 : 1) |
| Gelb | `--gelb` | #FFD100 | Hinweis, Markierung, Fokus | Dunkelblau (9,8 : 1) |
| Orange | `--orange` | #F39200 | „Schau noch mal“ | Dunkelblau (6,1 : 1) |
| Silber | `--silber` | #B9C1C8 | Linien, ausgeschaltete Knöpfe | Dunkelblau (7,8 : 1) |
| Weiß | `--weiss` | #FFFFFF | Hintergrund, Karten | Dunkelblau (14,3 : 1) |
| Dunkelblau | `--dunkelblau` | #0D2B4E | Schrift statt Schwarz | – |

### Fachfarben

| Fach | Variable | Wert | Schrift darauf |
|---|---|---|---|
| Deutsch | `--fach-deutsch` | #EF6B45 (warmes Zinnoberrot) | Dunkelblau (4,7 : 1) |
| Mathe | `--fach-mathe` | = Hellblau | Dunkelblau (6,0 : 1) |

Deutsch ist an der Schule Rot. Echtes Signalrot passt nicht zu Olympia 72, darum ein warmes Zinnoberrot.
Eine Fach-App setzt `--app-akzent` auf ihre Fachfarbe. Dann sind Startbildschirm, Hauptknöpfe und Auswahl in dieser Farbe.
In einer Deutsch-App fällt Orange als Gerätefarbe weg, weil es dem Zinnoberrot zu ähnlich ist.

Farbige Schrift auf Weiß: `--gruen-text` #1E6B2A (6,6 : 1), `--orange-text` #9A4F00 (6,0 : 1).

## Die Regeln

1. **Auf jeder Farbfläche steht Dunkelblau.** Weiße Schrift gibt es nicht.
2. **Blau ist nie eine Fläche**, nur Schrift, Link, Linie oder Symbol auf Weiß.
3. **Kein Rot, kein Schwarz.** Fehler oder „noch nicht“ zeigt Orange.
4. **Richtig = Grün, Schau noch mal = Orange.**
5. Text erreicht überall mindestens **4,5 : 1** Kontrast (WCAG AA), Ränder von Bedienelementen mindestens 3 : 1.

## Rollen und Dunkelmodus

Für Flächen und Text gibt es Rollen, die im Dunkelmodus automatisch wechseln:
`--hg` (Seite), `--karte`, `--flaeche-2`, `--auswahl`, `--text`, `--leise`, `--linie`, `--rand`, `--akzent-text`, `--hinweis-text`.
Im Dunkelmodus ist der Hintergrund ein mittleres Blau (#1D4F80) und die Schrift #E8F1F8. Links und Akzente werden dort ein aufgehelltes Hellblau (#B5E2FC), damit sie auch auf diesem Blau 4,5 : 1 erreichen. Für grüne und orange Schrift gibt es `--gruen-schrift` und `--orange-schrift`, die im Dunkelmodus heller werden.
Farbflächen (z. B. eine Gerätefarbe) bleiben gleich und behalten dunkelblaue Schrift.

## Schrift

- **Andika** für alles (Leselern-Schrift von SIL, OFL), lokal eingebunden. Jede App bindet sie in `style.css`
  mit `@font-face` ein, weil der Ordner (`fonts/` oder `schriften/`) je App anders heißt.
- Grundgröße 18 px. Stufen `--gr-1` bis `--gr-4`: 18, 22, 28, 36 px.
- Keine Fettschrift, um Dinge zu unterscheiden. Lieber Farbe, Größe oder Platz.

## Bedienung

- Knöpfe mindestens **56 px** hoch (`--knopf-hoehe`), kleine Knöpfe mindestens 48 px. Rundung 12 px. Flach, ohne Schatten.
- Hauptknopf in `--app-akzent` (Hellblau oder Fachfarbe), leiser Knopf Weiß mit Rand, hervorgehoben Gelb, Weiter Grün.
- Knöpfe über einer bunten Spielfläche: Weiß mit dunkelblauem Rand.
- **Fokus-Rahmen** für Taster und Tastatur: Gelb innen, Dunkelblau außen. Nie entfernen.
- Abstände im 8er-Raster: `--a-1` bis `--a-4` (8, 16, 24, 32 px).

## Symbole

Eigene Linien-Symbole als SVG (24 × 24, Strich 2,2, runde Enden), Farbe = Schriftfarbe, Klasse `.symbol`.
Keine Emojis: Sie sehen auf jedem Gerät anders aus und lassen sich nicht einfärben.

## Barrierefreiheit

- **Zoom erlauben** (kein `user-scalable=no`), außer auf echten Spielfeldern.
- Dunkelmodus und „Bewegung reduzieren“ folgen dem iPad. Langsame Anzeigen mit Bedeutung,
  z. B. ein ablaufender Zeitbalken, bekommen `.bewegung-erlaubt`.
- `lang="de"`, sinnvolle `aria-label` an Knöpfen ohne Text.

## Eine App umstellen

1. `design.css` unverändert aus einer fertigen App kopieren und vor `style.css` einbinden.
2. In `style.css` alle festen Farben durch die Variablen ersetzen.
3. Emojis in der Oberfläche durch Symbole ersetzen.
4. `design.css` in die Liste des Service Workers aufnehmen und die Cache-Version erhöhen.
5. Kontraste prüfen, hell und dunkel ansehen.

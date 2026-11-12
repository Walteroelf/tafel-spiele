# Tafel-Spiele für die ViewSonic-Tafel

Die Tafel liegt flach und zeigt das Spielfeld. Jedes iPad ist ein Controller (Neigung ist Standard, Joystick und Schieber sind wählbar).
Gespielt wird mit 1 bis 8 Personen, dazu kommen optional Bots.

## Spiele
| Spiel | Idee | Optionen |
|---|---|---|
| 🚗 Scooter | Rausdrängen, wer zuletzt bleibt, gewinnt | Hindernisse (Pfeiler/Banden), Eis, wandernde Löcher |
| ⚽ Fußball | Zwei Teams, Ball ins Tor | Tore bis 3/5/7 |
| 🏒 Hockey | Air-Hockey, jeder bleibt in seiner Hälfte | Tore bis 3/5/7 |
| 🏍️ Lichtspur | Tron: Wände und Spuren sind tödlich | Siege bis 1/3/5 |
| 🪙 Münzen | Zeit läuft, 💎 zählt dreifach | Dauer 45/60/90 s |
| 🏓 4er-Pong | Jede Tafelseite ist ein Tor mit Schläger, wer den Ball durchlässt, verliert ein Leben | Leben 3/5/7 |
| 🎨 Farbe | Den Boden in der eigenen Farbe anmalen, die größte Fläche gewinnt | Dauer 45/60/90 s |
| 🐑 Schafe | Schafe ins Gehege treiben, gemeinsam oder jeder für sich | Modus, Schafe 8/12/16, Zeit 60/90/120 s |
| 🚒 Feuerwehr | Gemeinsam Brände löschen (kooperativ) | Dauer 60/90/120 s, Schwierigkeit |

## Dateien
- `index.html` – Startseite (Tafel / iPad)
- `board.html` – läuft auf der Tafel: Spielwahl, QR-Code, Spiel
- `play.html` – läuft auf dem iPad: Controller
- `js/core.js` – Verbindung, Lobby, Runden, Anzeige an den Rändern
- `js/scooter.js`, `js/ballgames.js` (Fußball + Hockey), `js/tron.js`, `js/coins.js`, `js/pong.js`, `js/paint.js`, `js/sheep.js`, `js/fire.js` – die Spiele

## Spielablauf
1. Auf der Tafel `board.html` öffnen. Dort stehen ein QR-Code und ein 4-stelliger Code.
2. Auf dem iPad den QR-Code scannen oder `play.html` öffnen und den Code eintippen. Danach „Bereit“ tippen.
3. Auf der Tafel Spiel und Optionen wählen, bei Bedarf Bots (− / +) und Bot-Stärke (leicht, mittel, schwer; Standard leicht) einstellen und START tippen. Start und Neustart gibt es nur an der Tafel.
4. Teamspiele (Fußball, Hockey): Spieler werden abwechselnd auf Links und Rechts verteilt.
5. Mit dem ⌂-Knopf oben links (zweimal tippen) geht es zurück zur Spielwahl.

## Steuerung am iPad
- **Neigung (Standard):** iPad aufrecht halten und wie ein Lenkrad drehen. Gas, Turbo und Rück sind Knöpfe auf dem Bildschirm.
  „Geradeaus neu einstellen“ setzt die Mittelstellung. Tipp: Drehsperre im Kontrollzentrum einschalten.
  Safari fragt beim ersten Mal nach Zugriff auf die Bewegungssensoren.
- **Joystick:** Finger links auf den Bildschirm legen und dorthin schieben, wohin das Auto fahren soll. Oben zeigt immer zur Tafelmitte, egal an welcher Seite man steht. Das Gas ist automatisch, TURBO bleibt als Knopf.
- **Schieber (Touch):** links Finger ziehen zum Lenken, rechts GAS, TURBO und RÜCK.
- Bei der Lichtspur gibt es nur Lenken und TURBO (Spurt).
- Bei 4er-Pong gibt es nur links/rechts (Neigung, Joystick oder Schieber), keine Knöpfe.
- Bei der Feuerwehr heißt der Knopf 💧 WASSER (gedrückt halten). Der Tank wird in der Mitte (Hydrant) aufgefüllt.

## Neues Spiel hinzufügen
Datei `js/meinspiel.js` anlegen, mit `GAMES.push({...})` anmelden und in `board.html` einbinden.
Ein Spiel liefert: `id, name, icon, desc, hint, targets, options, startRound(), update(dt, phase), draw(), bot(p)`.
`update` gibt am Rundenende `{winners:[Spieler], text, color}` zurück. Als Vorlage dient `js/coins.js`.

## Veröffentlichen mit GitHub Pages
Nach Änderungen an `js/*.js` die Nummer `?v=` in `board.html` erhöhen, damit Browser die neue Version laden und nicht eine alte aus dem Zwischenspeicher.

Repository auf GitHub, Settings → Pages → Branch `main`, Ordner `/ (root)`.
Lokal testen: `python3 -m http.server 8765` im Ordner starten, dann `http://localhost:8765/board.html` öffnen.

## Technik und Datenschutz
- Die iPads schicken ihre Eingaben per WebRTC direkt an die Tafel (PeerJS). Der öffentliche PeerJS-Server vermittelt nur den Verbindungsaufbau.
- Es werden keine Namen und keine Accounts verwendet, nur Farben.
- Blockiert das Schulnetz Verbindungen zwischen Geräten, hilft oft ein Hotspot oder eine Freigabe von `0.peerjs.com` (Port 443) und WebRTC/UDP.

## Wenn die Tafel langsam ist
- `board.html?debug=1` öffnen (oder auf der Tastatur `F` drücken): oben erscheint eine Anzeige mit Bildern pro Sekunde und Auflösung.
- Die Tafel senkt bei dauerhaft niedriger Bildrate automatisch Auflösung und Effekte („Sparmodus“).
- Mit `board.html?cap=1280` lässt sich die maximale Breite der Zeichenfläche von Hand begrenzen (Standard 1920).
- Hilft nichts: Browser-Tab oder Tafel-App einmal komplett schließen und neu öffnen, damit die Grafikbeschleunigung neu startet.

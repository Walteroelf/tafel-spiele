# Tafel-Spiele für die ViewSonic-Tafel

Die Tafel liegt flach und zeigt das Spielfeld. Jedes iPad ist ein Controller (Neigung ist Standard, Touch ist wählbar).
Gespielt wird mit 1 bis 8 Personen, dazu kommen optional Bots.

## Spiele
| Spiel | Idee | Optionen |
|---|---|---|
| 🚗 Scooter | Rausdrängen, wer zuletzt bleibt, gewinnt | Hindernisse (Pfeiler/Banden), Eis, wandernde Löcher |
| ⚽ Fußball | Zwei Teams, Ball ins Tor | Tore bis 3/5/7 |
| 🏒 Hockey | Air-Hockey, jeder bleibt in seiner Hälfte | Tore bis 3/5/7 |
| 🏍️ Lichtspur | Tron: Wände und Spuren sind tödlich | Siege bis 1/3/5 |
| 🪙 Münzen | Zeit läuft, 💎 zählt dreifach | Dauer 45/60/90 s |

## Dateien
- `index.html` – Startseite (Tafel / iPad)
- `board.html` – läuft auf der Tafel: Spielwahl, QR-Code, Spiel
- `play.html` – läuft auf dem iPad: Controller
- `js/core.js` – Verbindung, Lobby, Runden, Anzeige an den Rändern
- `js/scooter.js`, `js/ballgames.js` (Fußball + Hockey), `js/tron.js`, `js/coins.js` – die Spiele

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
- **Touch:** links Finger ziehen zum Lenken, rechts GAS, TURBO und RÜCK.
- Bei der Lichtspur gibt es nur Lenken und TURBO (Spurt).

## Neues Spiel hinzufügen
Datei `js/meinspiel.js` anlegen, mit `GAMES.push({...})` anmelden und in `board.html` einbinden.
Ein Spiel liefert: `id, name, icon, desc, hint, targets, options, startRound(), update(dt, phase), draw(), bot(p)`.
`update` gibt am Rundenende `{winners:[Spieler], text, color}` zurück. Als Vorlage dient `js/coins.js`.

## Veröffentlichen mit GitHub Pages
Repository auf GitHub, Settings → Pages → Branch `main`, Ordner `/ (root)`.
Lokal testen: `python3 -m http.server 8765` im Ordner starten, dann `http://localhost:8765/board.html` öffnen.

## Technik und Datenschutz
- Die iPads schicken ihre Eingaben per WebRTC direkt an die Tafel (PeerJS). Der öffentliche PeerJS-Server vermittelt nur den Verbindungsaufbau.
- Es werden keine Namen und keine Accounts verwendet, nur Farben.
- Blockiert das Schulnetz Verbindungen zwischen Geräten, hilft oft ein Hotspot oder eine Freigabe von `0.peerjs.com` (Port 443) und WebRTC/UDP.

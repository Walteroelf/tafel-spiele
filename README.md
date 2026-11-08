# Autoscooter-Arena für die ViewSonic-Tafel

Die Tafel liegt flach und zeigt die Arena. Jedes iPad ist ein Controller (Touch oder Neigung).
Gespielt wird mit 1 bis 8 Personen, dazu kommen optional Bots.

## Dateien
- `index.html` – Startseite mit zwei Knöpfen (Tafel / iPad)
- `board.html` – läuft auf der Tafel: Spiel, QR-Code, Lobby
- `play.html` – läuft auf dem iPad: Controller

## Veröffentlichen mit GitHub Pages
1. Neues Repository auf GitHub anlegen und diese Dateien hochladen.
2. Settings → Pages → Branch `main`, Ordner `/ (root)` → Save.
3. Nach etwa einer Minute ist das Spiel unter `https://<name>.github.io/<repo>/` erreichbar.

Lokal testen: `python3 -m http.server 8765` im Ordner starten, dann `http://localhost:8765/board.html` öffnen.

## Spielablauf
1. Auf der Tafel `board.html` öffnen. Dort stehen ein QR-Code und ein 4-stelliger Code.
2. Auf dem iPad den QR-Code mit der Kamera scannen oder `play.html` öffnen und den Code eintippen.
3. Jeder bekommt eine Farbe und einen Platz. Das Auto steht auf der Tafel an der richtigen Seite.
4. Auf dem iPad „Bereit“ tippen (Neigung ist Standard, Touch kann man wählen). Gestartet und neu gestartet wird nur an der Tafel.
5. Wer als Letzter in der Arena bleibt, gewinnt die Runde. Nach 15 Sekunden schrumpft die Arena.
6. Der erste mit 3 Siegen ist Champion. Das Ziel lässt sich in der Lobby auf 1, 3 oder 5 ändern.

## Steuerung am iPad
- **Touch:** links Finger ziehen zum Lenken, rechts GAS, TURBO (alle 3 s) und RÜCK.
- **Neigung:** iPad aufrecht halten und wie ein Lenkrad drehen. Gas, Turbo und Rück bleiben auf dem Bildschirm.
  Mit „Geradeaus neu einstellen" wird die Mittelstellung gesetzt. Tipp: Drehsperre im Kontrollzentrum einschalten.
  Safari fragt beim ersten Mal nach Zugriff auf Bewegungssensoren.

## Mehr als 4 Spieler
Das Spiel ist auf 8 Spieler eingestellt (`MAX_PLAYERS` in `board.html`). Plätze (`SEATS`) und Farben (`COLORS`)
lassen sich erweitern. Technisch ist auch mehr möglich, nur der Platz am Tafelrand wird irgendwann eng.

## Technik und Datenschutz
- Die iPads schicken ihre Eingaben per WebRTC direkt an die Tafel (Bibliothek PeerJS).
  Der öffentliche PeerJS-Server vermittelt nur den Verbindungsaufbau.
- Es werden keine Namen und keine Accounts verwendet, nur Farben.
- Die Tafel wird nur zum Tippen (Start, Bots) gebraucht, daher stört die Ein-Berührungs-Grenze nicht.
- Blockiert das Schulnetz Verbindungen zwischen Geräten, hilft oft ein Hotspot, oder die IT bittet man um Freigabe
  von `0.peerjs.com` (Port 443) und WebRTC/UDP.

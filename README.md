# TT-2026 Transalp – Live-Tracker-Widget

Einbettbares Website-Widget, das das Team **kette.kurve.kontext** (Startnummer
**45A**, drei Fahrerinnen) „live" entlang der Etappenrouten eines Rennrad-
Transalp-Rennens (Lienz → Riva, 7 Etappen) zeigt – im Stil der Strava-
Streckenanimation. Karte (OpenStreetMap via Leaflet) mit **einem gemeinsamen
Team-Avatar (Startnummer)**, Höhenprofil (SVG), aktuelle Live-Position, rechts
ein **Fahrerinnen-Roster** (Panini-/Radrenn-Stil mit Länderflaggen), Countdown
vor jedem Etappenstart.

Die Bewegung wird aus den GPX-Routen simuliert (die GPX enthalten keine
Zeitstempel): ein **steigungsabhängiges Tempomodell** (bergauf langsamer, bergab
schneller) mit konfigurierbarem Etappenschnitt und leichten, reproduzierbaren
Schwankungen. Das Team fährt als Einheit (ein Avatar). Im Live-Betrieb läuft die
Anzeige **synchron zur echten Uhr**; ein eingebauter **Zeit-Simulator** erlaubt
das Testen im Zeitraffer.

## Schnellstart

Es ist **kein Build-Step** nötig – reines HTML/JavaScript/SVG. Wegen `fetch`
muss aber über einen Webserver ausgeliefert werden (nicht per `file://`):

```bash
python3 -m http.server 8000
# Browser: http://localhost:8000/index.html
```

Test-Modus mit sichtbarem Zeit-Simulator:

```
http://localhost:8000/index.html?sim=1
```

## Einbettung in die Website

Den Ordner (`index.html`, `css/`, `js/`, `trackfiles/`) auf den Webspace legen.
Das Widget ist in sich geschlossen. Zum Einbetten in eine bestehende Seite genügt
ein iframe:

```html
<iframe src="/transalp/index.html" style="width:100%;max-width:920px;height:1000px;border:0"></iframe>
```

Leaflet wird per CDN geladen – die Seite braucht zur Laufzeit Internetzugang
(Karten-Kacheln von OpenStreetMap).

## Zeit-Simulator (Test)

Über das **⚙-Zahnrad** oben rechts oder den Parameter `?sim=1` einblendbar:

- **▶/⏸** – Play/Pause der virtuellen Zeit
- **1× … 1800×** – Zeitraffer (auch während der Fahrt umschaltbar)
- **Scrubber** – frei durch das gesamte Rennen scrubben
- **„Sprung zu Etappe …"** – direkt an einen Etappenstart springen
- **● LIVE** – zurück auf die echte Uhr (Produktivbetrieb)

So lässt sich z. B. der Übergang Countdown → Start → Fahrt → Ziel → nächster
Countdown im Zeitraffer prüfen. Beim Reload während einer simulierten Fahrt
stehen die Fahrer exakt an derselben Stelle (Echtzeit-Treue).

## Konfiguration – `js/config.js`

Alles Wesentliche liegt zentral in `js/config.js`:

- **`stages`** – die sieben Etappen mit GPX-Dateiname, Orten und **Startzeit**
  (`start`, ISO-Format mit Zeitzonen-Offset, z. B. `2026-06-21T09:00:00+02:00`).
  Optional pro Etappe `avgKmh` setzen.
- **`defaultAvgKmh`** – bewegter Durchschnitt (Standard 22,5 km/h). Das Modell
  verteilt das Tempo steigungsabhängig und normalisiert den Etappenschnitt exakt
  auf diesen Wert.
- **`team`** – Teamname, Startnummer (Bib auf der Karte) und Farbe.
- **`roster`** – die drei Fahrerinnen für die rechte Roster-Spalte: `name` und
  `flags` (Ländercodes wie `DE`, `US` → als kleine SVG-Flaggen dargestellt;
  weitere Codes in `flagSVG()` in `js/widget.js` ergänzbar). Die Porträts sind
  Platzhalter (CSS-Silhouette) – echte Fotos später leicht einsetzbar.
- **`group`** – `paceTimeJitter` (sanfte, reproduzierbare Tempo-Schwankung).
- **`sim`** – Voreinstellungen des Simulators.

### GPX austauschen

GPX-Dateien einfach in `trackfiles/` ersetzen/ergänzen und in `config.js` unter
`stages` den Dateinamen eintragen. Es sind GPX 1.1 mit `<trkpt lat lon><ele>`
nötig (Zeitstempel werden nicht benötigt). Kein weiterer Schritt erforderlich.

### Startzeiten / Go-live

Die aktuell hinterlegten Termine sind 21.–27.06.2026, täglich 09:00 CEST. Vor dem
Start einer Etappe zeigt das Widget automatisch den Countdown; während der Etappe
die Live-Verfolgung; danach den Countdown zur nächsten. Für den Echtbetrieb
nichts weiter nötig – ohne `?sim=1` läuft alles an der realen Uhr.

## Aufbau

| Datei | Aufgabe |
|-------|---------|
| `index.html` | Markup, lädt Leaflet (CDN) + ES-Module |
| `css/widget.css` | Layout & Stil |
| `js/config.js` | Zentrale Konfiguration |
| `js/gpx.js` | GPX laden & parsen (kumulative Distanz) |
| `js/timing.js` | Steigungs-Tempomodell, Zeit/Distanz/Position-Interpolation |
| `js/riders.js` | Team-Position inkl. reproduzierbarer Tempo-Schwankung |
| `js/clock.js` | Uhr-Abstraktion (echt / virtuell) |
| `js/map.js` | Leaflet-Karte, Route, Trail, Team-Avatar (Bib) |
| `js/elevation.js` | SVG-Höhenprofil mit Live-Marker |
| `js/countdown.js` | Zeit-/Countdown-Formatierung |
| `js/sim.js` | Zeit-Simulator-Bedienpanel |
| `js/widget.js` | Orchestrierung: Zustandsautomat + Render-Loop |
| `tools/verify-timing.mjs` | Headless-Sanity-Check des Tempomodells (`node tools/verify-timing.mjs`) |

## Verifikation

```bash
node tools/verify-timing.mjs   # prüft Etappenschnitt, Dauer, Monotonie
```

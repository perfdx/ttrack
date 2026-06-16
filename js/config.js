// ===========================================================================
// Zentrale Konfiguration des Live-Tracker-Widgets "TT-2026 Transalp".
// Hier alles anpassen: Etappen, Startzeiten, Fahrer, Tempo.
// ===========================================================================

export const CONFIG = {
  // Titel im Widget-Kopf.
  title: 'TT-2026 · Transalp Live',

  // Ordner mit den GPX-Dateien (relativ zu index.html).
  trackDir: 'trackfiles/',

  // Zeitzone der Startzeiten ist über den ISO-Offset in `start` festgelegt
  // (Italien im Juni = CEST = UTC+2). Diese Angabe dient nur der Anzeige.
  timezoneLabel: 'CEST',

  // Standard-Durchschnittstempo (bewegter Schnitt) in km/h. Pro Etappe über
  // `avgKmh` überschreibbar. Das steigungsabhängige Modell verteilt das Tempo
  // realistisch (bergauf langsamer, bergab schneller); der Etappenschnitt wird
  // anschließend exakt auf diesen Wert normalisiert.
  defaultAvgKmh: 22.5,

  // Die sieben Etappen in Reihenfolge.
  stages: [
    { n: 1, file: 'TT-2026 01 Lienz-Sillian_TRACK.gpx',       from: 'Lienz',        to: 'Sillian',      start: '2026-06-21T09:00:00+02:00' },
    { n: 2, file: 'TT-2026 02 Sillian-Falcade_TRACK.gpx',     from: 'Sillian',      to: 'Falcade',      start: '2026-06-22T09:00:00+02:00' },
    { n: 3, file: 'TT-2026 03 Falcade-San_Martino_TRACK.gpx', from: 'Falcade',      to: 'San Martino',  start: '2026-06-23T09:00:00+02:00' },
    { n: 4, file: 'TT-2026 04 San Martino-Possagno_TRACK.gpx',from: 'San Martino',  to: 'Possagno',     start: '2026-06-24T09:00:00+02:00' },
    { n: 5, file: 'TT-2026 05 Possagno-Semonzo_TRACK.gpx',    from: 'Possagno',     to: 'Semonzo',      start: '2026-06-25T09:00:00+02:00' },
    { n: 6, file: 'TT-2026 06 Semonzo-Lavarone_TRACK.gpx',    from: 'Semonzo',      to: 'Lavarone',     start: '2026-06-26T09:00:00+02:00' },
    { n: 7, file: 'TT-2026 07 Lavarone-Riva_TRACK.gpx',       from: 'Lavarone',     to: 'Riva',         start: '2026-06-27T09:00:00+02:00' },
  ],

  // Das Team fährt als Einheit -> ein gemeinsamer Avatar (Startnummer) auf der
  // Karte, Teamname/-farbe frei anpassbar.
  team: {
    name: 'kette.kurve.kontext',
    number: '45A',
    color: '#e6492d',
  },

  // Die drei Fahrerinnen für die Roster-Anzeige (Panini-/Radrenn-Stil).
  // flags: Ländercodes (DE, US, …) -> als kleine Flaggen dargestellt.
  // photo: Pfad zum Porträtfoto (optional); focus: Bildausschnitt (object-position).
  roster: [
    { name: 'Dr. Andrea Jeschke', flags: ['DE'],       photo: 'assets/riders/andrea.png', focus: 'center 25%' },
    { name: 'Katja Mangold',      flags: ['DE'],        photo: 'assets/riders/katja.png',  focus: 'center 30%' },
    { name: 'Tanja Smith',        flags: ['DE', 'US'],  photo: 'assets/riders/tanja.png',  focus: 'center 28%' },
  ],

  // Gruppenverhalten: leichte, reproduzierbare (reload-stabile) Tempo-Schwankung.
  group: {
    paceTimeJitter: 22,  // s: sanfte gemeinsame Tempo-Schwankung
  },

  // Simulator-Voreinstellungen (Test-Werkzeug für das Echtzeitverhalten).
  sim: {
    // Wird das Widget mit ?sim=1 geöffnet, startet der Simulator automatisch
    // sichtbar. Ohne Parameter läuft alles live an der echten Uhr.
    defaultMultiplier: 60,        // Standard-Zeitraffer
    multipliers: [1, 10, 60, 300, 1800], // wählbare Geschwindigkeiten
    // Startzeitpunkt des Simulators (kurz vor Etappe 1). null = jetzt.
    startAt: '2026-06-21T08:59:30+02:00',
  },
};

// Bequemer Zugriff: Etappen-Startzeit als Millisekunden.
export function stageStartMs(stage) {
  return new Date(stage.start).getTime();
}

export function avgKmhFor(stage) {
  return stage.avgKmh ?? CONFIG.defaultAvgKmh;
}

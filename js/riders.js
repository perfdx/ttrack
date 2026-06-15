// ===========================================================================
// Fahrer-Positionen aus der verstrichenen Etappenzeit.
//
// Das Team bleibt eng zusammen: eine gemeinsame, sanft schwankende Gruppenzeit
// (leichte zufällige Tempoabweichungen, aber alle zusammen) plus pro Fahrer ein
// kleiner Versatz von wenigen Metern. Alles ist deterministisch von der Zeit
// abhängig (seeded) -> bei Reload exakt dieselbe Position (Echtzeit-Treue).
// ===========================================================================

import { CONFIG } from './config.js';

// Glatte, reproduzierbare Pseudo-Schwingung (Summe inkommensurabler Sinus).
function smooth(t, seed) {
  const s = seed * 1.37;
  return (
    Math.sin(t * 0.012 + s) +
    0.6 * Math.sin(t * 0.031 + s * 2.1) +
    0.4 * Math.sin(t * 0.067 + s * 3.7)
  ) / 2.0; // ~[-1, 1]
}

// Liefert für jeden Fahrer Position + Momentantempo zum Zeitpunkt elapsed (s).
//   model: Stage-Modell aus timing.js
//   elapsed: s seit Etappenstart (0..duration)
export function ridersAt(model, elapsed) {
  const { duration, totalDist, distanceAtTime, positionAtDistance } = model;
  const e = Math.max(0, Math.min(duration, elapsed));

  // Gemeinsame Gruppenzeit: kleiner, sanfter Zeitversatz -> Team beschleunigt
  // und bremst gemeinsam. Klein genug, um monoton zu bleiben.
  const jitter = CONFIG.group.paceTimeJitter;
  const tGroup = Math.max(0, Math.min(duration, e + jitter * smooth(e, 0.5)));
  const groupDist = distanceAtTime(tGroup);

  // Momentantempo der Gruppe (zentrale Differenz) in km/h.
  const dt = 2;
  const d1 = distanceAtTime(Math.max(0, tGroup - dt));
  const d2 = distanceAtTime(Math.min(duration, tGroup + dt));
  const speedKmh = (((d2 - d1) / (Math.min(duration, tGroup + dt) - Math.max(0, tGroup - dt))) || 0) * 3.6;

  const spread = CONFIG.group.spreadMeters;
  const riders = CONFIG.riders.map((r, i) => {
    // Versatz weniger Meter, je Fahrer eigene Phase -> minimaler Positionstausch.
    const off = (spread / 2) * smooth(e + i * 53.0, i + 1);
    const d = Math.max(0, Math.min(totalDist, groupDist + off));
    const pos = positionAtDistance(d);
    return { ...r, index: i, dist: d, lat: pos.lat, lon: pos.lon, ele: pos.ele, gradePct: pos.gradePct };
  });

  return {
    riders,
    groupDist,
    speedKmh: Math.max(0, speedKmh),
    // repräsentative Werte (Gruppenmitte) für das Info-Panel
    ele: positionAtDistance(groupDist).ele,
    gradePct: positionAtDistance(groupDist).gradePct,
  };
}

// ===========================================================================
// Team-Position aus der verstrichenen Etappenzeit.
//
// Das Team fährt als Einheit -> eine gemeinsame Position. Eine sanft
// schwankende Gruppenzeit erzeugt leichte, reproduzierbare Tempo-Abweichungen
// (seeded -> bei Reload exakt dieselbe Position, Echtzeit-Treue).
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

// Liefert die Team-Position + Momentantempo zum Zeitpunkt elapsed (s).
//   model: Stage-Modell aus timing.js
//   elapsed: s seit Etappenstart (0..duration)
export function teamAt(model, elapsed) {
  const { duration, distanceAtTime, positionAtDistance } = model;
  const e = Math.max(0, Math.min(duration, elapsed));

  // Sanfter, gemeinsamer Zeitversatz -> leichte Tempo-Schwankung (monoton).
  const jitter = CONFIG.group.paceTimeJitter;
  const tGroup = Math.max(0, Math.min(duration, e + jitter * smooth(e, 0.5)));
  const dist = distanceAtTime(tGroup);
  const pos = positionAtDistance(dist);

  // Momentantempo (zentrale Differenz) in km/h.
  const dt = 2;
  const tA = Math.max(0, tGroup - dt), tB = Math.min(duration, tGroup + dt);
  const speedKmh = ((distanceAtTime(tB) - distanceAtTime(tA)) / Math.max(1e-6, tB - tA)) * 3.6;

  return {
    dist,
    lat: pos.lat,
    lon: pos.lon,
    ele: pos.ele,
    gradePct: pos.gradePct,
    speedKmh: Math.max(0, speedKmh),
  };
}

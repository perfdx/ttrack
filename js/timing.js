// ===========================================================================
// Steigungsabhängiges Tempomodell + Zeit/Distanz/Positions-Interpolation.
//
// Aus einem GPX-Track (ohne Zeitstempel) wird ein Zeitplan erzeugt: jedem
// Punkt wird eine Zeit `t` (s ab Etappenstart) zugewiesen. Bergauf wird das
// Tempo kleiner, bergab größer; anschließend wird der gesamte Zeitplan so
// skaliert, dass der Etappenschnitt exakt dem konfigurierten Wert entspricht.
// ===========================================================================

// Relatives Tempo als Funktion der Steigung in Prozent (Form, nicht absolut).
function relSpeed(gradePct) {
  if (gradePct >= 0) {
    // Bergauf: fällt mit der Steigung. ~8% => ~0.31, ~12% => ~0.23.
    return 1 / (1 + 0.28 * gradePct);
  }
  // Bergab: steigt, aber gedeckelt (Sicherheit/Kurven).
  return Math.min(2.2, 1 + 0.11 * -gradePct);
}

// Erzeugt aus einem Track-Objekt (siehe gpx.js) ein vollständiges Stage-Modell.
//   targetAvgKmh: gewünschter bewegter Etappenschnitt.
export function buildStageModel(track, targetAvgKmh) {
  const { lat, lon, ele, dist, count, totalDist } = track;

  // 1) Rohzeit je Segment aus der Tempo-Form (Einheit beliebig).
  const time = new Float64Array(count);
  time[0] = 0;
  for (let i = 1; i < count; i++) {
    const dd = dist[i] - dist[i - 1];
    if (dd <= 0) {
      time[i] = time[i - 1];
      continue;
    }
    const grade = ((ele[i] - ele[i - 1]) / dd) * 100;
    const v = relSpeed(grade);
    time[i] = time[i - 1] + dd / v; // dd / Tempo => Rohzeit
  }
  const rawTotal = time[count - 1];

  // 2) Auf Zielschnitt skalieren: Gesamtzeit = Strecke / Zielgeschwindigkeit.
  const targetTotalSec = totalDist / (targetAvgKmh / 3.6);
  const k = targetTotalSec / rawTotal;
  for (let i = 0; i < count; i++) time[i] *= k;

  // 3) Absolute Tempi clampen (5..58 km/h) für Realismus; Zeit nachziehen.
  const vMin = 5 / 3.6, vMax = 58 / 3.6;
  for (let i = 1; i < count; i++) {
    const dd = dist[i] - dist[i - 1];
    let dt = time[i] - time[i - 1];
    if (dd > 0) {
      const v = dd / Math.max(dt, 1e-6);
      if (v > vMax) dt = dd / vMax;
      else if (v < vMin) dt = dd / vMin;
    }
    time[i] = time[i - 1] + dt;
  }

  // Höhenmeter (Anstieg) für die Anzeige.
  let gain = 0;
  for (let i = 1; i < count; i++) gain += Math.max(0, ele[i] - ele[i - 1]);

  const duration = time[count - 1];

  // --- Interpolations-Helfer (binäre Suche über monotone Arrays) --------------
  function bisect(arr, x) {
    let lo = 0, hi = count - 1;
    if (x <= arr[0]) return 0;
    if (x >= arr[hi]) return hi - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (arr[mid] <= x) lo = mid; else hi = mid;
    }
    return lo;
  }

  // Distanz (m) zum Zeitpunkt t (s).
  function distanceAtTime(t) {
    if (t <= 0) return 0;
    if (t >= duration) return totalDist;
    const i = bisect(time, t);
    const dt = time[i + 1] - time[i];
    const f = dt > 0 ? (t - time[i]) / dt : 0;
    return dist[i] + f * (dist[i + 1] - dist[i]);
  }

  // Position {lat, lon, ele, gradePct} an Distanz d (m).
  function positionAtDistance(d) {
    d = Math.max(0, Math.min(totalDist, d));
    const i = bisect(dist, d);
    const dd = dist[i + 1] - dist[i];
    const f = dd > 0 ? (d - dist[i]) / dd : 0;
    const grade = dd > 0 ? ((ele[i + 1] - ele[i]) / dd) * 100 : 0;
    return {
      lat: lat[i] + f * (lat[i + 1] - lat[i]),
      lon: lon[i] + f * (lon[i + 1] - lon[i]),
      ele: ele[i] + f * (ele[i + 1] - ele[i]),
      gradePct: grade,
    };
  }

  return {
    track,
    time,
    duration,        // s
    totalDist,       // m
    gain,            // m
    avgKmh: targetAvgKmh,
    distanceAtTime,
    positionAtDistance,
  };
}

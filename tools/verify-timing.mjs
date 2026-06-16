// Headless-Sanity-Check für das Tempomodell (timing.js).
// Liest die echten GPX-Dateien, baut die Stage-Modelle und prüft:
//   - Etappenschnitt ≈ Zielschnitt
//   - plausible Dauer
//   - Monotonie von distanceAtTime
//   - Endpunkte von positionAtDistance
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStageModel } from '../js/timing.js';
import { CONFIG, avgKmhFor } from '../js/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const R = 6371000;
const hav = (a, b, c, d) => {
  const p1 = a * Math.PI / 180, p2 = c * Math.PI / 180;
  const dp = (c - a) * Math.PI / 180, dl = (d - b) * Math.PI / 180;
  const x = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};

function parseGpx(file) {
  const text = fs.readFileSync(file, 'utf8');
  const re = /lat="([-\d.]+)"\s+lon="([-\d.]+)">\s*<ele>([-\d.]+)/g;
  const la = [], lo = [], el = [];
  let m;
  while ((m = re.exec(text))) { la.push(+m[1]); lo.push(+m[2]); el.push(+m[3]); }
  const n = la.length;
  const lat = Float64Array.from(la), lon = Float64Array.from(lo), ele = Float64Array.from(el);
  const dist = new Float64Array(n);
  for (let i = 1; i < n; i++) dist[i] = dist[i - 1] + hav(lat[i - 1], lon[i - 1], lat[i], lon[i]);
  return { lat, lon, ele, dist, count: n, totalDist: dist[n - 1] };
}

let allOk = true;
for (const stage of CONFIG.stages) {
  const track = parseGpx(path.join(root, CONFIG.trackDir, stage.file));
  const model = buildStageModel(track, avgKmhFor(stage));

  const avg = (model.totalDist / model.duration) * 3.6;
  // Monotonie distanceAtTime
  let mono = true, prev = -1;
  for (let t = 0; t <= model.duration; t += model.duration / 200) {
    const d = model.distanceAtTime(t);
    if (d < prev - 1e-6) mono = false;
    prev = d;
  }
  const p0 = model.positionAtDistance(0);
  const pE = model.positionAtDistance(model.totalDist);
  const startOk = Math.abs(p0.lat - track.lat[0]) < 1e-6;
  const endOk = Math.abs(pE.lat - track.lat[track.count - 1]) < 1e-6;
  const avgOk = Math.abs(avg - model.avgKmh) < 0.5;

  const ok = mono && startOk && endOk && avgOk;
  allOk = allOk && ok;
  console.log(
    `E${stage.n} ${stage.from}→${stage.to}`.padEnd(28),
    `dist=${(model.totalDist / 1000).toFixed(1)}km`.padEnd(12),
    `dauer=${(model.duration / 3600).toFixed(2)}h`.padEnd(12),
    `Ø=${avg.toFixed(2)}km/h`.padEnd(14),
    `gain=${Math.round(model.gain)}m`.padEnd(11),
    `[mono=${mono} avg=${avgOk} ends=${startOk && endOk}]`,
    ok ? '✓' : '✗ FEHLER'
  );
}
console.log(allOk ? '\nAlle Etappen OK ✓' : '\nFEHLER in mindestens einer Etappe ✗');
process.exit(allOk ? 0 : 1);

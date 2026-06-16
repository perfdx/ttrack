// ===========================================================================
// GPX laden & parsen. Liefert Trackpunkte mit kumulativer Distanz.
// Reine Browser-Lösung (fetch + DOMParser), kein Build-Step.
// ===========================================================================

const R = 6371000; // Erdradius in Metern

// Haversine-Distanz zwischen zwei [lat, lon] in Metern.
export function haversine(aLat, aLon, bLat, bLon) {
  const p1 = (aLat * Math.PI) / 180;
  const p2 = (bLat * Math.PI) / 180;
  const dP = ((bLat - aLat) * Math.PI) / 180;
  const dL = ((bLon - aLon) * Math.PI) / 180;
  const x =
    Math.sin(dP / 2) ** 2 +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dL / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

// Lädt eine GPX-Datei und gibt ein Track-Objekt zurück:
//   { lat:Float64Array, lon:Float64Array, ele:Float64Array,
//     dist:Float64Array (kumulativ, m), totalDist }
export async function loadGpx(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GPX konnte nicht geladen werden: ${url} (${res.status})`);
  const text = await res.text();
  const doc = new DOMParser().parseFromString(text, 'application/xml');

  const err = doc.querySelector('parsererror');
  if (err) throw new Error(`GPX-Parsing fehlgeschlagen: ${url}`);

  const nodes = doc.getElementsByTagName('trkpt');
  const n = nodes.length;
  if (n < 2) throw new Error(`GPX enthält zu wenige Punkte: ${url}`);

  const lat = new Float64Array(n);
  const lon = new Float64Array(n);
  const ele = new Float64Array(n);
  const dist = new Float64Array(n);

  for (let i = 0; i < n; i++) {
    const p = nodes[i];
    lat[i] = parseFloat(p.getAttribute('lat'));
    lon[i] = parseFloat(p.getAttribute('lon'));
    const eleEl = p.getElementsByTagName('ele')[0];
    ele[i] = eleEl ? parseFloat(eleEl.textContent) : 0;
  }

  dist[0] = 0;
  for (let i = 1; i < n; i++) {
    dist[i] = dist[i - 1] + haversine(lat[i - 1], lon[i - 1], lat[i], lon[i]);
  }

  return { lat, lon, ele, dist, totalDist: dist[n - 1], count: n };
}

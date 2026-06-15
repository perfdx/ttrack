// ===========================================================================
// Kartendarstellung mit Leaflet (OpenStreetMap-Kacheln).
// Strava-Look: gesamte Route blass, zurückgelegter Teil kräftig, 3 Avatare.
// ===========================================================================

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '© OpenStreetMap';

export class MapView {
  constructor(elId) {
    this.map = L.map(elId, { zoomControl: true, preferCanvas: true, attributionControl: true });
    L.tileLayer(TILE_URL, { maxZoom: 18, attribution: TILE_ATTR }).addTo(this.map);
    this.map.setView([46.5, 12.0], 9);

    this.fullLine = null;   // gesamte Route (blass)
    this.trailLine = null;  // zurückgelegter Teil (kräftig)
    this.markers = [];      // Fahrer-Marker
    this.startDot = null;
    this.finishDot = null;
    this.ds = null;         // downsampled {lat,lon,dist}
  }

  // Downsampling auf ~1200 Punkte für flüssiges Rendern (Timing bleibt voll).
  _downsample(track) {
    const n = track.count;
    const target = 1200;
    const step = Math.max(1, Math.floor(n / target));
    const lat = [], lon = [], dist = [];
    for (let i = 0; i < n; i += step) { lat.push(track.lat[i]); lon.push(track.lon[i]); dist.push(track.dist[i]); }
    if (lat[lat.length - 1] !== track.lat[n - 1]) {
      lat.push(track.lat[n - 1]); lon.push(track.lon[n - 1]); dist.push(track.dist[n - 1]);
    }
    return { lat, lon, dist, n: lat.length };
  }

  setTrack(track, riders) {
    this.ds = this._downsample(track);
    const latlngs = this.ds.lat.map((la, i) => [la, this.ds.lon[i]]);

    if (this.fullLine) this.fullLine.remove();
    if (this.trailLine) this.trailLine.remove();
    if (this.startDot) this.startDot.remove();
    if (this.finishDot) this.finishDot.remove();
    this.markers.forEach((m) => m.remove());
    this.markers = [];

    this.fullLine = L.polyline(latlngs, { color: '#3a6ea5', weight: 4, opacity: 0.35 }).addTo(this.map);
    this.trailLine = L.polyline([], { color: '#ff5a2b', weight: 5, opacity: 0.95 }).addTo(this.map);

    const a = latlngs[0], b = latlngs[latlngs.length - 1];
    this.startDot = L.circleMarker(a, { radius: 6, color: '#fff', weight: 2, fillColor: '#1faf5a', fillOpacity: 1 }).addTo(this.map).bindTooltip('Start');
    this.finishDot = L.circleMarker(b, { radius: 6, color: '#fff', weight: 2, fillColor: '#111', fillOpacity: 1 }).addTo(this.map).bindTooltip('Ziel');

    // Fahrer-Marker (Avatare).
    riders.forEach((r) => {
      const icon = L.divIcon({
        className: 'rider-marker',
        html: `<div class="rider-pin" style="--c:${r.color}"><span>${r.emoji}</span></div>`,
        iconSize: [34, 34], iconAnchor: [17, 17],
      });
      const m = L.marker(a, { icon, zIndexOffset: 1000 }).addTo(this.map).bindTooltip(r.name, { direction: 'top', offset: [0, -16] });
      this.markers.push(m);
    });

    this.map.fitBounds(this.fullLine.getBounds(), { padding: [24, 24] });
  }

  // Trail bis groupDist + Marker setzen. faint=true => Vorschaumodus (kein Trail).
  update(groupDist, riders, faint = false) {
    if (!this.ds) return;
    if (faint) {
      this.trailLine.setLatLngs([]);
      this.markers.forEach((m, i) => m.setLatLng([riders[i].lat, riders[i].lon]));
      return;
    }
    const { lat, lon, dist, n } = this.ds;
    const pts = [];
    let i = 0;
    while (i < n && dist[i] <= groupDist) { pts.push([lat[i], lon[i]]); i++; }
    // letzten Punkt exakt auf groupDist interpolieren
    if (i > 0 && i < n) {
      const d0 = dist[i - 1], d1 = dist[i];
      const f = d1 > d0 ? (groupDist - d0) / (d1 - d0) : 0;
      pts.push([lat[i - 1] + f * (lat[i] - lat[i - 1]), lon[i - 1] + f * (lon[i] - lon[i - 1])]);
    }
    this.trailLine.setLatLngs(pts);
    this.markers.forEach((m, idx) => m.setLatLng([riders[idx].lat, riders[idx].lon]));
  }

  invalidate() { this.map.invalidateSize(); }
}

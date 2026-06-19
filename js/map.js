// ===========================================================================
// Kartendarstellung mit Leaflet (OpenStreetMap-Kacheln).
// Strava-Look: gesamte Route blass, zurückgelegter Teil kräftig, ein
// Team-Avatar (Startnummer/Bib).
// ===========================================================================

import { CONFIG } from './config.js';
import { teamAvatarMarkup } from './avatar.js';

const TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const TILE_ATTR = '© OpenStreetMap';

export class MapView {
  constructor(elId) {
    this.map = L.map(elId, { zoomControl: true, preferCanvas: true, attributionControl: true });
    L.tileLayer(TILE_URL, { maxZoom: 18, attribution: TILE_ATTR }).addTo(this.map);
    this.map.setView([46.5, 12.0], 9);

    this.fullLine = null;   // gesamte Route (blass)
    this.trailLine = null;  // zurückgelegter Teil (kräftig)
    this.teamMarker = null; // ein gemeinsamer Team-Avatar (Bib)
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

  setTrack(track, pos) {
    this.ds = this._downsample(track);
    const latlngs = this.ds.lat.map((la, i) => [la, this.ds.lon[i]]);

    if (this.fullLine) this.fullLine.remove();
    if (this.trailLine) this.trailLine.remove();
    if (this.startDot) this.startDot.remove();
    if (this.finishDot) this.finishDot.remove();
    if (this.teamMarker) this.teamMarker.remove();

    this.fullLine = L.polyline(latlngs, { color: '#1b5376', weight: 4, opacity: 0.45 }).addTo(this.map);
    this.trailLine = L.polyline([], { color: '#d36f2e', weight: 5, opacity: 0.97 }).addTo(this.map);

    const a = latlngs[0], b = latlngs[latlngs.length - 1];
    this.startDot = L.circleMarker(a, { radius: 6, color: '#fff', weight: 2, fillColor: '#1faf5a', fillOpacity: 1 }).addTo(this.map).bindTooltip('Start');
    this.finishDot = L.circleMarker(b, { radius: 6, color: '#fff', weight: 2, fillColor: '#111', fillOpacity: 1 }).addTo(this.map).bindTooltip('Ziel');

    // Gemeinsamer Team-Avatar: Gruppe aus drei leicht überlappenden Radtrikots.
    const team = CONFIG.team;
    const icon = L.divIcon({
      className: 'team-marker',
      html: teamAvatarMarkup(team),
      iconSize: [52, 30], iconAnchor: [26, 18],
    });
    const start = pos ? [pos.lat, pos.lon] : a;
    this.teamMarker = L.marker(start, { icon, zIndexOffset: 1000 }).addTo(this.map)
      .bindTooltip(team.name, { direction: 'top', offset: [0, -16] });

    this.map.fitBounds(this.fullLine.getBounds(), { padding: [24, 24] });
  }

  // Trail bis groupDist + Team-Marker setzen. faint=true => Vorschau (kein Trail).
  update(groupDist, pos, faint = false) {
    if (!this.ds) return;
    if (pos) this.teamMarker.setLatLng([pos.lat, pos.lon]);
    if (faint) { this.trailLine.setLatLngs([]); return; }

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
  }

  invalidate() { this.map.invalidateSize(); }
}

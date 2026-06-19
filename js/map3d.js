// ===========================================================================
// 3D-Kartenansicht im "Relive"-Stil mit MapLibre GL JS (Open Source, kein Key).
// Satellitenbild (Esri) über freiem Terrain-DEM (AWS Terrarium), Route gedrapt,
// Follow-Cam. Gleiche Schnittstelle wie MapView -> in widget.js austauschbar.
// Aktivierung über ?map=3d. MapLibre wird nur hier dynamisch nachgeladen.
// ===========================================================================

import { CONFIG } from './config.js';
import { teamAvatarElement } from './avatar.js';

const MAPLIBRE_JS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.js';
const MAPLIBRE_CSS = 'https://cdn.jsdelivr.net/npm/maplibre-gl@4.7.1/dist/maplibre-gl.css';

const SAT_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const DEM_TILES = 'https://elevation-tiles-prod.s3.amazonaws.com/terrarium/{z}/{x}/{y}.png';

let _loaderPromise = null;
function loadMapLibre() {
  if (window.maplibregl) return Promise.resolve();
  if (_loaderPromise) return _loaderPromise;
  _loaderPromise = new Promise((resolve, reject) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = MAPLIBRE_CSS;
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = MAPLIBRE_JS;
    js.async = true;
    js.onload = () => resolve();
    js.onerror = () => reject(new Error('MapLibre GL konnte nicht geladen werden'));
    document.head.appendChild(js);
  });
  return _loaderPromise;
}

// Kompass-Kurs (Grad) von Punkt A nach B.
function bearing(lat1, lon1, lat2, lon2) {
  const toR = Math.PI / 180, toD = 180 / Math.PI;
  const y = Math.sin((lon2 - lon1) * toR) * Math.cos(lat2 * toR);
  const x = Math.cos(lat1 * toR) * Math.sin(lat2 * toR) -
            Math.sin(lat1 * toR) * Math.cos(lat2 * toR) * Math.cos((lon2 - lon1) * toR);
  return (Math.atan2(y, x) * toD + 360) % 360;
}

export class Map3DView {
  constructor(elId) {
    this.elId = elId;
    this.map = null;
    this.ready = false;
    this.ds = null;                 // downsampled {lat,lon,dist,n}
    this.team = CONFIG.team;
    this.marker = null;
    this._pendingTrack = null;      // {track,pos}, falls vor map.load aufgerufen
    this._lastUpdate = null;        // {groupDist,pos,faint}
    this._lastCamMs = 0;
    this._bearing = 0;
    this._bearingInit = false;

    loadMapLibre().then(() => this._init()).catch((err) => {
      console.error(err);
      const el = document.getElementById(elId);
      if (el) el.innerHTML = '<div style="padding:16px;color:#6b7783;font:14px Poppins,sans-serif">3D-Karte konnte nicht geladen werden.</div>';
    });
  }

  _init() {
    if (this._destroyed) return;
    const style = {
      version: 8,
      glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
      sources: {
        sat: { type: 'raster', tiles: [SAT_TILES], tileSize: 256, maxzoom: 19, attribution: '© Esri, Maxar, Earthstar Geographics' },
        dem: { type: 'raster-dem', tiles: [DEM_TILES], tileSize: 256, maxzoom: 15, encoding: 'terrarium', attribution: 'Terrain: AWS Terrain Tiles' },
      },
      layers: [
        { id: 'sat', type: 'raster', source: 'sat' },
        { id: 'hillshade', type: 'hillshade', source: 'dem', paint: { 'hillshade-exaggeration': 0.35 } },
      ],
      terrain: { source: 'dem', exaggeration: 1.3 },
    };

    this.map = new maplibregl.Map({
      container: this.elId,
      style,
      center: [12.0, 46.5],
      zoom: 9, pitch: 60, bearing: 0, maxPitch: 80,
      attributionControl: { compact: true },
    });
    this.map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right');

    this.map.on('load', () => {
      if (this._destroyed) return;
      try { this.map.setTerrain({ source: 'dem', exaggeration: 1.3 }); } catch (e) { /* in style */ }
      try {
        this.map.setSky({
          'sky-color': '#9fc4e8', 'horizon-color': '#e0eaf3', 'fog-color': '#eaf1f7',
          'sky-horizon-blend': 0.6, 'horizon-fog-blend': 0.5, 'fog-ground-blend': 0.4, 'atmosphere-blend': 0.6,
        });
      } catch (e) { /* ältere MapLibre ohne setSky */ }

      this.map.addSource('route', { type: 'geojson', data: this._line([]) });
      this.map.addSource('trail', { type: 'geojson', data: this._line([]) });
      this.map.addLayer({ id: 'route', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#1b5376', 'line-width': 3, 'line-opacity': 0.85 } });
      this.map.addLayer({ id: 'trail', type: 'line', source: 'trail',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#d36f2e', 'line-width': 5 } });

      this.marker = new maplibregl.Marker({ element: teamAvatarElement(this.team) })
        .setLngLat([12.0, 46.5]).addTo(this.map);

      // Attributions-Badge standardmäßig eingeklappt (nur kleines "i").
      this._collapseAttribution();
      setTimeout(() => this._collapseAttribution(), 600);

      this.ready = true;
      if (this._pendingTrack) { const { track, pos } = this._pendingTrack; this._pendingTrack = null; this.setTrack(track, pos); }
      if (this._lastUpdate) { const u = this._lastUpdate; this.update(u.groupDist, u.pos, u.faint); }
    });
  }

  _line(coordinates) {
    return { type: 'Feature', geometry: { type: 'LineString', coordinates }, properties: {} };
  }

  _downsample(track) {
    const n = track.count, target = 1200, step = Math.max(1, Math.floor(n / target));
    const lat = [], lon = [], dist = [];
    for (let i = 0; i < n; i += step) { lat.push(track.lat[i]); lon.push(track.lon[i]); dist.push(track.dist[i]); }
    if (lat[lat.length - 1] !== track.lat[n - 1]) { lat.push(track.lat[n - 1]); lon.push(track.lon[n - 1]); dist.push(track.dist[n - 1]); }
    return { lat, lon, dist, n: lat.length };
  }

  setTrack(track, pos) {
    if (!this.ready) { this._pendingTrack = { track, pos }; return; }
    this.ds = this._downsample(track);
    const coords = this.ds.lat.map((la, i) => [this.ds.lon[i], la]); // [lng,lat]
    this.map.getSource('route').setData(this._line(coords));
    this.map.getSource('trail').setData(this._line([]));
    const start = pos ? [pos.lon, pos.lat] : coords[0];
    if (this.marker) this.marker.setLngLat(start);
    this._fitRoute(coords);
    this._bearingInit = false;
  }

  _fitRoute(coords) {
    let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    for (const [lng, lat] of coords) {
      if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
    }
    this.map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, pitch: 55, bearing: 0, duration: 0, maxZoom: 13 });
  }

  update(groupDist, pos, faint = false) {
    this._lastUpdate = { groupDist, pos, faint };
    if (!this.ready || !this.ds) return;
    if (pos && this.marker) this.marker.setLngLat([pos.lon, pos.lat]);
    if (faint) { this.map.getSource('trail').setData(this._line([])); return; }

    const { lat, lon, dist, n } = this.ds;
    const coords = [];
    let i = 0;
    while (i < n && dist[i] <= groupDist) { coords.push([lon[i], lat[i]]); i++; }
    if (i > 0 && i < n) {
      const d0 = dist[i - 1], d1 = dist[i], f = d1 > d0 ? (groupDist - d0) / (d1 - d0) : 0;
      coords.push([lon[i - 1] + f * (lon[i] - lon[i - 1]), lat[i - 1] + f * (lat[i] - lat[i - 1])]);
    }
    this.map.getSource('trail').setData(this._line(coords));

    if (pos) this._follow(pos, groupDist);
  }

  // Gekippte, gethrottelte Kameraverfolgung in Fahrtrichtung.
  // Avatar sitzt im unteren Bilddrittel (padding), Strecke voraus oben sichtbar.
  _follow(pos, groupDist) {
    const now = performance.now();
    if (now - this._lastCamMs < 220) return;
    this._lastCamMs = now;

    const ahead = this._pointAhead(groupDist, 200) || pos;
    const brg = bearing(pos.lat, pos.lon, ahead.lat, ahead.lon);
    if (!this._bearingInit) { this._bearing = brg; this._bearingInit = true; }
    else {
      const diff = ((brg - this._bearing + 540) % 360) - 180; // kürzeste Differenz
      this._bearing = (this._bearing + diff * 0.35 + 360) % 360; // glätten
    }
    const h = (this.map.getContainer && this.map.getContainer().clientHeight) || 360;
    this.map.easeTo({
      center: [pos.lon, pos.lat],
      bearing: this._bearing,
      pitch: 62, zoom: 13,
      padding: { top: Math.round(h * 0.45), bottom: 0, left: 0, right: 0 },
      duration: 400, essential: true,
    });
  }

  _pointAhead(groupDist, meters) {
    const { lat, lon, dist, n } = this.ds;
    const target = Math.min(dist[n - 1], groupDist + meters);
    let i = 0; while (i < n - 1 && dist[i + 1] < target) i++;
    const j = Math.min(i + 1, n - 1);
    const d0 = dist[i], d1 = dist[j], f = d1 > d0 ? (target - d0) / (d1 - d0) : 0;
    return { lat: lat[i] + f * (lat[j] - lat[i]), lon: lon[i] + f * (lon[j] - lon[i]) };
  }

  // MapLibre rendert das kompakte Attributions-<details> initial aufgeklappt;
  // hier einklappen, sodass nur das kleine "i" sichtbar ist (Klick öffnet wieder).
  _collapseAttribution() {
    if (!this.map || this._destroyed) return;
    const c = this.map.getContainer && this.map.getContainer();
    const a = c && c.querySelector('.maplibregl-ctrl-attrib');
    if (!a) return;
    a.classList.remove('maplibregl-compact-show');
    if (a.tagName === 'DETAILS') a.open = false;
  }

  invalidate() { if (this.map && this.ready) this.map.resize(); }

  // Aufräumen für den Wechsel der Karten-Engine (2D <-> 3D).
  destroy() {
    this._destroyed = true;
    try { if (this.map) this.map.remove(); } catch (e) { /* ignore */ }
    this.map = null; this.marker = null; this.ready = false;
    const el = document.getElementById(this.elId);
    if (el) { el.innerHTML = ''; el.removeAttribute('style'); el.className = ''; }
  }
}

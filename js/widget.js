// ===========================================================================
// Orchestrierung: Zustandsautomat (Countdown / Fahrt / beendet), Lade-Cache
// der Etappen, requestAnimationFrame-Loop und Verdrahtung aller Module.
// ===========================================================================

import { CONFIG, stageStartMs, avgKmhFor } from './config.js';
import { loadGpx } from './gpx.js';
import { buildStageModel } from './timing.js';
import { teamAt } from './riders.js';
import { Clock } from './clock.js';
import { MapView } from './map.js';
import { ElevationView } from './elevation.js';
import { SimPanel } from './sim.js';
import { fmtCountdown, fmtDuration, fmtStageTime } from './countdown.js';

// Kleine Länderflaggen als inline-SVG (zuverlässig auch auf Windows, wo
// Emoji-Flaggen nicht dargestellt werden). Erweiterbar per weiterer Codes.
function flagSVG(code) {
  const flags = {
    DE: `<svg viewBox="0 0 5 3" class="flag" aria-label="Deutschland"><rect width="5" height="1" y="0" fill="#000"/><rect width="5" height="1" y="1" fill="#D00"/><rect width="5" height="1" y="2" fill="#FFCE00"/></svg>`,
    US: `<svg viewBox="0 0 7 3" class="flag" aria-label="USA"><rect width="7" height="3" fill="#fff"/>` +
        [0, 2, 4, 6, 8, 10, 12].map((i) => `<rect width="7" height="${(3 / 13).toFixed(3)}" y="${(i * 3 / 13).toFixed(3)}" fill="#B22234"/>`).join('') +
        `<rect width="2.8" height="${(3 * 7 / 13).toFixed(3)}" fill="#3C3B6E"/></svg>`,
  };
  return flags[code] || `<span class="flag flag-txt">${code}</span>`;
}

class Widget {
  constructor() {
    this.clock = new Clock();
    this.map = new MapView('map');
    this.elev = new ElevationView(document.getElementById('elevation'));
    this.sim = new SimPanel(this.clock, document.getElementById('sim-panel'), () => {});

    this.cache = new Map();   // stageIndex -> Stage-Modell
    this.loading = new Set();
    this.shownIndex = null;   // welcher Track gerade auf Karte/Profil liegt
    this.error = null;

    this.$ = (id) => document.getElementById(id);

    // Kopf: Titel + Teamname/Startnummer, Roster rechts.
    this.$('title').textContent = CONFIG.title;
    this.renderTeam();
    this.renderRoster();

    // Simulator über Zahnrad oder ?sim=1.
    this.$('gear').addEventListener('click', () => {
      this.sim.visible ? (this.clock.setReal(), this.sim.hide()) : this.sim.activate();
    });
    const params = new URLSearchParams(location.search);
    if (params.get('sim') === '1') this.sim.activate();

    // Layout-Korrektur für Leaflet nach dem ersten Frame.
    setTimeout(() => this.map.invalidate(), 200);

    requestAnimationFrame(() => this.frame());
  }

  // Teamname + Startnummer (Bib) im Kopf.
  renderTeam() {
    const t = CONFIG.team;
    const el = this.$('team');
    if (!el) return;
    el.innerHTML = `<span class="team-bib-sm" style="--c:${t.color}">${t.number}</span><span class="team-name">${t.name}</span>`;
  }

  // Roster der drei Fahrerinnen (Panini-/Radrenn-Stil) rechts.
  renderRoster() {
    const el = this.$('roster');
    if (!el) return;
    el.innerHTML = `
      <div class="roster-head">
        <span class="roster-team">${CONFIG.team.name}</span>
        <span class="roster-num" style="--c:${CONFIG.team.color}">${CONFIG.team.number}</span>
      </div>
      ${CONFIG.roster.map((r) => {
        const initials = r.name.replace(/^Dr\.?\s*/, '').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
        const flags = r.flags.map(flagSVG).join('');
        // Foto füllend einpassen (object-fit: cover); bei fehlender Datei
        // wird das <img> entfernt -> Silhouette/Initialen als Fallback.
        const photo = r.photo
          ? `<img class="rc-photo" src="${r.photo}" alt="${r.name}" loading="lazy" style="object-position:${r.focus || 'center top'}" onerror="this.remove()">`
          : '';
        return `
        <div class="rider-card">
          <div class="rc-portrait">${photo}<span class="rc-initials">${initials}</span></div>
          <div class="rc-info">
            <div class="rc-flags">${flags}</div>
            <div class="rc-name">${r.name}</div>
          </div>
        </div>`;
      }).join('')}
    `;
  }

  beginLoad(i) {
    if (this.loading.has(i) || this.cache.has(i)) return;
    this.loading.add(i);
    const stage = CONFIG.stages[i];
    loadGpx(CONFIG.trackDir + encodeURIComponent(stage.file))
      .then((track) => {
        const model = buildStageModel(track, avgKmhFor(stage));
        model.stage = stage;
        this.cache.set(i, model);
      })
      .catch((err) => { console.error(err); this.error = err.message; })
      .finally(() => this.loading.delete(i));
  }

  // Bestimmt, was gerade angezeigt werden soll.
  resolve(now) {
    const stages = CONFIG.stages;
    let L = -1, U = -1;
    for (let i = 0; i < stages.length; i++) {
      const s = stageStartMs(stages[i]);
      if (s <= now) L = i;
      if (s > now && U < 0) U = i;
    }

    if (L >= 0) {
      const model = this.cache.get(L);
      if (!model) { this.beginLoad(L); return { mode: 'loading', index: L }; }
      const startMs = stageStartMs(stages[L]);
      if (now <= startMs + model.duration * 1000) {
        return { mode: 'during', index: L, model, startMs, elapsed: (now - startMs) / 1000 };
      }
    }

    if (U >= 0) {
      const model = this.cache.get(U);
      if (!model) { this.beginLoad(U); return { mode: 'loading', index: U }; }
      return { mode: 'countdown', index: U, model, startMs: stageStartMs(stages[U]) };
    }

    return { mode: 'finished' };
  }

  ensureTrackShown(d) {
    if (this.shownIndex === d.index || !d.model) return;
    const team0 = teamAt(d.model, 0);
    this.map.setTrack(d.model.track, team0);
    this.elev.setTrack(d.model.track);
    this.shownIndex = d.index;
    this.map.invalidate();
  }

  frame() {
    try {
      const now = this.clock.now();
      const d = this.resolve(now);
      this.render(now, d);
      this.sim.update();
    } catch (err) {
      console.error('Frame-Fehler:', err);
    }
    // Nächsten Frame immer planen, damit ein einzelner Fehler die Animation
    // nicht dauerhaft stoppt.
    requestAnimationFrame(() => this.frame());
  }

  render(now, d) {
    const overlay = this.$('overlay');
    const live = this.$('status');

    // Status-Badge
    const simOn = this.sim.visible;
    live.textContent = simOn ? 'SIM' : 'LIVE';
    live.className = 'badge ' + (simOn ? 'sim' : 'live');

    if (this.error) {
      overlay.className = 'overlay show';
      overlay.innerHTML = `<div class="ov-card"><h2>Fehler</h2><p>${this.error}</p></div>`;
      return;
    }

    if (d.mode === 'loading') {
      overlay.className = 'overlay show';
      overlay.innerHTML = `<div class="ov-card"><div class="spinner"></div><p>Etappe ${CONFIG.stages[d.index].n} wird geladen…</p></div>`;
      return;
    }

    if (d.mode === 'finished') {
      overlay.className = 'overlay show';
      overlay.innerHTML = `<div class="ov-card"><h2>🏁 Transalp beendet</h2><p>Alle ${CONFIG.stages.length} Etappen gefahren. Chapeau!</p></div>`;
      this.setInfo({ name: 'TT-2026 Transalp', badge: 'Ziel', done: 1, dist: 0, total: 0, ele: 0, grade: 0, speed: 0, remain: 0, arrival: '' });
      return;
    }

    this.ensureTrackShown(d);
    const stage = CONFIG.stages[d.index];

    if (d.mode === 'countdown') {
      // Vorschau (Route blass, Team an der Startlinie).
      const t0 = teamAt(d.model, 0);
      this.map.update(0, t0, true);
      this.elev.update(0, true);

      overlay.className = 'overlay show countdown';
      overlay.innerHTML = `
        <div class="ov-card">
          <div class="ov-label">Nächste Etappe ${stage.n}</div>
          <h2>${stage.from} → ${stage.to}</h2>
          <div class="ov-stats">
            <span>${(d.model.totalDist / 1000).toFixed(1)} km</span>
            <span>${Math.round(d.model.gain)} hm</span>
            <span>Ø ${d.model.avgKmh} km/h</span>
            <span>~${fmtDuration(d.model.duration)}</span>
          </div>
          <div class="ov-when">Start: ${fmtStageTime(stage)}</div>
          <div class="ov-timer">${fmtCountdown(d.startMs - now)}</div>
          <div class="ov-sub">bis zum Start</div>
        </div>`;
      this.setInfo({ name: `Etappe ${stage.n}: ${stage.from} → ${stage.to}`, badge: 'Countdown',
        done: 0, dist: 0, total: d.model.totalDist, ele: d.model.track.ele[0], grade: 0, speed: 0,
        remain: d.model.duration, arrival: this.arrivalStr(d.startMs, d.model.duration) });
      return;
    }

    // ---- WÄHREND der Etappe -------------------------------------------------
    overlay.className = 'overlay';
    const t = teamAt(d.model, d.elapsed);
    this.map.update(t.dist, t, false);
    this.elev.update(t.dist, false);

    const remain = Math.max(0, d.model.duration - d.elapsed);
    this.setInfo({
      name: `Etappe ${stage.n}: ${stage.from} → ${stage.to}`,
      badge: simOn ? 'SIM-Fahrt' : 'LIVE',
      done: t.dist / d.model.totalDist,
      dist: t.dist, total: d.model.totalDist,
      ele: t.ele, grade: t.gradePct, speed: t.speedKmh,
      remain, arrival: this.arrivalStr(d.startMs, d.model.duration),
    });
  }

  arrivalStr(startMs, duration) {
    return new Date(startMs + duration * 1000).toLocaleTimeString('de-DE',
      { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) + ' Uhr';
  }

  setInfo(o) {
    this.$('stage-name').textContent = o.name;
    const badge = this.$('stage-badge');
    badge.textContent = o.badge;
    this.$('m-dist').textContent = `${(o.dist / 1000).toFixed(1)} / ${(o.total / 1000).toFixed(1)} km`;
    this.$('m-progress').style.width = `${Math.round(o.done * 100)}%`;
    this.$('m-pct').textContent = `${Math.round(o.done * 100)} %`;
    this.$('m-ele').textContent = `${Math.round(o.ele)} m`;
    this.$('m-grade').textContent = `${o.grade >= 0 ? '+' : ''}${o.grade.toFixed(1)} %`;
    this.$('m-speed').textContent = `${o.speed.toFixed(1)} km/h`;
    this.$('m-remain').textContent = o.remain ? fmtDuration(o.remain) : '–';
    this.$('m-arrival').textContent = o.arrival || '–';
  }
}

window.addEventListener('DOMContentLoaded', () => { window.ttWidget = new Widget(); });

// ===========================================================================
// Zeit-Simulator: Test-Werkzeug, um das Echtzeitverhalten zu prüfen.
// Play/Pause, Zeitraffer (1×…1800×), Scrubber über das gesamte Rennen,
// Sprung an jeden Etappenstart. "Live" schaltet zurück auf die echte Uhr.
// ===========================================================================

import { CONFIG, stageStartMs } from './config.js';
import { fmtStageTime } from './countdown.js';

export class SimPanel {
  constructor(clock, panelEl, onLive) {
    this.clock = clock;
    this.el = panelEl;
    this.onLive = onLive;

    const stages = CONFIG.stages;
    this.min = stageStartMs(stages[0]) - 60 * 60 * 1000;        // 1h vor Etappe 1
    this.max = stageStartMs(stages[stages.length - 1]) + 14 * 60 * 60 * 1000; // ~Tagesende E7

    this.el.innerHTML = `
      <div class="sim-head">
        <strong>⏱ Zeit-Simulator</strong>
        <button class="sim-live" title="Auf echte Zeit zurückschalten">● LIVE</button>
      </div>
      <div class="sim-time" data-role="time">–</div>
      <div class="sim-row">
        <button class="sim-pp" data-role="pp">⏸</button>
        <div class="sim-speeds" data-role="speeds"></div>
      </div>
      <input class="sim-scrub" type="range" min="${this.min}" max="${this.max}" step="60000" value="${this.min}">
      <div class="sim-row sim-jump">
        <label>Sprung zu&nbsp;</label>
        <select data-role="jump">
          <option value="">Etappe wählen…</option>
          ${stages.map((s) => `<option value="${stageStartMs(s) - 30000}">Etappe ${s.n}: ${s.from}–${s.to}</option>`).join('')}
        </select>
      </div>
    `;

    this.timeEl = this.el.querySelector('[data-role="time"]');
    this.ppEl = this.el.querySelector('[data-role="pp"]');
    this.scrub = this.el.querySelector('.sim-scrub');
    this.speedsEl = this.el.querySelector('[data-role="speeds"]');

    for (const m of CONFIG.sim.multipliers) {
      const b = document.createElement('button');
      b.textContent = `${m}×`;
      b.dataset.mult = m;
      b.addEventListener('click', () => { this.clock.setMultiplier(m); this._renderSpeeds(); });
      this.speedsEl.appendChild(b);
    }

    this.ppEl.addEventListener('click', () => { this.clock.togglePlay(); this._renderPP(); });
    this.scrub.addEventListener('input', () => { this.clock.setVirtual(Number(this.scrub.value)); });
    this.el.querySelector('[data-role="jump"]').addEventListener('change', (e) => {
      if (e.target.value) { this.clock.setVirtual(Number(e.target.value)); this.clock.play(); this._renderPP(); }
    });
    this.el.querySelector('.sim-live').addEventListener('click', () => {
      this.clock.setReal();
      this.hide();
      this.onLive && this.onLive();
    });

    this._renderSpeeds();
    this._renderPP();
  }

  // Simulator aktivieren: virtuelle Zeit setzen und Panel anzeigen.
  activate() {
    const startAt = CONFIG.sim.startAt ? new Date(CONFIG.sim.startAt).getTime() : Date.now();
    this.clock.setVirtual(startAt);
    this.clock.setMultiplier(CONFIG.sim.defaultMultiplier);
    this.clock.play();
    this.show();
    this._renderSpeeds();
    this._renderPP();
  }

  show() { this.el.classList.add('open'); }
  hide() { this.el.classList.remove('open'); }
  get visible() { return this.el.classList.contains('open'); }

  _renderSpeeds() {
    this.speedsEl.querySelectorAll('button').forEach((b) => {
      b.classList.toggle('active', Number(b.dataset.mult) === this.clock.multiplier);
    });
  }

  _renderPP() {
    this.ppEl.textContent = this.clock.playing ? '⏸' : '▶';
  }

  // Jeden Frame: Zeitanzeige + Scrubber aktualisieren (außer beim Ziehen).
  update() {
    if (!this.visible) return;
    const now = this.clock.now();
    const d = new Date(now);
    this.timeEl.textContent = d.toLocaleString('de-DE', {
      weekday: 'short', day: '2-digit', month: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      timeZone: 'Europe/Rome',
    }) + ` ${CONFIG.timezoneLabel}  (${this.clock.multiplier}×${this.clock.playing ? '' : ' ⏸'})`;
    if (document.activeElement !== this.scrub) {
      this.scrub.value = String(Math.min(this.max, Math.max(this.min, now)));
    }
  }
}

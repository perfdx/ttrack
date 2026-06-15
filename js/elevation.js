// ===========================================================================
// Höhenprofil als SVG-Flächenchart. Zeigt die ganze Etappe, schattiert den
// zurückgelegten Teil und markiert die aktuelle Live-Position.
// ===========================================================================

const W = 1000, H = 220;            // viewBox-Einheiten
const PAD = { l: 46, r: 14, t: 14, b: 26 };

export class ElevationView {
  constructor(svgEl) {
    this.svg = svgEl;
    this.svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    this.svg.setAttribute('preserveAspectRatio', 'none');
    this.ds = null;
  }

  _downsample(track) {
    const n = track.count;
    const target = 800;
    const step = Math.max(1, Math.floor(n / target));
    const dist = [], ele = [];
    for (let i = 0; i < n; i += step) { dist.push(track.dist[i]); ele.push(track.ele[i]); }
    dist.push(track.dist[n - 1]); ele.push(track.ele[n - 1]);
    return { dist, ele, n: dist.length };
  }

  _x(d) { return PAD.l + (d / this.totalDist) * (W - PAD.l - PAD.r); }
  _y(e) { return H - PAD.b - ((e - this.emin) / (this.espan)) * (H - PAD.t - PAD.b); }

  setTrack(track) {
    this.ds = this._downsample(track);
    this.totalDist = track.totalDist;
    let emin = Infinity, emax = -Infinity;
    for (const e of this.ds.ele) { if (e < emin) emin = e; if (e > emax) emax = e; }
    this.emin = Math.floor(emin / 50) * 50;
    this.emax = Math.ceil(emax / 50) * 50;
    this.espan = Math.max(1, this.emax - this.emin);

    const base = H - PAD.b;
    // Vollständige Profil-Fläche.
    let d = `M ${this._x(0)} ${base}`;
    for (let i = 0; i < this.ds.n; i++) d += ` L ${this._x(this.ds.dist[i]).toFixed(1)} ${this._y(this.ds.ele[i]).toFixed(1)}`;
    d += ` L ${this._x(this.totalDist)} ${base} Z`;

    // Achsbeschriftung.
    const yTicks = [this.emin, Math.round((this.emin + this.emax) / 2 / 50) * 50, this.emax];
    let ticks = '';
    for (const e of yTicks) {
      ticks += `<line x1="${PAD.l}" y1="${this._y(e).toFixed(1)}" x2="${W - PAD.r}" y2="${this._y(e).toFixed(1)}" class="ele-grid"/>`;
      ticks += `<text x="${PAD.l - 6}" y="${(this._y(e) + 4).toFixed(1)}" class="ele-axis" text-anchor="end">${e}</text>`;
    }
    const km = this.totalDist / 1000;
    let xticks = '';
    const xStep = km > 80 ? 20 : km > 30 ? 10 : 5;
    for (let x = 0; x <= km; x += xStep) {
      xticks += `<text x="${this._x(x * 1000).toFixed(1)}" y="${H - 8}" class="ele-axis" text-anchor="middle">${x}</text>`;
    }

    this.svg.innerHTML = `
      <g>${ticks}${xticks}</g>
      <path d="${d}" class="ele-full"/>
      <clipPath id="ele-clip"><rect x="0" y="0" width="0" height="${H}"/></clipPath>
      <path d="${d}" class="ele-trail" clip-path="url(#ele-clip)"/>
      <line class="ele-cursor" x1="0" y1="${PAD.t}" x2="0" y2="${base}"/>
      <circle class="ele-dot" r="5" cx="0" cy="0"/>
      <text x="${W - PAD.r}" y="${PAD.t + 2}" class="ele-axis ele-unit" text-anchor="end">m ü. NN</text>
    `;
    this.clipRect = this.svg.querySelector('#ele-clip rect');
    this.cursor = this.svg.querySelector('.ele-cursor');
    this.dot = this.svg.querySelector('.ele-dot');
    this.update(0, true);
  }

  // groupDist (m). faint=true => Vorschau ohne Marker/Trail.
  update(groupDist, faint = false) {
    if (!this.ds) return;
    const x = this._x(groupDist);
    if (faint) {
      this.clipRect.setAttribute('width', '0');
      this.cursor.style.display = 'none';
      this.dot.style.display = 'none';
      return;
    }
    this.cursor.style.display = '';
    this.dot.style.display = '';
    this.clipRect.setAttribute('width', x.toFixed(1));

    // aktuelle Höhe interpolieren
    const { dist, ele, n } = this.ds;
    let i = 0; while (i < n - 1 && dist[i + 1] < groupDist) i++;
    const d0 = dist[i], d1 = dist[Math.min(i + 1, n - 1)];
    const f = d1 > d0 ? (groupDist - d0) / (d1 - d0) : 0;
    const e = ele[i] + f * (ele[Math.min(i + 1, n - 1)] - ele[i]);
    const y = this._y(e);
    this.cursor.setAttribute('x1', x.toFixed(1));
    this.cursor.setAttribute('x2', x.toFixed(1));
    this.dot.setAttribute('cx', x.toFixed(1));
    this.dot.setAttribute('cy', y.toFixed(1));
  }
}

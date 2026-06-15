// ===========================================================================
// Uhr-Abstraktion: echte Zeit (live) oder virtuelle Zeit (Simulator).
//
// Live  : now() == echte Wanduhr -> Anzeige synchron zur Realität.
// Sim   : virtuelle Uhr mit frei wählbarem Startpunkt, Zeitraffer-Faktor und
//         Play/Pause. now() wird aus einem Anker linear hochgerechnet.
// ===========================================================================

export class Clock {
  constructor() {
    this.mode = 'real';        // 'real' | 'virtual'
    this.multiplier = 1;
    this.playing = true;
    this._anchorVirtual = Date.now(); // virtuelle Zeit am Anker
    this._anchorReal = Date.now();    // reale Zeit am Anker
  }

  now() {
    if (this.mode === 'real') return Date.now();
    if (!this.playing) return this._anchorVirtual;
    return this._anchorVirtual + (Date.now() - this._anchorReal) * this.multiplier;
  }

  // Anker neu setzen, ohne dass die aktuelle virtuelle Zeit springt.
  _rebase() {
    this._anchorVirtual = this.now();
    this._anchorReal = Date.now();
  }

  // In den Simulator-Modus wechseln und die virtuelle Zeit setzen.
  setVirtual(ts) {
    this.mode = 'virtual';
    this._anchorVirtual = ts;
    this._anchorReal = Date.now();
  }

  // Zurück zur echten Uhr (Live-Betrieb).
  setReal() {
    this.mode = 'real';
    this.playing = true;
    this.multiplier = 1;
  }

  setMultiplier(m) {
    if (this.mode === 'virtual') this._rebase();
    this.multiplier = m;
  }

  pause() {
    if (this.mode !== 'virtual') return;
    this._rebase();
    this.playing = false;
  }

  play() {
    if (this.mode !== 'virtual') return;
    this._anchorReal = Date.now();
    this.playing = true;
  }

  togglePlay() {
    this.playing ? this.pause() : this.play();
  }
}

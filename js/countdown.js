// ===========================================================================
// Hilfsfunktionen für Countdown- und Zeitformatierung.
// ===========================================================================

import { CONFIG } from './config.js';

// ms -> "Td HH:MM:SS" bzw. "HH:MM:SS".
export function fmtCountdown(ms) {
  ms = Math.max(0, ms);
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (x) => String(x).padStart(2, '0');
  const hms = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return d > 0 ? `${d} Tag${d === 1 ? '' : 'e'}  ${hms}` : hms;
}

// s -> "Hh MMm".
export function fmtDuration(sec) {
  sec = Math.max(0, Math.round(sec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}min`;
}

// Datum/Uhrzeit der Etappe in Ortszeit (CEST) hübsch anzeigen.
export function fmtStageTime(stage) {
  const dt = new Date(stage.start);
  const date = dt.toLocaleDateString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Rome',
  });
  const time = dt.toLocaleTimeString('de-DE', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
  });
  return `${date}, ${time} ${CONFIG.timezoneLabel}`;
}

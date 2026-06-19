// ===========================================================================
// Geteiltes Avatar-Markup für den Team-Marker (2D-Leaflet und 3D-MapLibre).
// Pulsierende "Live-Standort"-Ringe + Gruppe aus drei überlappenden Radtrikots.
// ===========================================================================

// Einzelnes Trikot als Inline-SVG.
function jerseySVG(color) {
  return `<svg class="team-jersey" viewBox="0 0 24 26" style="--j:${color}">
            <path d="M6,5 L9,4 L12,6 L15,4 L18,5 L23,8 L20,12.5 L17.5,10.5 L17.5,24 L6.5,24 L6.5,10.5 L4,12.5 L1,8 Z"/>
          </svg>`;
}

// Vollständiges Avatar-HTML (für Leaflet divIcon bzw. MapLibre Marker-Element).
export function teamAvatarMarkup(team) {
  return `<div class="team-avatar" style="--c:${team.color}">
            <span class="team-pulse"></span>
            <span class="team-pulse team-pulse-2"></span>
            <div class="team-jerseys">${team.jerseys.map(jerseySVG).join('')}</div>
          </div>`;
}

// Als DOM-Element (für MapLibre, das ein Element erwartet).
export function teamAvatarElement(team) {
  const el = document.createElement('div');
  el.className = 'team-marker';
  el.innerHTML = teamAvatarMarkup(team);
  return el;
}

/**
 * Interaktives SVG Dartboard
 * Zeichnet ein millimetergenaues Wettkampf-Dartboard mit Hover- und Klick-Erkennung.
 */

import { BOARD_SEGMENTS } from '../engine/darts-math.js';

export class DartboardUI {
  constructor(containerId, onThrowCallback) {
    this.container = typeof containerId === 'string' ? document.getElementById(containerId) : containerId;
    this.onThrow = onThrowCallback;
    this.lastDarts = [];
    this.render();
  }

  render() {
    if (!this.container) return;

    const size = 500;
    const center = 250;
    const rBull = 9;
    const rOuterBull = 22;
    const rTripleInner = 125;
    const rTripleOuter = 142;
    const rDoubleInner = 205;
    const rDoubleOuter = 222;
    const rBoard = 245;

    let svg = `<svg viewBox="0 0 ${size} ${size}" class="dartboard-svg" id="dartboard-svg" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="board-rim-grad" cx="50%" cy="50%" r="50%">
          <stop offset="85%" stop-color="#0f1115" />
          <stop offset="100%" stop-color="#23272f" />
        </radialGradient>
        <filter id="dart-glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <!-- Äußerer Rahmen (Miss-Zone) -->
      <circle cx="${center}" cy="${center}" r="${rBoard}" class="segment-miss" data-segment="0" />
      <circle cx="${center}" cy="${center}" r="${rDoubleOuter}" class="board-wire-bg" />
    `;

    // 20 Segmente rendern
    const segmentAngle = 360 / 20; // 18 Grad
    const offsetAngle = -90 - (segmentAngle / 2); // 20 oben zentriert

    BOARD_SEGMENTS.forEach((number, i) => {
      const angleStart = offsetAngle + i * segmentAngle;
      const angleEnd = angleStart + segmentAngle;
      const midAngle = (angleStart + angleEnd) / 2;

      // Farben (PDC Standard: Schwarz/Weiß, Rot/Grün)
      const isRedGreen = (i % 2 === 0); // 20 ist Rot
      const colorSingle = isRedGreen ? 'segment-single-black' : 'segment-single-cream';
      const colorDouble = isRedGreen ? 'segment-double-red' : 'segment-double-green';
      const colorTriple = isRedGreen ? 'segment-triple-red' : 'segment-triple-green';

      // 1. Double Ring Arc
      svg += this.createArcPath(center, center, rDoubleInner, rDoubleOuter, angleStart, angleEnd,
        `${colorDouble} board-segment`, `D${number}`, `Double ${number}`);

      // 2. Äußeres Single Bett
      svg += this.createArcPath(center, center, rTripleOuter, rDoubleInner, angleStart, angleEnd,
        `${colorSingle} board-segment`, `S${number}`, `Single ${number}`);

      // 3. Triple Ring Arc
      svg += this.createArcPath(center, center, rTripleInner, rTripleOuter, angleStart, angleEnd,
        `${colorTriple} board-segment`, `T${number}`, `Triple ${number}`);

      // 4. Inneres Single Bett
      svg += this.createArcPath(center, center, rOuterBull, rTripleInner, angleStart, angleEnd,
        `${colorSingle} board-segment`, `S${number}`, `Single ${number}`);

      // Zahlenring Beschriftung (Drahtzahlen)
      const labelRadius = 234;
      const rad = (midAngle * Math.PI) / 180;
      const lx = center + labelRadius * Math.cos(rad);
      const ly = center + labelRadius * Math.sin(rad) + 5;
      svg += `<text x="${lx}" y="${ly}" class="board-number" text-anchor="middle" font-size="16">${number}</text>`;
    });

    // Outer Bull (25 - Grün)
    svg += `<circle cx="${center}" cy="${center}" r="${rOuterBull}" class="segment-bull-outer board-segment" data-segment="25" title="Single Bull (25)" />`;

    // Bullseye (50 - Rot)
    svg += `<circle cx="${center}" cy="${center}" r="${rBull}" class="segment-bull-inner board-segment" data-segment="BULL" title="Double Bull / Bullseye (50)" />`;

    // Container für Dart-Treffer-Markierungen
    svg += `<g id="dart-markers-layer"></g>`;

    svg += `</svg>`;

    this.container.innerHTML = svg;
    this.bindEvents();
  }

  createArcPath(cx, cy, rIn, rOut, startAngle, endAngle, className, segmentCode, title) {
    const rad1 = (startAngle * Math.PI) / 180;
    const rad2 = (endAngle * Math.PI) / 180;

    const x1 = cx + rOut * Math.cos(rad1);
    const y1 = cy + rOut * Math.sin(rad1);
    const x2 = cx + rOut * Math.cos(rad2);
    const y2 = cy + rOut * Math.sin(rad2);

    const x3 = cx + rIn * Math.cos(rad2);
    const y3 = cy + rIn * Math.sin(rad2);
    const x4 = cx + rIn * Math.cos(rad1);
    const y4 = cy + rIn * Math.sin(rad1);

    const d = `M ${x1} ${y1} A ${rOut} ${rOut} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${rIn} ${rIn} 0 0 0 ${x4} ${y4} Z`;
    return `<path d="${d}" class="${className}" data-segment="${segmentCode}" title="${title}"><title>${title}</title></path>`;
  }

  bindEvents() {
    const segments = this.container.querySelectorAll('.board-segment, .segment-miss');
    const svgEl = this.container.querySelector('svg');
    segments.forEach(seg => {
      seg.addEventListener('click', (e) => {
        e.stopPropagation();
        const code = seg.getAttribute('data-segment');
        let coords = null;
        if (svgEl) {
          const rect = svgEl.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            // Coordinate relative to center (scale factor based on 500x500 viewBox)
            const sx = ((e.clientX - rect.left) / rect.width) * 500 - 250;
            const sy = ((e.clientY - rect.top) / rect.height) * 500 - 250;
            // Map 222 (double outer) to 170mm
            coords = {
              x: (sx / 222) * 170,
              y: (sy / 222) * 170
            };
          }
        }
        if (this.onThrow && code) {
          this.onThrow(code, coords);
        }
      });
    });
  }

  clearMarkers() {
    const layer = this.container.querySelector('#dart-markers-layer');
    if (layer) layer.innerHTML = '';
  }

  addDartMarker(segmentCode, dartIndex) {
    const layer = this.container.querySelector('#dart-markers-layer');
    if (!layer) return;

    // Finde das SVG-Element des Segments, um den Mittelpunkt zu ermitteln
    const segEl = this.container.querySelector(`[data-segment="${segmentCode}"]`);
    if (!segEl) return;

    try {
      const bbox = segEl.getBBox();
      const cx = bbox.x + bbox.width / 2 + (Math.random() - 0.5) * 6;
      const cy = bbox.y + bbox.height / 2 + (Math.random() - 0.5) * 6;

      const color = dartIndex === 1 ? '#00e5ff' : dartIndex === 2 ? '#ffb300' : '#ff2a70';

      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      marker.innerHTML = `
        <circle cx="${cx}" cy="${cy}" r="6" fill="${color}" stroke="#ffffff" stroke-width="1.5" filter="url(#dart-glow)" />
        <text x="${cx}" y="${cy + 3}" text-anchor="middle" font-size="8" font-weight="bold" fill="#000">${dartIndex}</text>
      `;
      layer.appendChild(marker);
    } catch (e) {
      console.warn('Could not add dart marker:', e);
    }
  }
}

export { DartboardUI as DartsDartboard };

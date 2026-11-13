/**
 * Hybrid Darts Heatmap Component
 * Supports Gaussian Density Cloud (KDE) and Segment Choropleth Heatmaps.
 */
import { BOARD_SPECS } from '../engine/darts-math.js';

export class DartsHeatmap {
  constructor(canvasElement, boardContainer) {
    this.canvas = canvasElement;
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.boardContainer = boardContainer;
    this.darts = [];
    this.mode = 'hybrid'; // 'density' | 'choropleth' | 'hybrid'
    this.initCanvasSize();
  }

  initCanvasSize() {
    if (!this.canvas) return;
    this.canvas.width = 440;
    this.canvas.height = 440;
  }

  setDarts(dartsArray) {
    this.darts = dartsArray || [];
    this.render();
  }

  setMode(mode) {
    this.mode = mode;
    this.render();
  }

  render() {
    if (!this.ctx || !this.canvas) return;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    if (this.darts.length === 0) return;

    if (this.mode === 'choropleth' || this.mode === 'hybrid') {
      this.renderSegmentChoropleth();
    }

    if (this.mode === 'density' || this.mode === 'hybrid') {
      this.renderDensityCloud();
    }
  }

  /**
   * Colors segments according to hit frequency
   */
  renderSegmentChoropleth() {
    // Count frequencies per segment & multiplier
    const segmentCounts = {};
    let maxHits = 1;

    for (const d of this.darts) {
      if (!d.segment) continue;
      const key = `${d.multiplier > 1 ? (d.multiplier === 2 ? 'D' : 'T') : 'S'}${d.segment}`;
      segmentCounts[key] = (segmentCounts[key] || 0) + 1;
      if (segmentCounts[key] > maxHits) maxHits = segmentCounts[key];
    }

    // Apply color glow to board SVG elements if accessible
    const svg = (this.boardContainer ? this.boardContainer.querySelector('svg') : null) || document.getElementById('heatmap-dartboard-svg') || document.querySelector('#heatmap-board-mount svg');
    if (!svg) return;

    // Reset all segments
    svg.querySelectorAll('[data-segment]').forEach(el => {
      const segVal = parseInt(el.dataset.segment, 10);
      const multVal = parseInt(el.dataset.multiplier, 10);
      const key = `${multVal > 1 ? (multVal === 2 ? 'D' : 'T') : 'S'}${segVal}`;
      const count = segmentCounts[key] || 0;

      if (count > 0) {
        const intensity = count / maxHits;
        const color = this.getIntensityColor(intensity);
        el.style.fill = color;
        el.style.opacity = (0.35 + intensity * 0.55).toString();
      } else {
        el.style.fill = '';
        el.style.opacity = '0.15';
      }
    });
  }

  /**
   * Renders Gaussian Density Cloud on Canvas for exact (x, y) coordinates
   */
  renderDensityCloud() {
    const coords = this.darts.filter(d => d.coordX !== null && d.coordX !== undefined && d.coordY !== null);
    if (coords.length === 0) return;

    const width = this.canvas.width;
    const height = this.canvas.height;
    const centerX = width / 2;
    const centerY = height / 2;
    // Map board radius (BOARD_SPECS.doubleOuterRadius = 170mm) to canvas radius (approx 190px)
    const scale = 190 / BOARD_SPECS.doubleOuterRadius;

    // Create offscreen buffer for density accumulation
    const buffer = document.createElement('canvas');
    buffer.width = width;
    buffer.height = height;
    const bCtx = buffer.getContext('2d');

    bCtx.fillStyle = 'rgba(0,0,0,1)';
    bCtx.fillRect(0, 0, width, height);

    coords.forEach(pt => {
      // Coordinates are assumed relative to center in mm or svg space
      const px = centerX + (pt.coordX * scale);
      const py = centerY + (pt.coordY * scale);

      const rad = 24;
      const grad = bCtx.createRadialGradient(px, py, 2, px, py, rad);
      grad.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
      grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

      bCtx.fillStyle = grad;
      bCtx.beginPath();
      bCtx.arc(px, py, rad, 0, Math.PI * 2);
      bCtx.fill();
    });

    // Colorize buffer onto main canvas
    const imgData = bCtx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const outImg = this.ctx.createImageData(width, height);
    const outData = outImg.data;

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i]; // Grayscale intensity (0 - 255)
      if (alpha > 8) {
        const norm = alpha / 255;
        const [r, g, b] = this.getRGBFromNorm(norm);
        outData[i] = r;
        outData[i + 1] = g;
        outData[i + 2] = b;
        outData[i + 3] = Math.min(240, alpha * 1.5);
      }
    }

    this.ctx.putImageData(outImg, 0, 0);
  }

  getIntensityColor(norm) {
    if (norm < 0.25) return '#3b82f6'; // Blue
    if (norm < 0.5) return '#10b981';  // Green
    if (norm < 0.75) return '#f59e0b'; // Yellow/Orange
    return '#ef4444';                  // Hot Red
  }

  getRGBFromNorm(norm) {
    if (norm < 0.3) {
      return [0, Math.floor(norm * 3 * 255), 255];
    } else if (norm < 0.7) {
      const t = (norm - 0.3) / 0.4;
      return [Math.floor(t * 255), 255, Math.floor((1 - t) * 255)];
    } else {
      const t = (norm - 0.7) / 0.3;
      return [255, Math.floor((1 - t) * 200), 0];
    }
  }
}

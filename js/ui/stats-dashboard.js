/**
 * Comprehensive Stats & Head-to-Head Dashboard UI Controller
 */
import { db } from '../storage/db.js';
import { DartsExporter } from '../storage/exporter.js';
import { DartsHeatmap } from './heatmap.js';
import { DartboardUI } from './dartboard.js';

export class StatsDashboard {
  constructor(app) {
    this.app = app;
    this.activeTab = 'h2h';
    this.heatmap = null;
    this.heatmapBoard = null;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.modal = document.getElementById('modal-h2h-stats');
    this.btnClose = document.getElementById('btn-close-h2h-stats');
    this.tabButtons = document.querySelectorAll('.h2h-tab-btn');
    this.tabPanels = document.querySelectorAll('.h2h-tab-panel');

    // H2H Selectors
    this.selectPlayerA = document.getElementById('h2h-player-a');
    this.selectPlayerB = document.getElementById('h2h-player-b');
    this.h2hStatsContent = document.getElementById('h2h-content');

    // Match history
    this.matchesList = document.getElementById('h2h-matches-list');

    // Heatmap elements
    this.heatmapPlayerSelect = document.getElementById('heatmap-player-select');
    this.heatmapModeSelect = document.getElementById('heatmap-mode-select');
    this.heatmapTypeSelect = document.getElementById('heatmap-type-select');
    this.heatmapCanvas = document.getElementById('heatmap-canvas');
    this.heatmapSvg = document.getElementById('heatmap-dartboard-svg');

    // Backup & Export buttons
    this.btnExportMatchesCsv = document.getElementById('btn-export-matches-csv');
    this.btnExportDartsCsv = document.getElementById('btn-export-darts-csv');
    this.btnDownloadBackupJson = document.getElementById('btn-download-backup-json');
    this.inputRestoreJson = document.getElementById('input-restore-json');
    this.btnClearDatabase = document.getElementById('btn-clear-database');
  }

  bindEvents() {
    // Open from header
    const btnOpen = document.getElementById('btn-stats-h2h');
    if (btnOpen) {
      btnOpen.addEventListener('click', () => this.show());
    }

    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.hide());
    }

    // Tab switching
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        this.switchTab(tab);
      });
    });

    // H2H Selectors
    if (this.selectPlayerA && this.selectPlayerB) {
      this.selectPlayerA.addEventListener('change', () => this.renderH2H());
      this.selectPlayerB.addEventListener('change', () => this.renderH2H());
    }

    // Heatmap controls
    if (this.heatmapPlayerSelect) {
      this.heatmapPlayerSelect.addEventListener('change', () => this.refreshHeatmap());
    }
    if (this.heatmapModeSelect) {
      this.heatmapModeSelect.addEventListener('change', () => this.refreshHeatmap());
    }
    if (this.heatmapTypeSelect) {
      this.heatmapTypeSelect.addEventListener('change', () => {
        if (this.heatmap) {
          this.heatmap.setMode(this.heatmapTypeSelect.value);
        }
      });
    }

    // Export & Backup
    if (this.btnExportMatchesCsv) {
      this.btnExportMatchesCsv.addEventListener('click', () => DartsExporter.exportMatchesCSV());
    }
    if (this.btnExportDartsCsv) {
      this.btnExportDartsCsv.addEventListener('click', () => DartsExporter.exportDartsCSV());
    }
    if (this.btnDownloadBackupJson) {
      this.btnDownloadBackupJson.addEventListener('click', () => DartsExporter.downloadBackupJSON());
    }
    if (this.inputRestoreJson) {
      this.inputRestoreJson.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const res = await DartsExporter.restoreBackupFromJSONFile(file);
          alert(`Erfolgreich importiert: ${res.playersImported} Spieler, ${res.matchesImported} Matches, ${res.dartsImported} Würfe.`);
          await this.show();
        } catch (err) {
          alert('Fehler beim Import: ' + err.message);
        }
      });
    }
    if (this.btnClearDatabase) {
      this.btnClearDatabase.addEventListener('click', async () => {
        if (confirm('ACHTUNG: Möchtest du wirklich alle gespeicherten Spieler, Matches und Würfe unwiderruflich löschen?')) {
          await db.clearAll();
          alert('Datenbank auf Werkseinstellungen zurückgesetzt.');
          await this.show();
        }
      });
    }
  }

  async show(defaultTab = 'h2h') {
    if (this.app) this.app.closeModals();
    if (this.modal) this.modal.classList.add('active');
    await this.populatePlayerSelectors();
    this.switchTab(defaultTab);
  }

  hide() {
    if (this.modal) this.modal.classList.remove('active');
  }

  switchTab(tab) {
    this.activeTab = tab;
    this.tabButtons.forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tab);
    });
    this.tabPanels.forEach(p => {
      p.classList.toggle('active', p.id === `tab-panel-${tab}`);
    });

    if (tab === 'h2h') {
      this.renderH2H();
    } else if (tab === 'history') {
      this.renderHistory();
    } else if (tab === 'heatmap') {
      this.initHeatmap();
    }
  }

  async populatePlayerSelectors() {
    const players = await db.getPlayers();

    const fillSelect = (sel, selectedIndex) => {
      if (!sel) return;
      const current = sel.value;
      sel.innerHTML = '';
      players.forEach((p, idx) => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.avatar || '🎯'} ${p.name}`;
        if (current ? p.id === current : idx === selectedIndex) {
          opt.selected = true;
        }
        sel.appendChild(opt);
      });
    };

    fillSelect(this.selectPlayerA, 0);
    fillSelect(this.selectPlayerB, 1 < players.length ? 1 : 0);
    fillSelect(this.heatmapPlayerSelect, 0);
  }

  // --- TAB 1: HEAD-TO-HEAD ---
  async renderH2H() {
    if (!this.h2hStatsContent) return;

    const idA = this.selectPlayerA?.value;
    const idB = this.selectPlayerB?.value;

    if (!idA || !idB || idA === idB) {
      this.h2hStatsContent.innerHTML = `<div class="empty-state">Bitte wähle zwei verschiedene Spieler für den Head-to-Head Vergleich aus.</div>`;
      return;
    }

    const pA = await db.getPlayerById(idA);
    const pB = await db.getPlayerById(idB);
    const matches = await db.getMatches();

    // Filter matches between A and B
    const h2hMatches = matches.filter(m => {
      const ids = (m.players || []).map(p => p.id);
      return ids.includes(idA) && ids.includes(idB);
    });

    let winsA = 0;
    let winsB = 0;
    const modeWins = {};

    h2hMatches.forEach(m => {
      if (m.winnerId === idA) winsA++;
      if (m.winnerId === idB) winsB++;

      const mode = m.mode || 'x01';
      if (!modeWins[mode]) modeWins[mode] = { a: 0, b: 0, total: 0 };
      modeWins[mode].total++;
      if (m.winnerId === idA) modeWins[mode].a++;
      if (m.winnerId === idB) modeWins[mode].b++;
    });

    // Darts performance stats
    const dartsA = await db.getDartsByPlayer(idA);
    const dartsB = await db.getDartsByPlayer(idB);

    const calcPlayerStats = (darts) => {
      const count = darts.length;
      const totalScore = darts.reduce((acc, d) => acc + (d.score || 0), 0);
      const avg = count > 0 ? ((totalScore / count) * 3).toFixed(2) : '0.00';
      const c180 = darts.filter(d => d.turnScore === 180 || (d.segment === 20 && d.multiplier === 3)).length; // Approx 180s/maxima
      const checkouts = darts.filter(d => d.isCheckout).length;
      const doubleAttempts = darts.filter(d => d.isDoubleAttempt).length;
      const checkoutPct = doubleAttempts > 0 ? ((checkouts / doubleAttempts) * 100).toFixed(1) + '%' : '-';
      return { count, avg, c180, checkouts, checkoutPct };
    };

    const sA = calcPlayerStats(dartsA);
    const sB = calcPlayerStats(dartsB);

    // Build H2H Dashboard HTML
    this.h2hStatsContent.innerHTML = `
      <div class="h2h-scoreboard">
        <div class="h2h-player-card" style="border-top: 4px solid ${pA?.color || '#00f0ff'}">
          <div class="avatar">${pA?.avatar || '⚡'}</div>
          <div class="name">${pA?.name || 'Spieler 1'}</div>
          <div class="wins-big">${winsA}</div>
          <div class="wins-label">SIEGE</div>
        </div>

        <div class="h2h-vs-divider">
          <div class="total-matches">${h2hMatches.length} Duelle</div>
          <div class="vs-badge">VS</div>
        </div>

        <div class="h2h-player-card" style="border-top: 4px solid ${pB?.color || '#ff0055'}">
          <div class="avatar">${pB?.avatar || '🦅'}</div>
          <div class="name">${pB?.name || 'Spieler 2'}</div>
          <div class="wins-big">${winsB}</div>
          <div class="wins-label">SIEGE</div>
        </div>
      </div>

      <div class="h2h-metrics-table">
        <div class="metric-row">
          <span class="val-a ${parseFloat(sA.avg) >= parseFloat(sB.avg) ? 'better' : ''}">${sA.avg}</span>
          <span class="metric-label">3-Dart Average</span>
          <span class="val-b ${parseFloat(sB.avg) >= parseFloat(sA.avg) ? 'better' : ''}">${sB.avg}</span>
        </div>
        <div class="metric-row">
          <span class="val-a">${sA.checkoutPct}</span>
          <span class="metric-label">Doppelquote (Checkout %)</span>
          <span class="val-b">${sB.checkoutPct}</span>
        </div>
        <div class="metric-row">
          <span class="val-a">${sA.checkouts}</span>
          <span class="metric-label">Checkouts verwandelt</span>
          <span class="val-b">${sB.checkouts}</span>
        </div>
        <div class="metric-row">
          <span class="val-a">${sA.count}</span>
          <span class="metric-label">Gesamte Darts geworfen</span>
          <span class="val-b">${sB.count}</span>
        </div>
      </div>

      <div class="h2h-modes-breakdown">
        <h4>Bilanz nach Spielmodi</h4>
        <div class="modes-grid">
          ${Object.keys(modeWins).length > 0 ? Object.entries(modeWins).map(([mode, data]) => `
            <div class="mode-badge-card">
              <div class="mode-name">${mode.toUpperCase()} (${data.total})</div>
              <div class="mode-score">${data.a} : ${data.b}</div>
            </div>
          `).join('') : '<div class="empty-state">Noch keine direkten Duelle absolviert.</div>'}
        </div>
      </div>
    `;
  }

  // --- TAB 2: MATCH HISTORIE ---
  async renderHistory() {
    if (!this.matchesList) return;
    const matches = await db.getMatches();

    if (matches.length === 0) {
      this.matchesList.innerHTML = `<div class="empty-state">Noch keine beendeten Matches in der Datenbank.</div>`;
      return;
    }

    this.matchesList.innerHTML = '';
    matches.forEach(m => {
      const card = document.createElement('div');
      card.className = 'history-match-card';
      const dateStr = new Date(m.timestamp).toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
      const p1 = m.players && m.players[0] ? m.players[0].name : 'Spieler 1';
      const p2 = m.players && m.players[1] ? m.players[1].name : 'Spieler 2';
      const winner = m.players ? (m.players.find(p => p.id === m.winnerId)?.name || 'Unentschieden') : 'Unbekannt';

      card.innerHTML = `
        <div class="history-card-header">
          <span class="mode-tag">${(m.mode || 'x01').toUpperCase()}</span>
          <span class="date-tag">${dateStr}</span>
        </div>
        <div class="history-players">
          <span class="${m.winnerId === m.players?.[0]?.id ? 'is-winner' : ''}">${p1}</span>
          <span class="vs-span">vs</span>
          <span class="${m.winnerId === m.players?.[1]?.id ? 'is-winner' : ''}">${p2}</span>
        </div>
        <div class="history-winner">
          🏆 Sieger: <strong>${winner}</strong>
        </div>
        <div class="history-actions">
          <button class="btn-sm btn-scolia" style="background: rgba(0, 240, 255, 0.15); border-color: var(--accent-cyan); color: var(--accent-cyan);" title="Scolia Spiel- & Leg-Analyse">🎯 Scolia-Analyse</button>
          <button class="btn-sm btn-print" title="PDF Spielbericht drucken">🖨️ Bericht</button>
          <button class="btn-sm btn-csv" title="Darts CSV">📄 CSV</button>
          <button class="btn-sm btn-del" title="Löschen">🗑️</button>
        </div>
      `;

      card.querySelector('.btn-scolia').addEventListener('click', () => {
        if (this.app && this.app.openScoliaForMatch) {
          this.app.openScoliaForMatch(m.id);
        }
      });

      card.querySelector('.btn-print').addEventListener('click', () => {
        DartsExporter.printMatchReport(m.id);
      });

      card.querySelector('.btn-csv').addEventListener('click', () => {
        DartsExporter.exportDartsCSV(m.id);
      });

      card.querySelector('.btn-del').addEventListener('click', async () => {
        if (confirm('Dieses Match wirklich löschen?')) {
          await db.deleteMatch(m.id);
          this.renderHistory();
        }
      });

      this.matchesList.appendChild(card);
    });
  }

  // --- TAB 3: HEATMAP ---
  async initHeatmap() {
    const mount = document.getElementById('heatmap-board-mount');
    if (!this.heatmapBoard && mount) {
      this.heatmapBoard = new DartboardUI('heatmap-board-mount', null);
    }
    if (!this.heatmap && this.heatmapCanvas) {
      this.heatmap = new DartsHeatmap(this.heatmapCanvas, mount);
    }
    await this.refreshHeatmap();
  }

  async refreshHeatmap() {
    if (!this.heatmap) return;
    const playerId = this.heatmapPlayerSelect?.value;
    const mode = this.heatmapModeSelect?.value || null;

    if (!playerId) return;

    const darts = await db.getDartsByPlayer(playerId, mode === 'all' ? null : mode);
    this.heatmap.setDarts(darts);

    const statsElem = document.getElementById('heatmap-stats-summary');
    if (statsElem) {
      const doubles = darts.filter(d => d.multiplier === 2).length;
      const triples = darts.filter(d => d.multiplier === 3).length;
      const bulls = darts.filter(d => d.segment === 25).length;
      statsElem.innerHTML = `
        <span>Geworfene Darts: <strong>${darts.length}</strong></span> •
        <span>Doppel-Treffer: <strong>${doubles}</strong></span> •
        <span>Triple-Treffer: <strong>${triples}</strong></span> •
        <span>Bulls: <strong>${bulls}</strong></span>
      `;
    }
  }
}

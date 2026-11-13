/**
 * Scolia-Style Match & Leg Statistics Dashboard
 * Rendert vollwertige Scolia-Statistiken für X01 und Cricket:
 * - Leg-Tab-Navigation (Gesamt, Leg 1..N, Live Leg)
 * - Side-by-Side Spieler-Karten
 * - Scolia Metrik-Grid (3-Dart Avg, First-9, Checkout %, High Finish, Best Leg)
 * - Scolia Relative Head-to-Head Scoring-Balken (180, 140+, 100+, 60+, <60)
 * - Interaktiver SVG Average-Verlaufsgraph
 * - Turn-by-Turn Leg Scorecard Tabelle
 */

export class ScoliaDashboard {
  constructor() {
    this.container = null;
    this.dataSource = null; // engine oder matchRecord
    this.selectedTab = 'overall'; // 'overall', 'live', oder Index 0..N
  }

  /**
   * Rendert das vollständige Scolia-Dashboard in den Zielcontainer.
   * @param {HTMLElement} container - Ziel-DOM-Element (z. B. #stats-modal-body)
   * @param {Object} dataSource - Live GameEngine oder gespeichertes Match-Objekt aus IndexedDB
   * @param {string|number} initialTab - 'overall' (Standard), 'live', oder leg-index
   */
  render(container, dataSource, initialTab = 'overall') {
    this.container = container;
    this.dataSource = dataSource;
    this.selectedTab = initialTab;

    if (!container || !dataSource) return;
    this.updateView();
  }

  updateView() {
    const isLiveEngine = !!this.dataSource.getScoliaMatchSummary || !!this.dataSource.players;
    const mode = (this.dataSource.gameMode || this.dataSource.mode || 'X01').toUpperCase();

    if (mode === 'CRICKET') {
      this.renderCricketDashboard();
      return;
    }

    // X01 Daten aufbereiten
    const matchData = this.extractX01MatchData();
    const legs = matchData.legs || [];
    const hasLiveLeg = matchData.isLive && matchData.currentLegStats && matchData.currentLegStats.turns?.length > 0;

    // Tabs auf Gültigkeit prüfen
    if (this.selectedTab !== 'overall' && this.selectedTab !== 'live') {
      const idx = parseInt(this.selectedTab, 10);
      if (isNaN(idx) || idx < 0 || idx >= legs.length) {
        this.selectedTab = 'overall';
      }
    }
    if (this.selectedTab === 'live' && !hasLiveLeg) {
      this.selectedTab = legs.length > 0 ? (legs.length - 1).toString() : 'overall';
    }

    let html = `
      <div class="scolia-dashboard-wrapper">
        <!-- Scolia Header & Leg Tabs -->
        <div class="scolia-header-row">
          <div class="scolia-title-wrap">
            <h3 class="scolia-main-title">🎯 Scolia Match & Leg Analyse</h3>
            <span class="scolia-subtitle">${matchData.title}</span>
          </div>
          <div class="scolia-tabs-nav" role="tablist">
            <button class="scolia-tab-btn ${this.selectedTab === 'overall' ? 'active' : ''}" data-tab="overall">
              🏆 Gesamt-Match
            </button>
            ${legs.map((leg, i) => `
              <button class="scolia-tab-btn ${this.selectedTab === i.toString() ? 'active' : ''}" data-tab="${i}">
                Leg ${leg.legNumber || (i + 1)} ${leg.winnerName ? `✓` : ''}
              </button>
            `).join('')}
            ${hasLiveLeg ? `
              <button class="scolia-tab-btn scolia-tab-live ${this.selectedTab === 'live' ? 'active' : ''}" data-tab="live">
                🎯 Aktuelles Leg (Live)
              </button>
            ` : ''}
          </div>
        </div>

        <!-- Tab Content Body -->
        <div class="scolia-tab-content">
          ${this.selectedTab === 'overall'
            ? this.renderOverallView(matchData)
            : this.renderSingleLegView(matchData, this.selectedTab)}
        </div>
      </div>
    `;

    this.container.innerHTML = html;
    this.attachEventListeners(matchData);
  }

  attachEventListeners(matchData) {
    const tabBtns = this.container.querySelectorAll('.scolia-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tab = e.currentTarget.dataset.tab;
        this.selectedTab = tab;
        this.updateView();
      });
    });
  }

  /**
   * Extrahiert einheitliche X01 Match-Daten aus GameEngine ODER MatchRecord
   */
  extractX01MatchData() {
    const ds = this.dataSource;

    // Fall 1: Live GameEngine
    if (typeof ds.getScoliaMatchSummary === 'function') {
      const summary = ds.getScoliaMatchSummary();
      const currentLegStats = typeof ds.getCurrentLegStats === 'function' ? ds.getCurrentLegStats() : null;
      return {
        isLive: !ds.isMatchOver,
        title: `${ds.startScore} ${ds.outRule || 'DOUBLE'} OUT • Set ${ds.currentSet} / Leg ${ds.currentLeg}`,
        players: summary.players,
        legs: summary.legsHistory || [],
        currentLegStats: currentLegStats,
        winner: ds.winner
      };
    }

    // Fall 2: Gespeichertes Match aus IndexedDB
    const players = (ds.players || []).map(p => {
      const pStats = ds.summaryStats?.playerStats?.[p.id] || {};
      return {
        id: p.id,
        name: p.name,
        color: p.color || '#00f0ff',
        legsWon: p.legsWon || 0,
        setsWon: p.setsWon || 0,
        totalDarts: pStats.totalDarts || 0,
        totalScore: pStats.totalScore || 0,
        average: pStats.average || (pStats.totalDarts > 0 ? (pStats.totalScore / pStats.totalDarts) * 3 : 0),
        first9Average: pStats.first9Average || 0,
        checkoutPct: pStats.checkoutPct || 0,
        doubleAttempts: pStats.doubleAttempts || 0,
        doubleHits: pStats.doubleHits || 0,
        highestFinish: pStats.highestFinish || 0,
        bestLegDarts: pStats.bestLegDarts || null,
        highestTurn: pStats.highestTurn || 0,
        scoringBuckets: pStats.scoringBuckets || { c180: 0, c140: 0, c100: 0, c60: 0, cUnder60: 0 }
      };
    });

    const legs = ds.legs || [];
    return {
      isLive: false,
      title: `${(ds.mode || 'X01').toUpperCase()} • Beendet am ${new Date(ds.timestamp).toLocaleDateString('de-DE')}`,
      players: players,
      legs: legs,
      currentLegStats: null,
      winner: ds.winnerId ? players.find(p => p.id === ds.winnerId) : null
    };
  }

  // =========================================================================
  // GESAMT-MATCH ANSICHT
  // =========================================================================

  renderOverallView(matchData) {
    const players = matchData.players || [];
    const p1 = players[0] || { name: 'Spieler 1', color: '#00f0ff', scoringBuckets: {} };
    const p2 = players[1] || { name: 'Spieler 2', color: '#ff2a70', scoringBuckets: {} };

    const p1Avg = (p1.average || 0).toFixed(1);
    const p2Avg = (p2.average || 0).toFixed(1);
    const p1F9 = (p1.first9Average || 0).toFixed(1);
    const p2F9 = (p2.first9Average || 0).toFixed(1);

    const p1Co = p1.doubleAttempts > 0 ? `${(p1.checkoutPct || 0).toFixed(1)}% (${p1.doubleHits}/${p1.doubleAttempts})` : '-';
    const p2Co = p2.doubleAttempts > 0 ? `${(p2.checkoutPct || 0).toFixed(1)}% (${p2.doubleHits}/${p2.doubleAttempts})` : '-';

    return `
      <!-- 1. Side-by-Side Spieler-Head-to-Head Header -->
      <div class="scolia-players-compare-grid">
        <div class="scolia-player-box p1" style="border-top-color: ${p1.color}">
          <div class="scolia-pbox-header">
            <span class="scolia-pbox-name">${p1.name}</span>
            <span class="scolia-pbox-legs">${p1.legsWon ?? '-'} Legs</span>
          </div>
          <div class="scolia-pbox-big-avg">${p1Avg}</div>
          <div class="scolia-pbox-label">Gesamt 3-Dart Average</div>
        </div>

        <div class="scolia-vs-badge-col">
          <span class="scolia-vs-pill">VS</span>
          <span class="scolia-legs-count-badge">${matchData.legs.length} Gespielte Legs</span>
        </div>

        <div class="scolia-player-box p2" style="border-top-color: ${p2.color}">
          <div class="scolia-pbox-header">
            <span class="scolia-pbox-name">${p2.name}</span>
            <span class="scolia-pbox-legs">${p2.legsWon ?? '-'} Legs</span>
          </div>
          <div class="scolia-pbox-big-avg">${p2Avg}</div>
          <div class="scolia-pbox-label">Gesamt 3-Dart Average</div>
        </div>
      </div>

      <!-- 2. Scolia Core Metrics Grid -->
      <div class="scolia-metrics-card">
        <h4 class="scolia-card-heading">📊 Spiel-Leistungsmetriken</h4>
        <div class="scolia-metrics-table">
          ${this.renderMetricRow('3-Dart Average', p1Avg, p2Avg, parseFloat(p1Avg) >= parseFloat(p2Avg), parseFloat(p2Avg) >= parseFloat(p1Avg))}
          ${this.renderMetricRow('First 9 Average', p1F9, p2F9, parseFloat(p1F9) >= parseFloat(p2F9), parseFloat(p2F9) >= parseFloat(p1F9))}
          ${this.renderMetricRow('Doppelquote (Checkouts)', p1Co, p2Co, (p1.checkoutPct || 0) >= (p2.checkoutPct || 0), (p2.checkoutPct || 0) >= (p1.checkoutPct || 0))}
          ${this.renderMetricRow('Höchstes Finish', p1.highestFinish || '-', p2.highestFinish || '-', (p1.highestFinish || 0) >= (p2.highestFinish || 0), (p2.highestFinish || 0) >= (p1.highestFinish || 0))}
          ${this.renderMetricRow('Bestes Leg (Darts)', p1.bestLegDarts ? `${p1.bestLegDarts} Darts` : '-', p2.bestLegDarts ? `${p2.bestLegDarts} Darts` : '-', p1.bestLegDarts && (!p2.bestLegDarts || p1.bestLegDarts <= p2.bestLegDarts), p2.bestLegDarts && (!p1.bestLegDarts || p2.bestLegDarts <= p1.bestLegDarts))}
          ${this.renderMetricRow('Geworfene Darts', p1.totalDarts || 0, p2.totalDarts || 0, false, false)}
          ${this.renderMetricRow('Höchste Aufnahme', p1.highestTurn || 0, p2.highestTurn || 0, (p1.highestTurn || 0) >= (p2.highestTurn || 0), (p2.highestTurn || 0) >= (p1.highestTurn || 0))}
        </div>
      </div>

      <!-- 3. Scolia Relative Head-to-Head Scoring-Balken -->
      <div class="scolia-metrics-card">
        <h4 class="scolia-card-heading">🎯 Scolia Aufnahme-Verteilung (Scoring Buckets)</h4>
        <div class="scolia-scoring-bars-wrapper">
          ${this.renderScoringComparisonBar('180s (Maximum)', p1.scoringBuckets?.c180 || 0, p2.scoringBuckets?.c180 || 0, p1.color, p2.color)}
          ${this.renderScoringComparisonBar('140 - 177', p1.scoringBuckets?.c140 || 0, p2.scoringBuckets?.c140 || 0, p1.color, p2.color)}
          ${this.renderScoringComparisonBar('100 - 139', p1.scoringBuckets?.c100 || 0, p2.scoringBuckets?.c100 || 0, p1.color, p2.color)}
          ${this.renderScoringComparisonBar('60 - 99', p1.scoringBuckets?.c60 || 0, p2.scoringBuckets?.c60 || 0, p1.color, p2.color)}
          ${this.renderScoringComparisonBar('< 60', p1.scoringBuckets?.cUnder60 || 0, p2.scoringBuckets?.cUnder60 || 0, p1.color, p2.color)}
        </div>
      </div>

      <!-- 4. Interaktiver SVG Average-Verlauf über alle Legs -->
      ${this.renderAverageTrendlineSVG(matchData)}
    `;
  }

  renderMetricRow(label, val1, val2, p1Better, p2Better) {
    return `
      <div class="scolia-metric-row">
        <div class="scolia-metric-val p1 ${p1Better && val1 !== '-' && val1 !== '0.0' ? 'highlight-win' : ''}">${val1}</div>
        <div class="scolia-metric-label">${label}</div>
        <div class="scolia-metric-val p2 ${p2Better && val2 !== '-' && val2 !== '0.0' ? 'highlight-win' : ''}">${val2}</div>
      </div>
    `;
  }

  renderScoringComparisonBar(label, count1, count2, color1, color2) {
    const total = count1 + count2;
    const pct1 = total > 0 ? (count1 / total) * 100 : 50;
    const pct2 = total > 0 ? (count2 / total) * 100 : 50;

    return `
      <div class="scolia-compare-bar-row">
        <div class="scolia-bar-num p1">${count1}</div>
        <div class="scolia-bar-track">
          <div class="scolia-bar-fill p1" style="width: ${total === 0 ? '0%' : pct1 + '%'}; background-color: ${color1};"></div>
          <div class="scolia-bar-center-label">${label}</div>
          <div class="scolia-bar-fill p2" style="width: ${total === 0 ? '0%' : pct2 + '%'}; background-color: ${color2};"></div>
        </div>
        <div class="scolia-bar-num p2">${count2}</div>
      </div>
    `;
  }

  /**
   * Erzeugt einen SVG Verlaufsgraphen für die Averages aller Legs
   */
  renderAverageTrendlineSVG(matchData) {
    const legs = matchData.legs || [];
    if (legs.length === 0) return '';

    const p1 = matchData.players[0] || { name: 'Spieler 1', color: '#00f0ff' };
    const p2 = matchData.players[1] || { name: 'Spieler 2', color: '#ff2a70' };

    // Datenpunkte sammeln
    const legLabels = legs.map((l, i) => `Leg ${l.legNumber || (i + 1)}`);
    const p1Points = [];
    const p2Points = [];

    legs.forEach(leg => {
      const legP1 = leg.players?.find(p => p.id === p1.id) || leg.players?.[0];
      const legP2 = leg.players?.find(p => p.id === p2.id) || leg.players?.[1];

      p1Points.push(legP1?.average || 0);
      p2Points.push(legP2?.average || 0);
    });

    const allAverages = [...p1Points, ...p2Points].filter(a => a > 0);
    const minAvg = Math.max(0, Math.floor((Math.min(...(allAverages.length ? allAverages : [40])) - 10) / 10) * 10);
    const maxAvg = Math.ceil((Math.max(...(allAverages.length ? allAverages : [90])) + 10) / 10) * 10;
    const avgRange = (maxAvg - minAvg) || 50;

    const width = 640;
    const height = 200;
    const padX = 50;
    const padY = 30;
    const chartW = width - padX * 2;
    const chartH = height - padY * 2;

    const getX = (idx) => padX + (legs.length > 1 ? (idx / (legs.length - 1)) * chartW : chartW / 2);
    const getY = (val) => padY + chartH - ((val - minAvg) / avgRange) * chartH;

    // SVG Pfade konstruieren
    const p1Path = p1Points.map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`).join(' ');
    const p2Path = p2Points.map((val, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(idx)} ${getY(val)}`).join(' ');

    return `
      <div class="scolia-metrics-card">
        <div class="scolia-card-header-flex">
          <h4 class="scolia-card-heading">📈 Average-Verlauf über alle Legs</h4>
          <div class="scolia-trend-legend">
            <span class="legend-pill" style="border-color: ${p1.color}; color: ${p1.color}">● ${p1.name}</span>
            <span class="legend-pill" style="border-color: ${p2.color}; color: ${p2.color}">● ${p2.name}</span>
          </div>
        </div>

        <div class="scolia-svg-container">
          <svg viewBox="0 0 ${width} ${height}" class="scolia-trendline-svg" preserveAspectRatio="xMidYMid meet">
            <!-- Grid Linien -->
            <line x1="${padX}" y1="${padY}" x2="${width - padX}" y2="${padY}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3 3" />
            <text x="${padX - 8}" y="${padY + 4}" fill="rgba(255,255,255,0.4)" font-size="10" text-anchor="end">${maxAvg}</text>

            <line x1="${padX}" y1="${padY + chartH / 2}" x2="${width - padX}" y2="${padY + chartH / 2}" stroke="rgba(255,255,255,0.08)" stroke-dasharray="3 3" />
            <text x="${padX - 8}" y="${padY + chartH / 2 + 4}" fill="rgba(255,255,255,0.4)" font-size="10" text-anchor="end">${Math.round((maxAvg + minAvg) / 2)}</text>

            <line x1="${padX}" y1="${padY + chartH}" x2="${width - padX}" y2="${padY + chartH}" stroke="rgba(255,255,255,0.15)" />
            <text x="${padX - 8}" y="${padY + chartH + 4}" fill="rgba(255,255,255,0.4)" font-size="10" text-anchor="end">${minAvg}</text>

            <!-- X-Achse Leg Labels -->
            ${legLabels.map((lbl, idx) => `
              <text x="${getX(idx)}" y="${height - 8}" fill="rgba(255,255,255,0.5)" font-size="11" text-anchor="middle">${lbl}</text>
            `).join('')}

            <!-- Trendlinien -->
            <path d="${p1Path}" fill="none" stroke="${p1.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
            <path d="${p2Path}" fill="none" stroke="${p2.color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

            <!-- P1 Dots & Tooltips -->
            ${p1Points.map((val, idx) => `
              <circle cx="${getX(idx)}" cy="${getY(val)}" r="5" fill="${p1.color}" stroke="#0b111e" stroke-width="2" />
              <text x="${getX(idx)}" y="${getY(val) - 10}" fill="${p1.color}" font-size="11" font-weight="bold" text-anchor="middle">${val.toFixed(1)}</text>
            `).join('')}

            <!-- P2 Dots & Tooltips -->
            ${p2Points.map((val, idx) => `
              <circle cx="${getX(idx)}" cy="${getY(val)}" r="5" fill="${p2.color}" stroke="#0b111e" stroke-width="2" />
              <text x="${getX(idx)}" y="${getY(val) + 18}" fill="${p2.color}" font-size="11" font-weight="bold" text-anchor="middle">${val.toFixed(1)}</text>
            `).join('')}
          </svg>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // EINZEL-LEG ANSICHT (Scolia Leg Breakdown & Turn-by-Turn Scorecard)
  // =========================================================================

  renderSingleLegView(matchData, tabKey) {
    const isLive = tabKey === 'live';
    const legData = isLive
      ? matchData.currentLegStats
      : matchData.legs[parseInt(tabKey, 10)];

    if (!legData) {
      return `<div class="scolia-empty-box">Keine Daten für dieses Leg vorhanden.</div>`;
    }

    const p1 = legData.players?.[0] || { name: 'Spieler 1', color: '#00f0ff', scoringBuckets: {} };
    const p2 = legData.players?.[1] || { name: 'Spieler 2', color: '#ff2a70', scoringBuckets: {} };

    const p1Avg = (p1.average || 0).toFixed(1);
    const p2Avg = (p2.average || 0).toFixed(1);
    const p1F9 = (p1.first9Average || 0).toFixed(1);
    const p2F9 = (p2.first9Average || 0).toFixed(1);

    const p1Co = p1.doubleAttempts > 0 ? `${(p1.checkoutPct || 0).toFixed(1)}% (${p1.doubleHits}/${p1.doubleAttempts})` : (p1.doubleHits > 0 ? '100% (1/1)' : '-');
    const p2Co = p2.doubleAttempts > 0 ? `${(p2.checkoutPct || 0).toFixed(1)}% (${p2.doubleHits}/${p2.doubleAttempts})` : (p2.doubleHits > 0 ? '100% (1/1)' : '-');

    const winnerName = legData.winnerName || (legData.winnerId ? legData.players?.find(p => p.id === legData.winnerId)?.name : null);

    return `
      <!-- Leg Header Info Banner -->
      <div class="scolia-leg-banner ${isLive ? 'is-live' : ''}">
        <div class="scolia-leg-info">
          <span class="badge ${isLive ? 'badge-live' : 'badge-leg'}">
            ${isLive ? '🎯 LIVE IM SPIEL' : `Leg ${legData.legNumber || (parseInt(tabKey, 10) + 1)}`}
          </span>
          ${winnerName ? `
            <span class="scolia-leg-winner-tag">
              🏆 Gewinner: <strong>${winnerName}</strong> in <strong>${legData.winningDarts || legData.winnerDarts || p1.dartsCount}</strong> Darts
              ${legData.winningDart ? `(Doppel: ${legData.winningDart})` : ''}
              ${legData.highFinish ? `• Finish: ${legData.highFinish}` : ''}
            </span>
          ` : `
            <span class="scolia-leg-winner-tag">Aufnahme läuft...</span>
          `}
        </div>
      </div>

      <!-- Side-by-Side Spieler-Karten für dieses Leg -->
      <div class="scolia-players-compare-grid">
        <div class="scolia-player-box p1 ${legData.winnerId === p1.id ? 'is-leg-winner' : ''}" style="border-top-color: ${p1.color}">
          <div class="scolia-pbox-header">
            <span class="scolia-pbox-name">${p1.name}</span>
            <span class="scolia-pbox-legs">${p1.dartsCount || 0} Darts</span>
          </div>
          <div class="scolia-pbox-big-avg">${p1Avg}</div>
          <div class="scolia-pbox-label">Leg 3-Dart Average</div>
        </div>

        <div class="scolia-vs-badge-col">
          <span class="scolia-vs-pill">VS</span>
        </div>

        <div class="scolia-player-box p2 ${legData.winnerId === p2.id ? 'is-leg-winner' : ''}" style="border-top-color: ${p2.color}">
          <div class="scolia-pbox-header">
            <span class="scolia-pbox-name">${p2.name}</span>
            <span class="scolia-pbox-legs">${p2.dartsCount || 0} Darts</span>
          </div>
          <div class="scolia-pbox-big-avg">${p2Avg}</div>
          <div class="scolia-pbox-label">Leg 3-Dart Average</div>
        </div>
      </div>

      <!-- Scolia Leg Metrik-Grid -->
      <div class="scolia-metrics-card">
        <h4 class="scolia-card-heading">📊 Leg-Statistiken</h4>
        <div class="scolia-metrics-table">
          ${this.renderMetricRow('3-Dart Average', p1Avg, p2Avg, parseFloat(p1Avg) >= parseFloat(p2Avg), parseFloat(p2Avg) >= parseFloat(p1Avg))}
          ${this.renderMetricRow('First 9 Average', p1F9, p2F9, parseFloat(p1F9) >= parseFloat(p2F9), parseFloat(p2F9) >= parseFloat(p1F9))}
          ${this.renderMetricRow('Checkouts / Doppel', p1Co, p2Co, (p1.checkoutPct || 0) >= (p2.checkoutPct || 0), (p2.checkoutPct || 0) >= (p1.checkoutPct || 0))}
          ${this.renderMetricRow('Geworfene Darts', p1.dartsCount || 0, p2.dartsCount || 0, false, false)}
          ${this.renderMetricRow('Höchste Aufnahme', p1.highestTurn || 0, p2.highestTurn || 0, (p1.highestTurn || 0) >= (p2.highestTurn || 0), (p2.highestTurn || 0) >= (p1.highestTurn || 0))}
        </div>
      </div>

      <!-- Scolia Scoring-Balken für dieses Leg -->
      <div class="scolia-metrics-card">
        <h4 class="scolia-card-heading">🎯 Aufnahmen in diesem Leg</h4>
        <div class="scolia-scoring-bars-wrapper">
          ${this.renderScoringComparisonBar('180s', p1.scoringBuckets?.c180 || 0, p2.scoringBuckets?.c180 || 0, p1.color, p2.color)}
          ${this.renderScoringComparisonBar('140 - 177', p1.scoringBuckets?.c140 || 0, p2.scoringBuckets?.c140 || 0, p1.color, p2.color)}
          ${this.renderScoringComparisonBar('100 - 139', p1.scoringBuckets?.c100 || 0, p2.scoringBuckets?.c100 || 0, p1.color, p2.color)}
          ${this.renderScoringComparisonBar('60 - 99', p1.scoringBuckets?.c60 || 0, p2.scoringBuckets?.c60 || 0, p1.color, p2.color)}
          ${this.renderScoringComparisonBar('< 60', p1.scoringBuckets?.cUnder60 || 0, p2.scoringBuckets?.cUnder60 || 0, p1.color, p2.color)}
        </div>
      </div>

      <!-- Turn-by-Turn Leg Scorecard Tabelle -->
      ${this.renderTurnByTurnScorecard(legData)}
    `;
  }

  /**
   * Rendert die offizielle Turn-by-Turn Scorecard mit D1, D2, D3, Summe und Rest
   */
  renderTurnByTurnScorecard(legData) {
    const turns = legData.turns || [];
    if (turns.length === 0) {
      return `
        <div class="scolia-metrics-card">
          <h4 class="scolia-card-heading">📋 Turn-by-Turn Leg Scorecard</h4>
          <div class="scolia-empty-box">Noch keine Aufnahmen in diesem Leg protokolliert.</div>
        </div>
      `;
    }

    return `
      <div class="scolia-metrics-card">
        <h4 class="scolia-card-heading">📋 Turn-by-Turn Leg Scorecard</h4>
        <div class="scolia-scorecard-table-wrapper">
          <table class="scolia-scorecard-table">
            <thead>
              <tr>
                <th style="width: 45px;">#</th>
                <th>Spieler</th>
                <th>Dart 1</th>
                <th>Dart 2</th>
                <th>Dart 3</th>
                <th style="text-align: right;">Aufnahme</th>
                <th style="text-align: right;">Rest</th>
              </tr>
            </thead>
            <tbody>
              ${turns.map((turn, idx) => {
                const darts = turn.darts || [];
                const d1 = darts[0] ? (darts[0].label || `${darts[0].score}`) : '-';
                const d2 = darts[1] ? (darts[1].label || `${darts[1].score}`) : '-';
                const d3 = darts[2] ? (darts[2].label || `${darts[2].score}`) : '-';

                let tagHtml = '';
                if (turn.checkout) {
                  tagHtml = `<span class="scorecard-badge badge-win">CHECKOUT!</span>`;
                } else if (turn.bust) {
                  tagHtml = `<span class="scorecard-badge badge-bust">BUST</span>`;
                } else if (turn.sum === 180) {
                  tagHtml = `<span class="scorecard-badge badge-180">180! 🔥</span>`;
                } else if (turn.sum >= 140) {
                  tagHtml = `<span class="scorecard-badge badge-140">TON-40+</span>`;
                } else if (turn.sum >= 100) {
                  tagHtml = `<span class="scorecard-badge badge-100">TON+</span>`;
                }

                return `
                  <tr class="${turn.checkout ? 'row-checkout' : (turn.bust ? 'row-bust' : '')}">
                    <td class="col-turn-num">${idx + 1}</td>
                    <td class="col-player">
                      <span class="player-dot" style="background-color: ${turn.playerColor || '#00f0ff'};"></span>
                      ${turn.playerName}
                    </td>
                    <td class="col-dart">${d1}</td>
                    <td class="col-dart">${d2}</td>
                    <td class="col-dart">${d3}</td>
                    <td class="col-sum">
                      <strong>${turn.bust ? 0 : turn.sum}</strong>
                      ${tagHtml}
                    </td>
                    <td class="col-remaining">${turn.remaining}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // CRICKET ADAPTION
  // =========================================================================

  renderCricketDashboard() {
    const ds = this.dataSource;
    const players = ds.players || [];
    const p1 = players[0] || { name: 'Spieler 1', color: '#00f0ff', stats: {} };
    const p2 = players[1] || { name: 'Spieler 2', color: '#ff2a70', stats: {} };

    const p1Mpr = ds.getPlayerMPR ? ds.getPlayerMPR(p1).toFixed(2) : ((p1.stats?.totalMarks || 0) / Math.max(1, (p1.stats?.totalDarts || 3) / 3)).toFixed(2);
    const p2Mpr = ds.getPlayerMPR ? ds.getPlayerMPR(p2).toFixed(2) : ((p2.stats?.totalMarks || 0) / Math.max(1, (p2.stats?.totalDarts || 3) / 3)).toFixed(2);

    this.container.innerHTML = `
      <div class="scolia-dashboard-wrapper">
        <div class="scolia-header-row">
          <div class="scolia-title-wrap">
            <h3 class="scolia-main-title">🏏 Cricket Scolia-Analyse</h3>
            <span class="scolia-subtitle">Marks Per Round & Trefferübersicht</span>
          </div>
        </div>

        <div class="scolia-players-compare-grid">
          <div class="scolia-player-box p1" style="border-top-color: ${p1.color}">
            <div class="scolia-pbox-name">${p1.name}</div>
            <div class="scolia-pbox-big-avg">${p1Mpr}</div>
            <div class="scolia-pbox-label">Marks Per Round (MPR)</div>
          </div>

          <div class="scolia-vs-badge-col">
            <span class="scolia-vs-pill">VS</span>
          </div>

          <div class="scolia-player-box p2" style="border-top-color: ${p2.color}">
            <div class="scolia-pbox-name">${p2.name}</div>
            <div class="scolia-pbox-big-avg">${p2Mpr}</div>
            <div class="scolia-pbox-label">Marks Per Round (MPR)</div>
          </div>
        </div>

        <div class="scolia-metrics-card">
          <h4 class="scolia-card-heading">📊 Cricket Leistungsdaten</h4>
          <div class="scolia-metrics-table">
            ${this.renderMetricRow('Marks Per Round (MPR)', p1Mpr, p2Mpr, parseFloat(p1Mpr) >= parseFloat(p2Mpr), parseFloat(p2Mpr) >= parseFloat(p1Mpr))}
            ${this.renderMetricRow('Gesamte Marken (Marks)', p1.stats?.totalMarks || 0, p2.stats?.totalMarks || 0, (p1.stats?.totalMarks || 0) >= (p2.stats?.totalMarks || 0), (p2.stats?.totalMarks || 0) >= (p1.stats?.totalMarks || 0))}
            ${this.renderMetricRow('Höchste Aufnahme (Marks)', p1.stats?.highestTurnMarks || 0, p2.stats?.highestTurnMarks || 0, (p1.stats?.highestTurnMarks || 0) >= (p2.stats?.highestTurnMarks || 0), (p2.stats?.highestTurnMarks || 0) >= (p1.stats?.highestTurnMarks || 0))}
            ${this.renderMetricRow('Darts geworfen', p1.stats?.totalDarts || 0, p2.stats?.totalDarts || 0, false, false)}
            ${this.renderMetricRow('Punkte Stand', p1.currentScore || 0, p2.currentScore || 0, false, false)}
          </div>
        </div>
      </div>
    `;
  }
}

export const scoliaDashboard = new ScoliaDashboard();

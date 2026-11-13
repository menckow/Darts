/**
 * All-in-One Exporter: CSV, PDF Print-Report, JSON Backup/Restore
 */
import { db } from './db.js';

export class DartsExporter {
  /**
   * Helper to download text / blob as a file in browser
   */
  static downloadFile(content, filename, mimeType = 'text/plain') {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  /**
   * Export all matches to CSV
   */
  static async exportMatchesCSV() {
    const matches = await db.getMatches();
    if (!matches || matches.length === 0) {
      alert('Keine Matches für den Export vorhanden.');
      return;
    }

    const headers = [
      'Match-ID',
      'Datum & Uhrzeit',
      'Spielmodus',
      'Spieler 1',
      'Spieler 2',
      'Sieger',
      'Legs/Runden',
      'Dauer (Sek.)'
    ];

    const rows = matches.map(m => {
      const dateStr = new Date(m.timestamp).toLocaleString('de-DE');
      const p1 = m.players && m.players[0] ? m.players[0].name : '';
      const p2 = m.players && m.players[1] ? m.players[1].name : '';
      const winner = m.players ? (m.players.find(p => p.id === m.winnerId)?.name || 'Unentschieden') : '';
      const scoreStr = m.summaryStats ? (m.summaryStats.finalScore || '') : '';
      return [
        `"${m.id}"`,
        `"${dateStr}"`,
        `"${m.mode || 'x01'}"`,
        `"${p1}"`,
        `"${p2}"`,
        `"${winner}"`,
        `"${scoreStr}"`,
        m.durationSeconds || 0
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const dateTag = new Date().toISOString().slice(0, 10);
    this.downloadFile(csvContent, `darts_matches_${dateTag}.csv`, 'text/csv;charset=utf-8;');
  }

  /**
   * Export darts to CSV (all or for a specific match)
   */
  static async exportDartsCSV(matchId = null) {
    let darts = [];
    if (matchId) {
      darts = await db.getDartsByMatch(matchId);
    } else {
      const full = await db.exportFullJSON();
      darts = full.darts || [];
    }

    if (!darts || darts.length === 0) {
      alert('Keine Wurf-Daten für den Export vorhanden.');
      return;
    }

    const headers = [
      'Wurf-ID',
      'Match-ID',
      'Spieler-ID',
      'Aufnahme (Turn)',
      'Dart #',
      'Segment',
      'Multiplikator',
      'Punkte',
      'Double-Versuch',
      'Checkout',
      'Bust',
      'Koord X',
      'Koord Y',
      'Eingabeart'
    ];

    const rows = darts.map(d => [
      `"${d.id}"`,
      `"${d.matchId}"`,
      `"${d.playerId}"`,
      d.turnIndex,
      d.dartIndex,
      d.segment,
      d.multiplier,
      d.score,
      d.isDoubleAttempt ? 'JA' : 'NEIN',
      d.isCheckout ? 'JA' : 'NEIN',
      d.isBust ? 'JA' : 'NEIN',
      d.coordX !== null && d.coordX !== undefined ? d.coordX : '',
      d.coordY !== null && d.coordY !== undefined ? d.coordY : '',
      `"${d.inputMethod || 'keypad'}"`
    ].join(';'));

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const filename = matchId ? `darts_match_${matchId}.csv` : `darts_all_throws_${new Date().toISOString().slice(0, 10)}.csv`;
    this.downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
  }

  /**
   * Full JSON backup download
   */
  static async downloadBackupJSON() {
    const backup = await db.exportFullJSON();
    const jsonStr = JSON.stringify(backup, null, 2);
    const dateTag = new Date().toISOString().slice(0, 10);
    this.downloadFile(jsonStr, `darts_backup_${dateTag}.json`, 'application/json');
  }

  /**
   * Restore database from JSON file
   */
  static async restoreBackupFromJSONFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const parsed = JSON.parse(e.target.result);
          const result = await db.importFullJSON(parsed);
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  /**
   * Generates a printable PDC-Style Match Report and opens window.print()
   */
  static async printMatchReport(matchId) {
    const match = await db.getMatchById(matchId);
    if (!match) {
      alert('Match nicht gefunden.');
      return;
    }

    const darts = await db.getDartsByMatch(matchId);
    const dateStr = new Date(match.timestamp).toLocaleString('de-DE');
    const winner = match.players ? (match.players.find(p => p.id === match.winnerId)?.name || 'Unentschieden') : 'Unbekannt';

    // Build printable HTML overlay
    let printContainer = document.getElementById('print-match-report');
    if (!printContainer) {
      printContainer = document.createElement('div');
      printContainer.id = 'print-match-report';
      document.body.appendChild(printContainer);
    }

    const p1 = match.players && match.players[0] ? match.players[0] : { name: 'Spieler 1', id: 'p1' };
    const p2 = match.players && match.players[1] ? match.players[1] : { name: 'Spieler 2', id: 'p2' };

    const p1Darts = darts.filter(d => d.playerId === p1.id);
    const p2Darts = darts.filter(d => d.playerId === p2.id);

    const calcStats = (pDarts) => {
      const totalScore = pDarts.reduce((acc, d) => acc + (d.score || 0), 0);
      const count = pDarts.length;
      const avg = count > 0 ? ((totalScore / count) * 3).toFixed(2) : '0.00';
      const c180 = pDarts.filter(d => d.turnScore === 180 || (d.multiplier === 3 && d.segment === 20)).length; // approx
      const checkouts = pDarts.filter(d => d.isCheckout).length;
      const doubleAttempts = pDarts.filter(d => d.isDoubleAttempt).length;
      const checkoutPct = doubleAttempts > 0 ? ((checkouts / doubleAttempts) * 100).toFixed(1) + '%' : '-';
      return { totalScore, count, avg, checkouts, doubleAttempts, checkoutPct };
    };

    const s1 = calcStats(p1Darts);
    const s2 = calcStats(p2Darts);

    printContainer.innerHTML = `
      <div class="print-page">
        <div class="print-header">
          <div class="print-logo">🎯 DARTS MATCH REPORT</div>
          <div class="print-sub">${match.mode.toUpperCase()} MATCH • ${dateStr}</div>
        </div>

        <div class="print-winner-box">
          <span class="label">SIEGER</span>
          <span class="name">🏆 ${winner}</span>
        </div>

        <div class="print-comparison-grid">
          <div class="print-player-col">
            <h3>${p1.name}</h3>
            <div class="stat-row"><span>Geworfene Darts:</span> <strong>${s1.count}</strong></div>
            <div class="stat-row"><span>Gesamtpunkte:</span> <strong>${s1.totalScore}</strong></div>
            <div class="stat-row highlight"><span>3-Dart Average:</span> <strong>${s1.avg}</strong></div>
            <div class="stat-row"><span>Checkouts:</span> <strong>${s1.checkouts}</strong></div>
            <div class="stat-row"><span>Doppelquote:</span> <strong>${s1.checkoutPct}</strong></div>
          </div>

          <div class="print-vs-col">VS</div>

          <div class="print-player-col">
            <h3>${p2.name}</h3>
            <div class="stat-row"><span>Geworfene Darts:</span> <strong>${s2.count}</strong></div>
            <div class="stat-row"><span>Gesamtpunkte:</span> <strong>${s2.totalScore}</strong></div>
            <div class="stat-row highlight"><span>3-Dart Average:</span> <strong>${s2.avg}</strong></div>
            <div class="stat-row"><span>Checkouts:</span> <strong>${s2.checkouts}</strong></div>
            <div class="stat-row"><span>Doppelquote:</span> <strong>${s2.checkoutPct}</strong></div>
          </div>
        </div>

        ${match.legs && match.legs.length > 0 ? `
          <div class="print-legs-section" style="margin-bottom: 30px;">
            <h3 style="font-size: 16px; border-bottom: 2px solid #333; padding-bottom: 4px; margin-bottom: 10px;">🎯 SCOLIA LEG-FÜR-LEG ANALYSE</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; text-align: left;">
              <thead>
                <tr style="border-bottom: 1px solid #999;">
                  <th style="padding: 4px 6px;">Leg</th>
                  <th style="padding: 4px 6px;">Sieger</th>
                  <th style="padding: 4px 6px; text-align: right;">Darts</th>
                  <th style="padding: 4px 6px; text-align: right;">Winning Dart</th>
                  <th style="padding: 4px 6px; text-align: right;">Finish</th>
                  <th style="padding: 4px 6px; text-align: right;">${p1.name} Avg</th>
                  <th style="padding: 4px 6px; text-align: right;">${p2.name} Avg</th>
                </tr>
              </thead>
              <tbody>
                ${match.legs.map((leg, i) => {
                  const lp1 = leg.players?.find(p => p.id === p1.id) || leg.players?.[0];
                  const lp2 = leg.players?.find(p => p.id === p2.id) || leg.players?.[1];
                  return `
                    <tr style="border-bottom: 1px solid #eee;">
                      <td style="padding: 4px 6px;">Leg ${leg.legNumber || (i + 1)}</td>
                      <td style="padding: 4px 6px;"><strong>${leg.winnerName || '-'}</strong></td>
                      <td style="padding: 4px 6px; text-align: right;">${leg.winningDarts || leg.winnerDarts || '-'}</td>
                      <td style="padding: 4px 6px; text-align: right;">${leg.winningDart || '-'}</td>
                      <td style="padding: 4px 6px; text-align: right;">${leg.highFinish || '-'}</td>
                      <td style="padding: 4px 6px; text-align: right;">${lp1?.average ? lp1.average.toFixed(1) : '-'}</td>
                      <td style="padding: 4px 6px; text-align: right;">${lp2?.average ? lp2.average.toFixed(1) : '-'}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        ` : ''}

        <div class="print-footer">
          <span>Erstellt mit Darts Scoreboard App</span>
          <span>Match-ID: ${match.id}</span>
        </div>
      </div>
    `;

    window.print();
  }
}

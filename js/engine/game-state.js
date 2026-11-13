/**
 * Game State & Match Engine (X01)
 * Verwaltet Spiellogik, Rundenwechsel, Bust-Regeln, Multi-Level Undo/Redo und Statistiken.
 */

import { parseSegment } from './darts-math.js';

export class GameEngine {
  constructor(config = {}) {
    this.gameMode = 'X01';
    this.startScore = config.startScore || 501;
    this.inRule = config.inRule || 'STRAIGHT'; // STRAIGHT, DOUBLE, MASTER
    this.outRule = config.outRule || 'DOUBLE';   // STRAIGHT, DOUBLE, MASTER
    this.legsToWin = config.legsToWin || 3;     // First to X Legs (wenn setsToWin == 1)
    this.setsToWin = config.setsToWin || 1;     // First to X Sets
    this.legsPerSet = config.legsPerSet || 3;   // Legs pro Set
    this.inputMode = config.inputMode || 'DARTS'; // DARTS oder SUM

    this.players = (config.players && config.players.length > 0)
      ? config.players.map(p => this.createPlayer(p))
      : [
          this.createPlayer({ id: 'p1', name: 'Spieler 1', isBot: false }),
          this.createPlayer({ id: 'bot', name: 'DartBot (Avg 60)', isBot: true, botAverage: 60 })
        ];

    this.currentPlayerIndex = 0;
    this.legStarterIndex = 0;
    this.currentLeg = 1;
    this.currentSet = 1;
    this.isMatchOver = false;
    this.winner = null;

    // Aktuelle Aufnahme (max. 3 Darts)
    this.currentTurnDarts = [];

    // Scolia-Architektur: Leg-für-Leg Historie & Turn-Protokoll
    this.legsHistory = [];
    this.currentLegTurns = [];

    // Multi-Level Undo & Redo History
    this.historyStack = [];
    this.redoStack = [];

    // Ereignis-Callbacks für UI/Audio
    this.onStateChange = null;
    this.onDartThrow = null;
    this.onTurnEnd = null;
    this.onBust = null;
    this.onLegWon = null;
    this.onMatchWon = null;
    this.on180 = null;
  }

  createPlayer(p) {
    const handicap = parseInt(p.handicap, 10) || 0;
    const initialScore = Math.max(2, this.startScore - handicap);
    return {
      id: p.id || 'p_' + Math.random().toString(36).substring(2, 9),
      name: p.name || 'Spieler',
      isBot: !!p.isBot,
      botAverage: p.botAverage || 60,
      color: p.color || '#00e5ff',
      handicap: handicap,
      startScore: initialScore,
      currentScore: initialScore,
      legsWon: 0,
      setsWon: 0,
      hasStartedIn: this.inRule === 'STRAIGHT', // Für Double-In / Master-In
      currentLegDarts: 0,
      turnHistory: [], // [{ darts: [], sum: 0, bust: false, remaining: 0 }]
      stats: {
        totalDarts: 0,
        totalScore: 0,
        first9Darts: 0,
        first9Score: 0,
        count180: 0,
        count140Plus: 0,
        count100Plus: 0,
        count60Plus: 0,
        highestTurn: 0,
        doubleAttempts: 0,
        doubleHits: 0,
        highestFinish: 0,
        bestLegDarts: null,
      }
    };
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  /**
   * Erstellt einen vollständigen Snapshot des Spiels für Undo/Redo.
   */
  createSnapshot() {
    return JSON.stringify({
      gameMode: this.gameMode,
      startScore: this.startScore,
      inRule: this.inRule,
      outRule: this.outRule,
      legsToWin: this.legsToWin,
      setsToWin: this.setsToWin,
      legsPerSet: this.legsPerSet,
      inputMode: this.inputMode,
      currentPlayerIndex: this.currentPlayerIndex,
      legStarterIndex: this.legStarterIndex,
      currentLeg: this.currentLeg,
      currentSet: this.currentSet,
      isMatchOver: this.isMatchOver,
      winnerId: this.winner ? this.winner.id : null,
      currentTurnDarts: this.currentTurnDarts,
      legsHistory: this.legsHistory,
      currentLegTurns: this.currentLegTurns,
      players: this.players
    });
  }

  /**
   * Stellt einen Zustand aus einem Snapshot wieder her.
   */
  restoreSnapshot(jsonStr) {
    const data = JSON.parse(jsonStr);
    this.gameMode = data.gameMode || 'X01';
    this.startScore = data.startScore;
    this.inRule = data.inRule;
    this.outRule = data.outRule;
    this.legsToWin = data.legsToWin;
    this.setsToWin = data.setsToWin;
    this.legsPerSet = data.legsPerSet;
    this.inputMode = data.inputMode;
    this.currentPlayerIndex = data.currentPlayerIndex;
    this.legStarterIndex = data.legStarterIndex;
    this.currentLeg = data.currentLeg;
    this.currentSet = data.currentSet;
    this.isMatchOver = data.isMatchOver;
    this.currentTurnDarts = data.currentTurnDarts || [];
    this.legsHistory = data.legsHistory || [];
    this.currentLegTurns = data.currentLegTurns || [];
    this.players = data.players;
    this.winner = data.winnerId ? this.players.find(p => p.id === data.winnerId) : null;
  }

  saveHistory() {
    this.historyStack.push(this.createSnapshot());
    this.redoStack = []; // Nach neuem Wurf wird Redo geleert
  }

  undo() {
    if (this.historyStack.length === 0) return false;
    const currentSnapshot = this.createSnapshot();
    this.redoStack.push(currentSnapshot);
    const prevSnapshot = this.historyStack.pop();
    this.restoreSnapshot(prevSnapshot);
    if (this.onStateChange) this.onStateChange();
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    const nextSnapshot = this.redoStack.pop();
    this.historyStack.push(this.createSnapshot());
    this.restoreSnapshot(nextSnapshot);
    if (this.onStateChange) this.onStateChange();
    return true;
  }

  /**
   * Dart-für-Dart Eingabe
   * @param {string|Object} dartInput - z. B. "T20", "D16", "25", "BULL", oder Wurf-Objekt
   */
  recordDart(dartInput) {
    if (this.isMatchOver) return;

    this.saveHistory();

    const dart = typeof dartInput === 'string' ? parseSegment(dartInput) : dartInput;
    const player = this.getCurrentPlayer();

    // In-Regel prüfen
    if (!player.hasStartedIn) {
      if (this.inRule === 'DOUBLE' && !dart.isDouble) {
        // Nicht getroffen, zählt als 0
        this.applyDartResult(player, { ...dart, score: 0 }, false);
        return;
      }
      if (this.inRule === 'MASTER' && !dart.isDouble && !dart.isTriple) {
        this.applyDartResult(player, { ...dart, score: 0 }, false);
        return;
      }
      player.hasStartedIn = true;
    }

    const previousScore = player.currentScore;
    const remaining = previousScore - dart.score;

    // Check, ob dieser Dart auf ein Doppel geworfen wurde
    const isDoubleAttempt = (previousScore <= 50 && (previousScore % 2 === 0 || previousScore === 50));
    if (isDoubleAttempt) {
      player.stats.doubleAttempts++;
    }
    dart.isDoubleAttempt = isDoubleAttempt;

    // Bust-Prüfung
    let isBust = false;
    let isCheckout = false;

    if (remaining < 0) {
      isBust = true;
    } else if (remaining === 1 && this.outRule === 'DOUBLE') {
      isBust = true; // Rest 1 kann im Double Out nicht beendet werden
    } else if (remaining === 0) {
      // Prüfe Out-Bedingung
      if (this.outRule === 'DOUBLE' && !dart.isDouble) {
        isBust = true;
      } else if (this.outRule === 'MASTER' && !dart.isDouble && !dart.isTriple) {
        isBust = true;
      } else {
        isCheckout = true;
        if (dart.isDouble) {
          player.stats.doubleHits++;
        }
      }
    }

    this.applyDartResult(player, dart, isBust, isCheckout);
  }

  applyDartResult(player, dart, isBust, isCheckout) {
    this.currentTurnDarts.push({ ...dart, isBust, isCheckout });
    player.currentLegDarts++;
    player.stats.totalDarts++;

    if (this.onDartThrow) {
      this.onDartThrow(player, dart, this.currentTurnDarts.length);
    }

    if (isCheckout) {
      // Leg / Match gewonnen!
      const finishScore = player.currentScore;
      player.currentScore = 0;
      player.stats.totalScore += finishScore;
      if (finishScore > player.stats.highestFinish) {
        player.stats.highestFinish = finishScore;
      }

      this.finishTurn(player, false, true);
      this.handleLegWin(player);
      return;
    }

    if (isBust) {
      // Punktestand wird auf den Stand zu Beginn dieser 3 Darts zurückgesetzt
      const turnScoreBefore = this.currentTurnDarts.slice(0, -1).reduce((acc, d) => acc + d.score, 0);
      player.currentScore = player.currentScore + turnScoreBefore; // Wiederherstellung

      if (this.onBust) this.onBust(player);
      this.finishTurn(player, true, false);
      this.advanceTurn();
      return;
    }

    // Normaler gültiger Wurf
    player.currentScore -= dart.score;
    player.stats.totalScore += dart.score;

    if (player.currentLegDarts <= 9) {
      player.stats.first9Darts++;
      player.stats.first9Score += dart.score;
    }

    // Wenn 3 Darts geworfen wurden, Aufnahme beenden
    if (this.currentTurnDarts.length >= 3) {
      this.finishTurn(player, false, false);
      this.advanceTurn();
    } else {
      if (this.onStateChange) this.onStateChange();
    }
  }

  /**
   * Summen-Schnelleingabe (z. B. "100" oder "180" für alle 3 Darts)
   */
  recordTurnSum(sumScore, dartsThrown = 3, doubleAttempts = 0, isCheckout = false) {
    if (this.isMatchOver) return;

    this.saveHistory();
    const player = this.getCurrentPlayer();
    const prevScore = player.currentScore;
    const remaining = prevScore - sumScore;

    player.stats.doubleAttempts += doubleAttempts;

    let isBust = false;
    if (remaining < 0 || (remaining === 1 && this.outRule === 'DOUBLE')) {
      isBust = true;
    } else if (remaining === 0) {
      isCheckout = true;
      player.stats.doubleHits++;
    }

    // Fake Darts für Statistik
    const simulatedDarts = [
      { score: Math.round(sumScore / dartsThrown), label: `${sumScore}` }
    ];
    this.currentTurnDarts = simulatedDarts;

    player.currentLegDarts += dartsThrown;
    player.stats.totalDarts += dartsThrown;

    if (isCheckout) {
      player.currentScore = 0;
      player.stats.totalScore += sumScore;
      if (sumScore > player.stats.highestFinish) {
        player.stats.highestFinish = sumScore;
      }
      this.finishTurn(player, false, true, sumScore, doubleAttempts);
      this.handleLegWin(player);
      return;
    }

    if (isBust) {
      if (this.onBust) this.onBust(player);
      this.finishTurn(player, true, false, 0, doubleAttempts);
      this.advanceTurn();
      return;
    }

    player.currentScore = remaining;
    player.stats.totalScore += sumScore;
    if (player.currentLegDarts <= 9) {
      player.stats.first9Darts += dartsThrown;
      player.stats.first9Score += sumScore;
    }

    this.finishTurn(player, false, false, sumScore, doubleAttempts);
    this.advanceTurn();
  }

  finishTurn(player, bust, checkout, explicitSum = null, doubleAttempts = 0) {
    const turnSum = explicitSum !== null
      ? explicitSum
      : (bust ? 0 : this.currentTurnDarts.reduce((acc, d) => acc + d.score, 0));

    if (!bust) {
      if (turnSum === 180) {
        player.stats.count180++;
        if (this.on180) this.on180(player);
      } else if (turnSum >= 140) {
        player.stats.count140Plus++;
      } else if (turnSum >= 100) {
        player.stats.count100Plus++;
      } else if (turnSum >= 60) {
        player.stats.count60Plus++;
      }
      if (turnSum > player.stats.highestTurn) {
        player.stats.highestTurn = turnSum;
      }
    }

    const dAttempts = doubleAttempts || this.currentTurnDarts.filter(d => d.isDoubleAttempt).length;
    const turnDarts = [...this.currentTurnDarts];

    const turnRecord = {
      playerId: player.id,
      playerName: player.name,
      playerColor: player.color,
      legNumber: this.currentLeg,
      setNumber: this.currentSet,
      turnNumber: player.turnHistory.length + 1,
      darts: turnDarts,
      sum: turnSum,
      bust: !!bust,
      checkout: !!checkout,
      remaining: player.currentScore,
      doubleAttempts: dAttempts,
      timestamp: Date.now()
    };

    player.turnHistory.push(turnRecord);
    this.currentLegTurns.push(turnRecord);

    if (this.onTurnEnd) {
      this.onTurnEnd(player, turnSum, bust, checkout);
    }

    this.currentTurnDarts = [];
  }

  advanceTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    if (this.onStateChange) this.onStateChange();

    // Wenn der nächste Spieler ein Bot ist, Zug automatisch ausführen
    this.triggerBotIfActive();
  }

  handleLegWin(player) {
    // Bestes Leg aktualisieren
    if (player.stats.bestLegDarts === null || player.currentLegDarts < player.stats.bestLegDarts) {
      player.stats.bestLegDarts = player.currentLegDarts;
    }

    // Scolia-Archivierung des beendeten Legs
    const winningTurn = player.turnHistory[player.turnHistory.length - 1];
    const winningDart = (winningTurn && winningTurn.darts && winningTurn.darts.length > 0)
      ? winningTurn.darts[winningTurn.darts.length - 1]
      : null;
    const finishScore = winningTurn ? winningTurn.sum : 0;

    const legSummary = {
      legNumber: this.currentLeg,
      setNumber: this.currentSet,
      winnerId: player.id,
      winnerName: player.name,
      winnerColor: player.color,
      winningDarts: player.currentLegDarts,
      winningDart: winningDart ? (winningDart.label || `${winningDart.segment}`) : null,
      highFinish: finishScore,
      turns: [...this.currentLegTurns],
      players: this.players.map(p => {
        const legTurns = this.currentLegTurns.filter(t => t.playerId === p.id);
        const legDarts = legTurns.reduce((acc, t) => acc + (t.darts && t.darts.length > 0 ? t.darts.length : 3), 0);
        const pStart = p.startScore || this.startScore;
        const legScore = (p.id === player.id) ? pStart : (pStart - p.currentScore);

        let f9Darts = 0;
        let f9Score = 0;
        for (const t of legTurns) {
          if (t.darts && t.darts.length > 0) {
            for (const d of t.darts) {
              if (f9Darts < 9) {
                f9Darts++;
                f9Score += (d.score || 0);
              }
            }
          } else {
            const added = Math.min(3, 9 - f9Darts);
            if (added > 0) {
              f9Darts += added;
              f9Score += Math.round((t.sum / 3) * added);
            }
          }
        }

        const dAttempts = legTurns.reduce((acc, t) => acc + (t.doubleAttempts || 0), 0);
        const dHits = (p.id === player.id) ? 1 : 0;
        const checkoutPct = dAttempts > 0 ? (dHits / dAttempts) * 100 : 0;
        const validSums = legTurns.filter(t => !t.bust).map(t => t.sum);
        const highestTurn = validSums.length > 0 ? Math.max(...validSums) : 0;

        return {
          id: p.id,
          name: p.name,
          color: p.color,
          isWinner: p.id === player.id,
          dartsCount: legDarts,
          scoreScored: legScore,
          average: legDarts > 0 ? (legScore / legDarts) * 3 : 0,
          first9Average: f9Darts > 0 ? (f9Score / f9Darts) * 3 : 0,
          doubleAttempts: dAttempts,
          doubleHits: dHits,
          checkoutPct: checkoutPct,
          highestTurn: highestTurn,
          scoringBuckets: {
            c180: legTurns.filter(t => !t.bust && t.sum === 180).length,
            c140: legTurns.filter(t => !t.bust && t.sum >= 140 && t.sum < 180).length,
            c100: legTurns.filter(t => !t.bust && t.sum >= 100 && t.sum < 140).length,
            c60: legTurns.filter(t => !t.bust && t.sum >= 60 && t.sum < 100).length,
            cUnder60: legTurns.filter(t => !t.bust && t.sum < 60).length
          }
        };
      })
    };

    this.legsHistory.push(legSummary);
    this.currentLegTurns = [];

    player.legsWon++;

    if (this.onLegWon) {
      this.onLegWon(player, this.currentLeg);
    }

    // Set / Match Prüfung
    if (this.setsToWin > 1) {
      // Set-Modus
      if (player.legsWon >= this.legsPerSet) {
        player.setsWon++;
        player.legsWon = 0;
        // Alle anderen Legs auf 0
        this.players.forEach(p => p.legsWon = 0);

        if (player.setsWon >= this.setsToWin) {
          this.handleMatchWin(player);
          return;
        }
        this.currentSet++;
      }
    } else {
      // Reiner Leg-Modus
      if (player.legsWon >= this.legsToWin) {
        this.handleMatchWin(player);
        return;
      }
    }

    // Nächstes Leg vorbereiten
    this.currentLeg++;
    this.legStarterIndex = (this.legStarterIndex + 1) % this.players.length;
    this.currentPlayerIndex = this.legStarterIndex;

    this.players.forEach(p => {
      p.currentScore = p.startScore || this.startScore;
      p.currentLegDarts = 0;
      p.hasStartedIn = this.inRule === 'STRAIGHT';
    });

    if (this.onStateChange) this.onStateChange();
    this.triggerBotIfActive();
  }

  handleMatchWin(player) {
    this.isMatchOver = true;
    this.winner = player;
    if (this.onMatchWon) {
      this.onMatchWon(player);
    }
    if (this.onStateChange) this.onStateChange();
  }

  triggerBotIfActive() {
    if (this.isMatchOver) return;
    const current = this.getCurrentPlayer();
    if (current && current.isBot) {
      // Verzögerung für realistische Bot-Würfe
      setTimeout(() => {
        this.executeBotTurn();
      }, 700);
    }
  }

  executeBotTurn() {
    if (this.isMatchOver) return;
    const bot = this.getCurrentPlayer();
    if (!bot || !bot.isBot) return;

    import('./darts-math.js').then(({ simulateBotThrow }) => {
      let dartsThrown = 0;
      const throwInterval = setInterval(() => {
        if (this.isMatchOver || !this.getCurrentPlayer() || this.getCurrentPlayer().id !== bot.id) {
          clearInterval(throwInterval);
          return;
        }

        const dart = simulateBotThrow(bot.currentScore, 3 - dartsThrown, bot.botAverage, this.outRule);
        dartsThrown++;
        this.recordDart(dart);

        // Prüfen, ob Turn vorbei (Bust, Checkout oder 3 Darts)
        if (this.getCurrentPlayer().id !== bot.id || this.isMatchOver || dartsThrown >= 3) {
          clearInterval(throwInterval);
        }
      }, 600);
    });
  }

  // Statistik-Hilfsmethoden
  getPlayerAverage(player) {
    if (!player || player.stats.totalDarts === 0) return 0;
    return (player.stats.totalScore / player.stats.totalDarts) * 3;
  }

  getPlayerFirst9Average(player) {
    if (!player || player.stats.first9Darts === 0) return 0;
    return (player.stats.first9Score / player.stats.first9Darts) * 3;
  }

  getPlayerCheckoutRate(player) {
    if (!player || player.stats.doubleAttempts === 0) return 0;
    return (player.stats.doubleHits / player.stats.doubleAttempts) * 100;
  }

  getCurrentLegStats() {
    return {
      legNumber: this.currentLeg,
      setNumber: this.currentSet,
      isLive: true,
      winnerId: null,
      winnerName: null,
      winningDarts: null,
      winningDart: null,
      highFinish: null,
      turns: [...this.currentLegTurns],
      players: this.players.map(p => {
        const legTurns = this.currentLegTurns.filter(t => t.playerId === p.id);
        const legDarts = p.currentLegDarts || legTurns.reduce((acc, t) => acc + (t.darts && t.darts.length > 0 ? t.darts.length : 3), 0);
        const pStart = p.startScore || this.startScore;
        const legScore = pStart - p.currentScore;

        let f9Darts = 0;
        let f9Score = 0;
        for (const t of legTurns) {
          if (t.darts && t.darts.length > 0) {
            for (const d of t.darts) {
              if (f9Darts < 9) {
                f9Darts++;
                f9Score += (d.score || 0);
              }
            }
          } else {
            const added = Math.min(3, 9 - f9Darts);
            if (added > 0) {
              f9Darts += added;
              f9Score += Math.round((t.sum / 3) * added);
            }
          }
        }

        const dAttempts = legTurns.reduce((acc, t) => acc + (t.doubleAttempts || 0), 0);
        const dHits = 0;
        const checkoutPct = dAttempts > 0 ? (dHits / dAttempts) * 100 : 0;
        const validSums = legTurns.filter(t => !t.bust).map(t => t.sum);
        const highestTurn = validSums.length > 0 ? Math.max(...validSums) : 0;

        return {
          id: p.id,
          name: p.name,
          color: p.color,
          isWinner: false,
          remainingScore: p.currentScore,
          dartsCount: legDarts,
          scoreScored: legScore,
          average: legDarts > 0 ? (legScore / legDarts) * 3 : 0,
          first9Average: f9Darts > 0 ? (f9Score / f9Darts) * 3 : 0,
          doubleAttempts: dAttempts,
          doubleHits: dHits,
          checkoutPct: checkoutPct,
          highestTurn: highestTurn,
          scoringBuckets: {
            c180: legTurns.filter(t => !t.bust && t.sum === 180).length,
            c140: legTurns.filter(t => !t.bust && t.sum >= 140 && t.sum < 180).length,
            c100: legTurns.filter(t => !t.bust && t.sum >= 100 && t.sum < 140).length,
            c60: legTurns.filter(t => !t.bust && t.sum >= 60 && t.sum < 100).length,
            cUnder60: legTurns.filter(t => !t.bust && t.sum < 60).length
          }
        };
      })
    };
  }

  getLegStats(index) {
    if (index >= 0 && index < this.legsHistory.length) {
      return this.legsHistory[index];
    }
    return null;
  }

  getScoliaMatchSummary() {
    return {
      gameMode: this.gameMode,
      startScore: this.startScore,
      outRule: this.outRule,
      currentLeg: this.currentLeg,
      currentSet: this.currentSet,
      isMatchOver: this.isMatchOver,
      legsHistory: this.legsHistory,
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        color: p.color,
        legsWon: p.legsWon,
        setsWon: p.setsWon,
        currentScore: p.currentScore,
        totalDarts: p.stats.totalDarts,
        totalScore: p.stats.totalScore,
        average: this.getPlayerAverage(p),
        first9Average: this.getPlayerFirst9Average(p),
        checkoutPct: this.getPlayerCheckoutRate(p),
        doubleAttempts: p.stats.doubleAttempts,
        doubleHits: p.stats.doubleHits,
        highestFinish: p.stats.highestFinish,
        bestLegDarts: p.stats.bestLegDarts,
        highestTurn: p.stats.highestTurn,
        scoringBuckets: {
          c180: p.stats.count180,
          c140: p.stats.count140Plus,
          c100: p.stats.count100Plus,
          c60: p.stats.count60Plus,
          cUnder60: Math.max(0, p.turnHistory.length - (p.stats.count180 + p.stats.count140Plus + p.stats.count100Plus + p.stats.count60Plus))
        }
      }))
    };
  }
}

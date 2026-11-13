/**
 * Cricket & Cut-Throat Game Engine
 * Verwaltet Marken (/, X, ⦻), Punktevergabe (Standard vs Cut-Throat vs No-Score),
 * Rundenwechsel, Multi-Level Undo/Redo und Bot-Simulation.
 */

import { parseSegment, simulateCricketBotThrow } from './darts-math.js';

export const CRICKET_NUMBERS = [20, 19, 18, 17, 16, 15, 'BULL'];

export class CricketEngine {
  constructor(config = {}) {
    this.gameMode = 'CRICKET';
    this.cricketType = config.cricketType || 'STANDARD'; // 'STANDARD', 'CUT_THROAT', 'NO_SCORE'
    this.inputMode = config.inputMode || 'DARTS';
    this.legsToWin = config.legsToWin || 1;

    this.players = (config.players && config.players.length > 0)
      ? config.players.map(p => this.createPlayer(p))
      : [
          this.createPlayer({ id: 'p1', name: 'Spieler 1', isBot: false }),
          this.createPlayer({ id: 'bot', name: 'DartBot (Avg 60)', isBot: true, botAverage: 60 })
        ];

    this.currentPlayerIndex = 0;
    this.currentLeg = 1;
    this.isMatchOver = false;
    this.winner = null;
    this.currentTurnDarts = [];

    this.historyStack = [];
    this.redoStack = [];

    // Callbacks
    this.onStateChange = null;
    this.onDartThrow = null;
    this.onTurnEnd = null;
    this.onMatchWon = null;
    this.onSegmentClosed = null;
  }

  createPlayer(p) {
    const marks = {};
    CRICKET_NUMBERS.forEach(num => marks[num] = 0);

    return {
      id: p.id || 'p_' + Math.random().toString(36).substring(2, 9),
      name: p.name || 'Spieler',
      isBot: !!p.isBot,
      botAverage: p.botAverage || 60,
      color: p.color || '#00e5ff',
      currentScore: 0, // In Cut-Throat: Strafpunkte; in Standard: Pluspunkte
      legsWon: 0,
      cricketMarks: marks,
      turnHistory: [],
      stats: {
        totalDarts: 0,
        totalMarks: 0,
        highestTurnMarks: 0
      }
    };
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  createSnapshot() {
    return JSON.stringify({
      gameMode: this.gameMode,
      cricketType: this.cricketType,
      inputMode: this.inputMode,
      currentPlayerIndex: this.currentPlayerIndex,
      currentLeg: this.currentLeg,
      isMatchOver: this.isMatchOver,
      winnerId: this.winner ? this.winner.id : null,
      currentTurnDarts: this.currentTurnDarts,
      players: this.players
    });
  }

  restoreSnapshot(jsonStr) {
    const data = JSON.parse(jsonStr);
    this.gameMode = data.gameMode;
    this.cricketType = data.cricketType;
    this.inputMode = data.inputMode;
    this.currentPlayerIndex = data.currentPlayerIndex;
    this.currentLeg = data.currentLeg;
    this.isMatchOver = data.isMatchOver;
    this.currentTurnDarts = data.currentTurnDarts;
    this.players = data.players;
    this.winner = data.winnerId ? this.players.find(p => p.id === data.winnerId) : null;
  }

  saveHistory() {
    this.historyStack.push(this.createSnapshot());
    this.redoStack = [];
  }

  undo() {
    if (this.historyStack.length === 0) return false;
    this.redoStack.push(this.createSnapshot());
    this.restoreSnapshot(this.historyStack.pop());
    if (this.onStateChange) this.onStateChange();
    return true;
  }

  redo() {
    if (this.redoStack.length === 0) return false;
    this.historyStack.push(this.createSnapshot());
    this.restoreSnapshot(this.redoStack.pop());
    if (this.onStateChange) this.onStateChange();
    return true;
  }

  recordDart(dartInput) {
    if (this.isMatchOver) return;

    this.saveHistory();
    const dart = typeof dartInput === 'string' ? parseSegment(dartInput) : dartInput;
    const player = this.getCurrentPlayer();

    player.stats.totalDarts++;

    // Prüfen, ob das Segment ein gültiges Cricket-Feld ist (15-20 oder BULL)
    let cricketKey = null;
    let hitMarks = 0;
    let segmentPointValue = 0;

    if (dart.value >= 15 && dart.value <= 20) {
      cricketKey = dart.value;
      hitMarks = dart.multiplier;
      segmentPointValue = dart.value;
    } else if (dart.label === 'BULL') {
      cricketKey = 'BULL';
      hitMarks = 2; // Double Bull = 2 Marks
      segmentPointValue = 25;
    } else if (dart.label === '25') {
      cricketKey = 'BULL';
      hitMarks = 1; // Single Bull = 1 Mark
      segmentPointValue = 25;
    }

    let scoredPoints = 0;
    let marksAdded = 0;
    let justClosed = false;

    if (cricketKey !== null && hitMarks > 0) {
      const currentMarks = player.cricketMarks[cricketKey] || 0;
      const neededToClose = Math.max(0, 3 - currentMarks);

      marksAdded = Math.min(hitMarks, neededToClose);
      player.cricketMarks[cricketKey] += marksAdded;
      player.stats.totalMarks += hitMarks;

      if (currentMarks < 3 && player.cricketMarks[cricketKey] >= 3) {
        justClosed = true;
        if (this.onSegmentClosed) {
          this.onSegmentClosed(player, cricketKey);
        }
      }

      const excessMarks = hitMarks - marksAdded;
      if (excessMarks > 0 && this.cricketType !== 'NO_SCORE') {
        scoredPoints = excessMarks * segmentPointValue;

        if (this.cricketType === 'CUT_THROAT') {
          // Strafpunkte gehen an alle Gegner, die dieses Segment noch offen haben
          this.players.forEach(p => {
            if (p.id !== player.id && (p.cricketMarks[cricketKey] || 0) < 3) {
              p.currentScore += scoredPoints;
            }
          });
        } else {
          // Standard Cricket: Eigene Punkte sammeln (nur wenn mind. ein Gegner noch offen hat)
          const anyOpponentOpen = this.players.some(p => p.id !== player.id && (p.cricketMarks[cricketKey] || 0) < 3);
          if (anyOpponentOpen) {
            player.currentScore += scoredPoints;
          }
        }
      }
    }

    this.currentTurnDarts.push({
      ...dart,
      cricketKey,
      hitMarks,
      scoredPoints,
      justClosed
    });

    if (this.onDartThrow) {
      this.onDartThrow(player, dart, this.currentTurnDarts.length);
    }

    // Siegprüfung
    if (this.checkWinCondition(player)) {
      this.handleMatchWin(player);
      return;
    }

    if (this.currentTurnDarts.length >= 3) {
      this.finishTurn(player);
      this.advanceTurn();
    } else {
      if (this.onStateChange) this.onStateChange();
    }
  }

  checkWinCondition(player) {
    // 1. Alle 7 Segmente müssen geschlossen sein (jeweils >= 3 Marks)
    const allClosed = CRICKET_NUMBERS.every(num => (player.cricketMarks[num] || 0) >= 3);
    if (!allClosed) return false;

    // 2. Punkteprüfung
    if (this.cricketType === 'NO_SCORE') {
      return true; // Wer zuerst alle schließt, gewinnt sofort
    }

    if (this.cricketType === 'CUT_THROAT') {
      // In Cut-Throat gewinnt, wer alle geschlossen hat UND die wenigsten oder gleich viele Strafpunkte hat
      return this.players.every(p => p.id === player.id || player.currentScore <= p.currentScore);
    }

    // Standard Cricket: Spieler muss mind. so viele Punkte haben wie alle Gegner
    return this.players.every(p => p.id === player.id || player.currentScore >= p.currentScore);
  }

  finishTurn(player) {
    const turnMarks = this.currentTurnDarts.reduce((acc, d) => acc + (d.hitMarks || 0), 0);
    const turnPoints = this.currentTurnDarts.reduce((acc, d) => acc + (d.scoredPoints || 0), 0);

    if (turnMarks > player.stats.highestTurnMarks) {
      player.stats.highestTurnMarks = turnMarks;
    }

    player.turnHistory.push({
      darts: [...this.currentTurnDarts],
      turnMarks,
      turnPoints,
      score: player.currentScore
    });

    if (this.onTurnEnd) {
      this.onTurnEnd(player, turnPoints, false, false);
    }

    this.currentTurnDarts = [];
  }

  advanceTurn() {
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    if (this.onStateChange) this.onStateChange();
    this.triggerBotIfActive();
  }

  handleMatchWin(player) {
    this.isMatchOver = true;
    this.winner = player;
    player.legsWon++;
    if (this.onMatchWon) this.onMatchWon(player);
    if (this.onStateChange) this.onStateChange();
  }

  triggerBotIfActive() {
    if (this.isMatchOver) return;
    const current = this.getCurrentPlayer();
    if (current && current.isBot) {
      setTimeout(() => this.executeBotTurn(), 600);
    }
  }

  executeBotTurn() {
    if (this.isMatchOver) return;
    const bot = this.getCurrentPlayer();
    if (!bot || !bot.isBot) return;

    let dartsThrown = 0;
    const interval = setInterval(() => {
      if (this.isMatchOver || !this.getCurrentPlayer() || this.getCurrentPlayer().id !== bot.id) {
        clearInterval(interval);
        return;
      }

      const dart = simulateCricketBotThrow(bot, this.players, bot.botAverage, this.cricketType === 'CUT_THROAT');
      dartsThrown++;
      this.recordDart(dart);

      if (this.getCurrentPlayer().id !== bot.id || this.isMatchOver || dartsThrown >= 3) {
        clearInterval(interval);
      }
    }, 600);
  }

  // Statistik Hilfsmethoden
  getPlayerMPR(player) {
    // Marks Per Round (3 Darts = 1 Runde)
    if (!player || player.stats.totalDarts === 0) return 0;
    return (player.stats.totalMarks / player.stats.totalDarts) * 3;
  }
}

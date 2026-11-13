/**
 * Trainings- & Party-Spiel-Engines:
 * 1. Around The Clock Engine
 * 2. Bob's 27 Engine
 * 3. Shanghai Engine
 */

import {
  parseSegment,
  simulateAroundTheClockBotThrow,
  simulateBobs27BotThrow,
  simulateShanghaiBotThrow
} from './darts-math.js';

/* ==========================================================================
   1. AROUND THE CLOCK ENGINE
   ========================================================================== */
export class AroundTheClockEngine {
  constructor(config = {}) {
    this.gameMode = 'AROUND_THE_CLOCK';
    this.variant = config.attcVariant || 'ANY'; // 'ANY', 'DOUBLE_ONLY', 'TRIPLE_ONLY'
    this.allowSkip = config.attcSkipBonus !== undefined ? config.attcSkipBonus : true;
    this.inputMode = config.inputMode || 'DARTS';

    this.players = (config.players && config.players.length > 0)
      ? config.players.map(p => this.createPlayer(p))
      : [
          this.createPlayer({ id: 'p1', name: 'Spieler 1', isBot: false }),
          this.createPlayer({ id: 'bot', name: 'DartBot', isBot: true, botAverage: 60 })
        ];

    this.currentPlayerIndex = 0;
    this.isMatchOver = false;
    this.winner = null;
    this.currentTurnDarts = [];

    this.historyStack = [];
    this.redoStack = [];

    this.onStateChange = null;
    this.onDartThrow = null;
    this.onTurnEnd = null;
    this.onMatchWon = null;
    this.onTargetHit = null;
  }

  createPlayer(p) {
    return {
      id: p.id || 'p_' + Math.random().toString(36).substring(2, 9),
      name: p.name || 'Spieler',
      isBot: !!p.isBot,
      botAverage: p.botAverage || 60,
      color: p.color || '#00e5ff',
      currentTarget: 1, // 1 bis 20, danach 'BULL' (21)
      completed: false,
      turnHistory: [],
      stats: {
        totalDarts: 0,
        hits: 0,
        misses: 0
      }
    };
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  createSnapshot() {
    return JSON.stringify({
      gameMode: this.gameMode,
      variant: this.variant,
      allowSkip: this.allowSkip,
      currentPlayerIndex: this.currentPlayerIndex,
      isMatchOver: this.isMatchOver,
      winnerId: this.winner ? this.winner.id : null,
      currentTurnDarts: this.currentTurnDarts,
      players: this.players
    });
  }

  restoreSnapshot(jsonStr) {
    const data = JSON.parse(jsonStr);
    this.gameMode = data.gameMode;
    this.variant = data.variant;
    this.allowSkip = data.allowSkip;
    this.currentPlayerIndex = data.currentPlayerIndex;
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

    const target = player.currentTarget;
    let isHit = false;
    let stepsAdvanced = 0;

    if (target === 21 || target === 'BULL') {
      // Bull-Stufe
      if (dart.label === 'BULL' || dart.label === '25') {
        isHit = true;
        stepsAdvanced = 1;
        player.completed = true;
      }
    } else {
      // Normales Feld 1..20
      if (dart.value === target) {
        if (this.variant === 'DOUBLE_ONLY' && !dart.isDouble) {
          isHit = false;
        } else if (this.variant === 'TRIPLE_ONLY' && !dart.isTriple) {
          isHit = false;
        } else {
          isHit = true;
          if (this.allowSkip) {
            stepsAdvanced = dart.multiplier; // Double = +2, Triple = +3
          } else {
            stepsAdvanced = 1;
          }
        }
      }
    }

    if (isHit) {
      player.stats.hits++;
      player.currentTarget += stepsAdvanced;
      if (player.currentTarget > 21) {
        player.completed = true;
      }
      if (this.onTargetHit) this.onTargetHit(player, target, stepsAdvanced);
    } else {
      player.stats.misses++;
    }

    this.currentTurnDarts.push({
      ...dart,
      target,
      isHit,
      stepsAdvanced
    });

    if (this.onDartThrow) {
      this.onDartThrow(player, dart, this.currentTurnDarts.length);
    }

    // Siegprüfung
    if (player.completed) {
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

  finishTurn(player) {
    player.turnHistory.push({
      darts: [...this.currentTurnDarts],
      targetAtEnd: player.currentTarget
    });
    if (this.onTurnEnd) this.onTurnEnd(player, 0, false, false);
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

    let thrown = 0;
    const interval = setInterval(() => {
      if (this.isMatchOver || !this.getCurrentPlayer() || this.getCurrentPlayer().id !== bot.id) {
        clearInterval(interval);
        return;
      }

      const dart = simulateAroundTheClockBotThrow(bot.currentTarget, this.variant, this.allowSkip, bot.botAverage);
      thrown++;
      this.recordDart(dart);

      if (this.getCurrentPlayer().id !== bot.id || this.isMatchOver || thrown >= 3) {
        clearInterval(interval);
      }
    }, 600);
  }
}

/* ==========================================================================
   2. BOB'S 27 ENGINE
   ========================================================================== */
export class Bobs27Engine {
  constructor(config = {}) {
    this.gameMode = 'BOBS_27';
    this.allowPractice = !!config.bobsPracticeMode; // true = kein Ausscheiden bei < 0
    this.inputMode = config.inputMode || 'DARTS';

    this.players = (config.players && config.players.length > 0)
      ? config.players.map(p => this.createPlayer(p))
      : [
          this.createPlayer({ id: 'p1', name: 'Spieler 1', isBot: false }),
          this.createPlayer({ id: 'bot', name: 'DartBot', isBot: true, botAverage: 60 })
        ];

    this.currentRound = 1; // 1 bis 20 (D1 bis D20), 21 = BULL
    this.currentPlayerIndex = 0;
    this.isMatchOver = false;
    this.winner = null;
    this.currentTurnDarts = [];

    this.historyStack = [];
    this.redoStack = [];

    this.onStateChange = null;
    this.onDartThrow = null;
    this.onTurnEnd = null;
    this.onMatchWon = null;
    this.onPlayerBust = null;
  }

  createPlayer(p) {
    return {
      id: p.id || 'p_' + Math.random().toString(36).substring(2, 9),
      name: p.name || 'Spieler',
      isBot: !!p.isBot,
      botAverage: p.botAverage || 60,
      color: p.color || '#00e5ff',
      currentScore: 27, // Startet mit 27 Punkten
      isEliminated: false,
      turnHistory: [],
      stats: {
        totalDarts: 0,
        doubleHits: 0
      }
    };
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  getCurrentDoubleTarget() {
    return this.currentRound === 21 ? 'BULL' : `D${this.currentRound}`;
  }

  createSnapshot() {
    return JSON.stringify({
      gameMode: this.gameMode,
      allowPractice: this.allowPractice,
      currentRound: this.currentRound,
      currentPlayerIndex: this.currentPlayerIndex,
      isMatchOver: this.isMatchOver,
      winnerId: this.winner ? this.winner.id : null,
      currentTurnDarts: this.currentTurnDarts,
      players: this.players
    });
  }

  restoreSnapshot(jsonStr) {
    const data = JSON.parse(jsonStr);
    this.gameMode = data.gameMode;
    this.allowPractice = data.allowPractice;
    this.currentRound = data.currentRound;
    this.currentPlayerIndex = data.currentPlayerIndex;
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

    const isBullRound = (this.currentRound === 21);
    const isTargetHit = isBullRound
      ? (dart.label === 'BULL')
      : (dart.isDouble && dart.value === this.currentRound);

    if (isTargetHit) {
      player.stats.doubleHits++;
    }

    this.currentTurnDarts.push({
      ...dart,
      round: this.currentRound,
      isTargetHit
    });

    if (this.onDartThrow) {
      this.onDartThrow(player, dart, this.currentTurnDarts.length);
    }

    if (this.currentTurnDarts.length >= 3) {
      this.finishTurn(player);
      this.advanceTurn();
    } else {
      if (this.onStateChange) this.onStateChange();
    }
  }

  finishTurn(player) {
    const hits = this.currentTurnDarts.filter(d => d.isTargetHit).length;
    const segVal = this.currentRound === 21 ? 25 : this.currentRound;
    const doubleVal = segVal * 2; // z.B. D1 = 2, D20 = 40, BULL = 50

    let scoreChange = 0;
    if (hits > 0) {
      scoreChange = hits * doubleVal;
      player.currentScore += scoreChange;
    } else {
      scoreChange = -doubleVal;
      player.currentScore += scoreChange;
    }

    let busted = false;
    if (player.currentScore < 0 && !this.allowPractice) {
      player.isEliminated = true;
      busted = true;
      if (this.onPlayerBust) this.onPlayerBust(player);
    }

    player.turnHistory.push({
      round: this.currentRound,
      darts: [...this.currentTurnDarts],
      hits,
      scoreChange,
      scoreAfter: player.currentScore,
      busted
    });

    if (this.onTurnEnd) {
      this.onTurnEnd(player, scoreChange, busted, false);
    }

    this.currentTurnDarts = [];
  }

  advanceTurn() {
    // Finde nächsten noch aktiven Spieler in dieser Runde
    let nextIdx = (this.currentPlayerIndex + 1) % this.players.length;

    // Wenn alle Spieler in dieser Runde geworfen haben, Runde erhöhen
    if (nextIdx === 0) {
      this.currentRound++;
      if (this.currentRound > 21) {
        // Match beendet!
        this.evaluateWinner();
        return;
      }
    }

    // Prüfen, ob alle eliminiert sind
    const activePlayers = this.players.filter(p => !p.isEliminated);
    if (activePlayers.length === 0) {
      this.evaluateWinner();
      return;
    }

    // Überspringe eliminierte Spieler
    while (this.players[nextIdx].isEliminated) {
      nextIdx = (nextIdx + 1) % this.players.length;
      if (nextIdx === 0) {
        this.currentRound++;
        if (this.currentRound > 21) {
          this.evaluateWinner();
          return;
        }
      }
    }

    this.currentPlayerIndex = nextIdx;
    if (this.onStateChange) this.onStateChange();
    this.triggerBotIfActive();
  }

  evaluateWinner() {
    this.isMatchOver = true;
    // Höchste Punktzahl gewinnt
    let topPlayer = this.players[0];
    this.players.forEach(p => {
      if (p.currentScore > topPlayer.currentScore) {
        topPlayer = p;
      }
    });
    this.winner = topPlayer;
    if (this.onMatchWon) this.onMatchWon(this.winner);
    if (this.onStateChange) this.onStateChange();
  }

  triggerBotIfActive() {
    if (this.isMatchOver) return;
    const current = this.getCurrentPlayer();
    if (current && current.isBot && !current.isEliminated) {
      setTimeout(() => this.executeBotTurn(), 600);
    }
  }

  executeBotTurn() {
    if (this.isMatchOver) return;
    const bot = this.getCurrentPlayer();
    if (!bot || !bot.isBot) return;

    let thrown = 0;
    const interval = setInterval(() => {
      if (this.isMatchOver || !this.getCurrentPlayer() || this.getCurrentPlayer().id !== bot.id) {
        clearInterval(interval);
        return;
      }

      const dart = simulateBobs27BotThrow(this.currentRound, bot.botAverage);
      thrown++;
      this.recordDart(dart);

      if (this.getCurrentPlayer().id !== bot.id || this.isMatchOver || thrown >= 3) {
        clearInterval(interval);
      }
    }, 600);
  }
}

/* ==========================================================================
   3. SHANGHAI ENGINE
   ========================================================================== */
export class ShanghaiEngine {
  constructor(config = {}) {
    this.gameMode = 'SHANGHAI';
    this.roundConfig = config.shanghaiRounds || '1-7'; // '1-7', '10-15', '15-20_BULL', '1-20'
    this.roundsList = this.getRoundsList(this.roundConfig);
    this.inputMode = config.inputMode || 'DARTS';

    this.players = (config.players && config.players.length > 0)
      ? config.players.map(p => this.createPlayer(p))
      : [
          this.createPlayer({ id: 'p1', name: 'Spieler 1', isBot: false }),
          this.createPlayer({ id: 'bot', name: 'DartBot', isBot: true, botAverage: 60 })
        ];

    this.roundIndex = 0; // Index in roundsList
    this.currentPlayerIndex = 0;
    this.isMatchOver = false;
    this.winner = null;
    this.currentTurnDarts = [];

    this.historyStack = [];
    this.redoStack = [];

    this.onStateChange = null;
    this.onDartThrow = null;
    this.onTurnEnd = null;
    this.onMatchWon = null;
    this.onShanghaiWin = null;
  }

  getRoundsList(cfg) {
    if (cfg === '10-15') return [10, 11, 12, 13, 14, 15];
    if (cfg === '15-20_BULL') return [15, 16, 17, 18, 19, 20, 'BULL'];
    if (cfg === '1-20') return Array.from({ length: 20 }, (_, i) => i + 1);
    return [1, 2, 3, 4, 5, 6, 7]; // Standard 1-7
  }

  createPlayer(p) {
    return {
      id: p.id || 'p_' + Math.random().toString(36).substring(2, 9),
      name: p.name || 'Spieler',
      isBot: !!p.isBot,
      botAverage: p.botAverage || 60,
      color: p.color || '#00e5ff',
      currentScore: 0,
      turnHistory: [],
      stats: {
        totalDarts: 0,
        shanghaiCount: 0
      }
    };
  }

  getCurrentPlayer() {
    return this.players[this.currentPlayerIndex];
  }

  getCurrentTargetNumber() {
    return this.roundsList[this.roundIndex];
  }

  createSnapshot() {
    return JSON.stringify({
      gameMode: this.gameMode,
      roundConfig: this.roundConfig,
      roundsList: this.roundsList,
      roundIndex: this.roundIndex,
      currentPlayerIndex: this.currentPlayerIndex,
      isMatchOver: this.isMatchOver,
      winnerId: this.winner ? this.winner.id : null,
      currentTurnDarts: this.currentTurnDarts,
      players: this.players
    });
  }

  restoreSnapshot(jsonStr) {
    const data = JSON.parse(jsonStr);
    this.gameMode = data.gameMode;
    this.roundConfig = data.roundConfig;
    this.roundsList = data.roundsList;
    this.roundIndex = data.roundIndex;
    this.currentPlayerIndex = data.currentPlayerIndex;
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
    const currentTarget = this.getCurrentTargetNumber();

    player.stats.totalDarts++;

    let isHit = false;
    let earnedPoints = 0;

    if (currentTarget === 'BULL') {
      if (dart.label === 'BULL') {
        isHit = true;
        earnedPoints = 50;
      } else if (dart.label === '25') {
        isHit = true;
        earnedPoints = 25;
      }
    } else {
      if (dart.value === currentTarget) {
        isHit = true;
        earnedPoints = dart.score;
      }
    }

    if (isHit) {
      player.currentScore += earnedPoints;
    }

    this.currentTurnDarts.push({
      ...dart,
      currentTarget,
      isHit,
      earnedPoints
    });

    if (this.onDartThrow) {
      this.onDartThrow(player, dart, this.currentTurnDarts.length);
    }

    // Prüfen auf Shanghai (Single + Double + Triple in derselben Aufnahme)
    if (this.currentTurnDarts.length === 3) {
      const hasSingle = this.currentTurnDarts.some(d => d.value === currentTarget && d.multiplier === 1);
      const hasDouble = this.currentTurnDarts.some(d => d.value === currentTarget && d.multiplier === 2);
      const hasTriple = this.currentTurnDarts.some(d => d.value === currentTarget && d.multiplier === 3);

      if (hasSingle && hasDouble && hasTriple) {
        // INSTANT SHANGHAI WIN!
        player.stats.shanghaiCount++;
        this.finishTurn(player);
        if (this.onShanghaiWin) this.onShanghaiWin(player);
        this.handleMatchWin(player);
        return;
      }
    }

    if (this.currentTurnDarts.length >= 3) {
      this.finishTurn(player);
      this.advanceTurn();
    } else {
      if (this.onStateChange) this.onStateChange();
    }
  }

  finishTurn(player) {
    const turnPoints = this.currentTurnDarts.reduce((acc, d) => acc + (d.earnedPoints || 0), 0);
    player.turnHistory.push({
      round: this.getCurrentTargetNumber(),
      darts: [...this.currentTurnDarts],
      turnPoints,
      totalScore: player.currentScore
    });
    if (this.onTurnEnd) this.onTurnEnd(player, turnPoints, false, false);
    this.currentTurnDarts = [];
  }

  advanceTurn() {
    let nextIdx = (this.currentPlayerIndex + 1) % this.players.length;
    if (nextIdx === 0) {
      this.roundIndex++;
      if (this.roundIndex >= this.roundsList.length) {
        // Alle Runden beendet!
        this.evaluateWinner();
        return;
      }
    }

    this.currentPlayerIndex = nextIdx;
    if (this.onStateChange) this.onStateChange();
    this.triggerBotIfActive();
  }

  evaluateWinner() {
    this.isMatchOver = true;
    let topPlayer = this.players[0];
    this.players.forEach(p => {
      if (p.currentScore > topPlayer.currentScore) {
        topPlayer = p;
      }
    });
    this.winner = topPlayer;
    if (this.onMatchWon) this.onMatchWon(this.winner);
    if (this.onStateChange) this.onStateChange();
  }

  handleMatchWin(player) {
    this.isMatchOver = true;
    this.winner = player;
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

    let thrown = 0;
    const interval = setInterval(() => {
      if (this.isMatchOver || !this.getCurrentPlayer() || this.getCurrentPlayer().id !== bot.id) {
        clearInterval(interval);
        return;
      }

      const dart = simulateShanghaiBotThrow(this.getCurrentTargetNumber(), this.currentTurnDarts, bot.botAverage);
      thrown++;
      this.recordDart(dart);

      if (this.getCurrentPlayer().id !== bot.id || this.isMatchOver || thrown >= 3) {
        clearInterval(interval);
      }
    }, 600);
  }
}

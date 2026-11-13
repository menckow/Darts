/**
 * Hauptanwendungs-Controller (Dart Scoreboard App)
 * Multi-Game Support: X01, Cricket, Around The Clock, Bob's 27, Shanghai.
 * Verbindet Game Engines, Dartboard, Audio-Caller, Themes und UI-Ereignisse.
 */

import { GameEngine } from '../engine/game-state.js';
import { CricketEngine, CRICKET_NUMBERS } from '../engine/cricket-engine.js';
import { AroundTheClockEngine, Bobs27Engine, ShanghaiEngine } from '../engine/training-engines.js';
import { CallerEngine } from '../audio/caller.js';
import { DartboardUI } from './dartboard.js';
import { getCheckoutRecommendation, parseSegment } from '../engine/darts-math.js';
import { db } from '../storage/db.js';
import { ProfileManager } from './profile-manager.js';
import { StatsDashboard } from './stats-dashboard.js';
import { scoliaDashboard } from './scolia-dashboard.js';

class DartsApp {
  constructor() {
    this.engine = null;
    this.caller = new CallerEngine();
    this.dartboard = null;

    this.currentMatchDarts = [];
    this.currentMatchStartTime = Date.now();
    this.currentMatchId = 'match_' + Date.now();

    this.currentTheme = localStorage.getItem('darts_theme') || 'theme-pdc';
    this.sumInputBuffer = '';
    this.multiplierMode = 1; // 1 = Single, 2 = Double, 3 = Triple

    this.profileManager = new ProfileManager(this);
    this.statsDashboard = new StatsDashboard(this);

    this.initTheme();
    this.initGame();
    this.initUI();
    this.bindGlobalKeyboard();
  }

  initTheme() {
    document.documentElement.className = this.currentTheme;
  }

  setTheme(themeName) {
    this.currentTheme = themeName;
    document.documentElement.className = themeName;
    localStorage.setItem('darts_theme', themeName);

    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === themeName);
    });
  }

  /**
   * Factory zur Instanziierung der passenden Game-Engine
   */
  createGameEngine(config) {
    const mode = config.gameMode || 'X01';
    let engine;
    switch (mode) {
      case 'CRICKET':
        engine = new CricketEngine(config);
        break;
      case 'AROUND_THE_CLOCK':
        engine = new AroundTheClockEngine(config);
        break;
      case 'BOBS_27':
        engine = new Bobs27Engine(config);
        break;
      case 'SHANGHAI':
        engine = new ShanghaiEngine(config);
        break;
      case 'X01':
      default:
        engine = new GameEngine(config);
        break;
    }
    engine.gameMode = engine.gameMode || mode || 'X01';
    return engine;
  }

  initGame(config = {}) {
    const savedConfig = JSON.parse(localStorage.getItem('darts_last_match_config') || 'null');
    const finalConfig = Object.assign({
      gameMode: 'X01',
      startScore: 501,
      inRule: 'STRAIGHT',
      outRule: 'DOUBLE',
      legsToWin: 3,
      setsToWin: 1,
      legsPerSet: 3,
      inputMode: 'DARTS',
      players: [
        { id: 'p1', name: 'Spieler 1', isBot: false, color: '#00e5ff' },
        { id: 'p2', name: 'DartBot (Avg 65)', isBot: true, botAverage: 65, color: '#ff2a70' }
      ]
    }, savedConfig, config);

    this.currentMatchId = 'match_' + Date.now();
    this.currentMatchStartTime = Date.now();
    this.currentMatchDarts = [];

    this.engine = this.createGameEngine(finalConfig);

    // Callbacks verdrahten
    this.engine.onStateChange = () => this.updateUI();

    this.engine.onDartThrow = (player, dart, index) => {
      this.caller.playDartHit(dart);
      if (this.dartboard) {
        this.dartboard.addDartMarker(dart.label, index);
      }
    };

    this.engine.onTurnEnd = (player, turnSum, bust, checkout) => {
      this.caller.announceTurn(turnSum, bust, checkout);
      if (this.dartboard) {
        setTimeout(() => this.dartboard.clearMarkers(), 800);
      }
    };

    this.engine.onBust = () => {
      this.showToast('BUST! Keine Wertung.', 'toast-bust');
    };

    this.engine.on180 = () => {
      this.trigger180Overlay();
    };

    this.engine.onLegWon = (player, legNum) => {
      this.caller.announceLegWin(player, legNum);
      this.showToast(`${player.name} gewinnt Leg ${legNum}!`, 'toast-win');
    };

    this.engine.onMatchWon = async (player) => {
      this.caller.announceMatchWin(player);
      this.showWinnerModal(player);

      // Match und Würfe in IndexedDB persistieren
      try {
        const playerStatsMap = {};
        if (this.engine.players) {
          this.engine.players.forEach(p => {
            playerStatsMap[p.id] = {
              totalDarts: p.stats.totalDarts,
              totalScore: p.stats.totalScore,
              average: this.engine.getPlayerAverage ? this.engine.getPlayerAverage(p) : 0,
              first9Average: this.engine.getPlayerFirst9Average ? this.engine.getPlayerFirst9Average(p) : 0,
              checkoutPct: this.engine.getPlayerCheckoutRate ? this.engine.getPlayerCheckoutRate(p) : 0,
              doubleAttempts: p.stats.doubleAttempts || 0,
              doubleHits: p.stats.doubleHits || 0,
              highestFinish: p.stats.highestFinish || 0,
              bestLegDarts: p.stats.bestLegDarts || null,
              highestTurn: p.stats.highestTurn || 0,
              scoringBuckets: {
                c180: p.stats.count180 || 0,
                c140: p.stats.count140Plus || 0,
                c100: p.stats.count100Plus || 0,
                c60: p.stats.count60Plus || 0,
                cUnder60: Math.max(0, (p.turnHistory?.length || 0) - ((p.stats.count180 || 0) + (p.stats.count140Plus || 0) + (p.stats.count100Plus || 0) + (p.stats.count60Plus || 0)))
              }
            };
          });
        }

        const matchRecord = {
          id: this.currentMatchId,
          timestamp: this.currentMatchStartTime,
          mode: (this.engine.gameMode || 'X01').toLowerCase(),
          config: {
            startScore: this.engine.startScore,
            outRule: this.engine.outRule
          },
          players: this.engine.players.map(p => ({
            id: p.id,
            name: p.name,
            avatar: p.avatar || '🎯',
            color: p.color,
            legsWon: p.legsWon || 0,
            setsWon: p.setsWon || 0
          })),
          legs: this.engine.legsHistory || [],
          winnerId: player.id,
          durationSeconds: Math.round((Date.now() - this.currentMatchStartTime) / 1000),
          summaryStats: {
            finalScore: `${player.name} gewinnt`,
            winnerAvg: this.engine.getPlayerAverage ? this.engine.getPlayerAverage(player) : null,
            playerStats: playerStatsMap
          }
        };

        await db.saveMatch(matchRecord);
        if (this.currentMatchDarts.length > 0) {
          await db.saveDarts(this.currentMatchDarts);
        }
        this.showToast('Match & Statistiken in Datenbank gespeichert 💾', 'toast-info');
      } catch (err) {
        console.warn('Fehler beim Speichern des Matches:', err);
      }
    };

    // Modus-spezifische Spezial-Events
    if (this.engine.onSegmentClosed !== undefined) {
      this.engine.onSegmentClosed = (player, seg) => {
        this.caller.announceSegmentClosed(player, seg);
        this.showToast(`${player.name} schließt Segment ${seg}!`, 'toast-win');
      };
    }

    if (this.engine.onShanghaiWin !== undefined) {
      this.engine.onShanghaiWin = (player) => {
        this.caller.announceShanghai(player);
        this.showToast(`SHANGHAI! ${player.name} gewinnt sofort!`, 'toast-win');
      };
    }

    if (this.engine.onPlayerBust !== undefined) {
      this.engine.onPlayerBust = (player) => {
        this.caller.announcePlayerEliminated(player);
        this.showToast(`${player.name} scheidet aus (&lt; 0 Punkte)!`, 'toast-bust');
      };
    }

    if (!this.dartboard) {
      this.dartboard = new DartboardUI('dartboard-container', (code, coords) => {
        this.handleDartInput(code, coords);
      });
    } else {
      this.dartboard.clearMarkers();
    }

    // Wenn nicht X01, standardmäßig auf Dart-für-Dart umschalten
    if (this.engine.gameMode !== 'X01') {
      this.switchInputMode('DARTS');
    }

    this.updateUI();
  }

  initUI() {
    // Theme Switcher Buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
      if (btn.dataset.theme === this.currentTheme) btn.classList.add('active');
      btn.addEventListener('click', () => this.setTheme(btn.dataset.theme));
    });

    // Input-Mode Toggle (Dart-für-Dart vs Summe)
    const toggleDartMode = document.getElementById('btn-mode-darts');
    const toggleSumMode = document.getElementById('btn-mode-sum');
    if (toggleDartMode && toggleSumMode) {
      toggleDartMode.addEventListener('click', () => this.switchInputMode('DARTS'));
      toggleSumMode.addEventListener('click', () => this.switchInputMode('SUM'));
    }

    // Multiplier Toggle Buttons
    document.querySelectorAll('.multiplier-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mult = parseInt(btn.dataset.multiplier, 10);
        this.setMultiplierMode(mult);
      });
    });

    // Nummern-Buttons für Segmentpad
    document.querySelectorAll('.segment-num-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.value;
        this.handleKeypadNumberClick(val);
      });
    });

    // 3-Dart-Summen Ziffernblock
    document.querySelectorAll('.numpad-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const digit = btn.dataset.digit;
        this.handleSumDigit(digit);
      });
    });

    // Quick-Buttons für Summe
    document.querySelectorAll('.quick-sum-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const sum = parseInt(btn.dataset.sum, 10);
        this.submitSumScore(sum);
      });
    });

    // Undo / Redo Buttons
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.addEventListener('click', () => this.engine.undo());
    if (btnRedo) btnRedo.addEventListener('click', () => this.engine.redo());

    // Header Aktionen
    const btnNewMatch = document.getElementById('btn-new-match');
    const btnStats = document.getElementById('btn-stats');
    const btnSettings = document.getElementById('btn-settings');

    if (btnNewMatch) btnNewMatch.addEventListener('click', () => this.openModal('modal-setup'));
    if (btnStats) btnStats.addEventListener('click', () => this.openStatsModal());
    if (btnSettings) btnSettings.addEventListener('click', () => this.openModal('modal-settings'));

    // Modal Close Buttons
    document.querySelectorAll('.modal-close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.closeModals());
    });

    // Setup Modal: Game Mode Dropdown Handler für adaptive Optionen
    const setupGameModeSelect = document.getElementById('setup-game-mode');
    if (setupGameModeSelect) {
      setupGameModeSelect.addEventListener('change', (e) => {
        this.updateSetupModalVisibility(e.target.value);
      });
    }

    // Match Setup Formular Handler
    const setupForm = document.getElementById('setup-match-form');
    if (setupForm) {
      setupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSetupSubmit();
      });
    }

    // Spieler im Setup hinzufügen
    const btnAddPlayer = document.getElementById('btn-add-setup-player');
    if (btnAddPlayer) {
      btnAddPlayer.addEventListener('click', () => this.addSetupPlayerRow());
    }

    const btnQuickProfiles = document.getElementById('btn-quick-open-profiles');
    if (btnQuickProfiles) {
      btnQuickProfiles.addEventListener('click', () => {
        this.closeModals();
        this.profileManager.show();
      });
    }

    // Bestehende Setup-Zeilen verknüpfen
    document.querySelectorAll('.setup-player-row').forEach(row => {
      this.bindSetupRowSelect(row);
    });

    // Audio-Settings Schalter
    const soundToggle = document.getElementById('setting-sound-fx');
    const speechToggle = document.getElementById('setting-speech');
    if (soundToggle) {
      soundToggle.checked = this.caller.soundEnabled;
      soundToggle.addEventListener('change', (e) => this.caller.soundEnabled = e.target.checked);
    }
    if (speechToggle) {
      speechToggle.checked = this.caller.speechEnabled;
      speechToggle.addEventListener('change', (e) => this.caller.speechEnabled = e.target.checked);
    }
  }

  updateSetupModalVisibility(selectedMode) {
    const x01Sec = document.getElementById('mode-options-x01');
    const cricketSec = document.getElementById('mode-options-cricket');
    const attcSec = document.getElementById('mode-options-attc');
    const bobsSec = document.getElementById('mode-options-bobs27');
    const shanghaiSec = document.getElementById('mode-options-shanghai');

    if (x01Sec) x01Sec.style.display = (selectedMode === 'X01') ? 'block' : 'none';
    if (cricketSec) cricketSec.style.display = (selectedMode === 'CRICKET') ? 'block' : 'none';
    if (attcSec) attcSec.style.display = (selectedMode === 'AROUND_THE_CLOCK') ? 'block' : 'none';
    if (bobsSec) bobsSec.style.display = (selectedMode === 'BOBS_27') ? 'block' : 'none';
    if (shanghaiSec) shanghaiSec.style.display = (selectedMode === 'SHANGHAI') ? 'block' : 'none';
  }

  setMultiplierMode(mult) {
    this.multiplierMode = mult;
    document.querySelectorAll('.multiplier-toggle-btn').forEach(b => {
      b.classList.toggle('active', parseInt(b.dataset.multiplier, 10) === mult);
    });
  }

  handleKeypadNumberClick(val) {
    if (val === '0' || val === 'MISS') {
      this.handleDartInput('0');
      this.setMultiplierMode(1);
      return;
    }
    if (val === '25') {
      this.handleDartInput(this.multiplierMode === 2 ? 'BULL' : '25');
      this.setMultiplierMode(1);
      return;
    }
    if (val === 'BULL') {
      this.handleDartInput('BULL');
      this.setMultiplierMode(1);
      return;
    }

    const prefix = this.multiplierMode === 3 ? 'T' : (this.multiplierMode === 2 ? 'D' : 'S');
    const segment = `${prefix}${val}`;
    this.handleDartInput(segment);
    this.setMultiplierMode(1);
  }

  handleDartInput(segmentCode, coords = null) {
    if (!this.engine || this.engine.isMatchOver) return;
    this.caller.ensureAudioResumed();

    // Wurf-Event für Langzeit-Statistiken und Heatmap speichern
    const player = this.engine.getCurrentPlayer();
    const parsed = parseSegment(segmentCode);

    if (player && parsed) {
      const isDoubleAttempt = parsed.multiplier === 2 || parsed.value === 25 || parsed.label === 'BULL';
      this.currentMatchDarts.push({
        id: 'dart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        matchId: this.currentMatchId,
        playerId: player.id,
        turnIndex: player.stats?.turnsPlayed || 0,
        dartIndex: (player.currentTurnDarts?.length || 0) + 1,
        segment: parsed.value !== undefined ? parsed.value : 0,
        multiplier: parsed.multiplier,
        score: parsed.score,
        isDoubleAttempt,
        isCheckout: false,
        isBust: false,
        coordX: coords ? coords.x : null,
        coordY: coords ? coords.y : null,
        inputMethod: coords ? 'board' : 'keypad',
        mode: (this.engine.gameMode || 'X01').toLowerCase()
      });
    }

    this.engine.recordDart(segmentCode);
  }

  switchInputMode(mode) {
    if (this.engine) this.engine.inputMode = mode;
    const dartSection = document.getElementById('input-section-darts');
    const sumSection = document.getElementById('input-section-sum');
    const toggleDartMode = document.getElementById('btn-mode-darts');
    const toggleSumMode = document.getElementById('btn-mode-sum');

    if (mode === 'DARTS') {
      if (dartSection) dartSection.style.display = 'grid';
      if (sumSection) sumSection.style.display = 'none';
      if (toggleDartMode) toggleDartMode.classList.add('active');
      if (toggleSumMode) toggleSumMode.classList.remove('active');
    } else {
      if (dartSection) dartSection.style.display = 'none';
      if (sumSection) sumSection.style.display = 'flex';
      if (toggleDartMode) toggleDartMode.classList.remove('active');
      if (toggleSumMode) toggleSumMode.classList.add('active');
    }
  }

  handleSumDigit(digit) {
    if (digit === 'CLEAR') {
      this.sumInputBuffer = '';
    } else if (digit === 'ENTER') {
      const scoreStr = this.sumInputBuffer.length > 0 ? this.sumInputBuffer : '0';
      const score = parseInt(scoreStr, 10);
      if (!isNaN(score) && score >= 0 && score <= 180) {
        this.submitSumScore(score);
        this.sumInputBuffer = '';
      } else {
        this.showToast('Maximal 180 Punkte pro Aufnahme (0 - 180)!', 'toast-warn');
      }
    } else if (digit === 'BACK') {
      this.sumInputBuffer = this.sumInputBuffer.slice(0, -1);
    } else {
      if (this.sumInputBuffer === '0') {
        this.sumInputBuffer = '';
      }
      if (this.sumInputBuffer.length < 3) {
        this.sumInputBuffer += digit;
      }
    }
    const display = document.getElementById('sum-input-display');
    if (display) display.textContent = this.sumInputBuffer || '0';
  }

  submitSumScore(score) {
    if (!this.engine || this.engine.isMatchOver) return;
    this.caller.ensureAudioResumed();

    const player = this.engine.getCurrentPlayer();
    if (!player) return;

    if (this.engine.recordTurnSum) {
      const remaining = player.currentScore - score;
      if (remaining === 0) {
        this.promptCheckoutDarts(score);
      } else {
        const simulated = this.engine.recordTurnSum(score, 3, 0, false);
        this.syncMatchDartsFromTurn(player, simulated);
      }
    }
    const display = document.getElementById('sum-input-display');
    if (display) display.textContent = '0';
    this.sumInputBuffer = '';
  }

  promptCheckoutDarts(score) {
    const player = this.engine.getCurrentPlayer();
    if (!player) return;
    const darts = prompt(`Checkout ${score}! Mit wie vielen Darts beendet? (1, 2 oder 3):`, '3');
    const parsedDarts = parseInt(darts, 10);
    const validDarts = [1, 2, 3].includes(parsedDarts) ? parsedDarts : 3;
    if (this.engine.recordTurnSum) {
      const simulated = this.engine.recordTurnSum(score, validDarts, 1, true);
      this.syncMatchDartsFromTurn(player, simulated);
    }
  }

  syncMatchDartsFromTurn(player, simulatedDarts) {
    if (!player || !Array.isArray(simulatedDarts)) return;
    const currentTurnIdx = player.turnHistory ? player.turnHistory.length : 0;
    simulatedDarts.forEach((d, idx) => {
      this.currentMatchDarts.push({
        id: 'dart_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 5),
        matchId: this.currentMatchId,
        playerId: player.id,
        turnIndex: currentTurnIdx,
        dartIndex: idx + 1,
        segment: d.segment !== undefined ? d.segment : d.score,
        multiplier: d.multiplier !== undefined ? d.multiplier : 1,
        score: d.score,
        isDoubleAttempt: !!d.isDoubleAttempt,
        isCheckout: !!d.isCheckout,
        isBust: !!d.isBust,
        coordX: null,
        coordY: null,
        inputMethod: 'sum',
        mode: (this.engine.gameMode || 'X01').toLowerCase()
      });
    });
  }

  updateUI() {
    if (!this.engine) return;

    // 1. Header Meta Info
    this.updateHeaderMeta();

    // 2. Modus-spezifische Banner (Checkout / ATTC / Bob's 27 / Shanghai)
    this.updateModeBanners();

    // 3. Scoreboard Darstellung (Standard Cards vs Cricket Matrix)
    if (this.engine.gameMode === 'CRICKET') {
      document.getElementById('scoreboard-players').style.display = 'none';
      document.getElementById('cricket-matrix-container').style.display = 'block';
      this.renderCricketMatrix();
    } else {
      document.getElementById('scoreboard-players').style.display = 'grid';
      document.getElementById('cricket-matrix-container').style.display = 'none';
      this.renderPlayerCards();
    }

    // 4. Aktuelle 3-Dart Aufnahme Slots
    this.renderCurrentTurnSlots();

    // 5. Undo/Redo Buttons Zustand
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    if (btnUndo) btnUndo.disabled = (this.engine.historyStack.length === 0);
    if (btnRedo) btnRedo.disabled = (this.engine.redoStack.length === 0);
  }

  updateHeaderMeta() {
    const matchInfoEl = document.getElementById('match-meta-info');
    if (!matchInfoEl) return;

    const mode = this.engine.gameMode;
    let badge1 = 'X01';
    let badge2 = '';

    if (mode === 'X01') {
      badge1 = `${this.engine.startScore} ${this.engine.outRule} OUT`;
      badge2 = this.engine.setsToWin > 1
        ? `Set ${this.engine.currentSet} / Leg ${this.engine.currentLeg}`
        : `Leg ${this.engine.currentLeg} (First to ${this.engine.legsToWin})`;
    } else if (mode === 'CRICKET') {
      badge1 = `🏏 CRICKET (${this.engine.cricketType.replace('_', ' ')})`;
      badge2 = `Leg ${this.engine.currentLeg} (First to ${this.engine.legsToWin})`;
    } else if (mode === 'AROUND_THE_CLOCK') {
      badge1 = `⏰ AROUND THE CLOCK`;
      badge2 = `Modus: ${this.engine.variant.replace('_', ' ')}`;
    } else if (mode === 'BOBS_27') {
      badge1 = `🔥 BOB'S 27`;
      badge2 = `Runde ${this.engine.currentRound} von 21 (${this.engine.getCurrentDoubleTarget()})`;
    } else if (mode === 'SHANGHAI') {
      badge1 = `⚡ SHANGHAI`;
      badge2 = `Runde ${this.engine.roundIndex + 1}/${this.engine.roundsList.length} (Ziel: ${this.engine.getCurrentTargetNumber()})`;
    }

    matchInfoEl.innerHTML = `
      <span class="badge rule-badge">${badge1}</span>
      <span class="badge format-badge">${badge2}</span>
    `;
  }

  updateModeBanners() {
    const checkoutEl = document.getElementById('checkout-guide-banner');
    const attcEl = document.getElementById('attc-banner');
    const bobsEl = document.getElementById('bobs27-banner');
    const shanghaiEl = document.getElementById('shanghai-banner');

    // Alle verstecken
    if (checkoutEl) checkoutEl.style.display = 'none';
    if (attcEl) attcEl.style.display = 'none';
    if (bobsEl) bobsEl.style.display = 'none';
    if (shanghaiEl) shanghaiEl.style.display = 'none';

    const activePlayer = this.engine.getCurrentPlayer();
    if (!activePlayer) return;

    if (this.engine.gameMode === 'X01') {
      const dartsLeft = 3 - this.engine.currentTurnDarts.length;
      const rec = getCheckoutRecommendation(activePlayer.currentScore, dartsLeft, this.engine.outRule);
      if (rec && rec.length > 0) {
        checkoutEl.innerHTML = `
          <div class="checkout-guide-content">
            <span class="checkout-label">🎯 CHECKOUT WEG:</span>
            <div class="checkout-chips">
              ${rec.map(c => `<span class="checkout-chip">${c}</span>`).join('<span class="arrow">➔</span>')}
            </div>
          </div>
        `;
        checkoutEl.style.display = 'flex';
      }
    } else if (this.engine.gameMode === 'AROUND_THE_CLOCK') {
      const target = activePlayer.currentTarget;
      const targetLabel = target > 20 ? 'BULL' : target;

      // Track-Chips generieren (1..20, Bull)
      let chipsHtml = '';
      for (let i = 1; i <= 21; i++) {
        const isBull = (i === 21);
        const label = isBull ? 'B' : i;
        const isCurrent = (target === i);
        const isDone = (target > i);
        chipsHtml += `<span class="attc-chip ${isDone ? 'completed' : ''} ${isCurrent ? 'current' : ''}">${label}</span>`;
      }

      attcEl.innerHTML = `
        <span class="mode-banner-badge">🎯 ZIEL FÜR ${activePlayer.name}:</span>
        <span class="mode-banner-highlight">${targetLabel}</span>
        <div class="attc-track-container">${chipsHtml}</div>
      `;
      attcEl.style.display = 'flex';
    } else if (this.engine.gameMode === 'BOBS_27') {
      const dTarget = this.engine.getCurrentDoubleTarget();
      const doubleVal = (this.engine.currentRound === 21 ? 25 : this.engine.currentRound) * 2;
      bobsEl.innerHTML = `
        <span class="mode-banner-badge">🔥 RUNDE ${this.engine.currentRound}/21:</span>
        <span class="mode-banner-highlight">Doppel ${dTarget}</span>
        <span style="color: var(--text-main); font-size: 0.95rem;">Treffer: <strong>+${doubleVal} Pkt</strong> | Fehlwurf: <strong>-${doubleVal} Pkt</strong></span>
      `;
      bobsEl.style.display = 'flex';
    } else if (this.engine.gameMode === 'SHANGHAI') {
      const target = this.engine.getCurrentTargetNumber();
      const hasSingle = this.engine.currentTurnDarts.some(d => d.value === target && d.multiplier === 1);
      const hasDouble = this.engine.currentTurnDarts.some(d => d.value === target && d.multiplier === 2);
      const hasTriple = this.engine.currentTurnDarts.some(d => d.value === target && d.multiplier === 3);

      shanghaiEl.innerHTML = `
        <span class="mode-banner-badge">⚡ RUNDE ZIEL:</span>
        <span class="mode-banner-highlight">${target}</span>
        <div class="shanghai-turn-chips">
          <span class="shanghai-chip ${hasSingle ? 'hit' : ''}">SINGLE</span>
          <span class="shanghai-chip ${hasDouble ? 'hit' : ''}">DOUBLE</span>
          <span class="shanghai-chip ${hasTriple ? 'hit' : ''}">TRIPLE</span>
        </div>
      `;
      shanghaiEl.style.display = 'flex';
    }
  }

  renderPlayerCards() {
    const container = document.getElementById('scoreboard-players');
    if (!container) return;
    container.innerHTML = '';

    this.engine.players.forEach((player, idx) => {
      const isActive = (idx === this.engine.currentPlayerIndex);
      const card = document.createElement('div');
      card.className = `player-card ${isActive ? 'active-turn' : ''} ${player.isBot ? 'bot-card' : ''}`;
      card.style.setProperty('--player-accent', player.color);

      // Score-Wert und Mini-Stats je nach Modus anpassen
      let scoreDisplay = player.currentScore;
      let statsHtml = '';

      if (this.engine.gameMode === 'X01') {
        const avg = this.engine.getPlayerAverage(player).toFixed(1);
        const f9 = this.engine.getPlayerFirst9Average(player).toFixed(1);
        const checkRate = this.engine.getPlayerCheckoutRate(player).toFixed(1);

        statsHtml = `
          <div class="mini-stat"><span class="label">3-Dart Avg</span><span class="val">${avg}</span></div>
          <div class="mini-stat"><span class="label">First 9</span><span class="val">${f9}</span></div>
          <div class="mini-stat"><span class="label">Doppel</span><span class="val">${checkRate}%</span></div>
          <div class="mini-stat"><span class="label">180s</span><span class="val">${player.stats.count180}</span></div>
        `;
      } else if (this.engine.gameMode === 'AROUND_THE_CLOCK') {
        scoreDisplay = player.currentTarget > 20 ? 'BULL' : player.currentTarget;
        const hitRate = player.stats.totalDarts > 0 ? ((player.stats.hits / player.stats.totalDarts) * 100).toFixed(1) : 0;
        statsHtml = `
          <div class="mini-stat"><span class="label">Ziel</span><span class="val">${scoreDisplay}</span></div>
          <div class="mini-stat"><span class="label">Treffer</span><span class="val">${player.stats.hits}</span></div>
          <div class="mini-stat"><span class="label">Quote</span><span class="val">${hitRate}%</span></div>
          <div class="mini-stat"><span class="label">Darts</span><span class="val">${player.stats.totalDarts}</span></div>
        `;
      } else if (this.engine.gameMode === 'BOBS_27') {
        if (player.isEliminated) {
          scoreDisplay = 'BUST';
        }
        statsHtml = `
          <div class="mini-stat"><span class="label">Punkte</span><span class="val">${player.currentScore}</span></div>
          <div class="mini-stat"><span class="label">Doppel-Hits</span><span class="val">${player.stats.doubleHits}</span></div>
          <div class="mini-stat"><span class="label">Darts</span><span class="val">${player.stats.totalDarts}</span></div>
          <div class="mini-stat"><span class="label">Status</span><span class="val">${player.isEliminated ? 'Out' : 'Aktiv'}</span></div>
        `;
      } else if (this.engine.gameMode === 'SHANGHAI') {
        statsHtml = `
          <div class="mini-stat"><span class="label">Punkte</span><span class="val">${player.currentScore}</span></div>
          <div class="mini-stat"><span class="label">Shanghai</span><span class="val">${player.stats.shanghaiCount}</span></div>
          <div class="mini-stat"><span class="label">Darts</span><span class="val">${player.stats.totalDarts}</span></div>
          <div class="mini-stat"><span class="label">Rang</span><span class="val">#${idx + 1}</span></div>
        `;
      }

      card.innerHTML = `
        <div class="player-card-header">
          <div class="player-name-wrapper">
            <span class="player-avatar" style="background:${player.color}">${player.isBot ? '🤖' : '🎯'}</span>
            <span class="player-name">${player.name}</span>
          </div>
          <div class="player-score-badges">
            ${player.handicap ? `<span class="badge" style="background: rgba(255,255,255,0.12); font-size: 0.72rem; padding: 2px 6px; border-radius: 4px;" title="Handikap: ${player.handicap > 0 ? '+' : ''}${player.handicap} Punkte">HC: ${player.handicap > 0 ? '+' : ''}${player.handicap}</span>` : ''}
            ${player.legsWon ? `<span class="badge leg-badge">Legs: ${player.legsWon}</span>` : ''}
          </div>
        </div>

        <div class="player-big-score" style="${player.isEliminated ? 'color: var(--accent-danger);' : ''}">${scoreDisplay}</div>
        <div class="player-stats-mini">${statsHtml}</div>
        <div class="player-last-turn">${this.renderLastTurn(player)}</div>
      `;
      container.appendChild(card);
    });
  }

  renderCricketMatrix() {
    const container = document.getElementById('cricket-matrix-container');
    if (!container) return;

    let html = `
      <table class="cricket-matrix-table">
        <thead>
          <tr>
    `;

    // Spieler-Spalten Header
    this.engine.players.forEach((p, idx) => {
      const isActive = (idx === this.engine.currentPlayerIndex);
      const mpr = this.engine.getPlayerMPR(p).toFixed(1);
      html += `
        <th class="cricket-header-player ${isActive ? 'active-col' : ''}" style="color:${p.color};">
          <div>${p.name} ${p.isBot ? '🤖' : ''}</div>
          <span class="cricket-player-score">${p.currentScore}</span>
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">MPR: ${mpr}</div>
        </th>
      `;
    });

    html += `
          </tr>
        </thead>
        <tbody>
    `;

    // Reihen für 20, 19, 18, 17, 16, 15, BULL
    CRICKET_NUMBERS.forEach(num => {
      html += `<tr>`;
      this.engine.players.forEach(p => {
        const marks = p.cricketMarks[num] || 0;
        let markSymbol = '·';
        let markClass = 'cricket-mark-open';

        if (marks === 1) {
          markSymbol = '/';
          markClass = 'cricket-mark-slash';
        } else if (marks === 2) {
          markSymbol = 'X';
          markClass = 'cricket-mark-cross';
        } else if (marks >= 3) {
          markSymbol = '⦻';
          markClass = 'cricket-mark-closed';
        }

        html += `
          <td class="cricket-mark-cell ${markClass}">
            <span style="font-size:0.8rem; color:var(--text-muted); margin-right:6px;">${num}:</span>
            ${markSymbol}
          </td>
        `;
      });
      html += `</tr>`;
    });

    html += `
        </tbody>
      </table>
    `;

    container.innerHTML = html;
  }

  renderCurrentTurnSlots() {
    const activePlayer = this.engine.getCurrentPlayer();
    const currentTurnSlots = document.getElementById('current-turn-slots');
    if (currentTurnSlots && activePlayer) {
      currentTurnSlots.innerHTML = '';
      for (let i = 0; i < 3; i++) {
        const dart = this.engine.currentTurnDarts[i];
        const slot = document.createElement('div');
        slot.className = `turn-dart-slot ${dart ? 'filled' : (i === this.engine.currentTurnDarts.length ? 'current' : 'empty')}`;
        slot.innerHTML = dart
          ? `<span class="dart-num">${dart.label}</span><span class="dart-score">${dart.score !== undefined ? dart.score : ''}</span>`
          : `<span class="dart-placeholder">Dart ${i + 1}</span>`;
        currentTurnSlots.appendChild(slot);
      }
    }
  }

  renderLastTurn(player) {
    if (!player.turnHistory || player.turnHistory.length === 0) {
      return '<span class="no-turn-hint">Noch kein Wurf</span>';
    }
    const last = player.turnHistory[player.turnHistory.length - 1];
    if (last.bust || last.busted) {
      return `<span class="last-turn-bust">Letzte: BUST (0)</span>`;
    }
    const dartLabels = last.darts ? last.darts.map(d => d.label).join(', ') : '';
    const scoreVal = last.sum !== undefined ? last.sum : (last.turnPoints !== undefined ? last.turnPoints : '');
    return `<span class="last-turn-info">Letzte: <strong>${scoreVal}</strong> ${dartLabels ? `(${dartLabels})` : ''}</span>`;
  }

  showToast(message, extraClass = '') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `app-toast ${extraClass}`;
    toast.innerHTML = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 400);
    }, 2500);
  }

  trigger180Overlay() {
    const overlay = document.getElementById('overlay-180');
    if (!overlay) return;
    overlay.classList.add('show-180');
    setTimeout(() => {
      overlay.classList.remove('show-180');
    }, 2800);
  }

  showWinnerModal(player) {
    const modal = document.getElementById('modal-winner');
    if (!modal) return;
    document.getElementById('winner-player-name').textContent = player.name;

    const avgEl = document.getElementById('winner-avg');
    if (this.engine.getPlayerAverage) {
      avgEl.textContent = this.engine.getPlayerAverage(player).toFixed(1);
    } else if (this.engine.getPlayerMPR) {
      avgEl.textContent = `${this.engine.getPlayerMPR(player).toFixed(1)} MPR`;
    } else {
      avgEl.textContent = player.currentScore;
    }

    document.getElementById('winner-best-leg').textContent = player.stats.bestLegDarts ? `${player.stats.bestLegDarts} Darts` : '-';
    document.getElementById('winner-high-finish').textContent = player.stats.highestFinish || player.stats.hits || '-';
    document.getElementById('winner-180s').textContent = player.stats.count180 || player.stats.totalMarks || player.stats.shanghaiCount || 0;
    this.openModal('modal-winner');
  }

  openStatsModal(dataSource = null, initialTab = 'overall') {
    const container = document.getElementById('stats-modal-body');
    const ds = dataSource || this.engine;
    if (!container || !ds) return;

    const mode = ((ds.gameMode || ds.mode || 'X01') + '').toUpperCase();
    if (mode === 'X01' || mode === 'CRICKET' || ds.legs) {
      scoliaDashboard.render(container, ds, initialTab);
    } else {
      let html = `<div class="stats-table-wrapper"><table class="stats-table">
        <thead>
          <tr>
            <th>Spieler</th>
            <th>Modus</th>
            <th>Punkte / Score</th>
            <th>Darts Gesamt</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>`;

      (ds.players || []).forEach(p => {
        let details = '';
        if (mode === 'AROUND_THE_CLOCK') {
          details = `Treffer: ${p.stats?.hits || 0} | Fehlwürfe: ${p.stats?.misses || 0}`;
        } else if (mode === 'BOBS_27') {
          details = `Doppel-Hits: ${p.stats?.doubleHits || 0} | Status: ${p.isEliminated ? 'Eliminiert' : 'Aktiv'}`;
        } else if (mode === 'SHANGHAI') {
          details = `Shanghai Treffer: ${p.stats?.shanghaiCount || 0}`;
        }

        html += `<tr>
          <td><strong>${p.name}</strong> ${p.isBot ? '(Bot)' : ''}</td>
          <td>${mode}</td>
          <td>${p.currentScore ?? '-'}</td>
          <td>${p.stats?.totalDarts || 0}</td>
          <td>${details}</td>
        </tr>`;
      });

      html += `</tbody></table></div>`;
      container.innerHTML = html;
    }

    this.openModal('modal-stats');
  }

  async openScoliaForMatch(matchId) {
    const match = await db.getMatchById(matchId);
    if (!match) {
      alert('Match nicht gefunden.');
      return;
    }
    this.openStatsModal(match, 'overall');
  }

  openModal(modalId) {
    this.closeModals();
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('active');
    }
    if (modalId === 'modal-setup' && this.profileManager) {
      this.profileManager.populateSetupSelectors();
    }
  }

  closeModals() {
    document.querySelectorAll('.app-modal').forEach(m => m.classList.remove('active'));
  }

  handleSetupSubmit() {
    const gameMode = document.getElementById('setup-game-mode').value;

    const startScore = parseInt(document.getElementById('setup-start-score').value, 10);
    const inRule = document.getElementById('setup-in-rule').value;
    const outRule = document.getElementById('setup-out-rule').value;
    const legsToWin = parseInt(document.getElementById('setup-legs-to-win').value, 10);
    const setsToWin = parseInt(document.getElementById('setup-sets-to-win').value, 10);

    const cricketType = document.getElementById('setup-cricket-type').value;
    const attcVariant = document.getElementById('setup-attc-variant').value;
    const attcSkipBonus = document.getElementById('setup-attc-skip').checked;
    const bobsPracticeMode = document.getElementById('setup-bobs-practice').checked;
    const shanghaiRounds = document.getElementById('setup-shanghai-rounds').value;

    const playerRows = document.querySelectorAll('.setup-player-row');
    const players = [];

    playerRows.forEach((row, idx) => {
      const selectProfile = row.querySelector('.setup-player-select');
      const nameInput = row.querySelector('.player-name-input');
      const isBotCheckbox = row.querySelector('.player-bot-toggle');
      const botAvgSelect = row.querySelector('.player-bot-avg');
      const colorInput = row.querySelector('.player-color-input');

      const isBot = isBotCheckbox ? isBotCheckbox.checked : false;
      const botAverage = botAvgSelect ? parseInt(botAvgSelect.value, 10) : 60;
      const color = colorInput ? colorInput.value : (idx === 0 ? '#00e5ff' : '#ff2a70');
      const profileId = (selectProfile && selectProfile.value) ? selectProfile.value : ('p_' + idx);
      const handicap = parseInt(row.dataset.handicap || '0', 10) || 0;

      players.push({
        id: profileId,
        name: nameInput.value.trim() || `Spieler ${idx + 1}`,
        isBot,
        botAverage,
        color,
        handicap
      });
    });

    const config = {
      gameMode,
      startScore,
      inRule,
      outRule,
      legsToWin,
      setsToWin,
      cricketType,
      attcVariant,
      attcSkipBonus,
      bobsPracticeMode,
      shanghaiRounds,
      players
    };

    localStorage.setItem('darts_last_match_config', JSON.stringify(config));
    this.initGame(config);
    this.closeModals();
    this.showToast(`Neues Spiel gestartet: ${gameMode}!`, 'toast-info');
  }

  bindSetupRowSelect(row) {
    const sel = row.querySelector('.setup-player-select');
    const nameInput = row.querySelector('.player-name-input');
    const isBotCheckbox = row.querySelector('.player-bot-toggle');
    const botAvgSelect = row.querySelector('.player-bot-avg');
    const colorInput = row.querySelector('.player-color-input');

    if (isBotCheckbox && botAvgSelect) {
      isBotCheckbox.addEventListener('change', () => {
        botAvgSelect.disabled = !isBotCheckbox.checked;
      });
    }

    if (sel) {
      sel.addEventListener('change', async () => {
        const pId = sel.value;
        if (!pId) {
          row.dataset.handicap = '0';
          return;
        }
        const profile = await db.getPlayerById(pId);
        if (profile) {
          row.dataset.handicap = profile.handicap || 0;
          if (nameInput) nameInput.value = profile.name;
          if (colorInput) colorInput.value = profile.color || '#00e5ff';
          if (isBotCheckbox) isBotCheckbox.checked = !!profile.isBot;
          if (botAvgSelect) {
            botAvgSelect.disabled = !profile.isBot;
            if (profile.isBot) {
              const diffMap = { beginner: 35, amateur: 50, club: 65, pro: 80, master: 95 };
              botAvgSelect.value = diffMap[profile.botDifficulty] || (profile.botAverage || 65);
            }
          }
        }
      });
    }
  }

  addSetupPlayerRow(name = '', isBot = false, avg = 65) {
    const container = document.getElementById('setup-players-container');
    if (!container) return;
    const rowIdx = container.children.length + 1;
    if (rowIdx > 8) {
      alert('Maximal 8 Spieler möglich.');
      return;
    }

    const row = document.createElement('div');
    row.className = 'setup-player-row';
    row.innerHTML = `
      <select class="setup-player-select form-control">
        <option value="">-- Profil auswählen --</option>
      </select>
      <input type="text" class="player-name-input form-control" placeholder="Spieler ${rowIdx}" value="${name || `Spieler ${rowIdx}`}" required />
      <label class="bot-label">
        <input type="checkbox" class="player-bot-toggle" ${isBot ? 'checked' : ''} /> Bot
      </label>
      <select class="player-bot-avg form-control" ${isBot ? '' : 'disabled'}>
        <option value="35" ${avg === 35 ? 'selected' : ''}>Anfänger (Avg 35)</option>
        <option value="50" ${avg === 50 ? 'selected' : ''}>Hobbyspieler (Avg 50)</option>
        <option value="65" ${avg === 65 ? 'selected' : ''}>Vereinsspieler (Avg 65)</option>
        <option value="80" ${avg === 80 ? 'selected' : ''}>Halbprofi (Avg 80)</option>
        <option value="95" ${avg === 95 ? 'selected' : ''}>PDC Pro (Avg 95)</option>
      </select>
      <input type="color" class="player-color-input" value="${rowIdx === 1 ? '#00e5ff' : (rowIdx === 2 ? '#ff2a70' : '#ffb300')}" />
      <button type="button" class="btn-remove-player btn-danger">✕</button>
    `;

    this.bindSetupRowSelect(row);

    row.querySelector('.btn-remove-player').addEventListener('click', () => {
      if (container.children.length <= 1) {
        alert('Mindestens ein Spieler ist erforderlich.');
        return;
      }
      row.remove();
    });

    container.appendChild(row);

    if (this.profileManager) {
      this.profileManager.populateSetupSelectors();
    }
  }

    this.bindSetupRowSelect(row);
    container.appendChild(row);

    if (this.profileManager) {
      this.profileManager.populateSetupSelectors();
    }
  }

  bindGlobalKeyboard() {
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

      // Keine Spiel-Eingaben wenn ein Modal geöffnet ist
      const activeModal = document.querySelector('.app-modal.active');
      if (activeModal) return;

      if (!this.engine) return;

      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.engine.redo();
        } else {
          this.engine.undo();
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        this.engine.redo();
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        const nextMode = this.engine.inputMode === 'DARTS' ? 'SUM' : 'DARTS';
        this.switchInputMode(nextMode);
        return;
      }

      // Tastatur-Ziffern und Enter (X01 oder SUM Modus)
      const isDigit = e.key >= '0' && e.key <= '9';
      const isEnter = e.key === 'Enter' || e.code === 'NumpadEnter';
      const isBack = e.key === 'Backspace';
      const isClear = e.key === 'Escape';

      if (this.engine.inputMode === 'SUM' || (this.engine.gameMode === 'X01' && (isDigit || isEnter || isBack || isClear))) {
        if (isDigit) {
          // Falls noch im DARTS Modus, nahtlos zu SUM Modus wechseln
          if (this.engine.inputMode !== 'SUM') {
            this.switchInputMode('SUM');
          }
          this.handleSumDigit(e.key);
        } else if (isEnter) {
          e.preventDefault();
          this.handleSumDigit('ENTER');
        } else if (isBack) {
          e.preventDefault();
          this.handleSumDigit('BACK');
        } else if (isClear) {
          e.preventDefault();
          this.handleSumDigit('CLEAR');
        }
      }
    });
  }
}

function initApp() {
  if (!window.dartsApp) {
    try {
      window.dartsApp = new DartsApp();
      console.log('🎯 Darts App successfully initialized.');
    } catch (err) {
      console.error('🎯 Darts App Initialization Error:', err);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

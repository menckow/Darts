/**
 * Web Audio & Caller Sound Engine
 * Bietet prozedurale Audio-Synthese (Web Audio API) und PDC-Sprachansagen (Web Speech API).
 * Funktioniert 100% offline ohne externe Audio-Dateien.
 */

export class CallerEngine {
  constructor() {
    this.audioCtx = null;
    this.soundEnabled = true;
    this.speechEnabled = true;
    this.voiceVolume = 1.0;
    this.sfxVolume = 0.8;
    this.selectedVoice = null;

    this.initAudioContext();
    this.initVoices();
  }

  initAudioContext() {
    try {
      if (typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }
    } catch (e) {
      console.warn('Web Audio API nicht unterstützt:', e);
    }
  }

  ensureAudioResumed() {
    if (!this.audioCtx) {
      this.initAudioContext();
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      try {
        this.audioCtx.resume().catch(() => {});
      } catch (e) {
        // Ignorieren falls nicht erlaubt
      }
    }
  }

  initVoices() {
    if ('speechSynthesis' in window) {
      const updateVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        // Bevorzuge britische oder englische Stimme (PDC Caller Style)
        this.selectedVoice = voices.find(v => v.lang.includes('en-GB') || v.name.toLowerCase().includes('british') || v.name.toLowerCase().includes('uk'))
          || voices.find(v => v.lang.startsWith('en'))
          || voices[0];
      };
      updateVoices();
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = updateVoices;
      }
    }
  }

  /**
   * Spielt einen prozeduralen Wurf-Sound
   */
  playDartHit(dart) {
    if (!this.soundEnabled || !this.audioCtx) return;
    this.ensureAudioResumed();

    const now = this.audioCtx.currentTime;

    if (dart.label === 'BULL') {
      // Bullseye Chime
      this.playTone(880, 'sine', 0.15, this.sfxVolume);
      setTimeout(() => this.playTone(1320, 'sine', 0.3, this.sfxVolume * 0.9), 80);
      return;
    }

    if (dart.isTriple) {
      // Treble Ring (metallischer Klick + Board Thud)
      this.playTone(1200, 'triangle', 0.08, this.sfxVolume * 0.7);
      this.playThud(now);
      return;
    }

    if (dart.isDouble) {
      // Double Ding
      this.playTone(950, 'sine', 0.1, this.sfxVolume * 0.7);
      this.playThud(now);
      return;
    }

    // Normaler Single Board Thud
    this.playThud(now);
  }

  playThud(time) {
    if (!this.audioCtx) return;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(35, time + 0.1);

    gain.gain.setValueAtTime(this.sfxVolume * 0.6, time);
    gain.gain.exponentialRampToValueAtTime(0.01, time + 0.1);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(time);
    osc.stop(time + 0.1);
  }

  playTone(freq, type, duration, volume, delay = 0) {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime + delay;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    const safeVol = Math.max(volume || 0.001, 0.0001);
    gain.gain.setValueAtTime(safeVol, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + duration);
  }

  /**
   * Synthetisiert einen melodischen Chime (Glöckchen / Röhrenglocke)
   */
  synthesizeChime(pitch = 'chime_high') {
    if (!this.soundEnabled) return;
    this.ensureAudioResumed();

    let notes;
    let baseDuration;
    let stepMs;

    if (pitch === 'chime_low' || pitch === 'low') {
      // Tiefer Gong / Röhrenglocke (D4, F#4, A4, D5)
      notes = [293.66, 369.99, 440.00, 587.33];
      baseDuration = 1.1;
      stepMs = 110;
    } else if (pitch === 'chime_mid' || pitch === 'mid') {
      // Warmer Mittelton-Chime (A5, C#6, E6, A6)
      notes = [880.00, 1108.73, 1318.51, 1760.00];
      baseDuration = 0.8;
      stepMs = 90;
    } else {
      // Heller, perlender High Chime (E6, G#6, B6, E7)
      notes = [1318.51, 1661.22, 1975.53, 2637.02];
      baseDuration = 0.7;
      stepMs = 80;
    }

    notes.forEach((freq, idx) => {
      setTimeout(() => {
        // Grundton mit sanfter Sinuswelle
        this.playTone(freq, 'sine', baseDuration, this.sfxVolume * 0.7);
        // Weicher Glanz darüber
        this.playTone(freq * 2, 'triangle', baseDuration * 0.5, this.sfxVolume * 0.15);
      }, idx * stepMs);
    });
  }

  /**
   * PDC Fanfare
   */
  synthesizeFanfare() {
    this.playFanfare();
  }

  /**
   * Bullseye / Gong Klang
   */
  synthesizeBullseye() {
    if (!this.soundEnabled) return;
    this.ensureAudioResumed();

    // Bullseye Gong: Kombination aus Anschlag und tiefem Nachhall
    this.playTone(880, 'sine', 0.25, this.sfxVolume * 0.8);
    this.playTone(1320, 'sine', 0.35, this.sfxVolume * 0.7);
    this.playTone(440, 'triangle', 0.9, this.sfxVolume * 0.6);
    this.playTone(220, 'sine', 1.2, this.sfxVolume * 0.5);
  }

  /**
   * Doppel / Dreifach Ring Sound
   */
  synthesizeRing(multiplier = 2) {
    if (!this.soundEnabled) return;
    this.ensureAudioResumed();

    if (multiplier === 3) {
      this.playTone(1200, 'triangle', 0.12, this.sfxVolume * 0.8);
      setTimeout(() => this.playTone(1800, 'sine', 0.25, this.sfxVolume * 0.7), 60);
    } else {
      this.playTone(950, 'sine', 0.15, this.sfxVolume * 0.8);
      setTimeout(() => this.playTone(1425, 'sine', 0.25, this.sfxVolume * 0.6), 50);
    }
  }

  /**
   * Zentraler Einstiegspunkt für Walk-On Sounds
   */
  playWalkonSound(soundKey = 'chime_high') {
    switch (soundKey) {
      case 'fanfare':
        this.synthesizeFanfare();
        break;
      case 'bull':
        this.synthesizeBullseye();
        break;
      case 'triple':
        this.synthesizeRing(3);
        break;
      case 'double':
        this.synthesizeRing(2);
        break;
      case 'chime_low':
      case 'low':
        this.synthesizeChime('chime_low');
        break;
      case 'chime_mid':
      case 'mid':
        this.synthesizeChime('chime_mid');
        break;
      case 'chime_high':
      case 'high':
      default:
        this.synthesizeChime('chime_high');
        break;
    }
  }

  playBustSound() {
    if (!this.soundEnabled || !this.audioCtx) return;
    this.ensureAudioResumed();

    // Tiefer Bust-Buzzer
    const now = this.audioCtx.currentTime;
    this.playTone(180, 'sawtooth', 0.18, this.sfxVolume * 0.5);
    setTimeout(() => this.playTone(130, 'sawtooth', 0.28, this.sfxVolume * 0.6), 120);

    this.speak("Bust!");
  }

  playFanfare() {
    if (!this.soundEnabled || !this.audioCtx) return;
    this.ensureAudioResumed();

    const notes = [523.25, 659.25, 783.99, 1046.50]; // C E G C
    notes.forEach((f, idx) => {
      setTimeout(() => {
        this.playTone(f, 'sine', 0.35, this.sfxVolume * 0.6);
      }, idx * 110);
    });
  }

  /**
   * 180 Ansage und Euphorie
   */
  announce180() {
    this.playFanfare();
    setTimeout(() => {
      this.speak("One hundred and eighty!", 0.95, 1.15);
    }, 200);
  }

  announceTurn(turnSum, bust, checkout) {
    if (bust) {
      this.playBustSound();
      return;
    }
    if (checkout) {
      this.playFanfare();
      return;
    }

    if (turnSum === 180) {
      this.announce180();
      return;
    }

    if (turnSum === 0) {
      this.speak("No score");
      return;
    }

    // Reguläre Score-Ansage
    if (turnSum >= 100) {
      this.speak(`${turnSum}!`);
    } else {
      this.speak(`${turnSum}`);
    }
  }

  announceLegWin(player, legNumber) {
    this.playFanfare();
    this.speak(`Game shot and the leg, ${player.name}!`);
  }

  announceMatchWin(player) {
    this.playFanfare();
    setTimeout(() => {
      this.speak(`Game shot and the match, to ${player.name}! Congratulations!`);
    }, 300);
  }

  announceShanghai(player) {
    this.playFanfare();
    setTimeout(() => {
      this.speak(`Shanghai! ${player.name} hits Shanghai and wins the match!`);
    }, 250);
  }

  announceSegmentClosed(player, segment) {
    this.playTone(880, 'sine', 0.1, this.sfxVolume * 0.8);
    setTimeout(() => this.playTone(1100, 'sine', 0.2, this.sfxVolume * 0.9), 90);
    const segText = segment === 'BULL' ? 'Bullseye' : segment;
    this.speak(`${segText} closed!`);
  }

  announcePlayerEliminated(player) {
    this.playBustSound();
    this.speak(`${player.name} is eliminated!`);
  }

  announceRequirement(score) {
    if (score <= 170 && score > 1) {
      this.speak(`You require ${score}`);
    }
  }

  /**
   * Sprachausgabe über Web Speech API
   */
  speak(text, rate = 1.05, pitch = 1.0) {
    if (!this.speechEnabled || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // Vorherige Ansage stoppen
      const utterance = new SpeechSynthesisUtterance(text);
      if (this.selectedVoice) {
        utterance.voice = this.selectedVoice;
      }
      utterance.volume = this.voiceVolume;
      utterance.rate = rate;
      utterance.pitch = pitch;
      window.speechSynthesis.speak(utterance);
    } catch (e) {
      console.warn('Speech synthesis Fehler:', e);
    }
  }
}

export const audio = new CallerEngine();

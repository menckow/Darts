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
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    } catch (e) {
      console.warn('Web Audio API nicht unterstützt:', e);
    }
  }

  ensureAudioResumed() {
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
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

  playTone(freq, type, duration, volume) {
    if (!this.audioCtx) return;
    const now = this.audioCtx.currentTime;
    const osc = this.audioCtx.createOscillator();
    const gain = this.audioCtx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this.audioCtx.destination);

    osc.start(now);
    osc.stop(now + duration);
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

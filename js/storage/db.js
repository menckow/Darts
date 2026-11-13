/**
 * IndexedDB & LocalStorage Fallback Storage Engine
 * Persists Players, Matches, and Dart Events locally.
 */

const DB_NAME = 'DartsScoreboardDB';
const DB_VERSION = 1;

class DartsDatabase {
  constructor() {
    this.db = null;
    this.isIndexedDBSupported = typeof indexedDB !== 'undefined';
    this.fallbackKey = 'darts_scoreboard_fallback_store';
    this._initialized = false;
    this._initPromise = this.init();
  }

  async init() {
    if (!this.isIndexedDBSupported) {
      console.warn('IndexedDB not available, using LocalStorage fallback.');
      this._initialized = true;
      await this._seedDefaultProfilesIfEmpty();
      return;
    }

    return new Promise((resolve) => {
      try {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (e) => {
          const db = e.target.result;

          // ObjectStore 1: Players
          if (!db.objectStoreNames.contains('players')) {
            const playerStore = db.createObjectStore('players', { keyPath: 'id' });
            playerStore.createIndex('name', 'name', { unique: false });
          }

          // ObjectStore 2: Matches
          if (!db.objectStoreNames.contains('matches')) {
            const matchStore = db.createObjectStore('matches', { keyPath: 'id' });
            matchStore.createIndex('timestamp', 'timestamp', { unique: false });
            matchStore.createIndex('mode', 'mode', { unique: false });
          }

          // ObjectStore 3: Darts
          if (!db.objectStoreNames.contains('darts')) {
            const dartStore = db.createObjectStore('darts', { keyPath: 'id' });
            dartStore.createIndex('matchId', 'matchId', { unique: false });
            dartStore.createIndex('playerId', 'playerId', { unique: false });
          }
        };

        request.onsuccess = async (e) => {
          this.db = e.target.result;
          this._initialized = true;
          resolve(this.db);
          try {
            await this._seedDefaultProfilesIfEmpty();
          } catch (err) {
            console.warn('Error during default profile seeding:', err);
          }
        };

        request.onerror = async (e) => {
          console.warn('IndexedDB failed to open, using LocalStorage fallback:', e.target.error);
          this.db = null;
          this._initialized = true;
          resolve(null);
          try {
            await this._seedDefaultProfilesIfEmpty();
          } catch (err) {
            console.warn('Error during fallback seeding:', err);
          }
        };
      } catch (err) {
        console.warn('IndexedDB initialization threw error, falling back:', err);
        this.db = null;
        this._initialized = true;
        resolve(null);
      }
    });
  }

  async ready() {
    if (this._initialized) return this.db;
    return this._initPromise;
  }

  // Fallback storage helpers
  _getFallbackStore() {
    try {
      const data = localStorage.getItem(this.fallbackKey);
      return data ? JSON.parse(data) : { players: [], matches: [], darts: [] };
    } catch {
      return { players: [], matches: [], darts: [] };
    }
  }

  _saveFallbackStore(data) {
    try {
      localStorage.setItem(this.fallbackKey, JSON.stringify(data));
    } catch (e) {
      console.error('LocalStorage quota exceeded or blocked:', e);
    }
  }

  // Default Bot profiles seeding
  async _seedDefaultProfilesIfEmpty() {
    const existing = await this.getPlayers();
    if (existing && existing.length > 0) return;

    const defaultBots = [
      {
        id: 'bot_rookie',
        name: 'Rookie Rick (Bot)',
        avatar: '🤖',
        color: '#3b82f6',
        isBot: true,
        botDifficulty: 'beginner',
        favoriteDouble: 'D16',
        handicap: 0,
        walkonSound: 'chime_low',
        createdAt: Date.now()
      },
      {
        id: 'bot_amateur',
        name: 'Casual Chris (Bot)',
        avatar: '🎯',
        color: '#10b981',
        isBot: true,
        botDifficulty: 'amateur',
        favoriteDouble: 'D20',
        handicap: 0,
        walkonSound: 'chime_mid',
        createdAt: Date.now() + 1
      },
      {
        id: 'bot_pro',
        name: 'Pro Pete (Bot)',
        avatar: '🔥',
        color: '#f59e0b',
        isBot: true,
        botDifficulty: 'pro',
        favoriteDouble: 'D20',
        handicap: 0,
        walkonSound: 'chime_high',
        createdAt: Date.now() + 2
      },
      {
        id: 'bot_master',
        name: 'Master Max (Bot)',
        avatar: '👑',
        color: '#ef4444',
        isBot: true,
        botDifficulty: 'master',
        favoriteDouble: 'Bull',
        handicap: 0,
        walkonSound: 'fanfare',
        createdAt: Date.now() + 3
      },
      {
        id: 'player_default_1',
        name: 'Spieler 1',
        avatar: '⚡',
        color: '#00f0ff',
        isBot: false,
        favoriteDouble: 'D20',
        handicap: 0,
        walkonSound: 'chime_high',
        createdAt: Date.now() + 4
      },
      {
        id: 'player_default_2',
        name: 'Spieler 2',
        avatar: '🦅',
        color: '#ff0055',
        isBot: false,
        favoriteDouble: 'D16',
        handicap: 0,
        walkonSound: 'chime_mid',
        createdAt: Date.now() + 5
      }
    ];

    for (const p of defaultBots) {
      await this.savePlayer(p);
    }
  }

  // --- PLAYERS API ---
  async getPlayers() {
    await this.ready();
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('players', 'readonly');
        const store = tx.objectStore('players');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } else {
      return this._getFallbackStore().players || [];
    }
  }

  async getPlayerById(id) {
    await this.ready();
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('players', 'readonly');
        const store = tx.objectStore('players');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } else {
      const players = this._getFallbackStore().players || [];
      return players.find(p => p.id === id) || null;
    }
  }

  async savePlayer(player) {
    await this.ready();
    if (!player.id) {
      player.id = 'player_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }
    player.updatedAt = Date.now();
    if (!player.createdAt) player.createdAt = player.updatedAt;

    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('players', 'readwrite');
        const store = tx.objectStore('players');
        const req = store.put(player);
        req.onsuccess = () => resolve(player);
        req.onerror = () => reject(req.error);
      });
    } else {
      const store = this._getFallbackStore();
      const idx = store.players.findIndex(p => p.id === player.id);
      if (idx >= 0) {
        store.players[idx] = player;
      } else {
        store.players.push(player);
      }
      this._saveFallbackStore(store);
      return player;
    }
  }

  async deletePlayer(id) {
    await this.ready();
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('players', 'readwrite');
        const store = tx.objectStore('players');
        const req = store.delete(id);
        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error);
      });
    } else {
      const store = this._getFallbackStore();
      store.players = store.players.filter(p => p.id !== id);
      this._saveFallbackStore(store);
      return true;
    }
  }

  // --- MATCHES API ---
  async getMatches() {
    await this.ready();
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('matches', 'readonly');
        const store = tx.objectStore('matches');
        const req = store.getAll();
        req.onsuccess = () => {
          const list = req.result || [];
          list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } else {
      const matches = this._getFallbackStore().matches || [];
      matches.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      return matches;
    }
  }

  async getMatchById(id) {
    await this.ready();
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('matches', 'readonly');
        const store = tx.objectStore('matches');
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
      });
    } else {
      const matches = this._getFallbackStore().matches || [];
      return matches.find(m => m.id === id) || null;
    }
  }

  async saveMatch(match) {
    await this.ready();
    if (!match.id) {
      match.id = 'match_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    }
    if (!match.timestamp) match.timestamp = Date.now();

    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('matches', 'readwrite');
        const store = tx.objectStore('matches');
        const req = store.put(match);
        req.onsuccess = () => resolve(match);
        req.onerror = () => reject(req.error);
      });
    } else {
      const store = this._getFallbackStore();
      const idx = store.matches.findIndex(m => m.id === match.id);
      if (idx >= 0) {
        store.matches[idx] = match;
      } else {
        store.matches.push(match);
      }
      this._saveFallbackStore(store);
      return match;
    }
  }

  async deleteMatch(id) {
    await this.ready();
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['matches', 'darts'], 'readwrite');
        const matchStore = tx.objectStore('matches');
        const dartStore = tx.objectStore('darts');
        matchStore.delete(id);

        const index = dartStore.index('matchId');
        const req = index.openCursor(IDBKeyRange.only(id));
        req.onsuccess = (e) => {
          const cursor = e.target.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };

        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
      });
    } else {
      const store = this._getFallbackStore();
      store.matches = store.matches.filter(m => m.id !== id);
      store.darts = store.darts.filter(d => d.matchId !== id);
      this._saveFallbackStore(store);
      return true;
    }
  }

  // --- DARTS API ---
  async saveDarts(dartsArray) {
    await this.ready();
    if (!Array.isArray(dartsArray) || dartsArray.length === 0) return [];

    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('darts', 'readwrite');
        const store = tx.objectStore('darts');
        for (const dart of dartsArray) {
          if (!dart.id) {
            dart.id = 'dart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7);
          }
          store.put(dart);
        }
        tx.oncomplete = () => resolve(dartsArray);
        tx.onerror = () => reject(tx.error);
      });
    } else {
      const store = this._getFallbackStore();
      for (const dart of dartsArray) {
        if (!dart.id) dart.id = 'dart_' + Date.now() + '_' + Math.random().toString(36).substr(2, 7);
        store.darts.push(dart);
      }
      this._saveFallbackStore(store);
      return dartsArray;
    }
  }

  async getDartsByMatch(matchId) {
    await this.ready();
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('darts', 'readonly');
        const store = tx.objectStore('darts');
        const index = store.index('matchId');
        const req = index.getAll(IDBKeyRange.only(matchId));
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } else {
      const darts = this._getFallbackStore().darts || [];
      return darts.filter(d => d.matchId === matchId);
    }
  }

  async getDartsByPlayer(playerId, mode = null) {
    await this.ready();
    let allDarts = [];
    if (this.db) {
      allDarts = await new Promise((resolve, reject) => {
        const tx = this.db.transaction('darts', 'readonly');
        const store = tx.objectStore('darts');
        const index = store.index('playerId');
        const req = index.getAll(IDBKeyRange.only(playerId));
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } else {
      const darts = this._getFallbackStore().darts || [];
      allDarts = darts.filter(d => d.playerId === playerId);
    }

    if (mode) {
      allDarts = allDarts.filter(d => d.mode === mode);
    }
    return allDarts;
  }

  // --- FULL BACKUP & RESTORE ---
  async exportFullJSON() {
    await this.ready();
    const players = await this.getPlayers();
    const matches = await this.getMatches();

    let darts = [];
    if (this.db) {
      darts = await new Promise((resolve, reject) => {
        const tx = this.db.transaction('darts', 'readonly');
        const store = tx.objectStore('darts');
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => reject(req.error);
      });
    } else {
      darts = this._getFallbackStore().darts || [];
    }

    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      players,
      matches,
      darts
    };
  }

  async importFullJSON(data) {
    await this.ready();
    if (!data || typeof data !== 'object') {
      throw new Error('Ungültiges Datenformat für Import.');
    }

    const players = Array.isArray(data.players) ? data.players : [];
    const matches = Array.isArray(data.matches) ? data.matches : [];
    const darts = Array.isArray(data.darts) ? data.darts : [];

    for (const p of players) {
      await this.savePlayer(p);
    }
    for (const m of matches) {
      await this.saveMatch(m);
    }
    await this.saveDarts(darts);

    return {
      playersImported: players.length,
      matchesImported: matches.length,
      dartsImported: darts.length
    };
  }

  async clearAll() {
    await this.ready();
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction(['players', 'matches', 'darts'], 'readwrite');
        tx.objectStore('players').clear();
        tx.objectStore('matches').clear();
        tx.objectStore('darts').clear();
        tx.oncomplete = async () => {
          await this._seedDefaultProfilesIfEmpty();
          resolve(true);
        };
        tx.onerror = () => reject(tx.error);
      });
    } else {
      localStorage.removeItem(this.fallbackKey);
      await this._seedDefaultProfilesIfEmpty();
      return true;
    }
  }
}

export const db = new DartsDatabase();

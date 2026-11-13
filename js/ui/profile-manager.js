/**
 * Player Profile Manager UI Controller
 * Manages persistent profiles, creation, editing, and setup integration.
 */
import { db } from '../storage/db.js';
import { audio } from '../audio/caller.js';

export class ProfileManager {
  constructor(app) {
    this.app = app;
    this.profiles = [];
    this.editingProfileId = null;
    this.initElements();
    this.bindEvents();
  }

  initElements() {
    this.modal = document.getElementById('modal-profiles');
    this.profileList = document.getElementById('profiles-list');
    this.form = document.getElementById('profile-form');
    this.btnNew = document.getElementById('btn-new-profile');
    this.btnSave = document.getElementById('btn-save-profile');
    this.btnCancel = document.getElementById('btn-cancel-profile');
    this.btnClose = document.getElementById('btn-close-profiles');

    // Inputs
    this.inputName = document.getElementById('profile-name');
    this.inputAvatar = document.getElementById('profile-avatar');
    this.inputColor = document.getElementById('profile-color');
    this.selectFavDouble = document.getElementById('profile-fav-double');
    this.inputHandicap = document.getElementById('profile-handicap');
    this.selectSound = document.getElementById('profile-sound');
    this.btnPreviewSound = document.getElementById('btn-preview-sound');
  }

  bindEvents() {
    if (this.btnClose) {
      this.btnClose.addEventListener('click', () => this.hide());
    }

    if (this.btnNew) {
      this.btnNew.addEventListener('click', () => this.openFormForNew());
    }

    if (this.btnCancel) {
      this.btnCancel.addEventListener('click', () => this.hideForm());
    }

    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveCurrentProfile();
      });
    }

    if (this.btnPreviewSound) {
      this.btnPreviewSound.addEventListener('click', () => {
        this.playPreviewSound(this.selectSound?.value || 'chime_high');
      });
    }

    // Header profiles button
    const btnOpenHeader = document.getElementById('btn-profiles');
    if (btnOpenHeader) {
      btnOpenHeader.addEventListener('click', () => this.show());
    }
  }

  playPreviewSound(soundKey) {
    if (audio.playWalkonSound) {
      audio.playWalkonSound(soundKey);
    } else if (soundKey === 'fanfare') {
      audio.synthesizeFanfare();
    } else if (soundKey === 'bull') {
      audio.synthesizeBullseye();
    } else if (soundKey === 'triple') {
      audio.synthesizeRing(3);
    } else if (soundKey === 'double') {
      audio.synthesizeRing(2);
    } else {
      audio.synthesizeChime(soundKey);
    }
  }

  async show() {
    if (this.app) this.app.closeModals();
    await this.loadProfiles();
    this.renderList();
    this.hideForm();
    if (this.modal) this.modal.classList.add('active');
  }

  hide() {
    if (this.modal) this.modal.classList.remove('active');
  }

  async loadProfiles() {
    this.profiles = await db.getPlayers();
    return this.profiles;
  }

  renderList() {
    if (!this.profileList) return;
    this.profileList.innerHTML = '';

    if (this.profiles.length === 0) {
      this.profileList.innerHTML = `<div class="empty-state">Noch keine Profile vorhanden. Klicke auf "Neues Profil"!</div>`;
      return;
    }

    this.profiles.forEach(p => {
      const card = document.createElement('div');
      card.className = `profile-card ${p.isBot ? 'bot-card' : ''}`;
      card.style.borderLeft = `4px solid ${p.color || '#00f0ff'}`;

      card.innerHTML = `
        <div class="profile-card-header">
          <span class="profile-avatar">${p.avatar || '🎯'}</span>
          <div class="profile-details">
            <div class="profile-name">
              ${p.name}
              ${p.isBot ? '<span class="badge-bot">BOT</span>' : ''}
            </div>
            <div class="profile-sub">
              Lieblings-Doppel: <strong>${p.favoriteDouble || 'D20'}</strong> • Handikap: ${p.handicap || 0}
            </div>
          </div>
        </div>
        <div class="profile-actions">
          <button class="btn-icon btn-sound-preview" title="Sound abspielen">🔊</button>
          ${!p.isBot ? `<button class="btn-icon btn-edit-profile" title="Bearbeiten">✏️</button>` : ''}
          ${!p.isBot ? `<button class="btn-icon btn-delete-profile" title="Löschen">🗑️</button>` : ''}
        </div>
      `;

      card.querySelector('.btn-sound-preview').addEventListener('click', () => {
        this.playPreviewSound(p.walkonSound || 'chime_high');
      });

      const editBtn = card.querySelector('.btn-edit-profile');
      if (editBtn) {
        editBtn.addEventListener('click', () => this.openFormForEdit(p));
      }

      const delBtn = card.querySelector('.btn-delete-profile');
      if (delBtn) {
        delBtn.addEventListener('click', async () => {
          if (confirm(`Profil "${p.name}" wirklich löschen?`)) {
            await db.deletePlayer(p.id);
            await this.loadProfiles();
            this.renderList();
            this.populateSetupSelectors();
          }
        });
      }

      this.profileList.appendChild(card);
    });
  }

  openFormForNew() {
    this.editingProfileId = null;
    if (this.inputName) this.inputName.value = '';
    if (this.inputAvatar) this.inputAvatar.value = '🎯';
    if (this.inputColor) this.inputColor.value = '#00f0ff';
    if (this.selectFavDouble) this.selectFavDouble.value = 'D20';
    if (this.inputHandicap) this.inputHandicap.value = 0;
    if (this.selectSound) this.selectSound.value = 'chime_high';

    const formContainer = document.getElementById('profile-form-container');
    if (formContainer) formContainer.classList.remove('hidden');
    if (this.inputName) this.inputName.focus();
  }

  openFormForEdit(profile) {
    this.editingProfileId = profile.id;
    if (this.inputName) this.inputName.value = profile.name || '';
    if (this.inputAvatar) this.inputAvatar.value = profile.avatar || '🎯';
    if (this.inputColor) this.inputColor.value = profile.color || '#00f0ff';
    if (this.selectFavDouble) this.selectFavDouble.value = profile.favoriteDouble || 'D20';
    if (this.inputHandicap) this.inputHandicap.value = profile.handicap || 0;
    if (this.selectSound) this.selectSound.value = profile.walkonSound || 'chime_high';

    const formContainer = document.getElementById('profile-form-container');
    if (formContainer) formContainer.classList.remove('hidden');
    if (this.inputName) this.inputName.focus();
  }

  hideForm() {
    const formContainer = document.getElementById('profile-form-container');
    if (formContainer) formContainer.classList.add('hidden');
    this.editingProfileId = null;
  }

  async saveCurrentProfile() {
    const name = this.inputName?.value?.trim();
    if (!name) {
      alert('Bitte einen Namen eingeben.');
      return;
    }

    const profileData = {
      name,
      avatar: this.inputAvatar?.value || '🎯',
      color: this.inputColor?.value || '#00f0ff',
      favoriteDouble: this.selectFavDouble?.value || 'D20',
      handicap: parseInt(this.inputHandicap?.value, 10) || 0,
      walkonSound: this.selectSound?.value || 'chime_high',
      isBot: false
    };

    if (this.editingProfileId) {
      profileData.id = this.editingProfileId;
    }

    await db.savePlayer(profileData);
    this.hideForm();
    await this.loadProfiles();
    this.renderList();
    this.populateSetupSelectors();
  }

  /**
   * Populates profile dropdowns in Setup Modal
   */
  async populateSetupSelectors() {
    await this.loadProfiles();
    const selectors = document.querySelectorAll('.setup-player-select');
    selectors.forEach((sel, idx) => {
      const currentVal = sel.value;
      sel.innerHTML = `<option value="">-- Profil auswählen oder Gast --</option>`;

      // Human players
      const humansGroup = document.createElement('optgroup');
      humansGroup.label = '👤 Gespeicherte Profile';
      this.profiles.filter(p => !p.isBot).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.avatar} ${p.name}${p.handicap ? ` (HC: ${p.handicap > 0 ? '+' : ''}${p.handicap})` : ''}`;
        if (opt.value === currentVal) opt.selected = true;
        humansGroup.appendChild(opt);
      });
      sel.appendChild(humansGroup);

      // Bot players
      const botsGroup = document.createElement('optgroup');
      botsGroup.label = '🤖 Darts Bots';
      this.profiles.filter(p => p.isBot).forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.avatar} ${p.name}${p.handicap ? ` (HC: ${p.handicap > 0 ? '+' : ''}${p.handicap})` : ''}`;
        if (opt.value === currentVal) opt.selected = true;
        botsGroup.appendChild(opt);
      });
      sel.appendChild(botsGroup);
    });
  }
}

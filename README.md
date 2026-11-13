# 🎯 Darts Master Scoreboard & Analytics App

Eine professionelle, wettkampftaugliche Darts-Scoreboard- und Analyse-Webanwendung im Stile moderner Scolia- und PDC-Systeme. Entwickelt für das heimische Dartboard – optimiert für Wand-Tablets (iPad / Android), Smart-TVs, Laptops und Smartphones.

Die Anwendung läuft **100% clientseitig im Webbrowser**: Es werden weder externe Datenbanken, noch Build-Tools (wie npm, webpack) oder Internetverbindungen benötigt. Alle Spieldaten und Statistiken werden lokal und dauerhaft in der Browser-Datenbank (**IndexedDB**) gespeichert.

---

## 📋 Inhaltsverzeichnis

- [Funktionsübersicht](#-funktionsübersicht)
- [Systemvoraussetzungen](#-systemvoraussetzungen)
- [Installationsanleitung](#-installationsanleitung)
  - [Methode 1: Lokaler Webserver mit Python (Empfohlen)](#methode-1-lokaler-webserver-mit-python-empfohlen)
  - [Methode 2: Mit Node.js (npx)](#methode-2-mit-nodejs-npx)
  - [Methode 3: Mit VS Code (Live Server)](#methode-3-mit-vs-code-live-server)
  - [Methode 4: Mit Docker](#methode-4-mit-docker)
  - [Methode 5: Direktes Öffnen im Browser](#methode-5-direktes-öffnen-im-browser)
- [Nutzung am Wand-Tablet / Smart-TV (Kiosk-Modus)](#-nutzung-am-wand-tablet--smart-tv-kiosk-modus)
- [Bedienung & Eingabemodi](#-bedienung--eingabemodi)
  - [Eingabemethoden](#eingabemethoden)
  - [Tastatur-Kürzel](#tastatur-kürzel)
- [Detaillierte Features](#-detaillierte-features)
  - [Spielmodi](#1-umfassende-spielmodi)
  - [Scolia-Style Statistiken & Heatmap](#2-scolia-style-statistiken--heatmaps)
  - [Audio Caller & Soundeffekte](#3-audio-caller--soundeffekte)
  - [Bot-Gegner](#4-ki-bot-gegner)
  - [Export & Druckberichte](#5-export--druckberichte)
- [Projektstruktur](#-projektstruktur)
- [Fehlerbehebung & FAQ](#-fehlerbehebung--faq)
- [Lizenz](#-lizenz)

---

## ✨ Funktionsübersicht

- **Vollständige Spielmodi:** X01 (301–901 mit In/Out-Regeln), Cricket, Cut-Throat, Around the Clock, Bob's 27 und Shanghai.
- **Duale Eingabemodi:** 
  - *Dart-für-Dart:* Interaktives, klickbares SVG-Dartboard mit automatischer Erfassung der exakten Wurfkoordinaten.
  - *Summen-Eingabe:* Schnelleingabe der 3-Dart-Aufnahme über Numpad, On-Screen-Tastatur oder Tastatur inklusive Sofort-Bestätigung mit `Enter`.
- **Scolia-Style Statistiken:**
  - Gaußsche Wurf-Streuungswolke (Density Cloud) basierend auf echten Trefferkoordinaten.
  - Segment-Choroplethen-Heatmap (Trefferhäufigkeit auf Segmente, Doubles, Triples & Bull).
  - Head-to-Head Spieler-Vergleich mit 3-Dart-Average, First-9-Average und Checkout-Quote.
- **Audio Referee & Sound Synthesizer:**
  - Sprachansagen („180!“, „Player 1, you require 40“, „Game shot and the match!“ via SpeechSynthesis API).
  - Retro-Soundeffekte (Dart-Treffer, Chimes, Cheer) generiert via Web Audio API.
- **Smarte KI-Bots:** 4 konfigurierbare Darts-Bots (Rookie Rick bis Master Max) mit historisch realistischen Averages von 35 bis 95+.
- **PDC-Checkout-Guide:** Dynamische Restwert-Berechnung von 2 bis 170 mit Bogey-Erkennung und Spieler-Lieblingsdoppel.
- **Offline & Sicher:** Speicherung in lokaler IndexedDB mit automatischem Fallback, CSV-Export und PDC-Matchbericht zum Ausdrucken.

---

## 💻 Systemvoraussetzungen

- Jeder moderne Webbrowser:
  - **Google Chrome** / Chromium (ab Version 90)
  - **Mozilla Firefox** (ab Version 88)
  - **Apple Safari** / iOS Safari (ab iOS 14 / macOS Big Sur)
  - **Microsoft Edge** (ab Version 90)
- Keine Root-Rechte, keine Installation von Paketen zwingend erforderlich.

---

## 🚀 Installationsanleitung

Klone zunächst das Repository oder lade den Quellcode herunter:

```bash
git clone https://github.com/menckow/Darts.git
cd Darts
```

Wähle anschließend eine der folgenden Start-Methoden:

### Methode 1: Lokaler Webserver mit Python (Empfohlen)

Auf den meisten Systemen (macOS, Linux, viele Windows-Installationen) ist Python bereits vorhanden.

```bash
# Python 3
python3 -m http.server 8000
```

Öffne anschließend im Browser: **[http://localhost:8000](http://localhost:8000)**

---

### Methode 2: Mit Node.js (npx)

Falls du Node.js installiert hast, kannst du jeden beliebigen HTTP-Server ohne dauerhafte Installation starten:

```bash
npx serve .
# Oder:
npx http-server -p 8000
```

---

### Methode 3: Mit VS Code (Live Server)

1. Öffne den Projektordner `Darts` in Visual Studio Code.
2. Installiere die Erweiterung **Live Server** (von *Ritwick Dey*).
3. Klicke unten rechts in der Statusleiste auf **"Go Live"** oder mache einen Rechtsklick auf `index.html` $\rightarrow$ **"Open with Live Server"**.

---

### Methode 4: Mit Docker

Ein schneller Nginx-Container genügt:

```bash
docker run -d --name darts-app -p 8080:80 -v "$PWD":/usr/share/nginx/html:ro nginx:alpine
```

Die App ist sofort unter **[http://localhost:8080](http://localhost:8080)** erreichbar.

---

### Methode 5: Direktes Öffnen im Browser

Du kannst die Datei `index.html` auch per Doppelklick direkt im Browser öffnen (`file:///.../index.html`). 
> *Hinweis:* Für uneingeschränkten Zugriff auf Sprachansagen (Web Speech API) und ES6-Module wird das Starten über einen lokalen Webserver (Methode 1 bis 3) empfohlen.

---

## 📱 Nutzung am Wand-Tablet / Smart-TV (Kiosk-Modus)

Die Oberfläche ist responsiv gestaltet und skaliert automatisch für Wandhalterungen neben dem Dartboard:

1. **Vollbildmodus aktivieren:**
   - Klicke im Menü oben rechts auf das Vollbild-Symbol oder drücke `F11`.
2. **iPad / iPhone (Safari):**
   - Rufe die URL auf, tippe auf den *Teilen*-Button $\rightarrow$ **"Zum Home-Bildschirm"**. Die App startet nun ohne Browser-Adressleiste wie eine native App.
3. **Android (Chrome):**
   - Öffne das Menü (drei Punkte) $\rightarrow$ **"App installieren"** bzw. **"Zum Startbildschirm hinzufügen"**.

---

## 🎯 Bedienung & Eingabemodi

### Eingabemethoden

1. **Dartboard-Modus (Dart-für-Dart):**
   - Klicke oder tippe direkt auf das interaktive SVG-Dartboard.
   - Die App erkennt automatisch Einzelfelder (Single), Doppel (Double), Dreifach (Triple), Bullseye (50) und Outer Bull (25).
   - Die genauen Wurfkoordinaten werden für die spätere Wurf-Heatmap mitprotokolliert.
2. **Summen-Modus (3-Dart-Score):**
   - Für Spieler, die den Score ihrer 3 Darts (z. B. `60`, `100`, `140`, `180`) direkt eingeben möchten.
   - Nutze den On-Screen-Ziffernblock oder die PC-Tastatur / Numpad.
   - Drücke `Enter` oder klicke auf **↵ Bestätigen**. Eine leere Eingabe oder `0` wird als Fehlwurf (0 Punkte) gewertet.

### Tastatur-Kürzel

| Taste / Kürzel | Funktion |
| :--- | :--- |
| `0` bis `9` / Numpad | Punkteeingabe (schaltet im X01 automatisch auf Summenmodus) |
| `Enter` / `NumpadEnter` | Punktestand abschicken & Spielerwechsel |
| `Leertaste` | Umschalten zwischen Dartboard-Klick und Summen-Eingabemodus |
| `Backspace` | Letzte eingegebene Ziffer löschen |
| `Strg + Z` / `Cmd + Z` | Letzten Wurf rückgängig machen (Undo) |
| `Strg + Y` / `Cmd + Y` | Rückgängig gemachten Wurf wiederherstellen (Redo) |
| `Escape` | Offene Dialoge / Modals schließen |
| `F11` | Vollbildmodus an-/ausschalten |

---

## 🔍 Detaillierte Features

### 1. Umfassende Spielmodi
- **X01 (301, 501, 701, 901):**
  - Flexible Spielregeln: Straight In, Double In, Master In / Straight Out, Double Out, Master Out.
  - Legs & Sets Matchformat.
  - Dynamischer Checkout-Ratgeber für alle Restwerte bis 170.
- **Cricket & Cut-Throat:**
  - Segmente 15–20 und Bull mit interaktiver Treffermatrix (`/`, `X`, `⦻`).
  - Cut-Throat-Modus für 3+ Spieler (Strafpunkte gehen an Mitspieler).
  - Berechnung der Marks per Round (MPR).
- **Around the Clock (ATTC):**
  - Zielreihenfolge 1 bis 20 und Bull.
  - Spielbar als ANY, Double-Only oder Triple-Only mit Überspring-Bonus bei Mehrfachtreffern.
- **Bob’s 27:**
  - Offizielles Doppel-Training von D1 bis D20 + Bullseye.
  - Standardmodus (Ausscheiden bei < 0 Punkten) oder Trainingsmodus.
- **Shanghai:**
  - Zielsegmente 1–7, 10–15, 15–20 oder 1–20 mit sofortigem Shanghai-Sieg bei Treffer von Single, Double und Triple in einer Runde.

### 2. Scolia-Style Statistiken & Heatmaps
- **Density Cloud (Streuungswolke):** Gaußsche Dichte-Heatmap über das gesamte Board basierend auf Wurfkoordinaten.
- **Segment-Choroplethe:** Farbkodierte Trefferquote pro Segment und Ring.
- **Head-to-Head & Leistungsdaten:** 3-Dart Average, First-9 Average, Doppelquote (Checkout %), 180er / 140+ / 100+ Zähler und Bestleistungen.

### 3. Audio Caller & Soundeffekte
- Realistische Schiedsrichter-Sprachausgabe (Englisch/Deutsch) über die Browser-eigene Speech API.
- Einstellbare Lautstärke, Caller-Auswahl und individuelle Walk-On Sounds pro Spielerprofil.

### 4. KI-Bot Gegner
Vier Schwierigkeitsstufen für das Einzeltraining:
- 🟢 **Rookie Rick** (Avg ~35)
- 🟡 **Casual Chris** (Avg ~50)
- 🟠 **Pro Pete** (Avg ~70)
- 🔴 **Master Max** (Avg ~95+)

### 5. Export & Druckberichte
- **CSV-Export:** Download von `matches.csv` und `darts.csv` für eigene Analysen in Excel oder Google Sheets.
- **PDF-Matchbericht:** PDC-formatierter Spielberichtsbogen zum Ausdrucken oder Abspeichern als PDF.
- **Backup & Restore:** Vollständige Datensicherung aller Profile und Spiele in eine JSON-Datei.

---

## 📁 Projektstruktur

```text
Darts/
├── index.html              # Scoreboard, Oche-UI, Modals & Print-Report
├── css/
│   └── style.css           # Styling, Themes, Responsivität & Print-CSS
├── js/
│   ├── engine/
│   │   ├── darts-math.js   # Checkout-Tabellen, Segment-Geometrie & Bot-Logik
│   │   ├── game-state.js   # X01 Game-Engine, Undo/Redo & State-Management
│   │   ├── cricket-engine.js # Cricket & Cut-Throat Engine
│   │   └── training-engines.js # Around the Clock, Bob's 27 & Shanghai
│   ├── storage/
│   │   ├── db.js           # Lokale IndexedDB-Persistenz & Fallback
│   │   └── exporter.js     # CSV-Export, JSON-Backup & PDF-Drucker
│   ├── audio/
│   │   └── caller.js       # Web Audio Synthesizer & Referee Voice Caller
│   └── ui/
│       ├── dartboard.js    # Interaktives SVG-Board & Koordinatenerfassung
│       ├── heatmap.js      # Hybrid Canvas/SVG Treffer-Heatmap
│       ├── profile-manager.js # Spielerprofile & Match-Konfiguration
│       ├── stats-dashboard.js # Statistiken, Head-to-Head & Verlauf
│       └── app.js          # Haupt-Controller & Tastatur-Event-Routing
└── README.md               # Dokumentation & Installationsanleitung
```

---

## ❓ Fehlerbehebung & FAQ

#### Die Sprachausgabe (Caller) ist stumm?
Moderne Browser blockieren automatische Audio-Wiedergabe vor der ersten Benutzerinteraktion. Klicke einmalig auf die Oberfläche oder stelle sicher, dass im Audio-Menü (Lautsprecher-Symbol) die Option *"Sprachausgabe aktiviert"* angewählt ist.

#### Werden meine Daten gelöscht, wenn ich den Browser schließe?
Nein, alle Daten werden in der clientseitigen IndexedDB deines Browsers dauerhaft gespeichert. Wenn du den Browser im **privaten / Incognito-Modus** nutzt, löscht der Browser den Speicher beim Schließen des Fensters. Nutze in diesem Fall regelmäßig den **JSON-Backup-Export**.

---

## 📄 Lizenz

Dieses Projekt ist für private und vereinsmäßige Darts-Nutzung frei verwendbar (Open Source).
Viel Spaß beim Training und *Good Darts!* 🎯

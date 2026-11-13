# 🎯 Darts Master Scoreboard & Game App

Eine moderne, wettkampftaugliche Darts-Scoreboard- und Spiel-Applikation. Entwickelt für den Einsatz am heimischen Dartboard (Smartphone, Tablet an der Wand, PC oder Smart-TV). 100% clientseitig ohne externe Abhängigkeiten oder Server-Zwang.

---

## ✨ Features

### 1. Umfassende Spielmodi
- **X01:** 301, 501, 701, 901 mit Straight/Double/Master In & Out, dynamischem Checkout-Guide (2–170) und Bogey-Erkennung.
- **Cricket & Cut-Throat:** Standard Cricket, Cut-Throat (Strafpunkte für Gegner bei 3+ Spielern) und No-Score mit MPR-Berechnung und `/`, `X`, `⦻` Segment-Matrix.
- **Around the Clock (ATTC):** Segmente 1 bis 20 + Bull, ANY-, Double-Only oder Triple-Only Modus mit Skip-Bonus (+2/+3).
- **Bob’s 27:** Offizielles Doppel-Training (D1–D20 + Bull) mit Standard-Eliminierung (<0) oder Practice-Modus ohne Ausscheiden.
- **Shanghai:** Zielbereiche 1–7, 10–15, 15–20+Bull oder 1–20 mit sofortigem Shanghai-Sieg (S+D+T in einer Aufnahme).

### 2. Spieler-Profile & Personalisierung
- **Persistente Spielerprofile:** Name, Avatar-Emoji, Badge-Farbe, bevorzugtes Checkout-Doppel (z. B. Tops, D16, Bull) und Handikap.
- **Eigene Walk-On Chimes:** Einstellbare Sounds und Chimes pro Spieler für Turniere und Aufnahmen.
- **Integrierte Darts-Bots:** 4 KI-Gegner (Rookie Rick, Casual Chris, Pro Pete, Master Max) mit realistischer Streuung und angepasstem Avg (35 bis 95+).

### 3. Statistiken, Head-to-Head & Heatmap
- **Head-to-Head Dashboard:** Direkter Vergleich zweier Spieler mit Siegesbilanz gesamt und pro Spielmodus, 3-Dart Average, Doppelquote (%) und Bestleistungen.
- **Interaktive Hybrid-Heatmap:**
  - *Gaußsche Streuungswolke (Density Cloud):* Berechnet aus echten Wurfkoordinaten bei Klicks auf das Board.
  - *Segment-Choroplethenkarte:* Farbliche Hitzekarte der Segmente 1–20, Doubles, Triples und Bull basierend auf relativer Trefferquote.
  - *Filter:* Nach Spieler, Spielmodus und Zeitraum.
- **Chronologische Match-Historie:** Vollständige Übersicht aller gespielten Partien mit Detailansicht.

### 4. All-in-One Export & Druckbericht
- **CSV-Export:** Download von `matches.csv` und `darts.csv` (Einzeltreffer mit Koordinaten, Multiplikatoren und Scores) für Excel und Sheets.
- **Druckfähiger PDF-Matchbericht:** Professionell formatierter PDC-Style Spielberichtsbogen via `window.print()` mit speziellem Print-CSS.
- **JSON Backup & Restore:** Vollständiges 1-Klick Backup aller Profile, Matches und Würfe inklusive Wiederherstellungsfunktion.

### 5. Speicher & Offline-Betrieb
- **Clientseitige IndexedDB:** Performante Speicherung zehntausender Würfe direkt im Browser ohne Server-Zwang, mit automatischem `localStorage`-Fallback.

---

## 🚀 Schnellstart

Die App benötigt keine Installation oder Build-Tools.

### Option 1: Über lokalen Web-Server starten (Empfohlen)

**Mit Python:**
```bash
python3 -m http.server 8080
```
Anschließend im Browser aufrufen: [http://localhost:8080](http://localhost:8080)

**Mit Node.js:**
```bash
npx serve .
```

### Option 2: Direkt im Browser öffnen
Doppelklicke einfach auf die Datei [index.html](file:///Users/u116558/Downloads/Dart/index.html) oder ziehe sie in ein Browser-Fenster.

---

## ⌨️ Tastatur-Kürzel

| Taste | Aktion |
| :--- | :--- |
| `Leertaste` | Eingabemodus umschalten (Dart-für-Dart $\leftrightarrow$ 3-Dart-Summe) |
| `Strg + Z` / `Cmd + Z` | Letzten Wurf rückgängig machen (Undo) |
| `Strg + Y` / `Cmd + Y` | Wurf wiederholen (Redo) |
| `0` bis `9` | Zifferneingabe im Summenmodus |
| `Enter` | Punktzahl im Summenmodus bestätigen |
| `Backspace` | Letzte Ziffer im Summenmodus löschen |
| `Escape` | Modals schließen / Eingabepuffer leeren |

---

## 📁 Projektstruktur

```
Dart/
├── index.html              # Hauptseite, Oche Scoreboard, Modals & Print-Report
├── css/
│   └── style.css           # Responsive Styles, Themes, H2H, Heatmap & Print-CSS
├── js/
│   ├── engine/
│   │   ├── darts-math.js   # Checkout-Tabellen, Board-Geometrie & Bot-Heuristiken
│   │   ├── game-state.js   # X01 Engine, Undo/Redo & Snapshot-Manager
│   │   ├── cricket-engine.js # Cricket, Cut-Throat & No-Score Engine
│   │   └── training-engines.js # Around the Clock, Bob's 27 & Shanghai Engines
│   ├── storage/
│   │   ├── db.js           # IndexedDB & LocalStorage Persistenz-Schicht
│   │   └── exporter.js     # CSV Export, JSON Backup/Restore & PDF Print-Report
│   ├── audio/
│   │   └── caller.js       # Web Audio API Synthesizer & Speech Referee Caller
│   └── ui/
│       ├── dartboard.js    # Interaktives SVG-Dartboard mit Koordinatenerfassung
│       ├── heatmap.js      # Hybrid Canvas/SVG Treffer-Heatmap
│       ├── profile-manager.js # Spieler-Profilverwaltung & Match-Setup Integration
│       ├── stats-dashboard.js # Head-to-Head & Match-Historie Dashboard
│       └── app.js          # Hauptanwendungs-Controller & Event-Router
└── README.md               # Dokumentation
```

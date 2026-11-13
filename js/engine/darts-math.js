/**
 * Darts Math & Checkout Engine
 * Enthält Checkout-Tabellen, Dartboard-Geometrie und Bot-Wurfbegründung.
 */

export const BOARD_SEGMENTS = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5
];

export const BOARD_SPECS = {
  bullRadius: 6.35,          // Bullseye Radius in mm
  outerBullRadius: 15.9,     // Outer Bull Radius in mm
  tripleInnerRadius: 97,     // Triple Innenkante mm
  tripleOuterRadius: 107,    // Triple Außenkante mm
  doubleInnerRadius: 160,    // Double Innenkante mm
  doubleOuterRadius: 170     // Double Außenkante mm
};

// Bogey-Zahlen (nicht checkbar mit 3 Darts im Double-Out)
export const BOGEY_NUMBERS = new Set([169, 168, 166, 165, 163, 162, 159]);

// Umfassende, wettkampferprobte Checkout-Tabelle (2 bis 170)
export const CHECKOUT_GUIDE = {
  170: ["T20", "T20", "BULL"],
  167: ["T20", "T20", "D19"],
  164: ["T20", "T20", "D18"],
  161: ["T20", "T17", "BULL"],
  160: ["T20", "T20", "D20"],
  158: ["T20", "T20", "D19"],
  157: ["T20", "T19", "D20"],
  156: ["T20", "T20", "D18"],
  155: ["T20", "T19", "D19"],
  154: ["T20", "T18", "D20"],
  153: ["T20", "T19", "D18"],
  152: ["T20", "T20", "D16"],
  151: ["T20", "T17", "D20"],
  150: ["T20", "T18", "D18"],
  149: ["T20", "T19", "D16"],
  148: ["T20", "T20", "D14"],
  147: ["T20", "T17", "D18"],
  146: ["T20", "T18", "D16"],
  145: ["T20", "T19", "D14"],
  144: ["T20", "T20", "D12"],
  143: ["T20", "T17", "D16"],
  142: ["T20", "T14", "D20"],
  141: ["T20", "T19", "D12"],
  140: ["T20", "T20", "D10"],
  139: ["T20", "T19", "D11"],
  138: ["T20", "T18", "D12"],
  137: ["T19", "T16", "D16"],
  136: ["T20", "T20", "D8"],
  135: ["T20", "T17", "D12"],
  134: ["T20", "T14", "D16"],
  133: ["T20", "T19", "D8"],
  132: ["T20", "T16", "D12"],
  131: ["T20", "T13", "D16"],
  130: ["T20", "T20", "D5"],
  129: ["T19", "T16", "D12"],
  128: ["T18", "T14", "D16"],
  127: ["T20", "T17", "D8"],
  126: ["T19", "T19", "D6"],
  125: ["25", "T20", "D20"],
  124: ["T20", "T16", "D8"],
  123: ["T19", "T16", "D9"],
  122: ["T18", "T20", "D4"],
  121: ["T20", "T11", "D14"],
  120: ["T20", "S20", "D20"],
  119: ["T19", "T12", "D13"],
  118: ["T20", "S18", "D20"],
  117: ["T20", "S17", "D20"],
  116: ["T20", "S16", "D20"],
  115: ["T20", "S15", "D20"],
  114: ["T20", "S14", "D20"],
  113: ["T19", "S16", "D20"],
  112: ["T20", "S20", "D16"],
  111: ["T20", "S19", "D16"],
  110: ["T20", "S18", "D16"],
  109: ["T19", "S20", "D16"],
  108: ["T20", "S16", "D16"],
  107: ["T19", "S18", "D16"],
  106: ["T20", "S14", "D16"],
  105: ["T20", "S13", "D16"],
  104: ["T20", "S12", "D16"],
  103: ["T19", "S14", "D16"],
  102: ["T20", "S10", "D16"],
  101: ["T17", "S18", "D16"],
  100: ["T20", "D20"],
  99: ["T19", "S10", "D16"],
  98: ["T20", "D19"],
  97: ["T19", "D20"],
  96: ["T20", "D18"],
  95: ["T19", "D19"],
  94: ["T18", "D20"],
  93: ["T19", "D18"],
  92: ["T20", "D16"],
  91: ["T17", "D20"],
  90: ["T18", "D18"],
  89: ["T19", "D16"],
  88: ["T16", "D20"],
  87: ["T17", "D18"],
  86: ["T18", "D16"],
  85: ["T15", "D20"],
  84: ["T16", "D18"],
  83: ["T17", "D16"],
  82: ["T14", "D20"],
  81: ["T15", "D18"],
  80: ["T20", "D10"],
  79: ["T13", "D20"],
  78: ["T18", "D12"],
  77: ["T15", "D16"],
  76: ["T20", "D8"],
  75: ["T17", "D12"],
  74: ["T14", "D16"],
  73: ["T19", "D8"],
  72: ["T16", "D12"],
  71: ["T13", "D16"],
  70: ["T18", "D8"],
  69: ["T15", "D12"],
  68: ["T20", "D4"],
  67: ["T17", "D8"],
  66: ["T10", "D18"],
  65: ["T19", "D4"],
  64: ["T16", "D8"],
  63: ["T13", "D12"],
  62: ["T10", "D16"],
  61: ["T15", "D8"],
  60: ["S20", "D20"],
  59: ["S19", "D20"],
  58: ["S18", "D20"],
  57: ["S17", "D20"],
  56: ["S16", "D20"],
  55: ["S15", "D20"],
  54: ["S14", "D20"],
  53: ["S13", "D20"],
  52: ["S12", "D20"],
  51: ["S19", "D16"],
  50: ["BULL"],
  49: ["S17", "D16"],
  48: ["S16", "D16"],
  47: ["S15", "D16"],
  46: ["S14", "D16"],
  45: ["S13", "D16"],
  44: ["S12", "D16"],
  43: ["S11", "D16"],
  42: ["S10", "D16"],
  41: ["S9", "D16"],
  40: ["D20"],
  39: ["S7", "D16"],
  38: ["D19"],
  37: ["S5", "D16"],
  36: ["D18"],
  35: ["S3", "D16"],
  34: ["D17"],
  33: ["S1", "D16"],
  32: ["D16"],
  31: ["S15", "D8"],
  30: ["D15"],
  29: ["S13", "D8"],
  28: ["D14"],
  27: ["S11", "D8"],
  26: ["D13"],
  25: ["S9", "D8"],
  24: ["D12"],
  23: ["S7", "D8"],
  22: ["D11"],
  21: ["S5", "D8"],
  20: ["D10"],
  19: ["S3", "D8"],
  18: ["D9"],
  17: ["S1", "D8"],
  16: ["D8"],
  15: ["S7", "D4"],
  14: ["D7"],
  13: ["S5", "D4"],
  12: ["D6"],
  11: ["S3", "D4"],
  10: ["D5"],
  9: ["S1", "D4"],
  8: ["D4"],
  7: ["S3", "D2"],
  6: ["D3"],
  5: ["S1", "D2"],
  4: ["D2"],
  3: ["S1", "D1"],
  2: ["D1"]
};

/**
 * Wandelt Textkennung (z. B. "T20", "D16", "S20", "25", "BULL", "0")
 * in ein Wurfobjekt um: { score, multiplier, value, label, isDouble, isTriple }
 */
export function parseSegment(segmentStr) {
  if (!segmentStr || segmentStr === '0' || segmentStr === 'MISS') {
    return { score: 0, multiplier: 0, value: 0, label: 'MISS', isDouble: false, isTriple: false };
  }
  const s = String(segmentStr).trim().toUpperCase();

  if (s === 'BULL' || s === 'D25') {
    return { score: 50, multiplier: 2, value: 25, label: 'BULL', isDouble: true, isTriple: false };
  }
  if (s === '25' || s === 'S25') {
    return { score: 25, multiplier: 1, value: 25, label: '25', isDouble: false, isTriple: false };
  }

  const prefix = s.charAt(0);
  if (prefix === 'D') {
    const val = parseInt(s.substring(1), 10);
    return { score: val * 2, multiplier: 2, value: val, label: `D${val}`, isDouble: true, isTriple: false };
  }
  if (prefix === 'T') {
    const val = parseInt(s.substring(1), 10);
    return { score: val * 3, multiplier: 3, value: val, label: `T${val}`, isDouble: false, isTriple: true };
  }
  if (prefix === 'S') {
    const val = parseInt(s.substring(1), 10);
    return { score: val, multiplier: 1, value: val, label: `S${val}`, isDouble: false, isTriple: false };
  }

  const numeric = parseInt(s, 10);
  if (!isNaN(numeric)) {
    return { score: numeric, multiplier: 1, value: numeric, label: `${numeric}`, isDouble: false, isTriple: false };
  }

  return { score: 0, multiplier: 0, value: 0, label: 'MISS', isDouble: false, isTriple: false };
}

/**
 * Ermittelt den besten Checkout-Weg für die verbleibende Punktzahl und Darts.
 */
export function getCheckoutRecommendation(remainingScore, dartsLeft = 3, outRule = 'DOUBLE') {
  if (remainingScore <= 1) return null;
  if (outRule === 'STRAIGHT') {
    if (remainingScore <= 60 && remainingScore % 3 === 0 && remainingScore / 3 <= 20) {
      return [`T${remainingScore / 3}`];
    }
    if (remainingScore <= 40 && remainingScore % 2 === 0) {
      return [`D${remainingScore / 2}`];
    }
    if (remainingScore <= 20) return [`S${remainingScore}`];
  }

  if (remainingScore > 170 || BOGEY_NUMBERS.has(remainingScore)) {
    // Setup Wurfempfehlung
    if (remainingScore > 170) {
      return ['T20', 'T20', 'T20'];
    }
    // Bogey: hinterlässt gutes Finish
    return ['T20', '...'];
  }

  const guide = CHECKOUT_GUIDE[remainingScore];
  if (!guide) return null;

  if (guide.length <= dartsLeft) {
    return guide;
  }
  return null;
}

/**
 * Simuliert einen Dart-Wurf für einen Bot mit einem Ziel-Average.
 * Verwendet polar-geometrische Dartboard-Koordinaten und Normalverteilung.
 */
export function simulateBotThrow(currentScore, dartsLeftInTurn, botAverage = 60, outRule = 'DOUBLE') {
  // Zielsegment bestimmen
  let target = 'T20';

  if (currentScore <= 170) {
    const rec = getCheckoutRecommendation(currentScore, dartsLeftInTurn, outRule);
    if (rec && rec.length > 0) {
      target = rec[0];
    } else if (currentScore <= 40 && currentScore % 2 === 0) {
      target = `D${currentScore / 2}`;
    } else if (currentScore === 50) {
      target = 'BULL';
    } else if (currentScore < 100) {
      // Setup-Wurf: z. B. auf Single werfen, um gerades Doppel zu stellen
      if (currentScore % 2 !== 0) {
        // ungerade: wirf auf kleine ungerade Zahl
        target = `S${currentScore > 60 ? 19 : 7}`;
      } else {
        target = 'S16';
      }
    }
  } else if (currentScore >= 180) {
    target = 'T20';
  }

  // Treffergenauigkeit basierend auf botAverage berechnen
  // Average 30: ~15% Triple, viel Streuung
  // Average 60: ~35% Triple, 30% Single Nachbar
  // Average 90: ~60% Triple, hohe Doppelquote
  const avgFactor = Math.min(Math.max((botAverage - 20) / 90, 0.1), 0.98);
  const rand = Math.random();

  const parsedTarget = parseSegment(target);

  if (parsedTarget.isDouble) {
    // Doppel-Versuch
    const hitRate = 0.15 + avgFactor * 0.45; // 19% bis 59%
    if (rand < hitRate) {
      return parsedTarget;
    } else if (rand < hitRate + 0.30) {
      // Innen getroffen -> Single!
      return parseSegment(parsedTarget.value === 25 ? '25' : `S${parsedTarget.value}`);
    } else {
      // Draußen vorbei -> Miss
      return parseSegment('0');
    }
  }

  if (parsedTarget.isTriple) {
    const hitRate = 0.10 + avgFactor * 0.50; // 15% bis 59%
    if (rand < hitRate) {
      return parsedTarget;
    } else if (rand < hitRate + 0.45) {
      // Single des gleichen Segments
      return parseSegment(`S${parsedTarget.value}`);
    } else if (rand < hitRate + 0.75) {
      // Nachbarfeld Single (z.B. bei T20: 1 oder 5)
      const neighbors = getSegmentNeighbors(parsedTarget.value);
      const neighbor = Math.random() < 0.5 ? neighbors[0] : neighbors[1];
      return parseSegment(`S${neighbor}`);
    } else {
      // Abgerutscht
      return parseSegment('0');
    }
  }

  // Single Wurf
  const singleHitRate = 0.50 + avgFactor * 0.45;
  if (rand < singleHitRate) {
    return parsedTarget;
  } else {
    const neighbors = getSegmentNeighbors(parsedTarget.value);
    const neighbor = Math.random() < 0.5 ? neighbors[0] : neighbors[1];
    return parseSegment(`S${neighbor}`);
  }
}

/**
 * Universeller Wurf-Simulator auf ein beliebiges Zielsegment.
 */
export function simulateGenericThrow(targetStr, botAverage = 60) {
  const avgFactor = Math.min(Math.max((botAverage - 20) / 90, 0.1), 0.98);
  const rand = Math.random();
  const parsedTarget = parseSegment(targetStr);

  if (parsedTarget.label === 'BULL') {
    const bullHit = 0.10 + avgFactor * 0.35;
    const outerBullHit = 0.30 + avgFactor * 0.30;
    if (rand < bullHit) return parseSegment('BULL');
    if (rand < bullHit + outerBullHit) return parseSegment('25');
    // Abgerutscht in Single 1..20
    const randomSeg = BOARD_SEGMENTS[Math.floor(Math.random() * BOARD_SEGMENTS.length)];
    return parseSegment(`S${randomSeg}`);
  }

  if (parsedTarget.label === '25') {
    const outerBullHit = 0.35 + avgFactor * 0.40;
    if (rand < outerBullHit) return parseSegment('25');
    if (rand < outerBullHit + 0.10) return parseSegment('BULL');
    const randomSeg = BOARD_SEGMENTS[Math.floor(Math.random() * BOARD_SEGMENTS.length)];
    return parseSegment(`S${randomSeg}`);
  }

  if (parsedTarget.isDouble) {
    const hitRate = 0.15 + avgFactor * 0.45;
    if (rand < hitRate) return parsedTarget;
    if (rand < hitRate + 0.35) return parseSegment(`S${parsedTarget.value}`);
    return parseSegment('0');
  }

  if (parsedTarget.isTriple) {
    const hitRate = 0.12 + avgFactor * 0.48;
    if (rand < hitRate) return parsedTarget;
    if (rand < hitRate + 0.45) return parseSegment(`S${parsedTarget.value}`);
    const neighbors = getSegmentNeighbors(parsedTarget.value);
    const neighbor = Math.random() < 0.5 ? neighbors[0] : neighbors[1];
    return parseSegment(`S${neighbor}`);
  }

  // Single Ziel
  const singleHitRate = 0.55 + avgFactor * 0.40;
  if (rand < singleHitRate) return parsedTarget;
  const neighbors = getSegmentNeighbors(parsedTarget.value);
  const neighbor = Math.random() < 0.5 ? neighbors[0] : neighbors[1];
  return parseSegment(`S${neighbor}`);
}

/**
 * Simuliert einen Cricket-Wurf für die Bot-KI
 */
export function simulateCricketBotThrow(botPlayer, allPlayers, botAverage = 60, isCutThroat = false) {
  const cricketNumbers = [20, 19, 18, 17, 16, 15, 'BULL'];

  // Ziel-Heuristik:
  // 1. Höchste offene Zahl des Bots finden
  // 2. Prüfen, ob Gegner führen oder offene Zahlen punkten können
  let target = 'T20';

  for (const seg of cricketNumbers) {
    const botMarks = botPlayer.cricketMarks[seg] || 0;
    const isClosedByBot = botMarks >= 3;

    // Prüfen, ob alle Gegner diese Zahl geschlossen haben
    const allOpponentsClosed = allPlayers
      .filter(p => p.id !== botPlayer.id)
      .every(p => (p.cricketMarks[seg] || 0) >= 3);

    if (!isClosedByBot) {
      // Wenn noch nicht geschlossen: Priorisiere diese Zahl
      target = seg === 'BULL' ? 'BULL' : `T${seg}`;
      break;
    } else if (!allOpponentsClosed) {
      // Zahl ist geschlossen, Gegner haben sie aber noch offen -> Punkte sammeln!
      target = seg === 'BULL' ? 'BULL' : `T${seg}`;
      break;
    }
  }

  return simulateGenericThrow(target, botAverage);
}

/**
 * Simuliert einen Wurf für Around The Clock
 */
export function simulateAroundTheClockBotThrow(targetNum, variant = 'ANY', allowSkip = true, botAverage = 60) {
  let target = `S${targetNum}`;
  if (targetNum === 'BULL' || targetNum === 25) {
    target = 'BULL';
  } else if (variant === 'DOUBLE_ONLY') {
    target = `D${targetNum}`;
  } else if (variant === 'TRIPLE_ONLY') {
    target = `T${targetNum}`;
  } else if (allowSkip) {
    // Bei Skip-Bonus versucht ein guter Bot auf Triple zu zielen
    target = botAverage >= 65 ? `T${targetNum}` : `S${targetNum}`;
  }

  return simulateGenericThrow(target, botAverage);
}

/**
 * Simuliert einen Wurf für Bob's 27 (Zielt immer auf das Doppel der Runde)
 */
export function simulateBobs27BotThrow(roundNumber, botAverage = 60) {
  const target = roundNumber === 21 ? 'BULL' : `D${roundNumber}`;
  return simulateGenericThrow(target, botAverage);
}

/**
 * Simuliert einen Wurf für Shanghai
 */
export function simulateShanghaiBotThrow(targetNum, currentTurnDarts = [], botAverage = 60) {
  // Prüfen, was in dieser Runde schon geworfen wurde
  const hasSingle = currentTurnDarts.some(d => d.value === targetNum && d.multiplier === 1);
  const hasDouble = currentTurnDarts.some(d => d.value === targetNum && d.multiplier === 2);
  const hasTriple = currentTurnDarts.some(d => d.value === targetNum && d.multiplier === 3);

  let target = `T${targetNum}`;
  if (!hasSingle && (hasDouble || hasTriple)) {
    target = `S${targetNum}`;
  } else if (!hasDouble && (hasSingle || hasTriple)) {
    target = `D${targetNum}`;
  } else if (!hasTriple) {
    target = `T${targetNum}`;
  }

  return simulateGenericThrow(target, botAverage);
}

export function getSegmentNeighbors(segmentNum) {
  const idx = BOARD_SEGMENTS.indexOf(segmentNum);
  if (idx === -1) return [1, 5];
  const left = BOARD_SEGMENTS[(idx - 1 + BOARD_SEGMENTS.length) % BOARD_SEGMENTS.length];
  const right = BOARD_SEGMENTS[(idx + 1) % BOARD_SEGMENTS.length];
  return [left, right];
}

'use strict';

const crypto = require('crypto');

/**
 * ARCHETYPES FOR BOT OPPONENTS
 */
const ARCHETYPES = Object.freeze({
  SPRINTER: 'SPRINTER',
  METHODICAL_SCHOLAR: 'METHODICAL_SCHOLAR',
  MOMENTUM_PLAYER: 'MOMENTUM_PLAYER',
  ADAPTIVE_RIVAL: 'ADAPTIVE_RIVAL'
});

const FIRST_NAMES = Object.freeze([
  'Rohit', 'Priya', 'Neha', 'Arjun', 'Kavya', 'Ishaan',
  'Meera', 'Aditya', 'Ananya', 'Vikram', 'Sana', 'Aarav',
  'Rohan', 'Divya', 'Siddharth', 'Tanvi', 'Varun', 'Pooja',
  'Kunal', 'Ritu', 'Manish', 'Shreya', 'Abhishek', 'Sneha'
]);

const GENERAL_SUFFIXES = Object.freeze([
  'RankClimber', 'ConceptLab', 'ExamSprint', 'LogicCore', 'StudyStack', 'QuizMaster'
]);

const SUBJECT_SUFFIXES = Object.freeze({
  CIVIL: ['Structures', 'CivilCore', 'GATE_CE', 'IITD', 'Geotech', 'Hydraulics', 'Surveyor'],
  STRUCTURES: ['Structures', 'BeamTheory', 'CivilCore', 'IITD', 'GATE_CE'],
  SOM: ['Mechanics', 'StressMind', 'CivilCore', 'StrengthCore'],
  RCC: ['DesignCore', 'Structures', 'CivilCore', 'IS456'],
  GEOTECH: ['SoilLab', 'Geotech', 'FoundationCore', 'Earthworks'],
  FLUID: ['FluidDynamics', 'Hydraulics', 'FlowCore'],
  HIGHWAY: ['PavementCore', 'TrafficLab', 'HighwayEng'],
  ENVIRONMENTAL: ['EnvLab', 'EcoCore', 'WasteWater'],
  SURVEYING: ['Surveyor', 'Geomatics', 'LevelCore'],
  MECHANICAL: ['Thermo', 'MechCore', 'GATE_ME', 'Dynamics', 'TurboLab'],
  ELECTRICAL: ['CircuitLab', 'GATE_EE', 'PowerGrid', 'SignalCore'],
  ELECTRONICS: ['VLSI', 'GATE_ECE', 'SignalCore', 'CircuitLab'],
  COMPUTER: ['CyberKavach', 'CodeStack', 'GATE_CSE', 'AlgoCore', 'Runtime'],
  PROGRAMMING: ['CyberKavach', 'CodeStack', 'AlgoCore', 'Runtime'],
  MATHEMATICS: ['MathForge', 'Calculus', 'NumberLab', 'AIR_Top'],
  PHYSICS: ['QuantumCore', 'PhysicsLab', 'Mechanics', 'VectorMind'],
  CHEMISTRY: ['ChemCore', 'ReactionLab', 'MoleculeMind', 'Catalyst'],
  GS: ['CivilServices', 'CurrentAffairs', 'GeneralMind', 'Aspirant']
});

const TITLES = Object.freeze({
  SPRINTER: ['Speed Scholar', 'Rapid Solver', 'Quick Thinker', 'Fast Tracker'],
  METHODICAL_SCHOLAR: ['Concept Master', 'The Analyst', 'Deep Thinker', 'Calculated Mind'],
  MOMENTUM_PLAYER: ['Streak Chaser', 'Comeback Kid', 'Momentum Maker', 'Flow State'],
  ADAPTIVE_RIVAL: ['Ranked Rival', 'Battle Scholar', 'Precision Player', 'Contender']
});

// Helper utilities
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Box-Muller transform for standard normal distribution
function normalRandom(mean = 0, stdDev = 1) {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  const standardNormal = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return mean + standardNormal * stdDev;
}

function normalizeSubjectKey(subjectStr) {
  const norm = String(subjectStr || 'GENERAL').trim().toUpperCase();
  for (const key of Object.keys(SUBJECT_SUFFIXES)) {
    if (norm.includes(key)) return key;
  }
  return null;
}

function countFormulaComplexity(text) {
  const source = String(text || '');
  const mathTokens = source.match(/\\frac|\\sqrt|\\sum|\\int|\\sigma|\\theta|\\tau|\\lambda|\\mu|\\delta|\\partial|\\times|\\pi|\\Delta|\\alpha|\\beta|\^|_/g) || [];
  const mathDelimiters = source.match(/\$|\\\(|\\\)|\\\[|\\\]/g) || [];
  return mathTokens.length * 2 + mathDelimiters.length;
}

function extractNumericValue(str) {
  const clean = String(str || '').replace(/,/g, '');
  const match = clean.match(/[-+]?\d*\.?\d+(?:e[-+]?\d+)?/i);
  if (!match) return null;
  const num = Number(match[0]);
  return Number.isFinite(num) ? num : null;
}

class BotEngine {
  /**
   * Generates an authentic, subject-relevant student persona for bot matches.
   * Calibrates bot ELO to match the player's current ELO within a natural Gaussian offset.
   */
  generateBotProfile(playerUser = {}, subject = 'General', category = 'tech') {
    const playerElo = Number(playerUser.eloRating || playerUser.elo || 1200);
    const archetypes = Object.values(ARCHETYPES);
    const archetype = pickRandom(archetypes);

    const subjectKey = normalizeSubjectKey(subject);
    const suffixPool = subjectKey ? SUBJECT_SUFFIXES[subjectKey] : (category === 'gs' ? SUBJECT_SUFFIXES.GS : GENERAL_SUFFIXES);

    const firstName = pickRandom(FIRST_NAMES);
    const suffix = pickRandom(suffixPool);
    const botUsername = suffix === 'CyberKavach' ? suffix : `${firstName}_${suffix}`;

    // Gaussian ELO offset around player's rating (+/- 10 to 50 ELO)
    const direction = Math.random() < 0.5 ? -1 : 1;
    const offset = clamp(Math.abs(normalRandom(25, 12)), 5, 55);
    const botElo = Math.round(clamp(playerElo + direction * offset, 800, 3200));

    // Dynamic Dicebear / avatar seed
    const seedHash = crypto.createHash('md5').update(`${botUsername}:${botElo}:${Date.now()}`).digest('hex').substring(0, 10);
    const avatarSeed = `bot-${firstName.toLowerCase()}-${seedHash}`;
    const title = pickRandom(TITLES[archetype]);

    return {
      username: botUsername,
      avatarSeed,
      title,
      eloRating: botElo,
      archetype,
      isBot: true
    };
  }

  /**
   * Calculates realistic human cognitive delay based on:
   * 1. Word reading speed (WPM)
   * 2. LaTeX formula complexity
   * 3. Multiple-choice option lengths
   * 4. Archetype-specific processing time
   * 5. Emotional state (streak momentum vs mistake hesitation)
   */
  calculateCognitiveDelay(question, archetype, streak = 0, lastAnswerCorrect = null, secondsPerQ = 20) {
    const text = String(question.questionText || question.text || question.question || '');
    const optionsObj = question.options || {};
    const optionTexts = typeof optionsObj === 'object' ? Object.values(optionsObj) : [];

    // 1. Reading Time: average student reads 220 - 270 WPM
    const wordCount = (text.match(/\S+/g) || []).length;
    const wpm = randomBetween(220, 270);
    const readingMs = (wordCount / wpm) * 60000;

    // 2. LaTeX / Equation Cognitive Overhead
    const formulaComplexity = countFormulaComplexity(text);
    const formulaMs = formulaComplexity > 0 ? randomBetween(1200, Math.min(3000, 1500 + formulaComplexity * 150)) : 0;

    // 3. Option Scanning Time
    const totalOptionLength = optionTexts.reduce((acc, opt) => acc + String(opt || '').length, 0);
    const optionScanningMs = clamp(totalOptionLength * 10, 300, 2000);

    // 4. Archetype Core Processing Delay
    let processingMs = 0;
    switch (archetype) {
      case ARCHETYPES.SPRINTER:
        processingMs = randomBetween(600, 1600);
        break;

      case ARCHETYPES.METHODICAL_SCHOLAR:
        processingMs = randomBetween(4500, 8500);
        break;

      case ARCHETYPES.MOMENTUM_PLAYER:
        if (streak >= 2) {
          // Flow state: answers faster on a streak
          processingMs = randomBetween(1000, 2500);
        } else if (lastAnswerCorrect === false) {
          // Hesitation after a wrong answer
          processingMs = randomBetween(4000, 7000);
        } else {
          processingMs = randomBetween(2500, 5000);
        }
        break;

      case ARCHETYPES.ADAPTIVE_RIVAL:
      default:
        processingMs = randomBetween(2200, 5200);
        break;
    }

    // 5. Gaussian natural noise (+/- 350ms)
    const noiseMs = normalRandom(0, 350);

    let totalDelayMs = readingMs + formulaMs + optionScanningMs + processingMs + noiseMs;

    // Apply Archetype boundary clamps
    if (archetype === ARCHETYPES.SPRINTER) {
      totalDelayMs = clamp(totalDelayMs, 2500, 5500);
    } else if (archetype === ARCHETYPES.METHODICAL_SCHOLAR) {
      totalDelayMs = clamp(totalDelayMs, 7000, 13000);
    } else {
      totalDelayMs = clamp(totalDelayMs, 2500, 15000);
    }

    // Ensure within match bounds (at least 2.2s, max `secondsPerQ - 2`s)
    const maxAllowedMs = Math.max(2500, (secondsPerQ - 2) * 1000);
    return Math.round(clamp(totalDelayMs, 2200, maxAllowedMs));
  }

  /**
   * Evaluates question correctness and selects the chosen option.
   * If answering incorrectly, selects a plausible distractor instead of uniform random.
   */
  determineBotAction({ question, botPlayer, humanPlayer, roundIndex = 0, totalRounds = 5, secondsPerQ = 20 }) {
    const archetype = botPlayer?.archetype || ARCHETYPES.ADAPTIVE_RIVAL;
    const streak = botPlayer?.currentStreak || 0;
    const lastAnswerCorrect = botPlayer?.answers && botPlayer.answers.length > 0
      ? botPlayer.answers[botPlayer.answers.length - 1]?.isCorrect
      : null;

    const correctOptionLetter = String(question.correctOption || 'A').trim().toUpperCase();
    const formulaComplexity = countFormulaComplexity(question.questionText || question.text || '');
    const isHard = formulaComplexity >= 4 || (question.questionText && question.questionText.length > 180);

    // Calculate base accuracy per archetype
    let accuracy = 0.75;
    switch (archetype) {
      case ARCHETYPES.SPRINTER:
        // Sprinter rushes on hard formula questions
        accuracy = isHard ? 0.52 : 0.84;
        break;

      case ARCHETYPES.METHODICAL_SCHOLAR:
        accuracy = isHard ? 0.86 : 0.92;
        break;

      case ARCHETYPES.MOMENTUM_PLAYER:
        if (streak >= 2) {
          accuracy = 0.90;
        } else if (lastAnswerCorrect === false) {
          accuracy = 0.62;
        } else {
          accuracy = 0.78;
        }
        break;

      case ARCHETYPES.ADAPTIVE_RIVAL:
      default: {
        accuracy = isHard ? 0.70 : 0.82;
        const botScore = Number(botPlayer?.score || 0);
        const humanScore = Number(humanPlayer?.score || 0);
        const scoreMargin = botScore - humanScore;

        // Dynamic Difficulty Adjustment (DDA) - Keep it competitive & dramatic
        if (scoreMargin <= -150) {
          accuracy += 0.15; // Bot trails significantly -> rally
        } else if (scoreMargin <= -75) {
          accuracy += 0.08;
        } else if (scoreMargin >= 150) {
          accuracy -= 0.16; // Bot leads heavily -> give breathing room
        } else if (scoreMargin >= 75) {
          accuracy -= 0.08;
        }

        // On Final Question (Round 5), slight accuracy boost for clutch tension
        if (roundIndex === totalRounds - 1 && scoreMargin < 0) {
          accuracy += 0.06;
        }
        break;
      }
    }

    accuracy = clamp(accuracy, 0.25, 0.96);
    const isCorrect = Math.random() < accuracy;

    // Option Selection
    let selectedOption;
    if (isCorrect) {
      selectedOption = correctOptionLetter;
    } else {
      selectedOption = this._selectPlausibleDistractor(question, correctOptionLetter);
    }

    // Latency Calculation
    let thinkingTime = this.calculateCognitiveDelay(question, archetype, streak, lastAnswerCorrect, secondsPerQ);

    // Occasional In-Game Reactive Emotes
    let emote = null;
    if (isHard && Math.random() < 0.25) {
      emote = '🤔';
    } else if (streak >= 2 && isCorrect && Math.random() < 0.35) {
      emote = '🔥';
    } else if (roundIndex === totalRounds - 1 && Math.random() < 0.30) {
      emote = '⚡';
    }

    return {
      thinkingTime,
      isCorrect,
      selectedOption,
      accuracy,
      emote
    };
  }

  /**
   * Intelligently selects the most plausible wrong distractor.
   * If options are numerical, picks the closest value.
   * If options are text, picks the most plausible length/keyword match.
   */
  _selectPlausibleDistractor(question, correctOptionLetter) {
    const validLetters = ['A', 'B', 'C', 'D'];
    const wrongLetters = validLetters.filter(letter => letter !== correctOptionLetter);

    const optionsObj = question.options || {};
    // Extract option text map: { A: '...', B: '...', C: '...', D: '...' }
    const optionMap = {};
    if (typeof optionsObj === 'object') {
      for (const [key, val] of Object.entries(optionsObj)) {
        optionMap[key.toUpperCase()] = String(val || '');
      }
    }

    const correctText = optionMap[correctOptionLetter] || '';
    const correctNumeric = extractNumericValue(correctText);

    // If numeric options, choose the closest numerical distractor
    if (correctNumeric !== null) {
      const candidates = wrongLetters.map(letter => {
        const text = optionMap[letter] || '';
        const num = extractNumericValue(text);
        if (num === null) return { letter, distance: Infinity };
        const scale = Math.max(1, Math.abs(correctNumeric));
        const distance = Math.abs(num - correctNumeric) / scale;
        return { letter, distance };
      });

      candidates.sort((a, b) => a.distance - b.distance);
      if (candidates[0].distance < Infinity) {
        // 70% chance pick the closest mathematical distractor, 30% pick second closest
        return (Math.random() < 0.70 || candidates.length < 2)
          ? candidates[0].letter
          : candidates[1].letter;
      }
    }

    // Fallback: Pick random wrong option
    return pickRandom(wrongLetters);
  }
}

const botEngine = new BotEngine();

module.exports = {
  BotEngine,
  botEngine,
  ARCHETYPES
};

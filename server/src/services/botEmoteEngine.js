'use strict';

const DEFAULT_GLOBAL_COOLDOWN_MS = 3500;
const MAX_BOT_EMOTES_PER_ROUND = 2;

function randomBetween(min, max) {
  return Math.floor(min + Math.random() * (max - min + 1));
}

function weightedPick(variants) {
  const total = variants.reduce((sum, v) => sum + v.weight, 0);
  let cursor = Math.random() * total;
  for (const v of variants) {
    cursor -= v.weight;
    if (cursor <= 0) return v.emoji;
  }
  return variants[variants.length - 1].emoji;
}

function isHeavyFormulaQuestion(question = {}) {
  const text = String(question.questionText || question.text || question.question || '');
  const latexCommands = text.match(/\\(?:frac|sqrt|sum|int|lim|partial|sigma|theta|tau|omega|lambda|Delta|alpha|beta)\b/g) || [];
  const latexDelimiters = text.match(/\$|\\\(|\\\)|\\\[|\\\]/g) || [];
  return latexCommands.length >= 2 || latexDelimiters.length >= 2;
}

function ensurePsychologyState(match) {
  if (!match.botPsychology) {
    match.botPsychology = {
      lastGlobalAt: 0,
      lastByTrigger: {},
      roundCounts: {},
      processedKeys: new Set()
    };
  }
  return match.botPsychology;
}

function getPostMatchVariants(humanWon, isDraw) {
  if (isDraw) {
    return [
      { emoji: '🤝', weight: 0.6 },
      { emoji: '👏', weight: 0.4 }
    ];
  }
  if (humanWon) {
    // Bot lost -> shows respect
    return [
      { emoji: '👏', weight: 0.5 },
      { emoji: '🤝', weight: 0.35 },
      { emoji: '😮', weight: 0.15 }
    ];
  }
  // Bot won -> humble GG / hype
  return [
    { emoji: '🤝', weight: 0.5 },
    { emoji: '🔥', weight: 0.3 },
    { emoji: '👏', weight: 0.2 }
  ];
}

class BotEmoteEngine {
  /**
   * Evaluates match events and decides if the bot should emit a natural, human-like reaction.
   * @param {string} eventType ('QUESTION_STARTED' | 'HUMAN_ANSWERED' | 'STREAK_MILESTONE' | 'SCORE_UPDATED' | 'MATCH_ENDED')
   * @param {object} match (Live match state)
   * @param {object} eventData (Extra event payload like humanTimeSpentMs, humanIsCorrect, etc.)
   * @returns {null | { emoji: string, trigger: string, delayMs: number }}
   */
  evaluateEvent(eventType, match, eventData = {}) {
    if (!match || !match.isBotMatch || match.status !== 'active' && eventType !== 'MATCH_ENDED') {
      return null;
    }

    const state = ensurePsychologyState(match);
    const now = Date.now();
    const round = Number(match.currentQuestionIndex || 0);

    let candidate = null;

    switch (eventType) {
      case 'QUESTION_STARTED': {
        const question = match.questions[round];
        if (!isHeavyFormulaQuestion(question)) return null;

        candidate = {
          trigger: 'FORMULA_DREAD',
          probability: 0.45,
          cooldownMs: 8000,
          dedupeKey: `formula:${round}`,
          variants: [
            { emoji: '🤔', weight: 0.65 },
            { emoji: '🤯', weight: 0.35 }
          ]
        };
        break;
      }

      case 'HUMAN_ANSWERED': {
        const { isCorrect, timeSpentMs } = eventData;
        // Human answered correctly in less than 2.5s -> Bot is shocked
        if (!isCorrect || timeSpentMs > 2500) return null;

        candidate = {
          trigger: 'SPEED_SHOCK',
          probability: 0.68,
          cooldownMs: 7000,
          dedupeKey: `speed:${round}`,
          variants: [
            { emoji: '😮', weight: 0.65 },
            { emoji: '⚡', weight: 0.35 }
          ]
        };
        break;
      }

      case 'STREAK_MILESTONE': {
        const { streak, playerId } = eventData;
        if (streak < 3) return null;

        candidate = {
          trigger: 'STREAK_HYPE',
          probability: 0.65,
          cooldownMs: 6000,
          dedupeKey: `streak:${playerId}:${streak}`,
          variants: [
            { emoji: '🔥', weight: 0.70 },
            { emoji: '😎', weight: 0.30 }
          ]
        };
        break;
      }

      case 'SCORE_UPDATED': {
        const totalRounds = match.questions?.length || 5;
        // Only trigger clutch tension in rounds 4 or 5
        if (round < totalRounds - 2) return null;

        const bot = match.players['bot'];
        const human = Object.values(match.players).find(p => p.userId !== 'bot');
        if (!bot || !human) return null;

        const scoreGap = Math.abs((bot.score || 0) - (human.score || 0));
        if (scoreGap > 120) return null;

        candidate = {
          trigger: 'CLUTCH_PRESSURE',
          probability: 0.65,
          cooldownMs: 10000,
          dedupeKey: `clutch:${round}`,
          variants: [
            { emoji: '😰', weight: 0.65 },
            { emoji: '💀', weight: 0.35 }
          ]
        };
        break;
      }

      case 'MATCH_ENDED': {
        const { humanWon, isDraw } = eventData;
        candidate = {
          trigger: 'POST_MATCH_RESPECT',
          probability: 1.0,
          cooldownMs: 0,
          bypassCooldown: true,
          bypassRoundCap: true,
          dedupeKey: `post_match:${match.roomId}`,
          variants: getPostMatchVariants(humanWon, isDraw)
        };
        break;
      }

      default:
        return null;
    }

    if (!candidate) return null;

    // 1. Deduplication check
    if (state.processedKeys.has(candidate.dedupeKey)) return null;
    state.processedKeys.add(candidate.dedupeKey);

    // 2. Round cap check (max 2 emotes per round)
    const currentRoundCount = state.roundCounts[round] || 0;
    if (!candidate.bypassRoundCap && currentRoundCount >= MAX_BOT_EMOTES_PER_ROUND) {
      return null;
    }

    // 3. Global cooldown check
    if (!candidate.bypassCooldown && (now - state.lastGlobalAt < DEFAULT_GLOBAL_COOLDOWN_MS)) {
      return null;
    }

    // 4. Per-trigger cooldown check
    const lastTriggerTime = state.lastByTrigger[candidate.trigger] || 0;
    if (!candidate.bypassCooldown && (now - lastTriggerTime < candidate.cooldownMs)) {
      return null;
    }

    // 5. Probability roll
    if (Math.random() > candidate.probability) {
      return null;
    }

    // 6. Calculate realistic human reaction delay (600ms - 1400ms)
    const delayMs = randomBetween(600, 1400);
    const emoji = weightedPick(candidate.variants);

    // Update cooldown records
    state.lastGlobalAt = now + delayMs;
    state.lastByTrigger[candidate.trigger] = now + delayMs;
    state.roundCounts[round] = currentRoundCount + 1;

    return {
      emoji,
      trigger: candidate.trigger,
      delayMs
    };
  }
}

const botEmoteEngine = new BotEmoteEngine();

module.exports = {
  BotEmoteEngine,
  botEmoteEngine
};

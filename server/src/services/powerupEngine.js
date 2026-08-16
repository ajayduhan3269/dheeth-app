const crypto = require('crypto');

/**
 * Evaluates round outcome to award EMP Disruptor (50-50) lifelines
 */
function evaluatePowerupGrants(match, roundNumber) {
  const updates = [];
  const pIds = Object.keys(match.players || {});
  if (pIds.length !== 2) return updates;

  const [p1Id, p2Id] = pIds;
  const p1 = match.players[p1Id];
  const p2 = match.players[p2Id];

  // Initialize powerup state container if missing
  [p1, p2].forEach(p => {
    if (!p.powerupState) {
      p.powerupState = {
        slot: null, // { instanceId, type: 'EMP', source, earnedRound, expiresAfterRound, status: 'READY' }
        underdogGrants: 0,
        wrongStreakGrants: 0
      };
    }
    // Check card expiration
    if (p.powerupState.slot && p.powerupState.slot.status === 'READY') {
      if (roundNumber > p.powerupState.slot.expiresAfterRound) {
        p.powerupState.slot = null;
        updates.push({
          userId: p.userId,
          reason: 'EXPIRED',
          slot: null
        });
      }
    }
  });

  // Calculate grossBaseScore deficit
  const p1Gross = p1.grossBaseScore || 0;
  const p2Gross = p2.grossBaseScore || 0;
  const p1Deficit = Math.max(0, p2Gross - p1Gross);
  const p2Deficit = Math.max(0, p1Gross - p2Gross);

  const playersToCheck = [
    { p: p1, opp: p2, deficit: p1Deficit },
    { p: p2, opp: p1, deficit: p2Deficit }
  ];

  playersToCheck.forEach(({ p, deficit }) => {
    const state = p.powerupState;
    if (state.slot && state.slot.status === 'READY') {
      return; // Already holding EMP
    }

    // 1. Underdog Deficit Trigger (Deficit >= 150, round >= 2, max 2 grants)
    if (deficit >= 150 && state.underdogGrants < 2 && roundNumber >= 2) {
      state.underdogGrants += 1;
      state.slot = {
        instanceId: `pu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        type: 'EMP',
        source: 'UNDERDOG_DEFICIT',
        earnedRound: roundNumber,
        expiresAfterRound: roundNumber + 2,
        status: 'READY'
      };

      updates.push({
        userId: p.userId,
        reason: 'UNDERDOG_DEFICIT',
        slot: state.slot
      });
      return;
    }

    // 2. Qualifying Two-Wrong Streak Trigger (round >= 2, max 1 grant)
    const recentAnswers = p.answers || [];
    if (recentAnswers.length >= 2 && state.wrongStreakGrants < 1 && roundNumber >= 2) {
      const lastTwo = recentAnswers.slice(-2);
      const allWrong = lastTwo.every(a => !a.isCorrect && !a.isTimeout && (a.timeSpentMs || 0) >= 2000);
      if (allWrong) {
        state.wrongStreakGrants += 1;
        state.slot = {
          instanceId: `pu_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          type: 'EMP',
          source: 'WRONG_STREAK',
          earnedRound: roundNumber,
          expiresAfterRound: roundNumber + 2,
          status: 'READY'
        };

        updates.push({
          userId: p.userId,
          reason: 'WRONG_STREAK',
          slot: state.slot
        });
      }
    }
  });

  return updates;
}

/**
 * Generates EMP eliminated option IDs for an active question
 */
function applyEmp(question, matchSecret, roundIdx) {
  const correctOpt = (question.correctOption || 'a').toLowerCase();
  const allKeys = Object.keys(question.options || { a: 1, b: 1, c: 1, d: 1 })
    .map(k => k.toLowerCase())
    .filter(k => k !== correctOpt);

  // Shuffle remaining incorrect options deterministically
  const hash = crypto.createHash('sha256').update(`${matchSecret}:emp:${roundIdx}`).digest('hex');
  const seedNum = parseInt(hash.substring(0, 8), 16);
  
  const shuffled = [...allKeys].sort((a, b) => {
    return ((seedNum ^ a.charCodeAt(0)) % 10) - ((seedNum ^ b.charCodeAt(0)) % 10);
  });

  return shuffled.slice(0, 2); // Eliminate exactly 2 wrong options
}

module.exports = {
  evaluatePowerupGrants,
  applyEmp
};

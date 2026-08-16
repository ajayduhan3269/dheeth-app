'use strict';

class EmoteRateLimiter {
  constructor({ capacity = 1, refillEveryMs = 2000, maxPerRound = 4, staleAfterMs = 5 * 60 * 1000 } = {}) {
    this.capacity = capacity;
    this.refillEveryMs = refillEveryMs;
    this.maxPerRound = maxPerRound;
    this.staleAfterMs = staleAfterMs;
    this.entries = new Map();
  }

  _getEntry(key, round, now) {
    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        tokens: this.capacity,
        lastRefillAt: now,
        round,
        roundCount: 0,
        lastSeenAt: now
      };
      this.entries.set(key, entry);
    }
    if (entry.round !== round) {
      entry.round = round;
      entry.roundCount = 0;
    }
    entry.lastSeenAt = now;
    return entry;
  }

  consume(key, round = 0, now = Date.now()) {
    const entry = this._getEntry(key, round, now);
    const elapsed = Math.max(0, now - entry.lastRefillAt);
    entry.tokens = Math.min(this.capacity, entry.tokens + elapsed / this.refillEveryMs);
    entry.lastRefillAt = now;

    if (entry.roundCount >= this.maxPerRound) {
      return { allowed: false, reason: 'ROUND_CAP' };
    }

    if (entry.tokens < 1) {
      return { allowed: false, reason: 'THROTTLED' };
    }

    entry.tokens -= 1;
    entry.roundCount += 1;
    return { allowed: true };
  }

  delete(key) {
    this.entries.delete(key);
  }

  prune(now = Date.now()) {
    for (const [key, entry] of this.entries) {
      if (now - entry.lastSeenAt > this.staleAfterMs) {
        this.entries.delete(key);
      }
    }
  }
}

const emoteRateLimiter = new EmoteRateLimiter();
setInterval(() => emoteRateLimiter.prune(), 60000).unref();

module.exports = {
  EmoteRateLimiter,
  emoteRateLimiter
};

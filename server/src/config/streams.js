// Single source of truth for stream identity + fallback subject catalogue.
const STREAMS = ['civil', 'ssc_cgl', 'banking'];
const DEFAULT_STREAM = 'civil';

/**
 * Fallback subjects used when the questions collection has no seeded rows yet
 * for a stream. Civil is intentionally empty because Civil subjects are
 * derived directly from the questions collection.
 */
const FALLBACK_SUBJECTS = {
  ssc_cgl: [
    { subject: 'Quantitative Aptitude', icon: '📐' },
    { subject: 'Reasoning Ability', icon: '🧩' },
    { subject: 'General English', icon: '📖' },
    { subject: 'General Studies (GS)', icon: '🌍' },
    { subject: 'Current Affairs', icon: '📰' },
  ],
  banking: [
    { subject: 'Quantitative Aptitude & DI', icon: '📊' },
    { subject: 'Reasoning Ability & Puzzles', icon: '🧠' },
    { subject: 'English Language', icon: '✍️' },
    { subject: 'Banking & Financial Awareness', icon: '🏦' },
    { subject: 'Computer Knowledge', icon: '💻' },
  ],
  civil: [],
};

const normalizeStream = (value) => (STREAMS.includes(value) ? value : DEFAULT_STREAM);

/**
 * Legacy-safe match for Civil. Questions seeded before this migration have no
 * `stream` property at all, so they must be matched as civil.
 */
const CIVIL_MATCH = {
  $or: [
    { stream: 'civil' },
    { stream: { $exists: false } },
    { stream: null },
  ],
};

/**
 * Builds a Mongo filter for stream, category, subject, and extra clauses.
 */
function buildStreamFilter(rawStream, { category, subject, extra } = {}) {
  const stream = normalizeStream(rawStream);
  const clauses = [];

  if (stream === 'civil') {
    clauses.push(CIVIL_MATCH);
    if (category === 'tech' || category === 'gs') {
      clauses.push({ category });
    }
  } else {
    clauses.push({ stream });
  }

  if (subject) {
    clauses.push({ subject });
  }

  if (extra && Object.keys(extra).length) {
    clauses.push(extra);
  }

  return clauses.length === 1 ? clauses[0] : { $and: clauses };
}

module.exports = {
  STREAMS,
  DEFAULT_STREAM,
  FALLBACK_SUBJECTS,
  CIVIL_MATCH,
  normalizeStream,
  buildStreamFilter,
};

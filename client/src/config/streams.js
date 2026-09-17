export const STREAMS = ['civil', 'ssc_cgl', 'banking'];
export const DEFAULT_STREAM = 'civil';

export const STREAM_META = {
  civil: {
    id: 'civil',
    label: 'Civil Engineering',
    shortLabel: 'Civil Eng',
    icon: '🏗️',
    tagline: 'Technical + General Studies',
    exams: ['GATE', 'ESE', 'SSC JE', 'State AE/JE', 'RRB JE'],
    focus: 'Fluid Mechanics, Soil Mechanics, Structures, RCC, Surveying + GS syllabus',
    accent: '#00e676',
    glow: 'rgba(0, 230, 118, 0.45)',
    hasSubModes: true,
  },
  ssc_cgl: {
    id: 'ssc_cgl',
    label: 'SSC CGL & Related',
    shortLabel: 'SSC CGL',
    icon: '🏛️',
    tagline: 'Tier 1 & Tier 2 Ready',
    exams: ['CGL', 'CHSL', 'MTS', 'CPO', 'GD'],
    focus: 'Quantitative Aptitude, Reasoning, English Comprehension, General Awareness',
    accent: '#a855f7',
    glow: 'rgba(168, 85, 247, 0.45)',
    hasSubModes: false,
  },
  banking: {
    id: 'banking',
    label: 'Banking & Insurance',
    shortLabel: 'Banking',
    icon: '🏦',
    tagline: 'Speed & Accuracy Drills',
    exams: ['SBI PO/Clerk', 'IBPS PO/Clerk', 'RRB', 'RBI'],
    focus: 'Quant & DI, Reasoning & Puzzles, English, Banking Awareness & Computer Knowledge',
    accent: '#38bdf8',
    glow: 'rgba(56, 189, 248, 0.45)',
    hasSubModes: false,
  },
};

export const FALLBACK_SUBJECTS = {
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

export const isValidStream = (s) => STREAMS.includes(s);
export const streamMeta = (s) => STREAM_META[s] ?? STREAM_META[DEFAULT_STREAM];

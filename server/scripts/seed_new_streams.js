const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const Question = require('../src/models/Question');

const sampleQuestions = [
  // ─── SSC CGL: Quantitative Aptitude ───────────────────────────
  {
    stream: 'ssc_cgl',
    subject: 'Quantitative Aptitude',
    topic: 'Percentages & Profit Loss',
    questionText: 'If the price of sugar increases by 25%, by what percent must a household reduce its consumption so as to not increase the expenditure?',
    options: {
      a: '15%',
      b: '20%',
      c: '25%',
      d: '30%'
    },
    correctOption: 'b',
    explanation: 'Reduction in consumption = [r / (100 + r)] × 100 = [25 / 125] × 100 = 20%.'
  },
  {
    stream: 'ssc_cgl',
    subject: 'Quantitative Aptitude',
    topic: 'Ratio & Proportion',
    questionText: 'Two numbers are in the ratio 3 : 5. If 9 is subtracted from each, their ratio becomes 12 : 23. What is the smaller number?',
    options: {
      a: '27',
      b: '33',
      c: '45',
      d: '55'
    },
    correctOption: 'b',
    explanation: 'Let numbers be 3x and 5x. (3x - 9)/(5x - 9) = 12/23. 69x - 207 = 60x - 108 => 9x = 99 => x = 11. Smaller number = 3 × 11 = 33.'
  },
  {
    stream: 'ssc_cgl',
    subject: 'Quantitative Aptitude',
    topic: 'Time & Work',
    questionText: 'A can complete a piece of work in 12 days, and B can do it in 18 days. Working together, how many days will they take to complete the work?',
    options: {
      a: '6.4 days',
      b: '7.2 days',
      c: '8 days',
      d: '9.5 days'
    },
    correctOption: 'b',
    explanation: 'Work done in 1 day = 1/12 + 1/18 = (3 + 2)/36 = 5/36. Total days = 36/5 = 7.2 days.'
  },

  // ─── SSC CGL: Reasoning Ability ──────────────────────────────
  {
    stream: 'ssc_cgl',
    subject: 'Reasoning Ability',
    topic: 'Analogies',
    questionText: 'Select the related word from the given alternatives: \nSeismograph : Earthquake :: Hygrometer : ?',
    options: {
      a: 'Pressure',
      b: 'Humidity',
      c: 'Temperature',
      d: 'Rainfall'
    },
    correctOption: 'b',
    explanation: 'A seismograph is used to measure earthquakes, while a hygrometer is used to measure humidity.'
  },
  {
    stream: 'ssc_cgl',
    subject: 'Reasoning Ability',
    topic: 'Number Series',
    questionText: 'Find the missing number in the series: 4, 9, 25, 49, 121, ?',
    options: {
      a: '144',
      b: '169',
      c: '196',
      d: '225'
    },
    correctOption: 'b',
    explanation: 'The series represents squares of consecutive prime numbers: 2^2, 3^2, 5^2, 7^2, 11^2, 13^2 = 169.'
  },
  {
    stream: 'ssc_cgl',
    subject: 'Reasoning Ability',
    topic: 'Syllogism',
    questionText: 'Statements: \n1. All cars are vehicles. \n2. Some vehicles are electric. \nConclusions: \nI. Some cars are electric. \nII. Some vehicles are cars.',
    options: {
      a: 'Only I follows',
      b: 'Only II follows',
      c: 'Both I and II follow',
      d: 'Neither follows'
    },
    correctOption: 'b',
    explanation: 'Since all cars are vehicles, some vehicles are definitely cars (Conclusion II holds). There is no definite relationship established between cars and electric vehicles.'
  },

  // ─── SSC CGL: General English ────────────────────────────────
  {
    stream: 'ssc_cgl',
    subject: 'General English',
    topic: 'Idioms & Phrases',
    questionText: 'Choose the correct meaning of the idiom: "Bite the bullet"',
    options: {
      a: 'To face a grim situation with courage',
      b: 'To start a dangerous fight',
      c: 'To speak harsh words',
      d: 'To surrender immediately'
    },
    correctOption: 'a',
    explanation: '"Bite the bullet" means to endure a painful or difficult situation with resilience and bravery.'
  },
  {
    stream: 'ssc_cgl',
    subject: 'General English',
    topic: 'One Word Substitution',
    questionText: 'A person who looks at the bright side of things is called a/an:',
    options: {
      a: 'Pessimist',
      b: 'Optimist',
      c: 'Altruist',
      d: 'Stoic'
    },
    correctOption: 'b',
    explanation: 'An optimist is a person who tends to be hopeful and confident about the future.'
  },

  // ─── SSC CGL: General Studies (GS) ───────────────────────────
  {
    stream: 'ssc_cgl',
    subject: 'General Studies (GS)',
    topic: 'Indian Polity',
    questionText: 'Which Article of the Constitution of India guarantees the Right to Constitutional Remedies?',
    options: {
      a: 'Article 19',
      b: 'Article 21',
      c: 'Article 32',
      d: 'Article 44'
    },
    correctOption: 'c',
    explanation: 'Article 32 gives the right to individuals to move to the Supreme Court to seek justice when they feel that their fundamental rights have been violated.'
  },
  {
    stream: 'ssc_cgl',
    subject: 'General Studies (GS)',
    topic: 'Indian Economy',
    questionText: 'Which institution releases the Consumer Price Index (CPI) in India?',
    options: {
      a: 'Reserve Bank of India',
      b: 'National Statistical Office (NSO)',
      c: 'NITI Aayog',
      d: 'Ministry of Finance'
    },
    correctOption: 'b',
    explanation: 'CPI in India is compiled and released on a monthly basis by the National Statistical Office (NSO), MoSPI.'
  },

  // ─── Banking: Quantitative Aptitude & DI ─────────────────────
  {
    stream: 'banking',
    subject: 'Quantitative Aptitude & DI',
    topic: 'Compound Interest',
    questionText: 'What is the compound interest on ₹10,000 for 2 years at 10% per annum, compounded annually?',
    options: {
      a: '₹2,000',
      b: '₹2,100',
      c: '₹2,200',
      d: '₹2,500'
    },
    correctOption: 'b',
    explanation: 'A = P(1 + r/100)^t = 10000(1.1)^2 = ₹12,100. CI = 12,100 - 10,000 = ₹2,100.'
  },
  {
    stream: 'banking',
    subject: 'Quantitative Aptitude & DI',
    topic: 'Approximation',
    questionText: 'What approximate value should come in place of question mark (?): 449.98 ÷ 15.02 × 12.03 = ?',
    options: {
      a: '320',
      b: '360',
      c: '400',
      d: '450'
    },
    correctOption: 'b',
    explanation: '450 ÷ 15 = 30; 30 × 12 = 360.'
  },

  // ─── Banking: Reasoning Ability & Puzzles ─────────────────────
  {
    stream: 'banking',
    subject: 'Reasoning Ability & Puzzles',
    topic: 'Inequalities',
    questionText: 'Statement: P ≥ Q > R = S ≤ T \nConclusions: \nI. P > S \nII. R < T',
    options: {
      a: 'Only I is true',
      b: 'Only II is true',
      c: 'Both I and II are true',
      d: 'Neither is true'
    },
    correctOption: 'a',
    explanation: 'P ≥ Q > R = S means P > S (Conclusion I is true). R = S ≤ T implies R ≤ T (not strictly <, so II is false).'
  },
  {
    stream: 'banking',
    subject: 'Reasoning Ability & Puzzles',
    topic: 'Coding-Decoding',
    questionText: 'In a certain code, "BANK" is written as "CBOL". How is "LOAN" written in that code?',
    options: {
      a: 'MPBO',
      b: 'MQBN',
      c: 'MPBN',
      d: 'MQBO'
    },
    correctOption: 'a',
    explanation: 'Each letter is shifted forward by +1: L->M, O->P, A->B, N->O.'
  },

  // ─── Banking: English Language ────────────────────────────────
  {
    stream: 'banking',
    subject: 'English Language',
    topic: 'Error Detection',
    questionText: 'Identify the part containing an error: "Neither of the two candidates (A) / were found eligible (B) / for the managerial post (C) / No error (D)"',
    options: {
      a: 'Part A',
      b: 'Part B',
      c: 'Part C',
      d: 'Part D'
    },
    correctOption: 'b',
    explanation: '"Neither of" takes a singular verb. It should be "was found eligible" instead of "were found eligible".'
  },

  // ─── Banking: Banking & Financial Awareness ───────────────────
  {
    stream: 'banking',
    subject: 'Banking & Financial Awareness',
    topic: 'Monetary Policy',
    questionText: 'What is the rate at which the Reserve Bank of India lends money to commercial banks for short-term needs called?',
    options: {
      a: 'Reverse Repo Rate',
      b: 'Repo Rate',
      c: 'Bank Rate',
      d: 'Marginal Standing Facility'
    },
    correctOption: 'b',
    explanation: 'Repo Rate is the interest rate at which the central bank (RBI) lends money to commercial banks against government securities for short-term requirements.'
  },
  {
    stream: 'banking',
    subject: 'Banking & Financial Awareness',
    topic: 'Banking Regulations',
    questionText: 'What does PCA stand for in the context of RBI’s supervisory framework for struggling banks?',
    options: {
      a: 'Prompt Corrective Action',
      b: 'Public Credit Administration',
      c: 'Priority Capital Allocation',
      d: 'Prudential Compliance Assessment'
    },
    correctOption: 'a',
    explanation: 'PCA stands for Prompt Corrective Action, a framework under which banks with weak financial metrics are put under RBI watch.'
  },
  {
    stream: 'banking',
    subject: 'Computer Knowledge',
    topic: 'Networking',
    questionText: 'Which protocol is used for secure communication over a computer network in banking transactions?',
    options: {
      a: 'HTTP',
      b: 'FTP',
      c: 'HTTPS',
      d: 'SMTP'
    },
    correctOption: 'c',
    explanation: 'HTTPS (Hypertext Transfer Protocol Secure) encrypts the communication session with digital certificates (SSL/TLS).'
  }
];

async function runSeed() {
  try {
    const mongoUri = process.env.MONGODB_URL || process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/dheeth';
    console.log('Connecting to MongoDB at:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('Connected.');

    let inserted = 0;
    for (const q of sampleQuestions) {
      const exists = await Question.findOne({
        stream: q.stream,
        subject: q.subject,
        questionText: q.questionText,
      });

      if (!exists) {
        await Question.create(q);
        inserted++;
      }
    }

    console.log(`Successfully seeded ${inserted} new questions for SSC CGL & Banking!`);
    await mongoose.disconnect();
    console.log('Done.');
  } catch (err) {
    console.error('Error seeding questions:', err);
    process.exit(1);
  }
}

runSeed();

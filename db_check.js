const mongoose = require('mongoose');
require('dotenv').config({ path: './server/.env' });
const Question = require('./server/src/models/Question');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('connected');

  // Find a question whose text contains math commands like \cos, \frac, \tau
  const queries = [
    { qn: '3', label: 'Q3 (kinematic viscosity unit)' },
  ];
  for (const { qn, label } of queries) {
    const q = await Question.findOne({ questionNumber: qn, subject: 'Fluid Mechanics' });
    console.log('\n=== ' + label + ' ===');
    if (!q) { console.log('NOT FOUND'); continue; }
    const dump = (name, s) => {
      if (s == null) { console.log(name + ': null'); return; }
      // show control chars explicitly
      const visible = JSON.stringify(s);
      console.log(name + ' (' + s.length + ' chars): ' + visible);
      for (let i = 0; i < s.length; i++) {
        console.log(`  char[${i}]: ${JSON.stringify(s[i])} code=${s.charCodeAt(i)}`);
      }
    };
    dump('questionText', q.questionText);
    dump('explanation', q.explanation);
    if (q.options) {
      dump('opt.a', q.options.a);
      dump('opt.b', q.options.b);
      dump('opt.c', q.options.c);
      dump('opt.d', q.options.d);
    }
  }

  // Count total + how many rows have control chars (broken LaTeX from old seed)
  const all = await Question.find({ subject: 'Fluid Mechanics' });
  let broken = 0;
  const sample = [];
  for (const q of all) {
    const blobs = [q.questionText, q.explanation, ...(q.options ? Object.values(q.options) : [])].filter(Boolean);
    const joined = blobs.join('');
    if (/[\t\r\b\f]/.test(joined)) {
      broken++;
      if (sample.length < 10) sample.push(q.questionNumber + ': ' + JSON.stringify((q.questionText || '').slice(0, 80)));
    }
  }
  console.log('\n\nTotal Fluid Mechanics rows:', all.length);
  console.log('Rows containing control chars (broken LaTeX):', broken);
  sample.forEach(s => console.log('  ', s));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });

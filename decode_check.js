const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./server/data/seeds/fluid_mechanics_questions.json', 'utf8'));

let badCount = 0;
const examples = [];
for (const q of data) {
  const strs = [];
  if (q.question_text) strs.push(['question_text', q.question_text]);
  if (q.solution) strs.push(['solution', q.solution]);
  if (q.options) for (const k of Object.keys(q.options)) strs.push(['opt.' + k, q.options[k]]);
  for (const [field, s] of strs) {
    if (s.includes('\f') || s.includes('\t') || s.includes('\r') || s.includes('\b')) {
      badCount++;
      if (examples.length < 25) examples.push({ q: q.question_number, field, s });
    }
  }
}
console.log('Questions with decoded control chars (broken LaTeX):', badCount);
for (const e of examples) {
  console.log('\nQ' + e.q + ' [' + e.field + ']:');
  console.log(JSON.stringify(e.s));
}

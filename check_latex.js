// End-to-end: apply formatLatex to every real question string, extract the
// resulting $/$$ math segments, and render each through KaTeX to confirm there
// are no parse errors introduced by the transformation.
const katex = require('./client/node_modules/katex');
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./server/data/seeds/fluid_mechanics_questions.json', 'utf8'));

const formatLatex = (text) => {
  if (!text) return '';
  if (typeof text !== 'string') return text;
  let out = text;
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$');
  if (!out.includes('$') && /[\\][a-zA-Z]/.test(out)) out = '$' + out + '$';
  return out;
};

function extractMathSegments(text) {
  const out = [];
  const re = /\$\$([\s\S]*?)\$\$|\$([^$]*?)\$/g;
  let m;
  while ((m = re.exec(text)) !== null) out.push(m[1] !== undefined ? m[1] : m[2]);
  return out;
}

let total = 0, ok = 0;
const failed = [];
let wrapCount = 0, bdCount = 0, piCount = 0;

for (const q of data) {
  const blobs = [];
  if (q.question_text) blobs.push(['Q'+q.question_number+':text', q.question_text]);
  if (q.solution) blobs.push(['Q'+q.question_number+':sol', q.solution]);
  if (q.options) for (const k of Object.keys(q.options)) blobs.push(['Q'+q.question_number+':opt.'+k, q.options[k]]);
  for (const [label, s] of blobs) {
    const hadNoDollar = !s.includes('$');
    const transformed = formatLatex(s);
    if (hadNoDollar && /[\\][a-zA-Z]/.test(s)) wrapCount++;
    if (s.includes('\\[') || s.includes('\\]')) bdCount++;
    if (s.includes('\\(') || s.includes('\\)')) piCount++;
    for (const seg of extractMathSegments(transformed)) {
      total++;
      try { katex.renderToString(seg, { throwOnError: true, displayMode: false }); ok++; }
      catch (e) { failed.push({ label, seg, err: e.message }); }
    }
  }
}
console.log('Wrapped bare-math strings:', wrapCount);
console.log('Display-math \\\\[ \\\\] strings:', bdCount);
console.log('Inline \\\\( \\\\) strings:', piCount);
console.log('Math segments after transformation:', total);
console.log('Rendered OK:', ok);
console.log('Failed:', failed.length);
failed.slice(0, 30).forEach(f => {
  console.log('\n[' + f.label + '] seg=' + JSON.stringify(f.seg));
  console.log('  err: ' + f.err);
});

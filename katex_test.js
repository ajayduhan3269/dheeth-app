// Render the actual question strings through KaTeX the way katex would parse them,
// to see which ones throw ParseError vs render fine.
const katex = require('./client/node_modules/katex');
const fs = require('fs');

const data = JSON.parse(fs.readFileSync('./server/data/seeds/fluid_mechanics_questions.json', 'utf8'));

// react-latex-next splits on $...$. Extract math segments and render each with katex.renderToString.
function extractMathSegments(text) {
  const out = [];
  // handle $$ ... $$ first minimally; fall back to $ ... $
  const re = /\$\$([\s\S]*?)\$\$|\$([^$\n]*?)\$/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push(m[1] !== undefined ? m[1] : m[2]);
  }
  return out;
}

let total = 0, ok = 0, failed = [];
for (const q of data) {
  const blobs = [];
  if (q.question_text) blobs.push(['Q'+q.question_number+':text', q.question_text]);
  if (q.solution) blobs.push(['Q'+q.question_number+':sol', q.solution]);
  if (q.options) for (const k of Object.keys(q.options)) blobs.push(['Q'+q.question_number+':opt.'+k, q.options[k]]);
  for (const [label, s] of blobs) {
    const segs = extractMathSegments(s);
    for (const seg of segs) {
      total++;
      try {
        katex.renderToString(seg, { throwOnError: true, displayMode: false });
        ok++;
      } catch (e) {
        failed.push({ label, seg, err: e.message });
      }
    }
  }
}
console.log('Math segments tested:', total);
console.log('Rendered OK:', ok);
console.log('Failed:', failed.length);
failed.slice(0, 40).forEach(f => {
  console.log('\n[' + f.label + '] seg=' + JSON.stringify(f.seg));
  console.log('  err: ' + f.err);
});

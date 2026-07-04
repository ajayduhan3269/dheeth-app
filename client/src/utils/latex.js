// Normalise question/option/explanation text so react-latex-next renders it.
// react-latex-next only splits on $...$ and $$...$$; it does NOT recognise
// \( \) or \[ \], and bare LaTeX with no delimiters is shown as raw text.
// This helper converts those cases to $...$ / $$...$$ so KaTeX picks them up.
//
// Cases handled:
//   1. \[ ... \]  -> $$ ... $$   (display math)
//   2. \( ... \)  -> $ ... $     (inline math)
//   3. A string that contains a LaTeX command backslash but NO $ delimiters
//      at all (e.g. an option like "\sqrt{f}" or "c = \frac{R^{2/3}}{n}")
//      gets wrapped in $...$ so it renders. Mixed text that already uses $ is
//      left untouched.
export const formatLatex = (text) => {
  if (!text) return '';
  if (typeof text !== 'string') return text;

  let out = text;
  // \[ ... \]  -> $$ ... $$
  out = out.replace(/\\\[([\s\S]*?)\\\]/g, '$$$$$1$$$$');
  // \( ... \)  -> $ ... $   ('$$$1$' = literal "$" + backref 1 + literal "$")
  out = out.replace(/\\\(([\s\S]*?)\\\)/g, '$$$1$');

  // If after conversion there are still no $ delimiters but the text has a
  // LaTeX command (a backslash followed by a letter), wrap it as inline math.
  if (!out.includes('$') && /[\\][a-zA-Z]/.test(out)) {
    out = '$' + out + '$';
  }
  return out;
};

export default formatLatex;

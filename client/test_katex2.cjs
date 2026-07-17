const katex = require('katex');
try {
  console.log("TEST 1: ", katex.renderToString('1\\text{ cm} = 50\\text{ m}', { strict: true }));
} catch (e) {
  console.error("ERROR 1: ", e.message);
}

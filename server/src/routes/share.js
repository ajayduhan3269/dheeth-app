const express = require('express');
const router = express.Router();
const Duel = require('../models/Duel');

const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://dheeth.app';

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

router.get('/duel/:code', async (req, res, next) => {
  try {
    const rawCode = String(req.params.code || '').trim().toUpperCase();
    if (!/^[A-Z0-9]{4,10}$/.test(rawCode)) {
      return res.status(404).send('Challenge not found');
    }

    const duel = await Duel.findOne({ code: rawCode });
    const subject = duel?.config?.subject || 'Engineering Quiz';
    const hostName = duel?.hostUsername || 'A Challenger';
    const questionCount = duel?.config?.questionCount || 5;
    const secondsPerQ = duel?.config?.secondsPerQ || 20;

    const title = escapeHtml(`🔥 ${hostName} challenged you to a 1v1 Duel in ${subject}!`);
    const description = escapeHtml(`Can you beat ${hostName}? 5 Rounds · ${secondsPerQ}s per question · Speed x Streak Scoring. Code: ${rawCode}`);
    const canonicalUrl = `${FRONTEND_ORIGIN}/duel/${encodeURIComponent(rawCode)}`;
    const avatarSeed = duel?.hostAvatar || hostName;
    const imageUrl = `https://api.dicebear.com/8.x/micah/svg?seed=${encodeURIComponent(avatarSeed)}`;

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="DHEETH Arena" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta name="twitter:card" content="summary" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${imageUrl}" />
  <link rel="canonical" href="${canonicalUrl}" />
  <meta http-equiv="refresh" content="0; url=${canonicalUrl}" />
</head>
<body style="background:#0f0f1a; color:#fff; font-family:sans-serif; text-align:center; padding:40px;">
  <h2>Entering DHEETH 1v1 Arena...</h2>
  <p><a href="${canonicalUrl}" style="color:#00e5ff;">Click here if you are not redirected automatically</a></p>
</body>
</html>`;

    res.status(200)
      .set({
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'public, max-age=0, s-maxage=60, stale-while-revalidate=300',
      })
      .send(html);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

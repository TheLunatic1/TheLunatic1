const express = require('express');
const {
  fetchGitHubData,
  generateStatsSVG,
  generateLanguagesSVG,
  generateStreakSVG,
  generateTrophiesSVG,
  generateTopReposSVG
} = require('./generator');

const app = express();
const PORT = process.env.PORT || 3333;
const USERNAME = process.env.USERNAME || 'TheLunatic1';

// Cache structure (TTL: 30 minutes)
const CACHE_TTL_MS = 30 * 60 * 1000;
let cachedData = null;
let lastFetchTime = 0;
let fetchPromise = null;

async function getStatsData(forceRefresh = false) {
  const now = Date.now();
  if (cachedData && !forceRefresh && (now - lastFetchTime < CACHE_TTL_MS)) {
    return cachedData;
  }

  if (fetchPromise) {
    return await fetchPromise;
  }

  fetchPromise = (async () => {
    try {
      console.log(`[${new Date().toISOString()}] Fetching fresh live data for ${USERNAME}...`);
      const token = process.env.GITHUB_TOKEN || '';
      const data = await fetchGitHubData(USERNAME, token);
      cachedData = data;
      lastFetchTime = Date.now();
      return cachedData;
    } catch (err) {
      console.error('Error fetching data:', err);
      if (cachedData) return cachedData;
      throw err;
    } finally {
      fetchPromise = null;
    }
  })();

  return await fetchPromise;
}

function sendSVG(res, svgContent) {
  res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0, s-maxage=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.send(svgContent);
}

// Health check endpoint
app.get(['/health', '/svg/health'], (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    cached: cachedData !== null,
    cacheAgeSeconds: cachedData ? Math.floor((Date.now() - lastFetchTime) / 1000) : null
  });
});

// Stats Card
app.get(['/stats', '/api/stats', '/svg/stats', '/stats.svg', '/svg/stats.svg'], async (req, res) => {
  try {
    const refresh = req.query.refresh === 'true';
    const data = await getStatsData(refresh);
    sendSVG(res, generateStatsSVG(data));
  } catch (err) {
    res.status(500).send(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="50"><text x="10" y="30" fill="red">Error loading stats</text></svg>`);
  }
});

// Languages Card
app.get(['/languages', '/api/languages', '/svg/languages', '/languages.svg', '/svg/languages.svg'], async (req, res) => {
  try {
    const refresh = req.query.refresh === 'true';
    const data = await getStatsData(refresh);
    sendSVG(res, generateLanguagesSVG(data));
  } catch (err) {
    res.status(500).send(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="50"><text x="10" y="30" fill="red">Error loading languages</text></svg>`);
  }
});

// Streak Card
app.get(['/streak', '/api/streak', '/svg/streak', '/streak.svg', '/svg/streak.svg'], async (req, res) => {
  try {
    const refresh = req.query.refresh === 'true';
    const data = await getStatsData(refresh);
    sendSVG(res, generateStreakSVG(data));
  } catch (err) {
    res.status(500).send(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="50"><text x="10" y="30" fill="red">Error loading streak</text></svg>`);
  }
});

// Trophies Card
app.get(['/trophies', '/api/trophies', '/svg/trophies', '/trophies.svg', '/svg/trophies.svg'], async (req, res) => {
  try {
    const refresh = req.query.refresh === 'true';
    const data = await getStatsData(refresh);
    sendSVG(res, generateTrophiesSVG(data));
  } catch (err) {
    res.status(500).send(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="50"><text x="10" y="30" fill="red">Error loading trophies</text></svg>`);
  }
});

// Top Repos Card
app.get(['/top-repos', '/api/top-repos', '/svg/top-repos', '/top-repos.svg', '/svg/top-repos.svg'], async (req, res) => {
  try {
    const refresh = req.query.refresh === 'true';
    const data = await getStatsData(refresh);
    sendSVG(res, generateTopReposSVG(data));
  } catch (err) {
    res.status(500).send(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="50"><text x="10" y="30" fill="red">Error loading top repos</text></svg>`);
  }
});

// Root index page
app.get(['/', '/svg'], (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>GitHub Dynamic SVG Service</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f1117; color: #f8fafc; padding: 40px; }
    h1 { color: #38bdf8; }
    a { color: #818cf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
    ul { line-height: 2; font-size: 18px; }
    code { background: #1e293b; padding: 3px 8px; border-radius: 4px; color: #fbbf24; }
  </style>
</head>
<body>
  <h1>⚡ Salman Toha's GitHub Dynamic SVG Service</h1>
  <p>Live Obsidian Dark-Mode Vector Cards with Caching</p>
  <ul>
    <li><a href="/stats" target="_blank"><code>/stats</code></a> - GitHub Analytics Card</li>
    <li><a href="/languages" target="_blank"><code>/languages</code></a> - Most Used Languages Card</li>
    <li><a href="/streak" target="_blank"><code>/streak</code></a> - Streak &amp; Contributions Card</li>
    <li><a href="/trophies" target="_blank"><code>/trophies</code></a> - Achievements &amp; Trophies Card</li>
    <li><a href="/top-repos" target="_blank"><code>/top-repos</code></a> - Top Repositories Card</li>
  </ul>
</body>
</html>`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Live Dynamic SVG Server running on http://0.0.0.0:${PORT}`);
  console.log(`Target Username: ${USERNAME}`);
});

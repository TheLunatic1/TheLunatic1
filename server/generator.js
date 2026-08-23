const https = require('https');

function escapeXML(str) {
  if (str === null || str === undefined) return '';
  let cleaned = String(str)
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u00A0\s]+/g, ' ')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');

  cleaned = cleaned
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

  return cleaned.replace(/[\u0080-\uFFFF]/g, ch => `&#x${ch.charCodeAt(0).toString(16)};`);
}

const defaultData = {
  name: 'Salman Toha',
  totalStars: 47,
  totalCommits: 1381,
  totalPRs: 1,
  totalIssues: 0,
  contributedTo: 84,
  totalContributions: 1456,
  currentStreak: 5,
  currentStreakDates: 'Active Streak',
  longestStreak: 10,
  longestStreakDates: 'Record Streak',
  firstContributionDate: 'Sep 2022 - Present',
  grade: 'A+',
  languages: [
    { name: 'TypeScript', percent: 53.1, color: '#6366f1' },
    { name: 'JavaScript', percent: 38.1, color: '#fbbf24' },
    { name: 'HTML', percent: 2.6, color: '#fb7185' },
    { name: 'CSS', percent: 2.4, color: '#38bdf8' },
    { name: 'Rust', percent: 1.4, color: '#dea584' },
    { name: 'SCSS', percent: 1.3, color: '#c6538c' }
  ],
  trophies: [
    { title: 'MultiLang Master', tier: 'Gold Tier', desc: 'Used 6+ Languages', color: '#fbbf24', iconType: 'lang' },
    { title: 'Commit Machine', tier: 'Platinum Tier', desc: '1,380+ Commits', color: '#6366f1', iconType: 'commit' },
    { title: 'Full Stack Architect', tier: 'Gold Tier', desc: 'MERN & Mobile Systems', color: '#34d399', iconType: 'arch' },
    { title: 'Contribution Streak', tier: 'Silver Tier', desc: 'Consistent Developer', color: '#fb7185', iconType: 'streak' }
  ],
  topRepos: [
    { name: 'TheLunatic1 / Glyph', desc: 'Glyph is a sleek, modern desktop application designed to streamline server management...', stars: 12, commits: 120, lang: 'JavaScript', color: '#fbbf24' },
    { name: 'TheLunatic1 / IV_Fluid_Calculator_V2', desc: 'A clean and modern IV Drop Rate Calculator built for clinical use. Designed for doctors & nurses...', stars: 6, commits: 85, lang: 'TypeScript', color: '#6366f1' },
    { name: 'TheLunatic1 / jobpulse-ai-frontend', desc: 'A stunning full-stack AI-powered job portal with role-based dashboards & real-time features...', stars: 5, commits: 140, lang: 'TypeScript', color: '#6366f1' },
    { name: 'TheLunatic1 / bookcourier-client', desc: 'A full-stack book delivery management system with real-time updates...', stars: 4, commits: 110, lang: 'JavaScript', color: '#fbbf24' }
  ]
};

async function fetchREST(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'TheLunatic1-Dynamic-Stats-Service',
        'Accept': 'application/vnd.github.v3+json',
        ...headers
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(body));
          } catch (e) {
            reject(e);
          }
        } else {
          reject(new Error(`Status ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function fetchPublicGitHubData(username) {
  try {
    const [userObj, reposArray] = await Promise.all([
      fetchREST(`https://api.github.com/users/${username}`).catch(() => ({})),
      fetchREST(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`).catch(() => [])
    ]);

    let totalStars = 0;
    const langCounts = {};
    let totalReposWithLang = 0;
    const allRepos = [];

    if (Array.isArray(reposArray)) {
      reposArray.forEach(rp => {
        if (!rp.fork) {
          totalStars += rp.stargazers_count || 0;
          if (rp.language) {
            langCounts[rp.language] = (langCounts[rp.language] || 0) + 1;
            totalReposWithLang++;
          }
          if (rp.name && rp.name !== username && !rp.name.startsWith('.')) {
            allRepos.push(rp);
          }
        }
      });
    }

    allRepos.sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));

    const topRepos = allRepos
      .filter(r => (r.stargazers_count >= 1) || r.description)
      .slice(0, 4)
      .map(repo => {
        let desc = repo.description || 'Full Stack Architecture & Systems Repository';
        if (desc.length > 52) desc = desc.substring(0, 50) + '...';
        const lang = repo.language || 'TypeScript';
        const color = lang === 'TypeScript' ? '#6366f1' : (lang === 'JavaScript' ? '#fbbf24' : (lang === 'HTML' ? '#fb7185' : '#38bdf8'));
        return {
          name: `${username} / ${repo.name}`,
          desc: desc,
          stars: repo.stargazers_count || 0,
          commits: Math.floor(Math.random() * 50) + 40,
          lang: lang,
          color: color
        };
      });

    const neoColors = {
      'TypeScript': '#6366f1',
      'JavaScript': '#fbbf24',
      'HTML': '#fb7185',
      'CSS': '#38bdf8',
      'Rust': '#dea584',
      'SCSS': '#c6538c',
      'C++': '#34d399',
      'Python': '#3b82f6'
    };

    const sortedLanguages = Object.entries(langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name, count]) => ({
        name: name,
        percent: parseFloat(((count / (totalReposWithLang || 1)) * 100).toFixed(1)),
        color: neoColors[name] || '#6366f1'
      }));

    return {
      ...defaultData,
      name: userObj.name || defaultData.name,
      totalStars: totalStars > 0 ? totalStars : defaultData.totalStars,
      languages: sortedLanguages.length > 0 ? sortedLanguages : defaultData.languages,
      topRepos: topRepos.length > 0 ? topRepos : defaultData.topRepos
    };
  } catch (err) {
    console.error('Public fetch fallback error:', err.message);
    return defaultData;
  }
}

async function fetchGitHubData(username = 'TheLunatic1', token = process.env.GITHUB_TOKEN) {
  const cleanToken = (token || '').trim();
  if (!cleanToken) {
    return await fetchPublicGitHubData(username);
  }

  try {
    const query = `
      query($login: String!) {
        user(login: $login) {
          name
          contributionsCollection {
            contributionYears
            totalCommitContributions
            totalPullRequestContributions
            totalIssueContributions
            totalRepositoriesWithContributedCommits
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  contributionCount
                  date
                }
              }
            }
          }
          repositories(first: 100, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
            nodes {
              name
              description
              stargazers { totalCount }
              languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                edges {
                  size
                  node { name color }
                }
              }
            }
          }
        }
      }
    `;

    const response = await new Promise((resolve, reject) => {
      const req = https.request('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          'Authorization': `bearer ${cleanToken}`,
          'User-Agent': `${username}-Dynamic-Stats-Service`,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`GraphQL API returned status ${res.statusCode}: ${body}`));
          }
        });
      });
      req.on('error', reject);
      req.write(JSON.stringify({ query, variables: { login: username } }));
      req.end();
    });

    const user = response.data?.user;
    if (!user) {
      console.warn('User object not found in GraphQL response, falling back.');
      return await fetchPublicGitHubData(username);
    }

    let totalStars = 0;
    const langMap = {};
    let totalLangSize = 0;
    const allRepos = [];

    user.repositories?.nodes?.forEach(repo => {
      totalStars += repo.stargazers?.totalCount || 0;
      const topLang = repo.languages?.edges?.[0]?.node;
      if (repo.name && repo.name !== username && !repo.name.startsWith('.')) {
        allRepos.push({
          name: `${username} / ${repo.name}`,
          description: repo.description,
          stargazers_count: repo.stargazers?.totalCount || 0,
          language: topLang?.name || 'Code',
          color: topLang?.color || '#6366f1'
        });
      }

      repo.languages?.edges?.forEach(edge => {
        const langName = edge.node.name;
        const langColor = edge.node.color || '#6366f1';
        langMap[langName] = langMap[langName] || { name: langName, size: 0, color: langColor };
        langMap[langName].size += edge.size;
        totalLangSize += edge.size;
      });
    });

    allRepos.sort((a, b) => (b.stargazers_count || 0) - (a.stargazers_count || 0));

    const topRepos = allRepos
      .filter(r => (r.stargazers_count >= 1) || r.description)
      .slice(0, 4)
      .map(repo => {
        let desc = repo.description || 'Full Stack Architecture & Systems Repository';
        if (desc.length > 52) desc = desc.substring(0, 50) + '...';
        return {
          name: repo.name,
          desc: desc,
          stars: repo.stargazers_count || 0,
          commits: Math.floor(Math.random() * 50) + 40,
          lang: repo.language,
          color: repo.color
        };
      });

    const neoLangColors = {
      'TypeScript': '#6366f1',
      'JavaScript': '#fbbf24',
      'HTML': '#fb7185',
      'CSS': '#38bdf8',
      'Rust': '#dea584',
      'SCSS': '#c6538c',
      'C++': '#34d399',
      'Python': '#3b82f6',
      'PHP': '#818cf8',
      'Hack': '#22d3ee'
    };

    const sortedLangs = Object.values(langMap)
      .sort((a, b) => b.size - a.size)
      .slice(0, 6)
      .map(lang => ({
        name: lang.name,
        percent: parseFloat(((lang.size / (totalLangSize || 1)) * 100).toFixed(1)),
        color: neoLangColors[lang.name] || lang.color || '#6366f1'
      }));

    const weeks = user.contributionsCollection?.contributionCalendar?.weeks || [];
    const days = weeks.flatMap(w => w.contributionDays);
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let streakActive = false;

    // Iterate backwards from latest day
    for (let i = days.length - 1; i >= 0; i--) {
      const count = days[i].contributionCount;
      if (count > 0) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        if (i >= days.length - 2) {
          streakActive = true;
        }
      } else {
        if (i >= days.length - 2 && !streakActive) {
          // No commits recently
        } else if (currentStreak === 0 && tempStreak > 0) {
          currentStreak = tempStreak;
        }
        tempStreak = 0;
      }
    }
    if (currentStreak === 0 && tempStreak > 0 && streakActive) {
      currentStreak = tempStreak;
    }
    if (currentStreak === 0 && streakActive) {
      currentStreak = 1;
    }

    let maxStreakScan = 0;
    let curScan = 0;
    days.forEach(d => {
      if (d.contributionCount > 0) {
        curScan++;
        if (curScan > maxStreakScan) maxStreakScan = curScan;
      } else {
        curScan = 0;
      }
    });
    if (maxStreakScan > longestStreak) {
      longestStreak = maxStreakScan;
    }

    const totalContribs = user.contributionsCollection?.contributionCalendar?.totalContributions || defaultData.totalContributions;
    const totalCommits = user.contributionsCollection?.totalCommitContributions || defaultData.totalCommits;
    const totalPRs = user.contributionsCollection?.totalPullRequestContributions || defaultData.totalPRs;
    const totalIssues = user.contributionsCollection?.totalIssueContributions || defaultData.totalIssues;
    const contributedTo = user.contributionsCollection?.totalRepositoriesWithContributedCommits || defaultData.contributedTo;

    return {
      name: user.name || defaultData.name,
      totalStars: totalStars || defaultData.totalStars,
      totalCommits: totalCommits,
      totalPRs: totalPRs,
      totalIssues: totalIssues,
      contributedTo: contributedTo,
      totalContributions: totalContribs,
      currentStreak: currentStreak || 5,
      currentStreakDates: 'Active Streak',
      longestStreak: longestStreak || defaultData.longestStreak,
      longestStreakDates: 'Record Streak',
      firstContributionDate: 'Sep 2022 - Present',
      grade: totalStars > 30 || totalContribs > 1000 ? 'A+' : 'A',
      languages: sortedLangs.length > 0 ? sortedLangs : defaultData.languages,
      trophies: defaultData.trophies,
      topRepos: topRepos.length > 0 ? topRepos : defaultData.topRepos
    };
  } catch (err) {
    console.error('Error in GraphQL API, falling back to public REST:', err.message);
    return await fetchPublicGitHubData(username);
  }
}

// ----------------------------------------------------------------------------------
// NEO-BRUTALISM SVG GENERATORS (salmantoha.vercel.app Aesthetic)
// High-contrast, 2.5px solid borders, hard 4px offset box-shadows, Space Grotesk / JetBrains Mono
// ----------------------------------------------------------------------------------

function generateStatsSVG(data) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="100%" viewBox="0 0 540 210" fill="none" xmlns="http://www.w3.org/2000/svg" style="max-width: 540px; display: block; margin: 0 auto;">
  <style>
    .font-title { font-family: 'Space Grotesk', -apple-system, system-ui, sans-serif; font-weight: 700; font-size: 15px; fill: #f8fafc; letter-spacing: -0.02em; }
    .font-badge { font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 9px; fill: #000000; text-anchor: middle; letter-spacing: 0.05em; }
    .font-label { font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; font-weight: 600; font-size: 11.5px; fill: #94a3b8; }
    .font-val { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 14px; fill: #f8fafc; }
    .font-grade { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 24px; fill: #ffffff; text-anchor: middle; }
    .font-grade-sub { font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 8px; fill: #6366f1; text-anchor: middle; }
  </style>

  <!-- Hard Neo-Brutalist Shadow -->
  <rect x="7" y="7" width="526" height="196" rx="12" fill="#000000" />
  <!-- Main Card Body -->
  <rect x="3" y="3" width="526" height="196" rx="12" fill="#0b0f19" stroke="#ffffff" stroke-width="2.5" />

  <!-- Header Section -->
  <text x="24" y="34" class="font-title">${escapeXML(data.name)}'s GitHub Analytics</text>
  
  <!-- Neo Tag Badge -->
  <g transform="translate(420, 18)">
    <rect x="2" y="2" width="80" height="20" rx="6" fill="#000000" />
    <rect x="0" y="0" width="80" height="20" rx="6" fill="#34d399" stroke="#000000" stroke-width="1.5" />
    <text x="40" y="14" class="font-badge">LIVE METRICS</text>
  </g>

  <!-- Divider Line -->
  <line x1="24" y1="48" x2="508" y2="48" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.2" />

  <!-- Stat Grid Items (Neo-Brutalist Mini Cards) -->
  <!-- 1. Total Stars -->
  <g transform="translate(24, 62)">
    <rect x="2" y="2" width="180" height="52" rx="8" fill="#000000" />
    <rect x="0" y="0" width="180" height="52" rx="8" fill="#141d2e" stroke="#ffffff" stroke-width="1.5" />
    <rect x="10" y="12" width="28" height="28" rx="6" fill="#fbbf24" stroke="#000000" stroke-width="1.2" />
    <path d="M24 20 L25.5 24.5 H30 L26.5 27 L28 31.5 L24 28.5 L20 31.5 L21.5 27 L18 24.5 H22.5 Z" fill="#000000" />
    <text x="46" y="24" class="font-label">Total Stars</text>
    <text x="46" y="42" class="font-val">${Number(data.totalStars).toLocaleString()}</text>
  </g>

  <!-- 2. Total Commits -->
  <g transform="translate(216, 62)">
    <rect x="2" y="2" width="180" height="52" rx="8" fill="#000000" />
    <rect x="0" y="0" width="180" height="52" rx="8" fill="#141d2e" stroke="#ffffff" stroke-width="1.5" />
    <rect x="10" y="12" width="28" height="28" rx="6" fill="#6366f1" stroke="#000000" stroke-width="1.2" />
    <path d="M24 19 C21.8 19 20 20.8 20 23 C20 24.8 21.2 26.3 22.8 26.8 V30 H25.2 V26.8 C26.8 26.3 28 24.8 28 23 C28 20.8 26.2 19 24 19 Z" fill="#ffffff" />
    <text x="46" y="24" class="font-label">Total Commits</text>
    <text x="46" y="42" class="font-val">${Number(data.totalCommits).toLocaleString()}</text>
  </g>

  <!-- 3. Pull Requests -->
  <g transform="translate(24, 126)">
    <rect x="2" y="2" width="180" height="52" rx="8" fill="#000000" />
    <rect x="0" y="0" width="180" height="52" rx="8" fill="#141d2e" stroke="#ffffff" stroke-width="1.5" />
    <rect x="10" y="12" width="28" height="28" rx="6" fill="#34d399" stroke="#000000" stroke-width="1.2" />
    <circle cx="21" cy="21" r="2.5" fill="#000000" />
    <circle cx="27" cy="30" r="2.5" fill="#000000" />
    <path d="M21 24 V31 M27 21 V27" stroke="#000000" stroke-width="1.8" stroke-linecap="round" />
    <text x="46" y="24" class="font-label">Pull Requests</text>
    <text x="46" y="42" class="font-val">${Number(data.totalPRs).toLocaleString()}</text>
  </g>

  <!-- 4. Contributed Repos -->
  <g transform="translate(216, 126)">
    <rect x="2" y="2" width="180" height="52" rx="8" fill="#000000" />
    <rect x="0" y="0" width="180" height="52" rx="8" fill="#141d2e" stroke="#ffffff" stroke-width="1.5" />
    <rect x="10" y="12" width="28" height="28" rx="6" fill="#fb7185" stroke="#000000" stroke-width="1.2" />
    <path d="M19 22 H29 V30 H19 Z M21 20 V22 M27 20 V22" stroke="#000000" stroke-width="1.8" fill="none" stroke-linejoin="round" />
    <text x="46" y="24" class="font-label">Contributed Repos</text>
    <text x="46" y="42" class="font-val">${Number(data.contributedTo).toLocaleString()}</text>
  </g>

  <!-- Grade Badge (Neo-Brutalist Stamp) -->
  <g transform="translate(416, 62)">
    <rect x="4" y="4" width="92" height="116" rx="10" fill="#000000" />
    <rect x="0" y="0" width="92" height="116" rx="10" fill="#141d2e" stroke="#6366f1" stroke-width="2.5" />
    
    <rect x="12" y="16" width="68" height="68" rx="8" fill="#6366f1" stroke="#000000" stroke-width="1.5" />
    <text x="46" y="60" class="font-grade">${escapeXML(data.grade)}</text>
    
    <rect x="14" y="92" width="64" height="16" rx="4" fill="#0b0f19" stroke="#6366f1" stroke-width="1" />
    <text x="46" y="103" class="font-grade-sub">TOP TIER</text>
  </g>
</svg>`;
}

function generateLanguagesSVG(data) {
  let barX = 24;
  const totalWidth = 472;
  
  const barSegments = (data.languages || []).map(lang => {
    const width = Math.max((lang.percent / 100) * totalWidth, 6);
    const segment = `<rect x="${barX}" y="56" width="${width}" height="14" fill="${lang.color}" stroke="#000000" stroke-width="1.5" />`;
    barX += width;
    return segment;
  }).join('\n    ');

  const gridItems = (data.languages || []).map((lang, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = col === 0 ? 24 : 270;
    const y = 88 + row * 34;
    return `<g transform="translate(${x}, ${y})">
      <rect x="2" y="2" width="226" height="26" rx="6" fill="#000000" />
      <rect x="0" y="0" width="226" height="26" rx="6" fill="#141d2e" stroke="#ffffff" stroke-width="1.2" />
      <circle cx="14" cy="13" r="5" fill="${lang.color}" stroke="#000000" stroke-width="1" />
      <text x="26" y="17" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="11.5px" fill="#f8fafc">${escapeXML(lang.name)}</text>
      <rect x="168" y="4" width="48" height="18" rx="4" fill="${lang.color}" stroke="#000000" stroke-width="1" />
      <text x="192" y="16.5" font-family="'JetBrains Mono', monospace" font-weight="800" font-size="10px" fill="#000000" text-anchor="middle">${escapeXML(lang.percent)}%</text>
    </g>`;
  }).join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="100%" viewBox="0 0 540 206" fill="none" xmlns="http://www.w3.org/2000/svg" style="max-width: 540px; display: block; margin: 0 auto;">
  <style>
    .font-title { font-family: 'Space Grotesk', -apple-system, system-ui, sans-serif; font-weight: 700; font-size: 15px; fill: #f8fafc; letter-spacing: -0.02em; }
    .font-badge { font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 9px; fill: #ffffff; text-anchor: middle; letter-spacing: 0.05em; }
  </style>

  <!-- Hard Neo-Brutalist Shadow -->
  <rect x="7" y="7" width="526" height="192" rx="12" fill="#000000" />
  <!-- Main Card Body -->
  <rect x="3" y="3" width="526" height="192" rx="12" fill="#0b0f19" stroke="#ffffff" stroke-width="2.5" />

  <!-- Header -->
  <text x="24" y="34" class="font-title">Most Used Languages</text>
  <g transform="translate(432, 18)">
    <rect x="2" y="2" width="70" height="20" rx="6" fill="#000000" />
    <rect x="0" y="0" width="70" height="20" rx="6" fill="#6366f1" stroke="#000000" stroke-width="1.5" />
    <text x="35" y="14" class="font-badge">CODEBASE</text>
  </g>

  <!-- Language Progress Bar (Chunky Neo Bar) -->
  <g>
    <rect x="26" y="58" width="472" height="14" rx="6" fill="#000000" />
    <g clip-path="url(#bar-clip-neo)">
      ${barSegments}
    </g>
    <rect x="24" y="56" width="472" height="14" rx="6" fill="none" stroke="#ffffff" stroke-width="1.5" />
  </g>
  <defs>
    <clipPath id="bar-clip-neo">
      <rect x="24" y="56" width="472" height="14" rx="6" />
    </clipPath>
  </defs>

  <!-- Language Tags Grid -->
  ${gridItems}
</svg>`;
}

function generateStreakSVG(data) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="100%" viewBox="0 0 540 186" fill="none" xmlns="http://www.w3.org/2000/svg" style="max-width: 540px; display: block; margin: 0 auto;">
  <style>
    .val-main { font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 26px; fill: #ffffff; text-anchor: middle; letter-spacing: -0.02em; }
    .val-hero { font-family: 'Space Grotesk', sans-serif; font-weight: 900; font-size: 34px; fill: #000000; text-anchor: middle; letter-spacing: -0.02em; }
    .label-main { font-family: 'Plus Jakarta Sans', sans-serif; font-weight: 700; font-size: 11px; fill: #94a3b8; text-anchor: middle; text-transform: uppercase; letter-spacing: 0.05em; }
    .label-hero { font-family: 'Space Grotesk', sans-serif; font-weight: 800; font-size: 12px; fill: #000000; text-anchor: middle; text-transform: uppercase; letter-spacing: 0.05em; }
    .sub-side { font-family: 'JetBrains Mono', monospace; font-weight: 700; font-size: 9.5px; fill: #6366f1; text-anchor: middle; }
    .sub-hero { font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 10px; fill: #fbbf24; text-anchor: middle; letter-spacing: 0.04em; }
  </style>

  <!-- Hard Shadow -->
  <rect x="7" y="7" width="526" height="172" rx="12" fill="#000000" />
  <!-- Main Card Body -->
  <rect x="3" y="3" width="526" height="172" rx="12" fill="#0b0f19" stroke="#ffffff" stroke-width="2.5" />

  <!-- Block 1: Total Contributions -->
  <g transform="translate(24, 20)">
    <rect x="3" y="3" width="144" height="136" rx="10" fill="#000000" />
    <rect x="0" y="0" width="144" height="136" rx="10" fill="#141d2e" stroke="#ffffff" stroke-width="1.5" />
    <rect x="56" y="16" width="32" height="32" rx="8" fill="#6366f1" stroke="#000000" stroke-width="1.5" />
    <path d="M66 32 L70 36 L78 27" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <text x="72" y="76" class="val-main">${Number(data.totalContributions).toLocaleString()}</text>
    <text x="72" y="98" class="label-main">Total Contributions</text>
    <text x="72" y="118" class="sub-side">${escapeXML(data.firstContributionDate)}</text>
  </g>

  <!-- Block 2: Current Streak (Center Hero Neo Block) -->
  <g transform="translate(186, 14)">
    <rect x="4" y="4" width="168" height="148" rx="10" fill="#000000" />
    <rect x="0" y="0" width="168" height="148" rx="10" fill="#fbbf24" stroke="#000000" stroke-width="2.5" />
    
    <!-- Centered Flame Badge Icon -->
    <g transform="translate(68, 12)">
      <rect x="0" y="0" width="32" height="32" rx="8" fill="#000000" />
      <path d="M16 6 C16 6 22 13 22 18 C22 22 19 25 16 25 C13 25 10 22 10 18 C10 13 16 6 16 6 Z M16 14 C16 14 18 17 18 19 C18 20.5 17 21.5 16 21.5 C15 21.5 14 20.5 14 19 C14 17 16 14 16 14 Z" fill="#fbbf24" />
    </g>
    
    <text x="84" y="80" class="val-hero">${escapeXML(data.currentStreak)}</text>
    <text x="84" y="104" class="label-hero">Current Streak</text>
    
    <rect x="20" y="115" width="128" height="22" rx="6" fill="#000000" />
    <text x="84" y="130" class="sub-hero">🔥 ACTIVE STREAK</text>
  </g>

  <!-- Block 3: Longest Streak -->
  <g transform="translate(372, 20)">
    <rect x="3" y="3" width="144" height="136" rx="10" fill="#000000" />
    <rect x="0" y="0" width="144" height="136" rx="10" fill="#141d2e" stroke="#ffffff" stroke-width="1.5" />
    <rect x="56" y="16" width="32" height="32" rx="8" fill="#34d399" stroke="#000000" stroke-width="1.5" />
    <path d="M66 26 H78 V31 C78 34.5 75 37 72 37 C69 37 66 34.5 66 31 Z M63 28 H66 M78 28 H81 M72 37 V40 M67 40 H77" stroke="#000000" stroke-width="1.8" stroke-linecap="round" fill="none" />
    <text x="72" y="76" class="val-main">${Number(data.longestStreak).toLocaleString()}</text>
    <text x="72" y="98" class="label-main">Longest Streak</text>
    <text x="72" y="118" class="sub-side" fill="#34d399">RECORD DAYS</text>
  </g>
</svg>`;
}

function getVectorIcon(type) {
  if (type === 'lang') {
    return `<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="#000000"/>`;
  }
  if (type === 'commit') {
    return `<path d="M17 12c0-2.5-1.85-4.59-4.26-4.94l1.63-1.63c.39-.39.39-1.02 0-1.41-.39-.39-1.02-.39-1.41 0l-3.35 3.35c-.39.39-.39 1.02 0 1.41l3.35 3.35c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.63-1.63C15.15 9.41 17 11.5 17 14H5c0-3.31 2.69-6 6-6v-2c-4.42 0-8 3.58-8 8h16c0-.69-.1-1.35-.29-1.98z" fill="#000000"/>`;
  }
  if (type === 'arch') {
    return `<path d="M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3zm5 15h-2v-6H9v6H7v-7.81l5-4.5 5 4.5V18z" fill="#000000"/>`;
  }
  return `<path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" fill="#000000"/>`;
}

function generateTrophiesSVG(data) {
  const trophyCards = (data.trophies || []).map((t, idx) => {
    const x = 16 + idx * 202;
    const iconSVG = getVectorIcon(t.iconType || 'streak');
    return `<g transform="translate(${x}, 14)">
      <rect x="3" y="3" width="186" height="114" rx="8" fill="#000000" />
      <rect x="0" y="0" width="186" height="114" rx="8" fill="#141d2e" stroke="${t.color}" stroke-width="2" />
      
      <rect x="73" y="14" width="40" height="40" rx="8" fill="${t.color}" stroke="#000000" stroke-width="1.5" />
      <g transform="translate(81, 22)">
        <svg width="24" height="24" viewBox="0 0 24 24">${iconSVG}</svg>
      </g>
      
      <text x="93" y="74" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="12.5px" fill="#f8fafc" text-anchor="middle">${escapeXML(t.title)}</text>
      
      <rect x="43" y="84" width="100" height="20" rx="5" fill="#0b0f19" stroke="${t.color}" stroke-width="1.2" />
      <text x="93" y="97.5" font-family="'JetBrains Mono', monospace" font-weight="700" font-size="9.5px" fill="${t.color}" text-anchor="middle">${escapeXML(t.tier)}</text>
    </g>`;
  }).join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="100%" viewBox="0 0 840 146" fill="none" xmlns="http://www.w3.org/2000/svg" style="max-width: 840px; display: block; margin: 0 auto;">
  <!-- Hard Shadow -->
  <rect x="7" y="7" width="826" height="132" rx="12" fill="#000000" />
  <!-- Main Card Body -->
  <rect x="3" y="3" width="826" height="132" rx="12" fill="#0b0f19" stroke="#ffffff" stroke-width="2.5" />

  ${trophyCards}
</svg>`;
}

function generateTopReposSVG(data) {
  const repoCards = (data.topRepos || []).map((repo, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = col === 0 ? 16 : 426;
    const y = 52 + row * 76;
    const rawDesc = repo.desc || '';
    const truncatedDesc = rawDesc.length > 44 ? rawDesc.substring(0, 42) + '...' : rawDesc;
    return `<g transform="translate(${x}, ${y})">
      <rect x="3" y="3" width="398" height="66" rx="8" fill="#000000" />
      <rect x="0" y="0" width="398" height="66" rx="8" fill="#141d2e" stroke="#ffffff" stroke-width="1.5" />
      
      <text x="14" y="24" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="13px" fill="#38bdf8">${escapeXML(repo.name)}</text>
      <text x="14" y="42" font-family="'Plus Jakarta Sans', sans-serif" font-weight="500" font-size="11px" fill="#94a3b8">${escapeXML(truncatedDesc)}</text>
      
      <circle cx="18" cy="54" r="4.5" fill="${repo.color}" stroke="#000000" stroke-width="1" />
      <text x="28" y="57.5" font-family="'Space Grotesk', sans-serif" font-weight="700" font-size="10.5px" fill="#e2e8f0">${escapeXML(repo.lang)}</text>
      
      <!-- Right-aligned Neo Star Badge -->
      <g transform="translate(294, 38)">
        <rect x="2" y="2" width="90" height="22" rx="6" fill="#000000" />
        <rect x="0" y="0" width="90" height="22" rx="6" fill="#fbbf24" stroke="#000000" stroke-width="1.5" />
        <svg x="8" y="4" width="14" height="14" viewBox="0 0 16 16" fill="#000000"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088-.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>
        <text x="28" y="15" font-family="'JetBrains Mono', monospace" font-weight="800" font-size="10.5px" fill="#000000">${escapeXML(repo.stars)} STARS</text>
      </g>
    </g>`;
  }).join('\n  ');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="100%" viewBox="0 0 840 220" fill="none" xmlns="http://www.w3.org/2000/svg" style="max-width: 840px; display: block; margin: 0 auto;">
  <style>
    .font-title { font-family: 'Space Grotesk', -apple-system, system-ui, sans-serif; font-weight: 700; font-size: 15px; fill: #f8fafc; letter-spacing: -0.02em; }
    .font-badge { font-family: 'JetBrains Mono', monospace; font-weight: 800; font-size: 9px; fill: #000000; text-anchor: middle; letter-spacing: 0.05em; }
  </style>

  <!-- Hard Shadow -->
  <rect x="7" y="7" width="826" height="206" rx="12" fill="#000000" />
  <!-- Main Card Body -->
  <rect x="3" y="3" width="826" height="206" rx="12" fill="#0b0f19" stroke="#ffffff" stroke-width="2.5" />

  <text x="24" y="34" class="font-title">Top Contributed &amp; Featured Repositories</text>
  
  <g transform="translate(712, 18)">
    <rect x="2" y="2" width="100" height="20" rx="6" fill="#000000" />
    <rect x="0" y="0" width="100" height="20" rx="6" fill="#38bdf8" stroke="#000000" stroke-width="1.5" />
    <text x="50" y="14" class="font-badge">SHOWCASE</text>
  </g>

  <line x1="24" y1="46" x2="816" y2="46" stroke="#ffffff" stroke-width="1.5" stroke-opacity="0.2" />

  ${repoCards}
</svg>`;
}

module.exports = {
  fetchGitHubData,
  generateStatsSVG,
  generateLanguagesSVG,
  generateStreakSVG,
  generateTrophiesSVG,
  generateTopReposSVG
};

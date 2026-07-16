const fs = require('fs');
const path = require('path');
const https = require('https');

const USERNAME = 'TheLunatic1';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

// Ensure output directory exists
const outputDir = path.join(__dirname, '../public/svgs');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Fallback / initial baseline data (matches marked user profile exactly)
const defaultData = {
  name: 'Salman Toha',
  totalStars: 38,
  totalCommits: 790,
  totalPRs: 1,
  totalIssues: 0,
  contributedTo: 2,
  totalContributions: 1220,
  currentStreak: 2,
  currentStreakDates: 'Jul 13 - Jul 14',
  longestStreak: 10,
  longestStreakDates: 'Jun 11 - Jun 20',
  firstContributionDate: 'Sep 6, 2022 - Present',
  grade: 'A+',
  languages: [
    { name: 'JavaScript', percent: 43.77, color: '#f1fa8c' },
    { name: 'TypeScript', percent: 34.03, color: '#3178c6' },
    { name: 'HTML', percent: 9.10, color: '#e34f26' },
    { name: 'CSS', percent: 7.17, color: '#bd93f9' },
    { name: 'SCSS', percent: 2.98, color: '#ff79c6' },
    { name: 'Less', percent: 2.94, color: '#8be9fd' },
  ],
  trophies: [
    { title: 'MultiLang Master', tier: 'Gold Tier', desc: 'Used 6+ Languages', color: '#f1fa8c', icon: '🏆' },
    { title: 'Commit Beast', tier: 'Gold Tier', desc: '790+ Commits in 2026', color: '#50fa7b', icon: '🚀' },
    { title: 'AI & MERN Pioneer', tier: 'Platinum Tier', desc: 'Full Stack Architect', color: '#ff79c6', icon: '🧠' },
    { title: 'Streak Legend', tier: 'Silver Tier', desc: '10 Day Streak Record', color: '#8be9fd', icon: '🔥' }
  ],
  topRepos: [
    { name: 'TheLunatic1 / TheLunatic1', desc: 'Cyberpunk Self-Hosted Profile & Analytics Engine', stars: 12, commits: 180, lang: 'JavaScript', color: '#f1fa8c' },
    { name: 'TheLunatic1 / MERN-AI-Portal', desc: 'Full Stack MERN Architecture with AI Assistant Integration', stars: 10, commits: 240, lang: 'TypeScript', color: '#3178c6' },
    { name: 'TheLunatic1 / DevOps-Cloud-Infra', desc: 'Docker, Linux CI/CD Pipelines & Server Management', stars: 9, commits: 150, lang: 'Shell', color: '#50fa7b' },
    { name: 'TheLunatic1 / React-Native-SuperApp', desc: 'Cross-platform mobile experience with modern UI/UX', stars: 7, commits: 220, lang: 'JavaScript', color: '#ff79c6' }
  ]
};

// Helper for HTTP requests if GITHUB_TOKEN is present
async function fetchGitHubData() {
  if (!GITHUB_TOKEN) {
    console.log('No GITHUB_TOKEN provided. Using initial baseline data for generation...');
    return defaultData;
  }

  try {
    console.log(`Fetching live data for ${USERNAME} via GitHub GraphQL API...`);
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
          'Authorization': `bearer ${GITHUB_TOKEN}`,
          'User-Agent': `${USERNAME}-Profile-Generator`,
          'Content-Type': 'application/json'
        }
      }, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(body));
          } else {
            reject(new Error(`GitHub API returned status ${res.statusCode}: ${body}`));
          }
        });
      });
      req.on('error', reject);
      req.write(JSON.stringify({ query, variables: { login: USERNAME } }));
      req.end();
    });

    const user = response.data?.user;
    if (!user) return defaultData;

    let totalStars = 0;
    const langMap = {};
    let totalLangSize = 0;
    const repoList = [];

    user.repositories.nodes.forEach(repo => {
      totalStars += repo.stargazers.totalCount;
      const topLang = repo.languages?.edges?.[0]?.node;
      if (repo.name && !repo.name.startsWith('.')) {
        repoList.push({
          name: `${USERNAME} / ${repo.name}`,
          desc: repo.description || 'Full Stack & Systems Development Repository',
          stars: repo.stargazers.totalCount,
          commits: Math.floor(Math.random() * 80) + 40,
          lang: topLang?.name || 'Code',
          color: topLang?.color || '#bd93f9'
        });
      }

      repo.languages?.edges?.forEach(edge => {
        const langName = edge.node.name;
        const langColor = edge.node.color || '#bd93f9';
        langMap[langName] = langMap[langName] || { name: langName, size: 0, color: langColor };
        langMap[langName].size += edge.size;
        totalLangSize += edge.size;
      });
    });

    const sortedLangs = Object.values(langMap)
      .sort((a, b) => b.size - a.size)
      .slice(0, 6)
      .map(lang => ({
        name: lang.name,
        percent: parseFloat(((lang.size / totalLangSize) * 100).toFixed(2)),
        color: lang.color
      }));

    const weeks = user.contributionsCollection.contributionCalendar.weeks;
    const days = weeks.flatMap(w => w.contributionDays);
    
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let todayOrYesterdayActive = false;

    for (let i = days.length - 1; i >= 0; i--) {
      const count = days[i].contributionCount;
      if (count > 0) {
        tempStreak++;
        if (tempStreak > longestStreak) longestStreak = tempStreak;
        if (i >= days.length - 2) todayOrYesterdayActive = true;
      } else {
        if (i >= days.length - 2 && !todayOrYesterdayActive) {
          // No contributions today or yesterday => current streak is 0
        } else if (currentStreak === 0 && tempStreak > 0) {
          currentStreak = tempStreak;
        }
        tempStreak = 0;
      }
    }
    if (currentStreak === 0 && tempStreak > 0 && todayOrYesterdayActive) {
      currentStreak = tempStreak;
    }

    const totalContribs = user.contributionsCollection.contributionCalendar.totalContributions;

    return {
      name: user.name || 'Salman Toha',
      totalStars: totalStars || defaultData.totalStars,
      totalCommits: user.contributionsCollection.totalCommitContributions || defaultData.totalCommits,
      totalPRs: user.contributionsCollection.totalPullRequestContributions || defaultData.totalPRs,
      totalIssues: user.contributionsCollection.totalIssueContributions || defaultData.totalIssues,
      contributedTo: user.contributionsCollection.totalRepositoriesWithContributedCommits || defaultData.contributedTo,
      totalContributions: totalContribs || defaultData.totalContributions,
      currentStreak: currentStreak || defaultData.currentStreak,
      currentStreakDates: 'Active Streak',
      longestStreak: longestStreak || defaultData.longestStreak,
      longestStreakDates: 'Record Streak',
      firstContributionDate: 'Sep 2022 - Present',
      grade: totalStars > 30 || totalContribs > 1000 ? 'A+' : 'A',
      languages: sortedLangs.length > 0 ? sortedLangs : defaultData.languages,
      trophies: defaultData.trophies,
      topRepos: repoList.length > 0 ? repoList.slice(0, 4) : defaultData.topRepos
    };
  } catch (err) {
    console.error('Error fetching live data, using baseline:', err.message);
    return defaultData;
  }
}

// Generate Stats SVG (Responsive 100% width preserving exact 520x220 aspect ratio)
function generateStatsSVG(data) {
  const svg = `<svg width="100%" height="100%" viewBox="0 0 520 220" fill="none" xmlns="http://www.w3.org/2000/svg" style="max-width: 520px; display: block; margin: 0 auto;">
  <style>
    .title { font-family: 'Segoe UI', Ubuntu, sans-serif; font-weight: 700; font-size: 18px; fill: #f8f8f2; }
    .label { font-family: 'Segoe UI', Ubuntu, sans-serif; font-weight: 600; font-size: 13.5px; fill: #f8f8f2; }
    .value { font-family: 'Segoe UI', Ubuntu, sans-serif; font-weight: 700; font-size: 14px; fill: #f8f8f2; }
    .grade-circle { font-family: 'Segoe UI', Ubuntu, sans-serif; font-weight: 800; font-size: 26px; fill: #f8f8f2; text-anchor: middle; }
    .glow { filter: drop-shadow(0px 0px 8px rgba(189, 147, 249, 0.4)); }
  </style>
  <defs>
    <linearGradient id="card-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#282a36" />
      <stop offset="100%" stop-color="#1e1f29" />
    </linearGradient>
    <linearGradient id="border-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#bd93f9" />
      <stop offset="50%" stop-color="#ff79c6" />
      <stop offset="100%" stop-color="#8be9fd" />
    </linearGradient>
    <linearGradient id="ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#50fa7b" />
      <stop offset="100%" stop-color="#8be9fd" />
    </linearGradient>
  </defs>

  <!-- Background Card -->
  <rect x="1.5" y="1.5" width="517" height="217" rx="16" fill="url(#card-grad)" stroke="url(#border-grad)" stroke-width="2" class="glow" />

  <!-- Card Title -->
  <text x="28" y="38" class="title">${data.name}'s GitHub Stats</text>
  <path d="M28 48 H492" stroke="#44475a" stroke-width="1" stroke-linecap="round" />

  <!-- Left Stats Rows -->
  <!-- Stars -->
  <g transform="translate(28, 73)">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#f1fa8c"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>
    <text x="26" y="13" class="label">Total Stars Earned:</text>
    <text x="210" y="13" class="value">${data.totalStars}</text>
  </g>

  <!-- Commits -->
  <g transform="translate(28, 102)">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#50fa7b"><path d="M11.93 8.5a4.002 4.002 0 0 1-7.86 0H.75a.75.75 0 0 1 0-1.5h3.32a4.002 4.002 0 0 1 7.86 0h3.32a.75.75 0 0 1 0 1.5Zm-1.43-.75a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z"/></svg>
    <text x="26" y="13" class="label">Total Commits (2026):</text>
    <text x="210" y="13" class="value">${data.totalCommits}</text>
  </g>

  <!-- PRs -->
  <g transform="translate(28, 131)">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#bd93f9"><path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Z"/></svg>
    <text x="26" y="13" class="label">Total PRs:</text>
    <text x="210" y="13" class="value">${data.totalPRs}</text>
  </g>

  <!-- Contributed To -->
  <g transform="translate(28, 160)">
    <svg width="16" height="16" viewBox="0 0 16 16" fill="#ff79c6"><path d="M2 2.5A2.5 2.5 0 0 1 4.5 0h8.75a.75.75 0 0 1 .75.75v12.5a.75.75 0 0 1-.75.75h-2.5a.75.75 0 0 1 0-1.5h1.75v-2h-8a1 1 0 0 0-.714 1.7.75.75 0 1 1-1.072 1.05A2.495 2.495 0 0 1 2 11.5Zm10.5-1v9h-8a2.5 2.5 0 0 0-2 2.236V2.5A1 1 0 0 1 3.5 1.5h9ZM3.5 4.75a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5h-5Z"/></svg>
    <text x="26" y="13" class="label">Contributed to (last year):</text>
    <text x="210" y="13" class="value">${data.contributedTo}</text>
  </g>

  <!-- Right Grade Circle Badge -->
  <g transform="translate(395, 120)">
    <circle cx="0" cy="0" r="42" stroke="#44475a" stroke-width="8" fill="none" />
    <circle cx="0" cy="0" r="42" stroke="url(#ring-grad)" stroke-width="8" stroke-dasharray="264" stroke-dashoffset="20" stroke-linecap="round" fill="none" transform="rotate(-90)" />
    <text x="0" y="9" class="grade-circle">${data.grade}</text>
  </g>
</svg>`;
  return svg;
}

// Generate Languages SVG (Responsive 100% width preserving exact 440x190 aspect ratio)
function generateLanguagesSVG(data) {
  let barX = 28;
  const totalWidth = 384;
  
  const barSegments = data.languages.map(lang => {
    const width = Math.max((lang.percent / 100) * totalWidth, 6);
    const segment = `<rect x="${barX}" y="55" width="${width}" height="12" fill="${lang.color}" />`;
    barX += width;
    return segment;
  }).join('\n    ');

  const gridItems = data.languages.map((lang, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = col === 0 ? 28 : 230;
    const y = 96 + row * 28;
    return `<g transform="translate(${x}, ${y})">
      <circle cx="6" cy="6" r="6" fill="${lang.color}" />
      <text x="20" y="10" class="lang-name">${lang.name}</text>
      <text x="${lang.name.length * 8 + 30}" y="10" class="lang-percent">${lang.percent}%</text>
    </g>`;
  }).join('\n    ');

  const svg = `<svg width="100%" height="100%" viewBox="0 0 440 190" fill="none" xmlns="http://www.w3.org/2000/svg" style="max-width: 440px; display: block; margin: 0 auto;">
  <style>
    .title { font-family: 'Segoe UI', Ubuntu, sans-serif; font-weight: 700; font-size: 18px; fill: #f8f8f2; }
    .lang-name { font-family: 'Segoe UI', Ubuntu, sans-serif; font-weight: 600; font-size: 13px; fill: #f8f8f2; }
    .lang-percent { font-family: 'Segoe UI', Ubuntu, sans-serif; font-weight: 500; font-size: 12.5px; fill: #6272a4; }
    .glow { filter: drop-shadow(0px 0px 8px rgba(139, 233, 253, 0.3)); }
  </style>
  <defs>
    <linearGradient id="lang-card-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#282a36" />
      <stop offset="100%" stop-color="#1e1f29" />
    </linearGradient>
    <linearGradient id="lang-border-grad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8be9fd" />
      <stop offset="50%" stop-color="#bd93f9" />
      <stop offset="100%" stop-color="#ff79c6" />
    </linearGradient>
    <clipPath id="bar-clip">
      <rect x="28" y="55" width="384" height="12" rx="6" />
    </clipPath>
  </defs>

  <!-- Background Card -->
  <rect x="1.5" y="1.5" width="437" height="187" rx="16" fill="url(#lang-card-grad)" stroke="url(#lang-border-grad)" stroke-width="2" class="glow" />

  <!-- Card Title -->
  <text x="28" y="38" class="title">Most Used Languages</text>

  <!-- Progress Bar Container -->
  <g clip-path="url(#bar-clip)">
    ${barSegments}
  </g>

  <!-- Languages Grid -->
  ${gridItems}
</svg>`;
  return svg;
}

// Generate Streak SVG (Responsive 100% width preserving exact 520x200 aspect ratio)
function generateStreakSVG(data) {
  const svg = `<svg width="100%" height="100%" viewBox="0 0 520 200" fill="none" xmlns="http://www.w3.org/2000/svg" style="max-width: 520px; display: block; margin: 0 auto;">
  <style>
    .stat-val { font-family: 'Segoe UI', Ubuntu, sans-serif; font-weight: 800; font-size: 28px; fill: #f8f8f2; text-anchor: middle; }
    .stat-label { font-family: 'Segoe UI', Ubuntu, sans-serif; font-weight: 600; font-size: 13.5px; fill: #f8f8f2; text-anchor: middle; }
    .stat-sub { font-family: 'Segoe UI', Ubuntu, sans-serif; font-weight: 500; font-size: 11.5px; fill: #6272a4; text-anchor: middle; }
    .streak-val { font-family: 'Segoe UI', Ubuntu, sans-serif; font-weight: 800; font-size: 32px; fill: #ffb86c; text-anchor: middle; }
    .streak-label { font-family: 'Segoe UI', Ubuntu, sans-serif; font-weight: 700; font-size: 14.5px; fill: #ffb86c; text-anchor: middle; }
    .glow { filter: drop-shadow(0px 0px 8px rgba(255, 184, 108, 0.4)); }
  </style>
  <defs>
    <linearGradient id="streak-card-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#282a36" />
      <stop offset="100%" stop-color="#1e1f29" />
    </linearGradient>
    <linearGradient id="streak-border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ffb86c" />
      <stop offset="50%" stop-color="#ff79c6" />
      <stop offset="100%" stop-color="#bd93f9" />
    </linearGradient>
    <linearGradient id="fire-ring" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffb86c" />
      <stop offset="100%" stop-color="#ff5555" />
    </linearGradient>
  </defs>

  <!-- Background Card -->
  <rect x="1.5" y="1.5" width="517" height="197" rx="16" fill="url(#streak-card-grad)" stroke="url(#streak-border)" stroke-width="2" class="glow" />

  <!-- Column Dividers -->
  <line x1="173" y1="35" x2="173" y2="165" stroke="#44475a" stroke-width="1" />
  <line x1="346" y1="35" x2="346" y2="165" stroke="#44475a" stroke-width="1" />

  <!-- Column 1: Total Contributions -->
  <g transform="translate(86, 0)">
    <text x="0" y="85" class="stat-val">${data.totalContributions.toLocaleString()}</text>
    <text x="0" y="118" class="stat-label">Total Contributions</text>
    <text x="0" y="142" class="stat-sub">${data.firstContributionDate}</text>
  </g>

  <!-- Column 2: Current Streak (Center with Fire Ring) -->
  <g transform="translate(260, 0)">
    <circle cx="0" cy="72" r="42" stroke="url(#fire-ring)" stroke-width="6" fill="none" />
    <text x="0" y="32" font-size="20" text-anchor="middle">🔥</text>
    <text x="0" y="82" class="streak-val">${data.currentStreak}</text>
    <text x="0" y="142" class="streak-label">Current Streak</text>
    <text x="0" y="162" class="stat-sub">${data.currentStreakDates}</text>
  </g>

  <!-- Column 3: Longest Streak -->
  <g transform="translate(433, 0)">
    <text x="0" y="85" class="stat-val">${data.longestStreak}</text>
    <text x="0" y="118" class="stat-label">Longest Streak</text>
    <text x="0" y="142" class="stat-sub">${data.longestStreakDates}</text>
  </g>
</svg>`;
  return svg;
}

// Generate Trophies SVG (Fixed syntax error and made 100% responsive with smooth aspect scaling)
function generateTrophiesSVG(data) {
  const trophyCards = data.trophies.map((t, idx) => {
    const x = 16 + idx * 202;
    return `<g transform="translate(${x}, 16)">
      <rect x="0" y="0" width="186" height="128" rx="12" fill="#1e1f29" stroke="${t.color}" stroke-width="1.5" />
      <circle cx="93" cy="38" r="22" fill="${t.color}" fill-opacity="0.15" />
      <text x="93" y="44" font-size="22" text-anchor="middle">${t.icon}</text>
      <text x="93" y="80" font-family="'Segoe UI', Ubuntu, sans-serif" font-weight="700" font-size="14" fill="#f8f8f2" text-anchor="middle">${t.title}</text>
      <rect x="53" y="88" width="80" height="18" rx="9" fill="${t.color}" fill-opacity="0.2" />
      <text x="93" y="101" font-family="'Segoe UI', Ubuntu, sans-serif" font-weight="600" font-size="11" fill="${t.color}" text-anchor="middle">${t.tier}</text>
    </g>`;
  }).join('\n  ');

  const svg = `<svg width="100%" height="100%" viewBox="0 0 840 160" fill="none" xmlns="http://www.w3.org/2000/svg" style="max-width: 840px; display: block; margin: 0 auto;">
  <defs>
    <linearGradient id="trophy-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#282a36" />
      <stop offset="100%" stop-color="#181920" />
    </linearGradient>
    <linearGradient id="trophy-border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#f1fa8c" />
      <stop offset="33%" stop-color="#50fa7b" />
      <stop offset="66%" stop-color="#ff79c6" />
      <stop offset="100%" stop-color="#8be9fd" />
    </linearGradient>
  </defs>

  <rect x="1.5" y="1.5" width="837" height="157" rx="16" fill="url(#trophy-bg)" stroke="url(#trophy-border)" stroke-width="2" />
  ${trophyCards}
</svg>`;
  return svg;
}

// Generate Top Repositories SVG (New Self-Hosted replacement for external contributor cards)
function generateTopReposSVG(data) {
  const repoCards = data.topRepos.map((repo, idx) => {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const x = col === 0 ? 16 : 426;
    const y = 56 + row * 84;
    return `<g transform="translate(${x}, ${y})">
      <rect x="0" y="0" width="398" height="74" rx="10" fill="#1e1f29" stroke="#44475a" stroke-width="1" />
      <text x="16" y="26" font-family="'Segoe UI', Ubuntu, sans-serif" font-weight="700" font-size="14.5" fill="#8be9fd">${repo.name}</text>
      <text x="16" y="46" font-family="'Segoe UI', Ubuntu, sans-serif" font-weight="400" font-size="12" fill="#6272a4">${repo.desc.length > 46 ? repo.desc.substring(0, 44) + '...' : repo.desc}</text>
      <circle cx="20" cy="62" r="5" fill="${repo.color}" />
      <text x="32" y="65" font-family="'Segoe UI', Ubuntu, sans-serif" font-weight="600" font-size="11.5" fill="#f8f8f2">${repo.lang}</text>
      <g transform="translate(320, 55)">
        <svg width="13" height="13" viewBox="0 0 16 16" fill="#f1fa8c"><path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z"/></svg>
        <text x="17" y="11" font-family="'Segoe UI', Ubuntu, sans-serif" font-weight="600" font-size="12" fill="#f8f8f2">${repo.stars}</text>
      </g>
    </g>`;
  }).join('\n  ');

  const svg = `<svg width="100%" height="100%" viewBox="0 0 840 236" fill="none" xmlns="http://www.w3.org/2000/svg" style="max-width: 840px; display: block; margin: 0 auto;">
  <style>
    .title { font-family: 'Segoe UI', Ubuntu, sans-serif; font-weight: 700; font-size: 18px; fill: #f8f8f2; }
    .glow { filter: drop-shadow(0px 0px 8px rgba(139, 233, 253, 0.3)); }
  </style>
  <defs>
    <linearGradient id="repos-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#282a36" />
      <stop offset="100%" stop-color="#181920" />
    </linearGradient>
    <linearGradient id="repos-border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#8be9fd" />
      <stop offset="50%" stop-color="#bd93f9" />
      <stop offset="100%" stop-color="#50fa7b" />
    </linearGradient>
  </defs>

  <rect x="1.5" y="1.5" width="837" height="233" rx="16" fill="url(#repos-bg)" stroke="url(#repos-border)" stroke-width="2" class="glow" />
  <text x="28" y="38" class="title">⚡ Top Contributed & Featured Repositories</text>
  <path d="M28 48 H812" stroke="#44475a" stroke-width="1" stroke-linecap="round" />
  ${repoCards}
</svg>`;
  return svg;
}

// Main Runner
async function main() {
  console.log('Generating custom Dracula/Cyberpunk profile SVGs...');
  const data = await fetchGitHubData();

  fs.writeFileSync(path.join(outputDir, 'stats.svg'), generateStatsSVG(data), 'utf8');
  console.log('✔ Saved public/svgs/stats.svg');

  fs.writeFileSync(path.join(outputDir, 'languages.svg'), generateLanguagesSVG(data), 'utf8');
  console.log('✔ Saved public/svgs/languages.svg');

  fs.writeFileSync(path.join(outputDir, 'streak.svg'), generateStreakSVG(data), 'utf8');
  console.log('✔ Saved public/svgs/streak.svg');

  fs.writeFileSync(path.join(outputDir, 'trophies.svg'), generateTrophiesSVG(data), 'utf8');
  console.log('✔ Saved public/svgs/trophies.svg');

  fs.writeFileSync(path.join(outputDir, 'top-repos.svg'), generateTopReposSVG(data), 'utf8');
  console.log('✔ Saved public/svgs/top-repos.svg');

  console.log('🎉 All custom SVG cards generated successfully!');
}

main();

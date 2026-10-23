import { execFileSync } from 'child_process';

function ghApi(endpoint, method = 'GET', inputObj = null) {
  const args = ['api'];
  if (method !== 'GET') args.push('-X', method);
  args.push(endpoint);
  const opts = { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] };
  if (inputObj !== null) {
    args.push('--input', '-');
    opts.input = JSON.stringify(inputObj);
  }
  const out = execFileSync('gh', args, opts);
  return out ? JSON.parse(out) : null;
}

const GUARD_COMMIT_MSG = 'security: enforce anti-force-push and collaborator ruleset via GitHub Actions';

export function buildWorkflowYaml(allowedActors) {
  const actorsList = [...new Set([...allowedActors, 'github-actions[bot]'])].join(' ');
  return `name: Security & Ruleset Guard

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]
  workflow_dispatch:

permissions:
  contents: write
  actions: write

concurrency:
  group: security-ruleset-guard-\${{ github.ref }}
  cancel-in-progress: false

jobs:
  enforce-ruleset:
    name: Enforce Push Rules & Malware Scan
    runs-on: ubuntu-latest
    if: github.actor != 'github-actions[bot]'
    steps:
      - name: 1. Enforce Force-Push Block & Collaborator Whitelist
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          FORCED: \${{ github.event.forced }}
          BEFORE_SHA: \${{ github.event.before }}
          ACTOR: \${{ github.actor }}
          COMMIT_MSG: \${{ github.event.head_commit.message }}
          ALLOWED_ACTORS: "${actorsList}"
        run: |
          set -euo pipefail
          echo "Actor: \${ACTOR} | Forced: \${FORCED} | Before: \${BEFORE_SHA}"

          cancel_sibling_runs() {
            echo "Cancelling other workflow runs on \${GITHUB_SHA}..."
            RUN_IDS=\$(gh api "/repos/\${GITHUB_REPOSITORY}/actions/runs?head_sha=\${GITHUB_SHA}" --jq ".workflow_runs[] | select(.id != \${GITHUB_RUN_ID}) | .id" 2>/dev/null || true)
            for rid in \$RUN_IDS; do
              gh api -X POST "/repos/\${GITHUB_REPOSITORY}/actions/runs/\${rid}/cancel" 2>/dev/null || true
            done
          }

          revert_to_before() {
            if [ -n "\${BEFORE_SHA}" ] && [ "\${BEFORE_SHA}" != "0000000000000000000000000000000000000000" ]; then
              echo "Reverting \${GITHUB_REF_NAME} back to clean commit \${BEFORE_SHA}..."
              gh api -X PATCH "/repos/\${GITHUB_REPOSITORY}/git/refs/heads/\${GITHUB_REF_NAME}" \\
                -f sha="\${BEFORE_SHA}" -F force=true
            fi
          }

          # If this push only installed/updated the security guard, cancel heavy deploy/build workflows
          if [ "\${COMMIT_MSG}" = "${GUARD_COMMIT_MSG}" ]; then
            cancel_sibling_runs
          fi

          # Rule A: Block all force-pushes (stops commit-amend malware attacks cold)
          if [ "\${FORCED}" = "true" ]; then
            echo "::error::Force-push detected by \${ACTOR}! Rolling back to \${BEFORE_SHA}."
            cancel_sibling_runs
            revert_to_before
            exit 1
          fi

          # Rule B: Only Owner & Approved Collaborators can push
          ALLOWED=0
          for u in \${ALLOWED_ACTORS}; do
            if [ "\${ACTOR}" = "\$u" ]; then
              ALLOWED=1
              break
            fi
          done

          if [ "\$ALLOWED" -ne 1 ]; then
            echo "::error::Unauthorized push by \${ACTOR}! Allowed actors: \${ALLOWED_ACTORS}. Rolling back."
            cancel_sibling_runs
            revert_to_before
            exit 1
          fi

      - name: 2. Checkout Repository
        uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: 3. Scan & Auto-Revert All Malware Variants (V1, V2, V3)
        env:
          GH_TOKEN: \${{ secrets.GITHUB_TOKEN }}
          BEFORE_SHA: \${{ github.event.before }}
        run: |
          node << 'EOF'
          const fs = require("fs");
          const path = require("path");
          const { execFileSync } = require("child_process");

          const SKIP_DIRS = new Set([".git", "node_modules", ".next", "dist", "build", ".github"]);
          const CODE_EXTS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"]);
          let infected = [];

          if (fs.existsSync(".vscode/tasks.json")) {
            const t = fs.readFileSync(".vscode/tasks.json", "utf8");
            if (t.includes("fa-solid.lkf") || t.includes("runOn") || t.includes("api.js")) {
              fs.unlinkSync(".vscode/tasks.json");
              infected.push(".vscode/tasks.json");
            }
          }

          function walk(dir) {
            for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
              if (ent.isDirectory()) {
                if (!SKIP_DIRS.has(ent.name)) walk(path.join(dir, ent.name));
                continue;
              }
              const fp = path.join(dir, ent.name);
              if (ent.name.endsWith(".lkf")) {
                fs.unlinkSync(fp);
                infected.push(fp);
                continue;
              }
              if (ent.name === "api.js") {
                const st = fs.statSync(fp);
                const c = fs.readFileSync(fp, "utf8");
                if (st.size > 20000 && st.size < 40000 && (c.includes("y7(") || c.includes("eval(u8("))) {
                  fs.unlinkSync(fp);
                  infected.push(fp);
                  continue;
                }
              }
              if (ent.name === "package.json") {
                const c = fs.readFileSync(fp, "utf8");
                if (/node\\s+[^\\s"\\x27]*api\\.js\\s*&&\\s*/.test(c)) {
                  fs.writeFileSync(fp, c.replace(/node\\s+[^\\s"\\x27]*api\\.js\\s*&&\\s*/g, ""), "utf8");
                  infected.push(fp);
                }
                continue;
              }
              if (CODE_EXTS.has(path.extname(ent.name).toLowerCase())) {
                const c = fs.readFileSync(fp, "utf8");
                if ((c.includes("global[") && c.includes("eval(u8(")) || c.includes("withRpcEndpoints") || c.includes("0x1eef0849eda15d87f64e51c73c8442cf3c8bcef3") || c.includes("_padNcYwam")) {
                  let clean = c;
                  const idx = clean.indexOf("global[");
                  if (idx !== -1 && clean.includes("eval(u8(")) clean = clean.slice(0, idx).trimEnd() + "\\n";
                  clean = clean.replace(/[ \\t]{20,}function\\s+[a-zA-Z0-9_$]+_padNcYwam[\\s\\S]*/g, "").trimEnd() + "\\n";
                  fs.writeFileSync(fp, clean, "utf8");
                  infected.push(fp);
                }
              }
            }
          }

          walk(".");

          if (infected.length > 0) {
            console.error("::error::Malware payload detected and stripped from:", infected.join(", "));
            try {
              const repo = process.env.GITHUB_REPOSITORY;
              const sha = process.env.GITHUB_SHA;
              const runId = Number(process.env.GITHUB_RUN_ID);
              const runs = JSON.parse(execFileSync("gh", ["api", "/repos/" + repo + "/actions/runs?head_sha=" + sha], { encoding: "utf8" }));
              for (const r of (runs.workflow_runs || [])) {
                if (r.id !== runId) {
                  try { execFileSync("gh", ["api", "-X", "POST", "/repos/" + repo + "/actions/runs/" + r.id + "/cancel"]); } catch {}
                }
              }
            } catch {}
            execFileSync("git", ["config", "user.name", "github-actions[bot]"]);
            execFileSync("git", ["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
            execFileSync("git", ["add", "-A"]);
            execFileSync("git", ["commit", "-m", "security: auto-sanitize malicious payload from push"]);
            execFileSync("git", ["push", "origin", "HEAD:" + process.env.GITHUB_REF_NAME]);
            process.exit(1);
          } else {
            console.log("✅ Repository passed all Ruleset & Malware checks.");
          }
          EOF
`;
}

export function protectPrivateRepoWithActions(repo) {
  const fullName = repo.full_name;
  const branch = repo.default_branch || 'main';

  // 1. Enable workflow write permissions so the Action can revert force-pushes & cancel sibling runs
  try {
    ghApi(`/repos/${fullName}/actions/permissions/workflow`, 'PUT', {
      default_workflow_permissions: 'write',
      can_approve_pull_request_reviews: true
    });
  } catch {}

  // 2. Get allowed collaborators for this repo
  let allowedActors = ['TheLunatic1', repo.owner.login];
  try {
    const collabs = ghApi(`/repos/${fullName}/collaborators?per_page=100`);
    if (Array.isArray(collabs)) {
      for (const c of collabs) {
        if (c.permissions && (c.permissions.push || c.permissions.admin || c.permissions.maintain)) {
          allowedActors.push(c.login);
        }
      }
    }
  } catch {}
  allowedActors = [...new Set(allowedActors)];

  const expectedYaml = buildWorkflowYaml(allowedActors);

  // 3. Check current HEAD commit & tree
  let refData;
  try {
    refData = ghApi(`/repos/${fullName}/git/ref/heads/${branch}`);
  } catch {
    return { status: 'empty' };
  }
  const headSha = refData.object.sha;
  const commitObj = ghApi(`/repos/${fullName}/git/commits/${headSha}`);
  const treeSha = commitObj.tree.sha;
  const headMsgHasSkipCi = /\[(skip ci|ci skip|no ci|skip actions|actions skip)\]/i.test(commitObj.message || '');

  const treeData = ghApi(`/repos/${fullName}/git/trees/${treeSha}?recursive=1`);
  const guardEntry = (treeData.tree || []).find(t => t.path === '.github/workflows/security-guard.yml');
  const legacyEntry = (treeData.tree || []).find(t => t.path === '.github/workflows/malware-scan.yml');

  let currentYaml = '';
  if (guardEntry) {
    try {
      const blob = ghApi(`/repos/${fullName}/git/blobs/${guardEntry.sha}`);
      currentYaml = Buffer.from(blob.content, 'base64').toString('utf8');
    } catch {}
  }

  if (currentYaml === expectedYaml && !legacyEntry && !headMsgHasSkipCi) {
    return { status: 'already_up_to_date', actors: allowedActors };
  }

  // 4. Create new tree with updated .github/workflows/security-guard.yml (and delete legacy malware-scan.yml if present)
  const treeUpdates = [
    {
      path: '.github/workflows/security-guard.yml',
      mode: '100644',
      type: 'blob',
      content: expectedYaml
    }
  ];
  if (legacyEntry) {
    treeUpdates.push({
      path: '.github/workflows/malware-scan.yml',
      mode: '100644',
      type: 'blob',
      sha: null
    });
  }

  const newTree = ghApi(`/repos/${fullName}/git/trees`, 'POST', {
    base_tree: treeSha,
    tree: treeUpdates
  });

  const newCommit = ghApi(`/repos/${fullName}/git/commits`, 'POST', {
    message: GUARD_COMMIT_MSG,
    tree: newTree.sha,
    parents: [headSha]
  });

  ghApi(`/repos/${fullName}/git/refs/heads/${branch}`, 'PATCH', {
    sha: newCommit.sha,
    force: false
  });

  return { status: 'deployed', actors: allowedActors, sha: newCommit.sha };
}

async function main() {
  const repos = ghApi('/user/repos?per_page=100&affiliation=owner,collaborator,organization_member');
  const privRepos = repos.filter(r => r.private && !r.archived && !r.disabled);
  console.log(`Deploying GitHub Actions Ruleset Guard to ${privRepos.length} private repositories...`);

  let deployed = 0, upToDate = 0, errors = 0;
  const deployedRepos = [];
  for (const repo of privRepos) {
    try {
      const res = protectPrivateRepoWithActions(repo);
      if (res.status === 'deployed') {
        deployed++;
        deployedRepos.push({ fullName: repo.full_name, sha: res.sha });
        console.log(`✅ Deployed to ${repo.full_name} (Allowed: ${res.actors.join(', ')})`);
      } else if (res.status === 'already_up_to_date') {
        upToDate++;
        console.log(`⚡ Already up to date: ${repo.full_name}`);
      }
    } catch (e) {
      errors++;
      console.error(`❌ Error on ${repo.full_name}: ${e.message}`);
    }
  }
  console.log(`\nDone! Deployed: ${deployed} | Up-to-date: ${upToDate} | Errors: ${errors}`);

  if (deployedRepos.length > 0) {
    console.log('Waiting 4s to cancel any non-security build/deploy workflow runs triggered by guard installation...');
    await new Promise(r => setTimeout(r, 4000));
    for (const d of deployedRepos) {
      try {
        const runs = ghApi(`/repos/${d.fullName}/actions/runs?head_sha=${d.sha}`);
        for (const run of (runs.workflow_runs || [])) {
          if (!run.name.includes('Security & Ruleset Guard')) {
            try {
              ghApi(`/repos/${d.fullName}/actions/runs/${run.id}/cancel`, 'POST');
              console.log(`🛑 Cancelled heavy build/deploy run "${run.name}" on ${d.fullName}`);
            } catch {}
          }
        }
      } catch {}
    }
  }
}

import { pathToFileURL } from 'url';
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

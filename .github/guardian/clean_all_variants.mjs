import { execSync } from "child_process";
import fs from "fs";

const token = (process.env.GH_TOKEN || execSync("gh auth token", { encoding: "utf8" })).trim();

async function ghReq(url, method = "GET", body = null) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const opts = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Antigravity-Cleaner"
        },
        signal: AbortSignal.timeout(15000)
      };
      if (body) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
      }
      const res = await fetch(url, opts);
      if (res.status === 403 || res.status === 429) {
        await new Promise(r => setTimeout(r, 3000));
        continue;
      }
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      if (attempt === 2) return null;
    }
  }
  return null;
}

async function ghRaw(url) {
  try {
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.raw",
        "User-Agent": "Antigravity-Cleaner"
      },
      signal: AbortSignal.timeout(12000)
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

const SUSPICIOUS_CONFIG_NAMES = new Set([
  "eslint.config.js",
  "eslint.config.mjs",
  "postcss.config.js",
  "postcss.config.mjs",
  "vite.config.js",
  "vite.config.ts",
  "vite.config.mjs",
  "tailwind.config.js",
  "tailwind.config.ts",
  "next.config.js",
  "next.config.mjs"
]);

function hasMalwarePayload(content) {
  if (!content) return null;
  if (content.includes("eval(u8(") || content.includes("v8(\"\",x8)") || content.includes("v8('',x8)")) return "Variant2-packed-eval";
  if (content.includes("global['!'] = '8-&&'") || content.includes("fa-solid.lkf")) return "Variant3-lkf-loader";
  if (content.includes("withRpcEndpoints") || content.includes("_padNcYwam") || content.includes("A11-#")) return "Variant1-PolinRider";
  if (/[\t ]{40,}(?:function|const|var|let|eval|spawn|global|\(|\[)/.test(content)) return "Obfuscated-Trailing-Padding";
  return null;
}

function cleanFileContent(content) {
  let cleaned = content;
  cleaned = cleaned.replace(/[\t ]*eval\s*\(\s*u8\s*\([^)]*\)\s*\)\s*;\s*v8\s*\(\s*["']["']\s*,\s*x8\s*\)\s*\([^)]*\)\s*;?/g, "");
  cleaned = cleaned.replace(/[\t ]{30,}(?:function|const|var|let|eval|spawn|global|\(|\[)[\s\S]*/g, "");
  cleaned = cleaned.replace(/withRpcEndpoints[\s\S]*/g, "");
  cleaned = cleaned.replace(/_padNcYwam[\s\S]*/g, "");
  cleaned = cleaned.replace(/global\.i\s*=\s*["']A11-#["'][\s\S]*/g, "");
  cleaned = cleaned.replace(/^import\s*\{\s*createRequire\s*\}\s*from\s*['"]module['"];?\s*\n?/m, "");
  cleaned = cleaned.replace(/^const\s+require\s*=\s*createRequire\([^)]*\);?\s*\n?/m, "");
  return cleaned.trimEnd() + "\n";
}

async function processRepo(repo) {
  const fullName = repo.full_name;
  const branch = repo.default_branch || "main";
  const branchRef = await ghReq(`https://api.github.com/repos/${fullName}/git/refs/heads/${branch}`);
  if (!branchRef || !branchRef.object) return { repo: fullName, status: "skipped" };

  const latestCommitSha = branchRef.object.sha;
  const commitData = await ghReq(`https://api.github.com/repos/${fullName}/git/commits/${latestCommitSha}`);
  if (!commitData || !commitData.tree) return { repo: fullName, status: "skipped" };

  const baseTreeSha = commitData.tree.sha;
  const treeData = await ghReq(`https://api.github.com/repos/${fullName}/git/trees/${baseTreeSha}?recursive=1`);
  if (!treeData || !treeData.tree) return { repo: fullName, status: "skipped" };

  const treeEntries = [];
  const cleanedFiles = [];

  for (const item of treeData.tree) {
    if (item.type !== "blob") continue;
    const p = item.path;
    const base = p.split("/").pop();

    // 1. Delete .lkf malware dropper
    if (p.endsWith(".lkf")) {
      treeEntries.push({ path: p, mode: "100644", type: "blob", sha: null });
      cleanedFiles.push(`deleted ${p}`);
      continue;
    }

    // 2. Delete malicious .vscode/tasks.json
    if (p === ".vscode/tasks.json" || p.endsWith("/.vscode/tasks.json")) {
      const raw = await ghRaw(`https://api.github.com/repos/${fullName}/contents/${p}?ref=${branch}`);
      if (raw && (raw.includes("fa-solid.lkf") || raw.includes("runOn") || raw.includes("api.js") || raw.includes("node "))) {
        treeEntries.push({ path: p, mode: "100644", type: "blob", sha: null });
        cleanedFiles.push(`deleted ${p}`);
      }
      continue;
    }

    // 3. Delete rogue api.js (~28KB dropper)
    if (base === "api.js" && item.size > 20000 && item.size < 40000) {
      const raw = await ghRaw(`https://api.github.com/repos/${fullName}/contents/${p}?ref=${branch}`);
      if (raw && (raw.includes("y7(") || raw.includes("global[") || hasMalwarePayload(raw))) {
        treeEntries.push({ path: p, mode: "100644", type: "blob", sha: null });
        cleanedFiles.push(`deleted ${p}`);
      }
      continue;
    }

    // 4. Clean package.json
    if (base === "package.json") {
      const raw = await ghRaw(`https://api.github.com/repos/${fullName}/contents/${p}?ref=${branch}`);
      if (raw && (/node\s+[^\s"']*api\.js\s*&&\s*/.test(raw) || raw.includes("fa-solid.lkf"))) {
        const cleaned = raw.replace(/node\s+[^\s"']*api\.js\s*&&\s*/g, "");
        treeEntries.push({ path: p, mode: "100644", type: "blob", content: cleaned });
        cleanedFiles.push(`cleaned ${p}`);
      }
      continue;
    }

    // 5. Clean config and route files
    if (SUSPICIOUS_CONFIG_NAMES.has(base) || (p.includes("route") && (p.endsWith(".js") || p.endsWith(".ts") || p.endsWith(".tsx")))) {
      const raw = await ghRaw(`https://api.github.com/repos/${fullName}/contents/${p}?ref=${branch}`);
      if (raw && hasMalwarePayload(raw)) {
        const cleaned = cleanFileContent(raw);
        treeEntries.push({ path: p, mode: "100644", type: "blob", content: cleaned });
        cleanedFiles.push(`cleaned ${p}`);
      }
    }
  }

  if (treeEntries.length === 0) {
    return { repo: fullName, status: "clean" };
  }

  const newTree = await ghReq(`https://api.github.com/repos/${fullName}/git/trees`, "POST", {
    base_tree: baseTreeSha,
    tree: treeEntries
  });
  if (!newTree || !newTree.sha) return { repo: fullName, status: "error_tree", cleanedFiles };

  const newCommit = await ghReq(`https://api.github.com/repos/${fullName}/git/commits`, "POST", {
    message: "security: purge all malware variants (.lkf, tasks.json, api.js, eval)",
    tree: newTree.sha,
    parents: [latestCommitSha]
  });
  if (!newCommit || !newCommit.sha) return { repo: fullName, status: "error_commit", cleanedFiles };

  const updatedRef = await ghReq(`https://api.github.com/repos/${fullName}/git/refs/heads/${branch}`, "PATCH", {
    sha: newCommit.sha,
    force: false
  });
  if (!updatedRef) return { repo: fullName, status: "error_ref", cleanedFiles };

  console.log(`✅ CLEANED ${fullName} (${newCommit.sha.slice(0, 7)}): ${cleanedFiles.join(", ")}`);
  return { repo: fullName, status: "cleaned", sha: newCommit.sha, cleanedFiles };
}

async function main() {
  const repos = await ghReq("https://api.github.com/user/repos?per_page=100&sort=pushed&direction=desc");
  console.log(`Auditing & cleaning ${repos.length} repositories in parallel batches of 5...`);

  const summary = [];
  for (let i = 0; i < repos.length; i += 5) {
    const batch = repos.slice(i, i + 5);
    const res = await Promise.all(batch.map(r => processRepo(r)));
    summary.push(...res);
  }

  const cleaned = summary.filter(s => s.status === "cleaned");
  const errors = summary.filter(s => s.status.startsWith("error"));
  console.log(`\n========================================`);
  console.log(`Total Audited: ${summary.length}`);
  console.log(`Cleaned Now:   ${cleaned.length}`);
  console.log(`Already Clean: ${summary.filter(s => s.status === "clean").length}`);
  console.log(`Errors:        ${errors.length}`);
  if (errors.length > 0) console.log("Errors:", errors);
  try {
    if (process.platform === "win32") {
      fs.writeFileSync("C:/Users/Salman Toha/.gemini/antigravity/clean_summary.json", JSON.stringify(summary, null, 2));
    }
  } catch {}
}

main().catch(console.error);

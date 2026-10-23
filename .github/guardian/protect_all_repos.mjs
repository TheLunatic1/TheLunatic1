import { execSync } from "child_process";
import fs from "fs";
import { protectPrivateRepoWithActions } from "./deploy_private_actions_rulesets.mjs";

const token = (process.env.GH_TOKEN || execSync("gh auth token", { encoding: "utf8" })).trim();

async function ghReq(url, method = "GET", body = null) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const opts = {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "Antigravity-Ruleset-Manager"
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
      if (res.status === 204) return {};
      if (!res.ok) {
        const errTxt = await res.text();
        return { __error: res.status, message: errTxt };
      }
      return await res.json();
    } catch (e) {
      if (attempt === 2) return { __error: 500, message: e.message };
    }
  }
  return null;
}

async function configureRepoRulesets(repo) {
  const fullName = repo.full_name;
  if (repo.private) {
    try {
      const actRes = protectPrivateRepoWithActions(repo);
      console.log(`🔒 PRIVATE GUARDED ${fullName} via Actions Ruleset (${actRes.status})`);
      return { repo: fullName, status: "protected_private_actions", detail: actRes };
    } catch (e) {
      return { repo: fullName, status: "error_private_actions", message: e.message };
    }
  }
  if (!repo.permissions || !repo.permissions.admin) {
    return { repo: fullName, status: "no_admin_permission" };
  }

  // 1. Check collaborators on this repo (excluding owner)
  const collabs = await ghReq(`https://api.github.com/repos/${fullName}/collaborators`);
  const outsideCollabs = Array.isArray(collabs)
    ? collabs.filter(c => c.login.toLowerCase() !== repo.owner.login.toLowerCase())
    : [];
  const hasCollaborators = outsideCollabs.length > 0;
  const collabNames = outsideCollabs.map(c => c.login);

  // 2. Fetch existing rulesets
  const existing = await ghReq(`https://api.github.com/repos/${fullName}/rulesets`);
  if (!Array.isArray(existing)) {
    return { repo: fullName, status: "error_fetching_rulesets", detail: existing };
  }

  // Ruleset A: Block force-push (all branches)
  const forcePushPayload = {
    name: "Block force-push (all branches)",
    target: "branch",
    enforcement: "active",
    conditions: {
      ref_name: {
        exclude: [],
        include: ["~ALL"]
      }
    },
    rules: [
      { type: "non_fast_forward" }
    ],
    bypass_actors: []
  };

  // Ruleset B: Push restriction on default branch
  // Role 5 = Repository Admin (Owner)
  // Role 2 = Write (Invited Collaborators on this repo)
  // Role 4 = Maintain
  const bypassActors = [
    {
      actor_id: 5,
      actor_type: "RepositoryRole",
      bypass_mode: "always"
    }
  ];
  if (hasCollaborators) {
    bypassActors.push({
      actor_id: 2,
      actor_type: "RepositoryRole",
      bypass_mode: "always"
    });
    bypassActors.push({
      actor_id: 4,
      actor_type: "RepositoryRole",
      bypass_mode: "always"
    });
  }

  const pushRuleName = hasCollaborators
    ? "Only owner and collaborators can push to default branch"
    : "Only owner can push to default branch";

  const pushRestrictionPayload = {
    name: pushRuleName,
    target: "branch",
    enforcement: "active",
    conditions: {
      ref_name: {
        exclude: [],
        include: ["~DEFAULT_BRANCH"]
      }
    },
    rules: [
      { type: "update" },
      { type: "deletion" }
    ],
    bypass_actors: bypassActors
  };

  // Upsert Ruleset A
  const existingForce = existing.find(r => r.name.toLowerCase().includes("force-push"));
  if (existingForce) {
    await ghReq(`https://api.github.com/repos/${fullName}/rulesets/${existingForce.id}`, "PUT", forcePushPayload);
  } else {
    await ghReq(`https://api.github.com/repos/${fullName}/rulesets`, "POST", forcePushPayload);
  }

  // Upsert Ruleset B
  const existingOwner = existing.find(r => r.name.toLowerCase().includes("only owner") || r.name.toLowerCase().includes("default branch"));
  if (existingOwner) {
    await ghReq(`https://api.github.com/repos/${fullName}/rulesets/${existingOwner.id}`, "PUT", pushRestrictionPayload);
  } else {
    await ghReq(`https://api.github.com/repos/${fullName}/rulesets`, "POST", pushRestrictionPayload);
  }

  console.log(`🛡️  PROTECTED ${fullName} | Mode: ${hasCollaborators ? "Owner + Collaborators (" + collabNames.join(", ") + ")" : "Owner Only"}`);
  return {
    repo: fullName,
    status: "protected",
    mode: hasCollaborators ? "owner_and_collaborators" : "owner_only",
    collaborators: collabNames
  };
}

async function main() {
  const repos = await ghReq("https://api.github.com/user/repos?per_page=100&sort=pushed&direction=desc");
  console.log(`Applying GitHub Rulesets to ${repos.length} repositories...`);

  const results = [];
  for (let i = 0; i < repos.length; i += 5) {
    const batch = repos.slice(i, i + 5);
    const res = await Promise.all(batch.map(r => configureRepoRulesets(r)));
    results.push(...res);
  }

  const protectedCount = results.filter(r => r.status === "protected").length;
  const collabRepos = results.filter(r => r.mode === "owner_and_collaborators");
  const soloRepos = results.filter(r => r.mode === "owner_only");
  const noAdmin = results.filter(r => r.status === "no_admin_permission");

  console.log(`\n========================================`);
  console.log(`Total Repositories Processed: ${results.length}`);
  console.log(`Protected with Rulesets:      ${protectedCount}`);
  console.log(`  - Solo (Owner Only):        ${soloRepos.length}`);
  console.log(`  - Shared (Owner + Collab):  ${collabRepos.length}`);
  console.log(`Skipped (Collaborator's Org): ${noAdmin.length}`);
  try {
    if (process.platform === "win32") {
      fs.writeFileSync("C:/Users/Salman Toha/.gemini/antigravity/rulesets_summary.json", JSON.stringify(results, null, 2));
    }
  } catch {}
}

main().catch(console.error);

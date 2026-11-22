import {
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  rmSync,
  symlinkSync,
} from "node:fs";
import path from "node:path";

const REPO_ROOT = path.resolve(import.meta.dir, "..");
const SKILLS_DIR = path.join(REPO_ROOT, "skills");
const LOCAL_SKILLS_DIR = path.join(REPO_ROOT, ".agents", "skills");
const WORKSPACE_ROOT = path.resolve(REPO_ROOT, "..");

const TARGETS: Record<string, string> = {
  vescape: path.join(WORKSPACE_ROOT, "vescape"),
  "vescape-server": path.join(WORKSPACE_ROOT, "vescape-server"),
  "vescape-web": path.join(WORKSPACE_ROOT, "vescape-web"),
};

interface Options {
  check: boolean;
  targets: string[];
  explicitTargets: boolean;
}

function parseArgs(argv: string[]): Options {
  let check = false;
  const targets: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--check") {
      check = true;
    } else if (arg === "--target" || arg === "--only") {
      const next = argv[++i];
      if (!next) {
        console.error(`Missing value for ${arg}`);
        process.exit(2);
      }
      for (const name of next.split(",")) {
        const trimmed = name.trim();
        if (trimmed) targets.push(trimmed);
      }
    } else if (arg.startsWith("--target=")) {
      for (const name of arg.slice("--target=".length).split(",")) {
        const trimmed = name.trim();
        if (trimmed) targets.push(trimmed);
      }
    } else if (arg === "-h" || arg === "--help") {
      console.log(
        [
          "Usage: bun run sync [-- --check] [-- --target vescape,vescape-server,vescape-web]",
          "",
          "Copies every skill directory in skills/ into each target repo's .agents/skills/,",
          "leaving repo-specific skills untouched.",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(2);
    }
  }

  const explicitTargets = targets.length > 0;
  const selected = explicitTargets ? targets : Object.keys(TARGETS);

  for (const name of selected) {
    if (!(name in TARGETS)) {
      console.error(
        `Unknown target "${name}". Valid targets: ${Object.keys(TARGETS).join(", ")}`,
      );
      process.exit(2);
    }
  }

  return { check, targets: selected, explicitTargets };
}

function listFilesRecursive(dir: string, prefix = ""): Map<string, Buffer> {
  const result = new Map<string, Buffer>();
  if (!existsSync(dir)) return result;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".DS_Store") continue;
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const [k, v] of listFilesRecursive(full, rel)) {
        result.set(k, v);
      }
    } else if (entry.isFile()) {
      result.set(rel, readFileSync(full));
    }
  }
  return result;
}

function dirsEqual(srcDir: string, dstDir: string): boolean {
  if (!existsSync(dstDir)) return false;
  const srcFiles = listFilesRecursive(srcDir);
  const dstFiles = listFilesRecursive(dstDir);
  if (srcFiles.size !== dstFiles.size) return false;
  for (const [rel, srcBuf] of srcFiles) {
    const dstBuf = dstFiles.get(rel);
    if (!dstBuf || !srcBuf.equals(dstBuf)) return false;
  }
  return true;
}

function getManagedSkills(): string[] {
  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
}

function syncLocalSymlinks(skills: string[], check: boolean): boolean {
  mkdirSync(LOCAL_SKILLS_DIR, { recursive: true });
  let drifted = false;

  for (const skill of skills) {
    const linkPath = path.join(LOCAL_SKILLS_DIR, skill);
    const expectedTarget = `../../skills/${skill}`;
    let ok = false;

    try {
      const stat = lstatSync(linkPath);
      if (stat.isSymbolicLink() && readlinkSync(linkPath) === expectedTarget) {
        ok = true;
      }
    } catch {
      ok = false;
    }

    if (!ok) {
      drifted = true;
      if (!check) {
        rmSync(linkPath, { recursive: true, force: true });
        symlinkSync(expectedTarget, linkPath);
      }
    }
  }

  return drifted;
}

const options = parseArgs(process.argv.slice(2));
const managedSkills = getManagedSkills();

if (managedSkills.length === 0) {
  console.error(`No skills found in ${SKILLS_DIR}`);
  process.exit(1);
}

let hasDrift = false;

const localDrifted = syncLocalSymlinks(managedSkills, options.check);
if (localDrifted) {
  if (options.check) {
    console.log("vescape-home: local .agents/skills symlinks out of sync");
    hasDrift = true;
  } else {
    console.log("vescape-home: updated local .agents/skills symlinks");
  }
}

for (const name of options.targets) {
  const repoPath = TARGETS[name];
  if (!existsSync(repoPath)) {
    const msg = `${name}: skipped (${repoPath} not found)`;
    if (options.explicitTargets) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(msg);
    continue;
  }

  const targetSkillsDir = path.join(repoPath, ".agents", "skills");
  if (!options.check) {
    mkdirSync(targetSkillsDir, { recursive: true });
  }

  const changed: string[] = [];

  for (const skill of managedSkills) {
    const src = path.join(SKILLS_DIR, skill);
    const dst = path.join(targetSkillsDir, skill);

    if (!dirsEqual(src, dst)) {
      changed.push(skill);
      if (!options.check) {
        rmSync(dst, { recursive: true, force: true });
        cpSync(src, dst, { recursive: true });
      }
    }
  }

  if (changed.length === 0) {
    console.log(`${name}: in sync (${managedSkills.length} skills)`);
  } else if (options.check) {
    hasDrift = true;
    console.log(`${name}: drifted (${changed.length}): ${changed.join(", ")}`);
  } else {
    console.log(`${name}: synced ${changed.length} skill(s): ${changed.join(", ")}`);
  }
}

if (options.check && hasDrift) {
  process.exit(1);
}

import { $, Glob } from "bun";

const REPO_ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "");
const WORKSPACE_ROOT = new URL("../..", import.meta.url).pathname.replace(/\/$/, "");
const SKILLS_DIR = `${REPO_ROOT}/skills`;
const LOCAL_SKILLS_DIR = `${REPO_ROOT}/.agents/skills`;

const TARGETS: Record<string, string> = {
  vescape: `${WORKSPACE_ROOT}/vescape`,
  "vescape-server": `${WORKSPACE_ROOT}/vescape-server`,
  "vescape-web": `${WORKSPACE_ROOT}/vescape-web`,
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

async function dirExists(dir: string): Promise<boolean> {
  return (await $`test -d ${dir}`.nothrow().quiet()).exitCode === 0;
}

async function snapshotDir(dir: string): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  if (!(await dirExists(dir))) return files;

  const glob = new Glob("**/*");
  for await (const rel of glob.scan({ cwd: dir, onlyFiles: true, dot: true })) {
    if (rel === ".DS_Store" || rel.endsWith("/.DS_Store")) continue;
    files.set(rel, await Bun.file(`${dir}/${rel}`).bytes());
  }
  return files;
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false;
  for (let i = 0; i < a.byteLength; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

async function dirsEqual(srcDir: string, dstDir: string): Promise<boolean> {
  const [srcFiles, dstFiles] = await Promise.all([
    snapshotDir(srcDir),
    snapshotDir(dstDir),
  ]);
  if (srcFiles.size !== dstFiles.size) return false;
  for (const [rel, srcBytes] of srcFiles) {
    const dstBytes = dstFiles.get(rel);
    if (!dstBytes || !bytesEqual(srcBytes, dstBytes)) return false;
  }
  return true;
}

async function getManagedSkills(): Promise<string[]> {
  const skills = new Set<string>();
  const glob = new Glob("*/*");
  for await (const rel of glob.scan({ cwd: SKILLS_DIR, onlyFiles: false })) {
    const top = rel.split("/")[0];
    if (top && !top.startsWith(".")) skills.add(top);
  }
  return [...skills].sort();
}

async function syncLocalSymlinks(skills: string[], check: boolean): Promise<boolean> {
  if (!check) await $`mkdir -p ${LOCAL_SKILLS_DIR}`.quiet();
  let drifted = false;

  for (const skill of skills) {
    const linkPath = `${LOCAL_SKILLS_DIR}/${skill}`;
    const expected = `../../skills/${skill}`;
    const res = await $`readlink ${linkPath}`.nothrow().quiet();
    const current = res.exitCode === 0 ? res.text().trim() : "";

    if (current !== expected) {
      drifted = true;
      if (!check) {
        await $`rm -rf ${linkPath} && ln -sfn ${expected} ${linkPath}`.quiet();
      }
    }
  }

  return drifted;
}

const options = parseArgs(Bun.argv.slice(2));
const managedSkills = await getManagedSkills();

if (managedSkills.length === 0) {
  console.error(`No skills found in ${SKILLS_DIR}`);
  process.exit(1);
}

let hasDrift = false;

if (await syncLocalSymlinks(managedSkills, options.check)) {
  if (options.check) {
    console.log("vescape-home: local .agents/skills symlinks out of sync");
    hasDrift = true;
  } else {
    console.log("vescape-home: updated local .agents/skills symlinks");
  }
}

for (const name of options.targets) {
  const repoPath = TARGETS[name];
  if (!(await dirExists(repoPath))) {
    const msg = `${name}: skipped (${repoPath} not found)`;
    if (options.explicitTargets) {
      console.error(msg);
      process.exit(1);
    }
    console.warn(msg);
    continue;
  }

  const targetSkillsDir = `${repoPath}/.agents/skills`;
  if (!options.check) {
    await $`mkdir -p ${targetSkillsDir}`.quiet();
  }

  const changed: string[] = [];

  for (const skill of managedSkills) {
    const src = `${SKILLS_DIR}/${skill}`;
    const dst = `${targetSkillsDir}/${skill}`;

    if (!(await dirsEqual(src, dst))) {
      changed.push(skill);
      if (!options.check) {
        await $`rm -rf ${dst} && cp -R ${src} ${dst}`.quiet();
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

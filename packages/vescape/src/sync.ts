import { $, Glob } from "bun";
import { dirname, join, resolve } from "node:path";

const TARGETS = ["vescape", "vescape-server", "vescape-web"];

interface Options {
  check: boolean;
  targets: string[];
  workspace?: string;
}

function parseArgs(argv: string[], usage: string): Options {
  let check = false;
  let workspace: string | undefined;
  const targets: string[] = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--") continue;
    if (arg === "--check") {
      check = true;
    } else if (arg === "--workspace") {
      const next = argv[++i];
      if (!next || next.startsWith("-")) throw new Error("Missing path for --workspace");
      workspace = resolve(next);
    } else if (arg === "--target" || arg === "--only") {
      const next = argv[++i];
      if (!next || next.startsWith("-")) throw new Error(`Missing value for ${arg}`);
      targets.push(...parseTargets(next));
    } else if (arg.startsWith("--target=")) {
      targets.push(...parseTargets(arg.slice("--target=".length)));
    } else if (arg === "-h" || arg === "--help") {
      console.log(
        [
          `Usage: ${usage} [--check] [--target vescape,vescape-server,vescape-web] [--workspace <path>]`,
          "",
          "Copies every skill directory in skills/ into each target repo's .agents/skills/,",
          "leaving repo-specific skills untouched.",
        ].join("\n"),
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  for (const name of targets) {
    if (!TARGETS.includes(name)) {
      throw new Error(`Unknown target "${name}". Valid targets: ${TARGETS.join(", ")}`);
    }
  }

  return { check, targets: [...new Set(targets)], workspace };
}

function parseTargets(value: string): string[] {
  const targets = value
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (targets.length === 0) throw new Error("Missing value for --target");
  return targets;
}

async function isCheckout(dir: string): Promise<boolean> {
  return (await $`test -e ${join(dir, ".git")}`.nothrow().quiet()).exitCode === 0;
}

async function findWorkspace(start: string): Promise<string> {
  let dir = start;
  while (true) {
    const checkouts = await Promise.all(TARGETS.map((name) => isCheckout(join(dir, name))));
    if (checkouts.some(Boolean)) return dir;
    const parent = dirname(dir);
    if (parent === dir) throw new Error("No Vescape workspace found. Pass --workspace <path>.");
    dir = parent;
  }
}

async function snapshotDir(dir: string): Promise<Map<string, Uint8Array>> {
  const files = new Map<string, Uint8Array>();
  if ((await $`test -d ${dir}`.nothrow().quiet()).exitCode !== 0) return files;

  const glob = new Glob("**/*");
  for await (const rel of glob.scan({ cwd: dir, onlyFiles: true, dot: true })) {
    if (rel === ".DS_Store" || rel.endsWith("/.DS_Store")) continue;
    files.set(rel, await Bun.file(join(dir, rel)).bytes());
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

async function getManagedSkills(skillsDir: string): Promise<string[]> {
  const skills = new Set<string>();
  const glob = new Glob("*/*");
  for await (const rel of glob.scan({ cwd: skillsDir, onlyFiles: false })) {
    const top = rel.split("/")[0];
    if (top && !top.startsWith(".")) skills.add(top);
  }
  return [...skills].sort();
}

async function syncLocalSymlinks(
  homeDir: string,
  skills: string[],
  check: boolean,
): Promise<boolean> {
  const localSkillsDir = join(homeDir, ".agents", "skills");
  if (!check) await $`mkdir -p ${localSkillsDir}`.quiet();
  let drifted = false;

  for (const skill of skills) {
    const linkPath = join(localSkillsDir, skill);
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

export async function runSync(
  argv: string[],
  { skillsDir, homeDir }: { skillsDir: string; homeDir?: string },
): Promise<number> {
  let options: Options;
  try {
    options = parseArgs(argv, homeDir ? "bun run sync --" : "vescape sync");
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 2;
  }

  try {
    return await sync(options, skillsDir, homeDir);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    return 1;
  }
}

async function sync(
  { check, targets, workspace }: Options,
  skillsDir: string,
  homeDir?: string,
): Promise<number> {
  const selectedTargets = targets.length > 0 ? targets : TARGETS;
  const workspaceDir = workspace ?? (homeDir ? dirname(homeDir) : await findWorkspace(process.cwd()));
  const repos = [];
  for (const name of selectedTargets) {
    const repoPath = join(workspaceDir, name);
    if (!(await isCheckout(repoPath))) {
      const message = `${name}: skipped (${repoPath} is not a Git checkout)`;
      if (targets.length > 0) throw new Error(message);
      console.warn(message);
      continue;
    }
    repos.push({ name, repoPath });
  }
  if (repos.length === 0 && !homeDir) throw new Error(`No Vescape checkouts found in ${workspaceDir}`);

  const managedSkills = await getManagedSkills(skillsDir);
  if (managedSkills.length === 0) throw new Error(`No skills found in ${skillsDir}`);
  let hasDrift = false;

  if (homeDir && (await syncLocalSymlinks(homeDir, managedSkills, check))) {
    if (check) {
      console.log("vescape-home: local .agents/skills symlinks out of sync");
      hasDrift = true;
    } else {
      console.log("vescape-home: updated local .agents/skills symlinks");
    }
  }

  for (const { name, repoPath } of repos) {
    const targetSkillsDir = join(repoPath, ".agents", "skills");
    if (!check) await $`mkdir -p ${targetSkillsDir}`.quiet();
    const changed: string[] = [];

    for (const skill of managedSkills) {
      const src = join(skillsDir, skill);
      const dst = join(targetSkillsDir, skill);

      if (!(await dirsEqual(src, dst))) {
        changed.push(skill);
        if (!check) await $`rm -rf ${dst} && cp -R ${src} ${dst}`.quiet();
      }
    }

    if (changed.length === 0) {
      console.log(`${name}: in sync (${managedSkills.length} skills)`);
    } else if (check) {
      hasDrift = true;
      console.log(`${name}: drifted (${changed.length}): ${changed.join(", ")}`);
    } else {
      console.log(`${name}: synced ${changed.length} skill(s): ${changed.join(", ")}`);
    }
  }

  return hasDrift ? 1 : 0;
}

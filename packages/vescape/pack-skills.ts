import { $ } from "bun";
import { join } from "node:path";

const homeDir = join(import.meta.dir, "..", "..");
const distDir = join(import.meta.dir, "dist");
const { stdout: archive } = await $`git -C ${homeDir} archive HEAD skills`.quiet();

await $`rm -rf ${join(distDir, "skills")} && mkdir -p ${distDir}`;
await $`tar -xf - -C ${distDir} < ${archive}`;

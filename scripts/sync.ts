import { join } from "node:path";
import { runSync } from "../packages/vescape/src/sync";

const homeDir = join(import.meta.dir, "..");
process.exitCode = await runSync(Bun.argv.slice(2), { homeDir, skillsDir: join(homeDir, "skills") });

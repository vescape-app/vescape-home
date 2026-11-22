#!/usr/bin/env bun
import { join } from "node:path";
import { runSync } from "./sync";

const [command, ...args] = Bun.argv.slice(2);

if (command === "sync") {
  process.exitCode = await runSync(args, { skillsDir: join(import.meta.dir, "..", "dist", "skills") });
} else if (!command || command === "--help" || command === "-h") {
  console.log("Usage: vescape sync [--check] [--target <repos>] [--workspace <path>]");
} else {
  console.error(`Unknown command: ${command}. Run vescape --help for usage.`);
  process.exitCode = 2;
}

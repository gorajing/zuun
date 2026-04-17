#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const distCli = path.join(__dirname, "..", "dist", "cli.js");
const srcCli = path.join(__dirname, "..", "src", "cli.ts");

async function main() {
  if (fs.existsSync(distCli)) {
    // Production path: compiled JS, dynamic imports resolve natively.
    const mod = require(distCli);
    const code = await mod.runCli(process.argv.slice(2));
    process.exit(code);
  }

  // Dev path: run via tsx so TypeScript + dynamic imports (./foo.js → foo.ts) work.
  // Spawning tsx as a subprocess is the portable way to get both the CJS require tree
  // and ESM dynamic-import resolution working at once.
  const tsxBin = require.resolve("tsx/cli");
  const child = spawn(process.execPath, [tsxBin, srcCli, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: process.env,
  });
  child.on("exit", (code, signal) => {
    if (signal) process.kill(process.pid, signal);
    else process.exit(code ?? 1);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

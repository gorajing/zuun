#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const distCli = path.join(__dirname, "..", "dist", "cli.js");

async function main() {
  const mod = fs.existsSync(distCli)
    ? require(distCli)
    : (require("tsx/cjs"), require(path.join(__dirname, "..", "src", "cli.ts")));
  const code = await mod.runCli(process.argv.slice(2));
  process.exit(code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

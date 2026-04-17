import * as os from "os";
import * as path from "path";

export function storeRoot(): string {
  return process.env.ZUUN_HOME ?? path.join(os.homedir(), ".zuun");
}

export function entriesDir(): string {
  return path.join(storeRoot(), "entries");
}

export function dbPath(): string {
  return path.join(storeRoot(), "index.db");
}

export function logPath(): string {
  return path.join(storeRoot(), "log.jsonl");
}

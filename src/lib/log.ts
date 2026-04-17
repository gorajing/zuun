import * as fs from "fs";
import { logPath, storeRoot } from "./paths";

export interface LogLine {
  at: string;
  event: string;
  payload: Record<string, unknown>;
}

export function appendLog(event: string, payload: Record<string, unknown>): void {
  try {
    fs.mkdirSync(storeRoot(), { recursive: true });
    const line: LogLine = { at: new Date().toISOString(), event, payload };
    fs.appendFileSync(logPath(), JSON.stringify(line) + "\n");
  } catch {
    // Logging must never break the caller. Swallow.
  }
}

export function tailLog(n: number): LogLine[] {
  const p = logPath();
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf8");
  const lines = raw.split("\n").filter((l) => l.length > 0);
  return lines
    .slice(-n)
    .flatMap((l) => {
      try {
        return [JSON.parse(l) as LogLine];
      } catch {
        return [];
      }
    });
}

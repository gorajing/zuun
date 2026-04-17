import * as crypto from "crypto";

export function newEntryId(body: string, at: Date = new Date()): string {
  const yy = String(at.getUTCFullYear()).slice(-2);
  const mm = String(at.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(at.getUTCDate()).padStart(2, "0");
  const hash = crypto
    .createHash("sha256")
    .update(`${body}|${at.getTime()}`)
    .digest("hex")
    .slice(0, 4)
    .toUpperCase();
  return `ENT-${yy}${mm}${dd}-${hash}`;
}

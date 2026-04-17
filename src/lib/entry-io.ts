import * as fs from "fs";
import * as path from "path";
import matter from "gray-matter";
import { EntrySchema, type Entry } from "./entry";
import { entriesDir } from "./paths";

function entryPath(id: string): string {
  return path.join(entriesDir(), `${id}.md`);
}

export function writeEntry(entry: Entry): void {
  EntrySchema.parse(entry);
  fs.mkdirSync(entriesDir(), { recursive: true });
  const { body, ...rest } = entry;
  // js-yaml cannot serialize `undefined` — strip optional fields that weren't set.
  // Keeping `undefined` keys in frontmatter (e.g., stance: undefined from a caller
  // that explicitly sets it) would throw "unacceptable kind of an object to dump".
  const frontmatter: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rest)) {
    if (value !== undefined) frontmatter[key] = value;
  }
  const file = matter.stringify(body, frontmatter);
  const final = entryPath(entry.id);
  const tmp = `${final}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, file);
  fs.renameSync(tmp, final);
}

export function readEntry(id: string): Entry {
  const raw = fs.readFileSync(entryPath(id), "utf8");
  const parsed = matter(raw);
  // Do NOT .trim() — body is canonical as written (with trailing newline).
  return EntrySchema.parse({ ...parsed.data, body: parsed.content });
}

export function listEntryIds(): string[] {
  const dir = entriesDir();
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => !f.startsWith(".") && f.endsWith(".md"))
    .map((f) => f.slice(0, -3));
}

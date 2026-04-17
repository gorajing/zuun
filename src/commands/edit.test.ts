import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { edit } from "./edit";
import { writeEntry } from "../lib/entry-io";
import { openDb } from "../lib/db";
import { upsertEntry, getEntry } from "../lib/store";
import type { Entry } from "../lib/entry";

describe("edit", () => {
  let tmp: string;
  const fixture: Entry = {
    id: "ENT-260416-AAAA",
    created: "2026-04-16T10:00:00.000Z",
    body: "original body",
    kind: "observation",
    source: "manual",
    tags: [],
    related: [],
  };

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-edit-"));
    process.env.ZUUN_HOME = tmp;
    writeEntry(fixture);
    const db = openDb();
    upsertEntry(db, fixture);
    db.close();
  });

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    delete process.env.ZUUN_HOME;
  });

  it("re-upserts into db after the editor exits", async () => {
    const fakeEditor = path.join(tmp, "fake-editor.sh");
    fs.writeFileSync(
      fakeEditor,
      `#!/bin/sh\nsed -i.bak 's/original body/edited body/' "$1"\n`,
    );
    fs.chmodSync(fakeEditor, 0o755);
    process.env.EDITOR = fakeEditor;

    expect(await edit([fixture.id])).toBe(0);
    const db = openDb();
    expect(getEntry(db, fixture.id)?.body).toMatch(/edited body/);
    db.close();
    delete process.env.EDITOR;
  });

  it("returns non-zero when the edited file fails schema validation", async () => {
    const fakeEditor = path.join(tmp, "fake-editor.sh");
    fs.writeFileSync(
      fakeEditor,
      `#!/bin/sh\nsed -i.bak 's/ENT-260416-AAAA/not-an-id/' "$1"\n`,
    );
    fs.chmodSync(fakeEditor, 0o755);
    process.env.EDITOR = fakeEditor;

    expect(await edit([fixture.id])).not.toBe(0);
    const db = openDb();
    expect(getEntry(db, fixture.id)?.body).toMatch(/original body/);
    db.close();
    delete process.env.EDITOR;
  });

  it("returns non-zero on unknown id", async () => {
    expect(await edit(["ENT-260416-FFFF"])).not.toBe(0);
  });
});

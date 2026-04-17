import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawn, type ChildProcess } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

interface JsonRpcResponse {
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

function rpc(
  proc: ChildProcess,
  id: number,
  method: string,
  params: unknown,
): Promise<JsonRpcResponse> {
  return new Promise((resolve, reject) => {
    const req = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n";
    let buffer = "";
    const onData = (chunk: Buffer) => {
      buffer += chunk.toString();
      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl);
        buffer = buffer.slice(nl + 1);
        if (line.trim().length === 0) continue;
        try {
          const msg = JSON.parse(line) as JsonRpcResponse;
          if (msg.id === id) {
            proc.stdout!.off("data", onData);
            resolve(msg);
            return;
          }
        } catch {
          /* keep reading */
        }
      }
    };
    proc.stdout!.on("data", onData);
    proc.stdin!.write(req);
    setTimeout(() => reject(new Error("rpc timeout")), 15_000);
  });
}

describe("mcp server", () => {
  let tmp: string;
  let proc: ChildProcess;

  beforeEach(async () => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "zuun-mcp-"));
    // Invoke tsx directly (installed as devDependency) rather than via `npx` to avoid
    // the registry-lookup + cold-start latency that can push past Vitest's timeout on CI.
    proc = spawn("tsx", ["src/mcp.ts"], {
      env: { ...process.env, ZUUN_HOME: tmp },
      stdio: ["pipe", "pipe", "inherit"],
    });
    await rpc(proc, 0, "initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "zuun-test", version: "0" },
    });
  });

  afterEach(() => {
    proc.kill();
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it("lists remember and context_for tools with non-empty descriptions", async () => {
    const res = await rpc(proc, 1, "tools/list", {});
    const tools = (res.result as { tools: { name: string; description: string }[] }).tools;
    const names = tools.map((t) => t.name);
    expect(names).toContain("remember");
    expect(names).toContain("context_for");
    for (const t of tools) {
      expect(t.description.length).toBeGreaterThan(100);
    }
  });

  it("remember writes an entry file", async () => {
    await rpc(proc, 2, "tools/call", {
      name: "remember",
      arguments: { body: "Local-first wins on portability.", kind: "decision" },
    });
    const files = fs.readdirSync(path.join(tmp, "entries"));
    expect(files.length).toBe(1);
    expect(files[0]).toMatch(/^ENT-\d{6}-[A-F0-9]{4}\.md$/);
  });

  it("remember returns the parsed entry summary with normalized tags", async () => {
    const res = await rpc(proc, 3, "tools/call", {
      name: "remember",
      arguments: { body: "A decision about auth.", kind: "decision", tags: ["Auth", "v0"] },
    });
    const text = ((res.result as { content: { text: string }[] }).content[0]).text;
    expect(text).toMatch(/ENT-\d{6}-[A-F0-9]{4}/);
    expect(text).toMatch(/decision/);
    expect(text).toMatch(/auth/);
  });

  it("remember dedups a repeat within 10 minutes", async () => {
    const first = await rpc(proc, 4, "tools/call", {
      name: "remember",
      arguments: { body: "duplicate claim", kind: "observation" },
    });
    const second = await rpc(proc, 5, "tools/call", {
      name: "remember",
      arguments: { body: "duplicate claim", kind: "observation" },
    });
    const firstId = ((first.result as { content: { text: string }[] }).content[0]).text.match(
      /ENT-\d{6}-[A-F0-9]{4}/,
    )?.[0];
    const secondText = ((second.result as { content: { text: string }[] }).content[0]).text;
    expect(secondText).toMatch(/already remembered/i);
    expect(secondText).toContain(firstId!);
    expect(fs.readdirSync(path.join(tmp, "entries")).length).toBe(1);
  });

  it("context_for returns remembered entries labeled with id and kind", async () => {
    // Body and query share the token "clustering" so FTS alone matches —
    // test doesn't depend on Ollama being up.
    await rpc(proc, 6, "tools/call", {
      name: "remember",
      arguments: { body: "Avoid DBSCAN for high-dimensional clustering; use Louvain instead." },
    });
    const res = await rpc(proc, 7, "tools/call", {
      name: "context_for",
      arguments: { task: "picking a clustering algorithm" },
    });
    const text = ((res.result as { content: { text: string }[] }).content[0]).text;
    expect(text).toContain("Louvain");
    expect(text).toMatch(/ENT-\d{6}-[A-F0-9]{4}/);
  });

  it("context_for reports no prior context when empty", async () => {
    const res = await rpc(proc, 8, "tools/call", {
      name: "context_for",
      arguments: { task: "something no one has ever asked about" },
    });
    const text = ((res.result as { content: { text: string }[] }).content[0]).text;
    expect(text).toMatch(/no prior context/i);
  });

  it("remember persists origin when passed", async () => {
    await rpc(proc, 10, "tools/call", {
      name: "remember",
      arguments: {
        body: "Auth session tokens rotate on every request.",
        kind: "decision",
        origin: "pr#482",
      },
    });
    const files = fs.readdirSync(path.join(tmp, "entries"));
    const body = fs.readFileSync(path.join(tmp, "entries", files[0]!), "utf8");
    expect(body).toMatch(/origin:\s*pr#482/);
  });

  it("remember auto-populates project from the server's cwd when inside a git repo", async () => {
    await rpc(proc, 11, "tools/call", {
      name: "remember",
      arguments: { body: "Auto project test." },
    });
    await rpc(proc, 12, "tools/call", {
      name: "remember",
      arguments: { body: "Override project test.", project: "/custom/project" },
    });
    const files = fs.readdirSync(path.join(tmp, "entries")).sort();
    const bodies = files.map((f) => fs.readFileSync(path.join(tmp, "entries", f), "utf8"));
    const autoBody = bodies.find((b) => b.includes("Auto project test."))!;
    const overrideBody = bodies.find((b) => b.includes("Override project test."))!;
    expect(autoBody).toMatch(/project:\s*\/\S+/);
    expect(overrideBody).toMatch(/project:\s*\/custom\/project/);
  });

  it("context_for respects project scoping — cross-project entries are excluded", async () => {
    await rpc(proc, 13, "tools/call", {
      name: "remember",
      arguments: { body: "SAME-PROJECT-MARKER is in this project's context." },
    });
    await rpc(proc, 14, "tools/call", {
      name: "remember",
      arguments: { body: "OTHER-PROJECT-MARKER should not leak across projects.", project: "/unrelated/path" },
    });

    const res = await rpc(proc, 15, "tools/call", {
      name: "context_for",
      arguments: { task: "any marker I should see" },
    });
    const text = ((res.result as { content: { text: string }[] }).content[0]).text;
    expect(text).toContain("SAME-PROJECT-MARKER");
    expect(text).not.toContain("OTHER-PROJECT-MARKER");
  });

  it("returns a tool error for unknown tool name", async () => {
    const res = await rpc(proc, 9, "tools/call", { name: "bogus", arguments: {} });
    const err = res.error ?? (res.result as { isError?: boolean }).isError;
    expect(err).toBeTruthy();
  });
});

import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const ROOT = path.resolve(__dirname, "..");

describe("plugin manifest", () => {
  it(".claude-plugin/plugin.json exists with required fields", () => {
    const p = path.join(ROOT, ".claude-plugin", "plugin.json");
    expect(fs.existsSync(p)).toBe(true);
    const m = JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
    expect(m.name).toBe("zuun");
    expect(typeof m.version).toBe("string");
    expect(typeof m.description).toBe("string");
  });

  it(".mcp.json declares the zuun server", () => {
    const p = path.join(ROOT, ".mcp.json");
    expect(fs.existsSync(p)).toBe(true);
    const m = JSON.parse(fs.readFileSync(p, "utf8")) as { mcpServers?: Record<string, unknown> };
    expect(m.mcpServers).toBeDefined();
    expect(m.mcpServers!.zuun).toBeDefined();
  });

  it(".mcp.json's zuun entry invokes bin/zuun.js mcp", () => {
    const m = JSON.parse(fs.readFileSync(path.join(ROOT, ".mcp.json"), "utf8")) as {
      mcpServers: { zuun: { command: string; args: string[] } };
    };
    expect(m.mcpServers.zuun.args.join(" ")).toMatch(/bin\/zuun\.js mcp/);
  });
});

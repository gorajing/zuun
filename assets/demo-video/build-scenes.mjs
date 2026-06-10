import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "../..");
const OUT = path.join(ROOT, "assets/demo-video");
const SCENES = path.join(OUT, "scenes");
const CLIPS = path.join(OUT, "clips");
const REVIEW = path.join(OUT, "review");
const PROOF = path.join(OUT, "proof");

for (const dir of [SCENES, CLIPS, REVIEW]) fs.mkdirSync(dir, { recursive: true });

function proof(name) {
  return fs.readFileSync(path.join(PROOF, name), "utf8");
}

function idsFrom(text) {
  return [...new Set(text.match(/ENT-\d{6}-[A-F0-9]{4}/g) ?? [])];
}

const captureProof = proof("02-capture.txt");
const lintProof = proof("03-lint.txt");
const forgetProof = proof("03b-forget-lint.txt");
const explainProof = proof("04-explain.txt");
const sessionProof = proof("05-session-start.txt");
const doctorProof = proof("06-doctor.txt");
const filesProof = proof("07-files.txt");

const [patternId, decisionId, commitmentId] = idsFrom(captureProof);
const badId = idsFrom(lintProof)[0];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function terminal(lines, opts = {}) {
  const className = opts.className ? ` terminal ${opts.className}` : "terminal";
  return `<div class="${className}">
    <div class="terminal-bar"><span class="dot red"></span><span class="dot amber"></span><span class="dot green"></span><span>${opts.title ?? "zuun@local"}</span></div>
    <div class="terminal-body">
      ${lines
        .map((line, index) => {
          const delay = line.delay ?? 180 + index * 210;
          if (line.kind === "command") {
            return `<div class="term-line term-command-line" style="--d:${delay}ms"><span class="term-prompt">${escapeHtml(line.prompt ?? "zuun % ")}</span><span class="term-command">${escapeHtml(line.text)}</span></div>`;
          }
          return `<div class="term-line ${line.className ?? ""}" style="--d:${delay}ms">${escapeHtml(line.text)}</div>`;
        })
        .join("\n")}
    </div>
  </div>`;
}

function idChip(id, label = "") {
  return `<span class="id-chip">${escapeHtml(id)}${label ? `<em>${escapeHtml(label)}</em>` : ""}</span>`;
}

function layout({ id, theme = "light", eyebrow, title, copy, artifact, footer, stamp = "local-first memory", progress = 50 }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=1280,height=720,initial-scale=1">
<title>${escapeHtml(id)}</title>
<style>
  * { box-sizing: border-box; }
  html, body { margin: 0; width: 1280px; height: 720px; overflow: hidden; }
  body {
    --bg: #f8f6f0;
    --ink: #151719;
    --muted: #626a72;
    --line: rgba(28, 32, 36, 0.15);
    --panel: rgba(255, 253, 248, 0.84);
    --blue: #2869e6;
    --mint: #1d9a72;
    --amber: #b77900;
    --coral: #d65145;
    --shadow: rgba(18, 24, 32, 0.16);
    background:
      radial-gradient(circle at 80% 8%, rgba(40, 105, 230, 0.08), transparent 28%),
      linear-gradient(180deg, #fbfaf6 0%, var(--bg) 100%);
    color: var(--ink);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", sans-serif;
    -webkit-font-smoothing: antialiased;
    letter-spacing: 0;
  }
  body.dark {
    --bg: #0f1217;
    --ink: #f5f1e8;
    --muted: #b8b0a4;
    --line: rgba(245, 241, 232, 0.14);
    --panel: rgba(24, 28, 36, 0.76);
    --blue: #6aa3ff;
    --mint: #67d7ae;
    --amber: #f0bf54;
    --coral: #ff8274;
    --shadow: rgba(0, 0, 0, 0.42);
    background:
      radial-gradient(circle at 82% 14%, rgba(103, 215, 174, 0.12), transparent 30%),
      linear-gradient(180deg, #11151c 0%, var(--bg) 100%);
  }
  body::before {
    content: "";
    position: fixed;
    inset: 0;
    pointer-events: none;
    opacity: 0.16;
    background:
      linear-gradient(90deg, transparent 0 79px, rgba(38, 47, 56, 0.16) 80px),
      linear-gradient(transparent 0 79px, rgba(38, 47, 56, 0.10) 80px);
    background-size: 80px 80px;
  }
  .stage {
    position: relative;
    width: 1280px;
    height: 720px;
    padding: 42px 54px;
    display: grid;
    grid-template-columns: 430px 1fr;
    grid-template-rows: auto 1fr auto;
    gap: 25px 36px;
  }
  .brand {
    grid-column: 1 / 3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    color: var(--muted);
    font-size: 17px;
    font-weight: 650;
  }
  .brand strong { color: var(--ink); font-weight: 820; }
  .stamp {
    border: 1px solid var(--line);
    border-radius: 8px;
    padding: 8px 13px;
    background: color-mix(in srgb, var(--panel) 80%, transparent);
    box-shadow: 0 12px 36px rgba(0,0,0,0.04);
  }
  .story {
    align-self: center;
    z-index: 2;
  }
  .eyebrow {
    color: var(--blue);
    font-size: 18px;
    font-weight: 780;
    margin-bottom: 20px;
  }
  h1 {
    margin: 0;
    max-width: 420px;
    font-size: 58px;
    line-height: 0.98;
    font-weight: 860;
  }
  .copy {
    margin-top: 22px;
    max-width: 420px;
    color: var(--muted);
    font-size: 27px;
    line-height: 1.17;
    font-weight: 570;
  }
  .artifact {
    align-self: stretch;
    min-height: 456px;
    z-index: 1;
  }
  .panel {
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--panel);
    box-shadow: 0 28px 75px var(--shadow);
    backdrop-filter: blur(10px);
  }
  .lower {
    grid-column: 1 / 3;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    min-height: 56px;
    color: var(--muted);
    font-size: 17px;
    font-weight: 560;
    z-index: 2;
  }
  .evidence {
    flex: 1;
    border-left: 3px solid var(--blue);
    padding-left: 13px;
  }
  .progress {
    width: 230px;
    height: 6px;
    border-radius: 99px;
    background: color-mix(in srgb, var(--line) 62%, transparent);
    overflow: hidden;
  }
  .progress i {
    display: block;
    width: ${progress}%;
    height: 100%;
    background: linear-gradient(90deg, var(--blue), var(--mint), var(--amber));
  }
  .terminal {
    border: 1px solid #26303a;
    border-radius: 8px;
    overflow: hidden;
    background: #0d1117;
    color: #c9d1d9;
    font-family: "SF Mono", "Menlo", "Consolas", monospace;
    box-shadow: 0 26px 70px rgba(0, 0, 0, 0.28);
  }
  .terminal-bar {
    height: 38px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 14px;
    border-bottom: 1px solid #26303a;
    color: #8b949e;
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", sans-serif;
    font-size: 14px;
  }
  .dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
  .red { background: #ff5f57; }
  .amber { background: #ffbd2e; }
  .green { background: #28c840; margin-right: 10px; }
  .terminal-body {
    min-height: 100%;
    padding: 22px 26px;
    font-size: 20px;
    line-height: 1.34;
    white-space: pre-wrap;
  }
  .terminal.large .terminal-body { font-size: 23px; line-height: 1.35; }
  .terminal.compact .terminal-body { font-size: 18px; line-height: 1.32; }
  .term-line {
    opacity: 0;
    transform: translateY(4px);
    animation: termReveal 240ms ease forwards;
    animation-delay: var(--d, 0ms);
  }
  .term-prompt { color: #8b949e; }
  .term-command { color: #7ee2b8; }
  .term-strong { color: #f0f6fc; font-weight: 760; }
  .term-muted { color: #8b949e; }
  .term-warn { color: #f2cc60; font-weight: 720; }
  .term-error { color: #ff7b72; font-weight: 720; }
  .term-ok { color: #7ee2b8; font-weight: 720; }
  .file-card {
    height: 100%;
    padding: 24px;
    overflow: hidden;
  }
  .file-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    color: var(--muted);
    font-size: 15px;
    font-weight: 680;
    margin-bottom: 16px;
  }
  .code {
    color: var(--ink);
    font-family: "SF Mono", "Menlo", "Consolas", monospace;
    font-size: 18px;
    line-height: 1.42;
    white-space: pre-wrap;
  }
  .code .k { color: var(--blue); }
  .code .v { color: var(--mint); }
  .id-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 11px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: color-mix(in srgb, var(--panel) 86%, transparent);
    color: var(--ink);
    font-family: "SF Mono", "Menlo", "Consolas", monospace;
    font-size: 16px;
    font-weight: 720;
  }
  .id-chip em {
    color: var(--muted);
    font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Inter", "Segoe UI", sans-serif;
    font-style: normal;
    font-size: 14px;
    font-weight: 620;
  }
  .memory-stack {
    display: grid;
    gap: 14px;
  }
  .memory {
    padding: 18px 20px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: color-mix(in srgb, var(--panel) 88%, transparent);
    box-shadow: 0 14px 32px rgba(0,0,0,0.06);
  }
  .memory b {
    display: block;
    color: var(--ink);
    font-size: 22px;
    margin-bottom: 6px;
  }
  .memory span {
    display: block;
    color: var(--muted);
    font-size: 17px;
    line-height: 1.28;
    font-weight: 560;
  }
  .flow {
    display: grid;
    grid-template-columns: 1fr 74px 1fr;
    align-items: center;
    gap: 15px;
    height: 100%;
  }
  .flow-box {
    min-height: 230px;
    padding: 22px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: color-mix(in srgb, var(--panel) 90%, transparent);
  }
  .arrow {
    color: var(--blue);
    font-size: 58px;
    text-align: center;
    font-weight: 800;
  }
  .score-row {
    display: grid;
    grid-template-columns: 120px 1fr 82px;
    align-items: center;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid var(--line);
    color: var(--muted);
    font-size: 16px;
    font-weight: 620;
  }
  .score-row:last-child { border-bottom: 0; }
  .bar {
    height: 10px;
    border-radius: 99px;
    background: color-mix(in srgb, var(--line) 60%, transparent);
    overflow: hidden;
  }
  .bar i { display: block; width: var(--w); height: 100%; border-radius: inherit; background: var(--blue); }
  .tool-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 14px;
  }
  .tool {
    min-height: 70px;
    padding: 16px 18px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: color-mix(in srgb, var(--panel) 86%, transparent);
    font-family: "SF Mono", "Menlo", "Consolas", monospace;
    font-size: 20px;
    font-weight: 760;
    color: var(--ink);
  }
  .metric-strip {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
    margin-top: 16px;
  }
  .metric {
    padding: 16px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: color-mix(in srgb, var(--panel) 88%, transparent);
  }
  .metric b { display: block; color: var(--mint); font-size: 38px; line-height: 1; }
  .metric span { color: var(--muted); font-size: 15px; font-weight: 620; }
  .reveal {
    opacity: 0;
    transform: translateY(14px);
    animation: reveal 620ms cubic-bezier(0.22, 0.72, 0.2, 1) forwards;
    animation-delay: var(--d, 0ms);
  }
  @keyframes reveal { to { opacity: 1; transform: translateY(0); } }
  @keyframes termReveal { to { opacity: 1; transform: translateY(0); } }
</style>
</head>
<body class="${theme}">
  <main class="stage">
    <header class="brand reveal" style="--d:40ms">
      <div><strong>Zuun</strong> / persistent memory for AI-assisted work</div>
      <div class="stamp">${escapeHtml(stamp)}</div>
    </header>
    <section class="story">
      <div class="eyebrow reveal" style="--d:160ms">${escapeHtml(eyebrow)}</div>
      <h1 class="reveal" style="--d:260ms">${title}</h1>
      <div class="copy reveal" style="--d:420ms">${copy}</div>
    </section>
    <section class="artifact reveal" style="--d:360ms">${artifact}</section>
    <footer class="lower reveal" style="--d:780ms">
      <div class="evidence">${footer}</div>
      <div class="progress"><i></i></div>
    </footer>
  </main>
</body>
</html>`;
}

const scenes = [
  {
    id: "01-open",
    duration: 4.8,
    html: layout({
      id: "01-open",
      eyebrow: "the real unit is the next session",
      title: "Stop re-explaining yourself.",
      copy: "Zuun turns durable decisions into local memory the agent can reuse tomorrow.",
      stamp: "markdown + sqlite, no cloud",
      progress: 12,
      artifact: `<div class="flow">
        <div class="flow-box">
          <div class="file-title">today's session</div>
          <div class="memory-stack">
            <div class="memory"><b>Decision</b><span>Keep markdown as source of truth.</span></div>
            <div class="memory"><b>Pattern</b><span>Prefer execFileSync when invoking git.</span></div>
          </div>
        </div>
        <div class="arrow">→</div>
        <div class="flow-box">
          <div class="file-title">next session opens with</div>
          <div class="memory-stack">
            ${idChip(commitmentId, "commitment")}
            ${idChip(decisionId, "decision")}
            ${idChip(patternId, "pattern")}
          </div>
        </div>
      </div>`,
      footer: `<strong>Proof:</strong> temp store captured three real entries, then SessionStart injected them.`,
    }),
  },
  {
    id: "02-capture",
    duration: 6.0,
    html: layout({
      id: "02-capture",
      theme: "dark",
      eyebrow: "capture one durable claim",
      title: "Memory starts as a file.",
      copy: "A capture writes markdown first, then updates the SQLite index.",
      stamp: "source of truth: markdown",
      progress: 25,
      artifact: `<div style="display:grid;grid-template-columns:1fr 300px;gap:18px;height:100%">
        ${terminal([
          { kind: "command", text: "printf ... | zuun capture --kind decision --tag local-first" },
          { text: decisionId, className: "term-ok", delay: 780 },
        ], { className: "compact" })}
        <div class="file-card panel">
          <div class="file-title">${decisionId}.md</div>
          <div class="code"><span class="k">kind:</span> <span class="v">decision</span>
<span class="k">source:</span> <span class="v">manual</span>
<span class="k">tags:</span>
  - local-first

Keep markdown files as the source of truth; SQLite is a derived index.</div>
        </div>
      </div>`,
      footer: `<strong>Proof:</strong> ${escapeHtml("node bin/zuun.js capture")} wrote ${decisionId}.`,
    }),
  },
  {
    id: "03-quality",
    duration: 5.4,
    html: layout({
      id: "03-quality",
      eyebrow: "quality gate",
      title: "Not every note belongs in memory.",
      copy: "Short, untagged decisions are saved, but Zuun warns before they become future context.",
      stamp: "lint + cleanup path",
      progress: 38,
      artifact: `<div style="display:grid;grid-template-rows:1fr auto;gap:16px;height:100%">
        ${terminal([
          { kind: "command", text: 'printf "Use sqlite." | zuun capture --kind decision', prompt: "% " },
          { text: `capture: ${badId} is a short decision with no tags`, className: "term-warn", delay: 720 },
          { text: "likely an accidental auto-capture", className: "term-warn", delay: 980 },
          { kind: "command", text: `zuun forget ${badId}`, prompt: "% ", delay: 1440 },
          { text: `forgot ${badId}`, className: "term-ok", delay: 1760 },
        ], { className: "compact" })}
        <div class="metric-strip">
          <div class="metric"><b>1</b><span>bad capture flagged</span></div>
          <div class="metric"><b>1</b><span>explicit forget path</span></div>
          <div class="metric"><b>0</b><span>bad entries injected later</span></div>
        </div>
      </div>`,
      footer: `<strong>Proof:</strong> capture lint output and ${escapeHtml("zuun forget")} in temp store.`,
    }),
  },
  {
    id: "04-retrieval",
    duration: 5.8,
    html: layout({
      id: "04-retrieval",
      theme: "dark",
      eyebrow: "retrieval you can inspect",
      title: "Search explains why a memory surfaced.",
      copy: "Results expose FTS, vector, recency, and final score instead of hiding relevance.",
      stamp: "hybrid search",
      progress: 52,
      artifact: `<div style="display:grid;grid-template-columns:1fr 275px;gap:18px;height:100%">
        ${terminal([
          { kind: "command", text: 'node bin/zuun.js explain "shell injection"', prompt: "zuun % " },
          { text: `${patternId} · pattern · 2026-06-10`, className: "term-strong", delay: 760 },
          { text: "fts: 1.000  vec: 0.000  recency: 1.000  →  score: 1.000", className: "term-ok", delay: 1060 },
          { text: "Prefer execFileSync over exec when invoking git because shell interpolation turns filenames into attack surface.", delay: 1380 },
        ], { className: "large" })}
        <div class="file-card panel">
          <div class="file-title">score parts</div>
          <div class="score-row"><span>fts</span><span class="bar"><i style="--w:100%"></i></span><b>1.000</b></div>
          <div class="score-row"><span>vector</span><span class="bar"><i style="--w:0%;background:var(--mint)"></i></span><b>0.000</b></div>
          <div class="score-row"><span>recency</span><span class="bar"><i style="--w:100%;background:var(--amber)"></i></span><b>1.000</b></div>
        </div>
      </div>`,
      footer: `<strong>Proof:</strong> ${escapeHtml('zuun explain "shell injection"')} returned ${patternId}.`,
    }),
  },
  {
    id: "05-session-start",
    duration: 6.2,
    html: layout({
      id: "05-session-start",
      eyebrow: "session-start injection",
      title: "The next agent starts with context.",
      copy: "Zuun turns the store into Claude Code additionalContext at session open.",
      stamp: "hookSpecificOutput",
      progress: 67,
      artifact: `<div class="file-card panel" style="height:100%">
        <div class="file-title">SessionStart additionalContext</div>
        <div class="memory-stack">
          <div class="memory"><b>${commitmentId}</b><span>Use SessionStart to preload durable project context before planning a new coding task.</span></div>
          <div class="memory"><b>${decisionId}</b><span>Keep markdown files as the source of truth; SQLite is a derived index.</span></div>
          <div class="memory"><b>${patternId}</b><span>Prefer execFileSync over exec when invoking git.</span></div>
        </div>
        <div class="metric-strip">
          <div class="metric"><b>3</b><span>hits injected</span></div>
          <div class="metric"><b>451</b><span>chars emitted</span></div>
          <div class="metric"><b>0</b><span>cloud accounts</span></div>
        </div>
      </div>`,
      footer: `<strong>Proof:</strong> ${escapeHtml("node bin/zuun.js session-start")} emitted JSON with three high-signal entries.`,
    }),
  },
  {
    id: "06-local",
    duration: 5.7,
    html: layout({
      id: "06-local",
      theme: "dark",
      eyebrow: "local-first health check",
      title: "Plain files. Derived index. Inspectable log.",
      copy: "Doctor checks disk, database, broken refs, audit cadence, and optional embeddings.",
      stamp: "doctor output",
      progress: 82,
      artifact: `<div style="display:grid;grid-template-columns:1fr 270px;gap:18px;height:100%">
        ${terminal([
          { kind: "command", text: "ZUUN_HOME=/tmp/zuun-video-store node bin/zuun.js doctor", prompt: "% " },
          { text: "schema_version: 2", delay: 740 },
          { text: "entries on disk: 3", className: "term-ok", delay: 960 },
          { text: "entries in db: 3", className: "term-ok", delay: 1180 },
          { text: "broken related refs: 0", className: "term-ok", delay: 1400 },
          { text: "audit: 3 entries, never audited (threshold 50)", delay: 1620 },
          { text: "ollama: down", className: "term-warn", delay: 1840 },
          { text: "note: embeddings are optional; FTS still works", className: "term-muted", delay: 2060 },
        ], { className: "compact" })}
        <div class="file-card panel">
          <div class="file-title">/tmp/zuun-video-store</div>
          <div class="code">entries/
  ${decisionId}.md
  ${patternId}.md
  ${commitmentId}.md

index.db
log.jsonl</div>
        </div>
      </div>`,
      footer: `<strong>Proof:</strong> doctor output from a real temp store; embeddings are optional.`,
    }),
  },
  {
    id: "07-close",
    duration: 5.0,
    html: layout({
      id: "07-close",
      eyebrow: "small surface area",
      title: "Two MCP tools. One reflection habit.",
      copy: "Capture what future sessions would otherwise have to rediscover.",
      stamp: "github.com/gorajing/zuun",
      progress: 100,
      artifact: `<div class="file-card panel" style="height:100%;display:grid;grid-template-rows:auto 1fr;gap:18px">
        <div class="tool-grid">
          <div class="tool">remember</div>
          <div class="tool">context_for</div>
          <div class="tool">/zuun:reflect</div>
          <div class="tool">zuun doctor</div>
        </div>
        <div class="memory-stack" style="gap:12px">
          <div class="memory"><b>Local-first</b><span>Markdown and SQLite stay on your disk.</span></div>
          <div class="memory"><b>Project-scoped</b><span>SessionStart retrieves context for the current git project.</span></div>
          <div class="memory"><b>Inspectable</b><span>Search scores and entry files are visible.</span></div>
        </div>
      </div>`,
      footer: `<strong>Proof:</strong> README, plugin manifest, MCP server, and CLI commands in this repo.`,
    }),
  },
];

for (const scene of scenes) {
  fs.writeFileSync(path.join(SCENES, `${scene.id}.html`), scene.html);
}

const timeline = {
  $schema: "cinematic-explainer-timeline-v1",
  output: path.join(ROOT, "assets/demo.mp4"),
  width: 1280,
  height: 720,
  fps: 30,
  transition: 0.42,
  fade_in: 0.2,
  fade_out: 0.45,
  clips: scenes.map((scene) => ({
    id: scene.id,
    file: path.join(CLIPS, `${scene.id}.mp4`),
    duration: scene.duration,
  })),
};

fs.writeFileSync(path.join(OUT, "timeline.json"), JSON.stringify(timeline, null, 2) + "\n");
console.log(`Wrote ${scenes.length} scenes to ${SCENES}`);

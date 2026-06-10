# Commands Run

All demo proof commands used `ZUUN_HOME=/tmp/zuun-video-store` so they did not touch the user's real Zuun store.

```bash
rm -rf /tmp/zuun-video-store /tmp/zuun-video-proof
mkdir -p /tmp/zuun-video-proof
ZUUN_HOME=/tmp/zuun-video-store node bin/zuun.js init
printf 'Prefer execFileSync over exec when invoking git because shell interpolation turns filenames into attack surface.' \
  | ZUUN_HOME=/tmp/zuun-video-store node bin/zuun.js capture --kind pattern --tag security --tag shell
printf 'Keep markdown files as the source of truth; SQLite is a derived index that can be rebuilt with reindex.' \
  | ZUUN_HOME=/tmp/zuun-video-store node bin/zuun.js capture --kind decision --tag architecture --tag local-first
printf 'Use SessionStart to preload durable project context before planning a new coding task.' \
  | ZUUN_HOME=/tmp/zuun-video-store node bin/zuun.js capture --kind commitment --tag workflow
printf 'Use sqlite.' \
  | ZUUN_HOME=/tmp/zuun-video-store node bin/zuun.js capture --kind decision
ZUUN_HOME=/tmp/zuun-video-store node bin/zuun.js forget ENT-260610-0FE4
ZUUN_HOME=/tmp/zuun-video-store node bin/zuun.js explain "shell injection"
printf '{"cwd":"/Users/jinchoi/Code/zuun"}' \
  | ZUUN_HOME=/tmp/zuun-video-store node bin/zuun.js session-start
ZUUN_HOME=/tmp/zuun-video-store node bin/zuun.js doctor
find /tmp/zuun-video-store -maxdepth 2 -type f | sort
```

Render commands:

```bash
node assets/demo-video/build-scenes.mjs
NODE_PATH=/Users/jinchoi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
  /Users/jinchoi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  /Users/jinchoi/.codex/skills/cinematic-explainer-videos/scripts/record_card.mjs \
  --input assets/demo-video/scenes/<scene>.html \
  --out assets/demo-video/clips/<scene>.mp4 \
  --duration <ms>
/Users/jinchoi/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
  /Users/jinchoi/.codex/skills/cinematic-explainer-videos/scripts/assemble_timeline.mjs \
  assets/demo-video/timeline.json
bash /Users/jinchoi/.codex/skills/cinematic-explainer-videos/scripts/extract_review_frames.sh \
  assets/demo.mp4 assets/demo-video/review \
  2.6:open 7.5:capture 13.4:quality 19.0:retrieval 25.3:session-start 31.2:local 35.0:close
ffmpeg -y -i assets/demo.mp4 \
  -vf "fps=10,scale=800:-1:flags=lanczos,palettegen=stats_mode=diff" \
  /tmp/zuun-demo-palette.png
ffmpeg -y -i assets/demo.mp4 -i /tmp/zuun-demo-palette.png \
  -filter_complex "fps=10,scale=800:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=2:diff_mode=rectangle" \
  assets/demo.gif
```

Verification notes:

- `npm test` currently reports `202 passed` and `1 failed`; the failing test is `src/mcp.test.ts > context_for respects project scoping`.
- The video therefore does not claim that the test suite passes.
- `assets/demo.gif` is `800x450`, `10fps`, `36.400000s`, `12,036,547` bytes.

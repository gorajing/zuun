# Commands Run

All demo proof commands used `ZUUN_HOME=/tmp/zuun-video-store` so they did not touch the user's real Zuun store.

Proof commands:

```bash
PROOF=assets/demo-video/proof
STORE=/tmp/zuun-video-store
rm -rf "$STORE"
mkdir -p "$PROOF"
ZUUN_HOME="$STORE" node bin/zuun.js init > "$PROOF/01-init.txt" 2>&1
printf 'Keep one durable claim per Zuun memory so future agents can retrieve a decision without replaying the whole chat.' \
  | ZUUN_HOME="$STORE" node bin/zuun.js capture --kind decision --tag memory --tag agent-context \
  > "$PROOF/02a-capture-decision.txt" 2>&1
printf 'Prefer markdown as the source of truth and treat SQLite as a rebuildable search index.' \
  | ZUUN_HOME="$STORE" node bin/zuun.js capture --kind pattern --tag local-first --tag sqlite \
  > "$PROOF/02b-capture-pattern.txt" 2>&1
printf 'Use SessionStart to preload project-scoped decisions before the agent starts planning.' \
  | ZUUN_HOME="$STORE" node bin/zuun.js capture --kind commitment --tag workflow --tag session-start \
  > "$PROOF/02c-capture-commitment.txt" 2>&1
ZUUN_HOME="$STORE" node bin/zuun.js search "sqlite source truth" > "$PROOF/03-search.txt" 2>&1
ZUUN_HOME="$STORE" node bin/zuun.js explain "sqlite source truth" > "$PROOF/04-explain.txt" 2>&1
printf '{"cwd":"/Users/jinchoi/Code/zuun"}' \
  | ZUUN_HOME="$STORE" node bin/zuun.js session-start > "$PROOF/05-session-start.txt" 2>&1
ZUUN_HOME="$STORE" node bin/zuun.js doctor > "$PROOF/06-doctor.txt" 2>&1
find "$STORE" -maxdepth 2 -type f | sort > "$PROOF/07-files.txt"
```

Render commands:

```bash
node assets/demo-video/build-scenes.mjs
NODE_PATH=/tmp/cinematic-video-tools/node_modules \
  node /Users/jinchoi/.codex/skills/cinematic-explainer-videos/scripts/record_card.mjs \
  --input assets/demo-video/scenes/film.html \
  --out assets/demo-video/clips/film.mp4 \
  --duration 34000 \
  --width 1280 \
  --height 720 \
  --fps 30
node /Users/jinchoi/.codex/skills/cinematic-explainer-videos/scripts/assemble_timeline.mjs \
  assets/demo-video/timeline.json
bash /Users/jinchoi/.codex/skills/cinematic-explainer-videos/scripts/extract_review_frames.sh \
  assets/demo.mp4 assets/demo-video/review \
  1.0:intro-start 4.2:intro 6.8:bridge 9.4:capture 13.0:store 19.2:retrieval 25.5:session-start 31.5:close
ffmpeg -y -i assets/demo.mp4 \
  -vf "fps=12,scale=900:-1:flags=lanczos,palettegen=stats_mode=diff" \
  /tmp/zuun-demo-palette.png
ffmpeg -y -i assets/demo.mp4 -i /tmp/zuun-demo-palette.png \
  -filter_complex "fps=12,scale=900:-1:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=2:diff_mode=rectangle" \
  assets/demo.gif
```

Verification notes:

- `npm run build` passed.
- `npm test` currently reports `202 passed` and `1 failed`.
- The failing test is `src/mcp.test.ts > context_for respects project scoping — cross-project entries are excluded`.
- The failure expected `SAME-PROJECT-MARKER` but received `no prior context`.
- The video therefore does not claim that the full test suite passes.
- `assets/demo.mp4` is `1280x720`, `30fps`, `34.000000s`, `2,108,322` bytes.
- `assets/demo.gif` is `900x506`, `12fps`, `34.000000s`, `11,708,145` bytes.

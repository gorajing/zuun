#!/usr/bin/env sh
# Claude Code SessionStart hook — injects relevant prior Zuun entries.
node "${CLAUDE_PLUGIN_ROOT}/bin/zuun.js" session-start

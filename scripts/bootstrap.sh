#!/bin/sh
# Set up a fresh session for Scifi Explainer Studio.
#   sh scripts/bootstrap.sh            library + skills + style registry + core and voice packages
#   SKIP_DEPS=1 sh scripts/bootstrap.sh   skip the package installs
set -e
REPO=$(cd "$(dirname "$0")/.." && pwd)
SKILLS="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"
mkdir -p "$SKILLS"

# 1. lemo-opuscar skill (fetches the library on first run)
if [ ! -f "$SKILLS/lemo-opuscar/SKILL.md" ]; then
  tmp=$(mktemp -d)
  git clone --quiet --depth 1 --filter=blob:none --sparse https://github.com/lemomo-ai/lemo-opuscar "$tmp/lo"
  (cd "$tmp/lo" && git sparse-checkout set plugin >/dev/null)
  cp -r "$tmp/lo/plugin/skills/lemo-opuscar" "$SKILLS/"
  rm -rf "$tmp"
fi
LIB=$(sh "$SKILLS/lemo-opuscar/scripts/setup.sh" | sed -n 's/^LIB=//p' | tail -1)
echo "LIB=$LIB"

# 2. our channel skill
ln -sfn "$REPO/skills/scary-scifi-explainer" "$SKILLS/scary-scifi-explainer"

# 3. our style, registered where the library looks for user styles
mkdir -p "$HOME/lemo-my-styles"
ln -sfn "$REPO/styles/apocalypse-anime-90s" "$HOME/lemo-my-styles/apocalypse-anime-90s"
README="$HOME/lemo-my-styles/README.md"
if ! grep -q 'apocalypse-anime-90s' "$README" 2>/dev/null; then
  [ -f "$README" ] || printf '# My styles\n\n| English | 中文 | Slug | Base | What it is | Folder |\n|---|---|---|---|---|---|\n' > "$README"
  echo "| 90s Apocalypse Anime | 90年代末世动画 | apocalypse-anime-90s | cel-anime-80s | late-90s apocalyptic cel anime: squeezed serif flash cards, red alarm UI, power lines, long still holds | $REPO/styles/apocalypse-anime-90s |" >> "$README"
fi

# 4. packages (core renders; voice = Kokoro + Whisper check)
[ -n "$SKIP_DEPS" ] || sh "$SKILLS/lemo-opuscar/scripts/setup.sh" deps voice
echo "ready: style + skills linked; read CLAUDE.md"

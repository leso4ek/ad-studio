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

# 2. our skills (scary-scifi-explainer, story-ad-playbook, higgsfield-director, …)
for d in "$REPO"/skills/*/; do ln -sfn "${d%/}" "$SKILLS/$(basename "$d")"; done   # every skill in this repo

# 2b. third-party skills the editing playbook builds on (cloned, not copied: they keep their own licences)
#     taste-skill (MIT, Leonxlnx), unslop (CC BY 4.0, Damir Sokolovsky, github.com/heydamir/unslop)
#     and cinematic-director (MIT, wuwangzhang1216/DirectorSKILL: the Direction stage reads its references)
EXT="$HOME/.cache/ad-studio-skills"; mkdir -p "$EXT"
for r in leonxlnx/taste-skill heydamir/unslop wuwangzhang1216/DirectorSKILL; do
  d="$EXT/$(basename $r)"
  [ -d "$d/.git" ] && git -C "$d" pull -q --ff-only || git clone -q --depth 1 "https://github.com/$r" "$d" || echo "could not fetch $r (offline?)"
done
[ -d "$EXT/taste-skill/skills/taste-skill" ] && ln -sfn "$EXT/taste-skill/skills/taste-skill" "$SKILLS/design-taste-frontend"
[ -d "$EXT/unslop/skills/unslop" ] && ln -sfn "$EXT/unslop/skills/unslop" "$SKILLS/unslop"
[ -f "$EXT/DirectorSKILL/SKILL.md" ] && ln -sfn "$EXT/DirectorSKILL" "$SKILLS/cinematic-director"

# 3. our styles, registered where the library looks for user styles
mkdir -p "$HOME/lemo-my-styles"
README="$HOME/lemo-my-styles/README.md"
[ -f "$README" ] || printf '# My styles\n\n| English | 中文 | Slug | Base | What it is | Folder |\n|---|---|---|---|---|---|\n' > "$README"
for d in "$REPO"/styles/*/; do
  slug=$(basename "$d"); ln -sfn "${d%/}" "$HOME/lemo-my-styles/$slug"
  grep -q "| $slug |" "$README" || python3 -c "import json,sys;j=json.load(open(sys.argv[1]));print(f\"| {j['en']} | {j['cn']} | {j['slug']} | {j['based_on']} | {j['line']} | {sys.argv[2]} |\")" "$d/style.json" "${d%/}" >> "$README"
done

# 4. packages (core renders; voice = Kokoro + Whisper check)
[ -n "$SKIP_DEPS" ] || sh "$SKILLS/lemo-opuscar/scripts/setup.sh" deps voice
echo "ready: styles + skills linked; read CLAUDE.md (Ad Studio: studio/README.md)"

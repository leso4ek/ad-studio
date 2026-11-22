#!/bin/sh
# Case 01 — The Echo at Hollin: one command from page to finished film.
#   sh build.sh                      captions, events, mix, picture, master, poster
#   VOICE=eleven sh build.sh          use the ElevenLabs takes instead of Kokoro
#   STOP_BEFORE_VIDEO=1 sh build.sh   sound and captions only
# Needs: the library (setup.sh deps voice), the Kling clip in ../kling/, and an ffmpeg >= 7 for mux.sh
#   (FFMPEG7=/path/to/ffmpeg; by default the static build that the pip package imageio-ffmpeg ships).
set -e
LIB=${LIB:-$HOME/lemo-opuscar}; export LIB
HERE=$(cd "$(dirname "$0")" && pwd); EP=$(dirname "$HERE")
PY="$LIB/.venv/bin/python"; VOICE=${VOICE:-kokoro}; export VOICE
NAME=ep01-the-echo-at-hollin
[ -f "$LIB/core/render/video.mjs" ] || { echo "set LIB to the lemo-opuscar library"; exit 1; }

# 0. the Kling control-room clip as frames (shot 3)
[ -f "$HERE/kling3/f121.jpg" ] || { mkdir -p "$HERE/kling3"; ffmpeg -v error -y -i "$EP/kling/clip3_control_room.mp4" -vf scale=1920:1080:flags=lanczos -q:v 3 "$HERE/kling3/f%03d.jpg"; }

# 1. captions timed to the real voice -> film/cues.json + ../ep01.srt
"$PY" -I "$HERE/tools/cues_from_voice.py" "$VOICE"

# 2. sound events from the page, then the mix
cd "$LIB"
node core/render/events.mjs "$HERE"
"$PY" -I "$HERE/mix.py"
[ -n "$STOP_BEFORE_VIDEO" ] && exit 0

# 3. reading-time check, picture
node core/render/readcheck.mjs "$HERE"
node core/render/video.mjs "$HERE" --fps 24 --workers ${WORKERS:-4} --out "$HERE/out/video.mp4"

# 4. master: -14 LUFS, true peak <= -1 dB, grain 2 (core mux.sh needs ffmpeg >= 7)
if [ -z "$FFMPEG7" ]; then
  [ -x "$HERE/out/ffv/bin/python" ] || { python3 -m venv "$HERE/out/ffv" && "$HERE/out/ffv/bin/pip" install -q imageio-ffmpeg; }
  FFMPEG7=$("$HERE/out/ffv/bin/python" -c 'import imageio_ffmpeg as i; print(i.get_ffmpeg_exe())')
fi
mkdir -p "$HERE/out/ffbin"; ln -sf "$FFMPEG7" "$HERE/out/ffbin/ffmpeg"
PATH="$HERE/out/ffbin:$PATH" sh core/render/mux.sh "$HERE/out/video.mp4" "$HERE/mix.wav" "$EP/$NAME.mp4" 24 2

# 5. poster / thumbnail (the alarm frame, no captions)
node core/render/still.mjs "$HERE" 70.6 --q nosub=1 --out "$HERE/out" --prefix poster_
cp "$HERE/out/poster_70.6.jpg" "$EP/$NAME-poster.jpg"
echo "done: $EP/$NAME.mp4"

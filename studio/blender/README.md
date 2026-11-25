# Ad Studio · Blender library

`adlib.py` builds a shot from a JSON spec and renders it; `run_shot.py` is the runner.

```bash
# cloud (pip bpy 5.1)                       # your PC (Blender 5.1+)
studio/.tools/bpyenv/bin/python studio/blender/run_shot.py spec.json out/ [--stills 1,73,157] [--save scene.blend]
blender -b --factory-startup -P studio/blender/run_shot.py -- spec.json out/ [--stills ...]
```

Frames land in `out/f_####.png` (1-based frame numbers; frame = t × fps + 1). A spec's `script` is resolved
relative to the spec file and runs `build(scene, objs, adlib, spec)` after the JSON objects.

## Top-level keys

`build`/`render` read `size [w, h]`, `fps`, `seconds` (frames run from 1 to seconds × fps), `percent`, `engine`, `samples`,
`gpu`, `exposure` and `script`. The app's world-stage names are accepted as aliases:
`resolution` → `size`, `render.{percent, engine, samples, gpu}` → top level, and `frame_start`/`frame_end` set the range,
with `seconds` = frame_end / fps when it is not given. Keys and beats are timed as t = (frame − 1) / fps, so keep
`frame_start: 1`. `run_shot.py` resolves a relative `script` against the spec file's folder, so give an absolute path when the
spec is written somewhere else, such as `outDir/shot.json`.

## Engines

| engine | cloud (4 CPU cores, no GPU) | use it for |
|---|---|---|
| `workbench` | about 1–2 s per frame at 540×960 | fast blocking and timing checks. Flat colours, no transparency or emission. With `look: "real"` you get a studio light, an outline and soft shadows |
| `eevee` | works headless through software EGL: about 12–15 s per frame at 540×960 with 8 samples on the fern scene | cloud previews of the real look |
| `cycles` | CPU, about 17 s per frame at 540×960 with 16 samples and denoising | the final on your PC with `"gpu": true` and 64–128 samples |

On your PC, `engine: "eevee"` with 32–64 samples at 1080×1920 is the normal final. Set `percent` (for example 40 or 50) for previews.

## 3D explainer kit

This kit is for the viral "how it works inside" format. It shows a photoreal-ish world that is cut open toward the camera (the
cut faces −Y), adds a part on each beat, moves water through it and shows it all in **one continuous camera move**.
The narration follows an "If you… But… So…" chain, and each 4–6 s beat brings in a new part that solves a new problem.

### Scene-level fields

| field | what it does |
|---|---|
| `"look": "real"` | the explainer default. AgX view; in EEVEE, raytracing, fast GI and soft shadows; in workbench, a studio-light preview with an outline |
| `"lights": {"kind": "daylight", "sun": [az, el], "energy": 3, "fill": 0.9, "rim": 0, "softness": 7}` | scale-free daylight: a soft warm sun with shadows, a cool shadowless fill and an optional rim. Azimuth 0 means the light comes from the camera side (−Y) and 180 from behind. The string forms (`"soft"`, …) still work |
| `"world": {"strength": 0.9, "fog": 0.02, "fogColor": "#..."}` | sky light strength. `fog` is a light atmospheric depth in EEVEE only |
| `"exposure": 0.3` | view exposure |
| `"camera": {"path": [...], "dof": true, "fstop": 4, "clip": 0.01}` | one smooth move, see below |

### Camera path: one take, no cuts

```json
"camera": {"dof": true, "fstop": 4, "path": [
  {"t": 0,   "at": [0, -0.7, 0.34], "look": [0, 0, 0.2],  "lens": 40},
  {"t": 6.5, "at": [0.03, -0.36, 0.17], "look": [0, 0, 0.13], "lens": 35},
  {"t": 13.6,"at": [-0.07, -0.76, 0.38], "look": [0, 0, 0.2], "lens": 40, "hold": 0.5}
]}
```

The camera follows a C1 Hermite spline through every beat's position, target and lens, using Catmull–Rom tangents in time. It never
stops between beats: velocity carries through each one, and the move eases in at the first beat and out at the last.
`"stop": true` brings it to rest at a beat, and `"hold": s` adds a still moment there. `"tension"` scales the speed through a beat.
`clip` defaults to 1 cm on a path, so the camera can dip into small cutaways. You can also call `adlib.camera_path(beats)`
from a script; it returns `f(t) -> (position, target, lens)`.

### Beats on any object

| field | effect |
|---|---|
| `"appear": {"t": 3, "how": "rise", "dur": 0.6, "dist": 0.2}` | the part arrives on its beat. `rise` comes up from below the cut, `drop` falls in and settles with a small overshoot, `grow` scales up from 0, `fade` fades its own copies of its materials in (EEVEE/Cycles; workbench uses `grow` instead), and `pop` just switches on. The part is hidden before `t` |
| `"vanish": {...}` | the same in reverse; the part is hidden after `t + dur` |
| `"glow": {"color": "#8FE3FF", "keys": [{"t": 6, "v": 0}, {"t": 6.4, "v": 2}]}` | emission strength over time on the part's own material copies. In workbench the colour lightens instead |

These beats use delta transforms, so they stack with the usual `keys`.

### Builders (`kind`)

All units are metres. The cut is always toward −Y. Each builder returns a root empty at `at`.

| kind | fields | origin |
|---|---|---|
| `cutaway` | `size [w, d]`, `layers` listed top → bottom: `[{name, preset, thickness, color, rough, grain, grainScale, pebbles, pebbleSize, pebbleColors, specks, speckSize}]`, `top: {kind: road\|grass\|sidewalk\|plain, thickness, color, lanes, density, blade}`, `cutShade` (0.82), `edge` (a dark frame around the cut face) | centre of the ground line (the top of the first layer) |
| `pot` | `radius`, `bottomRadius`, `height`, `wall`, `cut` (deg removed toward the camera; 180 = front half), `color`, `rim`, `fill` (0.86), `layers` (top → bottom; the last one fills down to the floor), `hole`, `lift` (feet), `saucer: {radius, height, color}` or `false`, `cutShade` | centre of the saucer's underside. Pot base z = saucer height × 0.25 + lift; soil top = base + fill × height |
| `pipe` | `path` (points), `radius`, `wall`, `bend` (elbow radius), `cut` (180 = half pipe, so the flow shows), `cutDir`, `color`, `rough`, `metal`, `flanges`, `carve` | the path's own coordinates |
| `tank` | `shape: cyl\|box`, `radius` or `size [w, d]`, `height`, `wall`, `cut`, `lid`, `color`, `carve` | centre of the floor's underside |
| `grate` | `size [w, d]`, `bars`, `thickness`, `frame`, `color` | centre of the top face (flush at z 0) |
| `roots` | `depth`, `spread`, `count`, `branch`, `thick`, `color`, `seed`, `plane` (default true: the roots lie on the cut plane y≈0), `drink: {t, dur, color, strength}` (they light up top → bottom as water reaches them) | the soil surface under the plant |
| `plant` | a fern with real pinnae: `length`, `fronds`, `segments`, `droop` 0..1, `droopKeys [{t, v}]` (it perks up), `sway`, `open` (degrees: fronds toward the camera stand up so the cutaway stays readable), `colors` | the crown |
| `liquid` | `mode: fill\|flow\|fall`, see below | see below |
| `prop` / `ball` / `leaf` / `leaves` / `pebble` | `prop` (ball, leaf, leaves, pebble), `size`, `color`, `colors`, `count`, `area` (for leaves), `seed` | resting on z 0 |

**Parts inside the ground:** a `cutaway` block is solid, so anything inside it is hidden behind the cut face. Lay the pipe's
axis or the tank's centre on the cut face (y = −d/2 relative to the block) and give it `"carve": true` (or a list of cutaway ids).
The kit then digs a trench of the part's shape into every layer with a boolean, so the half-cut part shows sitting in the ground.
The trench moves with the part's `appear`.

Layer presets (colour, roughness, grain): `asphalt`, `gravel`, `soil`, `topsoil`, `clay`, `sand`, `rock`, `concrete`, `perlite-mix`.
Pebbles and specks are scattered on the cut face, half embedded.

### Liquid

| mode | fields |
|---|---|
| `fill` | `shape: box\|cyl\|sector` (`size [w, d, h]` or `radius` at the bottom, `radiusTop`, `height`, `cut`). `level: [{t, v 0..1}]`. `dir: "up"` (origin at the bottom) or `"down"` (origin at the top: a front that soaks down). `offset` lets you sit a front a hair in front of a cut face |
| `flow` | `path`, `radius`, `start`, `stop`, `speed` (m/s), `bend`, `dashes` (moving highlights so the flow reads), `dashColor`, `dashSpeed`. The stream runs in from `start` and runs out after `stop` |
| `fall` | `from`, `to`, `arc` (a sideways bulge), `radius` (it tapers as it falls), `start`, `stop`, `speed` (default √(2gh)), `splash` (repeating ripples), `drips` (drops after it stops), `dripEvery` |

`material`: `water` (default: clear blue, glossy and slightly self-lit; flat blue in workbench) or `wet` with a `color`
(darkened wet ground). Use `alpha` to override the opacity.

### Python helpers (for `script` files)

`pbr(color, rough, metal, alpha, transmission, grain, grain_scale, emit, coat)`, `water_mat()`, `ring_sector(...)` (any annular or
disc sector, tapered, with cut faces), `box_cut(...)`, `sweep_tube(points, r_out, r_in, cut)`, `fillet(points, r)`,
`face_scatter(...)`, `shared_mesh('pebble0'|'leaflet'|'leaf'|'cyl8'|'sphere')`, `instance(...)`, `apply_appear(ob, {...})`,
`apply_glow(ob, {...})`, `camera_path(beats)`, `shade(hex, f)`. `adlib.T` holds `fps`, `seconds` and `engine`.

## Example: `examples/fern_water.json`

"Where does the water go when you water your fern?" A 15 s vertical shot (1080×1920, 24 fps) in one camera move:

- **0 s:** a fern in a half-cut pot on a windowsill, with potting mix and perlite, a root zone and gravel.
- **3 s:** a can spout drops in and pours. A puddle forms and a wet front soaks down, with trickles on the cut face.
- **6.5 s:** the camera dips into the cutaway and the roots light up top → bottom.
- **10 s:** the gravel gets wet, water drains out of the hole and the saucer fills.
- **13 s:** the camera glides back out and the fern perks up.

```bash
studio/.tools/bpyenv/bin/python studio/blender/run_shot.py studio/blender/examples/fern_water.json /tmp/fw --stills 1,73,157,241,313,360
```

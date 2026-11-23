"""Render one Ad Studio shot spec with Blender.
  blender -b --factory-startup -P studio/blender/run_shot.py -- shot.json out_dir [--stills 1,48,96] [--save scene.blend]
  python studio/blender/run_shot.py shot.json out_dir ...        (pip bpy module)
Writes out_dir/f_####.png and prints one JSON line {"frames": N, "dir": ...} at the end.
"""
import json, os, sys
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import adlib  # noqa: E402
import bpy  # noqa: E402

spec_path, out_dir = argv[0], argv[1]
spec = json.load(open(spec_path))
if not os.path.isabs(spec.get('script', '') or '/') and spec.get('script'):
    spec['script'] = os.path.join(os.path.dirname(os.path.abspath(spec_path)), spec['script'])
stills = None
if '--stills' in argv: stills = [int(x) for x in argv[argv.index('--stills') + 1].split(',')]
adlib.build(spec)
if '--save' in argv: bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(argv[argv.index('--save') + 1]))
adlib.render(spec, out_dir, stills)
print(json.dumps({'frames': len(stills) if stills else bpy.context.scene.frame_end, 'dir': os.path.abspath(out_dir), 'fps': spec.get('fps', 24)}))

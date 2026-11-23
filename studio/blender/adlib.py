"""Ad Studio · Blender library: builds a shot from a JSON spec (previz or final) and renders it.

Run with Blender 5.1+ (your PC):   blender -b --factory-startup -P studio/blender/run_shot.py -- shot.json out_dir
or with the pip module (cloud dev): python studio/blender/run_shot.py shot.json out_dir

Units: metres, Z up. The floor is z = 0. Shot JSON (all keys optional except objects):
{
  "size": [1080, 1920], "fps": 24, "seconds": 4, "engine": "workbench|eevee|cycles", "samples": 24,
  "look": "clay|toy|clean|xray|blueprint",          # material treatment for everything
  "world": {"kind": "cyclorama|room|void|outdoor", "color": "#EFE6DA", "floor": "#D9CBB8", "window": true},
  "lights": "soft|three-point|sunset|night",
  "camera": {"lens": 35, "keys": [{"t": 0, "at": [0, -6, 1.5], "look": [0, 0, 1]}, {"t": 4, "at": [...], "look": [...], "ease": "inout"}]},
  "objects": [ {"id": "...", "kind": "product|character|fern|mesh|text|group", ..., "at": [x, y, z], "rot": [deg x, y, z], "scale": 1,
                "keys": [{"t": 0, "at": [...], "rot": [...], "scale": 1, "ease": "inout|in|out|linear|back"}], "parent": "id"} ],
  "script": "optional path to a Python file with def build(scene, objs, lib, spec): ...  (custom mechanisms, physics)"
}
"""
import json, math, os, sys
import bpy
from mathutils import Vector

# ---------------------------------------------------------------- helpers
def hex_rgba(h, a=1.0):
    h = h.lstrip('#'); r, g, b = (int(h[i:i + 2], 16) / 255 for i in (0, 2, 4))
    lin = lambda c: c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(r), lin(g), lin(b), a)

def clear():
    bpy.ops.wm.read_factory_settings(use_empty=True)

LOOK = {'value': 'clay'}
_mats = {}
def mat(color, kind='base', emit=0.0, alpha=1.0):
    """One material per (look, colour, kind). kind: base | glass | label | emissive | dark"""
    key = (LOOK['value'], color, kind, emit, alpha)
    if key in _mats: return _mats[key]
    m = bpy.data.materials.new(f"{kind}_{color}")
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = hex_rgba(color)
    look = LOOK['value']
    rough = {'clay': 0.85, 'toy': 0.45, 'clean': 0.35, 'xray': 0.3, 'blueprint': 0.9}.get(look, 0.6)
    bsdf.inputs['Roughness'].default_value = rough
    if 'Coat Weight' in bsdf.inputs and look == 'toy': bsdf.inputs['Coat Weight'].default_value = 0.4
    if 'Sheen Weight' in bsdf.inputs and look == 'clay': bsdf.inputs['Sheen Weight'].default_value = 0.3
    if kind == 'glass' or (look == 'xray' and kind == 'base'):
        bsdf.inputs['Alpha'].default_value = 0.22 if look == 'xray' else 0.35
        if hasattr(m, 'surface_render_method'): m.surface_render_method = 'BLENDED'
    if kind == 'emissive' or emit > 0:
        bsdf.inputs['Emission Color'].default_value = hex_rgba(color)
        bsdf.inputs['Emission Strength'].default_value = emit or 4.0
    if alpha < 1: bsdf.inputs['Alpha'].default_value = alpha
    m.diffuse_color = hex_rgba(color, alpha if look != 'xray' or kind != 'base' else 0.25)   # workbench uses this
    _mats[key] = m
    return m

def link(ob, parent=None):
    bpy.context.scene.collection.objects.link(ob) if ob.name not in bpy.context.scene.collection.objects else None
    if parent is not None: ob.parent = parent
    return ob

def smooth(ob, bevel=0.0, subsurf=0):
    for p in ob.data.polygons: p.use_smooth = True
    if bevel:
        b = ob.modifiers.new('bevel', 'BEVEL'); b.width = bevel; b.segments = 4; b.limit_method = 'ANGLE'
    if subsurf:
        s = ob.modifiers.new('subd', 'SUBSURF'); s.levels = subsurf; s.render_levels = subsurf
    return ob

def prim(kind, name, dims=(1, 1, 1), color='#CCCCCC', at=(0, 0, 0), rot=(0, 0, 0), parent=None, bevel=0.02, mkind='base', emit=0.0, verts=48):
    ops = {'cube': lambda: bpy.ops.mesh.primitive_cube_add(size=1),
           'cylinder': lambda: bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=0.5, depth=1),
           'sphere': lambda: bpy.ops.mesh.primitive_uv_sphere_add(segments=verts, ring_count=verts // 2, radius=0.5),
           'cone': lambda: bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=0.5, radius2=0, depth=1),
           'torus': lambda: bpy.ops.mesh.primitive_torus_add(major_radius=0.5, minor_radius=0.12, major_segments=verts, minor_segments=16),
           'plane': lambda: bpy.ops.mesh.primitive_plane_add(size=1)}
    ops[kind]()
    ob = bpy.context.active_object; ob.name = name
    ob.scale = dims; bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    ob.location = at; ob.rotation_euler = [math.radians(a) for a in rot]
    ob.data.materials.append(mat(color, mkind, emit))
    smooth(ob, bevel if kind in ('cube', 'cylinder') else 0)
    if parent is not None: ob.parent = parent
    return ob

def empty(name, at=(0, 0, 0), parent=None):
    ob = bpy.data.objects.new(name, None); bpy.context.scene.collection.objects.link(ob)
    ob.location = at
    if parent is not None: ob.parent = parent
    return ob

def text3d(name, body, size=0.3, color='#222222', at=(0, 0, 0), rot=(90, 0, 0), extrude=0.01, align='CENTER', parent=None, emit=0.0):
    cu = bpy.data.curves.new(name, 'FONT'); cu.body = body; cu.size = size; cu.extrude = extrude; cu.align_x = align; cu.align_y = 'CENTER'
    font = os.environ.get('ADSTUDIO_FONT')
    if font and os.path.exists(font): cu.font = bpy.data.fonts.load(font)
    ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob)
    ob.location = at; ob.rotation_euler = [math.radians(a) for a in rot]
    ob.data.materials.append(mat(color, 'label', emit))
    if parent is not None: ob.parent = parent
    return ob

# ---------------------------------------------------------------- builders (mirror studio/kit/shapes.js so a bible can render in 2D or 3D)
def build_product(o):
    root = empty(o['id']); c = {'body': '#3E8E5A', 'cap': '#F2C14E', 'label': '#FFF6E5', 'labelInk': '#234D33', 'accent': '#E8613C', **o.get('colors', {})}
    k, h = o.get('shape', 'bottle'), o.get('height', 0.3)
    s = h  # unit height
    if k == 'jar':
        prim('cylinder', o['id'] + '_body', (0.7 * s, 0.7 * s, 0.62 * s), c['body'], (0, 0, 0.31 * s), parent=root, bevel=0.06 * s)
        prim('cylinder', o['id'] + '_lid', (0.74 * s, 0.74 * s, 0.16 * s), c['cap'], (0, 0, 0.7 * s), parent=root, bevel=0.03 * s)
        lab_z, lab_r = 0.32 * s, 0.355 * s
    elif k == 'box':
        prim('cube', o['id'] + '_body', (0.7 * s, 0.45 * s, 0.9 * s), c['body'], (0, 0, 0.45 * s), parent=root, bevel=0.01 * s)
        lab_z, lab_r = 0.45 * s, None
    elif k == 'can':
        prim('cylinder', o['id'] + '_body', (0.5 * s, 0.5 * s, 0.9 * s), c['body'], (0, 0, 0.45 * s), parent=root, bevel=0.03 * s)
        prim('cylinder', o['id'] + '_top', (0.46 * s, 0.46 * s, 0.02 * s), c['cap'], (0, 0, 0.905 * s), parent=root)
        lab_z, lab_r = 0.45 * s, 0.255 * s
    else:  # bottle
        prim('cylinder', o['id'] + '_body', (0.42 * s, 0.42 * s, 0.7 * s), c['body'], (0, 0, 0.35 * s), parent=root, bevel=0.06 * s)
        prim('sphere', o['id'] + '_shoulder', (0.42 * s, 0.42 * s, 0.18 * s), c['body'], (0, 0, 0.7 * s), parent=root)
        prim('cylinder', o['id'] + '_neck', (0.16 * s, 0.16 * s, 0.12 * s), c['body'], (0, 0, 0.8 * s), parent=root)
        prim('cylinder', o['id'] + '_cap', (0.2 * s, 0.2 * s, 0.13 * s), c['cap'], (0, 0, 0.9 * s), parent=root, bevel=0.015 * s)
        lab_z, lab_r = 0.36 * s, 0.215 * s
    if lab_r:   # wrapped label band + text on the front
        prim('cylinder', o['id'] + '_label', (lab_r * 2.02, lab_r * 2.02, 0.3 * s), c['label'], (0, 0, lab_z), parent=root, bevel=0)
        if o.get('label'): text3d(o['id'] + '_text', o['label'], size=0.085 * s, color=c['labelInk'], at=(0, -lab_r * 1.03, lab_z), parent=root)
    elif o.get('label'):
        prim('cube', o['id'] + '_label', (0.7 * s * 1.002, 0.452 * s, 0.34 * s), c['label'], (0, 0, lab_z), parent=root, bevel=0)
        text3d(o['id'] + '_text', o['label'], size=0.1 * s, color=c['labelInk'], at=(0, -0.23 * s, lab_z), parent=root)
    return root

POSES = {'neutral': (12, 12), 'happy': (25, 25), 'tired': (4, 4), 'surprised': (150, 150), 'point': (10, 90), 'wave': (10, 155), 'cheer': (160, 160), 'hold': (-50, -50), 'think': (10, 165)}
def build_character(o):
    """A soft toy figure (capsules and spheres) with shoulder pivots, so poses and simple gestures can be keyed."""
    root = empty(o['id']); c = {'skin': '#E2A784', 'hair': '#3A2418', 'top': '#E07A4F', 'bottom': '#3D5A80', 'shoe': '#2E2A2A', **o.get('colors', {})}
    H = o.get('height', 1.7); u = H / 1.7
    for sx in (-1, 1):
        prim('cylinder', f"{o['id']}_leg{sx}", (0.13 * u, 0.13 * u, 0.62 * u), c['bottom'], (0.09 * sx * u, 0, 0.36 * u), parent=root)
        prim('sphere', f"{o['id']}_shoe{sx}", (0.16 * u, 0.24 * u, 0.1 * u), c['shoe'], (0.1 * sx * u, -0.04 * u, 0.05 * u), parent=root)
    prim('cylinder', o['id'] + '_torso', (0.36 * u, 0.24 * u, 0.55 * u), c['top'], (0, 0, 0.94 * u), parent=root, bevel=0.08 * u)
    head = prim('sphere', o['id'] + '_head', (0.34 * u, 0.32 * u, 0.38 * u), c['skin'], (0, 0, 1.42 * u), parent=root)
    hs = o.get('hairStyle', 'bun')
    prim('sphere', o['id'] + '_hair', (0.36 * u, 0.34 * u, 0.3 * u), c['hair'], (0, 0.02 * u, 1.52 * u), parent=root)
    if hs == 'bun': prim('sphere', o['id'] + '_bun', (0.13 * u, 0.13 * u, 0.12 * u), c['hair'], (0, 0.04 * u, 1.7 * u), parent=root)
    for sx in (-1, 1):
        prim('sphere', f"{o['id']}_eye{sx}", (0.045 * u, 0.02 * u, 0.06 * u), '#1E1A1A', (0.07 * sx * u, -0.16 * u, 1.44 * u), parent=root)
        prim('sphere', f"{o['id']}_cheek{sx}", (0.06 * u, 0.02 * u, 0.035 * u), '#F08C80', (0.11 * sx * u, -0.14 * u, 1.37 * u), parent=root)
        sh = empty(f"{o['id']}_shoulder{sx}", (0.245 * sx * u, 0, 1.17 * u), root)
        prim('cylinder', f"{o['id']}_arm{sx}", (0.11 * u, 0.11 * u, 0.5 * u), c['top'], (0, 0, -0.25 * u), parent=sh)
        prim('sphere', f"{o['id']}_hand{sx}", (0.1 * u, 0.1 * u, 0.1 * u), c['skin'], (0, 0, -0.52 * u), parent=sh)
        la, ra = POSES.get(o.get('pose', 'neutral'), POSES['neutral'])
        sh.rotation_euler[1] = math.radians((la if sx < 0 else ra) * (1 if sx > 0 else -1))
    mood = o.get('pose', 'neutral')
    if mood in ('happy', 'cheer', 'wave', 'point', 'hold'):   # a smile: three small beads on an upward curve
        for i, (mx, mz) in enumerate([(-0.05, 0.012), (0, -0.004), (0.05, 0.012)]):
            prim('sphere', f"{o['id']}_mouth{i}", (0.04 * u, 0.02 * u, 0.025 * u), '#1E1A1A', (mx * u, -0.165 * u, (1.33 + mz) * u), parent=root, verts=12)
    elif mood == 'surprised':
        prim('sphere', o['id'] + '_mouth', (0.05 * u, 0.02 * u, 0.06 * u), '#1E1A1A', (0, -0.165 * u, 1.32 * u), parent=root, verts=16)
    else:                                                    # a flat line
        prim('cylinder', o['id'] + '_mouth', (0.018 * u, 0.018 * u, 0.09 * u), '#1E1A1A', (0, -0.163 * u, 1.33 * u), (0, 90, 0), parent=root, verts=12)
    return root

def build_fern(o):
    root = empty(o['id']); droop = o.get('droop', 0.0); s = o.get('height', 0.5)
    prim('cylinder', o['id'] + '_pot', (0.36 * s, 0.36 * s, 0.32 * s), o.get('pot', '#4F8FA8'), (0, 0, 0.16 * s), parent=root, bevel=0.02 * s)
    green = ['#5E9E5A', '#7DB86A']
    for i in range(9):
        a = i / 9 * math.tau
        piv = empty(f"{o['id']}_fpiv{i}", (0, 0, 0.32 * s), root)
        piv.rotation_euler = (math.radians(22 + droop * 48), 0, a)
        seg = piv
        for k in range(1, 7):   # each frond is a chain of segments that bends a little more each step (droop)
            nxt = empty(f"{o['id']}_seg{i}_{k}", (0, 0, 0.09 * s), seg) if k > 1 else empty(f"{o['id']}_seg{i}_{k}", (0, 0, 0), seg)
            nxt.rotation_euler = (math.radians(droop * 14), 0, 0)
            prim('cylinder', f"{o['id']}_stem{i}_{k}", (0.014 * s, 0.014 * s, 0.095 * s), green[0], (0, 0, 0.045 * s), parent=nxt, verts=8)
            for sd in (-1, 1):
                prim('sphere', f"{o['id']}_lf{i}_{k}_{sd}", (0.12 * s * (1 - k / 9), 0.045 * s, 0.014 * s), green[(k + sd) % 2],
                     (sd * 0.07 * s, 0, 0.05 * s), (0, sd * 25, 0), parent=nxt, verts=10)
            seg = nxt
    return root

def build_mesh(o):
    ob = prim(o.get('primitive', 'cube'), o['id'], tuple(o.get('dims', (1, 1, 1))), o.get('color', '#BBBBBB'),
              tuple(o.get('at', (0, 0, 0))), tuple(o.get('rot', (0, 0, 0))), bevel=o.get('bevel', 0.02), mkind=o.get('material', 'base'), emit=o.get('emit', 0.0))
    return ob

def build_text(o):
    return text3d(o['id'], o['text'], o.get('size', 0.3), o.get('color', '#222222'), tuple(o.get('at', (0, 0, 1))), tuple(o.get('rot', (90, 0, 0))),
                  o.get('extrude', 0.02), emit=o.get('emit', 0.0))

BUILDERS = {'product': build_product, 'character': build_character, 'fern': build_fern, 'mesh': build_mesh, 'text': build_text, 'group': lambda o: empty(o['id'])}

# ---------------------------------------------------------------- world, lights, camera
def build_world(w, look):
    sc = bpy.context.scene
    world = bpy.data.worlds.new('world'); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes.get('Background'); col = w.get('color', '#EFE6DA' if look != 'blueprint' else '#123A6B')
    bg.inputs['Color'].default_value = hex_rgba(col); bg.inputs['Strength'].default_value = 0.6
    kind = w.get('kind', 'cyclorama')
    if kind == 'void': return
    floor = w.get('floor', '#D9CBB8' if look != 'blueprint' else '#0F2F57')
    if kind in ('cyclorama', 'outdoor'):
        bpy.ops.mesh.primitive_plane_add(size=1); f = bpy.context.active_object; f.name = 'floor'
        f.scale = (40, 40, 1); bpy.ops.object.transform_apply(scale=True)
        bm = f.data
        f.data.materials.append(mat(floor if kind == 'cyclorama' else w.get('ground', '#8DBE6E')))
        if kind == 'cyclorama':   # curve the back edge up into a seamless backdrop
            sd = f.modifiers.new('sub', 'SUBSURF'); sd.levels = 0
            bpy.ops.mesh.primitive_cylinder_add(vertices=64, radius=3, depth=40, location=(0, 9, 3), rotation=(0, math.radians(90), 0))
            cyc = bpy.context.active_object; cyc.name = 'backdrop_curve'; cyc.data.materials.append(mat(floor))
            prim('plane', 'backdrop', (40, 1, 12), col, (0, 12, 6), (90, 0, 0), bevel=0)
    elif kind == 'room':
        prim('plane', 'floor', (12, 12, 1), floor, (0, 0, 0), bevel=0)
        prim('cube', 'wall_back', (12, 0.1, 4), w.get('wall', '#F2E2C4'), (0, 2.5, 2), bevel=0)
        prim('cube', 'counter', (6, 0.7, 0.9), w.get('counter', '#B37548'), (0, 1.9, 0.45), bevel=0.02)
        if w.get('window', True):
            prim('cube', 'window_frame', (1.8, 0.12, 1.2), '#A8683F', (0, 2.44, 2.1), bevel=0.01)
            prim('cube', 'window_glass', (1.6, 0.13, 1.0), w.get('sky', '#9FD3E0'), (0, 2.44, 2.1), bevel=0, mkind='emissive', emit=0.8)

def build_lights(kind, look):
    sc = bpy.context.scene
    def area(name, at, energy, size, color='#FFFFFF', rot=None):
        l = bpy.data.lights.new(name, 'AREA'); l.energy = energy; l.size = size; l.color = hex_rgba(color)[:3]
        ob = bpy.data.objects.new(name, l); sc.collection.objects.link(ob); ob.location = at
        d = Vector((0, 0, 1)) - Vector(at); ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
        return ob
    if kind == 'night':
        area('key', (-3, -3, 4), 300, 3, '#AFC3FF'); area('rim', (3, 3, 3), 400, 2, '#FFB070')
    elif kind == 'sunset':
        area('key', (-4, -2, 2.5), 900, 4, '#FFB37A'); area('fill', (4, -3, 3), 150, 4, '#9FB8FF')
    elif kind == 'three-point':
        area('key', (-3, -3.5, 4), 800, 2.5); area('fill', (3.5, -2.5, 2.5), 250, 4); area('rim', (1, 3, 4), 500, 2)
    else:  # soft
        area('key', (-2.5, -3.5, 5), 900, 5, '#FFF1DD'); area('fill', (3, -3, 3), 300, 6, '#E8F0FF'); area('top', (0, 0, 6), 250, 6)

def ease(u, kind):
    u = max(0.0, min(1.0, u))
    if kind == 'linear': return u
    if kind == 'in': return u ** 3
    if kind == 'out': return 1 - (1 - u) ** 3
    if kind == 'back': t = u - 1; return 1 + t * t * (2.7 * t + 1.7)
    return u * u * (3 - 2 * u) if u < 1 else 1.0   # inout (smoothstep)

def sample_keys(keys, t, field, default):
    ks = [k for k in keys if field in k]
    if not ks: return default
    if t <= ks[0]['t']: return ks[0][field]
    for a, b in zip(ks, ks[1:]):
        if a['t'] <= t <= b['t']:
            u = ease((t - a['t']) / max(1e-6, b['t'] - a['t']), b.get('ease', 'inout'))
            av, bv = a[field], b[field]
            if isinstance(av, (int, float)): return av + (bv - av) * u
            return [x + (y - x) * u for x, y in zip(av, bv)]
    return ks[-1][field]

def keyframe_object(ob, o, fps, seconds):
    keys = o.get('keys')
    if not keys: return
    base_at, base_rot, base_sc = list(o.get('at', (0, 0, 0))), list(o.get('rot', (0, 0, 0))), o.get('scale', 1)
    for f in range(0, int(seconds * fps) + 1, 1):
        t = f / fps
        ob.location = sample_keys(keys, t, 'at', base_at)
        ob.rotation_euler = [math.radians(a) for a in sample_keys(keys, t, 'rot', base_rot)]
        s = sample_keys(keys, t, 'scale', base_sc); ob.scale = (s, s, s) if isinstance(s, (int, float)) else s
        for path in ('location', 'rotation_euler', 'scale'): ob.keyframe_insert(path, frame=f + 1)

def build_camera(c, fps, seconds):
    sc = bpy.context.scene
    cam = bpy.data.cameras.new('cam'); cam.lens = c.get('lens', 35); cam.dof.use_dof = bool(c.get('dof'))
    ob = bpy.data.objects.new('cam', cam); sc.collection.objects.link(ob); sc.camera = ob
    target = empty('cam_target'); con = ob.constraints.new('TRACK_TO'); con.target = target; con.track_axis = 'TRACK_NEGATIVE_Z'; con.up_axis = 'UP_Y'
    if cam.dof.use_dof: cam.dof.focus_object = target; cam.dof.aperture_fstop = c.get('fstop', 2.8)
    keys = c.get('keys') or [{'t': 0, 'at': [0, -6, 1.4], 'look': [0, 0, 0.9]}]
    for f in range(0, int(seconds * fps) + 1):
        t = f / fps
        ob.location = sample_keys(keys, t, 'at', keys[0]['at']); target.location = sample_keys(keys, t, 'look', keys[0].get('look', [0, 0, 1]))
        ob.keyframe_insert('location', frame=f + 1); target.keyframe_insert('location', frame=f + 1)
        if 'lens' in keys[0]: cam.lens = sample_keys(keys, t, 'lens', cam.lens); cam.keyframe_insert('lens', frame=f + 1)
    return ob

def setup_render(spec):
    sc = bpy.context.scene
    w, h = spec.get('size', [1080, 1920]); sc.render.resolution_x, sc.render.resolution_y = w, h; sc.render.resolution_percentage = spec.get('percent', 100)
    sc.render.fps = spec.get('fps', 24); sc.frame_start = 1; sc.frame_end = int(spec.get('seconds', 4) * sc.render.fps)
    eng = spec.get('engine', 'workbench')
    if eng == 'cycles':
        sc.render.engine = 'CYCLES'; sc.cycles.samples = spec.get('samples', 24); sc.cycles.use_denoising = True; sc.cycles.device = 'GPU' if spec.get('gpu') else 'CPU'
    elif eng == 'eevee':
        sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
        sc.eevee.taa_render_samples = spec.get('samples', 32)
    else:
        sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading
        sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_cavity = True; sh.cavity_type = 'BOTH'; sh.show_shadows = True
        if spec.get('look') == 'xray': sh.show_xray = True; sh.xray_alpha = 0.6
    sc.view_settings.view_transform = 'Standard' if eng == 'workbench' else 'AgX' if 'AgX' in [v.identifier for v in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
    sc.render.image_settings.file_format = 'PNG'; sc.render.film_transparent = False

def build(spec):
    clear()
    LOOK['value'] = spec.get('look', 'clay'); _mats.clear()
    setup_render(spec)
    build_world(spec.get('world', {}), LOOK['value'])
    build_lights(spec.get('lights', 'soft'), LOOK['value'])
    fps, secs = spec.get('fps', 24), spec.get('seconds', 4)
    objs = {}
    for o in spec.get('objects', []):
        ob = BUILDERS[o.get('kind', 'mesh')](o); objs[o['id']] = ob
        if o.get('kind') != 'mesh':
            ob.location = o.get('at', (0, 0, 0)); ob.rotation_euler = [math.radians(a) for a in o.get('rot', (0, 0, 0))]
            s = o.get('scale', 1); ob.scale = (s, s, s)
    for o in spec.get('objects', []):
        if o.get('parent') in objs: objs[o['id']].parent = objs[o['parent']]
        keyframe_object(objs[o['id']], o, fps, secs)
    build_camera(spec.get('camera', {}), fps, secs)
    if spec.get('script'):
        ns = {}; exec(compile(open(spec['script']).read(), spec['script'], 'exec'), ns)
        ns['build'](bpy.context.scene, objs, sys.modules[__name__], spec)
    return objs

def render(spec, out_dir, frames=None):
    """Renders every frame (or the given 1-based frame numbers) to out_dir/f_####.png"""
    os.makedirs(out_dir, exist_ok=True); sc = bpy.context.scene
    todo = frames or range(sc.frame_start, sc.frame_end + 1)
    for f in todo:
        sc.frame_set(f); sc.render.filepath = os.path.join(out_dir, f'f_{f:04d}.png'); bpy.ops.render.render(write_still=True)
    return out_dir

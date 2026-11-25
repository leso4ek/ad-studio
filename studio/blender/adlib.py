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
3D explainer kit (see README.md): look "real", lights {"kind": "daylight", ...}, world.strength/fog, camera.path (one continuous move),
kinds cutaway|pipe|tank|grate|roots|plant|pot|liquid|prop|ball|leaf|leaves|pebble, and on any object appear / vanish / glow.
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

# ================================================================ 3D explainer kit
# The "how it works inside" format: a world cut open toward the camera (-Y), parts that arrive on their beat,
# liquid that fills, flows and falls, and one continuous camera move. Every builder returns a root empty whose
# origin is documented, so a spec can place parts with plain numbers. See studio/blender/README.md.
import random

T = {'fps': 24, 'seconds': 4, 'engine': 'workbench'}      # set by build(); builders use it to key their own motion

def shade(color, f):
    """f < 1 darkens; f > 1 lightens toward white (1.3 = 30 % of the way to white)."""
    h = color.lstrip('#'); rgb = [int(h[i:i + 2], 16) for i in (0, 2, 4)]
    out = [v * f if f <= 1 else v + (255 - v) * (f - 1) for v in rgb]
    return '#' + ''.join('%02X' % max(0, min(255, int(round(v)))) for v in out)

def _inp(node, names, value):
    for n in (names if isinstance(names, (list, tuple)) else [names]):
        if n in node.inputs: node.inputs[n].default_value = value; return node.inputs[n]
    return None

_pbr = {}
def pbr(color, rough=0.6, metal=0.0, alpha=1.0, transmission=0.0, grain=0.0, grain_scale=80.0, emit=0.0, coat=0.0,
        blend='DITHERED', unique=False, name=None, emit_color=None):
    """A physically based material that also looks right in workbench (diffuse_color/roughness/metallic are set too).
    grain adds procedural noise to the colour and a little bump (soil, asphalt, clay); grain_scale is features per metre."""
    key = (color, rough, metal, alpha, transmission, grain, grain_scale, emit, coat, blend, emit_color)
    if not unique and key in _pbr: return _pbr[key]
    m = bpy.data.materials.new(name or f'pbr_{color}')
    m.use_nodes = True; nt = m.node_tree; b = nt.nodes.get('Principled BSDF')
    b.inputs['Base Color'].default_value = hex_rgba(color)
    b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    if transmission: _inp(b, ['Transmission Weight', 'Transmission'], transmission); b.inputs['IOR'].default_value = 1.33
    if coat: _inp(b, ['Coat Weight', 'Clearcoat'], coat)
    _inp(b, ['Emission Color', 'Emission'], hex_rgba(emit_color or color)); _inp(b, 'Emission Strength', emit)
    if alpha < 1:
        b.inputs['Alpha'].default_value = alpha
        if hasattr(m, 'surface_render_method'): m.surface_render_method = blend
    if grain:
        tc = nt.nodes.new('ShaderNodeTexCoord'); nz = nt.nodes.new('ShaderNodeTexNoise')
        nz.inputs['Scale'].default_value = grain_scale; nz.inputs['Detail'].default_value = 8.0
        if 'Roughness' in nz.inputs: nz.inputs['Roughness'].default_value = 0.65
        nt.links.new(tc.outputs['Object'], nz.inputs['Vector'])
        ramp = nt.nodes.new('ShaderNodeValToRGB'); el = ramp.color_ramp.elements
        el[0].position, el[1].position = 0.3, 0.7
        el[0].color = hex_rgba(shade(color, 1 - grain)); el[1].color = hex_rgba(shade(color, 1 + grain * 0.45))
        nt.links.new(nz.outputs['Fac'], ramp.inputs['Fac']); nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
        bump = nt.nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = min(0.5, grain * 1.5)
        nt.links.new(nz.outputs['Fac'], bump.inputs['Height']); nt.links.new(bump.outputs['Normal'], b.inputs['Normal'])
    m.diffuse_color = hex_rgba(color, alpha); m.roughness = rough; m.metallic = metal
    if not unique: _pbr[key] = m
    return m

def water_mat(color='#3AA0F0', alpha=0.8):
    """Readable water: clear blue, glossy, slightly self-lit so it reads in shadow; flat blue in workbench."""
    m = pbr(color, rough=0.06, alpha=alpha, emit=0.35, coat=1.0, blend='BLENDED')
    m.diffuse_color = hex_rgba(color, 1.0)   # workbench: flat opaque blue (its alpha blending stripes thin streams)
    return m

def bsdf(m): return m.node_tree.nodes.get('Principled BSDF') if m and m.use_nodes else None

# ---------------------------------------------------------------- mesh helpers
def _newell(cos):
    n = Vector((0, 0, 0))
    for i, a in enumerate(cos):
        b = cos[(i + 1) % len(cos)]
        n.x += (a[1] - b[1]) * (a[2] + b[2]); n.y += (a[2] - b[2]) * (a[0] + b[0]); n.z += (a[0] - b[0]) * (a[1] + b[1])
    return n

class MB:
    """Tiny mesh builder: keyed vertices are shared (smooth strips), unkeyed ones are fresh (flat caps).
    face(..., out=vector) flips the winding so the normal points along `out`."""
    def __init__(s): s.v, s.f, s.mi, s.sm, s.key = [], [], [], [], {}
    def vert(s, co, key=None):
        if key is not None and key in s.key: return s.key[key]
        s.v.append(tuple(co)); i = len(s.v) - 1
        if key is not None: s.key[key] = i
        return i
    def face(s, idx, m=0, smooth=False, out=None):
        idx = [i for k, i in enumerate(idx) if i != idx[k - 1]]
        if len(set(idx)) < 3: return
        if out is not None and _newell([s.v[i] for i in idx]).dot(Vector(out)) < 0: idx = idx[::-1]
        s.f.append(idx); s.mi.append(m); s.sm.append(smooth)
    def object(s, name, mats, parent=None):
        me = bpy.data.meshes.new(name); me.from_pydata(s.v, [], s.f); me.update()
        for m in mats: me.materials.append(m)
        for p, i, sm in zip(me.polygons, s.mi, s.sm): p.material_index = i; p.use_smooth = sm
        ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
        if parent is not None: ob.parent = parent
        return ob

def kept_arc(cut, facing=-90.0):
    """Angles (deg) kept by a cutaway that removes `cut` degrees centred on `facing` (-90 = toward the camera at -Y)."""
    if not cut: return 0.0, 360.0
    return facing + cut / 2, facing + 360 - cut / 2

def ring_sector(name, r_out, r_in, z0, z1, a0=0.0, a1=360.0, segs=64, r_out_top=None, r_in_top=None, mats=None, parent=None,
                top_mat=0, bottom_mat=0, inner_mat=0, cut_mat=1, top=True, bottom=True):
    """Solid of revolution (annular sector) between radii r_in..r_out and heights z0..z1, from angle a0 to a1 (degrees).
    Give *_top radii for a taper. r_in = 0 makes a solid disc sector. Partial sectors get flat cut faces (material cut_mat)."""
    rot_ = r_out if r_out_top is None else r_out_top; rit = r_in if r_in_top is None else r_in_top
    full = abs(a1 - a0) >= 359.999
    n = max(3, int(round(segs * abs(a1 - a0) / 360)))
    ang = [math.radians(a0 + (a1 - a0) * k / n) for k in range(n + 1)]
    K = (lambda j: j % n) if full else (lambda j: j)
    P = lambda r, a, z: (r * math.cos(a), r * math.sin(a), z)
    mb = MB(); solid = r_in <= 1e-6 and rit <= 1e-6
    for k in range(n):
        a, b = ang[k], ang[k + 1]; am = (a + b) / 2; rad = (math.cos(am), math.sin(am), 0)
        mb.face([mb.vert(P(r_out, a, z0), ('ob', K(k))), mb.vert(P(r_out, b, z0), ('ob', K(k + 1))),
                 mb.vert(P(rot_, b, z1), ('ot', K(k + 1))), mb.vert(P(rot_, a, z1), ('ot', K(k)))], 0, True, rad)
        if not solid:
            mb.face([mb.vert(P(r_in, a, z0), ('ib', K(k))), mb.vert(P(r_in, b, z0), ('ib', K(k + 1))),
                     mb.vert(P(rit, b, z1), ('it', K(k + 1))), mb.vert(P(rit, a, z1), ('it', K(k)))], inner_mat, True, (-rad[0], -rad[1], 0))
        ck = lambda tag, j: (tag, 'c') if solid else (tag, K(j))
        if top:
            mb.face([mb.vert(P(rot_, a, z1), ('tt', K(k))), mb.vert(P(rot_, b, z1), ('tt', K(k + 1))),
                     mb.vert(P(rit, b, z1), ck('ti', k + 1)), mb.vert(P(rit, a, z1), ck('ti', k))], top_mat, False, (0, 0, 1))
        if bottom:
            mb.face([mb.vert(P(r_out, a, z0), ('bb', K(k))), mb.vert(P(r_out, b, z0), ('bb', K(k + 1))),
                     mb.vert(P(r_in, b, z0), ck('bi', k + 1)), mb.vert(P(r_in, a, z0), ck('bi', k))], bottom_mat, False, (0, 0, -1))
    if not full:
        for a, sgn in ((ang[0], -1), (ang[-1], 1)):
            tng = (-math.sin(a) * sgn, math.cos(a) * sgn, 0)
            mb.face([mb.vert(P(r_out, a, z0)), mb.vert(P(rot_, a, z1)), mb.vert(P(rit, a, z1)), mb.vert(P(r_in, a, z0))], cut_mat, False, tng)
    mats = mats or [pbr('#BBBBBB')]
    return mb.object(name, mats, parent)

def box_cut(name, x0, x1, y0, y1, z0, z1, mats, parent=None, cut_faces=('-y',), top_mat=0):
    """Axis-aligned box with per-face materials: 0 sides, 1 cut faces (listed in cut_faces), top_mat for +z."""
    mb = MB(); c = lambda x, y, z: mb.vert((x, y, z))
    faces = {'-y': ([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], (0, -1, 0)), '+y': ([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], (0, 1, 0)),
             '-x': ([(x0, y0, z0), (x0, y1, z0), (x0, y1, z1), (x0, y0, z1)], (-1, 0, 0)), '+x': ([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], (1, 0, 0)),
             '-z': ([(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0)], (0, 0, -1)), '+z': ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1))}
    for k, (cos, out) in faces.items():
        mb.face([c(*p) for p in cos], 1 if k in cut_faces else (top_mat if k == '+z' else 0), False, out)
    return mb.object(name, mats, parent)

_shared = {}
def shared_mesh(kind):
    """Reusable unit meshes: 'pebble0..3' (irregular stones), 'leaflet' (fern pinna, +X long), 'leaf' (broad leaf), 'cyl8', 'sphere'."""
    if kind in _shared: return _shared[kind]
    if kind.startswith('pebble'):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=0.5); ob = bpy.context.active_object
        rnd = random.Random(int(kind[-1]) * 31 + 5)
        for v in ob.data.vertices:
            v.co *= 1 + rnd.uniform(-0.12, 0.12); v.co.z *= 0.7
        me = ob.data; bpy.data.objects.remove(ob)
    elif kind in ('leaflet', 'leaf'):
        n, wmax = 10, (0.11 if kind == 'leaflet' else 0.32)
        verts, faces = [], []
        for i in range(n + 1):
            x = i / n; w = wmax * math.sin(math.pi * min(1, x * 1.05)) ** 0.75 * (1 - 0.35 * x)
            z = -0.10 * x * x
            verts += [(x, -w, z + 0.35 * w), (x, 0, z), (x, w, z + 0.35 * w)]
            if i: b = 3 * (i - 1); faces += [(b, b + 3, b + 4, b + 1), (b + 1, b + 4, b + 5, b + 2)]
        me = bpy.data.meshes.new(kind); me.from_pydata(verts, [], faces); me.update()
        for p in me.polygons: p.use_smooth = True
    elif kind == 'cyl8':
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=1, depth=1, location=(0, 0, 0.5)); ob = bpy.context.active_object
        bpy.ops.object.transform_apply(location=True); me = ob.data; bpy.data.objects.remove(ob)
        for p in me.polygons: p.use_smooth = True
    else:  # sphere
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8, radius=1); ob = bpy.context.active_object
        me = ob.data; bpy.data.objects.remove(ob)
        for p in me.polygons: p.use_smooth = True
    me.name = kind; _shared[kind] = me
    return me

def instance(name, kind, mat_, at=(0, 0, 0), rot=(0, 0, 0), scale=(1, 1, 1), parent=None):
    ob = bpy.data.objects.new(name, shared_mesh(kind)); bpy.context.scene.collection.objects.link(ob)
    ob.location = at; ob.rotation_euler = [math.radians(a) for a in rot]; ob.scale = scale
    if mat_ is not None:
        if not ob.data.materials: ob.data.materials.append(mat_)
        ob.material_slots[0].link = 'OBJECT'; ob.material_slots[0].material = mat_
    if parent is not None: ob.parent = parent
    return ob

def merged_scatter(name, items, mats, parent=None):
    """One object from many small stones/specks: items = [(mesh_kind, (x,y,z), (sx,sy,sz), rot_z_deg, mat_index)]."""
    mb = MB()
    for kind, at, sc, rz, mi in items:
        me = shared_mesh(kind); base = len(mb.v); cz, sz = math.cos(math.radians(rz)), math.sin(math.radians(rz))
        for v in me.vertices:
            x, y, z = v.co.x * sc[0], v.co.y * sc[1], v.co.z * sc[2]
            mb.v.append((at[0] + x * cz - y * sz, at[1] + x * sz + y * cz, at[2] + z))
        for p in me.polygons: mb.f.append([base + i for i in p.vertices]); mb.mi.append(mi); mb.sm.append(True)
    return mb.object(name, mats, parent)

def face_scatter(name, count, region, y_face, size, colors, parent=None, seed=1, kind='pebble', embed=0.35, rough=0.7):
    """Stones/specks on a cut face at y = y_face: region(rnd) -> (x, z); they sit `embed` of their depth inside the face."""
    rnd = random.Random(seed); items = []
    mats = [pbr(c, rough=rough, grain=0.15, grain_scale=300) for c in colors]
    for i in range(count):
        x, z = region(rnd); s = size * rnd.uniform(0.6, 1.35)
        mk = f'{kind}{rnd.randrange(4)}' if kind == 'pebble' else 'sphere'
        sc = (s, s * rnd.uniform(0.7, 1.0), s * rnd.uniform(0.6, 0.9)) if kind == 'pebble' else (s * 0.5, s * 0.5, s * 0.5)
        items.append((mk, (x, y_face + sc[1] * (embed - 0.5) * (1 if kind == 'pebble' else 1.6), z), sc, rnd.uniform(0, 360), rnd.randrange(len(mats))))
    return merged_scatter(name, items, mats, parent)

# ---------------------------------------------------------------- cutaway ground block
LAYER_PRESETS = {'asphalt': ('#3A3B3E', 0.85, 0.35, 120), 'gravel': ('#8C857B', 0.9, 0.25, 60), 'soil': ('#6B4A2E', 0.95, 0.3, 50),
                 'topsoil': ('#4A3322', 0.95, 0.3, 70), 'clay': ('#A0623E', 0.9, 0.2, 30), 'sand': ('#C9AE7C', 0.95, 0.2, 150),
                 'rock': ('#77736E', 0.8, 0.3, 12), 'concrete': ('#A9A59E', 0.85, 0.15, 40), 'perlite-mix': ('#3F2C1E', 0.95, 0.32, 160)}

def layer_mat(L, cut_shade=1.0):
    col, rough, grain, gsc = LAYER_PRESETS.get(L.get('preset', L.get('name', '')), ('#8A7560', 0.9, 0.25, 60))
    col = L.get('color', col)
    return pbr(shade(col, cut_shade) if cut_shade != 1 else col, rough=L.get('rough', rough), grain=L.get('grain', grain), grain_scale=L.get('grainScale', gsc))

def _layer_extras(L, root, nm, region, y_face, unit, seed):
    """pebbles / specks on a layer's cut face."""
    if L.get('pebbles'):
        face_scatter(nm + '_pebbles', int(L['pebbles']), region, y_face, L.get('pebbleSize', 0.04 * unit),
                     L.get('pebbleColors', ['#9A938A', '#7E776F', '#B3ACA1', '#6C665F']), root, seed)
    if L.get('specks'):
        face_scatter(nm + '_specks', int(L['specks']), region, y_face, L.get('speckSize', 0.008 * unit),
                     L.get('speckColors', ['#F1EEE6', '#E4DED2']), root, seed + 7, kind='speck', embed=0.5, rough=0.5)

def build_cutaway(o):
    """A block of ground cut open toward the camera (-Y). Origin = centre of the ground line (top of the first layer).
    size [w (x), d (y)]; layers top→bottom [{name|preset, thickness, color, rough, grain, grainScale, pebbles, specks}];
    top: {kind: road|grass|sidewalk|plain, thickness, color, lanes}; cutShade darkens the cut face (default 0.82)."""
    root = empty(o['id']); w, d = o.get('size', [4, 2]); cs = o.get('cutShade', 0.82)
    x0, x1, y0, y1 = -w / 2, w / 2, -d / 2, d / 2
    z = 0.0
    for i, L in enumerate(o.get('layers', [{'preset': 'soil', 'thickness': 1.0}])):
        th = L.get('thickness', 0.5); nm = f"{o['id']}_{L.get('name', L.get('preset', 'layer'))}{i}"
        ob = box_cut(nm, x0, x1, y0, y1, z - th, z, [layer_mat(L), layer_mat(L, cs)], root)
        zz = (z - th, z)
        _layer_extras(L, root, nm, lambda r, zz=zz: (r.uniform(x0 * 0.98, x1 * 0.98), r.uniform(zz[0] + th * 0.06, zz[1] - th * 0.06)), y0, max(th, 0.2), 11 + i)
        z -= th
    if o.get('edge', True):   # a thin darker frame around the cut face: the "cut line"
        e = o.get('edgeWidth', 0.012 * max(w, -z)); col = shade('#3A2E25', 1)
        em = pbr(col, rough=0.9)
        for (a0, a1, b0, b1) in ((x0, x1, -e, 0), (x0, x1, z, z + e), (x0, x0 + e, z, 0), (x1 - e, x1, z, 0)):
            box_cut(o['id'] + f'_edge{a0:.2f}{b0:.2f}', a0, a1, y0 - 0.002, y0 + 0.001, b0, b1, [em, em], root)
    top = o.get('top')
    if top:
        kind = top.get('kind', 'plain'); th = top.get('thickness', 0.05)
        col = top.get('color', {'road': '#34363A', 'grass': '#4E8A34', 'sidewalk': '#BDB8AE'}.get(kind, '#9A9A9A'))
        gm = pbr(col, rough=0.8 if kind != 'grass' else 0.7, grain=0.2, grain_scale=40)
        box_cut(o['id'] + '_surface', x0, x1, y0, y1, 0, th, [gm, pbr(shade(col, cs), rough=0.9)], root)
        if kind == 'road' and top.get('lanes', True):
            lm = pbr(top.get('laneColor', '#F2F0E6'), rough=0.5)
            dash, gap = top.get('dash', 0.6), top.get('gap', 0.5); x = x0 + gap / 2
            while x + dash < x1:
                box_cut(o['id'] + f'_lane{x:.2f}', x, x + dash, top.get('laneY', 0) - 0.05, top.get('laneY', 0) + 0.05, th, th + 0.004, [lm, lm], root); x += dash + gap
        if kind == 'grass':
            rnd = random.Random(5); mb = MB(); n = int(min(4000, top.get('density', 900) * w * d)); hgt = top.get('blade', 0.06)
            for i in range(n):
                x, y = rnd.uniform(x0, x1), rnd.uniform(y0 + 0.01, y1); a = rnd.uniform(0, math.tau); hb = hgt * rnd.uniform(0.6, 1.4); bw = hgt * 0.08
                lean = (rnd.uniform(-0.3, 0.3) * hb, rnd.uniform(-0.3, 0.3) * hb)
                mb.face([mb.vert((x - bw * math.cos(a), y - bw * math.sin(a), th)), mb.vert((x + bw * math.cos(a), y + bw * math.sin(a), th)),
                         mb.vert((x + lean[0], y + lean[1], th + hb))], rnd.randrange(2), True)
            mb.object(o['id'] + '_grass', [pbr('#4F8E35', rough=0.6), pbr('#6AA645', rough=0.6)], root)
    return root

# ---------------------------------------------------------------- pipes, tanks, grates
def fillet(points, rb, steps=8):
    """Round every corner of a polyline with a bend of radius rb (quadratic arcs)."""
    P = [Vector(p) for p in points]; out = [P[0]]
    for i in range(1, len(P) - 1):
        a, b, c = P[i - 1], P[i], P[i + 1]; d1, d2 = a - b, c - b; l1, l2 = d1.length, d2.length
        if l1 < 1e-6 or l2 < 1e-6: continue
        d1, d2 = d1 / l1, d2 / l2; ang = math.acos(max(-1.0, min(1.0, d1.dot(d2))))
        if rb <= 0 or ang > math.pi - 1e-3: out.append(b); continue
        t = min(rb / math.tan(ang / 2), l1 * 0.5, l2 * 0.5); A, B = b + d1 * t, b + d2 * t
        for k in range(steps + 1):
            u = k / steps; out.append(A * (1 - u) ** 2 + b * (2 * u * (1 - u)) + B * (u * u))
    out.append(P[-1]); return out

def path_frames(pts, ref=(0, -1, 0)):
    """Tangent + a reference normal u per point: u follows `ref` (the cut side) where it can, else parallel transport."""
    n = len(pts); T_, U = [], []
    for i in range(n):
        t = (pts[min(n - 1, i + 1)] - pts[max(0, i - 1)]); T_.append(t.normalized() if t.length > 1e-9 else Vector((0, 0, 1)))
    F = Vector(ref); prev = None
    for t in T_:
        u = F - t * F.dot(t)
        if u.length < 0.2:
            base = prev if prev is not None else (Vector((1, 0, 0)) if abs(t.x) < 0.9 else Vector((0, 1, 0)))
            u = base - t * base.dot(t)
        u.normalize(); U.append(u); prev = u
    return T_, U

def sweep_tube(name, points, r_out, r_in=0.0, cut=0.0, cut_dir=(0, -1, 0), segs=32, mats=None, parent=None, caps=True):
    """A tube along points. cut (deg) removes that much of the wall on the cut_dir side, so the inside shows.
    Materials: 0 outside, 1 cut faces, 2 inside."""
    P = [Vector(p) for p in points]; T_, U = path_frames(P, cut_dir)
    a0, a1 = (math.radians(cut / 2), math.radians(360 - cut / 2)) if cut else (0.0, math.tau)
    full = not cut; m = segs if full else max(4, int(segs * (a1 - a0) / math.tau))
    ths = [a0 + (a1 - a0) * j / m for j in range(m + 1)]; J = (lambda j: j % m) if full else (lambda j: j)
    mb = MB()
    def pt(i, r, th): u, t = U[i], T_[i]; v = t.cross(u); return P[i] + (u * math.cos(th) + v * math.sin(th)) * r
    def radial(i, th): u, t = U[i], T_[i]; v = t.cross(u); return u * math.cos(th) + v * math.sin(th)
    for i in range(len(P) - 1):
        for j in range(m):
            th = (ths[j] + ths[j + 1]) / 2; rd = (radial(i, th) + radial(i + 1, th)) / 2
            mb.face([mb.vert(pt(i, r_out, ths[j]), ('o', i, J(j))), mb.vert(pt(i, r_out, ths[j + 1]), ('o', i, J(j + 1))),
                     mb.vert(pt(i + 1, r_out, ths[j + 1]), ('o', i + 1, J(j + 1))), mb.vert(pt(i + 1, r_out, ths[j]), ('o', i + 1, J(j)))], 0, True, rd)
            if r_in > 0:
                mb.face([mb.vert(pt(i, r_in, ths[j]), ('i', i, J(j))), mb.vert(pt(i, r_in, ths[j + 1]), ('i', i, J(j + 1))),
                         mb.vert(pt(i + 1, r_in, ths[j + 1]), ('i', i + 1, J(j + 1))), mb.vert(pt(i + 1, r_in, ths[j]), ('i', i + 1, J(j)))], 2, True, -rd)
        if not full:
            for th, sgn in ((ths[0], -1), (ths[-1], 1)):
                tg = (-U[i] * math.sin(th) + T_[i].cross(U[i]) * math.cos(th)) * sgn
                mb.face([mb.vert(pt(i, r_out, th)), mb.vert(pt(i + 1, r_out, th)), mb.vert(pt(i + 1, r_in, th)), mb.vert(pt(i, r_in, th))], 1, False, tg)
    if caps:
        for i, sgn in ((0, -1), (len(P) - 1, 1)):
            for j in range(m):
                mb.face([mb.vert(pt(i, r_out, ths[j])), mb.vert(pt(i, r_out, ths[j + 1])), mb.vert(pt(i, r_in, ths[j + 1])), mb.vert(pt(i, r_in, ths[j]))], 1, False, T_[i] * sgn)
    return mb.object(name, mats or [pbr('#D8D8D2')], parent)

def _cutter(ob):
    """A hidden solid that carves its shape out of cutaway blocks (see apply_carves)."""
    ob.hide_render = True; ob.display_type = 'WIRE'; ob['adlib_cutter'] = True
    return ob

def apply_carves(spec, objs):
    """Objects with carve: true (or a list of cutaway ids) dig their shape out of those cutaway blocks, so a pipe or tank laid on
    the cut face sits in its own trench instead of being hidden inside the ground."""
    cuts = [o['id'] for o in spec.get('objects', []) if o.get('kind') == 'cutaway']
    for o in spec.get('objects', []):
        if not o.get('carve'): continue
        cutters = [x for x in _tree(objs[o['id']]) if x.get('adlib_cutter')]
        for cid in (o['carve'] if isinstance(o['carve'], list) else cuts):
            for tgt in _tree(objs[cid]):
                if tgt.type != 'MESH' or tgt.get('adlib_cutter'): continue
                for c in cutters:
                    md = tgt.modifiers.new('carve_' + o['id'], 'BOOLEAN'); md.operation = 'DIFFERENCE'; md.object = c
                    try: md.solver = 'EXACT'
                    except Exception: pass

def build_pipe(o):
    """Pipe along `path` (points, local to the pipe's origin) with rounded elbows (bend), radius, wall,
    cut (deg of wall removed toward the camera; 180 = half pipe, so the flow inside shows), color, flanges (bool),
    carve (true or [cutaway ids]: dig a trench for it, so a pipe whose axis lies on the cut face shows in the ground)."""
    root = empty(o['id']); r = o.get('radius', 0.05); wall = o.get('wall', r * 0.15); col = o.get('color', '#D9D9D3')
    pts = fillet(o['path'], o.get('bend', r * 2.2), 10)
    mats = [pbr(col, rough=o.get('rough', 0.35), metal=o.get('metal', 0.0)), pbr(shade(col, 0.8), rough=0.6), pbr(shade(col, 0.6), rough=0.5)]
    sweep_tube(o['id'] + '_tube', pts, r, r - wall, o.get('cut', 0), tuple(o.get('cutDir', (0, -1, 0))), o.get('segs', 32), mats, root)
    if o.get('carve'): _cutter(sweep_tube(o['id'] + '_cutter', pts, r * 1.03, 0, 0, segs=24, parent=root))
    if o.get('flanges'):
        P = [Vector(p) for p in o['path']]
        for k, (a, b) in enumerate(((P[0], P[1]), (P[-1], P[-2]))):
            t = (b - a).normalized(); sweep_tube(o['id'] + f'_flange{k}', [a - t * 0.0, a + t * r * 0.5], r * 1.25, r - wall, o.get('cut', 0), tuple(o.get('cutDir', (0, -1, 0))), o.get('segs', 32), mats, root)
    return root

def build_tank(o):
    """A chamber. shape 'cyl' (radius) or 'box' (size [w, d]); height, wall, cut (deg, cyl) or cut: true (box: front wall removed),
    color, lid (bool), carve (as pipe). Origin = centre of the floor's underside. Fill it with a liquid kind 'fill' placed at the same spot."""
    root = empty(o['id']); h = o.get('height', 1.0); wall = o.get('wall', 0.05); col = o.get('color', '#A7A39B')
    mats = [pbr(col, rough=0.75, grain=0.12, grain_scale=30), pbr(shade(col, 0.8), rough=0.85), pbr(shade(col, 0.9), rough=0.8)]
    if o.get('shape', 'cyl') == 'cyl':
        r = o.get('radius', 0.5); a0, a1 = kept_arc(o.get('cut', 180) if o.get('cut', 180) is not True else 180)
        ring_sector(o['id'] + '_wall', r, r - wall, 0, h, a0, a1, 64, mats=mats, parent=root, inner_mat=2)
        ring_sector(o['id'] + '_floor', r, 0, 0, wall, a0, a1, 64, mats=mats, parent=root)
        if o.get('lid'): ring_sector(o['id'] + '_lid', r * 1.02, o.get('hole', 0), h, h + wall, a0, a1, 64, mats=mats, parent=root)
        if o.get('carve'): _cutter(ring_sector(o['id'] + '_cutter', r * 1.02, 0, -0.01, h + (wall if o.get('lid') else 0) + 0.01, 0, 360, 48, parent=root))
    else:
        w, d = o.get('size', [1, 1]); x0, x1, y0, y1 = -w / 2, w / 2, -d / 2, d / 2; cut = o.get('cut', True)
        box_cut(o['id'] + '_floor', x0, x1, y0, y1, 0, wall, mats, root)
        box_cut(o['id'] + '_back', x0, x1, y1 - wall, y1, 0, h, mats, root)
        box_cut(o['id'] + '_l', x0, x0 + wall, y0, y1, 0, h, mats, root); box_cut(o['id'] + '_r', x1 - wall, x1, y0, y1, 0, h, mats, root)
        if not cut: box_cut(o['id'] + '_front', x0, x1, y0, y0 + wall, 0, h, mats, root)
        if o.get('lid'): box_cut(o['id'] + '_lid', x0, x1, y0, y1, h, h + wall, mats, root)
        if o.get('carve'): _cutter(box_cut(o['id'] + '_cutter', x0 - 0.01, x1 + 0.01, y0 - 0.01, y1 + 0.01, -0.01, h + 0.01, [pbr('#FF00FF')], root))
    return root

def build_grate(o):
    """Storm-drain grate: size [w, d], bars (count, along x), thickness, color. Origin = centre of the top face (sits flush at z 0)."""
    root = empty(o['id']); w, d = o.get('size', [0.6, 0.4]); th = o.get('thickness', 0.04); n = o.get('bars', 7); col = o.get('color', '#2D2F31')
    m = pbr(col, rough=0.45, metal=0.7); mats = [m, pbr(shade(col, 0.8), rough=0.5, metal=0.6)]
    f = o.get('frame', 0.04)
    for nm, (a0, a1, b0, b1) in {'n': (-w / 2, w / 2, d / 2 - f, d / 2), 's': (-w / 2, w / 2, -d / 2, -d / 2 + f),
                                  'w': (-w / 2, -w / 2 + f, -d / 2, d / 2), 'e': (w / 2 - f, w / 2, -d / 2, d / 2)}.items():
        box_cut(f"{o['id']}_frame_{nm}", a0, a1, b0, b1, -th, 0, mats, root)
    bw = o.get('barWidth', (w - 2 * f) / (n * 2.2))
    for i in range(n):
        x = -w / 2 + f + (w - 2 * f) * (i + 0.5) / n
        box_cut(f"{o['id']}_bar{i}", x - bw / 2, x + bw / 2, -d / 2 + f, d / 2 - f, -th, -th * 0.1, mats, root)
    return root

# ---------------------------------------------------------------- roots, plants, pots, props
def _root_splines(o):
    rnd = random.Random(o.get('seed', 3)); depth = o.get('depth', 0.12); spread = o.get('spread', 0.1); thick = o.get('thick', 0.004)
    plane = o.get('plane', True); branch = o.get('branch', 0.7); out = []
    def bound(p):
        lim = spread * (1 - 0.25 * min(1, -p.z / depth))
        p.x = max(-lim, min(lim, p.x)); p.z = max(-depth, min(-0.002, p.z))
        if plane: p.y = max(-thick * 0.7, min(thick * 0.4, p.y))
        return p
    def grow(p, d, length, rad, level):
        pts, rads = [p.copy()], [rad]; cur = p.copy(); steps = 9
        for k in range(steps):
            d = (d + Vector((rnd.uniform(-0.45, 0.45), rnd.uniform(-0.45, 0.45) * (0.1 if plane else 1), -0.22))).normalized()
            cur = bound(cur + d * (length / steps)); pts.append(cur.copy()); rads.append(rad * (1 - 0.85 * (k + 1) / steps))
            if level < 3 and k > 0 and rnd.random() < branch * (0.45 if level == 0 else 0.25):
                side = Vector((rnd.choice((-1, 1)) * rnd.uniform(0.6, 1.0), rnd.uniform(-0.2, 0.2) * (0 if plane else 1), -rnd.uniform(0.1, 0.6)))
                grow(cur, side, length * rnd.uniform(0.35, 0.6), rads[-1] * 0.75, level + 1)
        out.append((pts, rads))
    n = o.get('count', 7)
    for i in range(n):
        a = (i + 0.5) / n * 2 - 1
        grow(Vector((a * spread * 0.15, 0, -0.003)), Vector((a * 0.9, 0, -1)), depth * rnd.uniform(0.75, 1.1), thick * rnd.uniform(0.7, 1.0), 0)
    return out

def _key_mat_emit(m, keys, color=None):
    """keys [(t, strength)]: keys emission strength (eevee/cycles) and lightens diffuse_color (workbench) per key."""
    b = bsdf(m); fps = T['fps']; base = list(m.diffuse_color)
    hi = hex_rgba(color) if color else base
    if b is not None and color: _inp(b, ['Emission Color', 'Emission'], hex_rgba(color))
    peak = max([v for _, v in keys] + [1e-6])
    for t, v in keys:
        f = round(t * fps) + 1
        if b is not None:
            s = b.inputs['Emission Strength']; s.default_value = v; s.keyframe_insert('default_value', frame=f)
        mix = min(1.0, v / peak) * 0.55
        m.diffuse_color = [base[i] + (hi[i] - base[i]) * mix for i in range(3)] + [base[3]]; m.keyframe_insert('diffuse_color', frame=f)

def build_roots(o):
    """Branching roots growing down from the origin (the soil surface under a plant). depth, spread (half width), count, branch (0..1),
    thick (base radius), color, seed, plane (default true: they lie on a cut face at y≈0, half proud of it).
    drink: {t, dur, color, strength}: the roots light up from top to bottom as water reaches them."""
    root = empty(o['id']); thick = o.get('thick', 0.004); depth = o.get('depth', 0.12); col = o.get('color', '#D9C29A')
    bands = 5 if o.get('drink') else 1
    mats = [pbr(col, rough=0.6, unique=bool(o.get('drink')), name=f"{o['id']}_band{b}") for b in range(bands)]
    cu = bpy.data.curves.new(o['id'] + '_curve', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = thick; cu.bevel_resolution = 3; cu.use_fill_caps = True
    for m in mats: cu.materials.append(m)
    for pts, rads in _root_splines(o):
        # split by depth band so the drink can travel down
        chunk = [(pts[0], rads[0])]
        def flush(ch):
            if len(ch) < 2: return
            sp = cu.splines.new('POLY'); sp.points.add(len(ch) - 1)
            for k, (p, r) in enumerate(ch): sp.points[k].co = (p.x, p.y, p.z, 1); sp.points[k].radius = max(0.15, r / thick)
            zmid = sum(p.z for p, _ in ch) / len(ch); sp.material_index = min(bands - 1, int(-zmid / depth * bands)); sp.use_smooth = True
        for p, r in zip(pts[1:], rads[1:]):
            chunk.append((p, r)); bnow = int(-chunk[0][0].z / depth * bands); bp = int(-p.z / depth * bands)
            if bp != bnow and len(chunk) >= 3: flush(chunk); chunk = [(p, r)]
        flush(chunk)
    ob = bpy.data.objects.new(o['id'] + '_roots', cu); bpy.context.scene.collection.objects.link(ob); ob.parent = root
    d = o.get('drink')
    if d:
        t, dur, s = d.get('t', 0), d.get('dur', 2.0), d.get('strength', 1.6)
        for b, m in enumerate(mats):
            tb = t + dur * b / bands
            _key_mat_emit(m, [(0, 0), (tb, 0), (tb + 0.35, s), (tb + 1.3, s * 0.35)], d.get('color', '#8FE3FF'))
    return root

def build_plant(o):
    """A fern-like plant with real leaflets (shared meshes). Origin = the crown (put it on the soil surface).
    fronds, length, droop (0 upright … 1 wilted), droopKeys [{t, v}] (animate it perking up), sway (deg), colors [3 greens], seed,
    segments (pinna pairs per frond, default 12), open (deg: fronds facing the camera stand up and droop less, so a cutaway below stays readable)."""
    root = empty(o['id']); rnd = random.Random(o.get('seed', 7)); L = o.get('length', 0.3); n = o.get('fronds', 11); segs = o.get('segments', 12)
    opening = o.get('open', 0)
    greens = o.get('colors', ['#3E7D35', '#4F9340', '#62A84C'])
    lmats = [pbr(c, rough=0.45, coat=0.2) for c in greens]; smat = pbr(o.get('stem', '#4C7A32'), rough=0.5)
    fronds = []
    for i in range(n):
        az = i / n * 360 + rnd.uniform(-12, 12); tilt0 = rnd.uniform(12, 38); bend0 = rnd.uniform(3, 6) * 9 / segs; ln = L * rnd.uniform(0.75, 1.1)
        off = abs((az + 180) % 360 - 180)   # az 0 leans toward -Y (the camera side)
        wgt = 1.0 if off > opening / 2 else 0.35
        piv = empty(f"{o['id']}_frond{i}", (0, 0, 0), root); seg = piv; chain = []
        for k in range(segs):
            sg = empty(f"{o['id']}_f{i}_s{k}", (0, 0, ln / segs if k else 0), seg); chain.append(sg)
            st = instance(f"{o['id']}_f{i}_stem{k}", 'cyl8', smat, (0, 0, 0), (0, 0, 0), (0.0035 * L / 0.3 * (1 - k / segs * 0.6),) * 2 + (ln / segs * 1.02,), sg)
            prof = math.sin(math.pi * min(1, (k + 0.8) / (segs + 0.3))) ** 0.8 * 9 / segs
            for side, ry in ((1, -28), (-1, 208)):
                ll = ln * 0.30 * prof
                if ll > 0.002:
                    instance(f"{o['id']}_f{i}_l{k}{side}", 'leaflet', lmats[(i + k + side) % len(lmats)], (0, 0, ln / segs * 0.5), (-90, ry, 0), (ll, ll, ll), sg)
            seg = sg
        fronds.append((piv, chain, az, tilt0 * wgt, bend0, wgt))
    keys = o.get('droopKeys'); sway = o.get('sway', 1.5); fps = T['fps']
    def pose(t):
        dv = sample_keys(keys, t, 'v', o.get('droop', 0.3)) if keys else o.get('droop', 0.3)
        for j, (piv, chain, az, tilt0, bend0, wgt) in enumerate(fronds):
            sw = sway * math.sin(t * 2 * math.pi / 3.1 + j * 1.7)
            piv.rotation_euler = (math.radians(tilt0 + dv * 40 * wgt + sw), 0, math.radians(az))
            for k, sg in enumerate(chain):
                if k: sg.rotation_euler = (math.radians((bend0 + dv * 14 * 9 / segs) * (0.6 + 0.4 * wgt) + sw * 0.3), 0, 0)
    pose(0)
    if keys or sway:
        step = 2
        for f in range(1, int(T['seconds'] * fps) + 2, step):
            pose((f - 1) / fps)
            for piv, chain, *_ in fronds:
                piv.keyframe_insert('rotation_euler', frame=f)
                for sg in chain[1:]: sg.keyframe_insert('rotation_euler', frame=f)
    return root

def build_pot(o):
    """A plant pot cut open toward the camera. Origin = centre of the saucer's underside (or of the pot's foot without a saucer).
    radius (top outer), bottomRadius, height, wall, cut (deg, default 180 = front half removed), color, rim (bool),
    fill (soil surface as a fraction of height, default 0.86), layers top→bottom (as build_cutaway; the last one fills to the floor),
    hole (drainage hole radius), saucer: {radius, height, color} or false, lift (gap under the pot: feet, default 0.02).
    Handy numbers (relative to the origin): pot base z = lift (+ saucer floor), soil top z = base + fill*height."""
    root = empty(o['id']); R = o.get('radius', 0.1); Rb = o.get('bottomRadius', R * 0.78); H = o.get('height', 0.2); wall = o.get('wall', R * 0.08)
    col = o.get('color', '#C46A43'); a0, a1 = kept_arc(o.get('cut', 180)); cs = o.get('cutShade', 0.85)
    sau = o.get('saucer', {}); sau = ({} if sau is True else sau)
    base = 0.0
    if sau is not False:
        sr, sh, sc_ = sau.get('radius', R * 1.15), sau.get('height', H * 0.1), sau.get('color', col)
        sm = [pbr(sc_, rough=0.7, grain=0.12, grain_scale=200), pbr(shade(sc_, 0.82), rough=0.8, grain=0.12, grain_scale=200)]
        ring_sector(o['id'] + '_saucer_floor', sr * 0.86, 0, 0, sh * 0.25, a0, a1, 64, mats=sm, parent=root)
        ring_sector(o['id'] + '_saucer_wall', sr, sr - wall * 0.8, 0, sh, a0, a1, 64, r_in_top=sr - wall * 0.8, r_out_top=sr, mats=sm, parent=root)
        ring_sector(o['id'] + '_saucer_ring', sr - wall * 0.8, sr * 0.86, 0, sh * 0.25, a0, a1, 64, mats=sm, parent=root)
        base = sh * 0.25
    lift = o.get('lift', 0.02); z0 = base + lift
    pm = [pbr(col, rough=0.75, grain=0.12, grain_scale=200), pbr(shade(col, cs), rough=0.85, grain=0.18, grain_scale=260), pbr(shade(col, 0.75), rough=0.85)]
    rr = lambda z: Rb + (R - Rb) * (z - z0) / H   # outer radius at height z
    if lift > 0:   # three small feet
        for k in range(3):
            ang = a0 + (a1 - a0) * (k + 0.5) / 3 if a1 - a0 < 360 else 90 + 120 * k
            fx, fy = math.cos(math.radians(ang)) * Rb * 0.7, math.sin(math.radians(ang)) * Rb * 0.7
            prim('cylinder', f"{o['id']}_foot{k}", (Rb * 0.3, Rb * 0.3, lift), col, (fx, fy, base + lift / 2), parent=root, bevel=0.002)
    ring_sector(o['id'] + '_wall', Rb, Rb - wall, z0, z0 + H, a0, a1, 72, r_out_top=R, r_in_top=R - wall, mats=pm, parent=root, inner_mat=2)
    fl = o.get('floor', wall * 1.2); hole = o.get('hole', Rb * 0.12)
    ring_sector(o['id'] + '_floor', Rb - wall * 0.5, hole, z0, z0 + fl, a0, a1, 72, mats=pm, parent=root, inner_mat=1)
    if o.get('rim', True):
        rh = H * 0.13
        ring_sector(o['id'] + '_rim', R + wall * 0.7, R - wall, z0 + H - rh, z0 + H, a0, a1, 72, r_out_top=R + wall * 0.7, mats=pm, parent=root, inner_mat=2)
    # soil layers, top to bottom
    top = z0 + o.get('fill', 0.86) * H; z = top; layers = o.get('layers', [{'preset': 'perlite-mix', 'thickness': H * 0.5}, {'preset': 'gravel', 'thickness': H * 0.2}])
    for i, L in enumerate(layers):
        zb = max(z0 + fl, z - L.get('thickness', 0.05)) if i < len(layers) - 1 else z0 + fl
        rin_b = rr(zb) - wall - 0.0015; rin_t = rr(z) - wall - 0.0015; nm = f"{o['id']}_{L.get('name', L.get('preset', 'layer'))}{i}"
        ring_sector(nm, rin_b, 0, zb, z, a0, a1, 72, r_out_top=rin_t, mats=[layer_mat(L), layer_mat(L, cs)], parent=root)
        if abs(a1 - a0 - 180) < 1e-3:   # flat cut plane y = 0: stones/specks on it
            _layer_extras(L, root, nm, lambda r, zb=zb, zt=z: (lambda zz: (r.uniform(-1, 1) * (rr(zz) - wall) * 0.94, zz))(r.uniform(zb + 0.004, zt - 0.003)), 0.0, H / 0.2 * 0.25, 21 + i)
        z = zb
    root['soil_top'] = top; root['pot_base'] = z0
    return root

def build_prop(o):
    """Small continuity props. prop: ball (tennis) | leaf | pebble | leaves (a scatter: count, area [w, d]). size, color, seed."""
    root = empty(o['id']); p = o.get('prop', o.get('kind')); s = o.get('size', 0.065); rnd = random.Random(o.get('seed', 2))
    if p == 'ball':
        b = prim('sphere', o['id'] + '_ball', (s, s, s), o.get('color', '#CFE04A'), parent=root, verts=40)
        b.data.materials[0] = pbr(o.get('color', '#CFE04A'), rough=0.95, grain=0.15, grain_scale=900 / max(s, 0.01) * 0.065)
        cu = bpy.data.curves.new(o['id'] + '_seam', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = s * 0.012
        sp = cu.splines.new('POLY'); N = 96; sp.points.add(N - 1); sp.use_cyclic_u = True; a_, b_ = 0.75, 0.25; c_ = 2 * math.sqrt(a_ * b_)
        for k in range(N):
            t = k / N * math.tau; v = Vector((a_ * math.cos(t) + b_ * math.cos(3 * t), a_ * math.sin(t) - b_ * math.sin(3 * t), c_ * math.sin(2 * t))).normalized() * s * 0.503
            sp.points[k].co = (v.x, v.y, v.z, 1)
        cu.materials.append(pbr('#F4F4EC', rough=0.8)); ob = bpy.data.objects.new(o['id'] + '_seamob', cu); bpy.context.scene.collection.objects.link(ob); ob.parent = root
        root.location = (0, 0, s / 2)
    elif p in ('leaf', 'leaves'):
        cols = o.get('colors', [o.get('color', '#C77B30'), '#A8572A', '#D9A441', '#7E8F3A'])
        n = o.get('count', 1 if p == 'leaf' else 12); w, d = o.get('area', [0.4, 0.3])
        for k in range(n):
            at = (0, 0, 0) if p == 'leaf' else (rnd.uniform(-w / 2, w / 2), rnd.uniform(-d / 2, d / 2), rnd.uniform(0, 0.004))
            sz = s * (1 if p == 'leaf' else rnd.uniform(0.7, 1.3))
            instance(f"{o['id']}_leaf{k}", 'leaf', pbr(cols[k % len(cols)], rough=0.6), at, (rnd.uniform(-8, 8), rnd.uniform(-8, 8), rnd.uniform(0, 360)), (sz, sz, sz), root)
    else:   # pebble
        ob = instance(o['id'] + '_stone', f'pebble{rnd.randrange(4)}', pbr(o.get('color', '#8E8880'), rough=0.7, grain=0.2, grain_scale=200), (0, 0, s * 0.3), (0, 0, rnd.uniform(0, 360)), (s, s * 0.8, s * 0.6), root)
    return root

# ---------------------------------------------------------------- liquid
def _poly_curve(name, pts, radius, mat_, radii=None, parent=None):
    cu = bpy.data.curves.new(name, 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = radius; cu.bevel_resolution = 4; cu.use_fill_caps = True
    cu.bevel_factor_mapping_start = 'SPLINE'; cu.bevel_factor_mapping_end = 'SPLINE'
    sp = cu.splines.new('POLY'); sp.points.add(len(pts) - 1); sp.use_smooth = True
    for k, p in enumerate(pts): sp.points[k].co = (p[0], p[1], p[2], 1); sp.points[k].radius = radii[k] if radii else 1.0
    cu.materials.append(mat_); ob = bpy.data.objects.new(name, cu); bpy.context.scene.collection.objects.link(ob)
    if parent is not None: ob.parent = parent
    return ob

def _polyline_at(pts, lens, s):
    """Point and tangent at arc length s on a polyline (lens = cumulative lengths)."""
    s = max(0.0, min(lens[-1], s))
    for i in range(1, len(pts)):
        if s <= lens[i] or i == len(pts) - 1:
            seg = lens[i] - lens[i - 1]; u = (s - lens[i - 1]) / seg if seg > 1e-9 else 0
            return pts[i - 1].lerp(pts[i], u), (pts[i] - pts[i - 1]).normalized()

def _hide_keys(obs, visible_fn):
    """Key hide_render/hide_viewport per frame where visibility changes (visible_fn(t) -> bool)."""
    fps = T['fps']; last = None
    for f in range(1, int(T['seconds'] * fps) + 2):
        v = visible_fn((f - 1) / fps)
        if v != last:
            for ob in obs:
                ob.hide_render = not v; ob.hide_viewport = not v
                ob.keyframe_insert('hide_render', frame=f); ob.keyframe_insert('hide_viewport', frame=f)
            last = v

def _stream(o, root, pts, radius, radii, start, stop, speed, m):
    """A stream along pts that runs in at `start` and runs out after `stop` (keyed bevel factors), with moving highlight dashes."""
    P = [Vector(p) for p in pts]; lens = [0.0]
    for a, b in zip(P, P[1:]): lens.append(lens[-1] + (b - a).length)
    Ltot = lens[-1]; travel = Ltot / max(1e-6, speed); fps = T['fps']
    ob = _poly_curve(o['id'] + '_stream', pts, radius, m, radii, root); cu = ob.data
    stop = stop if stop is not None else T['seconds'] + travel + 1
    for f in range(1, int(T['seconds'] * fps) + 2):
        t = (f - 1) / fps
        cu.bevel_factor_end = max(0.0, min(1.0, (t - start) / travel)); cu.bevel_factor_start = max(0.0, min(1.0, (t - stop) / travel))
        cu.bevel_factor_end = max(cu.bevel_factor_end, cu.bevel_factor_start + 1e-4)
        cu.keyframe_insert('bevel_factor_end', frame=f); cu.keyframe_insert('bevel_factor_start', frame=f)
    _hide_keys([ob], lambda t: start <= t <= stop + travel)
    nd = o.get('dashes', 0)
    if nd:
        dm = pbr(o.get('dashColor', '#D8F1FF'), rough=0.05, emit=0.8, alpha=0.9, blend='BLENDED')
        spacing = Ltot / nd if o.get('dashSpacing') is None else o['dashSpacing']
        for k in range(nd):
            d = instance(f"{o['id']}_dash{k}", 'sphere', dm, (0, 0, 0), (0, 0, 0), (1, 1, 1), root)
            for f in range(1, int(T['seconds'] * fps) + 2):
                t = (f - 1) / fps; s = ((t - start) * speed * o.get('dashSpeed', 1.0)) % (spacing * nd) - k * spacing
                s = s % (spacing * nd) if t >= start else -1
                head, tail = (t - start) * speed, (t - stop) * speed
                vis = start <= t and 0 <= s <= min(Ltot, head) and s >= max(0, tail)
                p, tg = _polyline_at(P, lens, max(0, s))
                d.location = p; d.rotation_euler = tg.to_track_quat('Z', 'Y').to_euler()
                r = radius * 0.55 if vis else 0.0
                d.scale = (r, r, r * 3.2) if vis else (1e-5, 1e-5, 1e-5)
                d.keyframe_insert('location', frame=f); d.keyframe_insert('rotation_euler', frame=f); d.keyframe_insert('scale', frame=f)
    return ob

def build_liquid(o):
    """Water (or any liquid). mode:
      fill  — a volume that rises (dir 'up') or a front that grows down (dir 'down', e.g. water soaking into soil).
              shape box (size [w, d, h]) | cyl (radius = at the bottom, radiusTop, height) | sector (radius, radiusTop, height, cut); level keys [{t, v 0..1}].
              Origin = bottom centre (up) or top centre (down).
      flow  — along `path` (points, local), radius, start, stop (s), speed (m/s), dashes (moving highlights), bend.
      fall  — a stream from `from` to `to` (local points), arc (sideways bulge), radius, start, stop, drips (drops after it stops), splash (bool).
    material: water (default) | wet (dark wet soil: give color) | any colour via color."""
    root = empty(o['id']); mode = o.get('mode', 'fill'); fps = T['fps']
    m = water_mat(o.get('color', '#3AA0F0'), o.get('alpha', 0.8)) if o.get('material', 'water') == 'water' else \
        pbr(o.get('color', '#2E1E12'), rough=0.5, coat=0.12, grain=0.25, grain_scale=160, alpha=o.get('alpha', 1.0))
    if mode == 'fill':
        down = o.get('dir', 'up') == 'down'; shape = o.get('shape', 'box')
        if shape == 'box':
            w, d, h = o.get('size', [0.5, 0.5, 0.5]); ob = box_cut(o['id'] + '_body', -w / 2, w / 2, -d / 2, d / 2, -h if down else 0, 0 if down else h, [m, m], root)
        else:
            r = o.get('radius', 0.1); rt = o.get('radiusTop', r); h = o.get('height', 0.1); a0, a1 = kept_arc(o.get('cut', 0) if shape == 'sector' else 0)
            ob = ring_sector(o['id'] + '_body', r, 0, -h if down else 0, 0 if down else h, a0, a1, 72, r_out_top=rt, mats=[m, m], parent=root)
        if o.get('offset'): ob.location = o['offset']
        keys = o.get('level', [{'t': 0, 'v': 1}])
        for f in range(1, int(T['seconds'] * fps) + 2):
            v = max(1e-3, sample_keys(keys, (f - 1) / fps, 'v', 1)); ob.scale = (1, 1, v); ob.keyframe_insert('scale', frame=f)
        _hide_keys([ob], lambda t: sample_keys(keys, t, 'v', 1) > 0.004)
    elif mode == 'flow':
        pts = fillet(o['path'], o.get('bend', o.get('radius', 0.02) * 2), 8)
        _stream(o, root, [tuple(p) for p in pts], o.get('radius', 0.02), None, o.get('start', 0), o.get('stop'), o.get('speed', 0.3), m)
    else:   # fall
        a, b = Vector(o.get('from', (0, 0, 1))), Vector(o.get('to', (0, 0, 0))); arc = Vector(o.get('arc', (0, 0, 0)))
        pts = [a.lerp(b, u) + arc * (4 * u * (1 - u)) for u in [k / 14 for k in range(15)]]
        h = max(0.01, a.z - b.z); speed = o.get('speed', max(0.4, math.sqrt(2 * 9.81 * h)))
        radii = [1.0 - 0.45 * (k / 14) ** 0.7 for k in range(15)]
        start, stop = o.get('start', 0), o.get('stop')
        _stream(o, root, [tuple(p) for p in pts], o.get('radius', 0.01), radii, start, stop, speed, m)
        if o.get('splash'):
            rm = water_mat(shade(o.get('color', '#3AA0F0'), 1.3), 0.6)
            r0 = o.get('radius', 0.01)
            for k in range(2):
                ring = prim('torus', f"{o['id']}_ripple{k}", (r0 * 4, r0 * 4, r0 * 2.5), '#9AD4FF', tuple(b), parent=root, verts=32)
                ring.data.materials[0] = rm
                end = (stop if stop is not None else T['seconds']) + h / speed
                for f in range(1, int(T['seconds'] * fps) + 2):
                    t = (f - 1) / fps; ph = ((t - start - h / speed) / 0.45 + k * 0.5) % 1.0
                    s = 0.4 + 1.6 * ph if start + h / speed <= t <= end else 1e-4; ring.scale = (s, s, max(1e-4, 1 - ph) if s > 1e-3 else 1e-4)
                    ring.keyframe_insert('scale', frame=f)
        for k in range(o.get('drips', 0)):
            dr = instance(f"{o['id']}_drip{k}", 'sphere', m, tuple(a), (0, 0, 0), (1e-5,) * 3, root)
            t0 = (stop if stop is not None else T['seconds']) + 0.25 + k * o.get('dripEvery', 0.45); tf = math.sqrt(2 * h / 9.81)
            for f in range(1, int(T['seconds'] * fps) + 2):
                t = (f - 1) / fps; u = (t - t0) / tf
                if 0 <= u <= 1:
                    p = a.lerp(b, u * u) + arc * (4 * u * u * (1 - u * u)); dr.location = p; r = o.get('radius', 0.01) * 0.9; dr.scale = (r, r, r * 1.4)
                else: dr.scale = (1e-5,) * 3
                dr.keyframe_insert('location', frame=f); dr.keyframe_insert('scale', frame=f)
    return root

BUILDERS.update({'cutaway': build_cutaway, 'pipe': build_pipe, 'tank': build_tank, 'grate': build_grate, 'roots': build_roots,
                 'plant': build_plant, 'pot': build_pot, 'liquid': build_liquid, 'prop': build_prop,
                 'ball': build_prop, 'leaf': build_prop, 'leaves': build_prop, 'pebble': build_prop})

# ---------------------------------------------------------------- beats: appear / vanish / glow
def _tree(ob): return [ob] + list(ob.children_recursive)

def _bbox_size(ob):
    bpy.context.view_layer.update(); lo, hi = Vector((1e9,) * 3), Vector((-1e9,) * 3)
    for x in _tree(ob):
        if x.type in ('MESH', 'CURVE', 'FONT'):
            for c in x.bound_box:
                w = x.matrix_world @ Vector(c); lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return (hi - lo) if hi.x > lo.x else Vector((0.3, 0.3, 0.3))

def apply_appear(ob, a, vanish=False):
    """appear/vanish = {t, how: rise|drop|grow|fade|pop, dur, dist}. Uses delta transforms, so it stacks with `keys`.
    rise comes up from below (dist), drop falls in from above and settles, grow scales up from 0, fade keys alpha (eevee/cycles;
    workbench falls back to grow), pop = no motion, just switches on. Before t (appear) / after t+dur (vanish) the part is hidden."""
    fps = T['fps']; t, how, dur = a.get('t', 0.0), a.get('how', 'rise'), max(1.0 / fps, a.get('dur', 0.6))
    if how == 'fade' and T['engine'] == 'workbench': how = 'grow'
    size = _bbox_size(ob); dist = a.get('dist', max(size.z, 0.05) * 1.2)
    objs = _tree(ob)
    t_in, t_out = (t, t + dur)
    _hide_keys(objs, (lambda tt: tt >= t_in - 1e-6) if not vanish else (lambda tt: tt <= t_out + 1e-6))
    mats = []
    if how == 'fade':
        for x in objs:
            for sl in getattr(x, 'material_slots', []):
                if sl.material and sl.material not in [m for m, _ in mats]:
                    cp = sl.material.copy(); sl.material = cp; mats.append((cp, bsdf(cp)))
                    if hasattr(cp, 'surface_render_method') and cp.surface_render_method != 'BLENDED': cp.surface_render_method = 'DITHERED'
    f0, f1 = round(t_in * fps) + 1, round(t_out * fps) + 1
    for f in range(max(1, f0 - 1), f1 + 2):
        u = (f - f0) / max(1, f1 - f0); u = max(0.0, min(1.0, u)); p = 1 - u if vanish else u
        if how == 'rise': ob.delta_location = (0, 0, -dist * (1 - ease(p, 'out'))); ob.keyframe_insert('delta_location', frame=f)
        elif how == 'drop': ob.delta_location = (0, 0, dist * (1 - ease(p, 'back' if not vanish else 'in'))); ob.keyframe_insert('delta_location', frame=f)
        elif how == 'grow':
            s = max(1e-4, ease(p, 'back' if not vanish else 'out')); ob.delta_scale = (s, s, s); ob.keyframe_insert('delta_scale', frame=f)
        elif how == 'fade':
            for m_, b in mats:
                if b is not None:
                    b.inputs['Alpha'].default_value = ease(p, 'inout'); b.inputs['Alpha'].keyframe_insert('default_value', frame=f)

def apply_glow(ob, g):
    """glow = {color, keys: [{t, v}]}: emission strength over time on this part's own copies of its materials."""
    keys = [(k['t'], k['v']) for k in g.get('keys', [])]
    done = {}
    for x in _tree(ob):
        for sl in getattr(x, 'material_slots', []):
            if not sl.material: continue
            if sl.material.name not in done:
                cp = sl.material.copy(); done[sl.material.name] = cp; _key_mat_emit(cp, keys, g.get('color'))
            sl.material = done[sl.material.name]

# ---------------------------------------------------------------- one continuous camera
def _hermite_track(beats, field):
    """C1 spline through the beats' values (Catmull-Rom tangents in time); 'stop': true or the ends get zero velocity."""
    pts = [(b['t'], Vector(b[field]) if isinstance(b[field], (list, tuple)) else Vector((b[field], 0.0))) for b in beats]
    n = len(pts); tans = []
    for i in range(n):
        if i == 0 or i == n - 1 or beats[i].get('stop'): tans.append(pts[i][1] * 0)
        else: tans.append((pts[i + 1][1] - pts[i - 1][1]) / max(1e-6, pts[i + 1][0] - pts[i - 1][0]) * beats[i].get('tension', 1.0))
    def at(t):
        if t <= pts[0][0]: return pts[0][1]
        if t >= pts[-1][0]: return pts[-1][1]
        for i in range(n - 1):
            t0, t1 = pts[i][0], pts[i + 1][0]
            if t0 <= t <= t1:
                h = t1 - t0; u = (t - t0) / h; u2, u3 = u * u, u * u * u
                return pts[i][1] * (2 * u3 - 3 * u2 + 1) + tans[i] * h * (u3 - 2 * u2 + u) + pts[i + 1][1] * (-2 * u3 + 3 * u2) + tans[i + 1] * h * (u3 - u2)
    return at

def camera_path(beats):
    """beats [{t, at, look, lens?, stop?, hold?}] -> f(t) = (position, target, lens). One smooth move through every beat:
    the camera never stops between beats (unless stop: true), eases in at the first and out at the last.
    hold: seconds adds a resting copy of the beat (a still moment inside the move)."""
    bs = []
    for b in sorted(beats, key=lambda b: b['t']):
        bs.append(dict(b))
        if b.get('hold'): bs[-1]['stop'] = True; bs.append({**b, 't': b['t'] + b['hold'], 'stop': True})
    for b in bs: b.setdefault('lens', bs[0].get('lens', 35)); b.setdefault('look', bs[0].get('look', [0, 0, 0]))
    P, L, Z = _hermite_track(bs, 'at'), _hermite_track(bs, 'look'), _hermite_track(bs, 'lens')
    return lambda t: (P(t), L(t), Z(t).x)

# ---------------------------------------------------------------- world, lights, camera
def build_world(w, look):
    sc = bpy.context.scene
    world = bpy.data.worlds.new('world'); sc.world = world; world.use_nodes = True
    bg = world.node_tree.nodes.get('Background'); col = w.get('color', '#EFE6DA' if look != 'blueprint' else '#123A6B')
    bg.inputs['Color'].default_value = hex_rgba(col); bg.inputs['Strength'].default_value = w.get('strength', 0.6)
    if look == 'real': world.color = hex_rgba(col)[:3]   # workbench background
    if w.get('fog') and T['engine'] == 'eevee':   # light atmospheric depth (eevee only; cycles would pay a lot for it)
        vol = world.node_tree.nodes.new('ShaderNodeVolumePrincipled'); vol.inputs['Density'].default_value = w['fog']
        vol.inputs['Color'].default_value = hex_rgba(w.get('fogColor', col))
        world.node_tree.links.new(vol.outputs['Volume'], world.node_tree.nodes['World Output'].inputs['Volume'])
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
    opts = kind if isinstance(kind, dict) else {}
    kind = opts.get('kind', kind) if opts else kind
    if kind == 'daylight':   # scale-free: a soft warm sun (shadows) + a cool shadowless fill sun + the world as sky light
        def sun(name, az, el, energy, color, shadow=True, angle=6):
            l = bpy.data.lights.new(name, 'SUN'); l.energy = energy; l.color = hex_rgba(color)[:3]; l.angle = math.radians(angle)
            if hasattr(l, 'use_shadow'): l.use_shadow = shadow
            ob = bpy.data.objects.new(name, l); sc.collection.objects.link(ob)
            d = -Vector((math.cos(math.radians(el)) * math.sin(math.radians(az)), -math.cos(math.radians(el)) * math.cos(math.radians(az)), math.sin(math.radians(el))))
            ob.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler(); return ob
        az, el = opts.get('sun', [150, 38])   # azimuth 0 = from the camera side (-Y), 180 = from behind; elevation in degrees
        sun('sun', az, el, opts.get('energy', 3.2), opts.get('color', '#FFE9CF'), True, opts.get('softness', 7))
        sun('fill', opts.get('fillAz', -25), 25, opts.get('fill', 0.9), '#DCE7FF', False, 30)
        if opts.get('rim', 0): sun('rim', az + 180, 15, opts['rim'], '#FFFFFF', False, 20)
        return
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
    if 'clip' in c or c.get('path'): cam.clip_start = c.get('clip', 0.01); cam.clip_end = c.get('clipEnd', 200)
    if c.get('path'):   # one continuous move through the beats (see camera_path)
        fn = camera_path(c['path'])
        for f in range(0, int(seconds * fps) + 1):
            p, l, z = fn(f / fps); ob.location = p; target.location = l; cam.lens = z
            ob.keyframe_insert('location', frame=f + 1); target.keyframe_insert('location', frame=f + 1); cam.keyframe_insert('lens', frame=f + 1)
        return ob
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
    if 'frame_start' in spec: sc.frame_start = int(spec['frame_start'])
    if 'frame_end' in spec: sc.frame_end = int(spec['frame_end'])
    eng = spec.get('engine', 'workbench')
    if eng == 'cycles':
        sc.render.engine = 'CYCLES'; sc.cycles.samples = spec.get('samples', 24); sc.cycles.use_denoising = True; sc.cycles.device = 'GPU' if spec.get('gpu') else 'CPU'
    elif eng == 'eevee':
        sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items] else 'BLENDER_EEVEE'
        sc.eevee.taa_render_samples = spec.get('samples', 32)
        if spec.get('look') == 'real':
            for k, v in (('use_raytracing', True), ('use_shadows', True), ('use_fast_gi', True), ('shadow_ray_count', 2), ('shadow_step_count', 8)):
                if hasattr(sc.eevee, k): setattr(sc.eevee, k, v)
    else:
        sc.render.engine = 'BLENDER_WORKBENCH'; sh = sc.display.shading
        sh.light = 'STUDIO'; sh.color_type = 'MATERIAL'; sh.show_cavity = True; sh.cavity_type = 'BOTH'; sh.show_shadows = True
        if spec.get('look') == 'xray': sh.show_xray = True; sh.xray_alpha = 0.6
        if spec.get('look') == 'real':   # a clean studio-lit preview of the explainer look
            sh.studio_light = 'studio.sl' if 'studio.sl' in bpy.context.preferences.studio_lights else sh.studio_light
            sh.show_specular_highlight = True; sh.show_object_outline = True; sh.object_outline_color = (0.08, 0.07, 0.06)
            sh.cavity_ridge_factor = 0.6; sh.cavity_valley_factor = 0.8; sh.shadow_intensity = 0.25
            sc.display.shadow_shift = 0.1; sc.display.shadow_focus = 0.9
    sc.view_settings.view_transform = 'Standard' if eng == 'workbench' else 'AgX' if 'AgX' in [v.identifier for v in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
    sc.render.image_settings.file_format = 'PNG'; sc.render.film_transparent = False
    if spec.get('exposure') is not None: sc.view_settings.exposure = spec['exposure']

def normalize_spec(spec):
    """Accept the app's world-stage names too: resolution -> size, render.{percent, engine, samples, gpu} -> top level,
    frame_start/frame_end -> seconds (keys are timed as t = (frame - 1) / fps). Returns the same dict, filled in."""
    if 'resolution' in spec and 'size' not in spec: spec['size'] = list(spec['resolution'])
    for k, v in (spec.get('render') or {}).items():
        if k in ('percent', 'engine', 'samples', 'gpu', 'exposure') and k not in spec: spec[k] = v
    fps = spec.get('fps', 24)
    if 'frame_end' in spec and 'seconds' not in spec: spec['seconds'] = spec['frame_end'] / fps
    if spec.get('script') and not os.path.isabs(spec['script']) and not os.path.exists(spec['script']) and spec.get('_dir'):
        spec['script'] = os.path.join(spec['_dir'], spec['script'])
    return spec

def build(spec):
    normalize_spec(spec)
    clear()
    LOOK['value'] = spec.get('look', 'clay'); _mats.clear(); _pbr.clear(); _shared.clear()
    T.update(fps=spec.get('fps', 24), seconds=spec.get('seconds', 4), engine=spec.get('engine', 'workbench'))
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
    apply_carves(spec, objs)
    for o in spec.get('objects', []):   # beats: parts arrive / leave / light up on their time
        if o.get('appear'): apply_appear(objs[o['id']], o['appear'])
        if o.get('vanish'): apply_appear(objs[o['id']], o['vanish'], vanish=True)
        if o.get('glow'): apply_glow(objs[o['id']], o['glow'])
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

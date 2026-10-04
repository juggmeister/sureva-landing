# =============================================================================
#  SUREVA — UV-sensing wearable enclosure, Blender generator
#  Paste into Blender's Scripting tab (3.6 / 4.x) and press Run, then F12.
#
#  Units: scene scale is set so 1 Blender unit == 1 mm; every number is mm.
#
#  RENDER_VIEW picks the shot:
#    'exploded'  three-layer teardown, front-on, tilted slightly down
#    'assembled' the device closed, three-quarter product view
#  Everything else is shared, so the two renders match exactly.
# =============================================================================

import bpy, bmesh, math, os, random
from mathutils import Matrix, Vector

# -----------------------------------------------------------------------------
#  0. SWITCHES
# -----------------------------------------------------------------------------
RENDER_VIEW       = 'assembled'
CLEAR_SCENE       = True
EXPLODED_GAP      = 7.0      # even vertical gap between the three layers
SHOW_PCB          = True

# -----------------------------------------------------------------------------
#  1. MASTER DIMENSIONS  (mm)
# -----------------------------------------------------------------------------
DEV_LENGTH        = 26.0
DEV_WIDTH         = 13.0
DEV_HEIGHT        = 4.8
CORNER_R          = DEV_WIDTH * 0.5     # true semicircular ends
PROFILE_SEG       = 40

TOP_H             = 1.8
BOTTOM_H          = 3.0
SEAM_Z            = BOTTOM_H

# --- top shell: pillowed, no flat land ---
TOP_RIM_FILLET    = 1.0
DOME_SPAN         = 4.0
DOME_RISE         = 0.5
DOME_SEG          = 24
TOP_WALL_THK      = 1.6
TOP_CEIL_THK      = 0.9
INNER_CEILING_Z   = SEAM_Z + TOP_H - TOP_CEIL_THK       # 3.9

# --- bottom shell ---
BOT_BASE_FILLET   = 1.6
BASE_SEG          = 20

# --- the three top-face features, all on the long centreline (Y = 0) ---
FEATURE_PITCH     = 7.5      # UV window at +pitch, LED at -pitch, button at 0
UV_W              = 4.4      # UV window: rounded rectangle, long side along the device
UV_H              = 2.5
UV_R              = 0.75
UV_LIP            = 0.55     # counterbore margin around the window on the underside
UV_LIP_DEPTH      = 0.4
UV_X              = FEATURE_PITCH
BTN_DIA           = 4.6      # the button cap
BTN_GAP           = 0.2      # clearance ring around it
BTN_POCKET        = 0.55     # pocket depth below the crown
BTN_PROUD         = 0.07     # how far the cap stands above the crown
BTN_DISH          = 0.06     # slight finger dish in the cap
LED_DIA           = 1.6
LED_X             = -FEATURE_PITCH
LED_POCKET_DEPTH  = 0.6
LED_PROUD         = 0.02

# --- base finish: 'aluminium' (bead-blasted, natural) or 'terracotta' (anodised) ---
FINISH            = 'aluminium'

# --- receiver coil for wireless charging, on the cavity floor under the battery ---
COIL_R0           = 1.2
COIL_R1           = 3.85
COIL_TURNS        = 9
COIL_WIRE         = 0.075    # wire radius
FERRITE_DIA       = 8.2
FERRITE_THK       = 0.06

# --- the wireless charging pad the device sits in (explode shot) ---
PAD_L             = DEV_LENGTH + 9.0
PAD_W             = DEV_WIDTH + 9.0
PAD_H             = 3.2
PAD_FILLET        = 1.3
PAD_RECESS        = 0.8
PAD_CLEAR         = 0.35

# --- cavity ---
CAV_LENGTH        = 20.6
CAV_WIDTH         = 8.6
CAV_DEPTH         = 2.2
CAV_CORNER_R      = CAV_WIDTH * 0.5
CAV_FLOOR_Z       = BOTTOM_H - CAV_DEPTH               # 0.8

# --- gasket channel on the bottom rim ---
GASKET_INBOARD    = 1.0
GASKET_WIDTH      = 0.6
GASKET_DEPTH      = 0.5

# --- parting-line groove (conceals the vent) ---
GROOVE_DEPTH      = 0.2      # radial
GROOVE_HEIGHT     = 0.35     # below the seam
VENT_LENGTH       = 2.4
VENT_HEIGHT       = 0.22     # sits inside the groove, so it reads as the seam
VENT_X            = -4.0
VENT_SIDE         = -1.0     # -Y wall
VENT_RECESS       = 0.3      # membrane pocket on the cavity side
VENT_RECESS_PAD   = 0.5

# --- exterior base ---
COIL_PAD_DIA      = 8.0
COIL_PAD_DEPTH    = 0.15

# --- wordmark on the side wall (image etch, text fallback) ---
LOGO_MODE         = 'image'          # 'image' | 'text' | 'none'
LOGO_PATH         = ""               # leave empty to auto-find LOGO_FILENAME
LOGO_FILENAME     = "sureva_logo.png"
LOGO_TEXT         = "sureva"
LOGO_FACE_Y       = -1.0
LOGO_X            = 0.0
LOGO_Z            = 1.98             # centred on the flat band of the side wall
LOGO_WIDTH        = 8.5              # sized for a trimmed wordmark image
LOGO_HEIGHT       = 8.5 * 0.1431     # its aspect (height / width)
LOGO_ETCH_DEPTH   = 0.03
LOGO_ETCH_ROUGH   = 0.62
LOGO_ETCH_TINT    = 0.42             # engraved colour as a fraction of the base colour
LOGO_ETCH_METAL   = 1.0              # metallic inside the engraving
if FINISH == 'aluminium':            # laser-etched bare aluminium: pale, matte, mostly diffuse
    LOGO_ETCH_TINT, LOGO_ETCH_METAL, LOGO_ETCH_ROUGH = 0.86, 0.15, 0.7
LOGO_SIZE         = 0.9
LOGO_CARVE_DEPTH  = 0.08

CUT_FILLET        = 0.12
CUT_FILLET_SEG    = 3

# --- PCB assembly (SHOW_PCB) ---
#     Battery lies flat under the board; the board carries everything else,
#     each part directly beneath its feature in the top shell.
PCB_SIZE          = (20.0, 8.0, 0.45)
PCB_Z             = 2.55
PCB_TOP           = PCB_Z + PCB_SIZE[2]                 # 3.0
BATT_SIZE         = (14.0, 7.0, 1.5)
BATT_Z            = 0.95
UV_CHIP           = (2.0, 2.0, 0.40)
UV_LENS_DIA       = 1.2
LED_PKG           = (1.6, 0.8, 0.45)
SHIELD_CAN        = (4.4, 3.2, 0.7)
SHIELD_POS        = (4.2, 0.0)
TH_SENSOR         = (1.8, 1.8, 0.5)
TH_POS            = (-4.0, -2.35)
IMU               = (2.0, 2.0, 0.5)
IMU_POS           = (-4.0, 2.35)
TRACE_W           = 0.14
TRACE_H           = 0.015
SILK_W            = 0.09
SILK_H            = 0.012
VIA_DIA           = 0.32
N_PASSIVES        = 10

# -----------------------------------------------------------------------------
#  2. PALETTE  (sRGB hex -> linear)
# -----------------------------------------------------------------------------
def hex_lin(h):
    h = h.lstrip('#')
    out = []
    for i in (0, 2, 4):
        c = int(h[i:i + 2], 16) / 255.0
        out.append(c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4)
    return tuple(out) + (1.0,)

BONE       = hex_lin("#EFEAE1")
TERRACOTTA = hex_lin("#D97A4E")
ALUMINIUM  = (0.80, 0.81, 0.82, 1.0)      # bead-blasted silver, a touch below raw F0
ALU_ROUGH  = 0.34
PAD_WHITE  = hex_lin("#ECEAE5")
NAVY       = hex_lin("#1B2440")
AMBER      = hex_lin("#FFA23B")
BG_CENTRE  = hex_lin("#CFC6B9")
BG_EDGE    = hex_lin("#B3A99B")

# -----------------------------------------------------------------------------
#  3. STUDIO
# -----------------------------------------------------------------------------
CYC_HALF_WIDTH    = 700.0
CYC_FLOOR_FRONT   = -600.0
CYC_ARC_START_Y   = 150.0
CYC_ARC_RADIUS    = 160.0
CYC_WALL_TOP      = 520.0
CYC_ARC_SEG       = 16
BACKDROP_POOL_R   = 380.0
BACKDROP_ROUGH    = 0.85     # matte — no floor reflections

KEY_INTENSITY     = 1.30
FILL_INTENSITY    = 0.95
TOP_INTENSITY     = 1.60
BACK_INTENSITY    = 0.55
WORLD_STRENGTH    = 0.85
WORLD_COLOR       = hex_lin("#D8D0C4")
REFLECT_STUDIO    = True     # glossy rays see a softbox + dark horizon instead of the flat world

RENDER_SAMPLES    = 256
RENDER_PERCENT    = 100

if RENDER_VIEW == 'exploded':
    EXPLODE = EXPLODED_GAP
    AIM     = (0.0, 0.0, DEV_HEIGHT * 0.5 + EXPLODED_GAP)
    CAM_LOC = (0.0, -112.0, AIM[2] + 24.0)
    CAM_LENS = 85.0
    RENDER_RES = (2000, 2000)
else:
    EXPLODE = 0.0
    AIM     = (0.0, 0.0, DEV_HEIGHT * 0.45)
    CAM_LOC = (44.0, -86.0, 40.0)
    CAM_LENS = 85.0
    RENDER_RES = (2400, 1800)


# =============================================================================
#  4. GEOMETRY HELPERS
# =============================================================================
def rounded_rect(length, width, radius, seg=PROFILE_SEG, inset=0.0):
    L = length - 2.0 * inset
    W = width - 2.0 * inset
    R = max(0.02, min(radius - inset, min(L, W) * 0.5 - 1e-4))
    hx, hy = L * 0.5 - R, W * 0.5 - R
    pts = []
    for cx, cy, a0 in ((hx, hy, 0.0), (-hx, hy, 90.0), (-hx, -hy, 180.0), (hx, -hy, 270.0)):
        for i in range(seg + 1):
            a = math.radians(a0 + 90.0 * i / seg)
            pts.append((cx + R * math.cos(a), cy + R * math.sin(a)))
    out = []
    for p in pts:
        if not out or (abs(p[0] - out[-1][0]) > 1e-6 or abs(p[1] - out[-1][1]) > 1e-6):
            out.append(p)
    if abs(out[0][0] - out[-1][0]) < 1e-6 and abs(out[0][1] - out[-1][1]) < 1e-6:
        out.pop()
    return out


def circle_pts(dia, seg=96):
    return [(dia * 0.5 * math.cos(2 * math.pi * i / seg),
             dia * 0.5 * math.sin(2 * math.pi * i / seg)) for i in range(seg)]


def _finish(name, bm, coll, matrix=None):
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    if matrix is not None:
        bmesh.ops.transform(bm, matrix=matrix, verts=bm.verts[:])
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    ob = bpy.data.objects.new(name, me)
    coll.objects.link(ob)
    return ob


def loft(name, rings, coll, matrix=None):
    bm = bmesh.new()
    layers = [[bm.verts.new((x, y, z)) for x, y in pts] for pts, z in rings]
    n = len(layers[0])
    for lo, hi in zip(layers, layers[1:]):
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new((lo[i], lo[j], hi[j], hi[i]))
    bm.faces.new(list(reversed(layers[0])))
    bm.faces.new(layers[-1])
    return _finish(name, bm, coll, matrix)


def prism(name, pts, z0, z1, coll, matrix=None):
    return loft(name, [(pts, z0), (pts, z1)], coll, matrix)


def ring_prism(name, outer, inner, z0, z1, coll):
    bm = bmesh.new()
    ob0 = [bm.verts.new((x, y, z0)) for x, y in outer]
    ob1 = [bm.verts.new((x, y, z1)) for x, y in outer]
    ib0 = [bm.verts.new((x, y, z0)) for x, y in inner]
    ib1 = [bm.verts.new((x, y, z1)) for x, y in inner]
    n = len(outer)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((ob0[i], ob0[j], ob1[j], ob1[i]))
        bm.faces.new((ib0[i], ib0[j], ib1[j], ib1[i]))
        bm.faces.new((ob1[i], ob1[j], ib1[j], ib1[i]))
        bm.faces.new((ob0[i], ob0[j], ib0[j], ib0[i]))
    return _finish(name, bm, coll)


def pill_solid(name, length, width, height, fillet, coll, matrix=None, seg=6):
    r = min(width, length) * 0.5
    rings = []
    for i in range(seg + 1):
        a = math.radians(90.0 * i / seg)
        rings.append((rounded_rect(length, width, r, inset=fillet * (1 - math.sin(a))),
                      fillet * (1 - math.cos(a))))
    for i in range(seg + 1):
        a = math.radians(90.0 * i / seg)
        rings.append((rounded_rect(length, width, r, inset=fillet * (1 - math.cos(a))),
                      height - fillet + fillet * math.sin(a)))
    return loft(name, rings, coll, matrix)


def boolean(target, cutter, op='DIFFERENCE'):
    mod = target.modifiers.new(name="bool_" + cutter.name, type='BOOLEAN')
    mod.operation = op
    mod.object = cutter
    mod.solver = 'EXACT'
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.modifier_apply(modifier=mod.name)
    bpy.data.objects.remove(cutter, do_unlink=True)


def add_cut_fillet(ob):
    b = ob.modifiers.new(name="Edge Fillet", type='BEVEL')
    b.width = CUT_FILLET
    b.segments = CUT_FILLET_SEG
    b.limit_method = 'ANGLE'
    b.angle_limit = math.radians(35.0)
    b.miter_outer = 'MITER_SHARP'  # 'MITER_ARC' flings stray vertices off the base's vent pocket


def smooth(ob, angle=50.0):
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    try:
        bpy.ops.object.shade_auto_smooth(angle=math.radians(angle))
    except Exception:
        bpy.ops.object.shade_smooth()
    ob.select_set(False)


def assign(ob, mat):
    ob.data.materials.clear()
    ob.data.materials.append(mat)


def smoothstep(t):
    return t * t * (3.0 - 2.0 * t)


# =============================================================================
#  5. SCENE PREP
# =============================================================================
scene = bpy.context.scene
if CLEAR_SCENE:
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in (bpy.data.meshes, bpy.data.materials, bpy.data.lights, bpy.data.cameras):
        for item in list(block):
            if item.users == 0:
                block.remove(item)

scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 0.001
scene.unit_settings.length_unit = 'MILLIMETERS'
scene.render.engine = 'CYCLES'
scene.cycles.samples = RENDER_SAMPLES


def make_collection(name, parent=None):
    c = bpy.data.collections.new(name)
    (parent or scene.collection).children.link(c)
    return c


COL_ROOT   = make_collection("Sureva")
COL_SHELL  = make_collection("Shells", COL_ROOT)
COL_PCB    = make_collection("PCB Assembly", COL_ROOT)
COL_STUDIO = make_collection("Studio", COL_ROOT)
COL_TMP    = make_collection("_cutters", COL_ROOT)


# =============================================================================
#  6. MATERIALS
# =============================================================================
def make_material(name, base, roughness=0.5, metallic=0.0, alpha=1.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = mat.node_tree.nodes.get("Principled BSDF")
    def put(k, v):
        if k in b.inputs:
            b.inputs[k].default_value = v
    put("Base Color", base); put("Roughness", roughness)
    put("Metallic", metallic); put("Alpha", alpha)
    mat.diffuse_color = base
    return mat


MAT_BONE   = make_material("Bone Matte Polymer", BONE, roughness=0.70)
if FINISH == 'aluminium':
    MAT_TERRA = make_material("Bead-blasted Aluminium", ALUMINIUM, roughness=ALU_ROUGH, metallic=1.0)
else:
    MAT_TERRA = make_material("Terracotta Anodised", TERRACOTTA, roughness=0.48, metallic=0.70)
MAT_PAD    = make_material("Charging Pad Polymer", PAD_WHITE, roughness=0.62)
MAT_RUBBER = make_material("Pad Rubber", (0.035, 0.034, 0.033, 1.0), roughness=0.85)
MAT_FERRITE = make_material("Ferrite Sheet", (0.03, 0.03, 0.032, 1.0), roughness=0.6)
MAT_PCB    = make_material("PCB Navy Soldermask", NAVY, roughness=0.55)
MAT_IC     = make_material("IC Epoxy", (0.020, 0.020, 0.022, 1.0), roughness=0.40)
MAT_SILK   = make_material("Silkscreen", (0.90, 0.90, 0.88, 1.0), roughness=0.60)
MAT_COPPER = make_material("Copper", (0.95, 0.60, 0.35, 1.0), roughness=0.30, metallic=1.0)
MAT_SHIELD = make_material("RF Shield Tin", (0.72, 0.73, 0.74, 1.0), roughness=0.36, metallic=0.95)
MAT_POUCH  = make_material("LiPo Pouch", (0.14, 0.15, 0.17, 1.0), roughness=0.45, metallic=0.35)
MAT_SENSOR = make_material("Sensor Ceramic", (0.80, 0.78, 0.74, 1.0), roughness=0.45)


def make_glass(name, tint, rough, ior, emission=None, strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    b = mat.node_tree.nodes.get("Principled BSDF")
    def put(k, v):
        if k in b.inputs:
            b.inputs[k].default_value = v
    put("Base Color", tint); put("Roughness", rough); put("IOR", ior); put("Metallic", 0.0)
    for k in ("Transmission", "Transmission Weight"):
        put(k, 1.0)
    for k in ("Specular", "Specular IOR Level"):
        put(k, 0.6)
    if emission is not None:
        for k in ("Emission Color", "Emission"):
            if k in b.inputs:
                b.inputs[k].default_value = emission
                break
        put("Emission Strength", strength)
    mat.diffuse_color = (tint[0], tint[1], tint[2], 0.5)
    return mat


MAT_SMOKED = make_glass("UV Window Smoked Glass", (0.16, 0.17, 0.19, 1.0), 0.05, 1.46)
MAT_UVLENS = make_glass("Sensor Lens", (0.95, 0.96, 0.98, 1.0), 0.03, 1.5)
MAT_LEDPIPE = make_glass("LED Light Pipe", (0.75, 0.62, 0.48, 1.0), 0.55, 1.45,
                         emission=AMBER, strength=2.2)
MAT_LEDCHIP = make_glass("LED Package", AMBER, 0.35, 1.5, emission=AMBER, strength=3.0)


def make_backdrop_material():
    mat = bpy.data.materials.new("Studio Sweep")
    mat.use_nodes = True
    nt = mat.node_tree
    b = nt.nodes.get("Principled BSDF")
    b.inputs["Roughness"].default_value = BACKDROP_ROUGH
    coord = nt.nodes.new("ShaderNodeTexCoord")
    mapping = nt.nodes.new("ShaderNodeMapping")
    s = 1.0 / BACKDROP_POOL_R
    mapping.inputs["Scale"].default_value = (s, s, s)
    grad = nt.nodes.new("ShaderNodeTexGradient"); grad.gradient_type = 'SPHERICAL'
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    ramp.color_ramp.interpolation = 'B_SPLINE'
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = BG_EDGE
    ramp.color_ramp.elements[1].position = 0.9
    ramp.color_ramp.elements[1].color = BG_CENTRE
    L = nt.links.new
    L(coord.outputs["Object"], mapping.inputs["Vector"])
    L(mapping.outputs["Vector"], grad.inputs["Vector"])
    L(grad.outputs["Fac"], ramp.inputs["Fac"])
    L(ramp.outputs["Color"], b.inputs["Base Color"])
    mat.diffuse_color = BG_CENTRE
    return mat


MAT_BACKDROP = make_backdrop_material()


def setup_world():
    world = bpy.data.worlds.get("Studio World") or bpy.data.worlds.new("Studio World")
    scene.world = world
    world.use_nodes = True
    nt = world.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputWorld")
    bg = nt.nodes.new("ShaderNodeBackground")
    bg.inputs["Color"].default_value = WORLD_COLOR
    bg.inputs["Strength"].default_value = WORLD_STRENGTH
    if not REFLECT_STUDIO:
        nt.links.new(bg.outputs["Background"], out.inputs["Surface"])
        return
    # what glossy rays see instead: a softbox overhead, a dark band at the horizon and a low
    # strip light under it. Metal only reads as metal with something dark to reflect.
    L = nt.links.new
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep = nt.nodes.new("ShaderNodeSeparateXYZ")
    ramp = nt.nodes.new("ShaderNodeValToRGB")
    els = ramp.color_ramp.elements
    # position = (z + 1) / 2 of the reflected ray. A vertical wall seen from ~20° above
    # reflects ~0.33: a low strip light there makes the side walls read as bright satin.
    els[0].position = 0.0;  els[0].color = (0.22, 0.22, 0.22, 1.0)     # under the device
    els[1].position = 0.30; els[1].color = (0.80, 0.79, 0.77, 1.0)     # low strip light
    for pos, c in ((0.46, (0.20, 0.20, 0.20, 1.0)),                     # dark horizon band
                   (0.54, (0.14, 0.14, 0.14, 1.0)),
                   (0.68, (0.60, 0.59, 0.57, 1.0)),
                   (0.86, (1.60, 1.58, 1.54, 1.0))):                    # overhead softbox
        e = els.new(pos); e.color = c
    remap = nt.nodes.new("ShaderNodeMapRange")
    remap.inputs[1].default_value = -1.0; remap.inputs[2].default_value = 1.0
    refl = nt.nodes.new("ShaderNodeBackground")
    refl.inputs["Strength"].default_value = WORLD_STRENGTH
    path = nt.nodes.new("ShaderNodeLightPath")
    mix = nt.nodes.new("ShaderNodeMixShader")
    L(coord.outputs["Generated"], sep.inputs["Vector"])   # on the world: the ray direction
    L(sep.outputs["Z"], remap.inputs[0]); L(remap.outputs["Result"], ramp.inputs["Fac"])
    L(ramp.outputs["Color"], refl.inputs["Color"])
    L(path.outputs["Is Glossy Ray"], mix.inputs["Fac"])
    L(bg.outputs["Background"], mix.inputs[1]); L(refl.outputs["Background"], mix.inputs[2])
    L(mix.outputs["Shader"], out.inputs["Surface"])


# =============================================================================
#  7. TOP SHELL — bone, pillowed; UV window, touch dish, LED dot in one row
# =============================================================================
def build_top_shell():
    wall_top = SEAM_Z + TOP_H - TOP_RIM_FILLET - DOME_RISE
    rings = [(rounded_rect(DEV_LENGTH, DEV_WIDTH, CORNER_R), SEAM_Z),
             (rounded_rect(DEV_LENGTH, DEV_WIDTH, CORNER_R), wall_top)]
    for i in range(1, BASE_SEG + 1):
        a = math.radians(90.0 * i / BASE_SEG)
        rings.append((rounded_rect(DEV_LENGTH, DEV_WIDTH, CORNER_R,
                                   inset=TOP_RIM_FILLET * (1.0 - math.cos(a))),
                      wall_top + TOP_RIM_FILLET * math.sin(a)))
    roll_top = wall_top + TOP_RIM_FILLET
    for i in range(1, DOME_SEG + 1):
        s = i / DOME_SEG
        rings.append((rounded_rect(DEV_LENGTH, DEV_WIDTH, CORNER_R,
                                   inset=TOP_RIM_FILLET + DOME_SPAN * s),
                      roll_top + DOME_RISE * smoothstep(s)))
    shell = loft("Top_Shell", rings, COL_SHELL)
    crown_z = SEAM_Z + TOP_H

    # hollow
    boolean(shell, prism("cut_top_cavity",
                         rounded_rect(DEV_LENGTH, DEV_WIDTH, CORNER_R, inset=TOP_WALL_THK),
                         SEAM_Z - 1.0, INNER_CEILING_Z, COL_TMP))
    # UV window: rounded-rectangle through hole + underside counterbore
    boolean(shell, prism("cut_uv", rounded_rect(UV_W, UV_H, UV_R, seg=12), SEAM_Z - 1, DEV_HEIGHT + 1,
                         COL_TMP, matrix=Matrix.Translation((UV_X, 0, 0))))
    boolean(shell, prism("cut_uv_lip", rounded_rect(UV_W + 2 * UV_LIP, UV_H + 2 * UV_LIP, UV_R + UV_LIP, seg=12),
                         INNER_CEILING_Z - 0.5, INNER_CEILING_Z + UV_LIP_DEPTH, COL_TMP,
                         matrix=Matrix.Translation((UV_X, 0, 0))))
    # button pocket in the middle of the crown; the cap sits in it with a clearance ring
    boolean(shell, prism("cut_button", circle_pts(BTN_DIA + 2 * BTN_GAP), crown_z - BTN_POCKET,
                         crown_z + 2.0, COL_TMP))
    # LED blind pocket
    boolean(shell, prism("cut_led", circle_pts(LED_DIA), crown_z - LED_POCKET_DEPTH,
                         crown_z + 2.0, COL_TMP, matrix=Matrix.Translation((LED_X, 0, 0))))

    add_cut_fillet(shell)
    smooth(shell)
    assign(shell, MAT_BONE)
    return shell


def build_window():
    crown_z = SEAM_Z + TOP_H
    seat_z = INNER_CEILING_Z - UV_LIP_DEPTH
    rr = lambda inset: rounded_rect(UV_W + 2 * UV_LIP, UV_H + 2 * UV_LIP, UV_R + UV_LIP, seg=12, inset=inset)
    rw = lambda inset: rounded_rect(UV_W, UV_H, UV_R, seg=12, inset=inset)
    rings = [(rr(0.05), seat_z),
             (rr(0.05), INNER_CEILING_Z),
             (rw(0.03), INNER_CEILING_Z),
             (rw(0.03), crown_z - 0.02),
             (rw(0.2), crown_z + 0.03)]
    ob = loft("UV_Window", rings, COL_SHELL, matrix=Matrix.Translation((UV_X, 0, 0)))
    assign(ob, MAT_SMOKED); smooth(ob, 40.0)
    return ob


def build_button():
    """Round cap in the crown's pocket, in the base's finish, with an eased edge and a
    faint finger dish."""
    crown_z = SEAM_Z + TOP_H
    top = crown_z + BTN_PROUD
    r = BTN_DIA * 0.5
    edge = 0.28
    rings = [(circle_pts(BTN_DIA, 96), crown_z - BTN_POCKET + 0.03)]
    for i in range(1, 9):
        a = math.radians(90.0 * i / 8)
        rings.append((circle_pts(BTN_DIA - 2 * edge * (1 - math.cos(a)), 96), top - edge + edge * math.sin(a)))
    for i in range(1, 7):
        s = i / 6
        rings.append((circle_pts((r - edge) * 2 * (1 - s) + 0.01, 96), top - BTN_DISH * smoothstep(s)))
    ob = loft("Button_Cap", rings, COL_SHELL)
    assign(ob, MAT_TERRA); smooth(ob, 60.0)
    return ob


def build_led_pipe():
    crown_z = SEAM_Z + TOP_H
    d = LED_DIA - 0.04
    rings = [(circle_pts(d, 64), crown_z - LED_POCKET_DEPTH + 0.02),
             (circle_pts(d, 64), crown_z - 0.02),
             (circle_pts(d - 0.3, 64), crown_z + LED_PROUD)]
    ob = loft("LED_Light_Pipe", rings, COL_SHELL, matrix=Matrix.Translation((LED_X, 0, 0)))
    assign(ob, MAT_LEDPIPE); smooth(ob, 40.0)
    return ob


# =============================================================================
#  8. BOTTOM SHELL — terracotta; cavity, gasket, seam groove w/ hidden vent,
#     coil pad, etched wordmark
# =============================================================================
def build_bottom_shell():
    rings = []
    for i in range(BASE_SEG + 1):
        a = math.radians(90.0 * i / BASE_SEG)
        rings.append((rounded_rect(DEV_LENGTH, DEV_WIDTH, CORNER_R,
                                   inset=BOT_BASE_FILLET * (1.0 - math.sin(a))),
                      BOT_BASE_FILLET * (1.0 - math.cos(a))))
    # the parting-line groove is part of the profile: the wall steps in just under the seam.
    # (Cut in with a boolean it left sliver triangles that streak on the metal.)
    g_z = SEAM_Z - GROOVE_HEIGHT
    rings.append((rounded_rect(DEV_LENGTH, DEV_WIDTH, CORNER_R), g_z - 0.35))
    rings.append((rounded_rect(DEV_LENGTH, DEV_WIDTH, CORNER_R), g_z))
    rings.append((rounded_rect(DEV_LENGTH, DEV_WIDTH, CORNER_R, inset=GROOVE_DEPTH), g_z))
    rings.append((rounded_rect(DEV_LENGTH, DEV_WIDTH, CORNER_R, inset=GROOVE_DEPTH), SEAM_Z))
    shell = loft("Bottom_Shell", rings, COL_SHELL)

    boolean(shell, prism("cut_cavity", rounded_rect(CAV_LENGTH, CAV_WIDTH, CAV_CORNER_R),
                         CAV_FLOOR_Z, SEAM_Z + 1.0, COL_TMP))
    boolean(shell, ring_prism("cut_gasket",
                              rounded_rect(DEV_LENGTH, DEV_WIDTH, CORNER_R, inset=GASKET_INBOARD),
                              rounded_rect(DEV_LENGTH, DEV_WIDTH, CORNER_R,
                                           inset=GASKET_INBOARD + GASKET_WIDTH),
                              SEAM_Z - GASKET_DEPTH, SEAM_Z + 1.0, COL_TMP))
    # vent slot hidden in the groove, through the -Y wall, plus membrane pocket inside
    rot = Matrix.Rotation(math.pi * 0.5, 4, 'X')          # extrude along -Y
    vz = SEAM_Z - GROOVE_HEIGHT * 0.5
    y_out = VENT_SIDE * (DEV_WIDTH * 0.5 + 2.0)
    slot = rounded_rect(VENT_LENGTH, VENT_HEIGHT, VENT_HEIGHT * 0.5, seg=8)
    if VENT_SIDE < 0:
        boolean(shell, prism("cut_vent", slot, 0.0, 6.0, COL_TMP,
                             matrix=Matrix.Translation((VENT_X, -y_out, vz)) @ rot))
        y_in = -(CAV_WIDTH * 0.5)
        rec = rounded_rect(VENT_LENGTH + 2 * VENT_RECESS_PAD, VENT_HEIGHT + 2 * VENT_RECESS_PAD,
                           (VENT_HEIGHT + 2 * VENT_RECESS_PAD) * 0.5, seg=8)
        boolean(shell, prism("cut_vent_recess", rec, 0.0, VENT_RECESS, COL_TMP,
                             matrix=Matrix.Translation((VENT_X, y_in, vz)) @ rot))
    # charging pad
    boolean(shell, prism("cut_coil_pad", circle_pts(COIL_PAD_DIA), -1.0, COIL_PAD_DEPTH, COL_TMP))

    add_cut_fillet(shell)
    smooth(shell)
    assign(shell, MAT_TERRA)
    return shell


# --- wordmark ---------------------------------------------------------------
def find_logo():
    if LOGO_PATH:
        p = bpy.path.abspath(LOGO_PATH)
        return p if os.path.isfile(p) else ""
    home = os.path.expanduser("~")
    for root in (os.path.dirname(bpy.data.filepath) if bpy.data.filepath else "",
                 os.path.join(home, "Downloads"), os.path.join(home, "Desktop"), home, os.getcwd()):
        if root and os.path.isfile(os.path.join(root, LOGO_FILENAME)):
            return os.path.join(root, LOGO_FILENAME)
    return ""


def engrave_logo_image(mat, path):
    try:
        img = bpy.data.images.load(path, check_existing=True)
    except Exception as exc:
        print("logo: could not load %r (%s)" % (path, exc)); return False
    nt = mat.node_tree
    b = nt.nodes.get("Principled BSDF")
    coord = nt.nodes.new("ShaderNodeTexCoord")
    sep_p = nt.nodes.new("ShaderNodeSeparateXYZ")
    mir = 1.0 if LOGO_FACE_Y < 0 else -1.0
    u = nt.nodes.new("ShaderNodeMapRange"); u.clamp = False
    u.inputs[1].default_value = LOGO_X - mir * LOGO_WIDTH * 0.5
    u.inputs[2].default_value = LOGO_X + mir * LOGO_WIDTH * 0.5
    v = nt.nodes.new("ShaderNodeMapRange"); v.clamp = False
    v.inputs[1].default_value = LOGO_Z - LOGO_HEIGHT * 0.5
    v.inputs[2].default_value = LOGO_Z + LOGO_HEIGHT * 0.5
    comb = nt.nodes.new("ShaderNodeCombineXYZ")
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.image = img; tex.extension = 'CLIP'; tex.interpolation = 'Cubic'
    # only the outer wall on the logo side: the X/Z projection would otherwise print through
    # onto the facing cavity wall as well
    mask = nt.nodes.new("ShaderNodeMath")
    mask.operation = 'LESS_THAN' if LOGO_FACE_Y < 0 else 'GREATER_THAN'
    mask.inputs[1].default_value = LOGO_FACE_Y * (DEV_WIDTH * 0.5 - 0.8)
    ink = nt.nodes.new("ShaderNodeMath"); ink.operation = 'MULTIPLY'
    height = nt.nodes.new("ShaderNodeMath"); height.operation = 'SUBTRACT'
    height.inputs[0].default_value = 1.0
    bump = nt.nodes.new("ShaderNodeBump")
    bump.inputs["Distance"].default_value = LOGO_ETCH_DEPTH
    rough = nt.nodes.new("ShaderNodeMixRGB")
    base_rough = b.inputs["Roughness"].default_value
    rough.inputs[1].default_value = (base_rough,) * 3 + (1.0,)
    rough.inputs[2].default_value = (LOGO_ETCH_ROUGH,) * 3 + (1.0,)
    # laser-etched aluminium goes matte and pale; anodised colour goes darker
    tint = nt.nodes.new("ShaderNodeMixRGB")
    base_col = tuple(b.inputs["Base Color"].default_value)
    tint.inputs[1].default_value = base_col
    tint.inputs[2].default_value = tuple(min(1.0, c * LOGO_ETCH_TINT) for c in base_col[:3]) + (1.0,)
    metal = nt.nodes.new("ShaderNodeMapRange")
    metal.inputs[3].default_value = b.inputs["Metallic"].default_value
    metal.inputs[4].default_value = LOGO_ETCH_METAL
    L = nt.links.new
    L(coord.outputs["Object"], sep_p.inputs["Vector"])
    L(sep_p.outputs["X"], u.inputs[0]); L(sep_p.outputs["Z"], v.inputs[0])
    L(u.outputs["Result"], comb.inputs["X"]); L(v.outputs["Result"], comb.inputs["Y"])
    L(comb.outputs["Vector"], tex.inputs["Vector"])
    L(sep_p.outputs["Y"], mask.inputs[0])
    L(tex.outputs["Alpha"], ink.inputs[0]); L(mask.outputs["Value"], ink.inputs[1])
    L(ink.outputs["Value"], height.inputs[1]); L(height.outputs["Value"], bump.inputs["Height"])
    L(bump.outputs["Normal"], b.inputs["Normal"])
    L(ink.outputs["Value"], rough.inputs["Fac"]); L(rough.outputs["Color"], b.inputs["Roughness"])
    L(ink.outputs["Value"], tint.inputs["Fac"]); L(tint.outputs["Color"], b.inputs["Base Color"])
    L(ink.outputs["Value"], metal.inputs[0]); L(metal.outputs["Result"], b.inputs["Metallic"])
    print("logo: etched %s" % path)
    return True


def engrave_logo_text(shell):
    bpy.ops.object.text_add(location=(LOGO_X, LOGO_FACE_Y * DEV_WIDTH * 0.5, LOGO_Z))
    txt = bpy.context.object
    txt.data.body = LOGO_TEXT; txt.data.size = LOGO_SIZE
    txt.data.align_x = 'CENTER'; txt.data.align_y = 'CENTER'; txt.data.extrude = 1.0
    txt.rotation_euler = (math.pi * 0.5, 0.0, 0.0 if LOGO_FACE_Y < 0 else math.pi)
    bpy.ops.object.convert(target='MESH')
    cutter = bpy.context.object
    for c in cutter.users_collection:
        c.objects.unlink(cutter)
    COL_TMP.objects.link(cutter)
    boolean(shell, cutter)


def build_logo(shell):
    if LOGO_MODE == 'none':
        return
    if LOGO_MODE == 'image':
        p = find_logo()
        if p and engrave_logo_image(MAT_TERRA, p):
            return
        print("logo: artwork not found — carving text fallback")
    engrave_logo_text(shell)


# =============================================================================
#  9. PCB ASSEMBLY — navy board, copper traces, vias, silkscreen, components
#     under their apertures; pouch cell beneath the board
# =============================================================================
def build_pcb():
    objs = []

    def part(ob, mat, ang=60.0):
        assign(ob, mat); smooth(ob, ang); objs.append(ob); return ob

    def box(name, size, x, y, z0, mat, r=0.08):
        return part(prism(name, rounded_rect(size[0], size[1], r, seg=3), z0, z0 + size[2],
                          COL_PCB, matrix=Matrix.Translation((x, y, 0))), mat)

    def cyl(name, dia, h, x, y, z0, mat, seg=48):
        return part(prism(name, circle_pts(dia, seg), z0, z0 + h, COL_PCB,
                          matrix=Matrix.Translation((x, y, 0))), mat)

    def silk(name, size, x, y, pad=0.18):
        o = rounded_rect(size[0] + 2 * pad, size[1] + 2 * pad, 0.15, seg=3)
        i = rounded_rect(size[0] + 2 * pad - 2 * SILK_W, size[1] + 2 * pad - 2 * SILK_W, 0.1, seg=3)
        ob = ring_prism(name, o, i, PCB_TOP, PCB_TOP + SILK_H, COL_PCB)
        ob.location = (x, y, 0)
        return part(ob, MAT_SILK)

    def trace(name, pts):
        """Polyline of copper segments with a via at each end."""
        for k, (a, b) in enumerate(zip(pts, pts[1:])):
            ax, ay = a; bx, by = b
            L = math.hypot(bx - ax, by - ay)
            if L < 1e-4:
                continue
            ang = math.atan2(by - ay, bx - ax)
            m = (Matrix.Translation(((ax + bx) / 2, (ay + by) / 2, 0)) @
                 Matrix.Rotation(ang, 4, 'Z'))
            part(prism("%s_%d" % (name, k), rounded_rect(L + TRACE_W, TRACE_W, TRACE_W * 0.5, seg=4),
                       PCB_TOP, PCB_TOP + TRACE_H, COL_PCB, matrix=m), MAT_COPPER)
        for k, (x, y) in enumerate((pts[0], pts[-1])):
            cyl("%s_via%d" % (name, k), VIA_DIA, TRACE_H + 0.01, x, y, PCB_TOP, MAT_COPPER, 24)

    # board + battery
    part(prism("PCB_Board", rounded_rect(PCB_SIZE[0], PCB_SIZE[1], PCB_SIZE[1] * 0.5, seg=32),
               PCB_Z, PCB_TOP, COL_PCB), MAT_PCB)
    part(pill_solid("Battery_Pouch", BATT_SIZE[0], BATT_SIZE[1], BATT_SIZE[2], 0.35, COL_PCB,
                    matrix=Matrix.Translation((0, 0, BATT_Z))), MAT_POUCH)
    for dy in (-1.0, 1.0):
        box("Battery_Tab", (0.8, 0.5, 0.1), -BATT_SIZE[0] * 0.5 - 0.4, dy, BATT_Z + BATT_SIZE[2] - 0.1,
            MAT_COPPER)

    # UV sensor with clear lens, under the window
    box("UV_Sensor", UV_CHIP, UV_X, 0.0, PCB_TOP, MAT_IC)
    cyl("UV_Sensor_Lens", UV_LENS_DIA, 0.08, UV_X, 0.0, PCB_TOP + UV_CHIP[2], MAT_UVLENS)
    silk("Silk_UV", UV_CHIP, UV_X, 0.0)
    # amber LED under the light pipe
    box("LED_Package", LED_PKG, LED_X, 0.0, PCB_TOP, MAT_LEDCHIP)
    silk("Silk_LED", LED_PKG, LED_X, 0.0)
    # tactile switch under the button: metal dome in a square frame
    box("Button_Switch", (3.0, 3.0, 0.45), 0.0, 0.0, PCB_TOP, MAT_SHIELD, r=0.2)
    cyl("Button_Dome", 1.8, 0.12, 0.0, 0.0, PCB_TOP + 0.45, MAT_IC)
    # RF shield can over MCU + BLE
    box("RF_Shield_Can", SHIELD_CAN, SHIELD_POS[0], SHIELD_POS[1], PCB_TOP, MAT_SHIELD, r=0.2)
    silk("Silk_Shield", SHIELD_CAN, SHIELD_POS[0], SHIELD_POS[1], pad=0.22)
    # temp / humidity sensor by the -Y edge (vent side), IMU opposite
    box("TempHum_Sensor", TH_SENSOR, TH_POS[0], TH_POS[1], PCB_TOP, MAT_SENSOR)
    cyl("TempHum_Port", 0.6, 0.04, TH_POS[0], TH_POS[1], PCB_TOP + TH_SENSOR[2], MAT_IC, 24)
    silk("Silk_TH", TH_SENSOR, TH_POS[0], TH_POS[1])
    box("IMU", IMU, IMU_POS[0], IMU_POS[1], PCB_TOP, MAT_IC)
    silk("Silk_IMU", IMU, IMU_POS[0], IMU_POS[1])

    # traces: every part routes back to the shield can
    sx, sy = SHIELD_POS
    trace("Trace_UV", [(UV_X - 1.1, 0.5), (sx + 2.3, 0.5)])
    trace("Trace_UV2", [(UV_X - 1.1, -0.5), (sx + 2.3, -0.5)])
    trace("Trace_Touch", [(0.0, -1.9), (0.0, -2.9), (sx - 1.6, -2.9), (sx - 1.6, -1.7)])
    trace("Trace_LED", [(LED_X + 0.9, 0.3), (-5.6, 0.3), (-5.6, 1.2), (IMU_POS[0] - 1.1, 1.2)])
    trace("Trace_TH", [(TH_POS[0] + 1.0, TH_POS[1]), (0.9, TH_POS[1]), (0.9, -2.1), (sx - 2.3, -2.1)])
    trace("Trace_IMU", [(IMU_POS[0] + 1.1, IMU_POS[1]), (sx - 2.3, IMU_POS[1]), (sx - 2.3, 1.7)])
    trace("Trace_Batt", [(-6.6, -1.0), (-2.2, -1.0), (-2.2, -2.5), (sx - 2.3, -2.5)])

    # passives, deterministic scatter in the open board areas
    rnd = random.Random(11)
    keep_out = [(UV_X, 0, 1.5), (LED_X, 0, 1.3), (0, 0, 2.1), (sx, sy, 2.6),
                (TH_POS[0], TH_POS[1], 1.4), (IMU_POS[0], IMU_POS[1], 1.5)]
    placed, tries = 0, 0
    while placed < N_PASSIVES and tries < 300:
        tries += 1
        x, y = rnd.uniform(-8.5, 8.5), rnd.uniform(-3.4, 3.4)
        hx = PCB_SIZE[0] * 0.5 - PCB_SIZE[1] * 0.5
        dx = max(0.0, abs(x) - hx)
        if dx * dx + y * y > (PCB_SIZE[1] * 0.5 - 0.6) ** 2:
            continue
        if any(abs(x - ox) < r and abs(y - oy) < r for ox, oy, r in keep_out):
            continue
        keep_out.append((x, y, 0.7))
        long = rnd.random() < 0.5
        box("Passive_%02d" % placed, (1.0 if long else 0.5, 0.5 if long else 1.0, 0.3), x, y,
            PCB_TOP, MAT_IC if rnd.random() < 0.7 else MAT_SENSOR, r=0.04)
        placed += 1
    return objs


def build_coil():
    """Wireless-charging receiver: a flat copper spiral on a ferrite sheet, lying on the
    cavity floor under the battery."""
    fz = CAV_FLOOR_Z + 0.02
    fer = prism("Ferrite_Sheet", circle_pts(FERRITE_DIA, 96), fz, fz + FERRITE_THK, COL_PCB)
    assign(fer, MAT_FERRITE)
    smooth(fer)
    cz = fz + FERRITE_THK + COIL_WIRE
    curve = bpy.data.curves.new("Coil_Spiral", 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = COIL_WIRE
    curve.bevel_resolution = 3
    spline = curve.splines.new('POLY')
    n = COIL_TURNS * 72
    spline.points.add(n)
    for i in range(n + 1):
        t = i / n
        a = t * COIL_TURNS * 2.0 * math.pi
        r = COIL_R0 + (COIL_R1 - COIL_R0) * t
        spline.points[i].co = (r * math.cos(a), r * math.sin(a), cz, 1.0)
    spline.use_smooth = True
    coil = bpy.data.objects.new("Coil_Spiral", curve)
    COL_PCB.objects.link(coil)
    assign(coil, MAT_COPPER)
    return [fer, coil]


def build_charger():
    """The wireless charging pad: a soft pill with a shallow nest the device drops into,
    and a cable leaving from the back. Built on demand (it is not part of the device)."""
    pad = pill_solid("Charger_Pad", PAD_L, PAD_W, PAD_H, PAD_FILLET, COL_STUDIO)
    boolean(pad, prism("cut_nest",
                       rounded_rect(DEV_LENGTH + 2 * PAD_CLEAR, DEV_WIDTH + 2 * PAD_CLEAR, CORNER_R + PAD_CLEAR),
                       PAD_H - PAD_RECESS, PAD_H + 1.0, COL_STUDIO))
    add_cut_fillet(pad)
    smooth(pad)
    assign(pad, MAT_PAD)
    foot = prism("Charger_Foot", rounded_rect(PAD_L - 5, PAD_W - 5, (PAD_W - 5) * 0.5, seg=24), 0.0, 0.25, COL_STUDIO)
    assign(foot, MAT_RUBBER)
    pad.location.z = 0.2
    curve = bpy.data.curves.new("Charger_Cable", 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 1.05
    curve.bevel_resolution = 4
    spline = curve.splines.new('BEZIER')
    pts = [(PAD_L * 0.18, PAD_W * 0.5 - 1.0, 1.5), (PAD_L * 0.2, PAD_W * 0.5 + 14, 1.05),
           (PAD_L * 0.55, PAD_W * 0.5 + 34, 1.05), (PAD_L * 1.2, PAD_W * 0.5 + 52, 1.05)]
    spline.bezier_points.add(len(pts) - 1)
    for bp, co in zip(spline.bezier_points, pts):
        bp.co = co
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cable = bpy.data.objects.new("Charger_Cable", curve)
    COL_STUDIO.objects.link(cable)
    assign(cable, MAT_PAD)
    return [pad, foot, cable], PAD_H + 0.2 - PAD_RECESS


# =============================================================================
#  10. STUDIO — soft diffused rig on a seamless warm sweep
# =============================================================================
def build_cyclorama():
    prof = [(CYC_FLOOR_FRONT, 0.0)]
    for i in range(CYC_ARC_SEG + 1):
        a = math.radians(90.0 * i / CYC_ARC_SEG)
        prof.append((CYC_ARC_START_Y + CYC_ARC_RADIUS * math.sin(a),
                     CYC_ARC_RADIUS * (1.0 - math.cos(a))))
    prof.append((CYC_ARC_START_Y + CYC_ARC_RADIUS, CYC_WALL_TOP))
    bm = bmesh.new()
    cols = [[bm.verts.new((x, y, z)) for y, z in prof] for x in (-CYC_HALF_WIDTH, CYC_HALF_WIDTH)]
    for i in range(len(prof) - 1):
        bm.faces.new((cols[0][i], cols[0][i + 1], cols[1][i + 1], cols[1][i]))
    ob = _finish("Studio_Sweep", bm, COL_STUDIO)
    assign(ob, MAT_BACKDROP); smooth(ob, 60.0)


def build_studio():
    setup_world()
    build_cyclorama()
    target = bpy.data.objects.new("Aim_Target", None)
    target.location = AIM
    COL_STUDIO.objects.link(target)

    def light(name, intensity, size, loc):
        d = (Vector(loc) - Vector(AIM)).length
        data = bpy.data.lights.new(name, type='AREA')
        data.energy = intensity * 4.0 * math.pi * d * d
        data.shape = 'DISK'
        data.size = size
        ob = bpy.data.objects.new(name, data)
        ob.location = loc
        ob.visible_camera = False
        COL_STUDIO.objects.link(ob)
        ob.constraints.new('TRACK_TO').target = target

    # all sources oversized relative to the subject -> no hard highlights
    light("Key_Soft",  KEY_INTENSITY,  360.0, (120.0, -150.0, 190.0))
    light("Fill_Soft", FILL_INTENSITY, 420.0, (-190.0, -140.0, 120.0))
    light("Top_Soft",  TOP_INTENSITY,  460.0, (0.0, -20.0, 300.0))
    light("Back_Soft", BACK_INTENSITY, 300.0, (0.0, 170.0, 140.0))

    cam_data = bpy.data.cameras.new("Product_Camera")
    cam_data.lens = CAM_LENS
    cam_data.clip_start = 1.0; cam_data.clip_end = 10000.0
    cam = bpy.data.objects.new("Product_Camera", cam_data)
    cam.location = CAM_LOC
    COL_STUDIO.objects.link(cam)
    cam.constraints.new('TRACK_TO').target = target
    scene.camera = cam

    scene.render.resolution_x, scene.render.resolution_y = RENDER_RES
    scene.render.resolution_percentage = RENDER_PERCENT
    scene.render.filter_size = 1.5
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_depth = '16'
    try:
        scene.cycles.use_denoising = True
        scene.cycles.denoiser = 'OPENIMAGEDENOISE'
        scene.cycles.use_adaptive_sampling = True
        scene.cycles.adaptive_threshold = 0.005
        scene.cycles.max_bounces = 16
        scene.cycles.transmission_bounces = 24
        scene.cycles.transparent_max_bounces = 24
        scene.cycles.blur_glossy = 0.6
    except Exception:
        pass
    for t in ('AgX', 'Filmic', 'Standard'):
        try:
            scene.view_settings.view_transform = t; break
        except Exception:
            continue
    scene.view_settings.look = 'None'


# =============================================================================
#  11. BUILD
# =============================================================================
top = build_top_shell()
window = build_window()
led_pipe = build_led_pipe()
button = build_button()
bottom = build_bottom_shell()
build_logo(bottom)
pcb = build_pcb() if SHOW_PCB else []
coil = build_coil() if SHOW_PCB else []
build_studio()

# exploded: bottom shell stays, PCB layer lifts one gap, top shell two
if EXPLODE > 0.0:
    for ob in (top, window, led_pipe, button):
        ob.location.z += EXPLODE * 2.0
    for ob in pcb:
        ob.location.z += EXPLODE

bpy.data.collections.remove(COL_TMP)
bpy.ops.object.select_all(action='DESELECT')
bpy.context.view_layer.objects.active = top
print("Sureva enclosure built — view: %s. Press F12 to render." % RENDER_VIEW)

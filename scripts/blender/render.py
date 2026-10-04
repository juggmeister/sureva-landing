# Headless render driver around sureva_scene.py (the Blender generator for the device).
#   blender -b --factory-startup --python scripts/blender/render.py -- <job> <out_dir> [key=value ...]
# jobs:
#   turn     assembled device turning on its vertical axis
#   float    the device tilted in mid-air, turning (hero, cursor-driven)
#   explode  camera move + staged teardown on its charging pad (Inside section, scroll-scrubbed)
#   views    orthographic plan and side views (specs)
# common options: res=<px> samples=<n> frames=<n> only=<i,j,k> (render a subset, for tests)
#                 finish=aluminium|terracotta (base and button)
import bpy, sys, os, math, json
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

argv = sys.argv[sys.argv.index('--') + 1:]
JOB, OUT = argv[0], os.path.abspath(argv[1])
OPT = dict(a.split('=', 1) for a in argv[2:])
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
os.makedirs(OUT, exist_ok=True)

src = open(os.path.join(HERE, 'sureva_scene.py'), encoding='utf-8').read()
logo = os.path.join(ROOT, 'assets-src', 'sureva_logo_trim.png').replace('\\', '/')
src = src.replace('LOGO_PATH         = ""', 'LOGO_PATH         = "%s"' % logo)
src = src.replace("FINISH            = 'aluminium'", "FINISH            = '%s'" % OPT.get('finish', 'aluminium'))
ns = {'__name__': '__sureva__'}
exec(compile(src, 'sureva_scene.py', 'exec'), ns)

scene = bpy.context.scene
C = ns  # generator constants and built objects


def use_gpu():
    prefs = bpy.context.preferences.addons['cycles'].preferences
    for kind in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = kind
            try:
                prefs.refresh_devices()
            except Exception:
                prefs.get_devices()
            if any(d.type == kind for d in prefs.devices):
                for d in prefs.devices:
                    d.use = d.type == kind
                scene.cycles.device = 'GPU'
                return kind
        except Exception as exc:
            print('gpu', kind, exc)
    return 'CPU'


print('device:', use_gpu())
scene.render.film_transparent = True
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
scene.cycles.samples = int(OPT.get('samples', 128))
# the generator's 16/24-bounce settings are for stills; these look the same here and render ~2x faster
scene.cycles.max_bounces = 8
scene.cycles.transmission_bounces = 8
scene.cycles.transparent_max_bounces = 8
scene.cycles.adaptive_threshold = 0.01
scene.cycles.use_denoising = True
try:
    scene.cycles.denoising_use_gpu = True
except Exception:
    pass

sweep = bpy.data.objects['Studio_Sweep']
sweep.is_shadow_catcher = True
sweep.visible_glossy = False  # reflections see the studio environment rather than the pale sweep
cam = bpy.data.objects['Product_Camera']
aim = bpy.data.objects['Aim_Target']


def empty(name, parent=None, loc=(0, 0, 0)):
    e = bpy.data.objects.new(name, None)
    scene.collection.objects.link(e)
    e.location = loc
    if parent:
        e.parent = parent
    return e


def attach(obs, parent):
    for ob in obs:
        mw = ob.matrix_world.copy()
        ob.parent = parent
        ob.matrix_world = mw


pivot = empty('Device_Pivot')
g_top = empty('G_Top', pivot)
g_board = empty('G_Board', pivot)
g_batt = empty('G_Battery', pivot)
g_coil = empty('G_Coil', pivot)
g_base = empty('G_Base', pivot)
pcb = C['pcb']
attach([C['top'], C['window'], C['led_pipe'], C['button']], g_top)
attach([o for o in pcb if o.name.startswith('Battery')], g_batt)
attach([o for o in pcb if not o.name.startswith('Battery')], g_board)
attach(C['coil'], g_coil)
attach([C['bottom']], g_base)

CROWN = C['SEAM_Z'] + C['TOP_H']
PCB_TOP = C['PCB_TOP']
# label anchors, in each group's local space (mm)
ANCHORS = {
    'uv':      (g_top,   (C['UV_X'], 0.0, CROWN)),
    'led':     (g_top,   (C['LED_X'], 0.0, CROWN)),
    'button':  (g_top,   (0.0, 0.0, CROWN + C['BTN_PROUD'])),
    'top':     (g_top,   (C['DEV_LENGTH'] * 0.5 - 1.0, 0.0, CROWN - 1.0)),
    'uvchip':  (g_board, (C['UV_X'], 0.0, PCB_TOP + 0.4)),
    'shield':  (g_board, (C['SHIELD_POS'][0], 0.0, PCB_TOP + 0.7)),
    'imu':     (g_board, (C['IMU_POS'][0], C['IMU_POS'][1], PCB_TOP + 0.5)),
    'th':      (g_board, (C['TH_POS'][0], C['TH_POS'][1], PCB_TOP + 0.5)),
    'board':   (g_board, (C['PCB_SIZE'][0] * 0.5, 0.0, C['PCB_Z'])),
    'battery': (g_batt,  (C['BATT_SIZE'][0] * 0.5, 0.0, C['BATT_Z'] + 0.75)),
    'coil':    (g_coil,  (C['COIL_R1'] * 0.7, -C['COIL_R1'] * 0.7, C['CAV_FLOOR_Z'] + 0.2)),
    'base':    (g_base,  (C['DEV_LENGTH'] * 0.5 - 0.5, 0.0, C['BOTTOM_H'] * 0.5)),
    'logo':    (g_base,  (C['LOGO_WIDTH'] * 0.25, -C['DEV_WIDTH'] * 0.5, C['LOGO_Z'])),
    'center':  (pivot,   (0.0, 0.0, C['DEV_HEIGHT'] * 0.5)),
}


def project():
    bpy.context.view_layer.update()
    out = {}
    for key, (grp, local) in ANCHORS.items():
        p = world_to_camera_view(scene, cam, grp.matrix_world @ Vector(local))
        out[key] = [round(p.x, 5), round(1.0 - p.y, 5)]
    return out


def place_camera(azimuth, elevation, distance, target, lens):
    aim.location = target
    a, e = math.radians(azimuth), math.radians(elevation)
    cam.location = (target[0] + distance * math.cos(e) * math.sin(a),
                    target[1] - distance * math.cos(e) * math.cos(a),
                    target[2] + distance * math.sin(e))
    cam.data.lens = lens


def ease(t):  # slow-out cubic in/out
    return 4 * t * t * t if t < 0.5 else 1 - (-2 * t + 2) ** 3 / 2


def span(t, a, b):
    return 0.0 if t <= a else 1.0 if t >= b else (t - a) / (b - a)


def lerp(a, b, t):
    return a + (b - a) * t


def frames_to_render(n):
    only = OPT.get('only')
    return [int(i) for i in only.split(',')] if only else list(range(n))


# the generator's hero camera sits ~110 mm out at azimuth ~27°, elevation ~21°
HERO_AZ, HERO_EL, HERO_DIST = 27.1, 21.2, 105.0

if JOB == 'turn':
    n = int(OPT.get('frames', 25))
    sweep_deg = float(OPT.get('sweep', 40))
    w = int(OPT.get('res', 2400))
    scene.render.resolution_x, scene.render.resolution_y = w, int(w * 0.62)
    place_camera(HERO_AZ, HERO_EL, HERO_DIST, (0, 0, C['DEV_HEIGHT'] * 0.45), float(OPT.get('lens', 150)))
    meta = []
    for i in range(n):
        pivot.rotation_euler.z = math.radians(-sweep_deg * 0.5 + sweep_deg * i / max(1, n - 1))
        meta.append(project())
        if i in frames_to_render(n):
            scene.render.filepath = os.path.join(OUT, '%03d.png' % i)
            bpy.ops.render.render(write_still=True)
    json.dump({'frames': meta, 'res': [scene.render.resolution_x, scene.render.resolution_y]},
              open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)

elif JOB == 'float':
    # the device hanging in the air beside the phone: tilted toward camera, no floor
    n = int(OPT.get('frames', 25))
    sweep_deg = float(OPT.get('sweep', 50))
    w = int(OPT.get('res', 1600))
    scene.render.resolution_x, scene.render.resolution_y = w, int(w * float(OPT.get('aspect', 0.9)))
    # the sweep stays in the scene for its warm bounce light but is never seen
    sweep.is_shadow_catcher = False
    sweep.visible_camera = False
    pivot.location.z = 14.0
    pivot.rotation_mode = 'ZYX'  # spin about its own axis first, then tilt in world space
    tilt_x, tilt_y = math.radians(float(OPT.get('tiltx', 24))), math.radians(float(OPT.get('tilty', -14)))
    meta = []
    for i in range(n):
        yaw = math.radians(-sweep_deg * 0.5 + sweep_deg * i / max(1, n - 1))
        pivot.rotation_euler = (tilt_x, tilt_y, yaw)
        bpy.context.view_layer.update()
        centre = pivot.matrix_world @ Vector((0, 0, C['DEV_HEIGHT'] * 0.5))
        place_camera(float(OPT.get('az', 14)), float(OPT.get('el', 16)), 110.0, tuple(centre),
                     float(OPT.get('lens', 118)))
        meta.append(project())
        if i in frames_to_render(n):
            scene.render.filepath = os.path.join(OUT, '%03d.png' % i)
            bpy.ops.render.render(write_still=True)
    json.dump({'frames': meta, 'res': [scene.render.resolution_x, scene.render.resolution_y]},
              open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)

elif JOB == 'explode':
    n = int(OPT.get('frames', 72))
    w = int(OPT.get('res', 1600))
    scene.render.resolution_x, scene.render.resolution_y = w, int(w * float(OPT.get('aspect', 1.0)))
    GAP = float(OPT.get('gap', 5.5))
    # the device starts docked in its wireless charging pad, which turns with it
    g_dock = empty('G_Dock')
    dock, rest_z = C['build_charger']()
    attach(dock, g_dock)
    # the base would otherwise mirror the white pad it sits in and read as white plastic; hiding
    # the pad from reflections keeps the same satin aluminium as the hero
    dock[0].visible_glossy = False
    pivot.location.z = rest_z
    ANCHORS['charger'] = (g_dock, (-C['PAD_L'] * 0.34, -C['PAD_W'] * 0.5 + 1.2, C['PAD_H'] * 0.55))
    meta = []
    for i in range(n):
        t = i / max(1, n - 1)
        # staged lift: lid first, then the board, the cell, and the charging coil last
        lid = ease(span(t, 0.00, 0.56))
        brd = ease(span(t, 0.12, 0.68))
        bat = ease(span(t, 0.24, 0.80))
        coil = ease(span(t, 0.36, 0.92))
        g_top.location.z = GAP * 4.0 * lid
        g_board.location.z = GAP * 3.0 * brd
        g_batt.location.z = GAP * 2.0 * bat
        g_coil.location.z = GAP * 1.0 * coil
        # framing follows the lid so the whole stack, pad included, stays in shot
        k = ease(span(t, 0.0, 0.85))
        yaw = math.radians(lerp(0.0, -14.0, k))
        pivot.rotation_euler.z = yaw
        g_dock.rotation_euler.z = yaw
        top = rest_z + g_top.location.z + C['DEV_HEIGHT']
        target = (0.0, 0.0, 0.5 * top)
        place_camera(lerp(HERO_AZ, 16.0, k), lerp(HERO_EL, 18.0, k), lerp(134.0, 142.0, lid), target,
                     lerp(float(OPT.get('lens0', 112)), float(OPT.get('lens1', 100)), lid))
        meta.append({'t': round(t, 4), 'lid': round(lid, 4), 'board': round(brd, 4), 'battery': round(bat, 4),
                     'coil': round(coil, 4), 'anchors': project()})
        if i in frames_to_render(n):
            scene.render.filepath = os.path.join(OUT, '%03d.png' % i)
            bpy.ops.render.render(write_still=True)
    json.dump({'frames': meta, 'res': [scene.render.resolution_x, scene.render.resolution_y]},
              open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)

elif JOB == 'still':
    # one free camera, for close inspection: az= el= dist= lens= at=x,y,z yaw=
    w = int(OPT.get('res', 1200))
    scene.render.resolution_x, scene.render.resolution_y = w, int(w * float(OPT.get('aspect', 0.75)))
    pivot.rotation_euler.z = math.radians(float(OPT.get('yaw', 0)))
    at = tuple(float(v) for v in OPT.get('at', '0,0,2.4').split(','))
    place_camera(float(OPT.get('az', HERO_AZ)), float(OPT.get('el', HERO_EL)), float(OPT.get('dist', HERO_DIST)),
                 at, float(OPT.get('lens', 150)))
    scene.render.filepath = os.path.join(OUT, OPT.get('name', 'still') + '.png')
    bpy.ops.render.render(write_still=True)

elif JOB == 'views':
    w = int(OPT.get('res', 2000))
    L, W, H = C['DEV_LENGTH'], C['DEV_WIDTH'], C['DEV_HEIGHT']
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = L * 1.5
    scene.render.resolution_x, scene.render.resolution_y = w, int(w * 0.56)
    pts = {'plan': {'left': (-L / 2, 0, H), 'right': (L / 2, 0, H), 'near': (0, -W / 2, H), 'far': (0, W / 2, H)},
           'side': {'left': (-L / 2, -W / 2, H / 2), 'right': (L / 2, -W / 2, H / 2),
                    'top': (0, -W / 2, H), 'bottom': (0, -W / 2, 0)}}
    shots = {'plan': (0.0, 89.9, 150.0), 'side': (0.0, 1.5, 150.0)}
    meta = {}
    for name, (az, el, dist) in shots.items():
        sweep.visible_camera = name != 'plan'
        place_camera(az, el, dist, (0, 0, H * 0.5), 50)
        bpy.context.view_layer.update()
        meta[name] = {k: [round(v, 5) for v in (lambda p: (p.x, 1 - p.y))(
            world_to_camera_view(scene, cam, pivot.matrix_world @ Vector(p)))] for k, p in pts[name].items()}
        scene.render.filepath = os.path.join(OUT, name + '.png')
        bpy.ops.render.render(write_still=True)
    json.dump({'views': meta, 'res': [scene.render.resolution_x, scene.render.resolution_y],
               'mm': {'length': L, 'width': W, 'height': H}}, open(os.path.join(OUT, 'meta.json'), 'w'), indent=1)

print('done', JOB)

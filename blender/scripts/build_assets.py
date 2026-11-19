"""Generate origin-at-floor, metre-scale GLBs and optional studio previews."""
import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
MEASUREMENTS = json.loads((ROOT / "src/config/measurements.json").read_text())
OUTPUT = ROOT / "public/models"


def material(name, color, roughness, metal=0):
    result = bpy.data.materials.new(name)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metal
    result.diffuse_color = (*color, 1)
    return result


def finish(obj, name, surface, radius=0):
    obj.name = name
    obj.data.materials.append(surface)
    if radius:
        bevel = obj.modifiers.new("Rounded edges", "BEVEL")
        bevel.width = radius
        bevel.segments = 2
        normal = obj.modifiers.new("Weighted normals", "WEIGHTED_NORMAL")
        normal.keep_sharp = True
    return obj


def block(name, center, dimensions, surface, radius=0.003):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, surface, radius)


def rings(name, sections, surface, radius=0, offset=(0, 0)):
    vertices = []
    for width, depth, corner, z, *translation in sections:
        dx, dy = translation or offset
        for quadrant, signs in enumerate(((1, 1), (-1, 1), (-1, -1), (1, -1))):
            x = signs[0] * (width / 2 - corner) + dx
            y = signs[1] * (depth / 2 - corner) + dy
            for segment in range(6):
                angle = (quadrant + segment / 5) * math.pi / 2
                vertices.append((x + corner * math.cos(angle), y + corner * math.sin(angle), z))
    stride = 24
    faces = [tuple(reversed(range(stride)))]
    for base in range(0, len(vertices) - stride, stride):
        for i in range(stride):
            j = (i + 1) % stride
            faces.append((base+i, base+j, base+j+stride, base+i+stride))
    faces.append(tuple(range(len(vertices) - stride, len(vertices))))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, surface, radius)


def tote():
    spec = MEASUREMENTS["tote"]
    w, d, h = (spec[key] for key in ("width", "depth", "height"))
    lip = h - spec["railBelowTop"]
    black = material("Charcoal molded polypropylene", (0.032, 0.038, 0.047), 0.40)
    yellow = material("Safety yellow polypropylene", (0.91, 0.64, 0.002), 0.32)
    rings("Tapered tub", [
        (w*.77, d*.81, .031, 0), (w*.80, d*.84, .032, .020),
        (w*.88, d*.91, .036, lip-.012), (w*.96, d*.97, .037, lip),
        (w*.973, d*.98, .037, h-.022)], black, .002)
    for side in (-1, 1):
        for x in (-.154, -.112, .112, .154):
            rings("Molded end rib", [
                (.012, .012, .003, .020, x, side*d*.418),
                (.019, .018, .004, lip-.018, x, side*d*.452),
            ], black, .002)
        for y in (-.23, -.13, 0, .13, .23):
            rings("Molded side rib", [
                (.014, .012, .003, .020, side*w*.399, y),
                (.018, .021, .004, lip-.020, side*w*.444, y),
            ], black, .002)
        block("Reinforced end grip", (0, side*(d/2-.015), lip+.008), (.225, .028, .026), black, .006)
    rings("Snap lid", [
        (w-.010, d-.008, .036, h-.026), (w, d, .038, h-.020),
        (w-.003, d-.003, .038, h-.009), (w-.023, d-.023, .034, h-.004),
        (w-.049, d-.049, .033, h-.004), (w-.063, d-.063, .030, h-.012),
    ], yellow, .0015)
    for x in (-1, 1):
        for y in (-1, 1):
            block("Stacking locator", (x*w*.304, y*d*.332, h-.009), (.107, .135, .018), yellow, .008)
    for i in range(-2, 3):
        block("Lid reinforcement", (0, i*d*.105, h-.0105), (w*.74, .010, .007), yellow)


def cylinder(name, center, radius, length, surface, across=False, sides=40, bevel=.0015):
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=length,
                                       location=center, rotation=(0, math.pi / 2, 0) if across else (0, 0, 0))
    obj = bpy.context.object
    for polygon in obj.data.polygons:
        polygon.use_smooth = len(polygon.vertices) == 4
    return finish(obj, name, surface, bevel)


def profile(name, x, outline, thickness, surface):
    points = [(x+side*thickness/2, y, z) for side in (-1, 1) for y, z in outline]
    count = len(outline)
    faces = [tuple(reversed(range(count))), tuple(range(count, 2*count))]
    faces += [(j, (j+1)%count, (j+1)%count+count, j+count) for j in range(count)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(points, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    return finish(obj, name, surface, .0013)


def caster():
    spec = MEASUREMENTS["caster"]
    r, tread, h = (spec["diameter"]/2, spec["tread"], spec["height"])
    orange = material("Orange polyurethane", (.9, .135, .012), .32)
    metal = material("Black powder-coated steel", (.018, .021, .025), .30, .55)
    hub = material("Black molded wheel core", (.022, .025, .029), .39)
    zinc = material("Zinc-plated hardware", (.45, .49, .54), .26, .82)
    axle_y = -.017

    cross_section = [(-tread/2, .038), (-tread/2, r-.004),
                     (-tread/2+.004, r), (tread/2-.004, r),
                     (tread/2, r-.004), (tread/2, .038)]
    segments = 48
    vertices = [(x, axle_y + rad * math.cos(i*math.tau/segments),
                 r + rad * math.sin(i*math.tau/segments))
                for x, rad in cross_section for i in range(segments)]
    faces = [(ring*segments+i, ((ring+1)%6)*segments+i,
              ((ring+1)%6)*segments+(i+1)%segments, ring*segments+(i+1)%segments)
             for ring in range(6) for i in range(segments)]
    mesh = bpy.data.meshes.new("Rounded tread")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    tire = bpy.data.objects.new("Polyurethane tire", mesh)
    bpy.context.collection.objects.link(tire)
    for polygon in mesh.polygons:
        polygon.use_smooth = True
    finish(tire, "Polyurethane tire", orange)
    cylinder("Wheel core", (0, axle_y, r), .039, .024, hub, True)
    for side in (-1, 1):
        cylinder("Raised hub", (side*.014, axle_y, r), .017, .008, hub, True)
        for i in range(5):
            angle = i * math.tau / 5
            spoke = block("Reinforced spoke", (side*.014, axle_y+.024*math.sin(angle), r+.024*math.cos(angle)),
                          (.007, .010, .032), hub, .0017)
            spoke.rotation_euler.x = -angle
        profile("Formed steel fork", side*.022, [
            (-.037,.108), (-.039,.092), (-.028,.050), (-.023,.041),
            (-.012,.037), (-.002,.042), (.011,.080), (.032,.107),
        ], .005, metal)
        cylinder("Axle hex", (side*.027, axle_y, r), .0085, .005, zinc, True, 6, .0007)
        cylinder("Brake pivot", (side*.024, -.036, .101), .004, .004, zinc, True, 24, .0006)

    block("Caster mounting plate", (0, 0, h-.002), (spec["plateWidth"], spec["plateDepth"], .004), metal, .0016)
    for x in (-.036, .036):
        for y in (-.023, .023):
            cylinder("Mounting fastener", (x,y,h-.005), .0037, .002, zinc, sides=6, bevel=.0004)
    cylinder("Swivel bearing", (0, 0, h-.008), .027, .008, metal)
    cylinder("Bearing race", (0, 0, h-.014), .025, .006, metal)
    block("Fork crown", (0, -.005, h-.022), (.049, .059, .012), metal)
    profile("Brake lever", 0, [(-.071,.105), (-.055,.099), (-.026,.101),
                             (-.019,.109), (-.047,.108), (-.069,.112)], .038, metal)
    for i in range(4):
        block("Brake pedal grip", (0, -.057 + i*.004, .109), (.031,.0015,.002), metal, .00035)


def merge_by_material():
    for surface in {obj.data.materials[0] for obj in bpy.context.scene.objects}:
        bpy.ops.object.select_all(action="DESELECT")
        objects = [obj for obj in bpy.context.scene.objects if obj.data.materials[0] == surface]
        for obj in objects:
            bpy.context.view_layer.objects.active = obj
            obj.select_set(True)
            for modifier in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=modifier.name)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        bpy.context.object.name = surface.name


def render_preview(name, target):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.cycles.use_denoising = True
    scene.render.resolution_x = 640
    scene.render.resolution_y = 520
    scene.render.resolution_percentage = 100
    scene.world = bpy.data.worlds.new("Studio environment")
    scene.world.color = (.3, .3, .3)
    scale = target * 6
    floor = material("Studio floor", (.45,.43,.38), .8)
    block("Studio surface", (0,0,-.012), (scale*4,scale*4,.022), floor)
    for name_, location, energy in [
        ("Key", (-2,-3,5), 140), ("Fill", (3,-1,3), 60), ("Rim", (1,3,5), 110),
    ]:
        bpy.ops.object.light_add(type="AREA", location=Vector(location)*scale)
        light = bpy.context.object
        light.name = name_
        light.data.energy = energy*scale**2
        light.data.shape = "DISK"
        light.data.size = scale * 2
        light.rotation_euler = (Vector((0,0,target))-light.location).to_track_quat("-Z","Y").to_euler()
    bpy.ops.object.camera_add(location=Vector((1.15,-1.45,1.0))*scale)
    scene.camera = bpy.context.object
    scene.camera.rotation_euler = (Vector((0,0,target))-scene.camera.location).to_track_quat("-Z","Y").to_euler()
    scene.camera.data.type = "ORTHO"
    scene.camera.data.ortho_scale = scale * (.69 if name == "caster" else 1)
    preview_dir = ROOT / "blender/previews"
    preview_dir.mkdir(exist_ok=True)
    scene.render.filepath = str(preview_dir / f"{name}.png")
    bpy.ops.render.render(write_still=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--preview", action="store_true")
    args = parser.parse_args(sys.argv[sys.argv.index("--")+1:] if "--" in sys.argv else [])
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for name, create, target in (("tote", tote, .18), ("caster", caster, .067)):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        create()
        merge_by_material()
        bpy.ops.export_scene.gltf(filepath=str(OUTPUT / f"{name}.glb"), export_format="GLB")
        if args.preview:
            render_preview(name, target)


if __name__ == "__main__":
    main()

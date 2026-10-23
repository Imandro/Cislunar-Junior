"""Convert the GLB from the user supplied ZIP to Unity FBX with Blender."""
import os
import tempfile
import zipfile
import bpy

project = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
archive = os.path.join(project, "NASA-source", "user-provided", "orion-spacecraft.zip")
target = os.path.join(project, "Assets", "Resources", "NASA", "Orion_ArtemisII.fbx")

with tempfile.TemporaryDirectory() as folder:
    with zipfile.ZipFile(archive) as package:
        package.extract("source/orionspacecraft.glb", folder)
    source = os.path.join(folder, "source", "orionspacecraft.glb")
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=source)
    bpy.ops.export_scene.fbx(filepath=target, use_selection=False, object_types={"EMPTY", "MESH"}, axis_forward="-Z", axis_up="Y")

print("EXPORTED_ORION", target)

"""Copy exact SLS FBX and texture from the user supplied ZIP."""
import os
import shutil
import zipfile

project = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
archive = os.path.join(project, "NASA-source", "user-provided", "nasa-artemis-ii-space-launch-system-sls.zip")
output = os.path.join(project, "Assets", "Resources", "NASA")
os.makedirs(output, exist_ok=True)

with zipfile.ZipFile(archive) as package:
    for source, target in (("source/Artemis 2.fbx", "Artemis2_reference.fbx"),
                           ("textures/Artemis 2 texture.png", "Artemis2_SLS.png")):
        with package.open(source) as reader, open(os.path.join(output, target), "wb") as writer:
            shutil.copyfileobj(reader, writer)

print("EXPORTED_SLS", os.path.join(output, "Artemis2_reference.fbx"))

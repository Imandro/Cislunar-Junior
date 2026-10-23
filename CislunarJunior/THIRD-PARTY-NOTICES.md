# Recursos de NASA

- **Space Launch System Block 1**: `NASA-source/user-provided/nasa-artemis-ii-space-launch-system-sls.zip`, recurso NASA entregado por el usuario. Runtime usa exactamente `source/Artemis 2.fbx` como `Assets/Resources/NASA/Artemis2_reference.fbx` y `textures/Artemis 2 texture.png` como `Artemis2_SLS.png`.
- Hashes SHA-256 verificados: FBX `659FD9D7393524201CC178275313C795D531B1E77F00D98F9A78513B4BE5E814`; textura `0F5CA32C11DFCDB0AA287961FDA7055D0725B3AEBE6357705B25DC7493E80F4E`.
- **Orion spacecraft**: `NASA-source/user-provided/orion-spacecraft.zip`, recurso entregado por el usuario. `source/orionspacecraft.glb` se convirtió a `Assets/Resources/NASA/Orion_ArtemisII.fbx` con Blender. El asset conserva cápsula, módulo de servicio, paneles solares y detalles.
- El rig local de separación no es otro asset importado: son primitivas mínimas alineadas al FBX oficial, usadas solo porque el SLS entregado es una malla única.
- Fuentes antiguas se conservaron fuera de `Resources` en `NASA-source/archive/legacy-assets/`; no participan en runtime.

El crédito corresponde a NASA. Cislunar Junior es un simulador educativo independiente; NASA no lo ha revisado ni lo patrocina. Uso sujeto a https://www.nasa.gov/nasa-brand-center/images-and-media/.

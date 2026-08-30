---
name: threejs
description: Use when working on Three.js in the Build Arena. Loads scene setup, materials/lighting, and glTF loading skills. Trigger on Three.js, WebGL renderer, camera, lights, meshes, or GLB/glTF.
---

# Three.js (arena bundle)

This folder is a pointer. Read these next, in order, for the matching task:

| Task | Open |
| --- | --- |
| Scene, camera, renderer, resize, loop | `../threejs-scene-setup/SKILL.md` then `../threejs-scene-setup/references/scene-graph.md` |
| Materials, lights, shadows | `../threejs-materials-lighting/SKILL.md` then `../threejs-materials-lighting/references/materials-lights-table.md` |
| Load GLB/glTF and animation | `../threejs-gltf-loading/SKILL.md` then `../threejs-gltf-loading/references/loaders-and-animation.md` |

Arena rule: Three.js only draws the world. Voxel data and commands stay in `src/core/`. Do not store blocks in the scene graph.

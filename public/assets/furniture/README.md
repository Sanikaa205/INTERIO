# Local furniture models

The GLB files in this folder are generated locally by `scripts/generate-furniture-assets.mjs` from original INTERIO procedural geometry. They do not contain third-party meshes, textures, or downloaded assets.

These compact GLBs are used as local asset matches; the Three.js scene also builds detailed procedural furniture as a graceful fallback.

## Preparing a model (how the app uses a GLB)

A model is sized to the piece's width x height x depth, stood on the floor and centred on its footprint, so any scale or pivot works. The model's **front must face +Z** (the same way as the procedural furniture).

To make a model recolourable, name its materials in your 3D tool before exporting:

| Material name contains | Takes the colour of |
|---|---|
| `main` | the body / upholstery colour (`item.color`) |
| `main_frame` (wooden pieces) | the frame colour if set, else the body colour |
| `frame` | the wood / frame colour (`item.frameColor`), else keeps its own colour |

Models with no such names keep their own colours and get a light tint of the body colour.

Any load error (missing file, bad data, empty model) leaves the procedural model in place, so a model can never break a design.

Keep each model small (target under 300 KB, textures at most 1024 px; compress offline with a tool such as gltf-transform, never at runtime).

Every third-party model needs an entry in `LICENSES.md` (source, author, licence, URL) **before** it is used. Only CC0 / public-domain or similarly permissive licences that allow redistribution are accepted.

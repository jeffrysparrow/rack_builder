# Rack Builder

A local React and TypeScript prototype for configuring a wooden garage rack for 27-gallon storage totes.

## Run locally

Use Node.js 20 or newer.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Drag the model to orbit and scroll or pinch to zoom. On narrow screens, the rack configuration is below the preview.

```sh
npm run build
npm run preview
```

## Project structure

- `src/config/measurements.json` defines dimensions in meters. Blender and the browser share the same tote and caster dimensions.
- `src/config/rack.ts` holds the typed configuration, top material presets, pricing hook, and pure layout calculation. The layout places front and rear uprights, continuous base and header boards, paired depth-running rails for each tote, a top panel, and symmetric caster pairs.
- `src/three/` contains the reusable rounded wood board, studio, rack assembly, and instanced tote and caster components. Directional procedural grain follows each board's length. Plywood textures show plies at the edge, while MDF has a fine fiber texture. Wood materials are procedural approximations.
- `blender/scripts/build_assets.py` generates the models from geometry and material definitions. Each export batches meshes by material for GPU instancing. The GLBs are checked in, so Blender is optional for running the app.
- The local, Git-ignored `references/` folder holds the supplied garage photos and product diagrams used to model the rack.

## Regenerate the 3D assets

With Blender 5.1, run this command from the project folder. On macOS, the Blender executable is typically `/Applications/Blender.app/Contents/MacOS/Blender`.

```sh
blender -b --python-exit-code 1 --python blender/scripts/build_assets.py -- --preview
```

This writes `public/models/tote.glb` and `public/models/caster.glb`, plus studio renders in `blender/previews/`. Omit `--preview` for an export-only run.

## What to measure on the actual rack

The prototype starts at four columns by four rows because that layout has clear front and side references. The displayed size is an estimate for the configured assembly and includes the top, fitted totes, and caster envelope where applicable.

| Detail | Current basis | Measurement that would improve it |
| --- | --- | --- |
| Caster | Supplied diagram shows 100 mm wheel diameter, 32 mm tread, 133 mm installed height, and a 92 × 62 mm plate. | Mounting hole centers, installed caster positions, and brake orientation. |
| Lumber and top | Assumes dressed 2×4 members (1.5 × 3.5 in) and a roughly 3/4 in top. | Actual post, rail, and top thicknesses and top overhang. |
| Rack envelope | Calculated from the bay pitch, a 705 mm frame depth, and the accessory geometry. | Outside width, depth, and height of one 4×4 rack with casters. |
| Bay fit | Assumes a 516 mm clear opening, 412 mm vertical pitch, and a tote that hangs from its rim. | Clear width between posts, vertical distance between rail tops, and inside distance between the two rails in one bay. |
| Tote | The supplied HDX diagram lists 28.5 × 19.6 × 15.2 in. The 19.6 in end faces forward in the rack. The support lip is estimated at 44 mm below the lid top. | Width and depth at the support rim and the actual lip-to-lid distance. A side photo of a tote pulled halfway out would clarify how it meets the rails. |
| Hidden framing and mounting | Front and rear posts are linked by the rails, top, and perimeter base. Wheel counts are estimated as 4, 6, or 8 depending on the width. | Straight-on rear and underside views showing any bracing, base crosspieces, and how the caster plates are fastened. |

Model proportions and hardware details are approximate. Pricing is reserved through a nullable hook, and the tote model uses unbranded geometry.

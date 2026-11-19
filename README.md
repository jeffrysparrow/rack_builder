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
- `src/config/rack.ts` holds the typed configuration, top material presets, and pure layout calculation. The layout places front and rear uprights, continuous base and header boards, paired depth-running rails for each tote, a top panel, and symmetric caster pairs.
- `src/three/` contains the reusable rounded wood board, studio, rack assembly, and instanced tote and caster components. Directional procedural grain follows each board's length. Plywood textures show plies at the edge, while MDF has a fine fiber texture. Wood materials are procedural approximations.
- `blender/scripts/build_assets.py` generates the models from geometry and material definitions. Each export batches meshes by material for GPU instancing. The GLBs are checked in, so Blender is optional for running the app.
- The local, Git-ignored `references/` folder holds the supplied garage photos and product diagrams used to model the rack.

## Regenerate the 3D assets

With Blender 5.1, run this command from the project folder. On macOS, the Blender executable is typically `/Applications/Blender.app/Contents/MacOS/Blender`.

```sh
blender -b --python-exit-code 1 --python blender/scripts/build_assets.py -- --preview
```

This writes `public/models/tote.glb` and `public/models/caster.glb`, plus studio renders in `blender/previews/`. Omit `--preview` for an export-only run.

## Plywood top references

- **Standard plywood** uses Plytanium 19/32 in southern yellow pine sheathing. The model shows bold grain, visible knots, and visible layers along the cut edge. [Product listing](https://www.homedepot.com/p/Plytanium-19-32-in-x-4-ft-x-8-ft-Rtd-Sheathing-Syp-195482/100004472)
- **Premium plywood** uses 23/32 in cabinet-grade plywood. The model shows a smoother face with subtler grain and more even layers along the cut edge. [Product listing](https://www.homedepot.com/p/23-32-in-x-4-ft-x-8-ft-Cabinet-Grade-Plywood-Panel-Actual-0-688-in-x-48-in-x-96-in-1077486/302610611)

The finish options display the nominal sheet sizes. The 3D preview uses a shared panel thickness of about 3/4 in.

## Tote sizing

The tote brand sets the bay width, rung length, and preview tote size, including when the totes are hidden. The 3D view uses the same tote model scaled to each profile.

- HDX uses the supplied product diagram. Sterilite provisionally uses the same dimensions.
- Greenmade, Project Source, and Hyper Tough provisionally use the HDX dimensions plus 3/4 in across the front and 1 in front to back. Their heights are assumed to match HDX.
- Member’s Mark uses its listed 20.6 in short side, 30.6 in long side, and 14.3 in height. [Sam’s Club product listing](https://www.samsclub.com/ip/members-mark-heavy-duty-storage-tote-black-yellow/13605308660)

Shelf clearances and support rim positions still need measurements from the actual totes and rack.

## Cut list and rack dimensions

The cut list displays inches in fractions to the nearest 1/8 in. Customer dimensions round up to the next whole inch when needed. The 3D view uses the unrounded cut lengths.

- Upright lengths for one through five rows are 16.5, 32, 47.5, 63, and 79 in. The cut list counts one more upright than columns on each of the front and rear frames.
- HDX and Sterilite use 20.25 in bays and 29 in rungs. Other brands use 21 in bays and 30 in rungs. The list counts two rungs per bay.
- Four crossboards run the full width, calculated as the total bay width plus 1.5 in per upright across one face. Each crossboard gets an extra 1/4 in at three or four columns, or 3/8 in at five columns.
- Overall height includes the uprights, both crossboards (3 in combined), the caster lift (5.5 in when selected), and any selected top panel. The height calculation and preview use the same modeled panel thickness. Panel cuts are pending.
- Customer depth is rung length plus a 1 in allowance for rear bracing. On one- to four-column racks, plywood tops show two matching rear strips. MDF and open-top frames use a representative full-width rear 2×4 with short mitered braces in the lower rear bays. Five-column racks use 2×4s across the middle three bays and the lower mitered braces for every top option. The preview assumes one horizontal brace for one to three rows and two for four to five rows on five-column racks. Brace placement and cut sizes are pending confirmation.

The preview spaces the rungs evenly within the uprights and estimates the tote support-rim position. Measurements from the actual rack and tote rim can refine those details.

## Pricing and tote display

The estimate uses $20 per slot, $60 for standard plywood, $90 for premium plywood or MDF, and $15 per caster. Open-top racks have no top charge.

Totes appear in the preview by default. The separate delivery add-on starts off. When selected, it includes one Greenmade Costco tote per slot at $15 each and sizes the rack for Greenmade. Turning it off restores the customer’s previous tote brand.

### Address-based delivery quotes

Set `DELIVERY_ORIGIN` and a Google Routes API key as `GOOGLE_MAPS_API_KEY` in an ignored `.env.local` file, then restart Vite. Both settings are server-only. Development and local preview expose `POST /api/delivery-quote`. A production deployment must mount the same endpoint on its server or serverless platform. Static assets alone cannot calculate delivery quotes.

The endpoint sends the route origin and destination street, city, state, and ZIP code to Google Routes. Apartment details and delivery notes stay in the current page. The endpoint returns only the computed fee. The first 15 one-way road miles are free, then the rate is $2 per additional mile, with the total fee rounded to the nearest dollar.

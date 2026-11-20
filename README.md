# Rack Builder

A React and TypeScript storefront for configuring wooden tote racks, with a Cloudflare Worker and D1 database for shop settings, delivery, and orders.

## Run locally

Use Node.js 22 or newer.

```sh
npm ci
npm run db:local
npm run build
npm run dev:worker
```

Open **http://127.0.0.1:8787/**. Open **/admin** and enter your local development token to manage the shop. Drag the model to orbit and scroll or pinch to zoom. On narrow screens, the rack configuration is below the preview.

Customers can continue to an order request and rank up to three posted delivery times. In Builder admin, open the request and prepare the final offer with the rack subtotal, delivery address, and fee. Quote links expire after 14 days. A revised quote replaces its previous link. When the customer accepts, the builder can book delivery and record offline payments. Set the public contact email, service area, lead time, and optional deposit policy under **Storefront**. The 90-day sales funnel and lead sources are under **Analytics**.

The storefront can share a configuration with all rack selections. The real-photo gallery is at **/rack-builds/** and is readable with JavaScript disabled.

Under **Reviews** in Builder admin, enter the customer’s display name, star rating, source, and review text. You can change the source, hide a review, or republish it from the same tab.

```sh
npm run dev
```

For frontend hot reload, run the Vite command in a second terminal while the Worker is running. Vite proxies API requests to the Worker.

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

### Modular orders and consultations

Each rack in an order can be edited separately. Adding a rack copies the current rack as a starting point. Pricing, tote capacity, and cut counts cover the whole order. The 3D preview shows the selected rack. Consultations are saved in Builder admin, and the Worker sends them to the shop notification email when Resend is configured.

## Platform setup

See the [platform plan](docs/platform-plan.md) for the pilot and multi-builder architecture. `npm run build:storefront` is available for a standalone configurator preview. Use **`npm run build`** with the Worker for the full platform.

### Local settings

Keep provider secrets in the ignored `.env.local`. Wrangler loads that file in local development when `.dev.vars` is absent. Set `LOCAL_ADMIN_TOKEN` to a random value and use the same value in the local admin prompt. The local login only applies to loopback hosts. Add the following settings for the flows you want to exercise.

| Setting | Purpose |
| --- | --- |
| `GOOGLE_MAPS_API_KEY` | Google Routes key. Use an API restriction for Routes. |
| `DELIVERY_ORIGIN` | Initial routing address for ToteWorks ATX. Editable in Builder admin and excluded from public responses. |
| `QUOTE_SIGNING_SECRET` | Random signing key for short-lived, address-bound route quotes. Generate one with `openssl rand -hex 32`. |
| `RESEND_API_KEY`, `CONSULT_FROM_EMAIL` | Resend API key and verified sender for inquiries and order notifications. |
| `CONSULT_TO_EMAIL` | Initial ToteWorks ATX recipient. Builder admin can change the recipient. |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe test credentials for checkout and webhook verification. Local forwarding can use the Stripe CLI. |

Publish future delivery windows in **Builder admin → Delivery**. Customers can include up to three preferences, and an order request saves the rack price and cut list. Confirming a window reserves it and counts against the shop’s Monday-through-Sunday capacity. Pay on delivery is the default. With Stripe configured, the builder can explicitly request full card prepayment for an eligible order. Failed emails can be retried from Builder admin, and a verified Stripe webhook records online payment.

### Production setup

1. Use Wrangler authenticated to the Cloudflare account that owns `toteworks-atx`. The production D1 database is already bound in `wrangler.jsonc`. Apply pending migrations with `npx wrangler@4 d1 migrations apply DB --remote` before deploying Worker changes that depend on them.
2. In Cloudflare Access, protect `/admin` and `/api/admin` for both `totesandtimber.com` and `toteworksatx.com` on the same self-hosted application. Set an allow policy for the owner. Configure `ACCESS_ISSUER` as the HTTPS Access team domain, `ACCESS_AUDIENCE` as the application’s AUD tag, and `SHOP_OWNER_EMAIL` as the permitted email. The Worker also verifies Access tokens and shop membership. For an additional shop, add the owner to `shop_members` for that shop. `LOCAL_ADMIN_TOKEN` is for the local Worker.
3. Add the route and Resend settings above as Worker secrets using `npx wrangler@4 secret put <name>` or the dashboard. Add your Resend sender domain’s verification records in DNS. A real consult submission and a confirmation email should reach the intended recipients before launch.
4. Add Stripe in test mode. Register `https://totesandtimber.com/api/stripe/webhook` for `checkout.session.completed`. Use the endpoint signing secret and a matching test-mode Stripe key. Verify one order in Stripe test mode. Confirm the tax handling for the shop before enabling live charges. Checkout currently uses the saved rack and delivery total without automated tax calculation.
5. Run `npm run build` and `npx wrangler@4 deploy`. For Cloudflare Git builds use `npm run build` as the build command and `npx wrangler@4 deploy` as the deploy command. Keep `toteworksatx.com` on the Worker so existing quote and payment links still work. Add real delivery windows after deployment.

[Cloudflare D1 migrations](https://developers.cloudflare.com/d1/reference/migrations/) · [Cloudflare Access JWT validation](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/) · [Resend domains](https://resend.com/docs/dashboard/domains/introduction) · [Stripe test webhook forwarding](https://docs.stripe.com/webhooks#test-webhook)

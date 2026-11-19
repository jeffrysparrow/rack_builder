# ToteWorks ATX and the rack-builder platform

## Goal

Launch a low-cost storefront for ToteWorks ATX, learn from real customers, and turn the same configurator into a service that other builders can use under their own brands.

## One application with three experiences

| Experience | Purpose |
| --- | --- |
| Public storefront | A builder’s branded product page, 3D configuration, multi-rack estimate, and eventual delivery and checkout flow. |
| Builder dashboard | An authenticated workspace for that builder’s orders, consult requests, delivery preferences, confirmed bookings, weekly capacity, prices, and construction rules. |
| Platform owner dashboard | A protected workspace for onboarding builders, mapping domains, helping configure build rules, and troubleshooting. Add this when the second builder is ready. |

Start with one codebase, one production application, and one shop record for ToteWorks ATX. Add builder domains to the same application as they onboard. A builder sees their own store and dashboard. The platform owner experience can eventually live on a separate hostname and still share the backend.

## Pilot infrastructure

- **Cloudflare Workers with static assets.** Serve the storefront and 3D assets from Cloudflare. Add Worker API routes for address quotes, consult email, orders, and payment callbacks as those features go live. Keep provider credentials and delivery origins in server-side configuration.
- **Cloudflare D1.** Add the database when we start saving shop settings and orders. Use the free tier for the pilot and revisit capacity after measuring usage. Domain registration, payment processing, and third-party API usage are separate costs.
- **Cloudflare Access for the initial owner login.** Protect the admin UI and its write endpoints. When builders onboard, use authenticated identities with shop membership and server-side authorization. Customers can check out as guests.
- **Stripe Checkout.** Create Checkout Sessions from the server-calculated order total. Verify Stripe webhook signatures and process events idempotently. Use the owner’s Stripe account for the pilot. Evaluate Stripe Connect when builders need their own payouts.
- **Search visibility.** Render public copy, product photos, and approved reviews in the initial HTML as the storefront matures. Load the interactive 3D viewer separately. Add canonical URLs and a sitemap when the custom domain is live. Keep admin and private order pages out of the search index.

[Cloudflare Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) · [Cloudflare Access](https://developers.cloudflare.com/workers/configuration/cloudflare-access/) · [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment) · [Stripe Connect](https://docs.stripe.com/connect/direct-charges)

## Builder service tiers

| | Configurator | Commerce |
| --- | --- | --- |
| Storefront | Shared 3D rack template, builder logo and colors, shareable storefront, multi-rack configuration, dimensions, itemized estimate, and inquiry sent to the builder. | Everything in Configurator, plus custom materials and hardware visuals, builder-specific 3D components as needed, and a branded domain connection. |
| Build rules | Set the builder’s prices, tote fit, and supported options within the shared template during onboarding. The builder follows up on delivery and takes payment through their usual process. | Model the builder’s materials, clearances, bracing, wheels, and cut rules. Generate a private cut list from the accepted order’s saved specification. |
| Order workflow | The inquiry includes the selected configuration and product estimate. | Address-based delivery quote, three preferred delivery windows, builder confirmation, hosted checkout, and a dashboard for orders, capacity, pricing, and delivery settings. |

Use one application and one pricing and geometry engine. Store the shop’s plan and configuration together and enforce plan features in the API as well as the UI. Upgrading keeps the builder’s storefront and settings. Both tiers need accurate dimensions for the configurations they sell. If a builder’s rack falls outside the standard template, scope the modeling and validation during onboarding.

Test **$29–$39/month for Configurator** and **$79–$119/month for Commerce** in conversations with early builders. These are pricing hypotheses. Charge separately for onboarding that includes measuring, creating custom graphics, and validating cut rules. Quote bespoke modeling by scope. Keep ongoing support and routine pricing changes within a defined subscription scope. At a $75/hour internal labor target, 20 minutes of support costs $25 and a four-hour setup costs $300. That is the primary margin constraint at the start. Let Stripe bill each Commerce builder for their own customer payments and bill the software subscription separately.

## Operating costs and free-tier breakpoints

US prices checked November 19, 2026. The pilot can run at **$0/month in hosting, database, routing, application email, and owner login**, within the limits below. Budget roughly **$20/year plus the ICANN fee** for the existing Namecheap `.com` renewal, plus fees on orders once payments go live. This budget excludes labor and the costs of making and delivering racks. [Namecheap renewal rates](https://www.namecheap.com/support/knowledgebase/article.aspx/10840/2201/com-price-change-november-1-2026/)

| Service | Free allowance and cost after it |
| --- | --- |
| Storefront and API | Cloudflare serves static assets free and unlimited when they are served directly. API and server-rendered page requests count toward Workers Free’s 100,000 requests/day and 10 ms CPU per invocation. Paid starts at $5/month per account and includes 10 million requests and 30 million CPU ms/month. An additional million costs $0.30 for requests or $0.02 for CPU ms. [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) · [Static asset billing](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/) |
| Database | D1 Free includes 5 million rows read/day, 100,000 rows written/day, and 5 GB total with a 500 MB limit per database. At 20 billed row writes per order, 5,000 orders/day would consume the write allowance if orders were the only writes. Index shop and order queries because reads count scanned rows. Workers Paid includes higher D1 allowances, including 25 billion reads and 50 million writes/month. [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) · [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) |
| Road-distance quotes | Our current traffic-unaware, distance-only request fits Google Compute Routes Essentials. The first 10,000 billable events/month for that SKU are free across projects sharing the billing account, then $5 per 1,000 through 100,000 events. At one call per submitted address, 10,000 events covers 10,000 checks. Request routing on address submit. Address autocomplete and traffic-aware routing have their own billing implications. [Google Maps pricing](https://developers.google.com/maps/billing-and-pricing/pricing) · [Routes billing](https://developers.google.com/maps/documentation/routes/usage-and-billing) |
| Transactional email | Resend Free includes 3,000 emails/month, 100/day, and three verified sending domains. Pro is $20/month for 50,000 emails and 10 domains. Start with a shared verified sender, use the verified builder address for replies where appropriate, and count every recipient. A shop’s storefront domain and its email sending domain can be configured independently. [Resend pricing](https://resend.com/pricing) |
| Admin login | Cloudflare Access is free for a small team up to roughly 50 users and can cover the pilot owner login. Choose builder-facing authentication before wider onboarding, based on active admin seats and shop-level permissions. The scale estimates assume no paid identity service. [Cloudflare Access pricing](https://www.cloudflare.com/sase/products/access/) |
| Scheduling and graphics | Build delivery preferences and confirmation with D1. Bundle initial graphics with the storefront. If builders need to upload photos or textures later, R2 Standard includes 10 GB-month, 1 million Class A operations, and 10 million Class B operations/month. The time to produce and check custom graphics remains a separate cost. [R2 pricing](https://developers.cloudflare.com/r2/pricing/) |
| Builder domains | Builders can use platform subdomains at launch. For builder-owned DNS, evaluate Cloudflare for SaaS when self-service connections are needed. It includes 100 custom hostnames, then $0.10 per additional hostname. A `www` hostname and the root can consume two slots when both are onboarded. Standard onboarding can use a subdomain such as `www`. Direct apex proxying for external DNS is a paid Enterprise add-on. Domain renewal is separate. [Cloudflare for SaaS plans](https://developers.cloudflare.com/cloudflare-for-platforms/cloudflare-for-saas/plans/) |

### Illustrative monthly volumes

Assume each shop gets 1,000 storefront visits, submits 100 delivery address checks, and produces 30 application emails per month. This models all shops using Commerce-level quoting. Assume one Google call per address submission, a shared sending domain, and one to three Worker invocations per visit including ancillary activity. Daily peaks, retries, CPU time, and storage can move the breakpoints. Figures below cover Workers, D1, Google Routes, and Resend and exclude domain renewals, payment fees, support, and paid add-ons.

| Shops | Visits | Route calls | App emails | Estimated monthly vendor spend |
| ---: | ---: | ---: | ---: | --- |
| 1 | 1,000 | 100 | 30 | $0 |
| 10 | 10,000 | 1,000 | 300 | $0 with free limits and a shared sender |
| 100 | 100,000 | 10,000 | 3,000 | $0 at both monthly allowances if email stays within 100/day. Budget $25 for paid email and the $5 Workers plan. |
| 250 | 250,000 | 25,000 | 7,500 | About $100 with $75 Routes, $20 Resend, and $5 Workers. |

The email daily limit can arrive before the monthly limit on busy days. At a 10% address-quote rate with one routing call per submission, 100,000 visits/month reaches Google’s free allowance. At two routing calls per submitted quote, that falls to roughly 50,000 visits. Measure sent emails, quote submissions and retries, Worker CPU, and D1 rows during the pilot. Use request limits and Google quota controls to contain unexpected routing use.

### Payment costs

- **Customer payments.** Stripe’s standard US domestic card fee is 2.9% + $0.30 per successful charge, or **$9.00 on a $300 charge**. Ten such orders cost $90 in processing. When other builders onboard, use Stripe Connect with Stripe directly pricing and billing connected builders to avoid the platform’s additional Connect account and payout fees. If we instead manage payment pricing, published Connect fees include $2 per active payout account/month and 0.25% + $0.25 per payout, on top of processing costs. [Stripe US pricing](https://stripe.com/us/pricing) · [Connect pricing](https://stripe.com/connect/pricing)
- **Software subscriptions and optional tax tooling.** Stripe Billing pay-as-you-go adds 0.7% of subscription volume on top of payment processing. A $99 software subscription paid with a domestic card would cost about $3.86 total in fees. If enabled, Stripe Tax Basic through Checkout lists an additional 0.5% for applicable transactions. Budget for refunds and disputes when running live payments. [Stripe Billing](https://stripe.com/billing/pricing) · [Stripe Tax](https://stripe.com/tax/pricing)

## Shop and order boundaries

| Record | What it owns |
| --- | --- |
| Shop and domain | Builder identity, service tier, branding, public copy, and the verified hostnames that resolve to the shop. |
| Shop membership | Authenticated user and shop role. Platform support access is separately authorized and logged. |
| Versioned build specification | Tote dimensions, bay clearances, lumber, caster thresholds, brace rules, top or shelf options, prices, and cut allowances. Start with explicit, validated fields and add new rule types as they are needed. |
| Delivery and capacity settings | Private route origin, delivery rates, available windows, and weekly build capacity. |
| Order and rack items | Customer contact and delivery details, each freestanding rack configuration, and a snapshot of the applicable spec, cut list, dimensions, item prices, delivery fee, and total. |
| Delivery preferences and booking | Three ranked preferred windows, plus the confirmed window and its status. |
| Payment | Checkout session, payment status, and provider event identifiers. Card details stay with Stripe. |

Resolve the shop from its trusted domain for public requests. Scope all private queries and mutations to the authenticated user’s shop permissions. Save order snapshots so future material or price edits do not change an accepted order. Recalculate prices on the server before accepting a checkout. Confirm a delivery window atomically so two orders cannot claim the same slot.

## Rollout

1. **Public storefront preview.** The 3D builder, modular rack configuration, dimensions, price breakdown, and cut list are live over HTTPS at `toteworksatx.com`. Show only actions that work on the public preview.
2. **Configure ToteWorks ATX as the first shop.** Use Builder admin to set the storefront copy, accent color, prices, tote fit, build limits, and private delivery settings. New orders use the settings currently published for the shop. Saved orders retain their quoted total and cut list.
3. **Activate the production integrations.** The Worker and D1 are deployed at `toteworksatx.com`, and live Google Routes testing returned both a free and a paid quote. Finish Cloudflare Access and Resend using the [deployment instructions](../README.md#production-setup). Verify that a consultation and delivery confirmation reach the intended inboxes.
4. **Run the first order through the platform.** Publish three or more available windows, request an order, confirm one window, and send the checkout link. Complete a Stripe test payment and verify the signed status update in Builder admin. Resolve sales tax handling before accepting live payments. Use an actual order to check the saved dimensions and cuts against the build.
5. **Second builder.** Onboard one builder with different materials or cut rules. Start with the Configurator workflow and record setup time and support requests. Test the Commerce upgrade with the same shop data, including cut accuracy, shop isolation, separate admin access, and builder payouts. Build the platform-owner dashboard around the onboarding tasks that recur.

The pilot is successful when a real ToteWorks ATX order can move from rack design to an agreed delivery and payment, and the owner can build the rack from the saved order specification.

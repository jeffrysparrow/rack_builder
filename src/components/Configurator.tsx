import { Component, lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { track } from '../analytics';
import { OrderRequest, PurchaseSteps } from './OrderRequest';
import { CustomerReviews } from './CustomerReviews';
import { StorefrontDetails } from './StorefrontDetails';
import { calculateRack, defaultConfiguration, finishes, formatCutLength, getRackToteType, outsideDimensions } from '../config/rack';
import type { RackConfiguration } from '../config/rack';
import { estimateOrderPrice, estimatePrice } from '../config/pricing';
import { deliveryToteBrand, deliveryToteType, isToteType, toteProfiles } from '../config/totes';
import { carouselImageSizes, rackPhotoGroups, rackPhotos, rackPhotoSource } from '../config/gallery';
import { shareConfiguration, sharedConfiguration } from '../config/share';

import { defaultShop, formatRackSize, MAX_ORDER_RACKS } from '../config/shop';
import type { Storefront } from '../config/shop';
const Studio = lazy(() => import('../three/Studio').then(({ Studio }) => ({ default: Studio })));

class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <div className="viewer-error" role="status"><p>The 3D preview isn’t available on this device. You can still design your rack and get a price.</p></div>
      : this.props.children;
  }
}

function Icon({ name }: { name: 'rack' | 'reset' | 'mouse' }) {
  const lines: Record<typeof name, ReactNode> = {
    rack: <><rect x="3" y="3" width="18" height="17" rx="1.5" /><path d="M3 9h18M3 14h18M9 3v17m6-17v17M6 20v2m12-2v2" /></>,
    reset: <><path d="M3 11a9 9 0 1 1 2.4 7M3 5v6h6" /></>,
    mouse: <><rect x="6.5" y="3" width="11" height="18" rx="5.5" /><path d="M12 7v4" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{lines[name]}</svg>;
}

const minimumRackSize = { columns: 2, rows: 1 };

function Stepper({ label, value, minimum, maximum, onChange }: {
  label: string; value: number; minimum: number; maximum?: number; onChange: (delta: number) => void;
}) {
  return <div className="stepper-field">
    <span className="field-label">{label}</span>
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" disabled={value <= minimum} aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(-1)}>−</button>
      <output aria-label={label}>{value}</output>
      <button type="button" disabled={maximum !== undefined && value >= maximum} aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(1)}>+</button>
    </div>
  </div>;
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description: string; checked: boolean; onChange: (checked: boolean) => void;
}) {
  return <label className="toggle-row">
    <span><span className="option-title">{label}</span><span className="option-detail">{description}</span></span>
    <input type="checkbox" role="switch" aria-label={label} checked={checked} onChange={(event) => onChange(event.target.checked)} />
  </label>;
}

const dollars = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
function combineCuts(layouts: ReturnType<typeof calculateRack>[]) {
  const parts = new Map<string, Map<number, number>>();
  for (const layout of layouts) {
    for (const { name, length, quantity } of layout.cuts.pieces) {
      const lengths = parts.get(name) ?? new Map<number, number>();
      lengths.set(length, (lengths.get(length) ?? 0) + quantity);
      parts.set(name, lengths);
    }
  }
  return Array.from(parts).flatMap(([name, lengths]) =>
    Array.from(lengths, ([length, quantity]) => ({ name, length, quantity })));
}

export function Configurator({ shop }: { shop: Storefront }) {
  const { settings, revision, deliveryAvailable, consultAvailable, reviews } = shop;
  const { rates, build } = settings;
  const [shared] = useState(() => sharedConfiguration(location.search, build));
  const [{ racks, activeIndex }, setOrder] = useState({
    racks: shared.racks.length ? shared.racks : [{ ...defaultConfiguration, columns: Math.min(defaultConfiguration.columns, build.maxColumns), rows: Math.min(defaultConfiguration.rows, build.maxRows) }],
    activeIndex: 0,
  });
  const config = racks[activeIndex];
  const [reset, setReset] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [copyStatus, setCopyStatus] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [shareLink, setShareLink] = useState('');
  const canCheckout = consultAvailable || deliveryAvailable;
  useEffect(() => {
    if (consultAvailable && location.hash === '#consult') document.getElementById('consult')?.scrollIntoView();
  }, [consultAvailable]);
  const [checkingOut, setCheckingOut] = useState(() => canCheckout && location.hash === '#quote');
  const configureHeading = useRef<HTMLHeadingElement>(null);
  const configureSection = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLElement>(null);
  const [pastHero, setPastHero] = useState(false);
  useEffect(() => {
    if (!hero.current || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(([entry]) => {
      setPastHero(entry.boundingClientRect.bottom <= 0);
    });
    observer.observe(hero.current);
    return () => observer.disconnect();
  }, []);
  function trackIntent() {
    if (consultAvailable) {
      track('configurator_started');
      track('configuration_completed');
      track('begin_checkout');
    }
  }
  useEffect(() => {
    if (!canCheckout) return;
    const restoreStep = () => setCheckingOut(location.hash === '#quote');
    window.addEventListener('popstate', restoreStep);
    return () => window.removeEventListener('popstate', restoreStep);
  }, [canCheckout]);

  function openCheckout() {
    trackIntent();
    if (location.hash !== '#quote') history.pushState(null, '', '#quote');
    setCheckingOut(true);
  }

  function returnToConfiguration() {
    if (location.hash === '#quote') history.replaceState(null, '', '#configure');
    setCheckingOut(false);
    requestAnimationFrame(() => {
      configureHeading.current?.focus({ preventScroll: true });
      configureSection.current?.scrollIntoView();
    });
  }
  const layouts = useMemo(() => racks.map((rack) => calculateRack(rack, build)), [racks, build]);
  const layout = layouts[activeIndex];
  const dimensions = layouts.map(outsideDimensions);
  const outside = dimensions[activeIndex];
  const price = estimateOrderPrice(racks, rates, build);
  const capacity = config.columns * config.rows;
  const rackPrice = estimatePrice(config, rates, build);
  const toteType = getRackToteType(config);
  const canAddTotes = toteType === deliveryToteType;
  const featuredRack = rackPhotos[2];
  const { full: _heroFull, ...heroImage } = rackPhotoSource(featuredRack);
  const orderCapacity = racks.reduce((count, rack) => count + rack.columns * rack.rows, 0);
  const sideBySideWidth = layouts.reduce((width, rack) => width + rack.cuts.width, 0);
  const cuts = useMemo(() => combineCuts(layouts), [layouts]);
  const multiple = racks.length > 1;
  const updateRack = (change: (current: RackConfiguration) => RackConfiguration) => {
    setOrder((order) => ({
      ...order,
      racks: order.racks.map((rack, index) => index === order.activeIndex ? change(rack) : rack),
    }));
  };
  const update = <Key extends keyof RackConfiguration>(key: Key, value: RackConfiguration[Key]) => {
    updateRack((rack) => ({ ...rack, [key]: value }));
  };
  const changeLayout = (axis: 'columns' | 'rows', delta: number) => {
    if (consultAvailable) track('configurator_started');
    updateRack((rack) => ({
      ...rack,
      [axis]: Math.max(minimumRackSize[axis], Math.min(axis === 'columns' ? build.maxColumns : build.maxRows, rack[axis] + delta)),
    }));
  };
  const addRack = () => {
    if (consultAvailable) track('configurator_started');
    setOrder((order) => ({ racks: [...order.racks, { ...order.racks[order.activeIndex] }], activeIndex: order.racks.length }));
    requestAnimationFrame(() => configureHeading.current?.focus());
  };
  const removeRack = () => setOrder((order) => {
    if (order.racks.length === 1) return order;
    const racks = order.racks.filter((_, index) => index !== order.activeIndex);
    return { racks, activeIndex: Math.min(order.activeIndex, racks.length - 1) };
  });

  async function copyEstimate() {
    try {
      const lines = racks.map((rack, index) => {
        const top = finishes.find(({ id }) => id === rack.topMaterial)?.label;
        return `Rack ${index + 1}: ${formatRackSize(rack)} · ${toteProfiles[getRackToteType(rack)].label} · ${top} · ${rack.includeCasters ? 'Locking wheels' : 'No wheels'} · ${rack.includeTotesWithDelivery ? 'Totes included' : 'Rack only'} · ${dollars.format(estimatePrice(rack, rates, build).total)}`;
      });
      await navigator.clipboard.writeText([settings.name + ' rack estimate', ...lines,
        `Rack subtotal: ${dollars.format(price.total)} before delivery`].join('\n'));
      setCopyStatus('Rack estimate copied.');
    } catch {
      setCopyStatus('We couldn’t copy your price. You can still share the link to your rack.');
    }
  }

  async function copyConfiguration() {
    if (consultAvailable) {
      track('configurator_started');
      track('configuration_completed');
    }
    const link = shareConfiguration(shop.shareOrigin || location.origin, racks);
    try {
      await navigator.clipboard.writeText(link);
      setShareLink('');
      setShareStatus('Link copied!');
    } catch {
      setShareStatus('Copy the link below to share your rack.');
      setShareLink(link);
    }
  }

  return <>
    <header className="site-header storefront-header">
      <a className="identity" href="/"><span className="brand-icon"><Icon name="rack" /></span><span>{settings.name}</span></a>
      <nav className="site-nav" aria-label="Main navigation">
        <a href="#configure" onClick={(event) => { event.preventDefault(); returnToConfiguration(); }}>Design a rack</a>
        <a href="/rack-builds/">Our work</a>
        {reviews.length > 0 && <a href="#reviews">Reviews</a>}
        {consultAvailable && <a href="#consult">Contact</a>}
      </nav>
    </header>
    <main className={`workspace storefront-workspace${checkingOut ? ' checking-out' : ''}`} id="product">
      <section className="storefront-hero" ref={hero} hidden={checkingOut}>
        <div className="hero-copy">
          <p className="hero-service">{settings.name === defaultShop.name && settings.serviceArea === defaultShop.serviceArea ? 'Hand-built in the Leander area' : settings.serviceArea}</p>
          <h1>{settings.title}</h1>
          <p className="hero-description">{settings.description}</p>
          {settings.name === defaultShop.name && <p className="hero-aside">Less tote Jenga. More garage.</p>}
          <a href="#configure" className="hero-cta" onClick={(event) => { event.preventDefault(); returnToConfiguration(); }}>Design your rack</a>
        </div>
        <div className="hero-photo">
          <img {...heroImage} alt={featuredRack.alt} fetchPriority="high" sizes="(max-width: 900px) 100vw, 54vw" />
        </div>
      </section>
      <div hidden={checkingOut}>
        {consultAvailable && <PurchaseSteps current="configure" />}
        <div className="builder" id="configure" ref={configureSection}>
          <section className="viewer" aria-label="Your rack in 3D">
            <div className="studio">
              <ViewerBoundary><Suspense fallback={<p className="viewer-error" role="status">Loading 3D preview…</p>}>
                <Studio layout={layout} reset={reset} zoom={zoom} />
              </Suspense></ViewerBoundary>
            </div>
            <div className="viewer-heading">
              <span className="viewer-label">Your rack in 3D</span>
              <span className="viewer-size">{formatRackSize(config)}{multiple && ` · Rack ${activeIndex + 1} of ${racks.length}`}</span>
            </div>
            <div className="viewer-footer">
              <span className="viewer-help"><Icon name="mouse" /><span className="mouse-hint">Drag to spin</span><span className="touch-hint">Swipe to spin</span></span>
              <div className="viewer-actions">
                <button className="viewer-button zoom-button" type="button" aria-label="Zoom out" title="Zoom out"
                  onClick={() => setZoom((step) => step - 1)}>−</button>
                <button className="viewer-button zoom-button" type="button" aria-label="Zoom in" title="Zoom in"
                  onClick={() => setZoom((step) => step + 1)}>+</button>
                <button className="viewer-button" type="button" aria-label="Reset rack view" title="Reset view"
                  onClick={() => setReset((current) => current + 1)}><Icon name="reset" /><span>Reset view</span></button>
              </div>
            </div>
          </section>
          <aside className="settings" aria-label="Rack design" onChange={() => {
            if (consultAvailable) track('configurator_started');
          }}>
            <section className="setting-section config-intro">
              <h2 ref={configureHeading} tabIndex={-1}>{multiple ? `Make rack ${activeIndex + 1} yours` : 'Make it yours'}</h2>
              {shared.changed && <p role="status" className="layout-help">Some options from this link are no longer available. Check your rack before continuing.</p>}
              {multiple && <ul className="rack-options" aria-label="Racks in your order">
                {racks.map((rack, index) => <li key={index}>
                  <button type="button" aria-pressed={index === activeIndex}
                    onClick={() => setOrder((order) => ({ ...order, activeIndex: index }))}>
                    <span><strong>Rack {index + 1}</strong><small>{formatRackSize(rack)}</small></span>
                    <strong>{dollars.format(estimatePrice(rack, rates, build).total)}</strong>
                  </button>
                </li>)}
              </ul>}
              <label className="tote-field" htmlFor="tote-brand">Which totes do you use?</label>
              <select className="tote-select" id="tote-brand" value={toteType}
                disabled={config.includeTotesWithDelivery} aria-describedby="tote-fit-help"
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  if (isToteType(value)) update('binType', value);
                }}>
                {Object.entries(toteProfiles).map(([id, profile]) => <option key={id} value={id}>{profile.label}</option>)}
              </select>
              <p className="layout-help" id="tote-fit-help">
                {config.includeTotesWithDelivery
                  ? `We’ll size your rack for the 27-gallon ${deliveryToteBrand} totes you’ve added.`
                  : 'Tote sizes vary by brand. Make sure you choose yours.'}
              </p>
            </section>
            <section className="setting-section">
              <div className="section-heading"><h2>How many totes?</h2><span className="capacity" aria-live="polite">{capacity} tote spaces</span></div>
              <div className="stepper-grid">
                <Stepper label="Totes high" value={config.rows} minimum={minimumRackSize.rows} maximum={build.maxRows} onChange={(delta) => changeLayout('rows', delta)} />
                <Stepper label="Totes across" value={config.columns} minimum={minimumRackSize.columns} maximum={build.maxColumns} onChange={(delta) => changeLayout('columns', delta)} />
              </div>
              <p className="layout-help">Rack frame <strong>{dollars.format(rackPrice.frame)}</strong></p>
            </section>
            <section className="setting-section dimensions">
              <h2>Outside dimensions{multiple && ` · Rack ${activeIndex + 1}`}</h2>
              <dl className="dimension-grid" aria-live="polite">
                <div><dt>Across</dt><dd>{outside.across}<small> in</small></dd></div>
                <div><dt>High</dt><dd>{outside.high}<small> in</small></dd></div>
                <div><dt>Depth</dt><dd>{outside.depth}<small> in</small></dd></div>
              </dl>
              {multiple && <p className="layout-help"><strong>{Math.ceil(sideBySideWidth)} in wide</strong> with all {racks.length} racks side by side.</p>}
              <p className="layout-help">Finished measurements, rounded up to the nearest inch. Leave room in front to slide totes out.</p>
              <p className="layout-help">Height includes the top and wheels you select. Depth includes the rear bracing.</p>
            </section>
            <section className="setting-section">
              <fieldset>
                <legend>Add a top</legend>
                <p className="layout-help">Add a work surface, or leave the top open.</p>
                <div className="finish-list">
                  {finishes.map((finish) => <label className="finish-option" key={finish.id}>
                    <span className={`swatch ${finish.id}`} style={{ backgroundColor: finish.color }} />
                    <span>
                      <span className="option-title">{finish.label}</span>
                      {finish.detail && <span className="option-detail">{finish.detail}</span>}
                    </span>
                    <strong className="upgrade-price">{rates.top[finish.id] ? `+${dollars.format(rates.top[finish.id])}` : dollars.format(0)}</strong>
                    <input type="radio" name="top-material" aria-label={`${finish.label}, ${dollars.format(rates.top[finish.id])}`} checked={config.topMaterial === finish.id}
                      onChange={() => update('topMaterial', finish.id)} />
                  </label>)}
                </div>
              </fieldset>
            </section>
            <section className="setting-section accessories">
              <h2>Wheels &amp; extras</h2>
              <Toggle label="Add locking wheels" description={`${layout.casterCount} wheels · +${dollars.format(layout.casterCount * rates.caster)}`}
                checked={config.includeCasters} onChange={(value) => update('includeCasters', value)} />
              {canAddTotes ? <Toggle label="Need the totes, too?"
                description={`27-gallon ${deliveryToteBrand} only · ${capacity} for +${dollars.format(capacity * rates.tote)}`}
                checked={config.includeTotesWithDelivery} onChange={(value) => update('includeTotesWithDelivery', value)} />
                : <p className="layout-help">We only supply 27-gallon {deliveryToteBrand} totes. To add totes, choose {deliveryToteBrand} for your rack.</p>}
              <Toggle label="Show totes in 3D" description="Just for the preview. No totes are added to your order." checked={config.includeBins}
                onChange={(value) => update('includeBins', value)} />
            </section>
            <section className="setting-section pricing" aria-labelledby="pricing-heading">
              <div className="rack-order-actions">
                <button type="button" className="text-button" disabled={racks.length >= MAX_ORDER_RACKS} onClick={addRack}>{multiple ? 'Add another rack' : 'Add a second rack'}</button>
                {multiple && <button type="button" className="text-button" onClick={removeRack}>Remove rack {activeIndex + 1}</button>}
              </div>
              <h2 id="pricing-heading">Your price</h2>
              <dl className="price-lines">
                <div><dt>{multiple ? 'Rack frames' : 'Rack frame'} · {orderCapacity} tote spaces</dt><dd>{dollars.format(price.frame)}</dd></div>
                {price.top > 0 && <div><dt>Top panel</dt><dd>{dollars.format(price.top)}</dd></div>}
                {price.wheelQuantity > 0 && <div><dt>Locking wheels · {price.wheelQuantity}</dt><dd>{dollars.format(price.wheels)}</dd></div>}
                {price.toteQuantity > 0 && <div><dt>Storage totes · {price.toteQuantity}</dt><dd>{dollars.format(price.totes)}</dd></div>}
                <div className="price-total"><dt>Rack subtotal</dt><dd aria-live="polite">{dollars.format(price.total)}</dd></div>
              </dl>
              <div className={`configure-continue${pastHero && canCheckout ? ' is-sticky' : ''}`}>
                <span className="mobile-subtotal"><strong>{dollars.format(price.total)}</strong><small>Delivery calculated next</small></span>
                {canCheckout ? <button type="button" className="delivery-action" onClick={openCheckout}>
                  {consultAvailable ? 'Continue to delivery' : 'Estimate delivery'}
                </button> : <button type="button" className="delivery-action" onClick={copyEstimate}>Copy rack estimate</button>}
              </div>
              <button type="button" className="text-button share-config" onClick={copyConfiguration}>{multiple ? 'Share these racks' : 'Share this rack'}</button>
              {copyStatus && <p className="layout-help" role="status">{copyStatus}</p>}
              {shareStatus && <p className="layout-help" role="status">{shareStatus}</p>}
              {shareLink && <label className="delivery-field">Rack link<input readOnly value={shareLink} onFocus={(event) => event.target.select()} /></label>}
            </section>
          </aside>
        </div>
      </div>
      {canCheckout && <OrderRequest racks={racks} dimensions={dimensions} subtotal={price.total} revision={revision} settings={settings}
        canEstimate={deliveryAvailable} canSubmit={consultAvailable} active={checkingOut} onConfigure={returnToConfiguration} />}
      <CustomerReviews reviews={reviews} />
      <section className="store-section storefront-photos" aria-labelledby="storefront-photos-heading">
        <div className="store-section-heading"><h2 id="storefront-photos-heading">Racks we’ve built</h2></div>
        {rackPhotoGroups.map(({ id, title, photos }) => <section className="rack-carousel" key={id} aria-labelledby={`storefront-photos-${id}`}>
          <div className="carousel-heading">
            <h3 id={`storefront-photos-${id}`}>{title}</h3>
            <div className="carousel-controls">
              <button type="button" data-slide="-1" aria-label={`Previous photo · ${title}`} aria-controls={`storefront-track-${id}`}>‹</button>
              <button type="button" data-slide="1" aria-label={`Next photo · ${title}`} aria-controls={`storefront-track-${id}`}>›</button>
            </div>
          </div>
          <ul className="carousel-track" id={`storefront-track-${id}`}>
            {photos.map((photo) => {
              const { full, ...image } = rackPhotoSource(photo);
              return <li key={photo.slug}><figure>
                <a href={full}><img {...image} alt={photo.alt} loading="lazy" decoding="async" sizes={carouselImageSizes} /></a>
                <figcaption>{photo.title}</figcaption>
              </figure></li>;
            })}
          </ul>
        </section>)}
        <div className="photo-links">
          <a href="/rack-builds/" className="text-link">See more of our work</a>
          {consultAvailable && <a href="#consult" className="text-link">Ask about a custom rack</a>}
        </div>
      </section>
      {consultAvailable && <StorefrontDetails racks={racks} publicEmail={settings.publicEmail} />}
      {import.meta.env.MODE === 'storefront' && <details className="settings cut-list">
        <summary id="cut-list-heading">2×4 cut list{multiple && ` · all ${racks.length} racks`}</summary>
        <table aria-labelledby="cut-list-heading">
          <thead><tr><th scope="col">Part</th><th scope="col">Quantity</th><th scope="col">Cut length</th></tr></thead>
          <tbody>
            {cuts.map(({ name, quantity, length }) => (
              <tr key={`${name}-${length}`}><th scope="row">{name}</th><td>{quantity}</td><td>{formatCutLength(length)} in</td></tr>
            ))}
          </tbody>
        </table>
        <p className="layout-help">Top panel and rear bracing cuts are pending.</p>
      </details>}
    </main>
  </>;
}

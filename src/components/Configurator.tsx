import { Component, lazy, Suspense, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { track } from '../analytics';
import { DeliveryDetails } from './DeliveryDetails';
import { OrderRequest } from './OrderRequest';
import { CustomerReviews } from './CustomerReviews';
import { StorefrontDetails } from './StorefrontDetails';
import { calculateRack, defaultConfiguration, finishes, formatCutLength, getRackToteType } from '../config/rack';
import type { RackConfiguration } from '../config/rack';
import { estimateOrderPrice, estimatePrice } from '../config/pricing';
import { deliveryToteBrand, isToteType, toteProfiles } from '../config/totes';
import { rackPhotos, rackPhotoSource } from '../config/gallery';
import { shareConfiguration, sharedConfiguration } from '../config/share';

import { MAX_ORDER_RACKS } from '../config/shop';
import type { Storefront } from '../config/shop';
const Studio = lazy(() => import('../three/Studio').then(({ Studio }) => ({ default: Studio })));

class ViewerBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <p className="viewer-error">The 3D preview could not load. Reload the page to try again.</p>
      : this.props.children;
  }
}

function Icon({ name }: { name: 'rack' | 'orbit' | 'reset' | 'mouse' | 'delivery' }) {
  const lines: Record<typeof name, ReactNode> = {
    rack: <><rect x="3" y="3" width="18" height="17" rx="1.5" /><path d="M3 9h18M3 14h18M9 3v17m6-17v17M6 20v2m12-2v2" /></>,
    orbit: <><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)" /><ellipse cx="12" cy="12" rx="4" ry="10" transform="rotate(-30 12 12)" /></>,
    reset: <><path d="M3 11a9 9 0 1 1 2.4 7M3 5v6h6" /></>,
    delivery: <><path d="M2 5h12v12H7m7 0h2m4 0h2v-5l-3-4h-5M2 17h1m11-5h8" /><circle cx="5" cy="17" r="2" /><circle cx="18" cy="17" r="2" /></>,
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
  const [spin, setSpin] = useState(false);
  const [reset, setReset] = useState(0);
  const [zoom, setZoom] = useState(0);
  const [copyStatus, setCopyStatus] = useState('');
  const [shareStatus, setShareStatus] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [quoteZip, setQuoteZip] = useState('');
  const deliveryDialog = useRef<HTMLDialogElement>(null);
  function trackIntent() {
    if (consultAvailable) {
      track('configurator_started');
      track('configuration_completed');
      track('begin_checkout');
    }
  }
  const openDelivery = () => {
    trackIntent();
    deliveryDialog.current?.showModal();
  };
  const layouts = useMemo(() => racks.map((rack) => calculateRack(rack, build)), [racks, build]);
  const layout = layouts[activeIndex];
  const price = estimateOrderPrice(racks, rates, build);
  const capacity = config.columns * config.rows;
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
        return `Rack ${index + 1}: ${rack.columns} wide × ${rack.rows} high · ${toteProfiles[getRackToteType(rack)].label} · ${top} · ${rack.includeCasters ? 'Casters' : 'No casters'} · ${rack.includeTotesWithDelivery ? 'Totes included' : 'Rack only'} · ${dollars.format(estimatePrice(rack, rates, build).total)}`;
      });
      await navigator.clipboard.writeText([settings.name + ' rack estimate', ...lines,
        `Rack & accessories total: ${dollars.format(price.total)} before delivery`].join('\n'));
      setCopyStatus('Rack estimate copied.');
    } catch {
      setCopyStatus('Couldn’t copy the estimate. You can share a screenshot of your order.');
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
      setShareStatus('Configuration link copied.');
    } catch {
      setShareStatus('Copy the configuration link below.');
      setShareLink(link);
    }
  }

  return <>
    <header className="site-header">
      <a className="identity" href="#product"><span className="brand-icon"><Icon name="rack" /></span><span>{settings.name}</span></a>
      <nav className="site-nav" aria-label="Main navigation">
        <a href="#configure">Configure</a>
        <a href="/rack-builds/">Rack photos</a>
        {reviews.length > 0 && <a href="#reviews">Reviews</a>}
        {consultAvailable && <a href="#consult">Contact</a>}
        {deliveryAvailable && <button type="button" className="nav-delivery" onClick={openDelivery}>Delivery</button>}
      </nav>
    </header>
    <main className="workspace" id="product">
      <div className="page-intro">
        <div className="intro-copy">
          <h1>{settings.title}</h1>
          <p>{settings.description}</p>
        </div>
        <div className="delivery-banner">
          <span className="delivery-icon"><Icon name="delivery" /></span>
          <span><strong>{settings.delivery.freeMiles > 0 ? 'Free local delivery' : 'Delivery available'}</strong>
            <span>{settings.delivery.freeMiles > 0 && `First ${settings.delivery.freeMiles} road miles free, then `}
              {settings.delivery.extraMileRate.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 })} per {settings.delivery.freeMiles > 0 ? 'extra ' : 'road '}mile</span></span>
        </div>
      </div>
      <div className="builder" id="configure">
        <section className="viewer" aria-label="Interactive rack preview">
          <div className="studio">
            <ViewerBoundary><Suspense fallback={<p className="viewer-error">Loading 3D preview…</p>}>
              <Studio layout={layout} spin={spin} reset={reset} zoom={zoom} />
            </Suspense></ViewerBoundary>
          </div>
          <div className="viewer-heading">
            <span className="viewer-label">3D preview</span>
            <span className="viewer-size">{config.columns} × {config.rows} rack{multiple && ` · Rack ${activeIndex + 1} of ${racks.length}`}</span>
          </div>
          <div className="viewer-footer">
            <span className="viewer-help"><Icon name="mouse" /><span>Drag to rotate</span></span>
            <div className="viewer-actions">
              <button className="viewer-button zoom-button" type="button" aria-label="Zoom out" title="Zoom out"
                onClick={() => setZoom((step) => step - 1)}>−</button>
              <button className="viewer-button zoom-button" type="button" aria-label="Zoom in" title="Zoom in"
                onClick={() => setZoom((step) => step + 1)}>+</button>
              <button className="viewer-button" type="button" aria-label="Auto-rotate" aria-pressed={spin} title="Auto-rotate"
                onClick={() => setSpin((active) => !active)}><Icon name="orbit" /><span>Auto-rotate</span></button>
              <button className="viewer-button" type="button" aria-label="Reset camera" title="Reset camera"
                onClick={() => { setSpin(false); setReset((current) => current + 1); }}><Icon name="reset" /><span>Reset view</span></button>
            </div>
          </div>
        </section>
        <aside className="settings" aria-label="Rack configuration" onChange={() => {
          if (consultAvailable) track('configurator_started');
        }}>
          <section className="setting-section rack-order" aria-labelledby="rack-order-heading">
            {shared.changed && <p role="status" className="layout-help">Some options in this link were unavailable. Review the configuration before requesting your rack.</p>}
            <div className="section-heading">
              <h2 id="rack-order-heading">Racks in your order</h2>
              <span className="capacity">{orderCapacity} tote spaces</span>
            </div>
            <ul className="rack-options">
              {racks.map((rack, index) => <li key={index}>
                <button type="button" aria-pressed={index === activeIndex}
                  onClick={() => setOrder((order) => ({ ...order, activeIndex: index }))}>
                  <span><strong>Rack {index + 1}</strong><small>{rack.columns} wide × {rack.rows} high</small></span>
                  <strong>{dollars.format(estimatePrice(rack, rates, build).total)}</strong>
                </button>
              </li>)}
            </ul>
            <div className="rack-order-actions">
              <button type="button" className="rack-add" disabled={racks.length >= MAX_ORDER_RACKS} onClick={addRack}>Add another rack</button>
              {multiple && <button type="button" className="rack-remove" onClick={removeRack}>Remove rack {activeIndex + 1}</button>}
            </div>
          </section>
          <section className="setting-section">
            <div className="section-heading"><h2>{multiple ? `Configure rack ${activeIndex + 1}` : 'Build your rack'}</h2><span className="capacity">{capacity} tote {capacity === 1 ? 'space' : 'spaces'}</span></div>
            <div className="stepper-grid">
              <Stepper label="Columns" value={config.columns} minimum={minimumRackSize.columns} maximum={build.maxColumns} onChange={(delta) => changeLayout('columns', delta)} />
              <Stepper label="Rows" value={config.rows} minimum={minimumRackSize.rows} maximum={build.maxRows} onChange={(delta) => changeLayout('rows', delta)} />
            </div>
            {consultAvailable && <a className="config-consult text-link" href="#consult">Need a custom size or tote fit?</a>}
          </section>
          <section className="setting-section">
            <label className="tote-field" htmlFor="tote-brand">Tote brand</label>
            <select className="tote-select" id="tote-brand" value={getRackToteType(config)}
              disabled={config.includeTotesWithDelivery} aria-describedby="tote-fit-help"
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (isToteType(value)) update('binType', value);
              }}>
              {Object.entries(toteProfiles).map(([id, profile]) => <option key={id} value={id}>{profile.label}</option>)}
            </select>
            <p className="layout-help" id="tote-fit-help">
              {config.includeTotesWithDelivery
                ? `This rack is sized for the ${deliveryToteBrand} totes included with delivery.`
                : 'Choose your tote brand for a rack sized to fit.'}
            </p>
            <Toggle label="Show totes in preview" description="Display setting only" checked={config.includeBins}
              onChange={(value) => update('includeBins', value)} />
          </section>
          <section className="setting-section">
            <fieldset>
              <legend>Top panel</legend>
              <div className="finish-list">
                {finishes.map((finish) => <label className="finish-option" key={finish.id}>
                  <span className={`swatch ${finish.id}`} style={{ backgroundColor: finish.color }} />
                  <span>
                    <span className="option-title">{finish.label}</span>
                    {finish.detail && <span className="option-detail">{finish.detail}</span>}
                  </span>
                  <input type="radio" name="top-material" checked={config.topMaterial === finish.id}
                    onChange={() => update('topMaterial', finish.id)} />
                </label>)}
              </div>
            </fieldset>
          </section>
          <section className="setting-section accessories">
            <h2>Accessories</h2>
            <Toggle label="Swivel casters" description={`${layout.casterCount} wheels · ${dollars.format(rates.caster)} each`}
              checked={config.includeCasters} onChange={(value) => update('includeCasters', value)} />
            <Toggle label="Add totes with delivery" description={`${capacity} ${deliveryToteBrand} totes · ${dollars.format(rates.tote)} each`}
              checked={config.includeTotesWithDelivery} onChange={(value) => update('includeTotesWithDelivery', value)} />
          </section>
          <section className="setting-section dimensions">
            <h2>{multiple ? `Rack ${activeIndex + 1} size` : 'Overall rack size'}</h2>
            <dl className="dimension-grid" aria-live="polite">
              <div><dt>Width</dt><dd>{Math.ceil(layout.cuts.width)}<small> in</small></dd></div>
              <div><dt>Height</dt><dd>{Math.ceil(layout.cuts.height)}<small> in</small></dd></div>
              <div><dt>Depth</dt><dd>{Math.ceil(layout.cuts.depth)}<small> in</small></dd></div>
            </dl>
            {multiple && <p className="layout-help"><strong>{Math.ceil(sideBySideWidth)} in wide</strong> with all {racks.length} racks side by side.</p>}
            <p className="layout-help">Rounded up to whole inches. Depth includes 1 in for rear bracing.</p>
          </section>
          <section className="setting-section pricing" aria-labelledby="pricing-heading">
            <h2 id="pricing-heading">{multiple ? 'Order price breakdown' : 'Price breakdown'}</h2>
            <dl className="price-lines">
              <div><dt>Rack frame · {orderCapacity} {orderCapacity === 1 ? 'slot' : 'slots'}</dt><dd>{dollars.format(price.frame)}</dd></div>
              {price.top > 0 && <div><dt>Top panel</dt><dd>{dollars.format(price.top)}</dd></div>}
              {price.wheelQuantity > 0 && <div><dt>Casters · {price.wheelQuantity}</dt><dd>{dollars.format(price.wheels)}</dd></div>}
              {price.toteQuantity > 0 && <div><dt>Storage totes · {price.toteQuantity}</dt><dd>{dollars.format(price.totes)}</dd></div>}
              <div className="price-total"><dt>Rack &amp; accessories total</dt><dd aria-live="polite">{dollars.format(price.total)}</dd></div>
            </dl>
            <p className="layout-help">Delivery is calculated from your street address and ZIP code.</p>
            <div className="estimate-actions">
              {consultAvailable && <a href="#quote" className="delivery-next" onClick={trackIntent}>Continue to order</a>}
              <button type="button" className={`delivery-next${consultAvailable ? ' delivery-edit' : ''}`}
                onClick={deliveryAvailable ? openDelivery : copyEstimate}>
                {deliveryAvailable ? 'Get a delivery estimate' : 'Copy rack estimate'}
              </button>
              <button type="button" className="delivery-next delivery-edit" onClick={copyConfiguration}>Share configuration</button>
            </div>
            {copyStatus && <p className="layout-help" role="status">{copyStatus}</p>}
            {shareStatus && <p className="layout-help" role="status">{shareStatus}</p>}
            {shareLink && <label className="delivery-field">Configuration link<input readOnly value={shareLink} onFocus={(event) => event.target.select()} /></label>}
          </section>
        </aside>
      </div>
      {deliveryAvailable && <dialog className="delivery-dialog" ref={deliveryDialog} aria-labelledby="delivery-heading">
        <button type="button" className="delivery-close" onClick={() => deliveryDialog.current?.close()}>Close</button>
        <DeliveryDetails rackTotal={price.total} racks={racks} timezone={settings.timezone} revision={revision}
          depositPolicy={settings.deposit} initialZip={quoteZip}
          schedulingAvailable={consultAvailable} onRequestOrder={(zip) => {
            setQuoteZip(zip);
            deliveryDialog.current?.close();
          }} />
      </dialog>}
      {consultAvailable && <OrderRequest racks={racks} subtotal={price.total} revision={revision} deliveryZip={quoteZip} settings={settings}
        onDeliveryEstimate={deliveryAvailable ? (zip) => {
          setQuoteZip(zip);
          openDelivery();
        } : undefined} />}
      <CustomerReviews reviews={reviews} />
      <section className="store-section storefront-photos" aria-labelledby="storefront-photos-heading">
        <div className="store-section-heading"><h2 id="storefront-photos-heading">Real rack builds</h2></div>
        <div className="photo-grid">
          {[rackPhotos[0], rackPhotos[2], rackPhotos[4]].map((photo) => <figure className="photo-card" key={photo.slug}>
            <a href="/rack-builds/" aria-label={`See rack photos including ${photo.title.toLowerCase()}`}>
              <img {...rackPhotoSource(photo)} alt={photo.alt} loading="lazy" sizes="(max-width: 580px) 100vw, 33vw" />
            </a>
            <figcaption>{photo.title}</figcaption>
          </figure>)}
        </div>
        <a href="/rack-builds/" className="text-link">See all rack photos and options</a>
      </section>
      {consultAvailable && <StorefrontDetails racks={racks} />}
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

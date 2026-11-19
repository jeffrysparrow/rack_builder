import { Component, lazy, Suspense, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { DeliveryDetails } from './DeliveryDetails';
import { calculateRack, defaultConfiguration, finishes, getRackToteType, MAX_RACK_SIZE } from '../config/rack';
import type { RackConfiguration } from '../config/rack';
import { estimatePrice, rackRates } from '../config/pricing';
import { deliveryToteBrand, isToteType, toteProfiles } from '../config/totes';

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

function Stepper({ label, value, minimum, onChange }: {
  label: string; value: number; minimum: number; onChange: (delta: number) => void;
}) {
  return <div className="stepper-field">
    <span className="field-label">{label}</span>
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" disabled={value <= minimum} aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(-1)}>−</button>
      <output aria-label={label}>{value}</output>
      <button type="button" disabled={value >= MAX_RACK_SIZE} aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(1)}>+</button>
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
const eighthFractions = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];

function formatCutLength(inches: number) {
  const eighths = Math.round(inches * 8);
  const whole = Math.floor(eighths / 8);
  return [whole || '', eighthFractions[eighths % 8]].filter(Boolean).join(' ') || '0';
}

export function Configurator() {
  const [config, setConfig] = useState(defaultConfiguration);
  const [spin, setSpin] = useState(false);
  const [reset, setReset] = useState(0);
  const layout = useMemo(() => calculateRack(config), [config]);
  const price = estimatePrice(config);
  const capacity = config.columns * config.rows;
  const update = <Key extends keyof RackConfiguration>(key: Key, value: RackConfiguration[Key]) => {
    setConfig((current) => ({ ...current, [key]: value }));
  };
  const changeLayout = (axis: 'columns' | 'rows', delta: number) => {
    setConfig((current) => {
      const size = Math.max(minimumRackSize[axis], Math.min(MAX_RACK_SIZE, current[axis] + delta));
      return { ...current, [axis]: size };
    });
  };

  return <>
    <header className="site-header">
      <div className="identity"><span className="brand-icon"><Icon name="rack" /></span><span>Rack Builder</span></div>
      <span className="header-label">Garage storage configurator</span>
    </header>
    <main className="workspace">
      <div className="page-intro">
        <div className="intro-copy">
          <h1>Wooden tote rack</h1>
          <p>Set your layout, customize the rack, and inspect it in 3D.</p>
        </div>
        <div className="delivery-banner">
          <span className="delivery-icon"><Icon name="delivery" /></span>
          <span><strong>Free local delivery</strong><span>First 15 road miles free, then $2 per extra mile</span></span>
        </div>
      </div>
      <div className="builder">
        <section className="viewer" aria-label="Interactive rack preview">
          <div className="studio">
            <ViewerBoundary><Suspense fallback={<p className="viewer-error">Loading 3D preview…</p>}>
              <Studio layout={layout} spin={spin} reset={reset} />
            </Suspense></ViewerBoundary>
          </div>
          <div className="viewer-heading">
            <span className="viewer-label">3D preview</span>
            <span className="viewer-size">{config.columns} × {config.rows} rack</span>
          </div>
          <div className="viewer-footer">
            <span className="viewer-help"><Icon name="mouse" /><span className="desktop-help">Drag to rotate · Scroll to zoom</span><span className="touch-help">Drag to rotate · Pinch to zoom</span></span>
            <div className="viewer-actions">
              <button className="viewer-button" type="button" aria-label="Auto-rotate" aria-pressed={spin} title="Auto-rotate"
                onClick={() => setSpin((active) => !active)}><Icon name="orbit" /><span>Auto-rotate</span></button>
              <button className="viewer-button" type="button" aria-label="Reset camera" title="Reset camera"
                onClick={() => { setSpin(false); setReset((current) => current + 1); }}><Icon name="reset" /><span>Reset view</span></button>
            </div>
          </div>
        </section>
        <aside className="settings" aria-label="Rack configuration">
          <section className="setting-section">
            <div className="section-heading"><h2>Rack layout</h2><span className="capacity">{capacity} tote {capacity === 1 ? 'space' : 'spaces'}</span></div>
            <div className="stepper-grid">
              <Stepper label="Columns" value={config.columns} minimum={minimumRackSize.columns} onChange={(delta) => changeLayout('columns', delta)} />
              <Stepper label="Rows" value={config.rows} minimum={minimumRackSize.rows} onChange={(delta) => changeLayout('rows', delta)} />
            </div>
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
                : 'Choose the 27-gallon tote brand you plan to use so we can size your rack.'}
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
            <Toggle label="Swivel casters" description={`${layout.casterCount} wheels · ${dollars.format(rackRates.caster)} each`}
              checked={config.includeCasters} onChange={(value) => update('includeCasters', value)} />
            <Toggle label="Add totes with delivery" description={`${capacity} ${deliveryToteBrand} totes · ${dollars.format(rackRates.tote)} each`}
              checked={config.includeTotesWithDelivery} onChange={(value) => update('includeTotesWithDelivery', value)} />
          </section>
          <section className="setting-section dimensions">
            <h2>Overall rack size</h2>
            <dl className="dimension-grid" aria-live="polite">
              <div><dt>Width</dt><dd>{Math.ceil(layout.cuts.width)}<small> in</small></dd></div>
              <div><dt>Height</dt><dd>{Math.ceil(layout.cuts.height)}<small> in</small></dd></div>
              <div><dt>Depth</dt><dd>{Math.ceil(layout.cuts.depth)}<small> in</small></dd></div>
            </dl>
            <p className="layout-help">Rounded up to whole inches. Depth includes 1 in for rear bracing.</p>
          </section>
          <section className="setting-section pricing" aria-labelledby="pricing-heading">
            <h2 id="pricing-heading">Price breakdown</h2>
            <dl className="price-lines">
              <div><dt>Rack frame · {capacity} {capacity === 1 ? 'slot' : 'slots'}</dt><dd>{dollars.format(price.frame)}</dd></div>
              {price.top > 0 && <div><dt>Top panel</dt><dd>{dollars.format(price.top)}</dd></div>}
              {price.wheelQuantity > 0 && <div><dt>Casters · {price.wheelQuantity}</dt><dd>{dollars.format(price.wheels)}</dd></div>}
              {price.toteQuantity > 0 && <div><dt>Storage totes · {price.toteQuantity}</dt><dd>{dollars.format(price.totes)}</dd></div>}
              <div className="price-total"><dt>Rack &amp; accessories total</dt><dd aria-live="polite">{dollars.format(price.total)}</dd></div>
            </dl>
            <a className="delivery-next" href="#delivery-details">Continue to delivery</a>
          </section>
        </aside>
      </div>
      <DeliveryDetails rackTotal={price.total} />
      <section className="settings cut-list" aria-labelledby="cut-list-heading">
        <h2 id="cut-list-heading">2×4 cut list</h2>
        <table aria-labelledby="cut-list-heading">
          <thead><tr><th scope="col">Part</th><th scope="col">Quantity</th><th scope="col">Cut length</th></tr></thead>
          <tbody>
            {layout.cuts.pieces.map(({ name, quantity, length }) => (
              <tr key={name}><th scope="row">{name}</th><td>{quantity}</td><td>{formatCutLength(length)} in</td></tr>
            ))}
          </tbody>
        </table>
        <p className="layout-help">Top panel and rear bracing cuts are pending.</p>
      </section>
    </main>
  </>;
}

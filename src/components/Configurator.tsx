import { Component, lazy, Suspense, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { calculateRack, defaultConfiguration, finishes, estimatePrice, MAX_RACK_SIZE } from '../config/rack';
import type { RackConfiguration } from '../config/rack';
import { isToteType, toteProfiles } from '../config/totes';

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

function Icon({ name }: { name: 'rack' | 'orbit' | 'reset' | 'mouse' }) {
  const lines: Record<typeof name, ReactNode> = {
    rack: <><rect x="3" y="3" width="18" height="17" rx="1.5" /><path d="M3 9h18M3 14h18M9 3v17m6-17v17M6 20v2m12-2v2" /></>,
    orbit: <><ellipse cx="12" cy="12" rx="10" ry="4" transform="rotate(-30 12 12)" /><ellipse cx="12" cy="12" rx="4" ry="10" transform="rotate(-30 12 12)" /></>,
    reset: <><path d="M3 11a9 9 0 1 1 2.4 7M3 5v6h6" /></>,
    mouse: <><rect x="6.5" y="3" width="11" height="18" rx="5.5" /><path d="M12 7v4" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">{lines[name]}</svg>;
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (delta: number) => void }) {
  return <div className="stepper-field">
    <span className="field-label">{label}</span>
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" disabled={value === 1} aria-label={`Fewer ${label.toLowerCase()}`} onClick={() => onChange(-1)}>−</button>
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
      const size = Math.max(1, Math.min(MAX_RACK_SIZE, current[axis] + delta));
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
        <h1>Wooden tote rack</h1>
        <p>Set your layout, customize the rack, and inspect it in 3D.</p>
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
              <Stepper label="Columns" value={config.columns} onChange={(delta) => changeLayout('columns', delta)} />
              <Stepper label="Rows" value={config.rows} onChange={(delta) => changeLayout('rows', delta)} />
            </div>
            <p className="layout-help">Up to {MAX_RACK_SIZE} columns and {MAX_RACK_SIZE} rows per rack. For more width, place separate racks side by side on the floor.</p>
          </section>
          <section className="setting-section">
            <label className="tote-field" htmlFor="tote-brand">Tote brand</label>
            <select className="tote-select" id="tote-brand" value={config.binType} aria-describedby="tote-fit-help"
              onChange={(event) => {
                const value = event.currentTarget.value;
                if (isToteType(value)) update('binType', value);
              }}>
              {Object.entries(toteProfiles).map(([id, profile]) => <option key={id} value={id}>{profile.label}</option>)}
            </select>
            <p className="layout-help" id="tote-fit-help">27-gallon tote. The selected brand sets the bay width and rung length.</p>
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
            <Toggle label="Storage totes" description="Show totes in the 3D preview" checked={config.includeBins}
              onChange={(value) => update('includeBins', value)} />
            <Toggle label="Swivel casters" description={`${layout.casterCount} orange wheels with brakes`} checked={config.includeCasters}
              onChange={(value) => update('includeCasters', value)} />
          </section>
          <section className="setting-section dimensions">
            <h2>Overall rack size</h2>
            <dl className="dimension-grid" aria-live="polite">
              <div><dt>Width</dt><dd>{Math.ceil(layout.cuts.width)}<small> in</small></dd></div>
              <div><dt>Height</dt><dd>{Math.ceil(layout.cuts.height)}<small> in</small></dd></div>
              <div><dt>Depth</dt><dd>{Math.ceil(layout.cuts.depth)}<small> in</small></dd></div>
            </dl>
            <p className="layout-help">Rounded up to whole inches. Depth includes 1 in for rear bracing. Height is measured to the top crossboards.</p>
            {price !== null && <p>Estimated price {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)}</p>}
          </section>
        </aside>
      </div>
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

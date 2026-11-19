import { Component, lazy, Suspense, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { calculateRack, defaultConfiguration, finishes, estimatePrice } from '../config/rack';
import type { RackConfiguration } from '../config/rack';

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
      <button type="button" disabled={value === 6} aria-label={`More ${label.toLowerCase()}`} onClick={() => onChange(1)}>+</button>
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

function inches(meters: number) { return (meters / .0254).toFixed(1); }

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
      const size = Math.max(1, Math.min(6, current[axis] + delta));
      if (axis === 'rows') return { ...current, rows: size };
      return { ...current, columns: size, casterCount: size <= 2 ? 4 : size <= 4 ? 6 : 8 };
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
        <p>Set your layout, choose a top, and inspect your rack in 3D.</p>
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
          </section>
          <section className="setting-section">
            <fieldset>
              <legend>Top material</legend>
              <div className="finish-list">
                {finishes.map((finish) => <label className="finish-option" key={finish.id}>
                  <span className={`swatch ${finish.id}`} style={{ backgroundColor: finish.color }} />
                  <span><span className="option-title">{finish.label}</span><span className="option-detail">{finish.detail}</span></span>
                  <input type="radio" name="top-material" checked={config.topMaterial === finish.id}
                    onChange={() => update('topMaterial', finish.id)} />
                </label>)}
              </div>
            </fieldset>
          </section>
          <section className="setting-section accessories">
            <h2>Accessories</h2>
            <Toggle label="Storage totes" description="Black 27-gallon totes with yellow lids" checked={config.includeBins}
              onChange={(value) => update('includeBins', value)} />
            <Toggle label="Swivel casters" description={`${config.casterCount} orange wheels with brakes`} checked={config.includeCasters}
              onChange={(value) => update('includeCasters', value)} />
          </section>
          <section className="setting-section dimensions">
            <h2>Estimated overall size</h2>
            <dl className="dimension-grid" aria-live="polite">
              <div><dt>Width</dt><dd>{inches(layout.width)}<small> in</small></dd></div>
              <div><dt>Height</dt><dd>{inches(layout.height)}<small> in</small></dd></div>
              <div><dt>Depth</dt><dd>{inches(layout.depth)}<small> in</small></dd></div>
            </dl>
            {price !== null && <p>Estimated price {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(price)}</p>}
          </section>
        </aside>
      </div>
    </main>
  </>;
}

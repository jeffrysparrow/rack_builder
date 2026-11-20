import { discoverySources } from '../config/attribution';

export function DiscoveryField() {
  return <label className="delivery-field">How did you first hear about us? <small>(optional)</small>
    <select name="discovery" defaultValue="">
      <option value="">Select a source</option>
      {Object.entries(discoverySources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </label>;
}

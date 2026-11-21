import { discoverySources } from '../config/attribution';

export function DiscoveryField({ defaultValue = '' }: { defaultValue?: string }) {
  return <label className="delivery-field">How did you find us? <small>(optional)</small>
    <select name="discovery" defaultValue={defaultValue}>
      <option value="">Choose an option</option>
      {Object.entries(discoverySources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </label>;
}

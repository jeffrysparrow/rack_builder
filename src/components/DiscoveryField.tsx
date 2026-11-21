import { discoverySources } from '../config/attribution';

export function DiscoveryField({ shopName, defaultValue = '' }: { shopName: string; defaultValue?: string }) {
  return <label className="delivery-field">How did you hear about {shopName}? <small>(optional)</small>
    <select name="discovery" defaultValue={defaultValue}>
      <option value="">Choose an option</option>
      {Object.entries(discoverySources).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
  </label>;
}

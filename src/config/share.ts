import { finishes } from './rack';
import type { BuildRules, RackConfiguration } from './rack';
import { MAX_ORDER_RACKS } from './shop';
import { isToteType } from './totes';

const version = '1';

export function shareConfiguration(origin: string, racks: RackConfiguration[]) {
  const url = new URL('/', origin);
  const entries = racks.map(({ columns, rows, binType, topMaterial, includeBins, includeTotesWithDelivery, includeCasters }) => {
    const options = Number(includeBins) | (Number(includeTotesWithDelivery) << 1) | (Number(includeCasters) << 2);
    return [columns, rows, binType, topMaterial, options].join(',');
  });
  url.searchParams.set('cfg', [version, ...entries].join('.'));
  return url.href;
}

export function sharedConfiguration(query: string, build: BuildRules) {
  const value = new URLSearchParams(query).get('cfg');
  const racks: RackConfiguration[] = [];
  if (value === null) return { racks, changed: false };
  if (value.length > 1600) return { racks, changed: true };
  const [format, ...entries] = value.split('.');
  if (format !== version) return { racks, changed: true };
  let changed = !entries.length || entries.length > MAX_ORDER_RACKS;

  for (const entry of entries.slice(0, MAX_ORDER_RACKS)) {
    const [rawColumns, rawRows, binType, top, flags, ...rest] = entry.split(',');
    const material = finishes.find(({ id }) => id === top);
    if (rest.length || !/^[2-5]$/.test(rawColumns ?? '') || !/^[1-5]$/.test(rawRows ?? '') || !/^[0-7]$/.test(flags ?? '')
      || !binType || !isToteType(binType) || !material) {
      changed = true;
      continue;
    }
    const columns = Math.min(Number(rawColumns), build.maxColumns);
    const rows = Math.min(Number(rawRows), build.maxRows);
    if (columns !== Number(rawColumns) || rows !== Number(rawRows)) changed = true;
    const options = Number(flags);
    racks.push({ columns, rows, binType, topMaterial: material.id,
      includeBins: !!(options & 1), includeTotesWithDelivery: !!(options & 2), includeCasters: !!(options & 4) });
  }
  return { racks, changed };
}

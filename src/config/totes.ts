import measurements from './measurements.json';

const inch = .0254;
const hdx = measurements.tote;
const wider = {
  ...hdx,
  width: hdx.width + .75 * inch,
  depth: hdx.depth + inch,
};

export const toteProfiles = {
  'greenmade-27': { label: 'Greenmade (Costco)', dimensions: wider },
  'hdx-27': { label: 'HDX (Home Depot)', dimensions: hdx },
  'project-source-27': { label: 'Project Source (Lowe’s)', dimensions: wider },
  'hyper-tough-27': { label: 'Hyper Tough (Walmart)', dimensions: wider },
  'sterilite-27': { label: 'Sterilite', dimensions: hdx },
  'members-mark-27': {
    label: 'Member’s Mark (Sam’s Club)',
    dimensions: {
      width: 20.6 * inch,
      depth: 30.6 * inch,
      height: 14.3 * inch,
      railBelowTop: hdx.railBelowTop * (14.3 * inch / hdx.height),
    },
  },
};

export type ToteType = keyof typeof toteProfiles;

export function isToteType(value: string): value is ToteType {
  return Object.hasOwn(toteProfiles, value);
}

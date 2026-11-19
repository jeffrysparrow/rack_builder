import measurements from './measurements.json';
import { toteProfiles } from './totes';
import type { ToteType } from './totes';

export const MAX_RACK_SIZE = 5;

export type TopMaterial = 'mdf' | 'standard-plywood' | 'premium-plywood';
export interface RackConfiguration {
  columns: number;
  rows: number;
  binType: ToteType;
  includeBins: boolean;
  includeCasters: boolean;
  topMaterial: TopMaterial;
}

export const defaultConfiguration: RackConfiguration = {
  columns: 4, rows: 4, binType: 'hdx-27', includeBins: true,
  includeCasters: true, topMaterial: 'standard-plywood',
};

export const finishes: { id: TopMaterial; label: string; color: string; detail: string }[] = [
  { id: 'standard-plywood', label: 'Standard plywood', color: '#ceb187', detail: '19/32 in pine plywood · bold grain' },
  { id: 'premium-plywood', label: 'Premium plywood', color: '#e2d6bf', detail: '23/32 in cabinet-grade plywood' },
  { id: 'mdf', label: 'MDF', color: '#a57e55', detail: 'Smooth face · uniform edge' },
];

export type Point = [number, number, number];
type Axis = 0 | 1 | 2;
export interface BoardSpec {
  id: string;
  position: Point;
  size: Point;
  grain: Axis;
  material: TopMaterial | 'lumber';
}
export interface PartPlacement { id: string; position: Point; yaw?: number }

const INCH = .0254;
const uprightLengths = [16.5, 32, 47.5, 63, 79];
const boardThickness = 1.5;
const casterLift = 5.5;

export function calculateCutList({ columns, rows, binType, includeCasters }: RackConfiguration) {
  const narrow = binType === 'hdx-27' || binType === 'sterilite-27';
  const bayWidth = narrow ? 20.25 : 21;
  const rungLength = narrow ? 29 : 30;
  const uprightLength = uprightLengths[rows - 1];
  const widthAllowance = columns === 5 ? 3 / 8 : columns >= 3 ? 1 / 4 : 0;
  const width = columns * bayWidth + (columns + 1) * boardThickness + widthAllowance;
  const lift = includeCasters ? casterLift : 0;

  return {
    rungLength, uprightLength, width, lift,
    height: uprightLength + 2 * boardThickness + lift,
    depth: rungLength + 1,
    pieces: [
      { name: 'Uprights', quantity: 2 * (columns + 1), length: uprightLength },
      { name: 'Rungs', quantity: 2 * columns * rows, length: rungLength },
      { name: 'Top and bottom crossboards', quantity: 4, length: width },
    ],
  };
}

export function calculateRack(config: RackConfiguration) {
  const cuts = calculateCutList(config);
  const { tote: referenceTote, caster, lumber } = measurements;
  const tote = toteProfiles[config.binType].dimensions;
  const toteScale: Point = [
    tote.width / referenceTote.width, tote.height / referenceTote.height, tote.depth / referenceTote.depth,
  ];
  const casterScale: Point = [1, casterLift * INCH / caster.height, 1];
  const { face, topThickness } = lumber;
  const thickness = boardThickness * INCH;
  const width = cuts.width * INCH;
  const pitch = (width - thickness) / config.columns;
  const opening = pitch - thickness;
  const lift = cuts.lift * INCH;
  const casterCount = config.columns >= 4 ? 6 : 4;
  const uprightHeight = cuts.uprightLength * INCH;
  const rowPitch = uprightHeight / config.rows;
  const topY = cuts.height * INCH;
  const frameDepth = cuts.rungLength * INCH;
  const postZ = (frameDepth - face) / 2;
  const boards: BoardSpec[] = [];
  const bins: PartPlacement[] = [];
  const casters: PartPlacement[] = [];
  const add = (id: string, position: Point, size: Point, grain: Axis, material: BoardSpec['material'] = 'lumber') =>
    boards.push({ id, position, size, grain, material });
  const postX = (index: number) => (index - config.columns / 2) * pitch;

  for (const side of [-1, 1]) {
    add('base-' + side, [0, lift + thickness / 2, side * postZ], [width, thickness, face], 0);
    add('header-' + side, [0, topY - thickness / 2, side * postZ], [width, thickness, face], 0);
    for (let divider = 0; divider <= config.columns; divider++) {
      add(`post-${divider}-${side}`, [postX(divider), lift + thickness + uprightHeight / 2, side * postZ],
        [thickness, uprightHeight, face], 1);
    }
  }

  for (let col = 0; col < config.columns; col++) {
    const x = postX(col) + pitch / 2;
    for (let row = 0; row < config.rows; row++) {
      const y = lift + thickness + (rowPitch - tote.height) / 2 + row * rowPitch;
      if (config.includeBins) bins.push({ id: `bin-${col}-${row}`, position: [x, y, 0] });
      for (const side of [-1, 1]) {
        add(`rail-${col}-${row}-${side}`,
          [x + side * (opening - thickness) / 2, y + tote.height - tote.railBelowTop - face / 2, 0],
          [thickness, face, frameDepth], 2);
      }
    }
  }

  if (config.includeCasters) {
    const inset = 0.078;
    const pairs = casterCount / 2;
    for (let pair = 0; pair < pairs; pair++) {
      const x = (pair / (pairs - 1) - 0.5) * (width - 2 * inset);
      for (const side of [-1, 1]) {
        casters.push({ id: `caster-${pair}-${side}`, position: [x, 0, side * postZ], yaw: side === 1 ? -0.22 : Math.PI - 0.22 });
      }
    }
  }

  add('top', [0, topY + topThickness / 2, 0], [width, topThickness, frameDepth], 0, config.topMaterial);

  return { boards, bins, casters, casterCount, casterScale, toteScale, cuts,
    width, height: topY + topThickness, depth: frameDepth };
}

export function estimatePrice(_configuration: RackConfiguration): number | null {
  return null;
}

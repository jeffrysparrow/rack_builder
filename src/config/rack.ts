import measurements from './measurements.json';

export type TopMaterial = 'mdf' | 'standard-plywood' | 'premium-plywood';
export interface RackConfiguration {
  columns: number;
  rows: number;
  binType: 'hdx-27';
  includeBins: boolean;
  includeCasters: boolean;
  casterCount: number;
  topMaterial: TopMaterial;
}

export const defaultConfiguration: RackConfiguration = {
  columns: 4, rows: 4, binType: 'hdx-27', includeBins: true,
  includeCasters: true, casterCount: 6, topMaterial: 'standard-plywood',
};

export const finishes: { id: TopMaterial; label: string; color: string; detail: string }[] = [
  { id: 'standard-plywood', label: 'Standard plywood', color: '#cfa570', detail: 'Natural grain · layered edge' },
  { id: 'premium-plywood', label: 'Premium plywood', color: '#e7c696', detail: 'Clean veneer · layered edge' },
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

export function calculateRack(config: RackConfiguration) {
  const { tote, caster, lumber, fit } = measurements;
  const { thickness, face, topThickness } = lumber;
  const opening = tote.width + 2 * fit.sideClearance;
  const pitch = opening + thickness;
  const rowPitch = tote.height + fit.verticalClearance;
  const width = config.columns * pitch + thickness;
  const lift = config.includeCasters ? caster.height : 0;
  const uprightHeight = config.rows * rowPitch;
  const topY = lift + 2 * thickness + uprightHeight;
  const postZ = (fit.depth - face) / 2;
  const frontOffset = (tote.depth - fit.depth) / 2 + 0.006;
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
      const y = lift + thickness + fit.verticalClearance / 2 + row * rowPitch;
      if (config.includeBins) bins.push({ id: `bin-${col}-${row}`, position: [x, y, frontOffset] });
      for (const side of [-1, 1]) {
        add(`rail-${col}-${row}-${side}`,
          [x + side * (opening - thickness) / 2, y + tote.height - tote.railBelowTop - face / 2, 0],
          [thickness, face, fit.depth - 0.018], 2);
      }
    }
  }

  for (const side of [-1, 1]) {
    add('base-return-' + side, [side * (width - face) / 2, lift + thickness / 2, 0],
      [face, thickness, fit.depth - 2 * face], 2);
  }

  if (config.includeCasters) {
    const inset = 0.078;
    const pairs = Math.max(2, Math.min(5, Math.round(config.casterCount / 2)));
    for (let pair = 0; pair < pairs; pair++) {
      const x = (pair / (pairs - 1) - 0.5) * (width - 2 * inset);
      for (const side of [-1, 1]) {
        casters.push({ id: `caster-${pair}-${side}`, position: [x, 0, side * postZ], yaw: side === 1 ? -0.22 : Math.PI - 0.22 });
      }
    }
  }

  const topWidth = width + 2 * fit.topOverhang;
  const topDepth = fit.depth + 2 * fit.topOverhang;
  const height = topY + topThickness;
  const maxZ = Math.max(topDepth / 2, config.includeBins ? frontOffset + tote.depth / 2 : 0,
    config.includeCasters ? postZ + 0.070 : 0);
  const minZ = Math.min(-topDepth / 2, config.includeBins ? frontOffset - tote.depth / 2 : 0,
    config.includeCasters ? -postZ - 0.070 : 0);
  add('top', [0, topY + topThickness / 2, 0], [topWidth, topThickness, topDepth], 0, config.topMaterial);

  return { boards, bins, casters, width: topWidth, height, depth: maxZ - minZ, centerZ: (maxZ + minZ) / 2,
    sideClearance: fit.sideClearance };
}

export function estimatePrice(_configuration: RackConfiguration): number | null {
  return null;
}

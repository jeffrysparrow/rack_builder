import measurements from './measurements.json';
import { deliveryToteType, toteProfiles } from './totes';
import type { ToteType } from './totes';

export const MAX_RACK_SIZE = 5;

export type TopMaterial = 'mdf' | 'standard-plywood' | 'premium-plywood';
export interface RackConfiguration {
  columns: number;
  rows: number;
  binType: ToteType;
  includeBins: boolean;
  includeTotesWithDelivery: boolean;
  includeCasters: boolean;
  topMaterial: TopMaterial | 'none';
}

export const defaultConfiguration: RackConfiguration = {
  columns: 4, rows: 4, binType: deliveryToteType, includeBins: true,
  includeCasters: true, includeTotesWithDelivery: false, topMaterial: 'standard-plywood',
};

export const finishes: { id: RackConfiguration['topMaterial']; label: string; color: string; detail?: string }[] = [
  { id: 'standard-plywood', label: 'Standard plywood', color: '#ceb187', detail: '19/32 in pine plywood · bold grain' },
  { id: 'premium-plywood', label: 'Premium plywood', color: '#e2d6bf', detail: '23/32 in cabinet-grade plywood' },
  { id: 'mdf', label: 'MDF', color: '#a57e55', detail: 'Smooth face · uniform edge' },
  { id: 'none', label: 'No top panel', color: 'transparent' },
];

export type Point = [number, number, number];
type Axis = 0 | 1 | 2;
export interface BoardSpec {
  id: string;
  position: Point;
  size: Point;
  grain: Axis;
  material: TopMaterial | 'lumber';
  panelFace?: 1 | 2;
  rotationZ?: number;
  mitered?: boolean;
}
export interface PartPlacement { id: string; position: Point; yaw?: number }

const INCH = .0254;
export const defaultBuildRules = {
  maxColumns: MAX_RACK_SIZE,
  maxRows: MAX_RACK_SIZE,
  narrowBay: 20.25,
  wideBay: 21,
  narrowRung: 29,
  wideRung: 30,
  uprights: [16.5, 32, 47.5, 63, 79],
  casterLift: 5.5,
  sixWheelColumns: 4,
};
export type BuildRules = typeof defaultBuildRules;

const boardThickness = 1.5;

export function getRackToteType(config: RackConfiguration): ToteType {
  return config.includeTotesWithDelivery ? deliveryToteType : config.binType;
}

const eighthFractions = ['', '1/8', '1/4', '3/8', '1/2', '5/8', '3/4', '7/8'];

export function formatCutLength(inches: number) {
  const eighths = Math.round(inches * 8);
  const whole = Math.floor(eighths / 8);
  return [whole || '', eighthFractions[eighths % 8]].filter(Boolean).join(' ') || '0';
}

export function calculateCutList(config: RackConfiguration, rules = defaultBuildRules) {
  const { columns, rows, includeCasters } = config;
  const binType = getRackToteType(config);
  const narrow = binType === 'hdx-27' || binType === 'sterilite-27';
  const bayWidth = narrow ? rules.narrowBay : rules.wideBay;
  const rungLength = narrow ? rules.narrowRung : rules.wideRung;
  const uprightLength = rules.uprights[rows - 1];
  const widthAllowance = columns === 5 ? 3 / 8 : columns >= 3 ? 1 / 4 : 0;
  const width = columns * bayWidth + (columns + 1) * boardThickness + widthAllowance;
  const lift = includeCasters ? rules.casterLift : 0;
  const frameHeight = uprightLength + 2 * boardThickness + lift;
  const panelHeight = config.topMaterial === 'none' ? 0 : measurements.lumber.topThickness / INCH;

  return {
    rungLength, uprightLength, width, lift, frameHeight,
    height: frameHeight + panelHeight,
    depth: rungLength + 1,
    pieces: [
      { name: 'Uprights', quantity: 2 * (columns + 1), length: uprightLength },
      { name: 'Rungs', quantity: 2 * columns * rows, length: rungLength },
      { name: 'Top and bottom crossboards', quantity: 4, length: width },
    ],
  };
}

export function getCasterCount(columns: number, rules = defaultBuildRules) {
  return columns >= rules.sixWheelColumns ? 6 : 4;
}

export function calculateRack(config: RackConfiguration, rules = defaultBuildRules) {
  const cuts = calculateCutList(config, rules);
  const { tote: referenceTote, caster, lumber } = measurements;
  const tote = toteProfiles[getRackToteType(config)].dimensions;
  const toteScale: Point = [
    tote.width / referenceTote.width, tote.height / referenceTote.height, tote.depth / referenceTote.depth,
  ];
  const casterScale: Point = [1, rules.casterLift * INCH / caster.height, 1];
  const { face, topThickness } = lumber;
  const thickness = boardThickness * INCH;
  const width = cuts.width * INCH;
  const pitch = (width - thickness) / config.columns;
  const opening = pitch - thickness;
  const lift = cuts.lift * INCH;
  const casterCount = getCasterCount(config.columns, rules);
  const uprightHeight = cuts.uprightLength * INCH;
  const rowPitch = uprightHeight / config.rows;
  const topY = cuts.frameHeight * INCH;
  const frameDepth = cuts.rungLength * INCH;
  const postZ = (frameDepth - face) / 2;
  const rearFace = -frameDepth / 2;
  const topMaterial = config.topMaterial;
  const fiveWide = config.columns === 5;
  const plywoodBracing = !fiveWide && (topMaterial === 'standard-plywood' || topMaterial === 'premium-plywood');
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

  if (topMaterial !== 'none') {
    boards.push({ id: 'top', position: [0, topY + topThickness / 2, 0],
      size: [width, topThickness, frameDepth], grain: 0, material: topMaterial, panelFace: 1 });
  }

  // Brace placement follows the supplied examples. The brace cut sizes are still to be confirmed.
  if (plywoodBracing) {
    const stripHeight = 7 * INCH;
    const z = rearFace - topThickness / 2;
    for (const [id, y] of [['rear-ply-upper', topY - stripHeight / 2],
      ['rear-ply-lower', lift + stripHeight / 2]] as const) {
      boards.push({ id, position: [0, y, z], size: [width, stripHeight, topThickness],
        grain: 0, material: topMaterial, panelFace: 2 });
    }
  } else {
    const baseY = lift + thickness;
    const leg = 6 * INCH;
    const braceWidth = fiveWide ? 3 * pitch + thickness : width;
    const braceCount = fiveWide && config.rows >= 4 ? 2 : 1;
    for (let brace = 1; brace <= braceCount; brace++) {
      const y = baseY + uprightHeight * brace / (braceCount + 1);
      add(`rear-crossbrace-${brace}`, [0, y, rearFace - thickness / 2], [braceWidth, face, thickness], 0);
    }
    for (let bay = 0; bay < config.columns; bay++) {
      for (const side of [-1, 1]) {
        const upright = postX(side === -1 ? bay : bay + 1);
        boards.push({
          id: `rear-miter-${bay}-${side}`,
          position: [upright - side * (thickness + leg) / 2, baseY + leg / 2, rearFace + thickness / 2],
          size: [Math.SQRT2 * leg, face, thickness],
          rotationZ: side * Math.PI / 4, mitered: true, grain: 0, material: 'lumber',
        });
      }
    }
  }

  return { boards, bins, casters, casterCount, casterScale, toteScale, cuts, columns: config.columns,
    width, height: cuts.height * INCH,
    depth: frameDepth + (plywoodBracing ? topThickness : thickness) };
}

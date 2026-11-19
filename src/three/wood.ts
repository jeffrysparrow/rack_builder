import { CanvasTexture, Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import type { BoardSpec } from '../config/rack';

type Finish = BoardSpec['material'];
type Face = 'face' | 'edge' | 'end';
const palette: Record<Finish, [number, number, number]> = {
  lumber: [203, 166, 119],
  'standard-plywood': [214, 184, 144],
  'premium-plywood': [220, 205, 176],
  mdf: [160, 117, 78],
};

const tau = Math.PI * 2;
const sheetKnots = [
  { u: .17, v: .25, length: .061, width: .058, depth: 1 },
  { u: .47, v: .74, length: .093, width: .072, depth: .70 },
  { u: .68, v: .39, length: .052, width: .050, depth: .85 },
  { u: .89, v: .68, length: .072, width: .044, depth: .72 },
];

function plywoodFace(u: number, v: number, premium: boolean) {
  // Broad growth-ring figure and fine fibers run along the length of the panel.
  const drift = Math.sin(tau * (u + .35 * Math.sin(tau * v))) * .039
    + Math.cos(tau * (2 * u - v)) * .017;
  const figure = Math.cos(tau * (u * 2 + v * 3)) * .016;
  let grain = v + drift + figure;
  let defects = 0;
  if (!premium) {
    for (const knot of sheetKnots) {
      const wrap = (value: number) => value - Math.round(value);
      const x = wrap(u - knot.u) / knot.length;
      const y = wrap(v - knot.v) / knot.width;
      const radius = x * x + y * y;
      const influence = 1 / (1 + radius * radius);
      grain += .063 * y * influence * knot.depth;
      if (radius < 7) {
        const core = Math.exp(-radius * 10);
        const ring = Math.cos(Math.sqrt(radius) * 24 + x * .7) * Math.exp(-radius * 1.4);
        defects += (ring * 11 - core * 59) * knot.depth;
      }
    }
  }
  const latewood = Math.max(0, Math.sin(tau * (grain * 19 + .12 * Math.sin(tau * grain * 7)))) ** 3;
  const seasons = Math.sin(tau * grain * 9) + .45 * Math.cos(tau * grain * 13);
  const fibers = Math.sin(tau * (grain * 117 + .27 * Math.sin(tau * u * 3)));
  return premium ? (seasons * 4 + fibers * 1.4 - latewood * 5)
    : 5 + seasons * 9 + fibers * 2 - latewood * 20 + defects;
}

function plywoodEdge(u: number, v: number, premium: boolean) {
  const courses = premium ? 11 : 7;
  const waviness = premium ? .001 : .0045;
  const y = ((v + Math.sin(tau * (u * 3 + v)) * waviness) * courses);
  const ply = Math.floor(y);
  const inside = y - ply;
  const seam = Math.exp(-(Math.min(inside, 1 - inside) ** 2) * 130);
  const band = ply % 2 === 0 ? 1 : -1;
  const fibers = Math.sin(tau * (v * 66 + Math.sin(tau * u * 3) * .2));
  const gaps = premium ? 0 : Math.max(0, Math.cos(tau * (u * 5 + ply * .38)) - .952) * 790;
  return band * (premium ? 4 : 9) + fibers * 2 - seam * (premium ? 19 : 24) - gaps;
}

function texture(finish: Finish, face: Face) {
  const canvas = document.createElement('canvas');
  const plywood = finish === 'standard-plywood' || finish === 'premium-plywood';
  const veneer = plywood && face === 'face';
  const premium = finish === 'premium-plywood';
  canvas.width = veneer ? 768 : 512;
  canvas.height = veneer ? 384 : 256;
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.createImageData(canvas.width, canvas.height);
  const color = palette[finish];
  let randomState = 389;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const layered = face === 'edge' && plywood;
  for (let y = 0; y < canvas.height; y++) {
    const v = y / canvas.height;
    for (let x = 0; x < canvas.width; x++) {
      const u = x / canvas.width;
      const noise = random() - .5;
      let variation: number;
      if (finish === 'mdf') {
        variation = noise * 25;
      } else if (veneer) {
        variation = plywoodFace(u, v, premium) + noise * (premium ? 3 : 5);
      } else if (layered) {
        variation = plywoodEdge(u, v, premium) + noise * (premium ? 4 : 8);
      } else {
        const warp = .008 * Math.sin(tau * (u + 2 * v)) + .007 * Math.cos(tau * (2 * u - v));
        const knotDistance = Math.hypot((u - .62) * 2, (v - .44) * 7);
        const grain = v + warp + .031 * Math.exp(-knotDistance * knotDistance * 2);
        const lines = Math.sin(tau * grain * 38) * 3 + Math.sin(tau * grain * 91) * 2
          + Math.cos(tau * (u + v * 3)) * 3;
        const bands = Math.sin(tau * grain * 8) * 4 + Math.sin(tau * grain * 19) * 4;
        const knotCenter = 28 * Math.exp(-knotDistance * knotDistance * 115);
        const endGrain = 9 * Math.sin(tau * Math.hypot(u * .4 + .28, v * .2 + .18) * 48);
        variation = noise * 7 + (face === 'end' ? endGrain : lines + bands - knotCenter);
      }
      const index = (y * canvas.width + x) * 4;
      pixels.data[index] = color[0] + variation;
      pixels.data[index + 1] = color[1] + variation;
      pixels.data[index + 2] = color[2] + variation * .82;
      pixels.data[index + 3] = 255;
    }
  }
  ctx.putImageData(pixels, 0, 0);
  const map = new CanvasTexture(canvas);
  map.wrapS = map.wrapT = RepeatWrapping;
  // Cover a full panel depth before repeating the face figure.
  if (veneer) map.repeat.set(.67, .46);
  map.colorSpace = SRGBColorSpace;
  map.anisotropy = 8;
  return map;
}

const library = new Map<string, MeshStandardMaterial>();

export function woodMaterial(finish: Finish, face: Face) {
  const key = finish + face;
  let material = library.get(key);
  if (!material) {
    const map = texture(finish, face);
    material = new MeshStandardMaterial({
      color: new Color('#ffffff'), map, roughness: finish === 'mdf' ? .88 : finish === 'premium-plywood' ? .62 : .73,
      bumpMap: map, bumpScale: finish === 'mdf' || finish === 'premium-plywood' ? .00035 : .001,
    });
    library.set(key, material);
  }
  return material;
}

import { CanvasTexture, Color, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import type { BoardSpec } from '../config/rack';

type Finish = BoardSpec['material'];
type Face = 'face' | 'edge' | 'end';
const palette: Record<Finish, [number, number, number]> = {
  lumber: [203, 166, 119],
  'standard-plywood': [193, 150, 101],
  'premium-plywood': [222, 188, 139],
  mdf: [160, 117, 78],
};

function texture(finish: Finish, face: Face) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const pixels = ctx.createImageData(canvas.width, canvas.height);
  const color = palette[finish];
  let randomState = 389;
  const random = () => {
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    return randomState / 4294967296;
  };
  const layered = face === 'edge' && (finish === 'premium-plywood' || finish === 'standard-plywood');
  const tau = Math.PI * 2;
  for (let y = 0; y < canvas.height; y++) {
    const v = y / canvas.height;
    for (let x = 0; x < canvas.width; x++) {
      const u = x / canvas.width;
      const warp = .008 * Math.sin(tau * (u + 2 * v)) + .007 * Math.cos(tau * (2 * u - v));
      const knotDistance = Math.hypot((u - .62) * 2, (v - .44) * 7);
      const knot = finish === 'lumber' || finish === 'standard-plywood'
        ? .031 * Math.exp(-knotDistance * knotDistance * 2) : 0;
      const grain = v + warp + knot;
      const lines = Math.sin(tau * grain * 38) * 3 + Math.sin(tau * grain * 91) * 2
        + Math.cos(tau * (u + v * 3)) * 3;
      const bands = Math.sin(tau * grain * 8) * 4 + Math.sin(tau * grain * 19) * 4;
      const knotCenter = 28 * Math.exp(-knotDistance * knotDistance * 115);
      const endGrain = 9 * Math.sin(tau * Math.hypot(u * .4 + .28, v * .2 + .18) * 48);
      const ply = Math.sin(tau * v * 7) * 14 + Math.cos(tau * v * 14) * 4;
      const variation = finish === 'mdf' ? (random() - .5) * 25
        : (random() - .5) * 7 + (layered ? ply : face === 'end' ? endGrain : lines + bands - knotCenter);
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
      color: new Color('#ffffff'), map, roughness: finish === 'mdf' ? .88 : .73,
      bumpMap: map, bumpScale: finish === 'mdf' ? .00035 : .001,
    });
    library.set(key, material);
  }
  return material;
}

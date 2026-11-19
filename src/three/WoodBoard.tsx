import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, MeshStandardMaterial, Texture, Vector2 } from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { BoardSpec, Point } from '../config/rack';
import { woodMaterial } from './wood';

function boardGeometry(size: Point, grain: number, top: boolean, seed: number) {
  const geometry = new RoundedBoxGeometry(...size, 1, .0016);
  const pos = geometry.attributes.position;
  const uv = geometry.attributes.uv;
  // RoundedBoxGeometry groups follow +X, -X, +Y, -Y, +Z, -Z.
  const bySurface: number[][] = [[], [], []];
  for (const [index, group] of geometry.groups.entries()) {
    const axis = Math.floor(index / 2);
    const end = !top && axis === grain;
    const broad = top ? axis === 1 : !end;
    const u = end ? (axis + 1) % 3 : axis === grain ? 1 : grain;
    const v = [0, 1, 2].find((j) => j !== axis && j !== u) ?? 2;
    for (let vertex = group.start; vertex < group.start + group.count; vertex++) {
      uv.setXY(vertex,
        pos.getComponent(vertex, u) / (end ? .11 : 1.55) + seed,
        top && !broad ? pos.getY(vertex) / size[1] + .5
          : pos.getComponent(vertex, v) / (end ? .11 : .34) + seed * .61);
    }
    const surface = bySurface[end ? 2 : broad ? 0 : 1];
    for (let vertex = group.start; vertex < group.start + group.count; vertex++) surface.push(vertex);
  }
  geometry.setIndex(bySurface.flat());
  geometry.clearGroups();
  let start = 0;
  for (const [surface, range] of bySurface.entries()) {
    if (range.length) geometry.addGroup(start, range.length, surface);
    start += range.length;
  }
  return geometry;
}

function blendableWood() {
  return (['face', 'edge', 'end'] as const).map((face) => {
    const original = woodMaterial('standard-plywood', face);
    const material = original.clone();
    const nextMap = { value: original.map as Texture };
    const progress = { value: 0 };
    const nextUvScale = { value: new Vector2(1, 1) };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.nextWoodMap = nextMap;
      shader.uniforms.woodProgress = progress;
      shader.uniforms.nextWoodUvScale = nextUvScale;
      shader.fragmentShader = 'uniform sampler2D nextWoodMap; uniform float woodProgress; uniform vec2 nextWoodUvScale;\n'
        + shader.fragmentShader.replace('#include <map_fragment>',
          '#include <map_fragment>\nvec4 nextWood = texture2D(nextWoodMap, vMapUv * nextWoodUvScale);\ndiffuseColor.rgb = mix(diffuseColor.rgb, nextWood.rgb * diffuse, woodProgress);');
    };
    return { face, material, nextMap, progress, nextUvScale };
  });
}

export function WoodBoard({ spec }: { spec: BoardSpec }) {
  const { id, size, position, grain, material } = spec;
  const top = id === 'top';
  const [x, y, z] = size;
  const geometry = useMemo(() => {
    const seed = [...id].reduce((acc, char) => (Math.imul(acc, 31) + char.charCodeAt(0)) >>> 0, 0);
    return boardGeometry([x, y, z], grain, top, (seed % 193) / 193);
  }, [x, y, z, grain, top, id]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const blend = useMemo(() => top ? blendableWood() : undefined, [top]);
  const surfaces = useMemo(() => blend?.map(({ material }) => material)
    ?? (['face', 'edge', 'end'] as const).map((face) => woodMaterial('lumber', face)), [blend]);
  useEffect(() => () => blend?.forEach(({ material }) => material.dispose()), [blend]);
  useEffect(() => {
    blend?.forEach((entry) => {
      if (entry.progress.value > .5) entry.material.map = entry.nextMap.value;
      entry.progress.value = 0;
      entry.nextMap.value = woodMaterial(material, entry.face).map!;
      entry.nextUvScale.value.copy(entry.nextMap.value.repeat).divide(entry.material.map!.repeat);
    });
  }, [blend, material]);

  useFrame((_, dt) => {
    const damp = (a: number, b: number) => MathUtils.damp(a, b, 10, dt);
    blend?.forEach((entry) => {
      if (entry.progress.value === 1) return;
      entry.progress.value = Math.min(1, entry.progress.value + dt * 3);
      const next = woodMaterial(material, entry.face) as MeshStandardMaterial;
      entry.material.roughness = damp(entry.material.roughness, next.roughness);
      entry.material.bumpScale = damp(entry.material.bumpScale, next.bumpScale);
      if (entry.progress.value === 1) {
        entry.material.map = entry.nextMap.value;
        entry.nextUvScale.value.set(1, 1);
        entry.material.bumpMap = next.bumpMap;
        entry.material.bumpScale = next.bumpScale;
        entry.material.roughness = next.roughness;
      }
    });
  });

  return <mesh geometry={geometry} material={surfaces} position={position}
    castShadow receiveShadow dispose={null} />;
}

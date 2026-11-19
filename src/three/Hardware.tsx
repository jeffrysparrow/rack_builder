import { useLayoutEffect, useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { InstancedMesh, Matrix4, Mesh, Object3D } from 'three';
import { MAX_RACK_SIZE } from '../config/rack';
import type { PartPlacement, Point } from '../config/rack';

const assetPaths = {
  tote: import.meta.env.BASE_URL + 'models/tote.glb',
  caster: import.meta.env.BASE_URL + 'models/caster.glb',
};

function ModelInstances({ placements, asset, scale }: {
  placements: PartPlacement[];
  asset: keyof typeof assetPaths;
  scale: Point;
}) {
  const { scene } = useGLTF(assetPaths[asset]);
  const models = useMemo(() => {
    const meshes: Mesh[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((object) => {
      if (object instanceof Mesh) meshes.push(object);
    });
    return meshes;
  }, [scene]);
  const meshes = useRef<(InstancedMesh | null)[]>([]);
  const dummy = useMemo(() => new Object3D(), []);
  const matrix = useMemo(() => new Matrix4(), []);

  useLayoutEffect(() => {
    dummy.scale.set(...scale);
    placements.forEach(({ position, yaw }, index) => {
      dummy.position.set(...position);
      dummy.rotation.y = yaw ?? 0;
      dummy.updateMatrix();
      models.forEach((model, meshIndex) => {
        matrix.multiplyMatrices(dummy.matrix, model.matrixWorld);
        meshes.current[meshIndex]?.setMatrixAt(index, matrix);
      });
    });
    meshes.current.forEach((mesh) => {
      if (!mesh) return;
      mesh.count = placements.length;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }, [placements, models, dummy, matrix, scale]);

  return models.map((model, index) => <instancedMesh
    key={model.uuid} ref={(mesh) => { meshes.current[index] = mesh; }}
    args={[model.geometry, model.material, asset === 'tote' ? MAX_RACK_SIZE ** 2 : 10]}
    frustumCulled={false} castShadow receiveShadow dispose={null} />);
}

export function StorageBin(props: { placements: PartPlacement[]; scale: Point }) {
  return <ModelInstances {...props} asset="tote" />;
}

export function CasterWheel(props: { placements: PartPlacement[]; scale: Point }) {
  return <ModelInstances {...props} asset="caster" />;
}

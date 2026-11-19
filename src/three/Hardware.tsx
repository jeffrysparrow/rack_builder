import { useMemo, useRef } from 'react';
import { useGLTF } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { InstancedMesh, MathUtils, Matrix4, Mesh, Object3D, Vector3 } from 'three';
import type { PartPlacement } from '../config/rack';

const assetPaths = {
  tote: import.meta.env.BASE_URL + 'models/tote.glb',
  caster: import.meta.env.BASE_URL + 'models/caster.glb',
};

function ModelInstances({ placements, asset, animate }: {
  placements: PartPlacement[];
  asset: keyof typeof assetPaths;
  animate: boolean;
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
  const poses = useRef(new Map<string, { position: Vector3; scale: number }>());
  const dummy = useMemo(() => new Object3D(), []);
  const matrix = useMemo(() => new Matrix4(), []);

  useFrame((_, dt) => {
    const active = new Set<string>();
    placements.forEach(({ id, position, yaw }, index) => {
      active.add(id);
      let pose = poses.current.get(id);
      if (!pose) {
        pose = { position: new Vector3(...position), scale: animate ? .76 : 1 };
        poses.current.set(id, pose);
      }
      pose.position.set(...position.map((value, axis) =>
        MathUtils.damp(pose.position.getComponent(axis), value, 10, dt)) as [number, number, number]);
      pose.scale = MathUtils.damp(pose.scale, 1, 12, dt);
      dummy.position.copy(pose.position);
      dummy.rotation.y = yaw ?? 0;
      dummy.scale.setScalar(pose.scale);
      dummy.updateMatrix();
      models.forEach((model, meshIndex) => {
        matrix.multiplyMatrices(dummy.matrix, model.matrixWorld);
        meshes.current[meshIndex]?.setMatrixAt(index, matrix);
      });
    });
    for (const id of poses.current.keys()) {
      if (!active.has(id)) poses.current.delete(id);
    }
    meshes.current.forEach((mesh) => {
      if (!mesh) return;
      mesh.count = placements.length;
      mesh.instanceMatrix.needsUpdate = true;
    });
  });

  return models.map((model, index) => <instancedMesh
    key={model.uuid} ref={(mesh) => { meshes.current[index] = mesh; }}
    args={[model.geometry, model.material, asset === 'tote' ? 36 : 10]}
    frustumCulled={false} castShadow receiveShadow dispose={null} />);
}

export function StorageBin(props: { placements: PartPlacement[]; animate: boolean }) {
  return <ModelInstances {...props} asset="tote" />;
}

export function CasterWheel(props: { placements: PartPlacement[]; animate: boolean }) {
  return <ModelInstances {...props} asset="caster" />;
}

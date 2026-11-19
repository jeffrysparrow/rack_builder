import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { CanvasTexture, MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { calculateRack, defaultConfiguration, MAX_RACK_SIZE } from '../config/rack';
import { WoodBoard } from './WoodBoard';
import { CasterWheel, StorageBin } from './Hardware';

type Layout = ReturnType<typeof calculateRack>;

const neutral = '#e9e9e3';
const home = new Vector3(.64, .34, 1).normalize();
const largestRack = calculateRack({ ...defaultConfiguration, columns: MAX_RACK_SIZE, rows: MAX_RACK_SIZE });
const shadowSpan = Math.max(largestRack.width, largestRack.height) * 1.18;

function Framing({ layout, reset, spin }: { layout: Layout; reset: number; spin: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const offset = useMemo(() => new Vector3(), []);
  const target = useMemo(() => new Vector3(), []);
  const previousDistance = useRef(0);
  const previousReset = useRef(reset);
  const resetting = useRef(false);
  const { camera, size } = useThree();
  const aspect = size.width / Math.max(1, size.height);

  useFrame((_, dt) => {
    const orbit = controls.current;
    if (!orbit) return;
    const { width, height, depth } = layout;
    const distance = Math.max(height / .68, Math.hypot(width, depth) / (.67 * aspect))
      * 1.56 + depth * .28;
    orbit.minDistance = distance * .34;
    orbit.maxDistance = distance * 2.6;
    target.set(0, height * .49, 0);

    if (!previousDistance.current) {
      camera.position.copy(home).multiplyScalar(distance).add(target);
    } else {
      offset.copy(camera.position).sub(orbit.target);
      const length = offset.length() * distance / previousDistance.current;
      if (previousReset.current !== reset) resetting.current = true;
      if (resetting.current) {
        const azimuth = Math.atan2(offset.x, offset.z);
        const polar = Math.acos(MathUtils.clamp(offset.y / offset.length(), -1, 1));
        const angle = Math.atan2(home.x, home.z) - azimuth;
        const turn = Math.atan2(Math.sin(angle), Math.cos(angle));
        const nextDistance = MathUtils.damp(length, distance, 11, dt);
        offset.setFromSphericalCoords(nextDistance, MathUtils.damp(polar, Math.acos(home.y), 11, dt),
          azimuth + MathUtils.damp(0, turn, 11, dt));
        if (Math.abs(turn) + Math.abs(polar - Math.acos(home.y)) + Math.abs(length - distance) < .004) {
          resetting.current = false;
          offset.copy(home).multiplyScalar(distance);
        }
      } else {
        offset.setLength(length);
      }
      camera.position.copy(offset).add(target);
    }
    previousDistance.current = distance;
    previousReset.current = reset;
    orbit.target.copy(target);
    camera.lookAt(target);
  });

  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={.11}
    minPolarAngle={.16} maxPolarAngle={Math.PI / 2 + .15}
    autoRotate={spin} autoRotateSpeed={.72} onStart={() => { resetting.current = false; }} />;
}

function RackFrame({ layout }: { layout: Layout }) {
  return <>
    {layout.boards.map((board) => <WoodBoard key={board.id} spec={board} />)}
    <Suspense fallback={null}>
      <StorageBin placements={layout.bins} scale={layout.toteScale} />
      <CasterWheel placements={layout.casters} scale={layout.casterScale} />
    </Suspense>
  </>;
}

function FloorContact({ layout }: { layout: Layout }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const context = canvas.getContext('2d')!;
    const alpha = context.createRadialGradient(64, 64, 3, 64, 64, 63);
    alpha.addColorStop(0, 'rgba(42, 37, 27, .34)');
    alpha.addColorStop(.55, 'rgba(42, 37, 27, .19)');
    alpha.addColorStop(1, 'rgba(42, 37, 27, 0)');
    context.fillStyle = alpha;
    context.fillRect(0, 0, 128, 128);
    return new CanvasTexture(canvas);
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);

  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.001, 0]}
    scale={[layout.width + .85, layout.depth + .72, 1]}>
    <planeGeometry />
    <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
  </mesh>;
}

function StudioScene({ layout, reset, spin }: { layout: Layout; reset: number; spin: boolean }) {
  const camera = useThree(({ camera }) => camera) as PerspectiveCamera;
  useEffect(() => {
    camera.near = .05;
    camera.far = 130;
    camera.updateProjectionMatrix();
  }, [camera]);

  return <>
    <color attach="background" args={[neutral]} />
    <fog attach="fog" args={[neutral, 7.5 * shadowSpan, 12 * shadowSpan]} />
    <ambientLight intensity={.36} />
    <directionalLight position={[3, 2, 5]} intensity={.85} color="#eaf0ff" />
    <Environment resolution={128} environmentIntensity={.94}>
      <Lightformer form="rect" intensity={2.2} color="#fff5e7" position={[-3, 4, 2]} scale={[5, 3, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.7} color="#e4ebfa" position={[4, 2, 1]} scale={[3, 5, 1]} target={[0, 0, 0]} />
      <Lightformer form="rect" intensity={1.5} position={[0, 3, -4]} scale={[4, 3, 1]} target={[0, 0, 0]} />
      <Lightformer form="ring" intensity={.75} position={[0, 5, 0]} scale={[7, 7, 1]} target={[0, 0, 0]} />
    </Environment>
    <directionalLight castShadow position={[-2.5, 8, 3]} intensity={1.7} color="#fff4e4"
      shadow-mapSize={[2048, 2048]} shadow-camera-left={-shadowSpan} shadow-camera-right={shadowSpan}
      shadow-camera-top={shadowSpan} shadow-camera-bottom={-shadowSpan}
      shadow-camera-near={.1} shadow-camera-far={18} shadow-normalBias={.012} shadow-bias={-.00018} shadow-radius={4} />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.003, 0]} receiveShadow>
      <planeGeometry args={[80, 80]} />
      <shadowMaterial transparent opacity={.11} depthWrite={false} />
    </mesh>
    <FloorContact layout={layout} />
    <RackFrame layout={layout} />
    <Framing layout={layout} reset={reset} spin={spin} />
  </>;
}

export function Studio({ layout, reset, spin }: { layout: Layout; reset: number; spin: boolean }) {
  return <Canvas shadows dpr={[1, 1.5]} camera={{ position: [2, 2, 4], fov: 34 }}
    gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    fallback={<p className="viewer-error">The 3D viewer requires WebGL.</p>}>
    <StudioScene layout={layout} reset={reset} spin={spin} />
  </Canvas>;
}

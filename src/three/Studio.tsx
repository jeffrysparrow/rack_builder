import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer, OrbitControls } from '@react-three/drei';
import { CanvasTexture, MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { calculateRack } from '../config/rack';
import { WoodBoard } from './WoodBoard';
import { CasterWheel, StorageBin } from './Hardware';

type Layout = ReturnType<typeof calculateRack>;
const neutral = '#e9e9e3';
const home = new Vector3(.64, .34, 1).normalize();

function Framing({ layout, reset, spin }: { layout: Layout; reset: number; spin: boolean }) {
  const controls = useRef<OrbitControlsImpl>(null);
  const started = useRef(false);
  const offset = useMemo(() => new Vector3(), []);
  const target = useMemo(() => new Vector3(), []);
  const previously = useRef({ reset: -1, distance: 0 });
  const motion = useRef({ distance: 0, azimuth: 0, polar: 0, angle: false, active: false });
  const { camera, size } = useThree();
  const aspect = size.width / Math.max(1, size.height);
  const distance = Math.max(layout.height / .68, Math.hypot(layout.width, layout.depth) / (.67 * aspect))
    * 1.56 + layout.depth * .28;

  useFrame((_, dt) => {
    const orbit = controls.current;
    if (!orbit) return;
    const moving = motion.current;
    if (previously.current.reset !== reset || previously.current.distance !== distance) {
      const resetAngle = previously.current.reset !== reset;
      const currentDistance = camera.position.distanceTo(orbit.target);
      const ratio = started.current ? currentDistance / (previously.current.distance || distance) : 1;
      moving.distance = distance * (resetAngle ? 1 : MathUtils.clamp(ratio, .72, 1.35));
      moving.azimuth = Math.atan2(home.x, home.z);
      moving.polar = Math.acos(home.y);
      moving.angle = resetAngle;
      moving.active = true;
      previously.current = { reset, distance };
    }

    target.set(0, layout.height * .49, layout.centerZ);
    if (!started.current) {
      orbit.target.copy(target);
      camera.position.copy(home).multiplyScalar(distance).add(target);
      orbit.update();
      started.current = true;
    }
    if (!moving.active) return;

    offset.copy(camera.position).sub(orbit.target);
    let azimuth = Math.atan2(offset.x, offset.z);
    let polar = Math.acos(MathUtils.clamp(offset.y / offset.length(), -1, 1));
    const length = MathUtils.damp(offset.length(), moving.distance, 7, dt);
    if (moving.angle) {
      const turn = Math.atan2(Math.sin(moving.azimuth - azimuth), Math.cos(moving.azimuth - azimuth));
      azimuth += MathUtils.damp(0, turn, 8, dt);
      polar = MathUtils.damp(polar, moving.polar, 8, dt);
      if (Math.abs(turn) + Math.abs(polar - moving.polar) < .004) moving.angle = false;
    }
    orbit.target.lerp(target, 1 - Math.exp(-7 * dt));
    camera.position.copy(offset.setFromSphericalCoords(length, polar, azimuth)).add(orbit.target);
    if (Math.abs(length - moving.distance) < .003 && orbit.target.distanceTo(target) < .003 && !moving.angle) {
      moving.active = false;
    }
  });

  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={.11}
    minDistance={distance * .34} maxDistance={distance * 2.6} minPolarAngle={.16} maxPolarAngle={Math.PI / 2 + .15}
    autoRotate={spin} autoRotateSpeed={.72} onStart={() => { motion.current.active = false; }} />;
}

function RackFrame({ layout }: { layout: Layout }) {
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  return <>
    {layout.boards.map((board) => <WoodBoard key={board.id} spec={board}
      animate={mounted.current} />)}
    <Suspense fallback={null}>
      <StorageBin placements={layout.bins} animate={mounted.current} />
      <CasterWheel placements={layout.casters} animate={mounted.current} />
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

  return <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -.001, 0]}>
    <planeGeometry args={[layout.width + .85, layout.depth + .72]} />
    <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
  </mesh>;
}

function StudioScene({ layout, reset, spin }: { layout: Layout; reset: number; spin: boolean }) {
  const shadowSpan = Math.max(layout.width, layout.height) * 1.18;
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

'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { VoiceEngineState } from '@/lib/voice/engine';

function OrbMesh({
  level,
  state,
  reduce,
}: {
  level: number;
  state: VoiceEngineState;
  reduce: boolean;
}) {
  const group = useRef<THREE.Group>(null);
  const target = useRef(0);

  const color = useMemo(() => {
    switch (state) {
      case 'listening':
        return '#FF7637';
      case 'thinking':
        return '#FF4F20';
      case 'speaking':
        return '#FF8A4C';
      case 'loading':
        return '#6B7280';
      default:
        return '#FF4F20';
    }
  }, [state]);

  useFrame((_, dt) => {
    if (!group.current) return;
    target.current = THREE.MathUtils.lerp(target.current, level, 0.18);
    const pulse =
      state === 'idle'
        ? 0.08 + Math.sin(performance.now() / 900) * 0.04
        : state === 'thinking'
          ? 0.2 + Math.sin(performance.now() / 220) * 0.12
          : 0.12 + target.current * 0.55;
    const s = 1 + pulse;
    const cur = group.current.scale.x;
    const next = THREE.MathUtils.lerp(cur, s, 1 - Math.pow(0.001, dt));
    group.current.scale.setScalar(next);
    group.current.rotation.y += dt * (0.25 + target.current * 1.2);
    group.current.rotation.x += dt * 0.08;
  });

  if (reduce) {
    return (
      <mesh>
        <sphereGeometry args={[1.1, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    );
  }

  const distort = 0.28 + level * 0.45;
  const speed = state === 'listening' || state === 'speaking' ? 3.5 : state === 'thinking' ? 5 : 1.2;

  return (
    <Float speed={1.2} rotationIntensity={0.25} floatIntensity={0.4}>
      <group ref={group}>
        <mesh>
          <sphereGeometry args={[1.15, 96, 96]} />
          <MeshDistortMaterial
            color={color}
            emissive={color}
            emissiveIntensity={0.55 + level * 1.2}
            roughness={0.22}
            metalness={0.35}
            distort={distort}
            speed={speed}
          />
        </mesh>
        <mesh scale={1.35}>
          <sphereGeometry args={[1.15, 32, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.08 + level * 0.12} />
        </mesh>
      </group>
    </Float>
  );
}

export function VoiceOrb({
  level,
  state,
  reduceMotion,
}: {
  level: number;
  state: VoiceEngineState;
  reduceMotion?: boolean;
}) {
  const reduce = Boolean(reduceMotion);
  return (
    <div style={{ width: '100%', height: '100%', minHeight: 280 }} aria-hidden>
      <Canvas
        dpr={reduce ? [1, 1] : [1, 1.75]}
        camera={{ position: [0, 0, 4.2], fov: 42 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.35} />
        <pointLight position={[4, 3, 5]} intensity={1.2} color="#FF7637" />
        <pointLight position={[-4, -2, -3]} intensity={0.55} color="#FF4F20" />
        <OrbMesh level={level} state={state} reduce={reduce} />
        {!reduce && (
          <EffectComposer>
            <Bloom intensity={0.85} luminanceThreshold={0.25} luminanceSmoothing={0.7} mipmapBlur />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}

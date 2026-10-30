'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float } from '@react-three/drei';
import * as THREE from 'three';

function FlowParticles({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const speeds = useMemo(() => {
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) s[i] = 0.15 + Math.random() * 0.55;
    return s;
  }, [count]);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [count]);

  useFrame((_, dt) => {
    if (!points.current) return;
    const arr = points.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3] += speeds[i] * dt * 0.85;
      if (arr[i * 3] > 5) arr[i * 3] = -5;
    }
    points.current.geometry.attributes.position.needsUpdate = true;
    points.current.rotation.y += dt * 0.04;
  });

  return (
    <points ref={points} geometry={geom}>
      <pointsMaterial size={0.035} color="#FF7637" transparent opacity={0.85} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function CoreOrb() {
  const mesh = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    if (!mesh.current) return;
    mesh.current.rotation.y = s.clock.elapsedTime * 0.35;
    mesh.current.rotation.x = Math.sin(s.clock.elapsedTime * 0.4) * 0.2;
  });
  return (
    <Float speed={1.4} floatIntensity={0.6}>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[0.85, 1]} />
        <meshStandardMaterial color="#FF4F20" emissive="#FF4F20" emissiveIntensity={0.65} metalness={0.4} roughness={0.25} wireframe />
      </mesh>
    </Float>
  );
}

export function HeroScene({ reduceMotion }: { reduceMotion?: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const mobile = typeof window !== 'undefined' && window.innerWidth < 700;

  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  if (reduceMotion) return <div className="hero-3d-static" aria-hidden />;

  return (
    <div className="hero-3d-canvas" ref={wrap} aria-hidden>
      {visible ? (
        <Canvas
          dpr={[1, 1.25]}
          camera={{ position: [0, 0.2, 5.2], fov: 45 }}
          gl={{ antialias: false, alpha: true, powerPreference: 'high-performance' }}
          frameloop="always"
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={0.4} />
          <pointLight position={[3, 2, 4]} intensity={1.1} color="#FF7637" />
          <FlowParticles count={mobile ? 220 : 480} />
          <CoreOrb />
        </Canvas>
      ) : null}
    </div>
  );
}

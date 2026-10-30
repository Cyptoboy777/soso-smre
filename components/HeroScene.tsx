'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

function FlowParticles({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const speeds = useMemo(() => {
    const s = new Float32Array(count);
    for (let i = 0; i < count; i++) s[i] = 0.2 + Math.random() * 0.7;
    return s;
  }, [count]);
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 8;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return g;
  }, [count]);

  useFrame((_, dt) => {
    if (!points.current) return;
    const arr = points.current.geometry.attributes.position.array as Float32Array;
    for (let i = 0; i < count; i++) {
      arr[i * 3 + 1] += speeds[i] * dt * 0.35;
      if (arr[i * 3 + 1] > 4) arr[i * 3 + 1] = -4;
    }
    points.current.geometry.attributes.position.needsUpdate = true;
    points.current.rotation.y += dt * 0.08;
  });

  return (
    <points ref={points} geometry={geom}>
      <pointsMaterial size={0.055} color="#FF7637" transparent opacity={0.95} depthWrite={false} sizeAttenuation />
    </points>
  );
}

function CoreOrb() {
  const mesh = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  useFrame((s) => {
    const t = s.clock.elapsedTime;
    if (mesh.current) {
      mesh.current.rotation.y = t * 0.45;
      mesh.current.rotation.x = Math.sin(t * 0.5) * 0.25;
    }
    if (glow.current) {
      const pulse = 1.15 + Math.sin(t * 2.2) * 0.06;
      glow.current.scale.setScalar(pulse);
    }
  });
  return (
    <group>
      <mesh ref={mesh}>
        <icosahedronGeometry args={[1.15, 2]} />
        <meshStandardMaterial
          color="#FF4F20"
          emissive="#FF4F20"
          emissiveIntensity={1.1}
          metalness={0.55}
          roughness={0.2}
          wireframe
        />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.95, 48, 48]} />
        <meshStandardMaterial
          color="#FF7637"
          emissive="#FF4F20"
          emissiveIntensity={0.65}
          metalness={0.3}
          roughness={0.35}
          transparent
          opacity={0.35}
        />
      </mesh>
      <mesh ref={glow} scale={1.2}>
        <sphereGeometry args={[1.15, 32, 32]} />
        <meshBasicMaterial color="#FF4F20" transparent opacity={0.18} depthWrite={false} />
      </mesh>
    </group>
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

  if (reduceMotion) return <div className="hero-3d-poster" aria-hidden />;

  return (
    <div className="hero-3d-canvas" ref={wrap} aria-hidden>
      {visible ? (
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0.15, 4.2], fov: 42 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
          style={{ background: 'transparent' }}
        >
          <ambientLight intensity={0.55} />
          <pointLight position={[3, 2, 4]} intensity={1.6} color="#FF7637" />
          <pointLight position={[-2.5, -1, -2]} intensity={0.7} color="#FF4F20" />
          <FlowParticles count={mobile ? 280 : 560} />
          <CoreOrb />
        </Canvas>
      ) : null}
    </div>
  );
}

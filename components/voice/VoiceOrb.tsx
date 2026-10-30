'use client';

import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { VoiceEngineState } from '@/lib/voice/engine';

const orbVert = /* glsl */ `
uniform float uTime;
uniform float uLevel;
uniform float uDistort;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vNoise;

// simplex-ish 3D noise
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}

void main(){
  vNormal = normalize(normalMatrix * normal);
  float n = snoise(normal * 2.4 + uTime * 0.55);
  vNoise = n;
  float amp = uDistort * (0.55 + uLevel * 1.35);
  vec3 pos = position + normal * n * amp;
  vec4 world = modelMatrix * vec4(pos, 1.0);
  vWorldPos = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const orbFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uLevel;
uniform float uTime;
uniform float uGlow;
varying vec3 vNormal;
varying vec3 vWorldPos;
varying float vNoise;

void main(){
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - max(dot(viewDir, normalize(vNormal)), 0.0), 2.6);
  float core = 0.35 + 0.25 * (vNoise * 0.5 + 0.5);
  float pulse = 0.55 + uLevel * 0.9;
  vec3 base = uColor * (core + pulse * 0.35);
  vec3 rim = uColor * 1.35 + vec3(0.35, 0.12, 0.02);
  vec3 col = mix(base, rim, fresnel * (0.75 + uGlow * 0.35));
  // soft specular highlight
  vec3 light = normalize(vec3(0.6, 0.8, 0.5));
  float spec = pow(max(dot(reflect(-light, normalize(vNormal)), viewDir), 0.0), 28.0);
  col += vec3(1.0, 0.85, 0.7) * spec * (0.35 + uLevel * 0.5);
  float alpha = 0.92 + fresnel * 0.08;
  gl_FragColor = vec4(col, alpha);
}
`;

function OrbMesh({
  level,
  state,
}: {
  level: number;
  state: VoiceEngineState;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const glow = useRef<THREE.Mesh>(null);
  const smoothed = useRef(0);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uLevel: { value: 0 },
      uDistort: { value: 0.22 },
      uGlow: { value: 0.4 },
      uColor: { value: new THREE.Color('#FF4F20') },
    }),
    [],
  );

  useFrame((_, dt) => {
    const target =
      state === 'idle'
        ? 0.08 + Math.sin(performance.now() / 1100) * 0.04
        : state === 'thinking'
          ? 0.35 + Math.sin(performance.now() / 180) * 0.2
          : state === 'loading'
            ? 0.12 + Math.sin(performance.now() / 400) * 0.08
            : Math.min(1, level * 1.15);
    smoothed.current = THREE.MathUtils.lerp(smoothed.current, target, 1 - Math.pow(0.0008, dt));
    const L = smoothed.current;
    uniforms.uTime.value += dt;
    uniforms.uLevel.value = L;
    uniforms.uDistort.value =
      state === 'listening' || state === 'speaking' ? 0.28 + L * 0.42 : state === 'thinking' ? 0.32 : 0.18;
    uniforms.uGlow.value = state === 'speaking' || state === 'listening' ? 0.7 + L : 0.35;
    const c =
      state === 'listening'
        ? '#FF7637'
        : state === 'speaking'
          ? '#FF8A4C'
          : state === 'loading'
            ? '#9CA3AF'
            : '#FF4F20';
    uniforms.uColor.value.lerp(new THREE.Color(c), 0.08);

    if (mesh.current) {
      const s = 1 + L * 0.22;
      mesh.current.scale.setScalar(THREE.MathUtils.lerp(mesh.current.scale.x, s, 0.12));
      mesh.current.rotation.y += dt * (0.35 + L * 1.4);
      mesh.current.rotation.x += dt * 0.12;
    }
    if (glow.current) {
      const gs = 1.25 + L * 0.55;
      glow.current.scale.setScalar(THREE.MathUtils.lerp(glow.current.scale.x, gs, 0.1));
      const mat = glow.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.12 + L * 0.28;
    }
  });

  return (
    <group>
      <mesh ref={mesh}>
        <sphereGeometry args={[1.05, 128, 128]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={orbVert}
          fragmentShader={orbFrag}
          transparent
          depthWrite
        />
      </mesh>
      <mesh ref={glow}>
        <sphereGeometry args={[1.05, 48, 48]} />
        <meshBasicMaterial color="#FF4F20" transparent opacity={0.15} depthWrite={false} />
      </mesh>
      {/* soft outer haze — keeps bloom look without EffectComposer opaque clear */}
      <mesh scale={1.7}>
        <sphereGeometry args={[1.05, 32, 32]} />
        <meshBasicMaterial color="#FF7637" transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
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
  if (reduceMotion) {
    return (
      <div className="voice-orb-fallback" data-state={state} aria-hidden style={{ transform: `scale(${1 + level * 0.12})` }} />
    );
  }
  return (
    <div className="voice-orb-canvas-host" aria-hidden>
      <Canvas
        dpr={[1, 1.75]}
        camera={{ position: [0, 0, 4.2], fov: 38 }}
        gl={{
          antialias: true,
          alpha: true,
          premultipliedAlpha: false,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
        style={{ background: 'transparent', width: '100%', height: '100%' }}
      >
        <ambientLight intensity={0.55} />
        <pointLight position={[3.5, 2.5, 4]} intensity={1.4} color="#FF7637" />
        <pointLight position={[-3, -2, -2]} intensity={0.7} color="#FF4F20" />
        <OrbMesh level={level} state={state} />
      </Canvas>
    </div>
  );
}

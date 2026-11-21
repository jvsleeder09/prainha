import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { ContactShadows, Float, PerformanceMonitor, RoundedBox } from '@react-three/drei'
import type { Group, Mesh } from 'three'

/**
 * Cena 3D do hero (carregada sob demanda com React.lazy).
 *
 * Toda a geometria é procedural (primitivas do Three.js): não há modelos nem texturas
 * para baixar, o que mantém o pacote leve. A resolução (DPR) cai automaticamente
 * quando o PerformanceMonitor detecta queda de FPS.
 */

const COLORS = {
  red: '#A51E25',
  wine: '#6F2426',
  cream: '#FFF3DF',
  petrol: '#17677A',
  orange: '#F28B26',
  leaf: '#4E8B3A',
  rice: '#FBF6EA',
  beans: '#4A2A22',
}

function Marmita() {
  return (
    <group>
      {/* embalagem */}
      <RoundedBox args={[3.2, 0.9, 2.2]} radius={0.28} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color={COLORS.red} roughness={0.45} />
      </RoundedBox>
      {/* borda interna */}
      <RoundedBox args={[2.95, 0.1, 1.95]} radius={0.05} smoothness={2} position={[0, 0.43, 0]}>
        <meshStandardMaterial color={COLORS.cream} roughness={0.7} />
      </RoundedBox>
      {/* compartimento principal: proteína */}
      <RoundedBox args={[1.55, 0.16, 1.7]} radius={0.07} smoothness={3} position={[-0.6, 0.5, 0]}>
        <meshStandardMaterial color={COLORS.orange} roughness={0.55} />
      </RoundedBox>
      {/* arroz */}
      <RoundedBox args={[1.1, 0.16, 0.8]} radius={0.07} smoothness={3} position={[0.8, 0.5, -0.45]}>
        <meshStandardMaterial color={COLORS.rice} roughness={0.9} />
      </RoundedBox>
      {/* feijão */}
      <RoundedBox args={[1.1, 0.16, 0.8]} radius={0.07} smoothness={3} position={[0.8, 0.5, 0.45]}>
        <meshStandardMaterial color={COLORS.beans} roughness={0.6} />
      </RoundedBox>
      {/* pedaços na proteína */}
      {[
        [-1.0, 0.62, -0.4],
        [-0.45, 0.62, 0.35],
        [-0.85, 0.62, 0.45],
        [-0.3, 0.62, -0.45],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} rotation={[0, i, 0]} castShadow>
          <boxGeometry args={[0.32, 0.12, 0.22]} />
          <meshStandardMaterial color={i % 2 ? '#C8632A' : '#E39A4B'} roughness={0.5} />
        </mesh>
      ))}
      {/* salsinha */}
      {[
        [0.55, 0.62, -0.5],
        [1.05, 0.62, -0.35],
        [0.9, 0.62, 0.55],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]} scale={[1, 0.35, 1]}>
          <sphereGeometry args={[0.09, 10, 8]} />
          <meshStandardMaterial color={COLORS.leaf} />
        </mesh>
      ))}
    </group>
  )
}

function Lid() {
  return (
    <Float speed={1.6} rotationIntensity={0.25} floatIntensity={0.6}>
      <group position={[0.35, 1.95, -0.9]} rotation={[-0.95, 0.2, 0.18]} scale={0.92}>
        <RoundedBox args={[3.3, 0.14, 2.3]} radius={0.07} smoothness={3}>
          <meshStandardMaterial color="#bfe7f1" roughness={0.15} metalness={0.1} transparent opacity={0.4} depthWrite={false} />
        </RoundedBox>
        {/* aba de encaixe da tampa */}
        <RoundedBox args={[3.1, 0.22, 0.12]} radius={0.05} smoothness={2} position={[0, -0.12, 1.08]}>
          <meshStandardMaterial color={COLORS.petrol} transparent opacity={0.6} />
        </RoundedBox>
        {/* etiqueta */}
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.4, 0.7]} />
          <meshStandardMaterial color={COLORS.cream} />
        </mesh>
        <mesh position={[0, 0.085, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.22, 24]} />
          <meshStandardMaterial color={COLORS.orange} />
        </mesh>
      </group>
    </Float>
  )
}

function Tomato() {
  return (
    <group>
      <mesh castShadow>
        <sphereGeometry args={[0.3, 24, 18]} />
        <meshStandardMaterial color="#D7322B" roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[0, 0, 0]}>
        <coneGeometry args={[0.12, 0.12, 5]} />
        <meshStandardMaterial color={COLORS.leaf} />
      </mesh>
    </group>
  )
}

function Carrot() {
  return (
    <group rotation={[0, 0, 1.1]}>
      <mesh castShadow>
        <coneGeometry args={[0.14, 0.75, 14]} />
        <meshStandardMaterial color={COLORS.orange} roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.45, 0]}>
        <coneGeometry args={[0.08, 0.25, 6]} />
        <meshStandardMaterial color={COLORS.leaf} />
      </mesh>
    </group>
  )
}

function Broccoli() {
  return (
    <group>
      <mesh position={[0, -0.18, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 0.35, 10]} />
        <meshStandardMaterial color="#8DB36B" />
      </mesh>
      {[
        [0, 0.05, 0],
        [0.13, 0, 0.05],
        [-0.12, 0, 0.06],
        [0, 0.02, -0.13],
      ].map((p, i) => (
        <mesh key={i} position={p as [number, number, number]}>
          <sphereGeometry args={[0.14, 14, 10]} />
          <meshStandardMaterial color="#3F7D3A" roughness={0.8} />
        </mesh>
      ))}
    </group>
  )
}

function Leaf() {
  return (
    <mesh scale={[1, 0.18, 0.55]} rotation={[0.4, 0.6, 0.2]}>
      <sphereGeometry args={[0.32, 18, 12]} />
      <meshStandardMaterial color="#5E9B4B" roughness={0.6} />
    </mesh>
  )
}

function IceCrystal() {
  return (
    <mesh>
      <octahedronGeometry args={[0.2, 0]} />
      <meshStandardMaterial color="#bfe7f1" roughness={0.05} metalness={0.2} transparent opacity={0.8} />
    </mesh>
  )
}

const ORBIT_ITEMS = [Tomato, Carrot, Broccoli, Leaf, IceCrystal, Tomato, Leaf, IceCrystal]

function Orbit() {
  const ref = useRef<Group>(null)
  const items = useMemo(
    () =>
      ORBIT_ITEMS.map((Comp, i) => {
        const angle = (i / ORBIT_ITEMS.length) * Math.PI * 2
        const radius = 2.4 + (i % 2) * 0.3
        return { Comp, pos: [Math.cos(angle) * radius, 0.6 + Math.sin(i * 1.7) * 0.7, Math.sin(angle) * radius] as const }
      }),
    [],
  )
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.18
  })
  return (
    <group ref={ref}>
      {items.map(({ Comp, pos }, i) => (
        <Float key={i} speed={1.2 + (i % 3) * 0.4} rotationIntensity={1.2} floatIntensity={0.8}>
          <group position={pos as unknown as [number, number, number]}>
            <Comp />
          </group>
        </Float>
      ))}
    </group>
  )
}

function Steam() {
  const ref = useRef<Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.getElapsedTime()
    ref.current.position.y = 0.9 + ((t * 0.35) % 1.2)
    ;(ref.current.material as { opacity: number }).opacity = 0.35 * (1 - ((t * 0.35) % 1.2) / 1.2)
  })
  return (
    <mesh ref={ref} position={[-0.6, 1, 0]}>
      <torusGeometry args={[0.25, 0.05, 8, 24]} />
      <meshStandardMaterial color="#ffffff" transparent opacity={0.3} />
    </mesh>
  )
}

/** Inclina a cena suavemente seguindo o ponteiro (parallax moderado). */
function Rig({ children }: { children: ReactNode }) {
  const ref = useRef<Group>(null)
  useFrame(({ pointer }, delta) => {
    if (!ref.current) return
    const k = Math.min(1, delta * 3)
    ref.current.rotation.y += (pointer.x * 0.35 - 0.45 - ref.current.rotation.y) * k
    ref.current.rotation.x += (-pointer.y * 0.12 + 0.05 - ref.current.rotation.x) * k
  })
  return (
    <group ref={ref} rotation={[0.05, -0.45, 0]}>
      {children}
    </group>
  )
}

export default function HeroScene({ active }: { active: boolean }) {
  const [dpr, setDpr] = useState(1.5)
  return (
    <Canvas
      className="hero-canvas"
      frameloop={active ? 'always' : 'never'}
      dpr={dpr}
      camera={{ position: [0, 3.4, 7.6], fov: 38 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      shadows={false}
      aria-hidden="true"
    >
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(1.5)} flipflops={3} onFallback={() => setDpr(0.8)} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[4, 6, 3]} intensity={1.6} color="#fff1dc" />
      <directionalLight position={[-5, 2, -3]} intensity={0.6} color="#9fd3df" />
      <Rig>
        <Float speed={1} rotationIntensity={0.15} floatIntensity={0.35}>
          <Marmita />
          <Steam />
        </Float>
        <Lid />
        <Orbit />
      </Rig>
      <ContactShadows position={[0, -0.75, 0]} opacity={0.35} scale={9} blur={2.6} far={3} resolution={256} frames={1} />
    </Canvas>
  )
}

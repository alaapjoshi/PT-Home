import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';

function Limb({ angle = 0, side = 1, kind = 'arm' }) {
  const x = side * 0.77;
  const top = kind === 'arm' ? 1.3 : -0.1;
  const upperLen = kind === 'arm' ? 0.75 : 0.85;
  const lowerLen = kind === 'arm' ? 0.72 : 0.82;
  return (
    <group position={[x, top, 0]}>
      <mesh position={[0, -upperLen / 2, 0]}>
        <capsuleGeometry args={[0.115, upperLen - 0.23, 8, 16]} />
        <meshStandardMaterial color={kind === 'arm' ? '#55c6ed' : '#8bafff'} />
      </mesh>
      <group position={[0, -upperLen, 0]} rotation={[0, 0, side * angle]}>
        <mesh position={[0, -lowerLen / 2, 0]}>
          <capsuleGeometry args={[0.095, lowerLen - 0.19, 8, 16]} />
          <meshStandardMaterial color="#f1b96b" />
        </mesh>
        <mesh position={[0, -lowerLen, 0]}>
          <sphereGeometry args={[0.12, 16, 12]} />
          <meshStandardMaterial color="#f1b96b" />
        </mesh>
      </group>
    </group>
  );
}
function Body({ angle, mode }) {
  const armAngle = mode === 'arm' ? angle : 0;
  const legAngle = mode === 'leg' ? angle : 0;
  return (
    <group position={[0, 0.5, 0]}>
      <mesh position={[0, 1.95, 0]}>
        <sphereGeometry args={[0.34, 24, 20]} />
        <meshStandardMaterial color="#e3a675" />
      </mesh>
      <mesh position={[0, 0.65, 0]}>
        <capsuleGeometry args={[0.52, 1.45, 8, 16]} />
        <meshStandardMaterial color="#304f88" />
      </mesh>
      <Limb side={-1} angle={armAngle} kind="arm" />
      <Limb side={1} angle={0} kind="arm" />
      <Limb side={-1} angle={legAngle} kind="leg" />
      <Limb side={1} angle={0} kind="leg" />
    </group>
  );
}
export function Scene({ angle, mode }) {
  return (
    <Canvas camera={{ position: [3, 2.4, 5.5], fov: 45 }}>
      <color attach="background" args={['#0b1527']} />
      <ambientLight intensity={1.4} />
      <directionalLight position={[3, 6, 4]} intensity={2} />
      <Grid
        position={[0, -2.5, 0]}
        args={[12, 12]}
        cellColor="#234566"
        sectionColor="#416e98"
        fadeDistance={20}
      />
      <Body angle={angle} mode={mode} />
      <OrbitControls target={[0, 0.6, 0]} enablePan={false} />
    </Canvas>
  );
}

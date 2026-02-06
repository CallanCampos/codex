import { Canvas } from '@react-three/fiber'

export const ThreeSceneShell = () => {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 opacity-0"
      data-testid="three-scaffold"
    >
      <Canvas>
        <ambientLight intensity={0.3} />
      </Canvas>
    </div>
  )
}

import { Suspense, useMemo } from 'react'
import { Canvas, useLoader } from '@react-three/fiber'
import * as THREE from 'three'
import { ColladaLoader } from 'three/addons/loaders/ColladaLoader.js'
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js'

interface PokemonModelCanvasProps {
  modelUrl: string
}

interface ModelMeshProps {
  scene: THREE.Object3D
}

const getResourceDirectory = (url: string): string => {
  const withoutQuery = url.split('?')[0] ?? url
  const lastSlashIndex = withoutQuery.lastIndexOf('/')
  if (lastSlashIndex < 0) {
    return ''
  }

  return withoutQuery.slice(0, lastSlashIndex + 1)
}

const applyMaterialTweaks = (root: THREE.Object3D): void => {
  root.traverse((node) => {
    const mesh = node as THREE.Mesh
    if (!mesh.isMesh) {
      return
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const material of materials) {
      if (!material) {
        continue
      }

      const typed = material as THREE.Material & {
        alphaTest?: number
        map?: THREE.Texture
      }
      if (typed.map) {
        typed.map.colorSpace = THREE.SRGBColorSpace
        typed.map.generateMipmaps = true
        typed.map.minFilter = THREE.LinearMipmapLinearFilter
        typed.map.magFilter = THREE.LinearFilter
      }
      material.needsUpdate = true
    }
  })
}

const ModelMesh = ({ scene }: ModelMeshProps) => {
  const normalized = useMemo(() => {
    const root = cloneSkeleton(scene)
    applyMaterialTweaks(root)

    const box = new THREE.Box3().setFromObject(root)
    const size = new THREE.Vector3()
    const center = new THREE.Vector3()
    box.getSize(size)
    box.getCenter(center)

    const safeHeight = Math.max(size.y, 0.001)
    const uniformScale = 1.88 / safeHeight
    const position = new THREE.Vector3(
      -center.x * uniformScale,
      -center.y * uniformScale - 0.9,
      -center.z * uniformScale,
    )

    return { position, root, scale: uniformScale }
  }, [scene])

  return (
    <group position={normalized.position} rotation={[0, Math.PI, 0]} scale={normalized.scale}>
      <primitive object={normalized.root} />
    </group>
  )
}

const GlbModelMesh = ({ modelUrl }: PokemonModelCanvasProps) => {
  const gltf = useLoader(GLTFLoader, modelUrl, (loader) => {
    const resourceDirectory = getResourceDirectory(modelUrl)
    loader.setResourcePath(resourceDirectory)
  })
  return <ModelMesh scene={gltf.scene} />
}

const DaeModelMesh = ({ modelUrl }: PokemonModelCanvasProps) => {
  const collada = useLoader(ColladaLoader, modelUrl, (loader) => {
    const resourceDirectory = getResourceDirectory(modelUrl)
    loader.setResourcePath(resourceDirectory)
  })
  return <ModelMesh scene={collada.scene} />
}

const FbxModelMesh = ({ modelUrl }: PokemonModelCanvasProps) => {
  const fbx = useLoader(FBXLoader, modelUrl, (loader) => {
    const resourceDirectory = getResourceDirectory(modelUrl)
    loader.setResourcePath(resourceDirectory)
  })
  return <ModelMesh scene={fbx} />
}

export const PokemonModelCanvas = ({ modelUrl }: PokemonModelCanvasProps) => {
  const isCollada = /\.dae(?:\?|$)/i.test(modelUrl)
  const isFbx = /\.fbx(?:\?|$)/i.test(modelUrl)

  return (
    <Canvas
      camera={{ fov: 28, position: [0, 0.2, 6.4] }}
      dpr={[1, 2]}
      gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
      style={{ height: '100%', width: '100%' }}
    >
      <ambientLight intensity={0.92} />
      <hemisphereLight intensity={0.55} />
      <directionalLight intensity={1.08} position={[2, 3, 4]} />
      <directionalLight intensity={0.32} position={[-2, 1, -2]} />
      <Suspense fallback={null}>
        {isCollada ? (
          <DaeModelMesh modelUrl={modelUrl} />
        ) : isFbx ? (
          <FbxModelMesh modelUrl={modelUrl} />
        ) : (
          <GlbModelMesh modelUrl={modelUrl} />
        )}
      </Suspense>
    </Canvas>
  )
}

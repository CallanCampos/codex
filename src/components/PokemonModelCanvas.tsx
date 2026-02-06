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

const ABSOLUTE_URL_PATTERN = /^(?:[a-z][a-z\d+\-.]*:)?\/\//i

const getResourceDirectory = (url: string): string => {
  const withoutQuery = url.split('?')[0] ?? url
  const lastSlashIndex = withoutQuery.lastIndexOf('/')
  if (lastSlashIndex < 0) {
    return ''
  }

  return withoutQuery.slice(0, lastSlashIndex + 1)
}

const normalizeTextureUrl = (inputUrl: string, resourceDirectory: string): string => {
  if (!inputUrl) {
    return inputUrl
  }

  if (
    ABSOLUTE_URL_PATTERN.test(inputUrl) ||
    inputUrl.startsWith('data:') ||
    inputUrl.startsWith('blob:')
  ) {
    return inputUrl
  }

  const normalizedResourceDirectory = resourceDirectory.endsWith('/')
    ? resourceDirectory
    : `${resourceDirectory}/`
  const resourcePathOnly = normalizedResourceDirectory.replace(/^https?:\/\/[^/]+/i, '')

  let url = inputUrl.replace(/\\/g, '/')
  if (url.startsWith(normalizedResourceDirectory) || url.startsWith(resourcePathOnly)) {
    return url
  }

  if (/^\/(images|textures|images_shiny|shiny)\//i.test(url)) {
    url = url.replace(/^\/+/, '')
    return `${normalizedResourceDirectory}${url}`
  }

  const textureFolders = ['images_shiny/', 'images/', 'textures/', 'shiny/']
  const lowerUrl = url.toLowerCase()
  for (const folder of textureFolders) {
    const index = lowerUrl.lastIndexOf(folder)
    if (index >= 0) {
      const trimmed = url.slice(index).replace(/^\.\//, '')
      return `${normalizedResourceDirectory}${trimmed}`
    }
  }

  if (url.startsWith('/')) {
    return url
  }

  return `${normalizedResourceDirectory}${url.replace(/^\.\//, '')}`
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
    const min = box.min.clone()
    box.getSize(size)
    box.getCenter(center)

    const maxDimension = Math.max(size.x, size.y, size.z, 0.001)
    const likelyUpright = size.y >= maxDimension * 0.34
    const effectiveHeight = Math.max(likelyUpright ? size.y : maxDimension, 0.001)
    const uniformScale = 1.88 / effectiveHeight
    const position = new THREE.Vector3(
      -center.x * uniformScale,
      -min.y * uniformScale - 0.9,
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
    loader.manager.setURLModifier((url) => normalizeTextureUrl(url, resourceDirectory))
    loader.setResourcePath(resourceDirectory)
  })
  return <ModelMesh scene={gltf.scene} />
}

const DaeModelMesh = ({ modelUrl }: PokemonModelCanvasProps) => {
  const collada = useLoader(ColladaLoader, modelUrl, (loader) => {
    const resourceDirectory = getResourceDirectory(modelUrl)
    loader.manager.setURLModifier((url) => normalizeTextureUrl(url, resourceDirectory))
    loader.setResourcePath(resourceDirectory)
  })
  return <ModelMesh scene={collada.scene} />
}

const FbxModelMesh = ({ modelUrl }: PokemonModelCanvasProps) => {
  const fbx = useLoader(FBXLoader, modelUrl, (loader) => {
    const resourceDirectory = getResourceDirectory(modelUrl)
    loader.manager.setURLModifier((url) => normalizeTextureUrl(url, resourceDirectory))
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
      dpr={[1, 1.5]}
      frameloop="demand"
      gl={{ alpha: true, antialias: false, powerPreference: 'default' }}
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

import { motion } from 'framer-motion'
import { blendHex, getBackgroundBlend } from '../lib/background'

interface BackgroundSystemProps {
  currentHeight: number
  minHeight: number
  maxHeight: number
}

export const BackgroundSystem = ({
  currentHeight,
  minHeight,
  maxHeight,
}: BackgroundSystemProps) => {
  const blend = getBackgroundBlend(currentHeight, minHeight, maxHeight)
  const gradientStart = blendHex(blend.from.gradientA, blend.to.gradientA, blend.factor)
  const gradientEnd = blendHex(blend.from.gradientB, blend.to.gradientB, blend.factor)

  return (
    <div className="fixed inset-0 -z-20 overflow-hidden" data-testid="background-system">
      <div
        className="absolute inset-0 transition-[background] duration-700 ease-out"
        style={{
          background: `radial-gradient(circle at 20% 20%, ${gradientStart}, transparent 55%), linear-gradient(145deg, ${gradientStart}, ${gradientEnd})`,
        }}
      />
      <motion.div
        animate={{ opacity: 0.12 + blend.factor * 0.1, y: blend.normalizedScale * 40 }}
        className="noise-layer absolute inset-0"
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
      <motion.div
        animate={{ x: blend.normalizedScale * 50 }}
        className="absolute -left-40 top-1/3 h-72 w-72 rounded-full bg-white/10 blur-3xl"
        transition={{ duration: 1, ease: 'easeOut' }}
      />
      <motion.div
        animate={{ x: blend.normalizedScale * -70 }}
        className="absolute -right-44 bottom-12 h-80 w-80 rounded-full bg-black/20 blur-3xl"
        transition={{ duration: 1, ease: 'easeOut' }}
      />
    </div>
  )
}

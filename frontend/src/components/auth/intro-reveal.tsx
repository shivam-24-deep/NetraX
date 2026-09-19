import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"

import { INTRO_EASE } from "@/lib/intro-timeline"

export function IntroReveal({
  children,
  delay,
  duration = 0.8,
  x = 0,
  y = 0,
  className,
}: {
  children: ReactNode
  delay: number
  duration?: number
  x?: number
  y?: number
  className?: string
}) {
  const prefersReducedMotion = useReducedMotion()

  if (prefersReducedMotion) {
    return <div className={className}>{children}</div>
  }

  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, x, y }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ delay, duration, ease: INTRO_EASE }}
    >
      {children}
    </motion.div>
  )
}

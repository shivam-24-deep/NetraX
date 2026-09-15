import { motion, useReducedMotion } from "framer-motion"
import type { ReactNode } from "react"

/**
 * Every slide renders inside this: a fixed 1920x1080 canvas with a safe
 * inner area (content never touches the edge) and the shared enter/exit
 * transition. Reduced-motion users get a near-instant cross-fade instead of
 * the directional scale/fade.
 */
export function SlideShell({ children, eyebrow }: { children: ReactNode; eyebrow?: string }) {
  const reduceMotion = useReducedMotion()

  const variants = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, scale: 0.98 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.98 },
      }

  return (
    <motion.section
      className="absolute inset-0 flex flex-col overflow-hidden"
      style={{ width: 1920, height: 1080 }}
      initial={variants.initial}
      animate={variants.animate}
      exit={variants.exit}
      transition={{ duration: reduceMotion ? 0.15 : 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="relative flex h-full w-full flex-col px-[96px] py-[72px]">
        {eyebrow && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
            className="mb-2 font-mono text-[15px] font-semibold tracking-[0.3em] text-primary uppercase"
          >
            {eyebrow}
          </motion.p>
        )}
        {children}
      </div>
    </motion.section>
  )
}

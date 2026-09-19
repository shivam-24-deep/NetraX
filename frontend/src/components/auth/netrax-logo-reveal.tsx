import { animate as animateValue, motion, useMotionValue, useReducedMotion } from "framer-motion"
import { useLayoutEffect, useRef } from "react"

import { INTRO_EASE, INTRO_TIMELINE } from "@/lib/intro-timeline"

/**
 * Renders the NetraX wordmark in its final (top-left) position, but travels
 * there from the visual center of the viewport on mount — measured via the
 * element's own final rect, so the motion lands exactly regardless of
 * viewport size. Pure transform (x/y/scale/opacity), no layout thrash.
 */
export function NetraXLogoReveal({ className }: { className?: string }) {
  const prefersReducedMotion = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)
  const opacity = useMotionValue(prefersReducedMotion ? 1 : 0)

  useLayoutEffect(() => {
    if (prefersReducedMotion || !ref.current) return

    const rect = ref.current.getBoundingClientRect()
    const dx = window.innerWidth / 2 - (rect.left + rect.width / 2)
    const dy = window.innerHeight / 2 - (rect.top + rect.height / 2)
    x.set(dx)
    y.set(dy)
    scale.set(1.6)

    const controls = [
      animateValue(opacity, 1, {
        duration: INTRO_TIMELINE.logoFade.duration,
        delay: INTRO_TIMELINE.logoFade.delay,
        ease: "easeOut",
      }),
      animateValue(x, 0, {
        duration: INTRO_TIMELINE.logoTravel.duration,
        delay: INTRO_TIMELINE.logoTravel.delay,
        ease: INTRO_EASE,
      }),
      animateValue(y, 0, {
        duration: INTRO_TIMELINE.logoTravel.duration,
        delay: INTRO_TIMELINE.logoTravel.delay,
        ease: INTRO_EASE,
      }),
      animateValue(scale, 1, {
        duration: INTRO_TIMELINE.logoTravel.duration,
        delay: INTRO_TIMELINE.logoTravel.delay,
        ease: INTRO_EASE,
      }),
    ]

    return () => controls.forEach((c) => c.stop())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefersReducedMotion])

  return (
    <motion.div
      ref={ref}
      style={prefersReducedMotion ? undefined : { x, y, scale, opacity }}
      className={className ?? "flex items-center gap-2"}
    >
      <img src="/assets/netrax-icon.png?v=2" alt="" className="size-7 object-contain" />
      <span className="text-base font-semibold tracking-tight">NetraX</span>
    </motion.div>
  )
}

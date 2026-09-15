import { ChevronLeft, ChevronRight, Radar } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"

const SLIDE_LABELS = [
  "Hero",
  "The Threat",
  "The Shift",
  "Dynamic Investigation",
  "Architecture",
  "Control Room",
  "Real Results",
  "Threat Intel & Geo",
  "Impact",
  "Research",
  "Thank You",
]

export function PresentationChrome({
  currentSlide,
  slideCount,
  onNext,
  onPrev,
  onGoTo,
  visible,
}: {
  currentSlide: number
  slideCount: number
  onNext: () => void
  onPrev: () => void
  onGoTo: (index: number) => void
  visible: boolean
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="pointer-events-none fixed inset-0 z-50"
        >
          <div className="pointer-events-auto absolute top-6 left-6 flex items-center gap-2 text-foreground">
            <Radar className="size-4 text-primary" aria-hidden />
            <span className="font-mono text-xs font-semibold tracking-[0.2em]">NETRAX</span>
          </div>

          <div className="pointer-events-auto absolute top-6 right-6 font-mono text-xs tabular-nums text-muted-foreground">
            {String(currentSlide + 1).padStart(2, "0")} / {String(slideCount).padStart(2, "0")}
          </div>

          <nav
            aria-label="Slide navigation"
            className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-3"
          >
            {Array.from({ length: slideCount }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}: ${SLIDE_LABELS[i]}`}
                aria-current={i === currentSlide}
                onClick={() => onGoTo(i)}
                className="group flex items-center justify-center p-1"
              >
                <span
                  className={`block h-1.5 rounded-full transition-all duration-300 ${
                    i === currentSlide ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/40 group-hover:bg-muted-foreground/70"
                  }`}
                />
              </button>
            ))}
          </nav>

          <div className="pointer-events-auto absolute right-6 bottom-6 flex items-center gap-2">
            <button
              type="button"
              aria-label="Previous slide"
              onClick={onPrev}
              disabled={currentSlide === 0}
              className="flex size-9 items-center justify-center rounded-full border border-border bg-surface/80 text-foreground backdrop-blur transition-colors hover:bg-surface-2 disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={onNext}
              disabled={currentSlide === slideCount - 1}
              className="flex size-9 items-center justify-center rounded-full border border-border bg-surface/80 text-foreground backdrop-blur transition-colors hover:bg-surface-2 disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

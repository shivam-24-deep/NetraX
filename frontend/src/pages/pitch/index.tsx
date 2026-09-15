import { AnimatePresence } from "framer-motion"
import { useEffect, useState } from "react"

import { PresentationChrome } from "./chrome"
import { MobileFallback } from "./mobile-fallback"
import { useCanvasScale } from "./use-canvas-scale"
import { usePresentationNav } from "./use-presentation-nav"
import { Slide1Hero } from "./slides/slide-1-hero"
import { Slide2Threat } from "./slides/slide-2-threat"
import { Slide3Shift } from "./slides/slide-3-shift"
import { Slide4DynamicInvestigation } from "./slides/slide-4-dynamic-investigation"
import { Slide5Architecture } from "./slides/slide-5-architecture"
import { Slide6ControlRoom } from "./slides/slide-6-control-room"
import { Slide7RealResults } from "./slides/slide-7-real-results"
import { Slide8ThreatIntelGeo } from "./slides/slide-8-threat-intel-geo"
import { Slide9Impact } from "./slides/slide-9-impact"
import { Slide10Research } from "./slides/slide-10-research"
import { Slide11ThankYou } from "./slides/slide-11-thank-you"

const SLIDES = [
  Slide1Hero,
  Slide2Threat,
  Slide3Shift,
  Slide4DynamicInvestigation,
  Slide5Architecture,
  Slide6ControlRoom,
  Slide7RealResults,
  Slide8ThreatIntelGeo,
  Slide9Impact,
  Slide10Research,
  Slide11ThankYou,
]

function useIsNarrowViewport(breakpoint = 820) {
  const [narrow, setNarrow] = useState(() => window.innerWidth < breakpoint)
  useEffect(() => {
    function onResize() {
      setNarrow(window.innerWidth < breakpoint)
    }
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [breakpoint])
  return narrow
}

export default function PitchPage() {
  const isNarrow = useIsNarrowViewport()
  const { scale, width, height } = useCanvasScale()
  const { currentSlide, slideCount, next, prev, goTo, presentationMode } = usePresentationNav()

  useEffect(() => {
    document.title = "NetraX — SIH26106"
  }, [])

  if (isNarrow) {
    return <MobileFallback />
  }

  const ActiveSlide = SLIDES[currentSlide]

  return (
    <div className="fixed inset-0 overflow-hidden bg-background">
      <div
        className="absolute top-1/2 left-1/2"
        style={{ width, height, transform: `translate(-50%, -50%) scale(${scale})` }}
      >
        <div className="relative h-full w-full">
          <AnimatePresence mode="wait">
            <ActiveSlide key={currentSlide} />
          </AnimatePresence>
        </div>
      </div>

      <PresentationChrome
        currentSlide={currentSlide}
        slideCount={slideCount}
        onNext={next}
        onPrev={prev}
        onGoTo={goTo}
        visible={!presentationMode}
      />
    </div>
  )
}

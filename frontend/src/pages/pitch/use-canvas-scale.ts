import { useEffect, useState } from "react"

const CANVAS_WIDTH = 1920
const CANVAS_HEIGHT = 1080

/**
 * Every slide is designed against a fixed 1920x1080 canvas. This computes
 * the uniform scale factor to fit that canvas into the real viewport
 * (letterboxed, never cropped, never distorted) — the same technique real
 * presentation software uses so one layout works at any display resolution
 * without per-breakpoint redesign.
 */
export function useCanvasScale() {
  const [scale, setScale] = useState(1)

  useEffect(() => {
    let raf = 0
    function measure() {
      const vw = window.innerWidth
      const vh = window.innerHeight
      setScale(Math.min(vw / CANVAS_WIDTH, vh / CANVAS_HEIGHT))
    }
    function onResize() {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener("resize", onResize)
    return () => {
      window.removeEventListener("resize", onResize)
      cancelAnimationFrame(raf)
    }
  }, [])

  return { scale, width: CANVAS_WIDTH, height: CANVAS_HEIGHT }
}

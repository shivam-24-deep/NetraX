import { useCallback, useEffect, useRef, useState } from "react"

const LOCK_MS = 650 // matches the slide transition duration — one gesture, one slide
const WHEEL_THRESHOLD = 40

export function usePresentationNav(slideCount: number) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [presentationMode, setPresentationMode] = useState(false)
  const currentSlideRef = useRef(0)
  const locked = useRef(false)
  const wheelAccum = useRef(0)

  const lock = useCallback(() => {
    locked.current = true
    window.setTimeout(() => {
      locked.current = false
    }, LOCK_MS)
  }, [])

  const goTo = useCallback(
    (index: number) => {
      if (locked.current) return
      const clamped = Math.max(0, Math.min(slideCount - 1, index))
      if (clamped === currentSlideRef.current) return
      currentSlideRef.current = clamped
      setCurrentSlide(clamped)
      lock()
    },
    [lock, slideCount],
  )

  const next = useCallback(() => goTo(currentSlideRef.current + 1), [goTo])
  const prev = useCallback(() => goTo(currentSlideRef.current - 1), [goTo])

  // Prevent normal page scroll while the deck is mounted; restore on unmount.
  useEffect(() => {
    const prevHtmlOverflow = document.documentElement.style.overflow
    const prevBodyOverflow = document.body.style.overflow
    document.documentElement.style.overflow = "hidden"
    document.body.style.overflow = "hidden"
    return () => {
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = prevBodyOverflow
    }
  }, [])

  // Registered once (stable identity, StrictMode-safe): reads next/prev/goTo
  // via refs rather than closing over per-render values, so there is never a
  // window with two listeners attached, or a listener holding a stale
  // `locked` check — both of which caused an intermittent double-advance in
  // testing before this refactor.
  const nextRef = useRef(next)
  const prevRef = useRef(prev)
  nextRef.current = next
  prevRef.current = prev

  useEffect(() => {
    function onWheel(e: WheelEvent) {
      e.preventDefault()
      if (locked.current) return
      wheelAccum.current += e.deltaY
      if (Math.abs(wheelAccum.current) > WHEEL_THRESHOLD) {
        if (wheelAccum.current > 0) nextRef.current()
        else prevRef.current()
        wheelAccum.current = 0
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowRight":
        case "ArrowDown":
        case " ":
        case "PageDown":
          e.preventDefault()
          nextRef.current()
          break
        case "ArrowLeft":
        case "ArrowUp":
        case "PageUp":
          e.preventDefault()
          prevRef.current()
          break
        case "f":
        case "F":
        case "p":
        case "P":
          e.preventDefault()
          setPresentationMode((v) => {
            const next = !v
            if (next && document.documentElement.requestFullscreen) {
              document.documentElement.requestFullscreen().catch(() => {})
            } else if (!next && document.fullscreenElement && document.exitFullscreen) {
              document.exitFullscreen().catch(() => {})
            }
            return next
          })
          break
      }
    }

    window.addEventListener("wheel", onWheel, { passive: false })
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("wheel", onWheel)
      window.removeEventListener("keydown", onKeyDown)
    }
  }, [])

  return { currentSlide, slideCount, next, prev, goTo, presentationMode }
}

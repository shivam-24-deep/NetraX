# NetraX Web Pitch — QA Report

**Update 3**: added an 11th closing "Thank You" slide, and a "Replay
Investigation" button on the Investigation Control Room slide (slide 6) —
clicking it forces the entire panel/timeline/risk-score animation sequence
to reset and replay from scratch (implemented via a `key`-bump on a
`display: contents` wrapper, which forces Framer Motion's `initial`→
`animate` transitions to re-run without affecting layout). Verified: click
resets all panels to their pre-animation state, then fully re-settles
including the risk-score count-up reaching 87 again. Full 1→11→1 keyboard
navigation re-tested, zero console errors, clean production build.

**Update 2**: significantly increased element/text sizes and added more
content per slide in response to "very small, content is short" feedback
(bigger headlines, bigger stat numbers, bigger cards, additional detail
lines/rows on every slide). This introduced a real overflow bug on "The
Shift" (slide 3) — the closing headline was clipped below the visible
canvas because the enlarged 6-step NetraX column pushed total content
height past the 936px safe area. Fixed by tightening inter-element spacing
(not shrinking text) on that slide specifically. Re-screenshotted all 10
slides at full settle time after the fix: no clipping anywhere, zero
console errors, clean `tsc` + production build, full forward/backward
keyboard navigation re-verified.

**Update**: expanded from 6 to 10 slides (added The Threat, Dynamic
Investigation, Real Results, Threat Intelligence & Geolocation) after a
follow-up request to add more content grounded in the actual project —
metrics pulled live from `ml/models/model_metadata.json`, test counts
re-verified by re-running the full suite (203 passing), not carried over
from memory. Re-tested end-to-end after expansion: full forward (1→10) and
backward (10→1) keyboard navigation, zero console errors. One real layout
bug found and fixed during this pass: the "Dynamic Investigation" slide's
6 tool nodes were placed in a semicircle (-90° to 90°), leaving the left
half of their container empty — changed to an evenly-spaced full circle
(60° apart), which both looks properly balanced and reads better as an
"orbit."

Tested 2026-09-07 against the running Vite dev server, driven by Playwright
(`playwright-core`, pointed at the system's installed Edge browser via
`executablePath` — no browser download was needed/available in this
sandbox; see `docs/FINAL_STATUS.md` for why the main app's own QA couldn't
get a screenshot, and how this pitch deck's QA did).

## What was actually tested

| Check | Method | Result |
|---|---|---|
| All 6 slides render with real content | Screenshot each slide after full entrance animation | ✅ Pass — see screenshots taken during this session |
| Zero console/page errors across a full run | `page.on("console"/"pageerror")` while navigating all slides + resizing | ✅ Zero errors |
| Keyboard navigation (→ ↓ Space PageDown / ← ↑ PageUp) | Pressed each key, asserted `aria-current` slide | ✅ Advances/retreats exactly one slide per press |
| Click navigation (dots, arrow buttons) | Clicked each control | ✅ Jumps/advances correctly |
| Canvas scaling across resolutions | Screenshotted the same slide at 1920×1080 and 1366×768 | ✅ Identical composition, uniformly scaled, zero clipping |
| `prefers-reduced-motion` | `page.emulateMedia({ reducedMotion: "reduce" })`, then navigated | ✅ Navigation still works; `SlideShell` swaps to a plain opacity cross-fade (no scale/slide) per `useReducedMotion()` |
| Production build | `npm run build` | ✅ Clean, no errors (only Vite's routine "large chunk" advisory, unrelated to the pitch code) |
| TypeScript | `tsc -b --noEmit` | ✅ Clean |

## A real bug found and fixed during this QA pass

Initial wheel-debounce testing showed occasional double-slide-advances from
a single burst of wheel events. Root-caused with instance-tagged debug
logging (not guessed): the debounce logic itself was correct on every
individual check, but the **event listener was being re-registered on every
slide change** (its `useEffect` depended on `[next, prev]`, which were
recreated whenever `currentSlide` changed) — a textbook source of subtle
timing bugs. Fixed by making `goTo`/`next`/`prev` fully stable (reading
`currentSlide` from a ref instead of a closure) and registering the wheel/
keyboard listeners exactly once (`useEffect(..., [])`), with the handlers
reading the latest `next`/`prev` via refs. Re-verified with the same
instance-tagged logging: confirmed the debounce logic was mathematically
correct throughout (each lock cycle correctly swallowed events and only
unlocked after the full 650ms), and the fix eliminates the re-subscription
churn as an additional source of risk.

**Note on burst-testing methodology**: dispatching many synthetic wheel
events through Playwright/CDP one-at-a-time has real per-call round-trip
latency — a "rapid" 15-event synthetic burst can take longer in wall-clock
time than a real trackpad gesture (which fires natively, much faster). This
means CDP-driven burst tests are not a perfectly faithful reproduction of
real input timing; the debug-logged trace (not just pass/fail) was what
actually confirmed correctness, not the raw burst test outcome alone.

## Not tested (honest gaps)

- **Real mouse/trackpad hardware** — only synthetic `page.mouse.wheel()` and
  keyboard events were exercised. The mobile-fallback breakpoint (<820px)
  was verified via `setViewportSize`, not a real phone.
- **Fullscreen API / presentation-mode toggle (`f`/`p` key)** — the code
  path was reviewed and the chrome-hide behavior verified, but
  `requestFullscreen()` itself requires a real user gesture in some browser
  security models and was not exercised end-to-end in headless automation.
- **Cross-browser** (Firefox, Safari) — only Chromium-based (Edge) was
  available for testing in this environment.
- **Screen reader** pass — semantic elements (`<nav>`, `aria-label`,
  `aria-current`) are in place by construction, but no actual screen-reader
  software was run against it.

## How to run it

```bash
cd frontend && npm run dev
```

Open `http://localhost:5173/pitch`. Navigate with the mouse wheel, arrow
keys, space, or the on-screen dots/arrows. Press `f` or `p` for
presentation mode (fullscreen + hidden chrome).

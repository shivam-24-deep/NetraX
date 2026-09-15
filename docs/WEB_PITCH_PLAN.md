# NetraX Web Pitch — Implementation Plan

A browser-based, full-screen, keynote-style presentation for SIH26106,
superseding an earlier scroll-based draft per explicit correction: **one
slide occupies exactly 100vw×100vh at all times, navigated discretely**
(wheel/arrow/space/click), never a scrolling page.

## Where it lives

New standalone route `/pitch`, registered in `App.tsx` **outside**
`ProtectedRoute`/`AppLayout` — it's a public pitch deck, not part of the
authenticated app, and must not carry the dashboard's sidebar/topbar chrome.
Existing app code is untouched; this is purely additive.

```
frontend/src/pages/pitch/
  index.tsx                  PitchPage — slide state, canvas scaling, mounts chrome + active slide
  chrome.tsx                 PresentationChrome — logo, counter, arrows, progress dots
  use-presentation-nav.ts    wheel/keyboard navigation hook (debounced, single-step)
  use-canvas-scale.ts        computes uniform scale to fit a fixed 1920x1080 canvas into any viewport
  slide-shell.tsx            per-slide 100%x100% container + entrance-animation wrapper
  slides/
    slide-1-hero.tsx
    slide-2-shift.tsx
    slide-3-architecture.tsx
    slide-4-control-room.tsx
    slide-5-impact.tsx
    slide-6-research.tsx
  components/                slide-specific visual pieces (email mockup, risk dial,
                              evidence-graph mini render, architecture layer, etc.)
```

## Design system (reused, not reinvented)

The existing app's dark theme in `index.css` is already exactly the
requested palette: deep navy background (`oklch(0.14 0.017 262)`), blue
primary (`oklch(0.68 0.16 246)`), a teal chart color (`chart-2`,
`oklch(0.72 0.13 190)`), and existing risk colors (low=green, medium=amber,
high=red, critical=deep red). The pitch deck reuses these CSS variables
directly for brand consistency — no new palette introduced.

Typography: existing Inter (body) + JetBrains Mono (technical/metadata
labels) already loaded in `index.html`.

## Full-screen + scaling strategy

Every slide is designed against a fixed **1920×1080 reference canvas**.
`use-canvas-scale.ts` measures the real viewport and computes
`scale = min(vw/1920, vh/1080)`, applied via CSS `transform: scale(...)` on
a centered wrapper. This guarantees the exact same layout (no reflow, no
per-breakpoint redesign) at 1920×1080, 1600×900, 1440×900, 1366×768, and
1280×720 — the composition just scales uniformly, which is how real keynote
software handles varying projector/display resolutions. A resize listener
(rAF-throttled) recomputes the scale live.

Below ~900px viewport width (phones/small tablets), the fixed-canvas
approach stops making sense visually (16:9 at tiny scale is unreadable) —
see §QA for the mobile fallback decision.

## Navigation model

`use-presentation-nav.ts`:
- Owns `currentSlide` (0-5) and a `locked` ref (not state, to avoid stale
  closures in event handlers).
- **Wheel**: accumulates `deltaY`; once `|Σdelta| > 40`, advances exactly
  one slide, then locks input for the transition duration (~650ms) before
  accepting the next gesture — this is the debounce that prevents a single
  aggressive trackpad/mouse-wheel gesture from skipping multiple slides.
- **Keyboard**: `ArrowRight`/`ArrowDown`/`Space`/`PageDown` → next;
  `ArrowLeft`/`ArrowUp`/`PageUp` → previous. Same lock reused.
- **Click**: Next/Previous buttons and progress dots (jump-to-slide),
  respecting the same lock.
- Body scroll is disabled (`overflow: hidden` on `<html>`/`<body>`) only
  while `/pitch` is mounted, restored on unmount — the rest of the app is
  unaffected.
- `f` or `p` toggles **presentation mode**: requests the browser Fullscreen
  API and hides the chrome overlay, leaving only slide content + minimal
  arrows.

## Animation strategy

Framer Motion, respecting `useReducedMotion()` (near-instant cross-fades,
no directional slide, when the user has reduced-motion enabled — the one
accessibility-mandated exception to "smooth/cinematic").

- **Slide transition**: exiting slide fades + scales 1→0.98; entering slide
  fades + scales 0.98→1, ~550-650ms, `easeOut`. No bounce.
- **Per-slide entrance choreography** (staggered `motion.div` children,
  driven by the slide-shell's `AnimatePresence` `onAnimationComplete` or a
  simple stagger delay) — each slide's specific sequence is detailed inline
  in that slide's component (see §Slides below), matching the brief's
  per-slide animation spec.
- Line-drawing (SVG `pathLength` 0→1) for connector lines, a counting
  number for the risk score, and progressive-reveal for lists — all real
  Framer Motion primitives, not GIFs/video.

## Slides (expanded to 10 — content mapped from the full 17-section brief,
plus real project facts pulled from `docs/FINAL_STATUS.md`, `ml/models/
model_metadata.json`, and the actual test suite, per the "add more content,
analyze the full project first" follow-up request)

1. **Hero** — email mockup with forensic markers (display-name mismatch,
   lookalike domain, suspicious URL, auth anomaly) animating in, connecting
   to the NetraX agent, revealing a HIGH RISK score. Headline: "FROM
   SUSPICIOUS EMAIL TO FORENSIC INTELLIGENCE."
2. **The Threat** — a realistic inbox (CEO request, invoice, security alert,
   bank notification, password reset) with one email flagged, forensic
   signals emerging. "Attackers exploit identity, infrastructure and human
   trust — not just malicious keywords."
3. **The Shift** — traditional classifier (dead-ends at "Suspicious") vs.
   NetraX's investigate→correlate→explain→act path. "Detection tells you
   WHAT. NetraX investigates WHY."
4. **Dynamic Investigation** — the agent orbiting its 6 real tools (Email
   Parser, Header Forensics, Content Analysis, URL Analysis, Threat
   Intelligence, IP Geolocation) with explicit conditional rules ("no URL →
   URL/threat-intel tools skipped, not called-and-ignored") — the actual
   mechanism verified by `agent/orchestrator.test.ts`.
5. **Architecture** — single connected vertical pipeline diagram (Email →
   Agent → Dynamic Tools → Forensic Analysis → Threat Intel → IP/ASN/Geo →
   Evidence Fusion → Risk Engine → Case/Report).
6. **Investigation Control Room** — the hero product-demo scene: real
   layout (email panel / timeline / risk panel / evidence graph) matching
   the actual product's Investigate page, with the timeline animating
   through real tool names and the risk score counting 0→87.
7. **Real Results** — the differentiator slide: actual trained-model
   metrics (email classifier F1=0.961/ROC-AUC=0.998; URL classifier
   F1=0.954/ROC-AUC=0.993), 203 passing automated tests (169 TS + 34
   Python), and three real bugs found and fixed while testing against real
   data (CRLF header parsing, IPv6 "::" compression, a short-domain
   typosquat false positive) — proof of engineering rigor, not a claim.
8. **Threat Intelligence & Geolocation** — PhishTank/URLhaus MATCH/NOT
   FOUND/UNAVAILABLE states with "NOT FOUND ≠ SAFE" called out explicitly;
   MaxMind geolocation always framed as approximate infrastructure, never
   an exact address or identity.
9. **Impact** — before/after transformation (manual multi-tool correlation
   vs. agentic investigation) ending on DETECT / INVESTIGATE / EXPLAIN.
10. **Research + Close** — compact source map (Enron, SpamAssassin, UCI
    Phishing, PhishTank, URLhaus, MaxMind, SPF/DKIM/DMARC) converging to a
    final NetraX statement and SIH26106 identity.

## Technical accuracy guardrails (carried from the main app's own rules)

- Geolocation always labeled "Approximate infrastructure geolocation."
- Threat-intel "no match" always labeled "No match found," never "Safe."
- Any real metric shown (if referenced) must come from
  `ml/models/model_metadata.json` — this deck currently uses **illustrative
  numbers for the pitch narrative** (e.g. the "87 HIGH RISK" demo score),
  clearly a demo scenario, not presented as a specific real case's output.
- No claim of exact attacker identity or 100% accuracy anywhere in copy.

## QA

See `docs/WEB_PITCH_QA.md` for the actual test pass (resolutions, input
methods, console errors, reduced-motion, mobile fallback decision).

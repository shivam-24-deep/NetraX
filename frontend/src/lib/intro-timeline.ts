/**
 * Single source of truth for the NetraX opening-cinematic timeline (see
 * NetraXLogoReveal / IntroReveal). Every entrance delay/duration on the
 * login screen reads from here instead of scattering magic numbers.
 */
export const INTRO_TIMELINE = {
  logoFade: { delay: 0.2, duration: 0.6 },
  logoTravel: { delay: 1.0, duration: 0.85 },
  leftReveal: { delay: 1.2, duration: 1.0 },
  rightReveal: { delay: 2.0, duration: 0.7 },
  mobileReveal: { delay: 0.25, duration: 0.5 },
} as const

export const INTRO_EASE = [0.22, 1, 0.36, 1] as const

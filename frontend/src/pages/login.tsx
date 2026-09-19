import { Navigate, useLocation, useSearchParams } from "react-router-dom"

import { AuthPanel } from "@/components/auth/auth-panel"
import { IntroReveal } from "@/components/auth/intro-reveal"
import { InvestigationPreview } from "@/components/auth/investigation-preview"
import { NetraXLogoReveal } from "@/components/auth/netrax-logo-reveal"
import { useAuth } from "@/lib/auth"
import { INTRO_TIMELINE } from "@/lib/intro-timeline"
import { useMediaQuery } from "@/lib/use-media-query"

export default function LoginPage() {
  const { session } = useAuth()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const isMdUp = useMediaQuery("(min-width: 768px)")

  if (session) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/dashboard"
    return <Navigate to={redirectTo} replace />
  }

  const defaultTab = searchParams.get("tab") === "sign-up" ? "sign-up" : "sign-in"

  return (
    <div className="bg-grid grid min-h-svh grid-cols-1 md:grid-cols-[55fr_45fr] lg:grid-cols-[60fr_40fr]">
      <div className="border-border/60 relative hidden overflow-hidden border-r md:block">
        <div className="absolute top-6 left-8 lg:left-16">
          <NetraXLogoReveal />
        </div>
        <IntroReveal
          delay={INTRO_TIMELINE.leftReveal.delay}
          duration={INTRO_TIMELINE.leftReveal.duration}
          x={-24}
          className="h-full"
        >
          <InvestigationPreview />
        </IntroReveal>
      </div>

      <div className="flex flex-col items-center justify-center gap-8 px-6 py-10">
        <IntroReveal
          delay={INTRO_TIMELINE.mobileReveal.delay}
          duration={INTRO_TIMELINE.mobileReveal.duration}
          y={-12}
          className="flex flex-col items-center gap-8 md:hidden"
        >
          <div className="flex items-center gap-2">
            <img src="/assets/netrax-icon.png?v=2" alt="" className="size-8 object-contain" />
            <span className="text-lg font-semibold tracking-tight">NetraX</span>
          </div>
          <div className="w-full max-w-sm">
            <MobileInvestigationSummary />
          </div>
        </IntroReveal>

        <IntroReveal
          delay={isMdUp ? INTRO_TIMELINE.rightReveal.delay : INTRO_TIMELINE.mobileReveal.delay}
          duration={isMdUp ? INTRO_TIMELINE.rightReveal.duration : INTRO_TIMELINE.mobileReveal.duration}
          x={isMdUp ? 24 : 0}
          y={isMdUp ? 0 : 12}
        >
          <AuthPanel defaultTab={defaultTab} />
        </IntroReveal>
      </div>
    </div>
  )
}

function MobileInvestigationSummary() {
  return (
    <div className="glass-panel flex flex-col gap-1 rounded-lg px-4 py-3 text-center">
      <span className="text-primary text-xs font-semibold tracking-wide uppercase">
        AI-Powered Communication Forensics
      </span>
      <p className="text-muted-foreground text-sm">
        Investigate suspicious communications with investigator-ready evidence.
      </p>
    </div>
  )
}

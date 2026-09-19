import { motion } from "framer-motion"
import {
  ArrowRight,
  FileSearch,
  Globe2,
  Link2,
  Network,
  ScanSearch,
  ShieldAlert,
  Smartphone,
} from "lucide-react"
import { Link } from "react-router-dom"

import { Button } from "@/components/ui/button"
import { useAuth } from "@/lib/auth"

const CAPABILITIES = [
  {
    icon: FileSearch,
    title: "Header forensics",
    body: "SPF, DKIM and DMARC results, display-name spoofing, Reply-To mismatches and Received-chain anomalies — each finding cites its literal evidence.",
  },
  {
    icon: Link2,
    title: "URL analysis",
    body: "Structural phishing indicators, homoglyph and typosquat domains, plus a trained ML model that scores every link.",
  },
  {
    icon: ShieldAlert,
    title: "Threat intelligence",
    body: "PhishTank and URLhaus lookups. “Not found” is never reported as safe, and an unreachable provider says so.",
  },
  {
    icon: Globe2,
    title: "Geolocation",
    body: "MaxMind country and ASN for public source IPs only, always shown as approximate infrastructure location.",
  },
  {
    icon: Network,
    title: "Evidence graph",
    body: "Email → sender → domain → IP → ASN → country, as an interactive graph. Click any node to inspect its evidence.",
  },
  {
    icon: Smartphone,
    title: "Send from your phone",
    body: "Scan a QR code or share from Gmail straight into NetraX and get an investigation without copy-pasting.",
  },
]

const STEPS = [
  { n: "01", title: "Submit", body: "Paste or upload a raw email, or send a suspicious link." },
  { n: "02", title: "Investigate", body: "An agent picks only the tools that apply and runs them, logging every skip." },
  { n: "03", title: "Decide", body: "Get a deterministic 0–100 risk score, the evidence behind it, and a forensic report." },
]

export default function LandingPage() {
  const { session } = useAuth()
  const signedIn = !!session

  return (
    <div className="bg-grid min-h-svh">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <img src="/assets/netrax-icon.png?v=2" alt="" className="size-8 object-contain" />
          <span className="text-lg font-semibold tracking-tight">NetraX</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
            <Link to="/pitch">Pitch deck</Link>
          </Button>
          {signedIn ? (
            <Button asChild size="sm">
              <Link to="/dashboard">Open dashboard</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild size="sm">
                <Link to="/login?tab=sign-up">Get started</Link>
              </Button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="mx-auto max-w-4xl px-6 pt-16 pb-20 text-center sm:pt-24">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <span className="text-primary border-primary/30 bg-primary/5 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium">
              <ScanSearch className="size-3.5" />
              Smart India Hackathon 2026 · SIH26106
            </span>
            <h1 className="mt-6 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
              Email threat detection with <span className="text-gradient">forensic-grade evidence</span>
            </h1>
            <p className="text-muted-foreground mx-auto mt-5 max-w-2xl text-base text-pretty sm:text-lg">
              NetraX investigates suspicious emails and links with an agentic pipeline, scores them deterministically,
              and shows exactly why — every finding traceable to its source.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to={signedIn ? "/dashboard" : "/login?tab=sign-up"}>
                  {signedIn ? "Open dashboard" : "Create your account"}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
              {!signedIn && (
                <Button asChild size="lg" variant="outline">
                  <Link to="/login">Sign in</Link>
                </Button>
              )}
            </div>
          </motion.div>
        </section>

        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map(({ icon: Icon, title, body }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: (i % 3) * 0.06 }}
                className="glass-panel flex flex-col gap-3 rounded-xl p-5"
              >
                <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                  <Icon className="size-4.5" />
                </span>
                <h3 className="font-semibold">{title}</h3>
                <p className="text-muted-foreground text-sm">{body}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-6 pb-24">
          <h2 className="mb-8 text-center text-2xl font-semibold tracking-tight">How it works</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="glass-panel rounded-xl p-5">
                <span className="text-primary font-mono text-sm">{s.n}</span>
                <h3 className="mt-2 font-semibold">{s.title}</h3>
                <p className="text-muted-foreground mt-1 text-sm">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-border/60 border-t">
        <div className="text-muted-foreground mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-6 py-6 text-xs sm:flex-row">
          <span>NetraX — an SIH hackathon prototype, not a substitute for official cybercrime reporting.</span>
          <a href="https://cybercrime.gov.in" target="_blank" rel="noreferrer" className="hover:text-foreground underline">
            cybercrime.gov.in
          </a>
        </div>
      </footer>
    </div>
  )
}

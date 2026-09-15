import { Radar } from "lucide-react"

const SECTIONS = [
  {
    title: "From suspicious email to forensic intelligence",
    body: "NetraX is agentic AI for email threat detection & forensic intelligence — built for SIH26106.",
  },
  {
    title: "Today's attacks don't always look malicious",
    body: "Attackers exploit identity, infrastructure and human trust — not just malicious keywords.",
  },
  {
    title: "Detection tells you WHAT. NetraX investigates WHY.",
    body: "A classifier stops at \"suspicious.\" NetraX investigates, correlates evidence, explains its reasoning, and recommends an action.",
  },
  {
    title: "Dynamic tool selection",
    body: "No URL in the email? URL analysis and threat intelligence are skipped entirely — not called and ignored. Every skip is logged with a reason, verified by automated tests.",
  },
  {
    title: "How it investigates",
    body: "Email → AI Agent → Dynamic Tools → Forensic Analysis → Threat Intelligence → IP/ASN/Geo → Evidence Fusion → Risk Engine → Case Report.",
  },
  {
    title: "Investigation Control Room",
    body: "Submitted email, live investigation timeline, and an explainable risk score — every finding traces to real evidence.",
  },
  {
    title: "Not a mockup — real numbers",
    body: "Email content classifier: F1=0.961, ROC-AUC=0.998. URL phishing classifier: F1=0.954, ROC-AUC=0.993. 203 automated tests passing (169 TypeScript + 34 Python), with real bugs found and fixed along the way.",
  },
  {
    title: "External confirmation, honestly reported",
    body: "PhishTank + URLhaus threat intelligence. \"Not found\" is never presented as \"safe.\" Geolocation is always approximate infrastructure location, never an exact address or identity.",
  },
  {
    title: "The impact",
    body: "From manual, multi-tool correlation to agentic investigation with correlated evidence and faster, explainable action.",
  },
  {
    title: "Research foundation",
    body: "Enron, SpamAssassin, UCI Phishing, PhishTank, URLhaus, MaxMind GeoLite, and SPF/DKIM/DMARC standards.",
  },
  {
    title: "Thank you",
    body: "203 real tests, 10 real pipeline layers, 6 real investigation tools. Questions welcome — SIH 2026 · SIH26106.",
  },
]

/** Below ~820px width, the fixed 1920x1080 keynote canvas isn't a usable
 * experience (text would scale to unreadable sizes) — this is a genuinely
 * different, simpler layout for phones/small tablets, not the same
 * cinematic deck shrunk down. */
export function MobileFallback() {
  return (
    <div className="min-h-screen bg-background px-6 py-10 text-foreground">
      <div className="mb-8 flex items-center gap-2">
        <Radar className="size-5 text-primary" aria-hidden />
        <span className="font-mono text-sm font-semibold tracking-[0.2em]">NETRAX</span>
      </div>
      <p className="mb-10 font-mono text-xs tracking-[0.2em] text-muted-foreground uppercase">SIH 2026 · SIH26106</p>

      <div className="flex flex-col gap-10">
        {SECTIONS.map((s) => (
          <div key={s.title} className="border-l-2 border-primary/40 pl-4">
            <h2 className="mb-2 text-lg font-semibold tracking-tight">{s.title}</h2>
            <p className="text-sm text-muted-foreground">{s.body}</p>
          </div>
        ))}
      </div>

      <p className="mt-12 text-xs text-muted-foreground">
        View this page on a larger screen (laptop/desktop) for the full interactive presentation.
      </p>
    </div>
  )
}

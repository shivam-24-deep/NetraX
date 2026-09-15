import { Circle, Document, Line, Page, Svg, Text, View } from "@react-pdf/renderer"
import type { ReactNode } from "react"

import { NetraXMark, NetraXWordmark } from "./logo"
import {
  Callout,
  ControlBar,
  DataTable,
  EvidenceGraphDiagram,
  FindingCard,
  KeyValue,
  MetadataGrid,
  MonospaceBlock,
  RankedFindingCard,
  RelationshipFlow,
  ReportFooter,
  RiskScoreBar,
  SectionTitle,
  StatCard,
  StatusPill,
  VerticalTimeline,
} from "./pdf-primitives"
import { COLORS, riskColor, styles } from "./pdf-styles"
import type { ReportModel } from "./report-model"

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
  } catch {
    return iso
  }
}

const COVER_TITLE: Record<string, string> = {
  EMAIL: "AI-POWERED EMAIL THREAT\nFORENSIC INTELLIGENCE REPORT",
  URL: "URL / DOMAIN THREAT\nINTELLIGENCE REPORT",
  SMS: "MESSAGE THREAT\nINVESTIGATION REPORT",
  MESSAGE: "MESSAGE THREAT\nINVESTIGATION REPORT",
  TRANSACTION: "TRANSACTION FRAUD\nINVESTIGATION REPORT",
}
const COVER_NODES: Record<string, string[]> = {
  EMAIL: ["EMAIL", "SENDER", "DOMAIN", "URL / IP", "THREAT INTEL", "EVIDENCE"],
  URL: ["URL", "DOMAIN", "IP", "ASN", "THREAT INTEL", "EVIDENCE"],
  SMS: ["MESSAGE", "SENDER", "INDICATORS", "EVIDENCE"],
  MESSAGE: ["MESSAGE", "SENDER", "INDICATORS", "EVIDENCE"],
  TRANSACTION: ["TRANSACTION", "ACCOUNT", "DEVICE", "BEHAVIOR", "EVIDENCE"],
}

function Page_({ title, model, children }: { title: string; model: ReportModel; children: ReactNode }) {
  return (
    <Page size="A4" style={styles.page}>
      <ControlBar title={title} caseId={model.caseId} reportVersion={model.reportVersion} />
      <ReportFooter caseId={model.caseId} />
      {children}
    </Page>
  )
}

export function ForensicReportDocument({ model }: { model: ReportModel }) {
  const color = riskColor(model.riskLevel)

  return (
    <Document
      title={`NetraX Forensic Investigation Report — ${model.caseId}`}
      author="NetraX"
      subject="Email Threat Forensic Analysis"
      creator="NetraX Agentic AI Email Threat Detection & Forensic Intelligence Platform"
      keywords="NetraX, Email Forensics, Threat Intelligence, Cybersecurity"
    >
      {/* COVER */}
      <Page size="A4" style={{ ...styles.page, paddingTop: 0, paddingBottom: 0, paddingHorizontal: 0 }}>
        <View style={{ position: "absolute", top: 14, left: 14, right: 14, bottom: 14, borderWidth: 1.5, borderColor: color }} />
        <View style={{ position: "absolute", top: 20, left: 20, right: 20, bottom: 20, borderWidth: 0.5, borderColor: COLORS.border }} />

        <View style={{ padding: 52, flex: 1, justifyContent: "space-between" }}>
          <View>
            <Text style={styles.classification}>NETRAX FORENSIC REPORT · CONFIDENTIAL — INVESTIGATION ARTIFACT</Text>
            <View style={{ marginTop: 22 }}>
              <NetraXWordmark size={16} />
            </View>
            <Text style={{ fontSize: 21, fontFamily: "Helvetica-Bold", marginTop: 26, lineHeight: 1.3 }}>
              {COVER_TITLE[model.investigationType] ?? COVER_TITLE.EMAIL}
            </Text>

            <View style={{ marginTop: 34, borderTopWidth: 2, borderTopColor: color, width: 90 }} />

            <View style={{ marginTop: 30, flexDirection: "row", flexWrap: "wrap" }}>
              <KeyValue label="Case ID" value={model.caseId} />
              <KeyValue label="Investigation Token" value={model.investigationToken} />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              <View style={{ marginRight: 16, marginBottom: 6 }}>
                <Text style={styles.keyValueLabel}>Threat Level</Text>
                <View style={{ ...styles.badge, backgroundColor: `${color}22`, borderWidth: 1, borderColor: color, alignSelf: "flex-start", marginTop: 2 }}>
                  <Text style={{ color, fontSize: 12, fontFamily: "Helvetica-Bold" }}>{model.riskLevel}</Text>
                </View>
              </View>
              <KeyValue label="Investigation Type" value={model.investigationType} />
              <KeyValue label="Threat Type" value={model.threatType} />
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              <KeyValue label="Investigation Status" value={model.status.replaceAll("_", " ")} />
              <KeyValue label="Generated" value={fmt(model.generatedAt)} />
            </View>
          </View>

          <View style={{ alignItems: "center" }}>
            <Svg width={240} height={130}>
              {(
                [
                  [120, 12, 120, 34],
                  [120, 34, 120, 56],
                  [120, 56, 70, 78],
                  [120, 56, 170, 78],
                  [70, 78, 70, 100],
                  [170, 78, 170, 100],
                  [70, 100, 120, 122],
                  [170, 100, 120, 122],
                ] as [number, number, number, number][]
              ).map(([x1, y1, x2, y2], i) => (
                <Line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={COLORS.border} strokeWidth={1} />
              ))}
              {(
                [
                  [120, 12, COLORS.brand],
                  [120, 34, COLORS.medium],
                  [120, 56, COLORS.high],
                  [70, 78, color],
                  [170, 78, COLORS.critical],
                  [70, 100, COLORS.low],
                  [170, 100, COLORS.low],
                  [120, 122, COLORS.faint],
                ] as [number, number, string][]
              ).map(([cx, cy, c], i) => (
                <Circle key={i} cx={cx} cy={cy} r={4} fill={c} />
              ))}
            </Svg>
            <View style={{ flexDirection: "row", gap: 14, marginTop: 4 }}>
              {(COVER_NODES[model.investigationType] ?? COVER_NODES.EMAIL).map((l) => (
                <Text key={l} style={{ fontSize: 6, color: COLORS.faint, letterSpacing: 0.5 }}>
                  {l}
                </Text>
              ))}
            </View>
          </View>

          <View style={{ borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 12 }}>
            <View style={styles.spaceBetween}>
              <Text style={styles.faint}>Generated by NetraX — Agentic AI Email Threat Detection &amp; Forensic Intelligence Platform</Text>
              <NetraXMark size={12} />
            </View>
          </View>
        </View>
      </Page>

      {model.investigationType === "EMAIL" && (
        <>
      {/* AT A GLANCE */}
      <Page_ title="At a Glance" model={model}>
        <SectionTitle number="01" title="At a Glance" />
        <Text style={{ ...styles.muted, marginBottom: 10 }}>Everything in this box comes straight from the investigation below — read this page, understand the case.</Text>
        <View style={{ flexDirection: "row", marginBottom: 8 }}>
          <StatCard label="Risk Score" value={`${model.riskScore}/100`} tone={color} />
          <StatCard label="Severity" value={model.riskLevel} tone={color} />
          <StatCard label="Findings" value={String(model.atAGlance.findingCount)} />
          <StatCard label="Evidence Items" value={String(model.atAGlance.evidenceCount)} />
        </View>
        <View style={{ flexDirection: "row", marginBottom: 12 }}>
          <StatCard label="URLs Extracted" value={String(model.atAGlance.urlCount)} />
          <StatCard label="Source IPs" value={String(model.atAGlance.ipCount)} />
          <StatCard label="Threat-Intel Matches" value={String(model.atAGlance.threatIntelMatches)} />
          <StatCard label="Confidence" value={model.confidence} />
        </View>
        <MetadataGrid
          fields={[
            { label: "Sender", value: model.atAGlance.sender, source: "Email Identity", status: model.atAGlance.sender.startsWith("Not") ? "Missing" : "Present" },
            { label: "Sender Domain", value: model.atAGlance.domain, source: "Email Identity", status: model.atAGlance.domain.startsWith("Not") ? "Missing" : "Present" },
            { label: "Threat Classification", value: model.threatType, source: "Risk Engine", status: "Present" },
            { label: "Case Status", value: model.status.replaceAll("_", " "), source: "NetraX Case Management", status: "Present" },
          ]}
        />
      </Page_>

      {/* EXECUTIVE ASSESSMENT */}
      <Page_ title="Executive Assessment" model={model}>
        <SectionTitle number="02" title="Executive Assessment" />
        <Text style={styles.h3}>Assessment</Text>
        <Text style={{ ...styles.body, marginBottom: 12 }}>{model.executiveAssessment}</Text>

        <Text style={styles.h3}>Top Findings</Text>
        {model.topFindings.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.muted}>No significant risk indicators were found across the investigation.</Text>
          </View>
        ) : (
          model.topFindings.map((f) => <RankedFindingCard key={f.rank} {...f} />)
        )}

        <Text style={{ ...styles.h3, marginTop: 4 }}>Investigation Scope</Text>
        <View style={styles.table}>
          {model.investigationScope.map((m, i) => (
            <View key={m.module} style={{ ...styles.tableRow, ...(i % 2 === 1 ? styles.tableRowAlt : {}) }} wrap={false}>
              <Text style={{ ...styles.tableCell, width: "6%", color: m.executed ? COLORS.low : COLORS.faint, fontFamily: "Helvetica-Bold" }}>
                {m.executed ? "✓" : "—"}
              </Text>
              <Text style={{ ...styles.tableCell, width: "34%", fontFamily: "Helvetica-Bold" }}>{m.module}</Text>
              <Text style={{ ...styles.tableCell, width: "60%", color: COLORS.muted }}>{m.executed ? "Executed successfully." : `Skipped — ${m.reason}`}</Text>
            </View>
          ))}
        </View>
      </Page_>

      {/* EMAIL IDENTITY */}
      <Page_ title="Email Identity" model={model}>
        <SectionTitle number="03" title="Submitted Email &amp; Identity" />

        <Callout tone={model.emailFormat === "eml" ? "info" : "warn"}>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 8.5, marginBottom: 2 }}>Source &amp; Parsing Notes</Text>
          <Text style={{ ...styles.muted, color: COLORS.ink }}>{model.parsingNote}</Text>
        </Callout>

        <Text style={styles.h3}>Email Header Fields</Text>
        <MetadataGrid fields={model.emailFields} />

        <Text style={{ ...styles.h3, marginTop: 6 }}>Sender Identity Forensics</Text>
        <View style={{ ...styles.row, flexWrap: "wrap" }}>
          <KeyValue label="Display Name" value={model.senderDisplayName} />
          <KeyValue label="Email Address" value={model.senderAddress} />
          <KeyValue label="Sender Domain" value={model.senderDomain} />
        </View>
        <View style={{ ...styles.row, flexWrap: "wrap" }}>
          <KeyValue label="Reply-To Domain" value={model.replyToDomain} />
          <KeyValue label="Return-Path Domain" value={model.returnPathDomain} />
          <View style={{ marginRight: 16, marginBottom: 6 }}>
            <Text style={styles.keyValueLabel}>Identity Consistency</Text>
            <StatusPill
              label={model.identityConsistency === "Consistent" ? "✓ Consistent" : model.identityConsistency === "Mismatch" ? "✕ Mismatch" : model.identityConsistency === "Suspicious" ? "⚠ Suspicious" : "— Not Available"}
              tone={model.identityConsistency === "Consistent" ? "good" : model.identityConsistency === "Not Available" ? "neutral" : "bad"}
            />
          </View>
        </View>
        {model.identityConsistency !== "Not Available" && model.identityConsistency !== "Consistent" && (
          <Text style={{ ...styles.muted, marginBottom: 8 }}>{model.identityMismatchDetail}</Text>
        )}

        {model.identityFindings.length > 0 && (
          <>
            <Text style={{ ...styles.h3, marginTop: 4 }}>Identity Findings</Text>
            {model.identityFindings.map((f, i) => (
              <FindingCard key={i} {...f} />
            ))}
          </>
        )}

        <Text style={{ ...styles.h3, marginTop: 6 }}>Body Summary</Text>
        <MonospaceBlock text={model.bodySummary} />
      </Page_>

      {/* HEADER FORENSICS */}
      <Page_ title="Header Forensics" model={model}>
        <SectionTitle number="04" title="Header Forensics" />

        <Text style={styles.h3}>Authentication</Text>
        <DataTable
          columns={[
            { key: "mechanism", label: "Mechanism", width: "10%" },
            { key: "result", label: "Result", width: "16%" },
            { key: "alignment", label: "Alignment", width: "10%" },
            { key: "interpretation", label: "Interpretation", width: "50%" },
            { key: "confidence", label: "Confidence", width: "14%" },
          ]}
          rows={model.authRows}
        />

        <Text style={{ ...styles.h3, marginTop: 6 }}>Received Chain (chronological)</Text>
        {model.receivedChain.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.muted}>Not available in submitted email.</Text>
          </View>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeaderRow} fixed>
              <Text style={{ ...styles.tableCellHeader, width: "8%" }}>Hop</Text>
              <Text style={{ ...styles.tableCellHeader, width: "18%" }}>Source IP</Text>
              <Text style={{ ...styles.tableCellHeader, width: "74%" }}>Raw Received Header</Text>
            </View>
            {model.receivedChain.map((line, i) => (
              <View key={i} style={{ ...styles.tableRow, ...(i % 2 === 1 ? styles.tableRowAlt : {}) }} wrap={false}>
                <Text style={{ ...styles.tableCell, width: "8%" }}>{line.hop}</Text>
                <Text style={{ ...styles.tableCell, width: "18%", fontFamily: "Courier", fontSize: 7.5 }}>{line.sourceIp}</Text>
                <Text style={{ ...styles.tableCell, width: "74%", fontFamily: "Courier", fontSize: 6.5 }}>{line.raw}</Text>
              </View>
            ))}
          </View>
        )}

        {model.headerFindings.length > 0 && (
          <>
            <Text style={{ ...styles.h3, marginTop: 6 }}>Header Findings</Text>
            {model.headerFindings.map((f, i) => (
              <FindingCard key={i} {...f} />
            ))}
          </>
        )}

        <Text style={{ ...styles.h3, marginTop: 6 }}>Raw Header Evidence</Text>
        <MonospaceBlock text={model.rawHeaderBlock} />
        <Text style={styles.faint}>Complete original artifact available in the evidence package (original_email.eml).</Text>
      </Page_>

      {/* CONTENT FORENSICS */}
      <Page_ title="Content Forensics" model={model}>
        <SectionTitle number="05" title="Email Content Forensics" />
        <Text style={{ ...styles.muted, marginBottom: 8 }}>Language-pattern and social-engineering signals detected in the message body.</Text>

        {model.contentFindings.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.muted}>No content-language risk signals were detected in the message body.</Text>
          </View>
        ) : (
          model.contentFindings.map((f, i) => <FindingCard key={i} {...f} />)
        )}

        <Text style={{ ...styles.h3, marginTop: 6 }}>Content Risk Model</Text>
        {model.mlContent ? (
          <View style={styles.panel}>
            <View style={{ ...styles.row, flexWrap: "wrap" }}>
              <KeyValue label="Model" value={model.mlContent.model} />
              <KeyValue label="Prediction" value={model.mlContent.prediction} />
              <KeyValue label="Source" value={model.mlContent.source} />
            </View>
          </View>
        ) : (
          <View style={styles.panel}>
            <Text style={styles.muted}>No trained-model prediction was available for this content.</Text>
          </View>
        )}
      </Page_>

      {/* URL & DOMAIN INTELLIGENCE */}
      <Page_ title="URL & Domain Intelligence" model={model}>
        <SectionTitle number="06" title="URL &amp; Domain Intelligence" />

        <Text style={styles.h3}>URL Inventory</Text>
        <DataTable
          columns={[
            { key: "url", label: "URL", width: "40%" },
            { key: "hostname", label: "Hostname", width: "22%" },
            { key: "protocol", label: "Protocol", width: "10%" },
            { key: "length", label: "Length", width: "10%" },
            { key: "https", label: "HTTPS", width: "9%" },
            { key: "flags", label: "Flags", width: "9%" },
          ]}
          rows={model.urls.map((u) => ({
            url: u.url,
            hostname: u.hostname,
            protocol: u.protocol,
            length: String(u.length),
            https: u.https ? "Yes" : "No",
            flags: String(u.characteristics.length),
          }))}
        />

        {model.urls.map((u, i) => (
          <View key={i} style={styles.card} wrap={false}>
            <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", marginBottom: 4 }}>{u.url}</Text>
            <View style={{ ...styles.row, flexWrap: "wrap" }}>
              <KeyValue label="Domain" value={u.domain} />
              <KeyValue label="Path" value={u.path} />
              <KeyValue label="Query" value={u.query} />
              <KeyValue label="Subdomains" value={String(u.subdomainCount)} />
            </View>
            {u.characteristics.length === 0 ? (
              <Text style={styles.muted}>No suspicious structural characteristics detected for this URL.</Text>
            ) : (
              u.characteristics.map((c) => (
                <Text key={c.label} style={{ ...styles.muted, marginBottom: 1 }}>
                  • DETECTED — {c.label}
                </Text>
              ))
            )}
          </View>
        ))}

        {model.urlFindings.length > 0 && (
          <>
            <Text style={{ ...styles.h3, marginTop: 4 }}>URL Analysis Findings</Text>
            {model.urlFindings.map((f, i) => (
              <FindingCard key={i} {...f} />
            ))}
          </>
        )}

        <Text style={{ ...styles.h3, marginTop: 6 }}>Domain Intelligence</Text>
        <DataTable
          columns={[
            { key: "domain", label: "Domain", width: "26%" },
            { key: "tld", label: "TLD", width: "10%" },
            { key: "subdomainCount", label: "Subdomains", width: "12%" },
            { key: "https", label: "HTTPS", width: "13%" },
            { key: "registrar", label: "Registrar", width: "17%" },
            { key: "age", label: "Age", width: "11%" },
            { key: "reputation", label: "Reputation", width: "11%" },
          ]}
          rows={model.domainIntelligence.map((d) => ({ ...d, subdomainCount: String(d.subdomainCount) }))}
        />
      </Page_>

      {/* THREAT INTELLIGENCE */}
      <Page_ title="Threat Intelligence" model={model}>
        <SectionTitle number="07" title="Threat Intelligence" />
        <Callout tone="info">
          <Text style={{ ...styles.muted, color: COLORS.ink }}>NO MATCH does not mean safe. UNAVAILABLE does not mean safe — it means the provider was not reachable or configured. Matches are never fabricated.</Text>
        </Callout>

        {model.threatIntelFindings.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.muted}>Not applicable — no qualifying indicator required a threat-intelligence lookup.</Text>
          </View>
        ) : (
          model.threatIntelFindings.map((f, i) => <FindingCard key={i} {...f} />)
        )}
      </Page_>

      {/* INFRASTRUCTURE + GEOLOCATION */}
      <Page_ title="Infrastructure Intelligence" model={model}>
        <SectionTitle number="08" title="Infrastructure Intelligence" />
        <Text style={styles.sectionEyebrow}>APPROXIMATE INFRASTRUCTURE GEOLOCATION</Text>

        <DataTable
          columns={[
            { key: "ip", label: "Source IP", width: "22%" },
            { key: "asn", label: "ASN", width: "14%" },
            { key: "organization", label: "Organization", width: "32%" },
            { key: "country", label: "Country", width: "16%" },
            { key: "region", label: "Region", width: "16%" },
          ]}
          rows={model.infraNodes.map((n) => ({ ...n, region: "NOT AVAILABLE" }))}
        />

        {model.infraNodes.length > 0 && (
          <RelationshipFlow steps={["EMAIL", "RECEIVED HEADER", `SOURCE IP · ${model.infraNodes[0].ip}`, "ASN", "NETWORK", "APPROXIMATE GEOLOCATION"]} />
        )}

        {model.infraFindings.length > 0 && (
          <>
            <Text style={{ ...styles.h3, marginTop: 6 }}>Infrastructure Findings</Text>
            {model.infraFindings.map((f, i) => (
              <FindingCard key={i} {...f} />
            ))}
          </>
        )}

        <View style={{ ...styles.panel, marginTop: 4 }}>
          <Text style={styles.muted}>IP geolocation is approximate and does not establish the attacker's exact physical location or identity.</Text>
        </View>
      </Page_>

      {/* EVIDENCE GRAPH */}
      <Page_ title="Evidence Graph" model={model}>
        <SectionTitle number="09" title="Evidence Graph" />
        <Text style={{ ...styles.muted, marginBottom: 8 }}>Built only from evidence actually correlated in this investigation.</Text>
        <EvidenceGraphDiagram graph={model.evidenceGraph} />
      </Page_>

      {/* EVIDENCE INVENTORY */}
      <Page_ title="Evidence Inventory" model={model}>
        <SectionTitle number="10" title="Evidence Inventory" />
        <DataTable
          columns={[
            { key: "id", label: "ID", width: "10%" },
            { key: "type", label: "Type", width: "16%" },
            { key: "value", label: "Value", width: "32%" },
            { key: "source", label: "Source", width: "16%" },
            { key: "severity", label: "Severity", width: "10%" },
            { key: "confidence", label: "Confidence", width: "8%" },
            { key: "timestamp", label: "Time", width: "8%" },
          ]}
          rows={model.evidenceInventory as unknown as Record<string, string>[]}
        />
      </Page_>

      {/* RISK ASSESSMENT */}
      <Page_ title="Risk Assessment" model={model}>
        <SectionTitle number="11" title="Forensic Risk Assessment" />
        <RiskScoreBar score={model.riskScore} level={model.riskLevel} />

        <Text style={{ ...styles.h3, marginTop: 20 }}>Risk Contribution</Text>
        {model.riskBreakdown.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.muted}>No individual source exceeded the scoring threshold.</Text>
          </View>
        ) : (
          <DataTable
            columns={[
              { key: "source", label: "Signal Source", width: "70%" },
              { key: "points", label: "Points", width: "30%" },
            ]}
            rows={model.riskBreakdown.map((b) => ({ source: capitalize(b.source), points: `+${b.points}` }))}
          />
        )}

        <Text style={{ ...styles.h3, marginTop: 6 }}>Why This Score?</Text>
        <Text style={styles.body}>{model.riskInterpretation}</Text>
      </Page_>

      {/* TIMELINE */}
      <Page_ title="Investigation Timeline" model={model}>
        <SectionTitle number="12" title="Investigation Timeline" />
        <VerticalTimeline events={model.timeline} />
      </Page_>

      {/* TOOL AUDIT */}
      <Page_ title="Tool Execution Audit" model={model}>
        <SectionTitle number="13" title="Investigation Tool Audit" />
        <Text style={{ ...styles.muted, marginBottom: 8 }}>NetraX is agentic — tools are selected dynamically per case, not run blindly.</Text>
        <DataTable
          columns={[
            { key: "tool", label: "Tool", width: "22%" },
            { key: "executed", label: "Executed?", width: "12%" },
            { key: "status", label: "Status", width: "14%" },
            { key: "reason", label: "Reason", width: "26%" },
            { key: "result", label: "Result", width: "26%" },
          ]}
          rows={model.toolAudit.map((t) => ({ ...t, executed: t.executed ? "YES" : "NO" }))}
        />
      </Page_>

      {/* RECOMMENDED RESPONSE */}
      <Page_ title="Recommended Response" model={model}>
        <SectionTitle number="14" title="Recommended Response" />
        {model.recommendationGroups.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.muted}>No immediate action indicated based on available evidence.</Text>
          </View>
        ) : (
          model.recommendationGroups.map((g) => (
            <View key={g.category} style={{ marginBottom: 10 }}>
              <Text style={styles.sectionEyebrow}>{g.category}</Text>
              {g.items.map((r, i) => (
                <View key={i} style={{ ...styles.card, flexDirection: "row", alignItems: "center" }} wrap={false}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 10 }} />
                  <Text style={{ ...styles.body, flex: 1 }}>{r}</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </Page_>

      {/* EVIDENCE INTEGRITY */}
      <Page_ title="Evidence Integrity" model={model}>
        <SectionTitle number="15" title="Evidence Integrity" />
        <View style={styles.table}>
          <View style={styles.tableHeaderRow} fixed>
            <Text style={{ ...styles.tableCellHeader, width: "22%" }}>Artifact</Text>
            <Text style={{ ...styles.tableCellHeader, width: "18%" }}>Size</Text>
          </View>
          {model.artifactHashes.map((h, i) => (
            <View key={h.name} style={{ ...styles.tableRow, flexDirection: "column", ...(i % 2 === 1 ? styles.tableRowAlt : {}) }} wrap={false}>
              <View style={{ ...styles.row, justifyContent: "space-between" }}>
                <Text style={{ ...styles.tableCell, fontFamily: "Helvetica-Bold" }}>{h.name}</Text>
                <Text style={{ ...styles.tableCell, color: COLORS.muted }}>{h.sizeBytes.toLocaleString()} bytes</Text>
              </View>
              <Text style={{ fontFamily: "Courier", fontSize: 7.5, color: COLORS.muted, marginTop: 2 }}>SHA-256: {h.sha256}</Text>
            </View>
          ))}
        </View>

        <View style={{ ...styles.row, flexWrap: "wrap", marginTop: 8 }}>
          <KeyValue label="Case ID" value={model.caseId} />
          <KeyValue label="Investigation Token" value={model.investigationToken} />
        </View>

        <View style={styles.panel}>
          <Text style={styles.muted}>
            SHA-256 values are provided to help verify artifact integrity. This does not constitute a claim of legal admissibility. The
            report's own hash and the evidence package's hash are recorded in evidence_manifest.json inside the evidence package, generated
            after this document is finalized.
          </Text>
        </View>
      </Page_>

      {/* CASE INFORMATION + CYBER CELL */}
      <Page_ title="Case Information" model={model}>
        <SectionTitle number="16" title="Case Information" />

        <View style={{ ...styles.row, flexWrap: "wrap" }}>
          <KeyValue label="NetraX Case ID" value={model.caseId} />
          <KeyValue label="Investigation Token" value={model.investigationToken} />
          <KeyValue label="Report Version" value={`v${model.reportVersion}`} />
        </View>
        <View style={{ ...styles.row, flexWrap: "wrap" }}>
          <KeyValue label="Threat Classification" value={model.threatType} />
          <KeyValue label="Risk Level" value={model.riskLevel} />
          <KeyValue label="Risk Score" value={`${model.riskScore} / 100`} />
        </View>
        <View style={{ ...styles.row, flexWrap: "wrap" }}>
          <KeyValue label="Created At" value={fmt(model.createdAt)} />
          <KeyValue label="Report Generated At" value={fmt(model.generatedAt)} />
        </View>

        <View style={styles.divider} />

        <Text style={styles.h3}>Cyber Cell Reporting — Demo</Text>
        {model.demoComplaintReference ? (
          <>
            <View style={{ ...styles.row, flexWrap: "wrap" }}>
              <KeyValue label="Status" value="DEMO — READY FOR EXTERNAL SUBMISSION" />
              <KeyValue label="Demo Reference" value={model.demoComplaintReference} />
            </View>
            <View style={{ ...styles.calloutWarn }}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: COLORS.ink }}>DEMO REFERENCE — NOT AN OFFICIAL CYBERCRIME ACKNOWLEDGEMENT</Text>
            </View>
          </>
        ) : (
          <View style={styles.panel}>
            <Text style={styles.muted}>This case has not yet been submitted through the demo Cyber Cell reporting workflow.</Text>
          </View>
        )}
      </Page_>

      {/* APPENDICES */}
      <Page_ title="Appendix A — Raw Email Headers" model={model}>
        <SectionTitle number="A" title="Appendix A — Raw Email Headers" />
        <MonospaceBlock text={model.appendixRawHeaders} />
      </Page_>

      <Page_ title="Appendix B — Extracted URLs" model={model}>
        <SectionTitle number="B" title="Appendix B — Extracted URLs" />
        {model.appendixUrls.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.muted}>No URLs were extracted from this submission.</Text>
          </View>
        ) : (
          <MonospaceBlock text={model.appendixUrls.join("\n")} />
        )}
      </Page_>

      <Page_ title="Appendix C — Extracted Indicators" model={model}>
        <SectionTitle number="C" title="Appendix C — Extracted Indicators" />
        <MonospaceBlock text={model.appendixIndicatorsJson} />
      </Page_>

      <Page_ title="Appendix D — Threat Intelligence Responses" model={model}>
        <SectionTitle number="D" title="Appendix D — Threat Intelligence Responses" />
        <MonospaceBlock text={model.appendixThreatIntelJson} />
      </Page_>

      <Page_ title="Appendix E — Infrastructure Data" model={model}>
        <SectionTitle number="E" title="Appendix E — Infrastructure Data" />
        <MonospaceBlock text={model.appendixInfrastructureJson} />
      </Page_>

      <Page_ title="Appendix F — Investigation Event Log" model={model}>
        <SectionTitle number="F" title="Appendix F — Investigation Event Log" />
        <DataTable
          columns={[
            { key: "timestamp", label: "Time", width: "18%" },
            { key: "label", label: "Event", width: "40%" },
            { key: "detail", label: "Detail", width: "42%" },
          ]}
          rows={model.appendixEventLog.map((e) => ({ timestamp: e.timestamp, label: e.label, detail: e.detail ?? "—" }))}
        />
      </Page_>

      <Page_ title="Appendix G — Evidence Manifest" model={model}>
        <SectionTitle number="G" title="Appendix G — Evidence Manifest" />
        <MonospaceBlock text={model.appendixManifestJson} />
      </Page_>

      {/* DISCLAIMER */}
      <Page_ title="Report Control & Disclaimer" model={model}>
        <SectionTitle number="17" title="Report Control &amp; Disclaimer" />

        <View style={{ ...styles.row, flexWrap: "wrap" }}>
          <KeyValue label="Generated By" value="NetraX" />
          <KeyValue label="Report Version" value={`v${model.reportVersion}`} />
        </View>
        <View style={{ ...styles.row, flexWrap: "wrap" }}>
          <KeyValue label="Case ID" value={model.caseId} />
          <KeyValue label="Investigation Token" value={model.investigationToken} />
        </View>
        <KeyValue label="Generated" value={fmt(model.generatedAt)} />

        <View style={styles.divider} />

        <Text style={{ ...styles.body, marginBottom: 10 }}>
          This report is an automated forensic analysis generated by NetraX. Findings are based on the information available in the submitted
          email and configured intelligence sources. Automated analysis should be reviewed by a qualified investigator before consequential
          action.
        </Text>
        <Text style={{ ...styles.body, marginBottom: 10 }}>
          IP geolocation is approximate and does not establish the attacker's exact physical location or identity.
        </Text>
        <Text style={styles.body}>
          Threat-intelligence results reflect only the configured providers (PhishTank, URLhaus) at the time of lookup. An UNAVAILABLE or NO
          MATCH result does not confirm an indicator is safe.
        </Text>
      </Page_>
      </>
      )}

      {model.investigationType !== "EMAIL" && <GenericInvestigationPages model={model} color={color} />}
    </Document>
  )
}

const MODULE_DETAIL_TITLE: Record<string, string> = {
  URL: "URL Decomposition & Suspicious Characteristics",
  SMS: "Message Content Analysis",
  MESSAGE: "Message Content Analysis",
  TRANSACTION: "Transaction Metadata & Behavioral Analysis",
}

/** Report body for non-EMAIL investigation types — shorter, honest about what these legacy analyzers can and can't produce (no header/threat-intel/geo sections that don't apply). */
function GenericInvestigationPages({ model, color }: { model: ReportModel; color: string }) {
  return (
    <>
      {/* AT A GLANCE */}
      <Page_ title="At a Glance" model={model}>
        <SectionTitle number="01" title="At a Glance" />
        <View style={{ flexDirection: "row", marginBottom: 8 }}>
          <StatCard label="Risk Score" value={`${model.riskScore}/100`} tone={color} />
          <StatCard label="Severity" value={model.riskLevel} tone={color} />
          <StatCard label="Findings" value={String(model.atAGlance.findingCount)} />
          <StatCard label="Evidence Items" value={String(model.atAGlance.evidenceCount)} />
        </View>
        <View style={{ ...styles.row, flexWrap: "wrap" }}>
          <KeyValue label="Investigation Type" value={model.investigationType} />
          <KeyValue label="Threat Classification" value={model.threatType} />
          <KeyValue label="Confidence" value={model.confidence} />
        </View>
      </Page_>

      {/* EXECUTIVE ASSESSMENT */}
      <Page_ title="Executive Assessment" model={model}>
        <SectionTitle number="02" title="Executive Assessment" />
        <Text style={styles.h3}>Assessment</Text>
        <Text style={{ ...styles.body, marginBottom: 12 }}>{model.executiveAssessment}</Text>

        <Text style={styles.h3}>Top Findings</Text>
        {model.topFindings.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.muted}>No significant risk indicators were found.</Text>
          </View>
        ) : (
          model.topFindings.map((f) => <RankedFindingCard key={f.rank} {...f} />)
        )}

        <Text style={{ ...styles.h3, marginTop: 4 }}>Investigation Scope</Text>
        <View style={styles.table}>
          {model.investigationScope.map((m, i) => (
            <View key={m.module} style={{ ...styles.tableRow, ...(i % 2 === 1 ? styles.tableRowAlt : {}) }} wrap={false}>
              <Text style={{ ...styles.tableCell, width: "6%", color: COLORS.low, fontFamily: "Helvetica-Bold" }}>✓</Text>
              <Text style={{ ...styles.tableCell, width: "94%", fontFamily: "Helvetica-Bold" }}>{m.module}</Text>
            </View>
          ))}
        </View>
      </Page_>

      {/* MODULE-SPECIFIC DETAIL */}
      <Page_ title={MODULE_DETAIL_TITLE[model.investigationType] ?? "Investigation Detail"} model={model}>
        <SectionTitle number="03" title={MODULE_DETAIL_TITLE[model.investigationType] ?? "Investigation Detail"} />

        <Text style={styles.h3}>{model.genericInputLabel}</Text>
        <MonospaceBlock text={model.genericInputValue} />

        {model.investigationType === "URL" && model.urls.length > 0 && (
          <>
            <Text style={{ ...styles.h3, marginTop: 6 }}>URL Decomposition</Text>
            <View style={{ ...styles.row, flexWrap: "wrap" }}>
              <KeyValue label="Hostname" value={model.urls[0].hostname} />
              <KeyValue label="Protocol" value={model.urls[0].protocol} />
              <KeyValue label="Path" value={model.urls[0].path} />
              <KeyValue label="Query" value={model.urls[0].query} />
              <KeyValue label="Length" value={String(model.urls[0].length)} />
              <KeyValue label="HTTPS" value={model.urls[0].https ? "Yes" : "No"} />
            </View>
            <Text style={{ ...styles.h3, marginTop: 4 }}>Suspicious Characteristics</Text>
            {model.urls[0].characteristics.length === 0 ? (
              <View style={styles.panel}>
                <Text style={styles.muted}>No suspicious structural characteristics detected for this URL.</Text>
              </View>
            ) : (
              model.urls[0].characteristics.map((c) => (
                <Text key={c.label} style={{ ...styles.muted, marginBottom: 2 }}>
                  • DETECTED — {c.label}
                </Text>
              ))
            )}

            <Text style={{ ...styles.h3, marginTop: 6 }}>Domain Intelligence</Text>
            <DataTable
              columns={[
                { key: "domain", label: "Domain", width: "30%" },
                { key: "tld", label: "TLD", width: "16%" },
                { key: "registrar", label: "Registrar", width: "24%" },
                { key: "age", label: "Age", width: "15%" },
                { key: "reputation", label: "Reputation", width: "15%" },
              ]}
              rows={model.domainIntelligence as unknown as Record<string, string>[]}
            />

            <Callout tone="warn">
              <Text style={{ ...styles.muted, color: COLORS.ink }}>
                Threat intelligence (PhishTank/URLhaus) and IP/ASN/geolocation enrichment are integrated for the email investigation pipeline
                only in this build — not applicable to a standalone URL submission here.
              </Text>
            </Callout>
          </>
        )}

        {model.investigationType === "SMS" && (
          <>
            <Text style={{ ...styles.h3, marginTop: 6 }}>Content Findings</Text>
            {model.genericFindings.length === 0 ? (
              <View style={styles.panel}>
                <Text style={styles.muted}>No fraud indicators detected in this message.</Text>
              </View>
            ) : (
              model.genericFindings.map((f, i) => <FindingCard key={i} {...f} />)
            )}
          </>
        )}

        {model.investigationType === "TRANSACTION" && model.transactionFields && (
          <>
            <Text style={{ ...styles.h3, marginTop: 6 }}>Transaction Metadata</Text>
            <View style={{ ...styles.row, flexWrap: "wrap" }}>
              <KeyValue label="Amount" value={model.transactionFields.amount || "Not available in submitted input."} />
              <KeyValue label="Merchant" value={model.transactionFields.merchant || "Not available in submitted input."} />
              <KeyValue label="Location" value={model.transactionFields.location || "Not available in submitted input."} />
            </View>
            <View style={{ ...styles.row, flexWrap: "wrap" }}>
              <KeyValue label="Time" value={model.transactionFields.time || "Not available in submitted input."} />
              <KeyValue label="Device" value={model.transactionFields.device || "Not available in submitted input."} />
            </View>
            <Text style={{ ...styles.h3, marginTop: 6 }}>Behavioral Analysis Findings</Text>
            {model.genericFindings.length === 0 ? (
              <View style={styles.panel}>
                <Text style={styles.muted}>Transaction is consistent with normal behavior.</Text>
              </View>
            ) : (
              model.genericFindings.map((f, i) => <FindingCard key={i} {...f} />)
            )}
            <Callout tone="warn">
              <Text style={{ ...styles.muted, color: COLORS.ink }}>
                ML prediction not available: the trained transaction model requires PCA-derived features not obtainable from these free-text
                fields. Behavioral analysis above is rule-based only.
              </Text>
            </Callout>
          </>
        )}
      </Page_>

      {/* EVIDENCE INVENTORY */}
      <Page_ title="Evidence Inventory" model={model}>
        <SectionTitle number="04" title="Evidence Inventory" />
        <DataTable
          columns={[
            { key: "id", label: "ID", width: "10%" },
            { key: "type", label: "Type", width: "20%" },
            { key: "value", label: "Value", width: "40%" },
            { key: "severity", label: "Severity", width: "15%" },
            { key: "timestamp", label: "Time", width: "15%" },
          ]}
          rows={model.evidenceInventory as unknown as Record<string, string>[]}
        />
      </Page_>

      {/* RISK ASSESSMENT */}
      <Page_ title="Risk Assessment" model={model}>
        <SectionTitle number="05" title="Risk Assessment" />
        <RiskScoreBar score={model.riskScore} level={model.riskLevel} />
        <Text style={{ ...styles.h3, marginTop: 20 }}>Why This Score?</Text>
        <Text style={styles.body}>{model.riskInterpretation}</Text>
      </Page_>

      {/* TIMELINE */}
      <Page_ title="Investigation Timeline" model={model}>
        <SectionTitle number="06" title="Investigation Timeline" />
        <VerticalTimeline events={model.timeline} />
      </Page_>

      {/* TOOL AUDIT */}
      <Page_ title="Tool Execution Audit" model={model}>
        <SectionTitle number="07" title="Investigation Tool Audit" />
        <DataTable
          columns={[
            { key: "tool", label: "Tool", width: "30%" },
            { key: "executed", label: "Executed?", width: "15%" },
            { key: "status", label: "Status", width: "20%" },
            { key: "result", label: "Result", width: "35%" },
          ]}
          rows={model.toolAudit.map((t) => ({ tool: t.tool, executed: t.executed ? "YES" : "NO", status: t.status, result: t.result }))}
        />
      </Page_>

      {/* RECOMMENDED RESPONSE */}
      <Page_ title="Recommended Response" model={model}>
        <SectionTitle number="08" title="Recommended Response" />
        {model.recommendationGroups.length === 0 ? (
          <View style={styles.panel}>
            <Text style={styles.muted}>No immediate action indicated based on available evidence.</Text>
          </View>
        ) : (
          model.recommendationGroups.map((g) => (
            <View key={g.category} style={{ marginBottom: 10 }}>
              <Text style={styles.sectionEyebrow}>{g.category}</Text>
              {g.items.map((r, i) => (
                <View key={i} style={{ ...styles.card, flexDirection: "row", alignItems: "center" }} wrap={false}>
                  <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, marginRight: 10 }} />
                  <Text style={{ ...styles.body, flex: 1 }}>{r}</Text>
                </View>
              ))}
            </View>
          ))
        )}
      </Page_>

      {/* EVIDENCE INTEGRITY */}
      <Page_ title="Evidence Integrity" model={model}>
        <SectionTitle number="09" title="Evidence Integrity" />
        <View style={styles.table}>
          <View style={styles.tableHeaderRow} fixed>
            <Text style={{ ...styles.tableCellHeader, width: "22%" }}>Artifact</Text>
            <Text style={{ ...styles.tableCellHeader, width: "18%" }}>Size</Text>
          </View>
          {model.artifactHashes.map((h, i) => (
            <View key={h.name} style={{ ...styles.tableRow, flexDirection: "column", ...(i % 2 === 1 ? styles.tableRowAlt : {}) }} wrap={false}>
              <View style={{ ...styles.row, justifyContent: "space-between" }}>
                <Text style={{ ...styles.tableCell, fontFamily: "Helvetica-Bold" }}>{h.name}</Text>
                <Text style={{ ...styles.tableCell, color: COLORS.muted }}>{h.sizeBytes.toLocaleString()} bytes</Text>
              </View>
              <Text style={{ fontFamily: "Courier", fontSize: 7.5, color: COLORS.muted, marginTop: 2 }}>SHA-256: {h.sha256}</Text>
            </View>
          ))}
        </View>
        <View style={styles.panel}>
          <Text style={styles.muted}>SHA-256 values are provided to help verify artifact integrity. This does not constitute a claim of legal admissibility.</Text>
        </View>
      </Page_>

      {/* CASE INFO + CYBER CELL */}
      <Page_ title="Case Information" model={model}>
        <SectionTitle number="10" title="Case Information" />
        <View style={{ ...styles.row, flexWrap: "wrap" }}>
          <KeyValue label="NetraX Case ID" value={model.caseId} />
          <KeyValue label="Investigation Token" value={model.investigationToken} />
          <KeyValue label="Investigation Type" value={model.investigationType} />
        </View>
        <View style={{ ...styles.row, flexWrap: "wrap" }}>
          <KeyValue label="Threat Classification" value={model.threatType} />
          <KeyValue label="Risk Level" value={model.riskLevel} />
          <KeyValue label="Risk Score" value={`${model.riskScore} / 100`} />
        </View>
        <KeyValue label="Created At" value={fmt(model.createdAt)} />

        <View style={styles.divider} />
        <Text style={styles.h3}>Cyber Cell Reporting — Demo</Text>
        {model.demoComplaintReference ? (
          <>
            <KeyValue label="Demo Reference" value={model.demoComplaintReference} />
            <View style={styles.calloutWarn}>
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9, color: COLORS.ink }}>DEMO REFERENCE — NOT AN OFFICIAL CYBERCRIME ACKNOWLEDGEMENT</Text>
            </View>
          </>
        ) : (
          <View style={styles.panel}>
            <Text style={styles.muted}>This case has not yet been submitted through the demo Cyber Cell reporting workflow.</Text>
          </View>
        )}
      </Page_>

      {/* APPENDICES */}
      <Page_ title="Appendix A — Evidence" model={model}>
        <SectionTitle number="A" title="Appendix A — Evidence" />
        <MonospaceBlock text={JSON.stringify(model.genericFindings, null, 2)} />
      </Page_>

      <Page_ title="Appendix B — Investigation Event Log" model={model}>
        <SectionTitle number="B" title="Appendix B — Investigation Event Log" />
        <DataTable
          columns={[
            { key: "timestamp", label: "Time", width: "18%" },
            { key: "label", label: "Event", width: "40%" },
            { key: "detail", label: "Detail", width: "42%" },
          ]}
          rows={model.appendixEventLog.map((e) => ({ timestamp: e.timestamp, label: e.label, detail: e.detail ?? "—" }))}
        />
      </Page_>

      <Page_ title="Appendix C — Evidence Manifest" model={model}>
        <SectionTitle number="C" title="Appendix C — Evidence Manifest" />
        <MonospaceBlock text={model.appendixManifestJson} />
      </Page_>

      {/* DISCLAIMER */}
      <Page_ title="Report Control & Disclaimer" model={model}>
        <SectionTitle number="11" title="Report Control &amp; Disclaimer" />
        <View style={{ ...styles.row, flexWrap: "wrap" }}>
          <KeyValue label="Generated By" value="NetraX" />
          <KeyValue label="Report Version" value={`v${model.reportVersion}`} />
        </View>
        <View style={{ ...styles.row, flexWrap: "wrap" }}>
          <KeyValue label="Case ID" value={model.caseId} />
          <KeyValue label="Investigation Token" value={model.investigationToken} />
        </View>
        <KeyValue label="Generated" value={fmt(model.generatedAt)} />
        <View style={styles.divider} />
        <Text style={{ ...styles.body, marginBottom: 10 }}>
          This report is an automated forensic analysis generated by NetraX. Findings are based on the information available in the submitted
          input and the tools actually applicable to this investigation type. Automated analysis should be reviewed by a qualified investigator
          before consequential action.
        </Text>
        <Text style={styles.body}>
          This investigation type does not include email header forensics, threat-intelligence lookups, or IP/geolocation enrichment in this
          build — those are integrated for the email investigation pipeline only.
        </Text>
      </Page_>
    </>
  )
}

function capitalize(s: string): string {
  const ACRONYMS = new Set(["ml", "ip", "asn", "url", "spf", "dkim", "dmarc"])
  return s
    .split(" ")
    .map((word) => (ACRONYMS.has(word.toLowerCase()) ? word.toUpperCase() : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ")
}

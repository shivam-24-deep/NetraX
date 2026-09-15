import { StyleSheet } from "@react-pdf/renderer"

// Core PDF fonts only (Helvetica/Times/Courier) — no network font fetch, so
// report generation works fully offline/in demo mode.
export const COLORS = {
  ink: "#111318",
  muted: "#5b6472",
  faint: "#8a93a1",
  border: "#dfe3ea",
  borderStrong: "#c3cad6",
  panel: "#f4f6f9",
  panelAlt: "#eef1f6",
  brand: "#7e14ff",
  brandSoft: "#f1e6ff",
  low: "#1f9d55",
  medium: "#c98a12",
  high: "#d9532b",
  critical: "#b91c2c",
  info: "#5b6472",
  white: "#ffffff",
}

export function riskColor(level: string): string {
  switch (level.toUpperCase()) {
    case "CRITICAL":
      return COLORS.critical
    case "HIGH":
      return COLORS.high
    case "MEDIUM":
      return COLORS.medium
    case "LOW":
      return COLORS.low
    default:
      return COLORS.info
  }
}

/** "01 of 14" — never bare "1 of 14". */
export function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

export const styles = StyleSheet.create({
  page: {
    paddingTop: 60,
    paddingBottom: 52,
    paddingHorizontal: 46,
    fontSize: 9.5,
    fontFamily: "Helvetica",
    color: COLORS.ink,
  },

  controlBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 38,
    paddingHorizontal: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.brand,
  },
  controlBarText: { fontSize: 7.5, color: COLORS.muted, fontFamily: "Courier" },
  footerBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 36,
    paddingHorizontal: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  footerText: { fontSize: 7.5, color: COLORS.faint },

  classification: { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1.5, color: COLORS.muted },

  sectionEyebrow: { fontSize: 8, fontFamily: "Helvetica-Bold", color: COLORS.brand, letterSpacing: 1.5, marginBottom: 2 },
  h1: { fontSize: 20, fontFamily: "Helvetica-Bold", color: COLORS.ink, marginBottom: 4 },
  h2: { fontSize: 14, fontFamily: "Helvetica-Bold", color: COLORS.ink, marginBottom: 8 },
  h3: { fontSize: 10.5, fontFamily: "Helvetica-Bold", color: COLORS.ink, marginBottom: 4 },
  h4: { fontSize: 9, fontFamily: "Helvetica-Bold", color: COLORS.ink, marginBottom: 3 },
  body: { fontSize: 9.5, color: COLORS.ink, lineHeight: 1.5 },
  muted: { fontSize: 8.5, color: COLORS.muted },
  faint: { fontSize: 7.5, color: COLORS.faint },
  mono: { fontFamily: "Courier", fontSize: 8 },

  card: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 3, padding: 10, marginBottom: 8, backgroundColor: COLORS.white },
  panel: { backgroundColor: COLORS.panel, borderRadius: 3, padding: 10, marginBottom: 8 },
  calloutWarn: { backgroundColor: "#fdf3e4", borderWidth: 1, borderColor: COLORS.medium, borderRadius: 3, padding: 9, marginBottom: 8 },
  calloutInfo: { backgroundColor: COLORS.brandSoft, borderWidth: 1, borderColor: COLORS.brand, borderRadius: 3, padding: 9, marginBottom: 8 },
  row: { flexDirection: "row" },
  spaceBetween: { flexDirection: "row", justifyContent: "space-between" },
  divider: { borderBottomWidth: 1, borderBottomColor: COLORS.border, marginVertical: 8 },
  thickDivider: { borderBottomWidth: 2, borderBottomColor: COLORS.brand, marginVertical: 10, width: 46 },

  table: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 3, marginBottom: 8 },
  tableHeaderRow: { flexDirection: "row", backgroundColor: COLORS.panelAlt, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingVertical: 4, paddingHorizontal: 6 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: COLORS.border, paddingVertical: 4, paddingHorizontal: 6 },
  tableRowAlt: { backgroundColor: "#fafbfc" },
  tableCellHeader: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5 },
  tableCell: { fontSize: 8.5, color: COLORS.ink },

  badge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 3, fontSize: 7.5, fontFamily: "Helvetica-Bold" },

  keyValueLabel: { fontSize: 7.5, color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 1 },
  keyValueValue: { fontSize: 9.5, color: COLORS.ink, marginBottom: 6 },

  statCard: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 3, padding: 9, marginRight: 8, backgroundColor: COLORS.white },
  statLabel: { fontSize: 7, fontFamily: "Helvetica-Bold", color: COLORS.muted, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  statValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: COLORS.ink },
})

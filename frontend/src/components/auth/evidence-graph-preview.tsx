import { motion } from "framer-motion"

const NODES = [
  { id: "email", label: "EMAIL", color: "var(--color-primary)" },
  { id: "sender", label: "SENDER", color: "var(--color-risk-medium)" },
  { id: "domain", label: "DOMAIN", color: "var(--color-risk-high)" },
  { id: "url", label: "URL", color: "var(--color-risk-medium)" },
  { id: "ip", label: "IP", color: "var(--color-risk-low)" },
  { id: "asn", label: "ASN", color: "var(--color-risk-low)" },
  { id: "geo", label: "GEO", color: "var(--color-muted-foreground)" },
] as const

const container = {
  animate: { transition: { staggerChildren: 0.16 } },
}

const nodeVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
}

const edgeVariants = {
  initial: { scaleY: 0 },
  animate: { scaleY: 1 },
}

export function EvidenceGraphPreview() {
  return (
    <motion.div variants={container} initial="initial" animate="animate" className="flex flex-col">
      <span className="text-muted-foreground mb-1.5 text-xs font-medium tracking-wide uppercase">
        Evidence graph
      </span>
      {NODES.map((node, i) => (
        <motion.div key={node.id} variants={nodeVariants} className="flex flex-col">
          <div className="flex items-center gap-2.5 leading-none">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: node.color, boxShadow: `0 0 6px 0 ${node.color}` }}
            />
            <span className="font-mono text-[11px] tracking-wide">{node.label}</span>
          </div>
          {i < NODES.length - 1 && (
            <motion.div
              variants={edgeVariants}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="bg-border ml-1 h-2 w-px origin-top"
            />
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}

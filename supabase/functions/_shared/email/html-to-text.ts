// Phase 3 — minimal HTML-to-text conversion for email bodies.
// Not a general-purpose HTML renderer: strips markup and decodes entities so
// forensics/indicator extraction has plain text to work with, nothing more.

const BLOCK_BREAK_TAGS = /<\/(p|div|tr|table|li|h[1-6]|blockquote)\s*>/gi;
const LINE_BREAK_TAGS = /<(br|hr)\s*\/?>/gi;

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  copy: "©",
  reg: "®",
  trade: "™",
  mdash: "—",
  ndash: "–",
  hellip: "…",
};

function decodeEntities(text: string): string {
  return text
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

export function htmlToText(html: string): string {
  let text = html;
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(BLOCK_BREAK_TAGS, "\n");
  text = text.replace(LINE_BREAK_TAGS, "\n");
  // Preserve link targets inline since URLs are load-bearing evidence, not just display text.
  text = text.replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>(.*?)<\/a>/gis, (_m, href, label) => {
    const cleanLabel = label.replace(/<[^>]+>/g, "").trim();
    return cleanLabel && cleanLabel !== href ? `${cleanLabel} (${href})` : href;
  });
  text = text.replace(/<[^>]+>/g, "");
  text = decodeEntities(text);
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
}

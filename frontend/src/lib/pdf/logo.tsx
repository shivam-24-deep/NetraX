import { Path, Svg, Text, View } from "@react-pdf/renderer"

// Real NetraX mark (frontend/public/favicon.svg), simplified to its core solid
// path — react-pdf's SVG support can't do the favicon's blur/glow layers, and
// a flat mark suits a print forensic report better anyway. Same geometry, no
// invented logo.
export const NETRAX_PURPLE = "#7e14ff"

const MARK_PATH =
  "M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"

export function NetraXMark({ size = 20, color = NETRAX_PURPLE }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={(size * 46) / 48} viewBox="0 0 48 46">
      <Path d={MARK_PATH} fill={color} />
    </Svg>
  )
}

export function NetraXWordmark({ size = 12, color = "#111318", markColor = NETRAX_PURPLE }: { size?: number; color?: string; markColor?: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
      <NetraXMark size={size * 1.4} color={markColor} />
      <Text style={{ fontSize: size, fontFamily: "Helvetica-Bold", letterSpacing: 2, color }}>NETRAX</Text>
    </View>
  )
}

import { hexToLinear } from './util';

// 《标准流程》 lives in an archive palette: bone paper, charcoal ink, blue-grey shadow, and one
// vermilion — the correction line, the seal, the sung word. Nothing else. See docs/TREATMENT.md.
// (Key names follow the engine's: `signal` is the one accent, `ember` its hot core, `blood` its shadow.)
export const HEX = {
  ink: '#121314', // charcoal ink / the dark ground
  ink2: '#1B1D1F', // raised dark (panels, glass in the dark)
  graphite: '#54585B', // dim lines, secondary text
  ash: '#979C9F', // mid grey (cool)
  slate: '#56626C', // blue-grey shadow (fog, glass, distance)
  fog: '#C9CDCC', // the frosted white of the glass and the suits
  bone: '#E9E4D8', // paper white, primary text
  signal: '#C8321F', // vermilion: the correction line, seals, the sung word
  ember: '#E8604A', // its hot core (only where the line glows)
  blood: '#7A1A12', // dried seal ink, deep shadow of vermilion
} as const;

export type PaletteKey = keyof typeof HEX;

/** Linear RGB triplets for GL uniforms. */
export const LIN: Record<PaletteKey, [number, number, number]> = Object.fromEntries(
  Object.entries(HEX).map(([k, v]) => [k, hexToLinear(v)]),
) as Record<PaletteKey, [number, number, number]>;

/** CSS rgba() for Canvas2D. */
export function rgba(key: PaletteKey | string, a = 1): string {
  const hex = (HEX as Record<string, string>)[key] ?? key;
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

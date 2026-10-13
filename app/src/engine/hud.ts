// Global overlay, drawn over every plate: the subtitle track (the full lyric, synced per character)
// and the crop-mark frame (bookends only). The subtitles are a layer of their own, never part of a
// plate's image: a plate only stages the text that has a job in its world (field names, stamps,
// footnotes, call logs). Scenes steer the track through post overrides: `subtitle` (opacity),
// `subtitleLift` (px up from the default baseline, to clear a plate's own type) and `paper` (ink on light).
import { Layer2D, W, H } from './gl';
import { rgba } from './palette';
import { F, font, layout } from './type';
import { Lyrics, type Line } from './lyrics';
import { clamp, ease, lerp, prog, smoothstep } from './util';

export interface HudState {
  /** Overall opacity (post.hud). */
  opacity: number;
  /** 0..1 the crop-mark frame: 1 in place, 0 flown out past the edges (see PostParams.frame). */
  frame: number;
  /** 0..1: the plate is light (bone paper) — draw in ink. */
  paper: number;
  /** 0..1 subtitle opacity. */
  subtitle: number;
  /** px the subtitle baseline is lifted from its default. */
  subtitleLift: number;
}

/** Subtitle geometry (logical px): left-aligned on the archive grid, not centred. */
export const SUB = { x: 120, y: H - 84, size: 54, tracking: 4, lead: 0.4, tail: 0.5 };

export class Hud {
  layer = new Layer2D();
  private ink = false;
  constructor(public lyrics: Lyrics) {}

  draw(t: number, st: HudState) {
    const L = this.layer;
    L.clear();
    const c = L.ctx;
    if (st.opacity <= 0.001) return L.upload();
    c.globalAlpha = st.opacity;
    this.ink = st.paper > 0.5;
    if (st.frame > 0.001) this.cropMarks(c, st.frame);
    if (st.subtitle > 0.001) { c.save(); c.globalAlpha *= st.subtitle; this.subtitle(c, t, st.subtitleLift); c.restore(); }
    return L.upload();
  }

  /** The line on screen at t: the one being sung, else the next one (shown dim up to `lead` s early). */
  lineFor(t: number): Line | null {
    const ls = this.lyrics.lines;
    for (let i = 0; i < ls.length; i++) {
      const l = ls[i]!, next = ls[i + 1];
      const until = Math.min(l.end + SUB.tail, next ? next.start - SUB.lead : Infinity);
      if (t >= l.start - SUB.lead && t < Math.max(until, l.end)) return l;
    }
    return null;
  }

  private subtitle(c: CanvasRenderingContext2D, t: number, lift: number) {
    const l = this.lineFor(t);
    if (!l) return;
    const ls = this.lyrics.lines, next = ls[l.i + 1];
    const until = Math.max(l.end, Math.min(l.end + SUB.tail, next ? next.start - SUB.lead : Infinity));
    const a = Math.min(smoothstep(l.start - SUB.lead, l.start - SUB.lead + 0.15, t), 1 - smoothstep(until - 0.18, until, t));
    if (a <= 0) return;
    const fam = F.song(600);
    const lay = layout(l.text, fam, SUB.size, SUB.tracking);
    const x0 = SUB.x, y0 = SUB.y - lift;
    const full = this.ink ? 'ink' : 'bone';
    c.save();
    c.globalAlpha *= a;
    c.textBaseline = 'alphabetic';

    // the line number, filed like an index entry
    c.font = font(F.mono(500), 18);
    c.letterSpacing = '3px';
    c.fillStyle = rgba(this.ink ? 'graphite' : 'ash', 0.9);
    c.fillText(`${String(l.i + 1).padStart(2, '0')} / ${String(ls.length).padStart(2, '0')}`, x0, y0 - SUB.size - 14);
    c.letterSpacing = '0px';

    // characters: unsung dim, sung full; each character arrives with a short settle
    c.font = font(fam, SUB.size);
    const chars = Lyrics.lineCharProgress(l, t);
    for (const g of lay.glyphs) {
      const k = clamp(chars - g.i);
      c.fillStyle = rgba(full, lerp(0.3, 1, ease.outCubic(k)));
      c.fillText(g.ch, x0 + g.x, y0 - 3 * (1 - ease.outCubic(k)) * (k > 0 ? 1 : 0));
    }

    // the correction line: a vermilion hairline under what has been sung, its head at the voice
    const gi = Math.min(lay.glyphs.length - 1, Math.floor(chars));
    const g = lay.glyphs[Math.max(0, gi)];
    if (g && chars > 0) {
      const head = chars >= lay.glyphs.length ? lay.width : g.x + g.w * (chars - Math.floor(chars));
      const fade = 1 - prog(t, l.end, until, ease.inQuad) * 0.6;
      c.fillStyle = rgba('signal', 0.95 * fade);
      c.fillRect(x0, y0 + 16, head, 3);
      c.fillRect(x0 + head - 1.5, y0 + 9, 3, 14);
    }
    c.restore();
  }

  /** Corner marks; as `k` drops they fly out along the diagonals and past the edges. */
  private cropMarks(c: CanvasRenderingContext2D, k: number) {
    const e = ease.inOutCubic(clamp(k));
    c.save();
    c.globalAlpha *= clamp(k * 3);
    c.strokeStyle = this.ink ? rgba('ink', 0.45) : rgba('bone', 0.34);
    c.lineWidth = 1.25;
    const m = lerp(-40, 36, e), l = 22;
    c.beginPath();
    for (const [x, y, sx, sy] of [[m, m, 1, 1], [W - m, m, -1, 1], [m, H - m, 1, -1], [W - m, H - m, -1, -1]] as const) {
      c.moveTo(x + sx * l, y + 0.5 * sy); c.lineTo(x, y + 0.5 * sy); c.lineTo(x, y + sy * l);
    }
    c.stroke();
    c.restore();
  }
}

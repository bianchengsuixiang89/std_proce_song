// Shared design system of 《标准流程》 (read-only for scene authors, like the reference's _motifs.ts):
//  - Two media for the same drawings: PAPER (the archive: bone paper, inks) and SCREEN (the system: the
//    drawing lit up on a dark gridded display, the red line glowing). Plates cut between them.
//  - Paper: procedural bone paper + channel-coded inks (R charcoal ink, G blue-grey print, B vermilion),
//    overprinted Beer-Lambert, rubber-stamp texture inside stamp rects, the red line's pen head glow,
//    and the two failure modes of a printed page: misregistration (each ink plate off by its own vector)
//    and a broken forme (horizontal bands of the page shifted, as type that has slipped).
//  - Cam: an affine page camera (pan / zoom / roll) and its inverse.
//  - The correction line (红色流程线): ruler-straight polylines drawn by length, with a pen head.
//  - Stamps, greeked text (text no one reads), architectural scale figures (the only people in the film).
import * as THREE from 'three';
import { FSPass, W, H } from '../engine/gl';
import { F, font, measure } from '../engine/type';
import { clamp, lerp, prog, polylineLengths, pointAtLength, hash, type V2 } from '../engine/util';

export type Ctx2 = CanvasRenderingContext2D;

// channel-coded inks (draw with 'lighter' onto an opaque black layer)
export const INK = (a = 1) => `rgba(255,0,0,${a})`;
export const PRINT = (a = 1) => `rgba(0,255,0,${a})`;
export const RED = (a = 1) => `rgba(0,0,255,${a})`;

// ------------------------------------------------------------------ camera
export interface Cam { x: number; y: number; z: number; r: number }
export type Xf = { a: number; b: number; c: number; d: number; e: number; f: number };
/** Affine that maps page px -> screen px for a camera centred on (x, y) (+ shake). */
export function camXf(cam: Cam, shx = 0, shy = 0): Xf {
  const cs = Math.cos(cam.r) * cam.z, sn = Math.sin(cam.r) * cam.z;
  const a = cs, b = sn, c = -sn, d = cs;
  return { a, b, c, d, e: W / 2 + shx - (a * cam.x + c * cam.y), f: H / 2 + shy - (b * cam.x + d * cam.y) };
}
export function invXf(m: Xf): Xf {
  const det = m.a * m.d - m.b * m.c;
  const ia = m.d / det, ib = -m.b / det, ic = -m.c / det, id = m.a / det;
  return { a: ia, b: ib, c: ic, d: id, e: -(ia * m.e + ic * m.f), f: -(ib * m.e + id * m.f) };
}
export const applyXf = (m: Xf, x: number, y: number) => ({ x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f });
export const lerpCam = (p: Cam, q: Cam, k: number): Cam => ({ x: lerp(p.x, q.x, k), y: lerp(p.y, q.y, k), z: Math.exp(lerp(Math.log(p.z), Math.log(q.z), k)), r: lerp(p.r, q.r, k) });

// ------------------------------------------------------------------ paper
const PAPER_FRAG = /* glsl */ `
uniform sampler2D inkTex;
uniform vec3 camA; uniform vec3 camB;    // screen px (y down) -> page px
uniform float zoom;
uniform vec4 stA[4]; uniform vec4 stB[4]; // stamps: centre.xy, half.xy | angle, strength, seed, -
uniform vec4 heads[3];                    // pen heads: screen x, y, intensity, radius
uniform vec2 offR; uniform vec2 offG; uniform vec2 offB; // misregistration of each plate (screen px)
uniform float slip; uniform float slipSeed;  // broken forme: max band shift (px)
uniform float light;                      // overall light on the sheet (1 = studio)
uniform float screen;                     // 0 paper (the archive) .. 1 screen (the system's display)

float fibres(vec2 p, float cs) {
  float acc = 0.0;
  vec2 cell = floor(p / cs);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = cell + vec2(float(i), float(j));
    vec2 o = (c + hash22(c)) * cs;
    float a = hash12(c + 7.1) * TAU;
    float L = cs * (0.3 + 1.1 * hash12(c + 3.3));
    vec2 d = vec2(cos(a), sin(a));
    float dist = sdSegment(p, o - d * L * 0.5, o + d * L * 0.5);
    acc += (hash12(c + 9.9) - 0.5) * (1.0 - smoothstep(0.25, 0.9 + 0.4 / zoom, dist));
  }
  return acc;
}
float inStamp(vec2 p, vec4 a, vec4 b) {
  if (b.y <= 0.0) return 0.0;
  vec2 q = rot2(-b.x) * (p - a.xy);
  vec2 d = abs(q) - a.zw;
  return (d.x < 0.0 && d.y < 0.0) ? b.y : 0.0;
}
// rubber-stamp ink: voids and mottling, heavier near the edges of the shapes
float stampInk(vec2 p, float cov, float seed, float strength) {
  float n = snoise(p * 0.07 + seed) * 0.45 + snoise(p * 0.23 + seed * 2.0) * 0.35 + snoise(p * 0.9 - seed) * 0.2;
  float press = smoothstep(-0.9, 0.3, snoise(p * 0.0045 + seed * 3.0));
  float voids = smoothstep(-0.6, -0.38, n + (strength - 1.0) * 0.8 + 0.25 * press);
  return sat(cov * voids * (0.74 + 0.26 * press) * 1.2);
}
vec2 suv(vec2 sp) { return vec2(sp.x / 1920.0, 1.0 - sp.y / 1080.0); }

void main() {
  vec2 sp = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
  // broken forme: bands of the sheet shifted sideways (type that slipped in the chase)
  if (slip > 0.0) {
    float bh = 26.0 + 90.0 * hash11(floor(sp.y / 140.0) + slipSeed);
    float band = floor(sp.y / bh);
    float on = step(0.45, hash11(band * 1.7 + slipSeed));
    sp.x += (hash11(band + slipSeed * 3.1) - 0.5) * 2.0 * slip * on;
  }
  vec2 pp = vec2(dot(camA, vec3(sp, 1.0)), dot(camB, vec3(sp, 1.0)));

  float cloud = fbm(pp * 0.0021, 4);
  float fib = fibres(pp, 22.0) + 0.6 * fibres(pp * 1.7 + 31.0, 22.0);
  float speck = step(0.99965, hash12(floor(pp * 0.5)));
  vec3 paper = C_BONE * (0.972 + 0.03 * cloud + 0.008 * snoise(pp * 0.018) + 0.05 * fib);
  paper *= 1.0 - speck * 0.35;
  paper *= 0.965 + 0.035 * (1.0 - vUv.y * 0.6 - vUv.x * 0.4);

  float dInk = texture(inkTex, suv(sp - offR)).r;
  float dPrint = texture(inkTex, suv(sp - offG)).g;
  float dRed = texture(inkTex, suv(sp - offB)).b;
  dInk *= (0.88 + 0.12 * smoothstep(-0.5, 0.6, snoise(pp * 0.35))) * (1.0 - 0.15 * sat(fib * 4.0));
  dRed *= 0.93 + 0.07 * snoise(pp * 0.25);
  for (int i = 0; i < 4; i++) {
    float s = inStamp(pp, stA[i], stB[i]);
    if (s > 0.0) dRed = stampInk(pp, dRed, stB[i].z, s);
  }

  vec3 col = paper;
  col *= pow(clamp(C_SIGNAL / C_BONE, 0.004, 1.0), vec3(sat(dRed)));
  col *= pow(clamp(C_SLATE / C_BONE * 0.9, 0.004, 1.0), vec3(sat(dPrint)));
  col *= pow(clamp(C_INK / C_BONE * 1.2, 0.004, 1.0), vec3(sat(dInk)));

  vec2 dc = vUv - 0.5;
  col *= 1.0 - 0.16 * pow(length(dc * vec2(1.0, 0.85)) * 1.5, 2.6);
  if (screen > 0.0) {
    // the same drawing as the system displays it: lit lines on a dark gridded ground, the red line glowing
    float gm = max(pxLine(abs(fract(pp.x / 40.0 + 0.5) - 0.5) * 40.0 * zoom, 0.4, 1.2), pxLine(abs(fract(pp.y / 40.0 + 0.5) - 0.5) * 40.0 * zoom, 0.4, 1.2));
    float gM = max(pxLine(abs(fract(pp.x / 200.0 + 0.5) - 0.5) * 200.0 * zoom, 0.5, 1.5), pxLine(abs(fract(pp.y / 200.0 + 0.5) - 0.5) * 200.0 * zoom, 0.5, 1.5));
    vec3 g = C_INK * 0.42 + C_SLATE * (0.05 + 0.04 * (1.0 - length(dc) * 1.4));
    g += C_SLATE * (0.035 * gm + 0.07 * gM);
    vec3 sc = g + C_FOG * 0.62 * sat(dInk) + C_SLATE * 0.75 * sat(dPrint) + C_SIGNAL * 2.6 * sat(dRed) + C_EMBER * 0.6 * sat(dRed - 0.6);
    sc *= 0.94 + 0.06 * sin(sp.y * 3.14159 * 0.5);   // scanlines (2 px)
    sc *= 1.0 - 0.3 * pow(length(dc * vec2(1.0, 0.85)) * 1.45, 2.4);
    col = mix(col, sc, screen);
  }
  col *= light;
  // the pen head: a vermilion point, a little hot, a narrow warm halo on the paper
  for (int i = 0; i < 3; i++) {
    if (heads[i].z <= 0.0) continue;
    float d = length(sp - heads[i].xy);
    col = mix(col, C_EMBER * 1.6 * heads[i].z, (1.0 - smoothstep(heads[i].w * 0.5, heads[i].w, d)) * min(1.0, heads[i].z));
    col += C_SIGNAL * heads[i].z * (0.35 + 0.8 * screen) * exp(-d / (heads[i].w * (5.0 + 1.0 * screen)));
  }
  fragColor = vec4(col, 1.0);
}`;

export interface Stamp { x: number; y: number; hw: number; hh: number; rot: number; strength: number; seed: number }
export interface Head { x: number; y: number; k: number; r?: number }

export class Paper {
  pass = new FSPass(PAPER_FRAG, {
    inkTex: { value: null }, camA: { value: new THREE.Vector3() }, camB: { value: new THREE.Vector3() }, zoom: { value: 1 },
    stA: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) }, stB: { value: Array.from({ length: 4 }, () => new THREE.Vector4()) },
    heads: { value: Array.from({ length: 3 }, () => new THREE.Vector4()) },
    offR: { value: new THREE.Vector2() }, offG: { value: new THREE.Vector2() }, offB: { value: new THREE.Vector2() },
    slip: { value: 0 }, slipSeed: { value: 0 }, light: { value: 1 }, screen: { value: 0 },
  });
  /** Draw the sheet: `ink` holds the channel-coded coverage in screen space, `m` the page camera. */
  render(renderer: THREE.WebGLRenderer, ink: THREE.Texture, m: Xf, zoom: number, out: THREE.WebGLRenderTarget, o: {
    stamps?: Stamp[]; heads?: Head[]; misreg?: [V2, V2, V2]; slip?: number; slipSeed?: number; light?: number; screen?: number;
  } = {}) {
    const u = this.pass.u;
    const im = invXf(m);
    u.inkTex!.value = ink;
    (u.camA!.value as THREE.Vector3).set(im.a, im.c, im.e);
    (u.camB!.value as THREE.Vector3).set(im.b, im.d, im.f);
    u.zoom!.value = zoom;
    const sa = u.stA!.value as THREE.Vector4[], sb = u.stB!.value as THREE.Vector4[];
    for (let i = 0; i < 4; i++) {
      const s = o.stamps?.[i];
      if (s) { sa[i]!.set(s.x, s.y, s.hw, s.hh); sb[i]!.set(s.rot, s.strength, s.seed, 0); } else sb[i]!.set(0, 0, 0, 0);
    }
    const hs = u.heads!.value as THREE.Vector4[];
    for (let i = 0; i < 3; i++) {
      const h = o.heads?.[i];
      if (h && h.k > 0) hs[i]!.set(h.x, h.y, h.k, h.r ?? 4); else hs[i]!.set(0, 0, 0, 1);
    }
    const mr = o.misreg ?? [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 0, y: 0 }];
    (u.offR!.value as THREE.Vector2).set(mr[0].x, mr[0].y);
    (u.offG!.value as THREE.Vector2).set(mr[1].x, mr[1].y);
    (u.offB!.value as THREE.Vector2).set(mr[2].x, mr[2].y);
    u.slip!.value = o.slip ?? 0;
    u.slipSeed!.value = o.slipSeed ?? 0;
    u.light!.value = o.light ?? 1;
    u.screen!.value = o.screen ?? 0;
    this.pass.render(renderer, out);
  }
}

/** Post overrides for a paper plate (ink on bone: no bloom on the paper, subtitles in ink). */
export const PAPER_POST = { paper: 1, bloom: 0.25, bloomThreshold: 1.6, halation: 0.03, vignette: 0.16, grain: 0.05, ca: 0.4 };
/** Post overrides for a screen plate (the red line blooms, subtitles in bone). */
export const SCREEN_POST = { paper: 0, bloom: 0.75, bloomThreshold: 0.8, halation: 0.12, vignette: 0.3, grain: 0.06, ca: 1.0 };

// ------------------------------------------------------------------ the system's eye (HUD in screen px)
// What the machine sees: brackets, tracking boxes, class labels with confidences, typed verdicts. Drawn in
// normal colours on an overlay layer; red items glow a little (canvas shadow), never more.
export const SYS = { fg: 'rgba(233,228,216,0.95)', dim: 'rgba(151,156,159,0.9)', red: 'rgba(214,58,36,1)', glow: 'rgba(232,96,74,0.85)' };
/** The system's type is read at a glance: every tag and panel size is scaled by this. */
export const HUD_K = 1.45;

// ------------------------------------------------------------------ the day (the whole song is one day)
// Song time → clock time: entered at 08:05, the window at 10:30, the hotline after lunch, the glass at 16:40,
// the cards in the evening, the coach at 23:41.
const DAY: [number, number][] = [
  [0, 7 * 60 + 42], [15.6, 8 * 60 + 5], [28, 8 * 60 + 21], [40.3, 10 * 60 + 30], [53.4, 11 * 60 + 2], [78.3, 14 * 60 + 10],
  [105.6, 16 * 60 + 40], [129.6, 17 * 60 + 5], [136.7, 19 * 60 + 30], [173.5, 23 * 60 + 28], [182.2, 23 * 60 + 41], [191.8, 23 * 60 + 59],
];
/** Minutes since midnight at song time t. */
export function dayMinutes(t: number) {
  for (let i = 1; i < DAY.length; i++) if (t <= DAY[i]![0]) { const [a, ma] = DAY[i - 1]!, [b, mb] = DAY[i]!; return lerp(ma, mb, (t - a) / (b - a)); }
  return DAY[DAY.length - 1]![1];
}
export const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
/** The plate's header: a recording dot, what is being looked at, and the time of day (top right, large). */
export function chrome(c: Ctx2, t: number, title: string) {
  c.save();
  c.textBaseline = 'alphabetic';
  c.font = font(F.hei(600), 30);
  const w = c.measureText(title).width;
  c.fillStyle = 'rgba(16,17,18,0.82)';
  c.fillRect(36, 36, w + 92, 60);
  c.fillRect(1884 - 196, 36, 196, 70);
  c.fillStyle = SYS.red; glowOn(c, 0.6);
  if (Math.round(t * 60) % 60 < 40) { c.beginPath(); c.arc(64, 66, 8, 0, Math.PI * 2); c.fill(); }
  glowOff(c);
  c.fillStyle = SYS.fg;
  c.fillText(title, 90, 77);
  c.font = font(F.mono(500), 52);
  c.textAlign = 'right';
  c.fillText(hhmm(dayMinutes(t)), 1866, 90);
  c.textAlign = 'left';
  c.restore();
}

/** Load an image from public/ (real-case material). */
export async function loadImage(url: string) {
  const im = new Image();
  im.src = url;
  await im.decode();
  return im;
}
export function glowOn(c: Ctx2, k = 1) { c.shadowColor = SYS.glow; c.shadowBlur = 10 * k; }
export function glowOff(c: Ctx2) { c.shadowBlur = 0; }
/** Corner brackets round a box (the detector's frame); `k` 0..1 draws them in from the corners. */
export function brackets(c: Ctx2, x: number, y: number, w: number, h: number, color: string, k = 1, len = 18, lw = 2) {
  const l = Math.min(len, w / 2, h / 2) * k;
  c.strokeStyle = color; c.lineWidth = lw;
  c.beginPath();
  for (const [px, py, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]] as const) {
    c.moveTo(px + sx * l, py); c.lineTo(px, py); c.lineTo(px, py + sy * l);
  }
  c.stroke();
}
/** A class tag on a box: filled bar, mono text (`text` typed in by `k`). */
export function sysTag(c: Ctx2, text: string, x: number, y: number, bg: string, fg: string, k = 1, size = 15) {
  const chars = Array.from(text), n = Math.ceil(chars.length * clamp(k));
  if (n <= 0) return;
  size *= HUD_K;
  c.font = font(F.hei(600), size);
  const w = c.measureText(text).width + 16;
  c.fillStyle = bg; c.fillRect(x, y - size - 8, w * clamp(k * 1.5), size + 10);
  c.fillStyle = fg; c.fillText(chars.slice(0, n).join(''), x + 8, y - 6);
}
/** A readout panel: title rule, then key/value rows typed in on their own times. */
export function sysPanel(c: Ctx2, x: number, y: number, w: number, title: string, rows: { k: string; v: string; t: number; red?: boolean }[], t: number, size = 17) {
  size = Math.round(size * HUD_K);
  w *= HUD_K * 0.95;
  x = Math.max(40, Math.min(x, 1880 - w));
  y = Math.max(110, Math.min(y, 860 - (46 + rows.length * (size + 14))));
  const t0 = rows[0]?.t ?? 0;
  if (t < t0 - 0.12) return;
  c.save();
  c.globalAlpha *= prog(t, t0 - 0.12, t0, (x) => x);
  c.fillStyle = 'rgba(16,17,18,0.93)';
  const h = 56 + rows.length * (size + 14);
  c.fillRect(x, y, w, h);
  c.strokeStyle = SYS.dim; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  c.fillStyle = SYS.dim;
  label(c, title, x + 16, y + 28, 16, 600, 3);
  c.fillRect(x + 16, y + 38, w - 32, 1);
  rows.forEach((r, i) => {
    const yy = y + 40 + (i + 1) * (size + 14);
    if (t < r.t) return;
    c.fillStyle = SYS.dim; c.font = font(F.hei(400), size - 2); c.fillText(r.k, x + 14, yy);
    const chars = Array.from(r.v), n = Math.ceil(chars.length * prog(t, r.t, r.t + 0.06 * chars.length + 0.05));
    c.fillStyle = r.red ? SYS.red : SYS.fg; c.font = font(F.hei(700), size);
    if (r.red) glowOn(c, 0.8);
    c.textAlign = 'right'; c.fillText(chars.slice(0, n).join(''), x + w - 14, yy); c.textAlign = 'left';
    glowOff(c);
  });
  c.restore();
}

// ------------------------------------------------------------------ the correction line
export interface Route { pts: V2[]; L: Float32Array; total: number }
export function route(pts: V2[]): Route {
  const L = polylineLengths(pts);
  return { pts, L, total: L[pts.length - 1] ?? 0 };
}
/**
 * Stroke the first `len` px of a route (ruler-straight, square joins) and return the pen head.
 * `style` sets stroke style/width beforehand; the caller picks the channel (RED for the line).
 */
export function drawRoute(c: Ctx2, r: Route, len: number, from = 0): V2 & { angle: number } {
  const a = clamp(from, 0, r.total), b = clamp(len, 0, r.total);
  const head = pointAtLength(r.pts, r.L, b);
  if (b <= a) return head;
  const s = pointAtLength(r.pts, r.L, a);
  c.beginPath();
  c.moveTo(s.x, s.y);
  for (let i = 1; i < r.pts.length; i++) if (r.L[i]! > a && r.L[i]! < b) c.lineTo(r.pts[i]!.x, r.pts[i]!.y);
  c.lineTo(head.x, head.y);
  c.stroke();
  return head;
}
/** An arrowhead at p pointing along angle (filled). */
export function arrowHead(c: Ctx2, x: number, y: number, angle: number, size = 14) {
  c.save();
  c.translate(x, y); c.rotate(angle);
  c.beginPath(); c.moveTo(0, 0); c.lineTo(-size, -size * 0.42); c.lineTo(-size * 0.8, 0); c.lineTo(-size, size * 0.42); c.closePath(); c.fill();
  c.restore();
}

// ------------------------------------------------------------------ stamps, labels, greeked text
/**
 * A rectangular rubber stamp (double rule, display text, small legend) centred at (x, y). Pass the same
 * rect as a Paper Stamp to give it rubber-stamp ink. `k` 0..1 is the slam (oversize -> 1).
 */
export function drawStamp(c: Ctx2, x: number, y: number, hw: number, hh: number, rot: number, text: string, legend: string, k = 1, color = RED) {
  c.save();
  c.translate(x, y); c.rotate(rot);
  const s = lerp(1.08, 1, k);
  c.scale(s, s);
  c.strokeStyle = color(1);
  c.lineWidth = Math.max(4, hh * 0.09); c.strokeRect(-hw + 4, -hh + 4, hw * 2 - 8, hh * 2 - 8);
  c.lineWidth = Math.max(1.5, hh * 0.03); c.strokeRect(-hw + 4 + hh * 0.16, -hh + 4 + hh * 0.16, hw * 2 - 8 - hh * 0.32, hh * 2 - 8 - hh * 0.32);
  c.fillStyle = color(1);
  c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const fam = F.song(900);
  const size = Math.min(hh * 0.95, (100 * (hw * 2 - hh * 0.9)) / measure(text, fam, 100, 0));
  c.font = font(fam, size);
  c.fillText(text, 0, legend ? size * 0.28 : size * 0.36);
  if (legend) {
    c.font = font(F.hei(700), Math.max(11, hh * 0.15));
    c.letterSpacing = `${Math.max(2, hh * 0.04)}px`;
    c.fillText(legend, 0, hh - 4 - hh * 0.3);
    c.letterSpacing = '0px';
  }
  c.restore();
}

/** Text that is there but not read: lines of grey bars with word gaps (seeded), ragged last line. */
export function greek(c: Ctx2, x: number, y: number, w: number, lines: number, lead: number, h: number, seed: number, indent = 0) {
  for (let i = 0; i < lines; i++) {
    let xx = x + (i === 0 ? indent : 0);
    const end = x + (i === lines - 1 ? w * (0.35 + 0.45 * hash(seed, i, 9)) : w);
    let k = 0;
    while (xx < end - 8) {
      const ww = Math.min(end - xx, h * (2 + Math.floor(hash(seed, i, k) * 6)));
      c.fillRect(xx, y + i * lead - h, ww, h);
      xx += ww + h * 0.55;
      k++;
    }
  }
}

/** A mono label with tracking (the system's small type). */
export function label(c: Ctx2, s: string, x: number, y: number, size = 13, weight = 500, track = 3, align: CanvasTextAlign = 'left') {
  c.font = font(F.mono(weight), size);
  c.letterSpacing = `${track}px`;
  c.textAlign = align;
  c.fillText(s, x, y);
  c.letterSpacing = '0px';
  c.textAlign = 'left';
}

/** A dimension line (architectural): extension ticks at a and b, the value set above the middle. */
export function dimension(c: Ctx2, ax: number, ay: number, bx: number, by: number, text: string, off = 0, size = 13) {
  const ang = Math.atan2(by - ay, bx - ax), nx = -Math.sin(ang), ny = Math.cos(ang);
  const a = { x: ax + nx * off, y: ay + ny * off }, b = { x: bx + nx * off, y: by + ny * off };
  c.beginPath();
  c.moveTo(a.x, a.y); c.lineTo(b.x, b.y);
  for (const p of [a, b]) { c.moveTo(p.x - 6 * Math.cos(ang + 0.8), p.y - 6 * Math.sin(ang + 0.8)); c.lineTo(p.x + 6 * Math.cos(ang + 0.8), p.y + 6 * Math.sin(ang + 0.8)); }
  if (off) { c.moveTo(ax, ay); c.lineTo(a.x + nx * 6, a.y + ny * 6); c.moveTo(bx, by); c.lineTo(b.x + nx * 6, b.y + ny * 6); }
  c.stroke();
  c.save();
  c.translate((a.x + b.x) / 2 - nx * 8, (a.y + b.y) / 2 - ny * 8);
  c.rotate(Math.abs(ang) > Math.PI / 2 ? ang + Math.PI : ang);
  label(c, text, 0, 0, size, 500, 2, 'center');
  c.restore();
}

// ------------------------------------------------------------------ scale figures
// Architectural scale figures (配景人): the only people in the film. Profile, facing +x, feet at (0,0),
// height 1 (y up is negative). Compressed human traces: no faces, no hands' detail, no expressions.
// Control polygons, rounded by Chaikin subdivision; the arm is filled with the body (one union) and keeps
// its own contour line, as scale figures do.
type P = [number, number];
const ADULT: P[] = [
  [-0.035, -0.855], [-0.075, -0.815], [-0.085, -0.72], [-0.07, -0.6], [-0.088, -0.5], [-0.072, -0.4], [-0.056, -0.27],
  [-0.066, -0.14], [-0.05, -0.035], [-0.062, 0], [0.092, 0], [0.088, -0.022], [0.022, -0.05], [0.03, -0.16], [0.046, -0.28],
  [0.05, -0.4], [0.056, -0.5], [0.062, -0.58], [0.076, -0.7], [0.06, -0.8], [0.03, -0.84], [0.026, -0.862],
];
const ARM_HANG: P[] = [[-0.032, -0.812], [0.036, -0.8], [0.042, -0.65], [0.052, -0.48], [0.036, -0.44], [0.014, -0.47], [-0.006, -0.64]];
const ARM_REACH: P[] = [[-0.03, -0.82], [0.03, -0.83], [0.17, -0.75], [0.31, -0.73], [0.31, -0.7], [0.16, -0.7], [0.0, -0.76]];
const ARM_GRAB: P[] = [[-0.03, -0.82], [0.03, -0.83], [0.19, -0.73], [0.27, -0.68], [0.25, -0.645], [0.17, -0.68], [0.0, -0.76]];
// the protective suit: bulky, a hood that runs into the body, a blank face opening
const SUIT: P[] = [
  [-0.06, -0.93], [-0.105, -0.84], [-0.115, -0.72], [-0.112, -0.55], [-0.102, -0.45], [-0.092, -0.3], [-0.082, -0.1],
  [-0.088, 0], [0.112, 0], [0.104, -0.04], [0.062, -0.08], [0.066, -0.3], [0.082, -0.45], [0.102, -0.58], [0.108, -0.72],
  [0.092, -0.82], [0.082, -0.87], [0.088, -0.95], [0.06, -1.0], [0.0, -1.015], [-0.045, -0.99],
];
const SUIT_ARM: P[] = [[-0.045, -0.8], [0.05, -0.79], [0.072, -0.6], [0.082, -0.46], [0.042, -0.43], [0.01, -0.6]];

/** Chaikin corner cutting (closed polygon), `n` rounds. */
function chaikin(pts: P[], n = 2): P[] {
  let p = pts;
  for (let k = 0; k < n; k++) {
    const q: P[] = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i]!, b = p[(i + 1) % p.length]!;
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    p = q;
  }
  return p;
}
const SMOOTH = new Map<P[], P[]>();
const smooth = (p: P[]) => { let s = SMOOTH.get(p); if (!s) SMOOTH.set(p, (s = chaikin(p))); return s; };
/** The child: the same outline with shorter legs (the proportion is the pun, not the size alone). */
const CHILD = ADULT.map(([x, y]): P => [x * 1.08, y > -0.5 ? y * 0.74 : y + 0.13]);
const CHILD_ARM = ARM_HANG.map(([x, y]): P => [x * 1.08, y + 0.13]);

export type FigureKind = 'adult' | 'reach' | 'grab' | 'suit' | 'child';
export interface FigureStyle { fill?: string; stroke?: string; lw?: number; hatch?: string }

function poly(c: Ctx2, pts: P[], s: number) { c.moveTo(pts[0]![0] * s, pts[0]![1] * s); for (let i = 1; i < pts.length; i++) c.lineTo(pts[i]![0] * s, pts[i]![1] * s); c.closePath(); }

/** Draw a scale figure of height h with its feet at (x, y); `dir` -1 faces left. */
export function drawFigure(c: Ctx2, kind: FigureKind, x: number, y: number, h: number, st: FigureStyle, dir = 1) {
  c.save();
  c.translate(x, y);
  c.scale(dir, 1);
  const child = kind === 'child', suit = kind === 'suit';
  const s = h;
  const body = smooth(suit ? SUIT : child ? CHILD : ADULT);
  const arm = smooth(suit ? SUIT_ARM : child ? CHILD_ARM : kind === 'reach' ? ARM_REACH : kind === 'grab' ? ARM_GRAB : ARM_HANG);
  const head = () => {
    if (suit) return;
    const rx = child ? 0.078 : 0.058, ry = child ? 0.084 : 0.068, hy = child ? -0.83 : -0.928;
    c.moveTo((0.012 + rx) * s, hy * s);
    c.ellipse(0.012 * s, hy * s, rx * s, ry * s, -0.15, 0, Math.PI * 2);
  };
  // one union for the fill (body, arm, head), then each contour
  c.beginPath(); poly(c, body, s); poly(c, arm, s); head();
  if (st.fill) { c.fillStyle = st.fill; c.fill('nonzero'); }
  if (st.stroke) {
    c.strokeStyle = st.stroke; c.lineWidth = st.lw ?? 1.5; c.lineJoin = 'round';
    c.beginPath(); poly(c, body, s); head(); c.stroke();
    c.lineWidth = (st.lw ?? 1.5) * 0.75;
    c.beginPath(); poly(c, arm, s); c.stroke();
  }
  if (suit) {
    // the face opening: blank, in the hood's side
    c.beginPath();
    c.ellipse(0.058 * s, -0.915 * s, 0.026 * s, 0.05 * s, 0.1, 0, Math.PI * 2);
    if (st.hatch) { c.fillStyle = st.hatch; c.fill(); }
    if (st.stroke) { c.lineWidth = (st.lw ?? 1.5) * 0.75; c.stroke(); }
    // the suit's seams: a zip and the hood's drawstring line
    if (st.stroke) {
      c.lineWidth = (st.lw ?? 1.5) * 0.5;
      c.beginPath(); c.moveTo(0.075 * s, -0.84 * s); c.quadraticCurveTo(0.09 * s, -0.6 * s, 0.07 * s, -0.42 * s); c.stroke();
      c.beginPath(); c.moveTo(-0.07 * s, -0.86 * s); c.quadraticCurveTo(0.0, -0.84 * s, 0.08 * s, -0.865 * s); c.stroke();
    }
  }
  c.restore();
}

/** Horizontal hatching clipped to the current path region given as a callback (for sections). */
export function hatchRect(c: Ctx2, x: number, y: number, w: number, h: number, step = 7, angle = -Math.PI / 4) {
  c.save();
  c.beginPath(); c.rect(x, y, w, h); c.clip();
  const cx = x + w / 2, cy = y + h / 2, R = Math.hypot(w, h) / 2 + step;
  c.translate(cx, cy); c.rotate(angle);
  c.beginPath();
  for (let k = -R; k <= R; k += step) { c.moveTo(-R, k); c.lineTo(R, k); }
  c.stroke();
  c.restore();
}

/**
 * Real-case material, quoted (see refs/SOURCES.md): drawn at (x, y, w, h), desaturated and a little coarsened (a
 * screenshot of a screenshot), with its source line. The low resolution against the vector system is the point.
 */
export function drawQuoted(c: Ctx2, im: HTMLImageElement, x: number, y: number, w: number, h: number, coarse = 0.5) {
  c.save();
  c.imageSmoothingEnabled = true;
  c.filter = 'grayscale(0.75) contrast(1.05) brightness(0.92)';
  if (coarse > 0) {
    // down and up again: the softness of a re-posted video frame
    const cw = Math.max(40, Math.round(im.width * (1 - coarse))), ch = Math.max(30, Math.round(im.height * (1 - coarse)));
    const oc = coarseCanvas(cw, ch);
    const ox = oc.getContext('2d')!;
    ox.filter = c.filter;
    ox.drawImage(im, 0, 0, cw, ch);
    c.filter = 'none';
    c.drawImage(oc, 0, 0, cw, ch, x, y, w, h);
  } else c.drawImage(im, x, y, w, h);
  c.restore();
}
const COARSE = new Map<string, HTMLCanvasElement>();
function coarseCanvas(w: number, h: number) {
  const k = w + 'x' + h;
  let cv = COARSE.get(k);
  if (!cv) { cv = document.createElement('canvas'); cv.width = w; cv.height = h; COARSE.set(k, cv); }
  return cv;
}
/** The source line under quoted material. */
export function sourceLine(c: Ctx2, text: string, x: number, y: number) {
  c.save();
  c.font = font(F.hei(500), 20);
  const w = c.measureText(text).width;
  c.fillStyle = 'rgba(16,17,18,0.8)'; c.fillRect(x - 10, y - 26, w + 20, 36);
  c.fillStyle = SYS.fg; c.fillText(text, x, y);
  c.restore();
}

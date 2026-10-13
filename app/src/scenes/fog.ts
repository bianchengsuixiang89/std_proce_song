// 图版 02 `fog` — 白雾 / "穿着白色防护服的人 · 再一次靠近你 · 脸上没有五官 · 只剩一层白雾而已"
//   F1 (PAPER) 穿着白色防护服的人: the garment's spec sheet (医用一次性防护服, front view, callouts, GB 19082):
//      everything about the suit is specified except who is in it. On 人 the red line boxes the blank 穿戴者 field.
//   F2 (SCREEN) 再一次靠近你: a proximity radar centred on the resident: the sweep finds the suit at 4 m and it comes
//      in ring by ring (the first visit, this morning, a fainter track): 防护人员 · 今日第 2 次 · 0.4 m.
//   F3 (shader) 脸上没有五官 · 只剩一层白雾而已: the dot becomes the hood. A close-up of the suit's face: hood,
//      goggles fogged from inside (condensation, droplets), a KN95 mask, a face shield breathing fog. There is no
//      face to see, only white mist. The system's face detector fits 68 landmarks on 脸, loses them on 五官
//      (人脸关键点 0/68) and files what is left: 身份 不适用 · 工号 — · 责任人 —. The system sees everything about
//      the visitor and nothing about its own agent.
//   Between F2 and F3, in the instrumental: the real thing, quoted: a home security-camera still from Shangrao
//   (2021.11: two workers in protective suits in the owner's home; legs, shoe covers, the pet), blurred and grey
//   against the crisp system, which boxes them as 防护人员 ×2 · 已授权入户.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H, clearRT } from '../engine/gl';
import { Lyrics, type Line } from '../engine/lyrics';
import { F, font } from '../engine/type';
import { clamp, ease, lerp, prog, pulse, hash, frameIdx, TAU, pointAtLength } from '../engine/util';
import { Paper, PAPER_POST, SCREEN_POST, SYS, glowOn, glowOff, brackets, sysTag, sysPanel, INK, PRINT, RED, camXf, applyXf, lerpCam, label, route, drawRoute, dimension, type Cam, type Ctx2, type Xf, chrome, loadImage, drawQuoted, sourceLine } from './_archive';

const VISOR_FRAG = /* glsl */ `
uniform float time; uniform float fogAmt; uniform float breath; uniform float zoom; uniform vec2 off; uniform float light;
float se(vec2 p, vec2 r, float n) { vec2 q = abs(p / r); return pow(pow(q.x, n) + pow(q.y, n), 1.0 / n) - 1.0; }
float sdRB(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
float fillAA(float d) { float w = fwidth(d) * 1.2; return 1.0 - smoothstep(-w, w, d); }
// condensation droplets: (coverage, highlight)
vec2 drops(vec2 p, float dens) {
  vec2 cell = floor(p), f = fract(p);
  vec2 res = vec2(0.0);
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 id = cell + g;
    if (hash12(id + 7.7) > dens) continue;
    vec2 o = g + 0.2 + 0.6 * hash22(id);
    float r = 0.1 + 0.28 * hash12(id + 3.1);
    float d = length((f - o) * vec2(1.0, 0.9)) - r;
    float w = fwidth(d) * 1.5;
    float cov = 1.0 - smoothstep(-w, w, d);
    float hl = (1.0 - smoothstep(0.0, r * 0.35, length(f - o - vec2(-0.35, 0.35) * r))) * cov;
    res = max(res, vec2(cov, hl));
  }
  return res;
}
void main() {
  vec2 p = (FRAG_PX - vec2(960.0, 540.0)) / (540.0 * zoom) - off;  // y up
  vec3 L = normalize(vec3(-0.55, 0.65, 0.75));
  // ground: a dark stairwell, a fluorescent tube above
  vec3 col = C_INK * 0.4 + C_SLATE * 0.07 * smoothstep(-1.2, 1.0, p.y);
  col += C_FOG * 0.1 * exp(-pow((p.y - 1.05) * 4.0, 2.0)) * smoothstep(1.6, 0.0, abs(p.x));

  // ---- the hood (Tyvek): head and shoulders
  vec2 hc = p - vec2(0.0, 0.12);
  float dHead = se(hc, vec2(0.66, 0.8), 2.4);
  float dSh = se(p - vec2(0.0, -1.55), vec2(1.85, 0.95), 2.6);
  float inHood = fillAA(smin(dHead * 0.55, dSh * 0.6, 0.16));  // head and shoulders, one slope
  if (inHood > 0.0) {
    vec2 q = hc / vec2(0.66, 0.8);
    float z = sqrt(max(0.0, 1.0 - dot(q, q) * 0.85));
    vec3 n = normalize(vec3(q.x * 0.9, q.y * 0.9, z + 0.25));
    if (dHead > 0.0) n = normalize(vec3(p.x / 2.0, (p.y + 1.55) / 1.1, 0.9));
    float dif = max(dot(n, L), 0.0);
    // crinkles: warped ridges
    vec2 w = p * vec2(1.6, 3.4) + vec2(snoise(p * 1.3 + 3.1), snoise(p * 1.3 - 1.7)) * 0.6;
    float ridge = 1.0 - abs(snoise(w));
    float fine = 1.0 - abs(snoise(p * vec2(9.0, 15.0) + snoise(p * 4.0) * 0.8));
    float crink = 0.93 + 0.08 * pow(ridge, 6.0) - 0.05 * pow(1.0 - ridge, 3.0) + 0.025 * fine;
    vec3 tyvek = C_FOG * (0.16 + 0.95 * dif) * crink;
    // pleats where the elastic gathers round the face opening
    vec2 oc = (p - vec2(0.0, 0.1)) / vec2(0.43, 0.55);
    float orr = length(oc), oa = atan(oc.y, oc.x);
    float pleat = smoothstep(1.0, 1.04, orr) * smoothstep(1.4, 1.08, orr) * (0.5 + 0.5 * sin(oa * 34.0 + snoise(vec2(oa * 3.0, 1.0)) * 2.0));
    tyvek *= 1.0 - 0.32 * pleat;
    col = mix(col, tyvek, inHood);
  }
  // ---- the face opening: inside, only shadow
  float dOpen = se(p - vec2(0.0, 0.1), vec2(0.43, 0.55), 2.2);
  float inOpen = fillAA(dOpen * 0.4);
  col = mix(col, C_INK2 * 0.9 + C_SLATE * 0.12 * smoothstep(-0.6, 0.4, p.y), inOpen);

  // ---- the KN95 mask
  vec2 mc = p - vec2(0.0, -0.12);
  float dMask = max(se(mc, vec2(0.3, 0.28), 1.7), (p.y - 0.1) * 4.0);
  float inMask = fillAA(dMask * 0.4);
  if (inMask > 0.0) {
    vec2 q = mc / vec2(0.36, 0.33);
    vec3 n = normalize(vec3(q.x * 0.8, q.y * 0.6, 1.0));
    float dif = max(dot(n, L), 0.0);
    vec3 m = C_BONE * (0.22 + 0.72 * dif) * (0.96 + 0.04 * snoise(p * 40.0));
    m *= 1.0 - 0.35 * (1.0 - smoothstep(0.0, 0.012, abs(p.x))) ;          // the centre fold
    m *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.01, abs(mc.y + 0.05 - 0.15 * mc.x * mc.x)));
    col = mix(col, m, inMask);
  }
  // ear loops
  for (int s = -1; s <= 1; s += 2) {
    vec2 a = vec2(0.35 * float(s), -0.08), b = vec2(0.6 * float(s), 0.12);
    float d = sdSegment(p, a, b);
    col = mix(col, C_FOG * 0.55, (1.0 - smoothstep(0.004, 0.009, d)) * 0.9);
  }

  // ---- the goggles: strap, rubber seal, lens fogged from inside
  vec2 gc = p - vec2(0.0, 0.25);
  float strap = (1.0 - smoothstep(0.045, 0.052, abs(p.y - 0.255))) * step(0.36, abs(p.x)) * inHood;
  col = mix(col, C_INK2 * (0.8 + 0.6 * max(0.0, -p.x)) + C_SLATE * 0.15, strap);
  float dSeal = sdRB(gc, vec2(0.4, 0.165), 0.12);
  float dLens = sdRB(gc, vec2(0.355, 0.125), 0.1);
  float inSeal = fillAA(dSeal), inLens = fillAA(dLens);
  col = mix(col, C_INK2 * 0.7 + C_SLATE * 0.18 * smoothstep(-0.2, 0.2, gc.y), inSeal);
  if (inLens > 0.0) {
    vec3 behind = C_INK2 * 0.8;
    float dens = 0.8 + 0.2 * fogAmt;
    dens *= 0.82 + 0.18 * fbm(gc * 5.0 + vec2(0.0, time * 0.04), 3);
    dens = sat(dens + 0.12 * breath * smoothstep(0.1, -0.1, gc.y));
    vec3 fogc = C_FOG * (0.86 + 0.2 * smoothstep(-0.15, 0.15, gc.y) + 0.05 * snoise(gc * 7.0));
    vec3 lens = mix(behind, fogc, dens);
    vec2 dr = drops(gc * vec2(46.0, 46.0), 0.12 + 0.3 * smoothstep(0.02, -0.12, gc.y));
    lens = mix(lens, mix(behind, fogc, dens * 0.55), dr.x * 0.55);
    lens += C_BONE * dr.y * 0.25;
    lens += C_FOG * 0.25 * exp(-pow((gc.x + gc.y * 0.8 + 0.12) * 14.0, 2.0)); // a glint across the lens
    col = mix(col, lens, inLens);
  }

  // ---- the face shield: headband, clear plastic, glints, breath fog
  float dShield = sdRB(p - vec2(0.0, -0.08), vec2(0.6, 0.62), 0.16);
  float inShield = fillAA(dShield);
  if (inShield > 0.0) {
    vec3 s = col * 0.93 + C_FOG * 0.03;
    float g1 = exp(-pow((dot(p, normalize(vec2(1.0, 0.55))) + 0.05) * 16.0, 2.0)) * 0.16;
    float g2 = exp(-pow((dot(p, normalize(vec2(1.0, 0.5))) - 0.42) * 30.0, 2.0)) * 0.1;
    s += C_FOG * (g1 + g2) * smoothstep(-0.7, 0.3, p.y);
    // breath fog, from the mouth outward; on 白雾 it covers everything
    vec2 bc = (p - vec2(0.0, -0.2)) / vec2(1.0, 0.8);
    float r = 0.16 + 0.22 * breath + 1.1 * fogAmt * fogAmt;
    float bf = smoothstep(r, r * 0.4, length(bc) + 0.05 * fbm(p * 3.0 + time * 0.05, 3));
    s = mix(s, C_FOG * (0.66 + 0.06 * snoise(p * 3.0 + time * 0.1)), bf * (0.5 + 0.42 * fogAmt));
    col = mix(col, s, inShield);
    float edge = 1.0 - smoothstep(0.0, 0.006, abs(dShield));
    col += C_FOG * 0.22 * edge * smoothstep(-0.8, 0.6, p.y);
  }
  float band = (1.0 - smoothstep(0.045, 0.05, abs(p.y - 0.58))) * step(abs(p.x), 0.62);
  col = mix(col, C_FOG * (0.5 + 0.3 * smoothstep(0.62, -0.2, p.x)) * (0.9 + 0.1 * snoise(p * 30.0)), band);
  col *= light;
  fragColor = vec4(col, 1.0);
}`;

/** 68 face landmarks (face units: x right, y up; the face centred at the opening). */
function landmarks(): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i < 17; i++) { const a = Math.PI * (1.08 + (0.84 * i) / 16); pts.push({ x: 0.4 * Math.cos(a) * -1, y: 0.12 + 0.6 * Math.sin(a) }); } // jaw
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) pts.push({ x: s * (0.08 + i * 0.055), y: 0.38 + 0.03 * Math.sin((i / 4) * Math.PI) }); // brows
  for (let i = 0; i < 4; i++) pts.push({ x: 0, y: 0.3 - i * 0.07 });               // nose bridge
  for (let i = 0; i < 5; i++) pts.push({ x: (i - 2) * 0.04, y: 0.05 - 0.015 * (2 - Math.abs(i - 2)) }); // nose base
  for (const s of [-1, 1]) for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; pts.push({ x: s * 0.17 + 0.07 * Math.cos(a), y: 0.25 + 0.03 * Math.sin(a) }); } // eyes
  for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU; pts.push({ x: 0.16 * Math.cos(a), y: -0.2 + 0.06 * Math.sin(a) }); } // mouth outer
  for (let i = 0; i < 8; i++) { const a = (i / 8) * TAU; pts.push({ x: 0.1 * Math.cos(a), y: -0.2 + 0.025 * Math.sin(a) }); }  // mouth inner
  return pts;
}

export default class Fog extends Scene {
  ink = new Layer2D();
  hud = new Layer2D();
  paper = new Paper();
  visor = new FSPass(VISOR_FRAG, { time: { value: 0 }, fogAmt: { value: 0 }, breath: { value: 0 }, zoom: { value: 1 }, off: { value: new THREE.Vector2() }, light: { value: 1 } });
  L0!: Line; L1!: Line; L2!: Line; L3!: Line;
  beat = 0.4;
  T0 = 0; T1 = 0; tF2 = 0; tF3 = 0;
  tSuit = 0; tPerson = 0; tAgain = 0; tFace = 0; tFeat0 = 0; tFeat1 = 0; tMist0 = 0; tMist1 = 0;
  lm = landmarks();
  cctv!: HTMLImageElement;
  tCctv = 0;

  override async init() {
    const { lyrics, audio } = this.ctx;
    this.L0 = lyrics.get('穿着白色防护服的人'); this.L1 = lyrics.get('再一次靠近你');
    this.L2 = lyrics.get('脸上没有五官'); this.L3 = lyrics.get('只剩一层白雾而已');
    this.T0 = this.ctx.start; this.T1 = this.ctx.end;
    const b0 = Math.floor(audio.beatAt(this.T0));
    this.beat = audio.timeOfBeat(b0 + 1) - audio.timeOfBeat(b0);
    const onBeat = (t: number) => audio.timeOfBeat(Math.floor(audio.beatAt(t + 0.02)));
    this.tSuit = Lyrics.phrase(this.L0, '防护服').start;
    this.tPerson = Lyrics.phrase(this.L0, '人').start;
    this.tF2 = onBeat(this.L1.start);
    this.tAgain = Lyrics.phrase(this.L1, '再一次').start;
    // the face: on the last downbeat before 脸
    this.tF3 = [...audio.downbeats].reverse().find((d) => d < this.L2.start - 0.1 && d > this.L1.end) ?? onBeat(this.L2.start);
    this.tFace = this.L2.words[0]!.start;
    const wg = Lyrics.phrase(this.L2, '五官');
    this.tFeat0 = wg.start; this.tFeat1 = wg.end + 0.3;
    this.cctv = await loadImage('refs/shangrao_cctv.jpg');
    // the real footage: on the first beat after 再一次靠近你, until the visor
    this.tCctv = audio.timeOfBeat(Math.ceil(audio.beatAt(this.L1.end + 0.05)));
    const mist = Lyrics.phrase(this.L3, '白雾');
    this.tMist0 = mist.start; this.tMist1 = mist.end;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const { renderer, comp } = this.ctx;
    this.hud.clear();
    if (t >= this.tF3) {
      // F3: the visor
      const u = this.visor.u;
      const fogAmt = lerp(0.4, 1, ease.inOutCubic(prog(t, this.tMist0, this.tMist1 + 0.6)));
      // slow breathing: in on two beats, out on two
      const ph = (t - this.tF3) / (this.beat * 4);
      const breath = Math.pow(0.5 + 0.5 * Math.sin(ph * TAU - 1.2), 2);
      u.time!.value = t; u.fogAmt!.value = fogAmt; u.breath!.value = breath;
      u.zoom!.value = lerp(1.0, 1.16, prog(t, this.tF3, this.T1, ease.inOutQuad)) * (1 + 0.025 * pulse(t, this.tFeat0, 0.1));
      (u.off!.value as THREE.Vector2).set(0, lerp(0.02, -0.03, prog(t, this.tF3, this.T1)));
      u.light!.value = prog(t, this.tF3, this.tF3 + 0.12);
      this.visor.render(renderer, out);
      this.visorHud(this.hud.ctx, t, u.zoom!.value as number, (u.off!.value as THREE.Vector2).y);
      comp.draw(renderer, this.hud.upload(), out);
      return { bloom: 0.4, bloomThreshold: 0.9, halation: 0.08, vignette: 0.45, grain: 0.07, ca: 0.8, paper: 0 };
    }
    if (t >= this.tCctv) {
      // the real CCTV still, quoted: a slow push toward the white legs
      const hc = this.hud.ctx;
      hc.fillStyle = '#0b0c0d'; hc.fillRect(0, 0, W, H);
      const k = ease.inQuad(prog(t, this.tCctv, this.tF3));
      const z = lerp(1.04, 1.5, k), fx = lerp(0.5, 0.36, k), fy = lerp(0.5, 0.38, k);
      const iw = W * z, ih = (W * z * this.cctv.height) / this.cctv.width;
      const x = W / 2 - fx * iw, y = H / 2 - fy * ih;
      drawQuoted(hc, this.cctv, x, y, iw, ih, 0.45);
      // scanlines over the footage
      hc.fillStyle = 'rgba(0,0,0,0.12)';
      for (let yy = 0; yy < H; yy += 4) hc.fillRect(0, yy, W, 2);
      const P = (u: number, v: number) => ({ x: x + u * iw, y: y + v * ih });
      const a = P(0.25, 0.0), b = P(0.5, 0.94), a2 = P(0.82, 0.0), b2 = P(1.0, 0.7);
      const kb = prog(t, this.tCctv + 0.15, this.tCctv + 0.45, ease.outCubic);
      brackets(hc, a.x, Math.max(120, a.y), b.x - a.x, b.y - Math.max(120, a.y), SYS.red, kb, 34, 3);
      brackets(hc, a2.x, Math.max(120, a2.y), Math.min(W - 40, b2.x) - a2.x, b2.y - Math.max(120, a2.y), SYS.red, kb, 34, 3);
      glowOn(hc, 1);
      sysTag(hc, '防护人员 ×2 · 已授权入户', a.x, Math.max(150, a.y + 40), SYS.red, '#fff', prog(t, this.tCctv + 0.3, this.tCctv + 0.8), 17);
      glowOff(hc);
      chrome(hc, t, '参考案例 · 户内监控');
      clearRT(renderer, out, [0, 0, 0]);
      comp.draw(renderer, this.hud.upload(), out);
      return { bloom: 0.3, bloomThreshold: 0.9, halation: 0.05, vignette: 0.5, grain: 0.09, ca: 1.4, paper: 0 };
    }
    const L = this.ink;
    L.clear('#000');
    const c = L.ctx;
    c.globalCompositeOperation = 'lighter';
    let cam: Cam, screen = 0;
    const heads: { x: number; y: number; k: number }[] = [];
    if (t < this.tF2) cam = this.specSheet(c, t, heads);
    else { cam = this.walkIn(c, t, heads); screen = 1; }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    const ph = frameIdx(t);
    const amp = 8 * pulse(t, this.tF2, 0.05);
    const m = camXf(cam, amp * (hash(ph, 1) - 0.5), amp * (hash(ph, 2) - 0.5));
    this.paper.render(renderer, L.upload(), m, cam.z, out, { heads: heads.map((h) => ({ ...applyXf(m, h.x, h.y), k: h.k, r: 4 * Math.min(cam.z, 3) })), screen });
    if (screen) this.walkHud(this.hud.ctx, t, m);
    comp.draw(renderer, this.hud.upload(), out);
    return screen ? SCREEN_POST : PAPER_POST;
  }

  // ------------------------------------------------------------------ F1: the spec sheet
  specSheet(c: Ctx2, t: number, heads: { x: number; y: number; k: number }[]): Cam {
    const k = prog(t, this.T0, this.tF2);
    const toField = prog(t, this.tPerson - 0.25, this.tPerson + 0.15, ease.inOutCubic);
    const cam = lerpCam({ x: lerp(-180, -120, k), y: lerp(-40, 40, k), z: lerp(0.92, 1.0, k), r: -0.012 }, { x: 420, y: 230, z: 1.45, r: -0.006 }, toField);
    const m = camXf(cam);
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    // the coverall, front view (height 900, top of hood at y -470)
    const S = 900, top = -470, cx = -200;
    const half: [number, number][] = [[0, 0], [0.07, 0.005], [0.105, 0.04], [0.115, 0.1], [0.1, 0.15], [0.2, 0.18], [0.25, 0.22], [0.29, 0.35], [0.3, 0.46], [0.25, 0.47], [0.215, 0.3], [0.2, 0.42], [0.205, 0.5], [0.19, 0.8], [0.17, 0.95], [0.185, 1.0], [0.03, 1.0], [0.035, 0.55], [0, 0.53]];
    const P = (x: number, y: number) => ({ x: cx + x * S, y: top + y * S });
    c.strokeStyle = INK(0.9); c.lineWidth = 1.8; c.lineJoin = 'round';
    c.beginPath();
    half.forEach(([x, y], i) => { const p = P(x, y); i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y); });
    for (let i = half.length - 1; i >= 0; i--) { const p = P(-half[i]![0], half[i]![1]); c.lineTo(p.x, p.y); }
    c.closePath(); c.stroke();
    // face opening, zip, elastic
    c.lineWidth = 1.2;
    const fo = P(0, 0.075);
    c.beginPath(); c.ellipse(fo.x, fo.y, 0.055 * S, 0.055 * S, 0, 0, TAU); c.stroke();
    c.strokeStyle = PRINT(0.8);
    c.beginPath(); const z0 = P(0, 0.13), z1 = P(0, 0.53); c.moveTo(z0.x, z0.y); c.lineTo(z1.x, z1.y); c.stroke();
    c.setLineDash([4, 4]);
    c.beginPath(); c.moveTo(z0.x + 10, z0.y); c.lineTo(z1.x + 10, z1.y - 20); c.stroke();
    c.setLineDash([]);
    for (const [x, y, w] of [[0.275, 0.455, 0.05], [-0.275, 0.455, 0.05], [0.108, 0.975, 0.08], [-0.108, 0.975, 0.08]] as const) {
      const p = P(x, y);
      for (let i = 0; i < 6; i++) { c.beginPath(); c.moveTo(p.x - (w * S) / 2 + i * ((w * S) / 5), p.y - 6); c.lineTo(p.x - (w * S) / 2 + i * ((w * S) / 5), p.y + 6); c.stroke(); }
    }
    // callouts
    const calls: [string, number, number][] = [['1  连体帽', 0.09, 0.05], ['2  拉链 · 防护门襟', 0.01, 0.3], ['3  弹性袖口', 0.29, 0.46], ['4  弹性裤脚', 0.13, 0.95], ['5  鞋套（另配）', 0.17, 1.0]];
    calls.forEach(([s, x, y], i) => {
      const p = P(x, y), lx = cx + 0.42 * S, ly = top + (0.08 + i * 0.2) * S;
      c.strokeStyle = INK(0.55); c.lineWidth = 0.9;
      c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(lx - 10, ly - 6); c.lineTo(lx - 2, ly - 6); c.stroke();
      c.fillStyle = INK(0.9); c.font = font(F.hei(500), 20); c.fillText(s, lx, ly);
    });
    c.strokeStyle = INK(0.6); c.fillStyle = INK(0.85);
    dimension(c, cx - 0.36 * S, top, cx - 0.36 * S, top + S, '1750', 0, 13);
    // the title block: everything specified, except who wears it
    const bx = 220, by = 40, bw = 600;
    c.strokeStyle = INK(0.85); c.lineWidth = 1.4; c.strokeRect(bx, by, bw, 330);
    c.fillStyle = INK(0.95); c.font = font(F.song(900), 40); c.fillText('医用一次性防护服', bx + 28, by + 62);
    c.fillStyle = INK(0.55); c.fillRect(bx + 28, by + 84, bw - 56, 1);
    const rows: [string, string][] = [['执行标准', 'GB 19082'], ['型号', '175 / L'], ['颜色', '白'], ['穿戴者', '']];
    rows.forEach(([k2, v], i) => {
      const y = by + 130 + i * 52;
      c.fillStyle = INK(0.7); c.font = font(F.hei(500), 20); c.fillText(k2, bx + 28, y);
      c.fillStyle = INK(0.92); c.font = font(F.fang(), 26); c.fillText(v, bx + 160, y);
      c.fillStyle = INK(0.35); c.fillRect(bx + 150, y + 10, bw - 190, 1);
    });
    c.fillStyle = INK(0.6); c.font = font(F.hei(400), 15);
    c.fillText('（可不填）', bx + 160, by + 130 + 3 * 52 + 34);
    // the red line: under the garment's name on 防护服, then a box round the empty field on 人
    c.strokeStyle = RED(1); c.fillStyle = RED(1); c.lineWidth = 3;
    const uk = prog(t, this.tSuit, this.tSuit + 0.45, ease.inOutQuad);
    if (uk > 0) { c.fillRect(bx + 28, by + 74, 320 * uk, 3); if (uk < 1) heads.push({ x: bx + 28 + 320 * uk, y: by + 75, k: 1 }); }
    const bk = prog(t, this.tPerson, this.tPerson + 0.3, ease.inOutQuad);
    if (bk > 0) {
      const y = by + 130 + 3 * 52;
      const r = route([{ x: bx + 146, y: y - 32 }, { x: bx + bw - 30, y: y - 32 }, { x: bx + bw - 30, y: y + 46 }, { x: bx + 146, y: y + 46 }, { x: bx + 146, y: y - 33.5 }]);
      const hp = drawRoute(c, r, r.total * bk);
      if (bk < 1) heads.push({ x: hp.x, y: hp.y, k: 1 });
    }
    return cam;
  }

  // ------------------------------------------------------------------ F2: the proximity radar
  /** The suit's distance (m) and bearing on the radar at t: from 4 m in to 0.4 m across 再一次靠近你. */
  suitAt(t: number) {
    const k = ease.inOutQuad(prog(t, this.tF2, this.L1.end));
    return { d: lerp(4.2, 0.4, k), a: lerp(-2.3, -1.75, k) };
  }
  walkIn(c: Ctx2, t: number, heads: { x: number; y: number; k: number }[]): Cam {
    const cam: Cam = { x: 0, y: 0, z: lerp(0.95, 1.12, prog(t, this.tF2, this.tCctv)), r: 0 };
    const m = camXf(cam);
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    const px = 110; // px per metre
    c.strokeStyle = PRINT(0.9); c.lineWidth = 1.5;
    for (let r = 1; r <= 4; r++) {
      c.beginPath(); c.arc(0, 0, r * px, 0, TAU); c.stroke();
      c.fillStyle = INK(0.7); label(c, `${r} m`, r * px + 8, -8, 20, 500, 1);
    }
    c.beginPath(); c.moveTo(-480, 0); c.lineTo(480, 0); c.moveTo(0, -480); c.lineTo(0, 480); c.stroke();
    // the sweep: a red arm and its fading wake
    const sw = (t - this.tF2) * 2.6 - 2.6;
    for (let i = 0; i < 18; i++) {
      const a = sw - i * 0.035;
      c.strokeStyle = RED(i === 0 ? 1 : 0.35 * (1 - i / 18)); c.lineWidth = i === 0 ? 3 : 6;
      c.beginPath(); c.moveTo(0, 0); c.lineTo(Math.cos(a) * 470, Math.sin(a) * 470); c.stroke();
    }
    heads.push({ x: Math.cos(sw) * 470, y: Math.sin(sw) * 470, k: 1 });
    // the resident at the centre; this morning's first visit, faint; the suit now
    c.fillStyle = INK(1); c.beginPath(); c.arc(0, 0, 10, 0, TAU); c.fill();
    c.fillStyle = INK(0.9); c.font = font(F.hei(700), 26); c.fillText('住户', 18, 34);
    c.strokeStyle = PRINT(0.7); c.lineWidth = 2; c.setLineDash([8, 8]);
    c.beginPath(); for (let i = 0; i <= 20; i++) { const d = lerp(4.2, 0.6, i / 20), a = lerp(0.9, 1.4, i / 20); i ? c.lineTo(Math.cos(a) * d * px, Math.sin(a) * d * px) : c.moveTo(Math.cos(a) * d * px, Math.sin(a) * d * px); } c.stroke();
    c.setLineDash([]);
    const p = this.suitAt(t);
    c.strokeStyle = INK(0.8); c.lineWidth = 2;
    c.beginPath(); for (let i = 0; i <= 20; i++) { const kk = i / 20, d = lerp(4.2, p.d, kk), a = lerp(-2.3, p.a, kk); i ? c.lineTo(Math.cos(a) * d * px, Math.sin(a) * d * px) : c.moveTo(Math.cos(a) * d * px, Math.sin(a) * d * px); } c.stroke();
    c.fillStyle = INK(1); c.beginPath(); c.arc(Math.cos(p.a) * p.d * px, Math.sin(p.a) * p.d * px, 16, 0, TAU); c.fill();
    return cam;
  }
  walkHud(c: Ctx2, t: number, m: Xf) {
    const p = this.suitAt(t), px = 110;
    const q = applyXf(m, Math.cos(p.a) * p.d * px, Math.sin(p.a) * p.d * px);
    const f1 = applyXf(m, Math.cos(1.4) * 0.6 * px, Math.sin(1.4) * 0.6 * px);
    c.save();
    chrome(c, t, '近场感知 · 住户 0472');
    brackets(c, q.x - 40, q.y - 40, 80, 80, SYS.red, 1, 14, 2);
    glowOn(c, 1);
    sysTag(c, `防护人员 · ${p.d.toFixed(1)} m`, q.x - 40, q.y - 46, SYS.red, '#fff', 1, 16);
    glowOff(c);
    if (t >= this.tAgain) sysTag(c, '今日第 2 次', q.x - 40, q.y + 90, 'rgba(84,88,91,0.94)', '#fff', prog(t, this.tAgain, this.tAgain + 0.3), 16);
    sysTag(c, '08:05 · 第 1 次', f1.x + 20, f1.y + 60, 'rgba(84,88,91,0.8)', '#fff', 1, 13);
    c.restore();
  }

  // ------------------------------------------------------------------ F3: the system looks at its own agent
  visorHud(c: Ctx2, t: number, zoom: number, offy: number) {
    const fx = (x: number) => W / 2 + x * 540 * zoom;
    const fy = (y: number) => H / 2 - (y + 0.1 + offy) * 540 * zoom;
    c.save();
    c.textBaseline = 'alphabetic';
    c.fillStyle = SYS.fg;
    chrome(c, t, '人脸识别 · 执行人员核验');
    // the detector's frame
    const kf = prog(t, this.tF3 + 0.2, this.tF3 + 0.5, ease.outCubic);
    brackets(c, fx(-0.5), fy(0.6), fx(0.5) - fx(-0.5), fy(-0.62) - fy(0.6), SYS.dim, kf, 26, 1.5);
    // 68 landmarks: fit on 脸, lost on 五官 (one by one, falling away, red)
    let held = 0;
    this.lm.forEach((q, i) => {
      const tin = this.tFace + 0.012 * i;
      if (t < tin) return;
      const kin = ease.outCubic(prog(t, tin, tin + 0.25));
      const sx = lerp(fx((hash(i, 1) - 0.5) * 2.4), fx(q.x), kin), sy = lerp(fy((hash(i, 2) - 0.5) * 1.6), fy(q.y - 0.1), kin);
      const tout = lerp(this.tFeat0, this.tFeat1, hash(i, 5));
      const lost = prog(t, tout, tout + 0.5, ease.inQuad);
      if (lost >= 1) return;
      if (lost <= 0) held++;
      const y = sy + lost * lost * 260, x = sx + (hash(i, 6) - 0.5) * 60 * lost;
      c.globalAlpha = 1 - lost;
      c.fillStyle = lost > 0 ? SYS.red : SYS.fg;
      c.beginPath(); c.arc(x, y, 3, 0, TAU); c.fill();
      c.globalAlpha = 1;
    });
    if (t >= this.tFace) {
      const red = t >= this.tFeat0;
      if (red) glowOn(c, 0.9);
      sysTag(c, `人脸关键点 ${held}/68${red && held < 68 ? ' · 无法定位' : ''}`, fx(-0.5), fy(0.6) - 6, red ? SYS.red : 'rgba(84,88,91,0.92)', '#fff', 1, 15);
      glowOff(c);
    }
    if (t >= this.tFeat1 - 0.2) {
      sysPanel(c, 1390, 300, 440, '执行人员信息', [
        { k: '五官', v: '未检出', t: this.tFeat1 - 0.2 },
        { k: '身份', v: '不适用', t: this.tMist0 + 0.1 },
        { k: '责任人', v: '—', t: this.tMist1 + 0.2, red: true },
      ], t, 17);
    }
    c.restore();
  }
}

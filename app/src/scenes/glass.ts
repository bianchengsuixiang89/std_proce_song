// 图版 06 `glass` — 毛玻璃 / "你上前一步 · 抓住他的胳膊 · 嘴里反复喊着 · 你看看我 你听我说 ×2 ·
// 他看你的眼神 · 像在看用脏的卫生纸 · 挥一挥手 · 让你别再继续"
// The emptiest plate. We are on the staff side, in the dark, facing a backlit frosted pane. The visitor is
// only what frosted glass lets through: a blurred shape, sharper the nearer it comes; where skin touches
// the glass the grease clears it, so a pressed palm shows sharp. Rendering: a `behind` layer drawn with a
// blur per element by its distance from the glass, a `contact` layer on the glass (R: grease, G: breath),
// a shader that scatters the frosted parts and clears the greased ones, and a sharp `front` layer (our side).
// The red line here: the 一米线 on the far floor (a soft red band through the frost, crossed on 步); the
// observation frames the system draws round the palm prints (污渍 01/02); and the wipe that erases them.
//   S1 你上前一步: the shape comes from far (very soft) to near the glass, crossing the red band on 步.
//   S2 抓住他的胳膊: tilt down to the slot: a white sleeve on the counter; a hand comes through the slot and
//      closes on it, finger by finger, on 胳-膊.
//   S3 嘴里反复喊着: the blank face behind the glass; breath blooms on the glass on each character.
//   S4 你看看我 · 你听我说: a palm on 看, the other on 听; the face presses closer.
//   S5 the second time: the camera pulls far back: the pane is a small lit window in black; the palms slip.
//   S6 他看你的眼神 · 像在看用脏的卫生纸: his hood passes through the foreground; the way he looks at the visitor is
//      the system's: it boxes the whole person and sorts them as waste (垃圾分类: 其他垃圾 0.94 · 一次性 · 已使用).
//   S7 挥一挥手: his gloved hand sweeps through the foreground, a dismissive flick, twice; the red line traces the
//      gesture (手势 · 驱离); the shape behind the glass steps back, the palms leave it.
//   S8 让你别再继续: a placard drops on our side: 暂停服务.
// 小人得志, without drawing him: the man at the window is only his terminal, a dismissal system made into a game, and
// his cursor. Every plea is something to click away, and every click scores: +5 越线制止 (步), +20 工伤申报 (the arm
// grabbed), 降噪 (嘴里反复喊着), 静音 (你看看我), a combo (你听我说), the achievement 充耳不闻 (the second time); the cursor
// picks 其他垃圾 from a dropdown on the person (像在看用脏的卫生纸), swipes them off twice (挥一挥手: 一键劝返), the
// experience bar fills: 晋升 · 科员 → 副科长; it clicks 暂停服务 (让你别再继续) and tops the board: 本月处置之星.
// Over it all, the system's eye (the window terminal's HUD): a face detector that never gets a face through
// the frost (未识别), a line-crossing alarm on 步 (越线 · 一米线), the grab logged as 异常接触, the speech
// transcribed as [背景噪音] and then filtered as [重复内容]; then the person is sorted as 其他垃圾 and waved off.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { FSPass, Layer2D, W, H } from '../engine/gl';
import { Lyrics, type Line } from '../engine/lyrics';
import { rgba } from '../engine/palette';
import { F, font } from '../engine/type';
import { clamp, ease, lerp, prog, hash, pulse, springStep, frameIdx, noise1, TAU } from '../engine/util';
import { camXf, applyXf, lerpCam, label, drawFigure, SYS, glowOn, glowOff, brackets, sysTag, sysPanel, type Cam, type Ctx2, type Xf, chrome } from './_archive';

// world (px at zoom 1, origin = screen centre at the first framing)
const PANE = { x0: -820, x1: 820, y0: -620, y1: 330 };
const SLOT = { x0: -170, x1: 170, y0: 330, y1: 352 };
const COUNTER_Y1 = 640;
const BAND_Y = 210; // the 一米线 seen through the glass

const GLASS_FRAG = /* glsl */ `
uniform sampler2D behind;   // mipmapped, sRGB -> linear on sampling
uniform sampler2D contact;  // R grease, G breath (linear coverage)
uniform vec4 pane;          // screen rect of the pane: x0, y0, x1, y1
uniform float frostR;       // scatter radius (screen px)
uniform float lit;          // backlight level
void main() {
  vec2 sp = vec2(vUv.x * 1920.0, (1.0 - vUv.y) * 1080.0);
  vec4 ct = texture(contact, vUv);
  float grease = sat(ct.r), breath = sat(ct.g);
  // frosted: a jittered disc of taps from a blurred level (grain of the frost: per pixel)
  vec3 fr = vec3(0.0);
  const int N = 12;
  for (int i = 0; i < N; i++) {
    vec2 h = hash22(sp * 1.37 + float(i) * 17.3);
    float a = h.x * TAU, r = sqrt(h.y) * frostR;
    fr += textureLod(behind, vUv + vec2(cos(a), sin(a)) * r / vec2(1920.0, 1080.0), 3.0).rgb;
  }
  fr /= float(N);
  vec3 clear = textureLod(behind, vUv, 0.0).rgb;
  // frost diffuses: a little of the light becomes an even veil, desaturated toward the fog white
  float lf = luma(fr);
  vec3 frost = mix(fr, C_FOG * lf / max(luma(C_FOG), 1e-3), 0.35) * 0.92 + C_FOG * 0.025;
  vec3 col = mix(frost, clear, grease * 0.92);
  // breath: a whiter, denser haze that hides what is behind it
  col = mix(col, C_FOG * (0.18 + lf * 1.15), breath * 0.75);
  // micro texture of acid-etched glass
  col *= 0.965 + 0.07 * hash12(floor(sp * 0.9));
  col *= lit;
  // outside the pane: our side, in the dark (the frame and the counter come from the front layer)
  vec2 q = sp;
  float inPane = step(pane.x, q.x) * step(q.x, pane.z) * step(pane.y, q.y) * step(q.y, pane.w);
  // a faint spill of the pane's light onto our side
  vec2 dq = max(vec2(pane.x - q.x, pane.y - q.y), vec2(q.x - pane.z, q.y - pane.w));
  float dOut = length(max(dq, 0.0));
  vec3 dark = C_INK * 0.55 + C_SLATE * 0.05 * lit * exp(-dOut / 260.0);
  fragColor = vec4(mix(dark, col, inPane), 1.0);
}`;

/** A hand, in local units: palm 1 wide, wrist at y = +1, fingers up (y < 0). */
const FINGERS = [
  { x: -0.37, len: 0.78, w: 0.21 },
  { x: -0.12, len: 0.92, w: 0.22 },
  { x: 0.13, len: 0.88, w: 0.22 },
  { x: 0.37, len: 0.68, w: 0.19 },
];

export default class Glass extends Scene {
  behind = new Layer2D();
  contact = new Layer2D();
  front = new Layer2D();
  hud = new Layer2D();
  /** the visitor's head on screen (set while drawing behind the glass): for the face detector */
  headScr = { x: 0, y: 0, r: 0 };
  pass = new FSPass(GLASS_FRAG, { behind: { value: null }, contact: { value: null }, pane: { value: new THREE.Vector4() }, frostR: { value: 18 }, lit: { value: 1 } });

  L: Record<string, Line> = {};
  beat = 0.4;
  T0 = 0; T1 = 0;
  tStep = 0; tS2 = 0; tGrip: number[] = []; tS3 = 0; tBreath: number[] = [];
  tPalm1 = 0; tPalm2 = 0; tS5 = 0; tSlip1 = 0; tSlip2 = 0; tS6 = 0; tHood = 0; tBox1 = 0; tBox2 = 0;
  tWipe0 = 0; tWipe1 = 0; tWave2 = 0; tSign = 0;

  override async init() {
    const { lyrics, audio } = this.ctx;
    this.behind.texture.generateMipmaps = true;
    this.behind.texture.minFilter = THREE.LinearMipmapLinearFilter;
    this.contact.texture.colorSpace = THREE.NoColorSpace;
    const g = (q: string, n = 0) => lyrics.get(q, n);
    const L = this.L = {
      step: g('你上前一步'), grab: g('抓住他的胳膊'), shout: g('嘴里反复喊着'),
      look1: g('你看看我', 0), hear1: g('你听我说', 0), look2: g('你看看我', 1), hear2: g('你听我说', 1),
      eyes: g('他看你的眼神'), tissue: g('像在看用脏的卫生纸'), wave: g('挥一挥手'), stop: g('让你别再继续'),
    };
    const b0 = Math.floor(audio.beatAt(this.ctx.start));
    this.beat = audio.timeOfBeat(b0 + 1) - audio.timeOfBeat(b0);
    const onBeat = (t: number) => audio.timeOfBeat(Math.floor(audio.beatAt(t + 0.02)));
    this.T0 = this.ctx.start; this.T1 = this.ctx.end;
    this.tStep = Lyrics.phrase(L.step!, '步').start;
    this.tS2 = onBeat(L.grab!.start);
    const arm = Lyrics.phrase(L.grab!, '胳膊');
    // the fingers close one by one across 胳-膊 (thumb last)
    this.tGrip = [0, 1, 2, 3, 4].map((i) => lerp(arm.start - 0.05, arm.end - 0.1, i / 4));
    this.tS3 = onBeat(L.shout!.start);
    this.tBreath = L.shout!.words.map((w) => w.start);
    this.tPalm1 = Lyrics.phrase(L.look1!, '看看').start;
    this.tPalm2 = Lyrics.phrase(L.hear1!, '听').start;
    this.tS5 = onBeat(L.look2!.start);
    this.tSlip1 = Lyrics.phrase(L.look2!, '看看').start;
    this.tSlip2 = Lyrics.phrase(L.hear2!, '听').start;
    this.tS6 = onBeat(L.eyes!.start);
    this.tHood = Lyrics.phrase(L.eyes!, '眼神').start;
    const tis = Lyrics.phrase(L.tissue!, '卫生纸');
    this.tBox1 = Lyrics.phrase(L.tissue!, '用脏').start;
    this.tBox2 = tis.start;
    const wave = Lyrics.phrase(L.wave!, '挥一挥手');
    this.tWipe0 = wave.start; this.tWipe1 = wave.end;
    this.tWave2 = L.wave!.words[2]!.start;
    this.tSign = Lyrics.phrase(L.stop!, '别').start;
  }

  camAt(t: number): Cam {
    const wide: Cam = { x: 0, y: -90, z: 1.0, r: 0 };
    if (t < this.tS2) {
      // a slow creep toward the pane while the shape comes
      return lerpCam({ x: 0, y: -60, z: 0.9, r: 0 }, { x: 0, y: -120, z: 1.04, r: 0 }, prog(t, this.T0, this.tS2, ease.inOutQuad));
    }
    if (t < this.tS5) {
      let c: Cam = { x: 0, y: -150, z: lerp(1.08, 1.18, prog(t, this.tS2, this.tPalm1)), r: 0 };
      c = lerpCam(c, { x: -20, y: -150, z: 1.28, r: 0.004 }, prog(t, this.tPalm1 - 0.03, this.tPalm1 + 0.3, ease.outExpo));
      c = lerpCam(c, { x: 0, y: -140, z: 1.38, r: -0.004 }, prog(t, this.tPalm2 - 0.03, this.tPalm2 + 0.3, ease.outExpo));
      return c;
    }
    if (t < this.tS6) {
      // the second time: very far: a small window in the dark
      const k = prog(t, this.tS5, this.tS6);
      return { x: lerp(0, 20, k), y: lerp(-150, -130, k), z: lerp(0.46, 0.42, k), r: 0 };
    }
    let c = lerpCam({ x: 0, y: -140, z: 1.1, r: 0 }, wide, prog(t, this.tS6, this.tBox1, ease.inOutCubic));
    c = lerpCam(c, { x: -10, y: -120, z: 1.0, r: 0 }, prog(t, this.tWipe0 - 0.1, this.tWipe0 + 0.4, ease.outCubic));
    return lerpCam(c, { x: 0, y: -170, z: 0.86, r: 0 }, prog(t, this.tSign, this.T1, ease.inOutQuad));
  }

  /** The visitor's distance from the glass (m): 0 = pressed against it. */
  dist(t: number) {
    let d = lerp(2.4, 1.4, prog(t, this.T0, this.tStep - 0.1, ease.inOutQuad));
    d = lerp(d, 0.5, ease.outCubic(prog(t, this.tStep - 0.04, this.tStep + 0.3)));
    d = lerp(d, 0.12, prog(t, this.tS3 - 0.2, this.tS3 + 0.8, ease.inOutQuad));
    d = lerp(d, 0.05, prog(t, this.tPalm2 - 0.05, this.tPalm2 + 0.3, ease.outCubic));
    d = lerp(d, 1.6, prog(t, this.tWipe0, this.tWipe1 + 0.8, ease.inOutCubic));
    return d;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const { renderer, comp } = this.ctx;
    const cam = this.camAt(t);
    let amp = 6 * pulse(t, this.tStep, 0.08) + 4 * pulse(t, this.tPalm1, 0.06) + 5 * pulse(t, this.tPalm2, 0.06);
    for (const g of this.tGrip) amp += 2.5 * pulse(t, g, 0.05);
    const ph = frameIdx(t);
    const shx = amp * (hash(ph, 11) - 0.5) * 2, shy = amp * (hash(ph, 12) - 0.5) * 2;
    const m = camXf(cam, shx, shy);
    // the far side moves a little less than the glass (parallax): a softer camera for `behind`
    const mb = camXf({ ...cam, z: 1 + (cam.z - 1) * 0.92, x: cam.x * 0.92, y: cam.y * 0.95 }, shx * 0.9, shy * 0.9);

    this.drawBehind(t, mb, cam.z);
    this.drawContact(t, m);
    this.drawFront(t, m, cam);

    const u = this.pass.u;
    u.behind!.value = this.behind.upload();
    u.contact!.value = this.contact.upload();
    const p0 = { x: m.a * PANE.x0 + m.c * PANE.y0 + m.e, y: m.b * PANE.x0 + m.d * PANE.y0 + m.f };
    const p1 = { x: m.a * PANE.x1 + m.c * PANE.y1 + m.e, y: m.b * PANE.x1 + m.d * PANE.y1 + m.f };
    (u.pane!.value as THREE.Vector4).set(p0.x, p0.y, p1.x, p1.y);
    u.frostR!.value = 16 * cam.z;
    u.lit!.value = 1 - 0.25 * prog(t, this.tSign, this.T1, ease.inOutQuad);
    this.pass.render(renderer, out);
    comp.draw(renderer, this.front.upload(), out);
    this.hud.clear();
    this.drawHud(this.hud.ctx, t, m);
    comp.draw(renderer, this.hud.upload(), out);
    return { bloom: 0.35, bloomThreshold: 0.75, halation: 0.05, vignette: 0.42, grain: 0.06, ca: 0.6, paper: 0 };
  }

  // ------------------------------------------------------------------ his terminal: the dismissal game
  /** Points scored so far, and the events that scored them (time, points, what). */
  score(t: number) {
    const ev: [number, number, string][] = [
      [this.tStep, 5, '越线制止'], [this.tGrip[2]!, 20, '工伤申报 · 胳膊被抓'], [this.tS3 + 0.2, 5, '噪音屏蔽'],
      [this.tPalm1, 10, '静音成功'], [this.tPalm2, 10, '连续处置 ×2'], [this.tS5 + 0.1, 50, '成就 · 充耳不闻'],
      [this.tBox2, 3, '垃圾分类正确'], [this.tWipe0 + 0.3, 10, '一键劝返'], [this.tWave2 + 0.3, 10, '一键劝返'], [this.tSign, 5, '暂停服务'],
    ];
    let pts = 1272;
    for (const [te, p] of ev) if (t >= te) pts += p;
    return { pts, ev };
  }
  static BTN = ['降噪', '静音', '分类', '劝返', '暂停服务'];
  btn(i: number) { return { x: 1086 + i * 152, y: 930, w: i === 4 ? 176 : 136, h: 66 }; }
  /** The cursor: waypoints (time, x, y, click). */
  cursor(t: number) {
    const b = (i: number) => { const r = this.btn(i); return [r.x + r.w / 2, r.y + r.h / 2] as const; };
    const h = this.headScr;
    const wp: [number, number, number, boolean][] = [
      [this.T0, 1500, 760, false], [this.tS3 - 0.1, b(0)[0], b(0)[1], false], [this.tS3 + 0.2, b(0)[0], b(0)[1], true],
      [this.tPalm1 - 0.15, b(1)[0], b(1)[1], false], [this.tPalm1, b(1)[0], b(1)[1], true], [this.tPalm2, b(1)[0], b(1)[1], true],
      [this.tS5, 1560, 700, false], [this.tHood, h.x + 20, h.y + 30, false], [this.tBox1 - 0.05, h.x + 20, h.y + 30, true],
      [this.tBox2 - 0.05, h.x + 230, h.y + 30 + 4 * 52, false], [this.tBox2, h.x + 230, h.y + 30 + 4 * 52, true],
      [this.tWipe0 - 0.1, 1450, 420, false], [this.tWipe0 + 0.3, 520, 560, false], [this.tWave2 - 0.05, 1450, 430, false], [this.tWave2 + 0.3, 520, 580, false],
      [this.tSign - 0.25, b(4)[0], b(4)[1], false], [this.tSign - 0.05, b(4)[0], b(4)[1], true], [this.T1, b(4)[0] - 40, b(4)[1] - 80, false],
    ];
    let i = 1;
    while (i < wp.length - 1 && wp[i]![0] <= t) i++;
    const a = wp[i - 1]!, z = wp[i]!;
    const k = ease.inOutCubic(prog(t, a[0], z[0]));
    let click = 0;
    for (const w of wp) if (w[3]) click = Math.max(click, pulse(t, w[0], 0.12) * (t >= w[0] ? 1 : 0));
    return { x: lerp(a[1], z[1], k), y: lerp(a[2], z[2], k), click };
  }

  drawHud(c: Ctx2, t: number, m: Xf) {
    c.save();
    c.textBaseline = 'alphabetic';
    chrome(c, t, '窗口 07 · 处置系统');
    const far = t >= this.tS5 && t < this.tS6;
    // the face detector, until he looks
    if (t < this.tHood) {
      const h = this.headScr;
      const sz = Math.max(60, h.r * 1.35);
      brackets(c, h.x - sz, h.y - sz * 1.1, sz * 2, sz * 2.2, SYS.dim, 1, 20, 1.5);
      sysTag(c, '来访人 0472', h.x - sz, h.y - sz * 1.1 - 4, 'rgba(84,88,91,0.92)', '#fff', 1, 14);
    }
    // his profile: rank, experience, points
    const { pts, ev } = this.score(t);
    const lvlUp = this.tWave2 + 0.3;
    const promoted = t >= lvlUp;
    c.fillStyle = 'rgba(16,17,18,0.86)'; c.fillRect(1484, 116, 400, 150);
    c.strokeStyle = SYS.dim; c.lineWidth = 1; c.strokeRect(1484.5, 116.5, 399, 149);
    c.fillStyle = SYS.dim; c.font = font(F.hei(500), 20); c.fillText('窗口 07 · 职级', 1504, 150);
    c.fillStyle = promoted ? SYS.red : SYS.fg; c.font = font(F.hei(900), 40);
    if (promoted) glowOn(c, 0.8);
    c.fillText(promoted ? '副科长' : '科员', 1504, 200); glowOff(c);
    c.fillStyle = SYS.fg; c.font = font(F.mono(600), 36); c.textAlign = 'right'; c.fillText(pts.toLocaleString('en-US'), 1864, 200); c.textAlign = 'left';
    const xp = promoted ? (pts - 1395) / 200 : clamp((pts - 1272) / (1395 - 1272));
    c.fillStyle = 'rgba(151,156,159,0.35)'; c.fillRect(1504, 226, 360, 14);
    c.fillStyle = SYS.red; glowOn(c, 0.6); c.fillRect(1504, 226, 360 * clamp(xp), 14); glowOff(c);
    c.fillStyle = SYS.dim; c.font = font(F.hei(500), 16); c.fillText('晋升进度', 1504, 258);
    // the latest score, big
    for (const [te, p, what] of ev) {
      const k = prog(t, te, te + 1.4);
      if (k <= 0 || k >= 1 || far) continue;
      c.save(); c.globalAlpha = Math.min(1, (1 - k) * 3);
      const y = 380 - 40 * ease.outCubic(Math.min(1, k * 4));
      c.fillStyle = 'rgba(16,17,18,0.86)'; c.fillRect(1324, y - 64, 560, 92);
      c.fillStyle = SYS.red; glowOn(c, 1.2); c.font = font(F.mono(700), 58); c.fillText('+' + p, 1344, y + 4); glowOff(c);
      c.fillStyle = SYS.fg; c.font = font(F.hei(700), 30); c.fillText(what, 1480, y - 2);
      c.restore();
    }
    // the toolbar
    Glass.BTN.forEach((name, i) => {
      const r = this.btn(i);
      const pressed = [this.tS3 + 0.2, this.tPalm1, 0, this.tWipe0 + 0.3, this.tSign - 0.05][i]!;
      const hot = pressed > 0 && t >= pressed && t < pressed + 0.4;
      c.fillStyle = hot ? SYS.red : 'rgba(16,17,18,0.86)';
      if (hot) glowOn(c, 1);
      c.fillRect(r.x, r.y, r.w, r.h); glowOff(c);
      c.strokeStyle = SYS.dim; c.lineWidth = 1.5; c.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      c.fillStyle = SYS.fg; c.font = font(F.hei(700), 28); c.textAlign = 'center'; c.fillText(name, r.x + r.w / 2, r.y + 44); c.textAlign = 'left';
    });
    // 他看你的眼神 · 像在看用脏的卫生纸: he clicks the person, picks 其他垃圾
    if (t >= this.tHood && t < this.tWipe0 + 0.3) {
      const h = this.headScr;
      const bw = Math.max(260, h.r * 4.2), x0 = h.x - bw / 2, y0 = h.y - h.r * 1.4;
      const red = t >= this.tBox2;
      brackets(c, x0, y0, bw, 1080 - y0 - 160, red ? SYS.red : SYS.dim, prog(t, this.tHood, this.tHood + 0.25), 30, red ? 3 : 2);
      if (red) glowOn(c, 1);
      sysTag(c, red ? '其他垃圾 · 一次性 · 已使用' : '来访人 0472', x0, y0 - 6, red ? SYS.red : 'rgba(84,88,91,0.92)', '#fff', 1, 17);
      glowOff(c);
      if (t >= this.tBox1 && t < this.tBox2 + 0.5) {
        const opts = ['可回收物', '有害垃圾', '厨余垃圾', '其他垃圾'];
        const mx = h.x + 40, my = h.y + 40;
        c.fillStyle = 'rgba(16,17,18,0.92)'; c.fillRect(mx, my, 300, 52 * 4 + 52);
        c.strokeStyle = SYS.dim; c.strokeRect(mx + 0.5, my + 0.5, 299, 52 * 5 - 1);
        c.fillStyle = SYS.dim; c.font = font(F.hei(600), 22); c.fillText('分类为', mx + 18, my + 34);
        opts.forEach((o, i) => {
          const sel = i === 3 && t >= this.tBox2 - 0.05;
          if (sel) { c.fillStyle = SYS.red; c.fillRect(mx, my + 52 * (i + 1), 300, 52); }
          c.fillStyle = SYS.fg; c.font = font(F.hei(700), 26); c.fillText(o, mx + 18, my + 52 * (i + 1) + 36);
        });
      }
    }
    // the second time: an achievement, in the middle of the dark
    if (far || (t >= this.tS5 && t < this.tS5 + 2.2)) {
      const k = prog(t, this.tS5, this.tS5 + 0.25, ease.outBack);
      c.save(); c.translate(960, 520); c.scale(k, k);
      c.fillStyle = 'rgba(16,17,18,0.92)'; c.fillRect(-380, -150, 760, 300);
      c.strokeStyle = SYS.red; c.lineWidth = 4; glowOn(c, 1.2); c.strokeRect(-380, -150, 760, 300); glowOff(c);
      c.textAlign = 'center';
      c.fillStyle = SYS.dim; c.font = font(F.hei(700), 30); c.fillText('成 就 解 锁', 0, -80);
      c.fillStyle = SYS.fg; c.font = font(F.song(900), 110); c.fillText('充耳不闻', 0, 50);
      c.fillStyle = SYS.red; c.font = font(F.hei(700), 28); c.fillText('连续屏蔽诉求 ×3 · 积分 +50', 0, 110);
      c.textAlign = 'left';
      c.restore();
    }
    // 挥一挥手: the cursor's swipes, and the promotion
    for (const ts of [this.tWipe0 - 0.1, this.tWave2 - 0.05]) {
      const k = prog(t, ts, ts + 0.45);
      if (k <= 0 || k >= 1) continue;
      c.strokeStyle = SYS.red; c.lineWidth = 8; c.lineCap = 'round'; glowOn(c, 1.2);
      c.globalAlpha = 1 - k;
      c.beginPath(); c.moveTo(1450, 425); c.quadraticCurveTo(980, 300, 520, 570); c.stroke();
      c.globalAlpha = 1; glowOff(c);
    }
    if (t >= lvlUp && t < lvlUp + 1.8) {
      const k = prog(t, lvlUp, lvlUp + 0.3, ease.outBack);
      c.save(); c.translate(960, 520);
      c.strokeStyle = SYS.red; c.lineWidth = 3; glowOn(c, 1);
      for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU + t * 0.6; c.beginPath(); c.moveTo(Math.cos(a) * 200 * k, Math.sin(a) * 120 * k); c.lineTo(Math.cos(a) * 520 * k, Math.sin(a) * 320 * k); c.stroke(); }
      glowOff(c);
      c.scale(k, k);
      c.fillStyle = 'rgba(16,17,18,0.92)'; c.fillRect(-360, -130, 720, 260);
      c.textAlign = 'center';
      c.fillStyle = SYS.red; c.font = font(F.song(900), 120); glowOn(c, 1); c.fillText('晋 升', 0, 20); glowOff(c);
      c.fillStyle = SYS.fg; c.font = font(F.hei(800), 40); c.fillText('科员 → 副科长', 0, 96);
      c.textAlign = 'left';
      c.restore();
    }
    // 让你别再继续: the board
    if (t >= this.tSign + 0.4) {
      sysPanel(c, 1290, 380, 410, '本月处置之星', [
        { k: '1  窗口 07', v: pts.toLocaleString('en-US'), t: this.tSign + 0.4, red: true },
        { k: '2  窗口 03', v: '1,198', t: this.tSign + 0.55 },
        { k: '3  窗口 11', v: '1,021', t: this.tSign + 0.7 },
      ], t, 18);
    }
    // the cursor: his whole presence
    const cu = this.cursor(t);
    c.save();
    c.translate(cu.x, cu.y); c.scale(1.6 - 0.25 * cu.click, 1.6 - 0.25 * cu.click);
    if (cu.click > 0.05) { c.strokeStyle = `rgba(214,58,36,${cu.click})`; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, 30 * (1.5 - cu.click), 0, TAU); c.stroke(); }
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 34); c.lineTo(9, 26); c.lineTo(16, 41); c.lineTo(22, 38); c.lineTo(15, 23); c.lineTo(26, 23); c.closePath();
    c.fillStyle = '#ffffff'; c.fill(); c.strokeStyle = '#000000'; c.lineWidth = 2; c.stroke();
    c.restore();
    c.restore();
  }

  // ------------------------------------------------------------------ behind the glass
  drawBehind(t: number, m: Xf, z: number) {
    const L = this.behind;
    L.clear('#000');
    const c = L.ctx;
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    // the hall beyond: a high, even light, falling off toward the floor
    const gr = c.createLinearGradient(0, PANE.y0, 0, PANE.y1);
    gr.addColorStop(0, rgba('fog', 0.9));
    gr.addColorStop(0.55, rgba('fog', 0.72));
    gr.addColorStop(1, rgba('slate', 0.85));
    c.fillStyle = gr;
    c.fillRect(PANE.x0 - 200, PANE.y0 - 200, PANE.x1 - PANE.x0 + 400, PANE.y1 - PANE.y0 + 400);
    // ceiling lights, far: soft discs
    c.filter = `blur(${40 * z}px)`;
    c.fillStyle = rgba('bone', 0.9);
    for (const x of [-560, 0, 560]) { c.beginPath(); c.ellipse(x, PANE.y0 + 60, 170, 40, 0, 0, Math.PI * 2); c.fill(); }
    // the 一米线, far down the floor: a red band
    c.filter = `blur(${22 * z}px)`;
    c.fillStyle = rgba('signal', 0.95);
    c.fillRect(PANE.x0 - 100, BAND_Y - 8, PANE.x1 - PANE.x0 + 200, 16);
    c.filter = 'none';

    // the visitor: blur and size by distance, darker as it nears the light's path
    const d = this.dist(t);
    const s = lerp(1.45, 0.62, clamp(d / 2.4));
    const blur = 3 + 34 * Math.sqrt(clamp(d / 2.4)) + 10 * clamp(d - 1.2);
    const sway = noise1(t * 0.7, 5) * 10 + noise1(t * 2.3, 9) * 3 * prog(t, this.tS3, this.tWipe0);
    const cx = 40 * (1 - prog(t, this.tS3 - 0.2, this.tS3 + 0.8, ease.inOutQuad)) + sway, headY = lerp(-60, -230, clamp(1 - d / 2.4)) ;
    c.filter = `blur(${blur * z}px)`;
    c.fillStyle = rgba('ink', lerp(0.55, 0.92, clamp(1 - d / 2.4)));
    this.bust(c, cx, headY, s);
    const hs = applyXf(m, cx, headY);
    this.headScr = { x: hs.x, y: hs.y, r: 118 * s * m.a };
    // where the shape crosses the band: its feet (only while far enough to see them)
    if (d > 0.3) {
      c.fillStyle = rgba('ink', 0.75 * clamp((d - 0.3) / 0.5));
      c.fillRect(cx - 90 * s, BAND_Y - 40 * s - (d - 0.5) * 30, 180 * s, 120);
    }
    // the palms, pressed: the forearm falls away from the glass (soft), the hand is at it (nearly sharp;
    // the grease on the glass clears it fully where the skin touches)
    for (const p of this.palms(t)) {
      if (p.k <= 0) continue;
      const y = p.y + p.slip;
      c.filter = `blur(${16 * z}px)`;
      c.fillStyle = rgba('ink', 0.55 * p.k);
      c.beginPath();
      c.moveTo(p.x - 0.42 * p.s, y + 0.6 * p.s); c.lineTo(p.x + 0.42 * p.s, y + 0.6 * p.s);
      c.lineTo(p.x + 0.62 * p.s * p.flip + 0.3 * p.s, y + 3.2 * p.s); c.lineTo(p.x + 0.62 * p.s * p.flip - 0.45 * p.s, y + 3.2 * p.s);
      c.closePath(); c.fill();
      c.filter = `blur(${3.5 * z}px)`;
      c.fillStyle = rgba('ink', 0.78 * p.k);
      this.hand(c, p.x, y, p.s, p.flip);
    }
    c.filter = 'none';
  }

  /** A front-facing bust silhouette (no features): head, neck, shoulders. */
  bust(c: Ctx2, x: number, y: number, s: number) {
    c.beginPath();
    c.ellipse(x, y, 92 * s, 118 * s, 0, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(x - 46 * s, y + 90 * s);
    c.lineTo(x + 46 * s, y + 90 * s);
    c.lineTo(x + 58 * s, y + 160 * s);
    c.bezierCurveTo(x + 230 * s, y + 175 * s, x + 300 * s, y + 220 * s, x + 320 * s, y + 420 * s);
    c.lineTo(x + 340 * s, y + 1400);
    c.lineTo(x - 340 * s, y + 1400);
    c.lineTo(x - 320 * s, y + 420 * s);
    c.bezierCurveTo(x - 300 * s, y + 220 * s, x - 230 * s, y + 175 * s, x - 58 * s, y + 160 * s);
    c.closePath();
    c.fill();
  }

  /** The palms on the glass: where, how pressed (0..1), slipping down the second time. */
  palms(t: number) {
    const slip = (t0: number) => 70 * ease.inOutQuad(prog(t, t0, t0 + this.beat * 3)) + 12 * prog(t, t0, t0 + 0.08, ease.outCubic);
    const gone = 1 - prog(t, this.tWipe0 + 0.2, this.tWipe1 + 0.8, ease.inOutQuad);
    return [
      { x: -250, y: -180, s: 150, flip: -1, k: prog(t, this.tPalm1 - 0.06, this.tPalm1 + 0.04, ease.outCubic) * gone, slip: slip(this.tSlip1), pressT: this.tPalm1 },
      { x: 240, y: -150, s: 150, flip: 1, k: prog(t, this.tPalm2 - 0.06, this.tPalm2 + 0.04, ease.outCubic) * gone, slip: slip(this.tSlip2), pressT: this.tPalm2 },
    ];
  }

  /** A hand seen flat (palm or back), local origin at the palm centre, `s` px per unit. */
  hand(c: Ctx2, x: number, y: number, s: number, flip: number) {
    c.save();
    c.translate(x, y); c.scale(flip * s, s);
    c.beginPath();
    c.roundRect(-0.5, -0.35, 1.0, 1.05, 0.28);
    c.fill();
    for (const fg of FINGERS) {
      c.beginPath();
      c.roundRect(fg.x - fg.w / 2, -0.3 - fg.len, fg.w, fg.len + 0.12, fg.w / 2);
      c.fill();
    }
    // thumb: from the heel of the palm, angled out and up
    c.save(); c.translate(-0.4, 0.3); c.rotate(-0.55);
    c.beginPath(); c.roundRect(-0.15, -0.56, 0.3, 0.66, 0.15); c.fill();
    c.restore();
    c.restore();
  }

  // ------------------------------------------------------------------ on the glass
  drawContact(t: number, m: Xf) {
    const L = this.contact;
    L.clear('#000');
    const c = L.ctx;
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    c.globalCompositeOperation = 'lighter';

    // everything left of the wipe line is clean
    c.save();

    // breath: blooms on each character of 嘴里反复喊着, and on the shouted lines after
    const mouths = [...this.tBreath, ...[this.L.look1!, this.L.hear1!, this.L.look2!, this.L.hear2!].flatMap((l) => l.words.filter((_, i) => i % 2 === 0).map((w) => w.start))];
    mouths.forEach((tb, i) => {
      if (t < tb) return;
      const age = t - tb;
      const a = Math.exp(-age / 1.6) * prog(t, tb, tb + 0.12, ease.outCubic);
      if (a < 0.01) return;
      const r = (70 + 60 * (1 - Math.exp(-age / 0.5))) * (0.85 + 0.3 * hash(i, 4));
      const bx = 10 + (hash(i, 5) - 0.5) * 50, by = -120 + (hash(i, 6) - 0.5) * 24;
      const gr = c.createRadialGradient(bx, by, 0, bx, by, r);
      gr.addColorStop(0, `rgba(0,255,0,${0.75 * a})`);
      gr.addColorStop(0.6, `rgba(0,255,0,${0.4 * a})`);
      gr.addColorStop(1, 'rgba(0,255,0,0)');
      c.fillStyle = gr;
      c.beginPath(); c.ellipse(bx, by, r * 1.25, r, 0, 0, Math.PI * 2); c.fill();
    });
    // the palm prints: grease where the skin touches (pads, heel), streaks as they slip
    for (const p of this.palms(t)) {
      if (p.k <= 0) continue;
      const press = p.k * (1 + 0.25 * pulse(t, p.pressT, 0.1));
      c.filter = `blur(${2.5 * m.a}px)`;
      c.fillStyle = `rgba(255,0,0,${clamp(press)})`;
      this.print(c, p.x, p.y + p.slip, p.s, p.flip);
      c.filter = 'none';
      if (p.slip > 2) {
        // the smear left behind as the hand slides
        c.fillStyle = `rgba(255,0,0,${0.35 * p.k})`;
        for (const fg of FINGERS) c.fillRect(p.x + p.flip * fg.x * p.s - 6, p.y + (-0.3 - fg.len) * p.s, 12, p.slip);
      }
    }
    c.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
  }

  print(c: Ctx2, x: number, y: number, s: number, flip: number) {
    // the whole hand touches (grease clears all of it), the pads and the heel press harder
    const a = c.fillStyle;
    c.globalAlpha *= 0.62;
    this.hand(c, x, y, s * 0.97, flip);
    c.globalAlpha /= 0.62;
    c.fillStyle = a;
    c.globalAlpha *= 0.4;
    c.save();
    c.translate(x, y); c.scale(flip * s, s);
    // the heel and the pads below the fingers
    c.beginPath(); c.ellipse(-0.18, 0.5, 0.26, 0.2, 0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(0.22, 0.48, 0.22, 0.2, -0.2, 0, Math.PI * 2); c.fill();
    c.beginPath(); c.ellipse(0.0, -0.2, 0.46, 0.13, 0, 0, Math.PI * 2); c.fill();
    for (const fg of FINGERS) {
      const top = -0.3 - fg.len;
      c.beginPath(); c.ellipse(fg.x, top + 0.13, fg.w * 0.45, 0.13, 0, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(fg.x, top + fg.len * 0.55, fg.w * 0.4, 0.1, 0, 0, Math.PI * 2); c.fill();
    }
    c.save(); c.translate(-0.4, 0.3); c.rotate(-0.55);
    c.beginPath(); c.ellipse(0, -0.4, 0.12, 0.17, 0, 0, Math.PI * 2); c.fill();
    c.restore();
    c.restore();
    c.globalAlpha /= 0.4;
  }

  // ------------------------------------------------------------------ our side
  drawFront(t: number, m: Xf, cam: Cam) {
    const L = this.front;
    L.clear();
    const c = L.ctx;
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    // the counter: a dark top catching the pane's light, the slot
    const gr = c.createLinearGradient(0, SLOT.y1, 0, COUNTER_Y1);
    gr.addColorStop(0, rgba('#2a2e31', 1));
    gr.addColorStop(0.25, rgba('ink2', 1));
    gr.addColorStop(1, rgba('ink', 1));
    c.fillStyle = gr;
    c.fillRect(PANE.x0 - 1200, PANE.y1, PANE.x1 - PANE.x0 + 2400, COUNTER_Y1 - PANE.y1 + 2000);
    c.fillStyle = rgba('#050506', 1);
    c.fillRect(SLOT.x0, SLOT.y0, SLOT.x1 - SLOT.x0, SLOT.y1 - SLOT.y0);
    // the pane's frame: two hairlines and a number plate
    c.strokeStyle = rgba('graphite', 0.9); c.lineWidth = 3;
    c.strokeRect(PANE.x0 - 4, PANE.y0 - 4, PANE.x1 - PANE.x0 + 8, PANE.y1 - PANE.y0 + 8);
    c.strokeStyle = rgba('ash', 0.35); c.lineWidth = 1;
    c.strokeRect(PANE.x0 - 14, PANE.y0 - 14, PANE.x1 - PANE.x0 + 28, PANE.y1 - PANE.y0 + 28);
    c.fillStyle = rgba('ash', 0.75);
    label(c, '窗口 07', PANE.x0, PANE.y0 - 34, 15, 500, 4);
    c.font = font(F.hei(500), 15);

    // S2: the sleeve on the counter and the hand through the slot

    // him, from S3 on: in his chair, his back to us

    // S8: the placard drops on our side and swings to rest
    if (t >= this.tSign) {
      const k = springStep(t - this.tSign, 1.6, 0.32);
      const y = lerp(PANE.y0 - 420, -230, k), rot = 0.05 * Math.sin((t - this.tSign) * 7) * Math.exp(-(t - this.tSign) * 2.2);
      c.save();
      c.translate(0, y); c.rotate(rot);
      c.strokeStyle = rgba('graphite', 0.9); c.lineWidth = 1.5;
      c.beginPath(); c.moveTo(-170, -112); c.lineTo(0, -260 - 400); c.moveTo(170, -112); c.lineTo(0, -660); c.stroke();
      c.fillStyle = rgba('bone', 0.93);
      c.fillRect(-250, -112, 500, 210);
      c.fillStyle = rgba('ink', 1);
      c.textAlign = 'center';
      c.font = font(F.song(900), 84);
      c.fillText('暂停服务', 0, 18);
      c.fillStyle = rgba('signal', 1);
      c.fillRect(-170, 44, 340, 4);
      c.fillStyle = rgba('graphite', 1);
      label(c, '请 勿 继 续 等 候', 0, 80, 15, 500, 4, 'center');
      c.textAlign = 'left';
      c.restore();
    }
  }
}

// 图版 05 `hotline` — 热线 / verse 2: "你说你认识局长 … 传来没忍住的笑意". All SCREEN: three instruments.
//   H1 the graph (你说你认识局长 · 也和主任吃过饭 · 可他的眼神早说明 · 你现在只是个麻烦): an org chart. The red line
//      climbs from the visitor's node to 局长 (关系 认识 · 自述 · 未核实); a dashed edge to 主任 (共同用餐 ×1 ·
//      关系强度 0.02); the clerk's gaze sweeps the node (评估中); on 麻烦 the node's name is struck and replaced, its
//      edges cut: 不稳定因素 · 重点关注.
//   H2 the live caption of the call (市长热线里 · 你说明白了公平和政绩): what the visitor says comes up word by word;
//      公平 is looked up: 关键词库 · 无匹配; 政绩 is blacked out: 敏感词 · 已屏蔽; then 已转回原单位 · 窗口 07.
//   H3 the call (听筒那边停了一秒 · 传来没忍住的笑意): two channels; the agent's goes flat and the red line
//      dimensions it: 静音 1.00 s; then one spike: [笑声] 置信度 0.97, the only thing the system ever recognises.
//   H4 (the instrumental after) the real thing, quoted: the official notice on the Shangrao case (信州发布, 2021.11.13);
//      the red line boxes its own words: 无害化处置 · 已取得该网民谅解 · 该群众对疫情期间的防控措施表示理解.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { Lyrics, type Line } from '../engine/lyrics';
import { F, font } from '../engine/type';
import { clamp, ease, lerp, prog, pulse, hash, frameIdx, TAU } from '../engine/util';
import { Paper, SCREEN_POST, SYS, glowOn, glowOff, brackets, sysTag, sysPanel, INK, PRINT, RED, camXf, applyXf, lerpCam, label, route, drawRoute, arrowHead, dimension, type Cam, type Ctx2, type Xf, chrome, loadImage, drawQuoted, sourceLine } from './_archive';

interface Node { id: string; s: string; x: number; y: number }
const ORG: Node[] = [
  { id: 'ju', s: '局长', x: 0, y: -380 },
  { id: 'f1', s: '副局长', x: -420, y: -160 }, { id: 'f2', s: '副局长', x: 0, y: -160 }, { id: 'zr', s: '主任', x: 420, y: -160 },
  { id: 'k1', s: '科室', x: -560, y: 60 }, { id: 'k2', s: '科室', x: -280, y: 60 }, { id: 'k3', s: '科室', x: 280, y: 60 }, { id: 'k4', s: '窗口 07', x: 560, y: 60 },
  { id: 'me', s: '来访人 0472', x: 0, y: 380 },
];
const EDGES: [string, string][] = [['ju', 'f1'], ['ju', 'f2'], ['ju', 'zr'], ['f1', 'k1'], ['f1', 'k2'], ['zr', 'k3'], ['zr', 'k4']];
const IVR = { root: { x: -600, y: 0 }, opts: [{ s: '1 咨询', y: -300 }, { s: '2 投诉', y: -100 }, { s: '3 建议', y: 100 }, { s: '0 人工', y: 300 }], ox: -150, y: 3000 };

export default class Hotline extends Scene {
  ink = new Layer2D();
  hud = new Layer2D();
  paper = new Paper();
  L: Line[] = [];
  beat = 0.4;
  T0 = 0; T1 = 0; tH2 = 0; tH3 = 0; tH4 = 0;
  notice!: HTMLImageElement;

  override async init() {
    const { lyrics, audio } = this.ctx;
    const q = ['你说你认识局长', '也和主任吃过饭', '可他的眼神早说明', '你现在只是个麻烦', '市长热线里', '你说明白了公平和政绩', '听筒那边停了一秒', '传来没忍住的笑意'];
    this.L = q.map((s) => lyrics.get(s));
    this.T0 = this.ctx.start; this.T1 = this.ctx.end;
    const b0 = Math.floor(audio.beatAt(this.T0));
    this.beat = audio.timeOfBeat(b0 + 1) - audio.timeOfBeat(b0);
    const onBeat = (t: number) => audio.timeOfBeat(Math.floor(audio.beatAt(t + 0.02)));
    this.tH2 = onBeat(this.L[4]!.start);
    this.tH3 = onBeat(this.L[6]!.start);
    this.tH4 = audio.timeOfBeat(Math.ceil(audio.beatAt(this.L[7]!.end + 0.15)));
    this.notice = await loadImage('refs/shangrao_notice.jpg');
  }
  P(i: number, q: string) { return Lyrics.phrase(this.L[i]!, q); }
  node(id: string) { return ORG.find((n) => n.id === id)!; }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    if (t >= this.tH4) return this.h4(t, out);
    const shot = t < this.tH2 ? 1 : t < this.tH3 ? 2 : 3;
    const cam = shot === 1 ? this.camH1(t) : shot === 2 ? { x: 0, y: IVR.y, z: 0.98 + 0.04 * prog(t, this.tH2, this.tH3), r: 0 } : { x: 0, y: 6000, z: 1.0 + 0.05 * prog(t, this.tH3, this.T1), r: 0 };
    const ph = frameIdx(t);
    const trouble = this.P(3, '麻烦').start;
    const amp = 16 * pulse(t, trouble, 0.07) + 8 * pulse(t, this.tH2, 0.05) + 8 * pulse(t, this.tH3, 0.05);
    const m = camXf(cam, amp * (hash(ph, 1) - 0.5) * 2, amp * (hash(ph, 2) - 0.5) * 2);
    const L = this.ink;
    L.clear('#000');
    const c = L.ctx;
    c.globalCompositeOperation = 'lighter';
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    this.hud.clear();
    const hc = this.hud.ctx;
    hc.save(); hc.textBaseline = 'alphabetic';
    const heads: { x: number; y: number; k: number }[] = [];
    if (shot === 1) this.h1(c, hc, t, m, heads);
    else if (shot === 2) this.h2(c, hc, t, m, heads);
    else this.h3(c, hc, t, m, heads);
    hc.fillStyle = SYS.fg;
    chrome(hc, t, shot === 1 ? '关系图谱 · 来访人 0472' : shot === 2 ? '实时字幕 · 来电 0472' : '通话录音 · 双声道');
    hc.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    this.paper.render(this.ctx.renderer, L.upload(), m, cam.z, out, { heads: heads.map((h) => ({ ...applyXf(m, h.x, h.y), k: h.k, r: 4 })), screen: 1 });
    this.ctx.comp.draw(this.ctx.renderer, this.hud.upload(), out);
    return SCREEN_POST;
  }

  // ------------------------------------------------------------------ H1: the graph
  camH1(t: number): Cam {
    let c: Cam = { x: 0, y: 120, z: 1.25, r: 0 };
    c = lerpCam(c, { x: 0, y: -120, z: 1.0, r: 0 }, prog(t, this.P(0, '局长').start - 0.3, this.P(0, '局长').start + 0.2, ease.inOutCubic));
    c = lerpCam(c, { x: 200, y: 0, z: 0.95, r: 0 }, prog(t, this.L[1]!.start - 0.1, this.L[1]!.start + 0.3, ease.outExpo));
    c = lerpCam(c, { x: 280, y: 220, z: 1.25, r: 0.01 }, prog(t, this.L[2]!.start - 0.1, this.L[2]!.start + 0.3, ease.outExpo));
    c = lerpCam(c, { x: 0, y: 260, z: 1.55, r: -0.01 }, prog(t, this.L[3]!.start - 0.1, this.L[3]!.start + 0.3, ease.outExpo));
    c = lerpCam(c, { x: 0, y: 0, z: 0.9, r: 0 }, prog(t, this.P(3, '麻烦').end, this.tH2, ease.inOutCubic));
    return c;
  }
  h1(c: Ctx2, hc: Ctx2, t: number, m: Xf, heads: { x: number; y: number; k: number }[]) {
    const trouble = this.P(3, '麻烦').start;
    // the tree (printed)
    c.strokeStyle = PRINT(0.9); c.lineWidth = 1.4;
    for (const [a, b] of EDGES) {
      const A = this.node(a), B = this.node(b);
      c.beginPath(); c.moveTo(A.x, A.y + 36); c.lineTo(A.x, (A.y + B.y) / 2); c.lineTo(B.x, (A.y + B.y) / 2); c.lineTo(B.x, B.y - 36); c.stroke();
    }
    for (const n of ORG) {
      const me = n.id === 'me';
      const w = me ? 260 : 170;
      c.strokeStyle = me ? INK(0.95) : INK(0.75); c.lineWidth = me ? 2 : 1.4;
      c.strokeRect(n.x - w / 2, n.y - 36, w, 72);
      c.fillStyle = INK(me && t >= trouble ? 0.35 : 0.95);
      c.font = font(F.hei(n.id === 'ju' ? 900 : 600), n.id === 'ju' ? 32 : 26);
      c.textAlign = 'center'; c.fillText(n.s, n.x, n.y + 10); c.textAlign = 'left';
    }
    const me = this.node('me'), ju = this.node('ju'), zr = this.node('zr'), k4 = this.node('k4');
    // 认识局长: the red line climbs to the top
    const t0 = this.L[0]!.start, t1 = this.P(0, '局长').end;
    const r1 = route([{ x: me.x - 60, y: me.y - 36 }, { x: me.x - 60, y: 250 }, { x: -760, y: 250 }, { x: -760, y: -380 }, { x: ju.x - 85, y: -380 }]);
    const k1 = prog(t, t0, t1, ease.inOutQuad);
    const cut = prog(t, trouble + 0.2, trouble + 0.5);
    c.strokeStyle = RED(cut > 0 ? 0.35 : 1); c.lineWidth = 3.5;
    const h1 = drawRoute(c, r1, r1.total * k1);
    if (k1 > 0 && k1 < 1) heads.push({ x: h1.x, y: h1.y, k: 1 });
    if (k1 >= 1 && cut <= 0) arrowHead(c, ju.x - 85, -380, 0, 16);
    // 和主任吃过饭: a dashed edge, printed
    const k2 = prog(t, this.P(1, '主任').start, this.P(1, '吃过饭').end, ease.inOutQuad);
    if (k2 > 0) {
      c.strokeStyle = cut > 0 ? PRINT(0.4) : INK(0.8); c.lineWidth = 2; c.setLineDash([12, 8]);
      const r2 = route([{ x: me.x + 60, y: me.y - 36 }, { x: me.x + 60, y: 220 }, { x: 760, y: 220 }, { x: 760, y: -160 }, { x: zr.x + 85, y: -160 }]);
      drawRoute(c, r2, r2.total * k2);
      c.setLineDash([]);
    }
    // the cuts: red crosses on both ties
    if (cut > 0) {
      c.strokeStyle = RED(1); c.lineWidth = 4;
      for (const [x, y] of [[-760, -60], [760, 40]] as const) {
        const s2 = 26 * cut;
        c.beginPath(); c.moveTo(x - s2, y - s2); c.lineTo(x + s2, y + s2); c.moveTo(x + s2, y - s2); c.lineTo(x - s2, y + s2); c.stroke();
      }
    }
    // his gaze: from 窗口 07 down to the node, a sweeping wedge
    const gk = prog(t, this.P(2, '眼神').start, this.L[2]!.end, ease.inOutQuad);
    if (gk > 0 && t < trouble + 0.6) {
      const a0 = Math.atan2(me.y - k4.y, me.x - k4.x);
      const sw = 0.18 * Math.sin(gk * Math.PI * 2);
      c.strokeStyle = INK(0.6); c.lineWidth = 1.2; c.setLineDash([8, 8]);
      for (const da of [-0.12, 0.12]) {
        c.beginPath(); c.moveTo(k4.x, k4.y + 36); c.lineTo(k4.x + Math.cos(a0 + da + sw) * 700, k4.y + 36 + Math.sin(a0 + da + sw) * 700); c.stroke();
      }
      c.setLineDash([]);
    }
    // 麻烦: the name struck, the new one in red
    if (t >= trouble) {
      const k = prog(t, trouble, trouble + 0.2, ease.outCubic);
      c.fillStyle = RED(1); c.fillRect(me.x - 120, me.y - 4, 240 * k, 4);
      c.save(); c.translate(me.x, me.y - 70); c.rotate(-0.05);
      c.font = font(F.song(900), 64); c.textAlign = 'center';
      c.fillText('麻烦', 0, 0);
      c.restore();
      c.strokeStyle = RED(1); c.lineWidth = 3; c.strokeRect(me.x - 140, me.y - 48, 280, 96);
    }
    // the system's notes
    const at = (x: number, y: number) => applyXf(m, x, y);
    if (t >= t1) { const p = at(ju.x + 100, -400); sysTag(hc, '关系 · 认识（自述）· 未核实', p.x, p.y, 'rgba(84,88,91,0.92)', '#fff', prog(t, t1, t1 + 0.4), 15); }
    if (k2 >= 1) { const p = at(560, 200); sysTag(hc, '共同用餐 ×1 · 关系强度 0.02', p.x, p.y, 'rgba(84,88,91,0.92)', '#fff', prog(t, this.P(1, '吃过饭').end, this.P(1, '吃过饭').end + 0.4), 15); }
    if (gk > 0 && t < trouble) { const p = at(me.x - 130, me.y - 60); brackets(hc, p.x, p.y, 260 * m.a, 120 * m.a, SYS.dim, 1, 16, 1.5); sysTag(hc, '评估中 · 窗口 07', p.x, p.y - 4, 'rgba(84,88,91,0.92)', '#fff', gk, 14); }
    if (t >= trouble) {
      const p = at(me.x + 150, me.y + 30);
      glowOn(hc, 1);
      sysTag(hc, '不稳定因素 · 重点关注', p.x, p.y, SYS.red, '#fff', prog(t, trouble + 0.1, trouble + 0.5), 18);
      glowOff(hc);
      const q = at(me.x + 150, me.y + 80);
      hc.fillStyle = SYS.fg; label(hc, '关系 · 已失效 ×2', q.x, q.y, 13, 500, 3);
    }
  }

  // ------------------------------------------------------------------ H2: the live caption
  h2(c: Ctx2, hc: Ctx2, t: number, m: Xf, heads: { x: number; y: number; k: number }[]) {
    const Y = IVR.y;
    const tGong = this.P(5, '公平').start, tZheng = this.P(5, '政绩').start, tEnd = this.L[5]!.end;
    // the call bar
    c.strokeStyle = INK(0.8); c.lineWidth = 2; c.strokeRect(-800, Y - 420, 1600, 120);
    c.fillStyle = INK(0.95); c.font = font(F.mono(600), 56); c.fillText('12345', -770, Y - 340);
    c.font = font(F.hei(600), 30); c.fillText('市民服务热线 · 通话中', -500, Y - 348);
    const el = Math.max(0, t - this.tH2 + 98);
    c.font = font(F.mono(500), 40); c.textAlign = 'right'; c.fillText(`00:${String(Math.floor(el / 60)).padStart(2, '0')}:${String(Math.floor(el % 60)).padStart(2, '0')}`, 770, Y - 342); c.textAlign = 'left';
    // the caption: what is said, as it is said
    const words: { s: string; t: number; kind?: 'look' | 'black' }[] = [
      { s: '我想', t: this.L[5]!.start }, { s: '反映的', t: this.L[5]!.start + 0.35 }, { s: '是', t: this.L[5]!.start + 0.7 },
      { s: '公平', t: tGong, kind: 'look' }, { s: '和', t: tGong + 0.5 }, { s: '政绩', t: tZheng, kind: 'black' },
    ];
    c.font = font(F.song(900), 110);
    let x = -760;
    const y = Y + 40;
    words.forEach((w) => {
      if (t < w.t) return;
      const ww = c.measureText(w.s).width;
      const k = prog(t, w.t, w.t + 0.12, ease.outCubic);
      if (w.kind === 'black') {
        // 政绩: shown for a moment, then blacked out by the red line
        const kb = prog(t, w.t + 0.25, w.t + 0.45, ease.inOutCubic);
        c.fillStyle = INK(0.97 * k); c.fillText(w.s, x, y);
        c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(x - 6, y - 100, (ww + 12) * kb, 124); c.globalCompositeOperation = 'lighter';
        c.fillStyle = RED(1); c.fillRect(x - 6, y - 100, (ww + 12) * kb, 124);
        if (kb > 0 && kb < 1) heads.push({ x: x - 6 + (ww + 12) * kb, y: y - 40, k: 1 });
      } else {
        c.fillStyle = INK(0.97 * k); c.fillText(w.s, x, y);
        if (w.kind === 'look') { c.strokeStyle = INK(0.8); c.lineWidth = 3; c.setLineDash([10, 8]); c.strokeRect(x - 10, y - 104, ww + 20, 132); c.setLineDash([]); }
      }
      x += ww + 16;
    });
    // the cursor of the caption
    if (t < tEnd + 0.2 && Math.round(t * 60) % 40 < 24) { c.fillStyle = INK(0.9); c.fillRect(x + 6, y - 92, 6, 112); }
    // the system's notes
    const at = (px: number, py: number) => applyXf(m, px, py);
    if (t >= tGong + 0.2) { const p = at(-760 + 3 * 0, Y + 140); sysTag(hc, '“公平” · 关键词库 · 无匹配', p.x + 520, p.y + 40, 'rgba(84,88,91,0.94)', '#fff', prog(t, tGong + 0.2, tGong + 0.6), 18); }
    if (t >= tZheng + 0.45) { const p = at(-760, Y + 220); glowOn(hc, 1); sysTag(hc, '“政绩” · 敏感词 · 已屏蔽', p.x + 520, p.y + 50, SYS.red, '#fff', prog(t, tZheng + 0.45, tZheng + 0.8), 18); glowOff(hc); }
    if (t >= tEnd + 0.3) { c.fillStyle = INK(0.8); c.font = font(F.hei(700), 40); c.fillText('通话已转接 → 原单位 · 窗口 07', -760, Y + 330); }
  }

  // ------------------------------------------------------------------ H4: the official notice, quoted
  h4(t: number, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    const hc = this.hud.ctx;
    this.hud.clear();
    hc.fillStyle = '#0b0c0d'; hc.fillRect(0, 0, W, H);
    // the screenshot as a phone screen, centred, a slow push toward its last lines
    const k = ease.inOutQuad(prog(t, this.tH4, this.T1));
    const ih = lerp(940, 1240, k), iw = (ih * this.notice.width) / this.notice.height;
    const x = W / 2 - iw / 2 - lerp(0, 60, k), y = lerp(110, -260, k);
    drawQuoted(hc, this.notice, x, y, iw, ih, 0.2);
    hc.strokeStyle = 'rgba(151,156,159,0.6)'; hc.lineWidth = 2; hc.strokeRect(x - 1, y - 1, iw + 2, ih + 2);
    // its own words, boxed on the beats (image px of the 1080x1334 screenshot)
    const S = iw / this.notice.width;
    const boxes: [number, number, number, number][][] = [
      [[640, 955, 885, 1000], [205, 1003, 335, 1048]],   // 将宠物狗进行了 / 无害化处置
      [[735, 1048, 885, 1093], [205, 1092, 255, 1137]],  // 已取得该网民谅 / 解
      [[335, 1092, 795, 1137]],                          // 该群众对疫情期间的防控措施表示理解
    ];
    const step = (this.T1 - this.tH4) / 3.4;
    hc.strokeStyle = SYS.red; hc.lineWidth = 4;
    boxes.forEach((grp, i) => {
      const kb = prog(t, this.tH4 + 0.3 + i * step, this.tH4 + 0.55 + i * step, ease.outCubic);
      if (kb <= 0) return;
      glowOn(hc, 0.8);
      for (const [x0, y0, x1, y1] of grp) hc.strokeRect(x + x0 * S, y + y0 * S, (x1 - x0) * S * kb, (y1 - y0) * S);
      glowOff(hc);
    });
    chrome(hc, t, '处置结果 · 官方通报');
    clearRT(renderer, out, [0, 0, 0]);
    comp.draw(renderer, this.hud.upload(), out);
    return { bloom: 0.3, bloomThreshold: 0.9, halation: 0.04, vignette: 0.4, grain: 0.07, ca: 0.6, paper: 0 };
  }

  // ------------------------------------------------------------------ H3: the call
  h3(c: Ctx2, hc: Ctx2, t: number, m: Xf, heads: { x: number; y: number; k: number }[]) {
    const Y = 6000, X0 = -820, Wd = 1640;
    const span = 7; // seconds on screen, the playhead at 70 %
    const tStop0 = this.P(6, '停了').start, tStop1 = tStop0 + 1.0;
    const tLaugh = this.P(7, '笑意').start;
    const from = t - span * 0.7;
    const x = (tt: number) => X0 + ((tt - from) / span) * Wd;
    const { audio } = this.ctx;
    c.fillStyle = INK(0.85); c.font = font(F.hei(500), 24);
    c.fillText('来电人', X0, Y - 270); c.fillText('坐席', X0, Y + 70);
    c.fillStyle = PRINT(0.9); c.fillRect(X0, Y - 150, Wd, 1); c.fillRect(X0, Y + 190, Wd, 1);
    const n = 260;
    for (let i = 0; i < n; i++) {
      const tt = from + (span * i) / n;
      if (tt > t) break;
      const xx = X0 + (Wd * i) / n;
      // the caller: the voice itself (the song's vocal)
      const v = audio.env('vocal', tt) * (0.55 + 0.45 * hash(Math.floor(tt * 40), 3));
      c.fillStyle = INK(0.9); c.fillRect(xx, Y - 150 - v * 100, 3, v * 200);
      // the agent: a murmur, silent for one second, then the laugh
      let a = 0.12 + 0.18 * Math.abs(Math.sin(tt * 7.3) * Math.sin(tt * 2.1)) * (tt < tStop0 ? 1 : 0.5);
      if (tt >= tStop0 && tt < tStop1) a = 0.01;
      const lg = tt >= tLaugh ? Math.exp(-(tt - tLaugh) / 0.35) * (0.6 + 0.4 * Math.abs(Math.sin(tt * 38))) : 0;
      a = Math.max(a, lg);
      c.fillStyle = lg > 0.2 ? RED(1) : PRINT(1);
      c.fillRect(xx, Y + 190 - a * 110, 3, a * 220);
    }
    // the playhead
    const px = x(t);
    c.fillStyle = INK(0.6); c.fillRect(px, Y - 330, 1.5, 620);
    // the silence, dimensioned by the red line
    if (t >= tStop0) {
      const k = prog(t, tStop0, tStop1);
      c.strokeStyle = RED(1); c.fillStyle = RED(1); c.lineWidth = 2.5;
      dimension(c, x(tStop0), Y + 300, x(tStop0 + (tStop1 - tStop0) * k), Y + 300, '', 0, 16);
      if (k >= 1) { c.font = font(F.mono(600), 30); c.textAlign = 'center'; c.fillText('静音 1.00 s', (x(tStop0) + x(tStop1)) / 2, Y + 280); c.textAlign = 'left'; }
    }
    if (t >= tLaugh) {
      const p = applyXf(m, x(tLaugh) - 20, Y + 40);
      brackets(hc, p.x, p.y, 200 * m.a, 300 * m.a, SYS.red, prog(t, tLaugh, tLaugh + 0.15), 20, 2.5);
      glowOn(hc, 1.2);
      sysTag(hc, '[笑声] · 置信度 0.97 · 识别成功', p.x, p.y - 6, SYS.red, '#fff', prog(t, tLaugh + 0.05, tLaugh + 0.5), 18);
      glowOff(hc);
    }
    // after the line: what the transcript kept
    const tEnd = this.L[7]!.end + 0.3;
    sysPanel(hc, 1360, 150, 470, '转写结果 · 通话 03:12', [
      { k: '来电人', v: '[无法识别] ×14', t: tEnd },
      { k: '坐席', v: '[笑声] ×1', t: tEnd + 0.5, red: true },
      { k: '工单', v: '已转办', t: tEnd + 1.0 },
    ], t, 18);
  }
}

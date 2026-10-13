// 图版 01 `home` — 住处 (the intro, before the voice)
// PAPER: the apartment in plan prints in; on the beats a paw-print trail crosses it (window sill → sun patch →
// bowls → sofa → the cardboard box) and the owner's notes come in by hand (KaiTi: the person's own voice):
// 晒太阳的地方 · 喵喵的碗 · 它最喜欢的纸箱. On a downbeat the plate cuts to SCREEN: the same home as the system
// holds it. The handwriting is replaced by tags, the red line writes the number on the box (编号 0471: the first
// number of the film; the visitor will be 0472), the door is sealed (封条), and the red line plans the way in.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { F, font } from '../engine/type';
import { clamp, ease, lerp, prog, pulse, hash, frameIdx } from '../engine/util';
import { Paper, PAPER_POST, SCREEN_POST, SYS, glowOn, glowOff, brackets, sysTag, INK, PRINT, RED, camXf, applyXf, lerpCam, label, route, drawRoute, type Cam, type Ctx2, type Xf, chrome } from './_archive';
import { PLAN, DOOR, BOX, BOWL, ENTRY, drawPlan, drawSun, drawPaws, trailSteps } from './_plan';

const NOTES = [
  { text: '晒太阳的地方', at: 2, x: 250, y: -250, tx: 100, ty: -260 },
  { text: '喵喵的碗', at: 6, x: -560, y: -400, tx: BOWL.x + 20, ty: BOWL.y - 20 },
  { text: '它最喜欢的纸箱', at: 10, x: 260, y: 140, tx: BOX.x + 40, ty: BOX.y - 30 },
];

export default class Home extends Scene {
  ink = new Layer2D();
  hud = new Layer2D();
  paper = new Paper();
  T0 = 0; T1 = 0; beat = 0.4;
  tDraw = 0; tPaw0 = 0; tSys = 0; tNum = 0; tSeal = 0; tRoute = 0;
  pawT: number[] = [];
  entry = route(ENTRY);

  override async init() {
    const { audio } = this.ctx;
    this.T0 = this.ctx.start; this.T1 = this.ctx.end;
    const b0 = Math.floor(audio.beatAt(this.T1 - 1));
    this.beat = audio.timeOfBeat(b0 + 1) - audio.timeOfBeat(b0);
    const downs = audio.downbeats.filter((d) => d > this.T0 + 0.5 && d < this.T1 - 0.5);
    this.tDraw = downs[0] ?? this.T0 + 1;
    // the system arrives four bars before the voice; the seal a bar later; the route in the last bar
    this.tSys = downs[downs.length - 4] ?? this.T1 - 6.4;
    this.tNum = this.tSys + this.beat;
    this.tSeal = downs[downs.length - 3] ?? this.tSys + 1.6;
    this.tRoute = downs[downs.length - 2] ?? this.tSeal + 1.6;
    // paw prints: one per beat from the second bar until the system arrives (the last ones land in the box)
    const n = trailSteps().length;
    const bA = Math.ceil(audio.beatAt(this.tDraw + this.beat * 3.5)), bB = Math.floor(audio.beatAt(this.tSys - 0.05));
    this.pawT = Array.from({ length: n }, (_, i) => audio.timeOfBeat(lerp(bA, bB, i / Math.max(1, n - 1))));
  }

  pawsAt(t: number) {
    let k = 0;
    for (const pt of this.pawT) k += clamp((t - pt) / 0.12);
    return k;
  }

  camAt(t: number): Cam {
    if (t < this.tSys) {
      // paper: the whole plan, held; one slow push while the trail crosses it (the camera doesn't chase the cat)
      return lerpCam({ x: 0, y: 0, z: 0.62, r: -0.02 }, { x: -40, y: -20, z: 0.84, r: -0.012 }, prog(t, this.tDraw, this.tSys, ease.inOutSine));
    }
    // screen: the whole home, a slow push, then toward the door as the route is drawn
    let c: Cam = { x: 0, y: 30, z: lerp(0.66, 0.7, prog(t, this.tSys, this.tRoute)), r: 0 };
    c = lerpCam(c, { x: -280, y: 260, z: 0.95, r: 0.01 }, prog(t, this.tRoute, this.T1, ease.inOutCubic));
    return c;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const screen = t >= this.tSys ? 1 : 0;
    const cam = this.camAt(t);
    const amp = 10 * pulse(t, this.tSys, 0.06) + 14 * pulse(t, this.tSeal, 0.07);
    const ph = frameIdx(t);
    const m = camXf(cam, amp * (hash(ph, 1) - 0.5) * 2, amp * (hash(ph, 2) - 0.5) * 2);
    const L = this.ink;
    L.clear('#000');
    const c = L.ctx;
    c.globalCompositeOperation = 'lighter';
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    // the plan prints in, top to bottom, over the first two beats
    const reveal = prog(t, this.tDraw - this.beat, this.tDraw + this.beat * 2, ease.inOutQuad);
    c.save();
    c.beginPath(); c.rect(-2000, -2000, 4000, lerp(0, 4000, reveal) ); c.clip();
    drawPlan(c);
    c.restore();
    drawSun(c, screen ? 0.5 : 1);
    drawPaws(c, this.pawsAt(t), screen ? PRINT : INK);
    let heads: { x: number; y: number; k: number }[] = [];
    if (!screen) this.drawNotes(c, t);
    else heads = this.drawSystem(c, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    const hs = heads.map((h) => ({ ...applyXf(m, h.x, h.y), k: h.k, r: 4 * cam.z }));
    this.paper.render(this.ctx.renderer, L.upload(), m, cam.z, out, { heads: hs, screen, light: prog(t, this.T0, this.T0 + 0.8) });
    this.hud.clear();
    if (screen) this.drawHud(this.hud.ctx, t, m);
    this.ctx.comp.draw(this.ctx.renderer, this.hud.upload(), out);
    return screen ? SCREEN_POST : PAPER_POST;
  }

  /** The owner's notes, by hand, as the trail reaches each place. */
  drawNotes(c: Ctx2, t: number) {
    for (const n of NOTES) {
      const tn = this.pawT[Math.min(this.pawT.length - 1, n.at)]! + 0.05;
      const k = prog(t, tn, tn + 0.6, ease.linear);
      if (k <= 0) continue;
      c.strokeStyle = INK(0.6); c.lineWidth = 1;
      c.beginPath(); c.moveTo(n.tx, n.ty); c.lineTo(lerp(n.tx, n.x - 8, Math.min(1, k * 3)), lerp(n.ty, n.y - 10, Math.min(1, k * 3))); c.stroke();
      const chars = Array.from(n.text), m = Math.ceil(chars.length * k);
      c.fillStyle = INK(0.9);
      c.font = font(F.kai(), 30);
      c.fillText(chars.slice(0, m).join(''), n.x, n.y);
    }
  }

  /** The system's version: the number on the box, the seal on the door, the way in. Returns pen heads. */
  drawSystem(c: Ctx2, t: number) {
    const heads: { x: number; y: number; k: number }[] = [];
    c.strokeStyle = RED(1); c.fillStyle = RED(1); c.lineWidth = 3;
    // the number, written by the red line round the box
    const k = prog(t, this.tNum, this.tNum + this.beat * 2, ease.inOutQuad);
    if (k > 0) {
      const x0 = BOX.x - BOX.w / 2 - 22, y0 = BOX.y - BOX.h / 2 - 22, w = BOX.w + 44, h = BOX.h + 44;
      const r = route([{ x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w, y: y0 + h }, { x: x0, y: y0 + h }, { x: x0, y: y0 - 1.5 }]);
      const hp = drawRoute(c, r, r.total * k);
      if (k < 1) heads.push({ x: hp.x, y: hp.y, k: 1 });
      const nk = prog(t, this.tNum + this.beat * 1.5, this.tNum + this.beat * 2.5);
      const s = '0471';
      c.font = font(F.mono(600), 34);
      c.fillText(s.slice(0, Math.ceil(s.length * nk)), x0 + w + 16, y0 + 30);
    }
    // the seal across the door
    if (t >= this.tSeal) {
      const sk = prog(t, this.tSeal, this.tSeal + 0.1, ease.outCubic);
      c.save();
      c.translate(DOOR.x, DOOR.y); c.rotate(-0.12);
      c.fillRect(-90 * sk, -16, 180 * sk, 32);
      c.restore();
    }
    // the way in, planned
    if (t >= this.tRoute) {
      const rk = prog(t, this.tRoute, this.T1 - 0.1, ease.inOutQuad);
      c.lineWidth = 4;
      c.setLineDash([22, 10]);
      const hp = drawRoute(c, this.entry, this.entry.total * rk);
      c.setLineDash([]);
      if (rk < 1) heads.push({ x: hp.x, y: hp.y, k: 1 });
    }
    return heads;
  }

  drawHud(c: Ctx2, t: number, m: Xf) {
    c.save();
    c.textBaseline = 'alphabetic';
    c.fillStyle = SYS.fg;
    chrome(c, t, '网格化管理 · 3 栋 2 单元 · 户内核查');
    // the owner's notes, re-read by the system
    const tags = [
      { at: { x: 100, y: -260 }, text: '无关区域', red: false, t0: this.tSys + 0.1 },
      { at: { x: BOWL.x + 20, y: BOWL.y - 20 }, text: '宠物用品 ×2', red: false, t0: this.tSys + 0.25 },
      { at: { x: BOX.x, y: BOX.y - BOX.h / 2 - 22 }, text: '活体 · 猫 · 未登记', red: true, t0: this.tSys + 0.4 },
    ];
    for (const g of tags) {
      const p = applyXf(m, g.at.x, g.at.y);
      if (g.red) glowOn(c, 0.8);
      sysTag(c, g.text, p.x - 10, p.y - 12, g.red ? SYS.red : 'rgba(84,88,91,0.92)', '#fff', prog(t, g.t0, g.t0 + 0.3), 14);
      glowOff(c);
    }
    const b = applyXf(m, BOX.x - BOX.w / 2 - 22, BOX.y - BOX.h / 2 - 22), b2 = applyXf(m, BOX.x + BOX.w / 2 + 22, BOX.y + BOX.h / 2 + 22);
    if (t >= this.tNum) brackets(c, b.x - 12, b.y - 12, b2.x - b.x + 24, b2.y - b.y + 24, SYS.dim, prog(t, this.tNum, this.tNum + 0.2), 16, 1.5);
    if (t >= this.tSeal) {
      const d = applyXf(m, DOOR.x, DOOR.y);
      glowOn(c, 0.8);
      sysTag(c, '已封控 · 户号 0471', d.x - 90, d.y - 34, SYS.red, '#fff', prog(t, this.tSeal, this.tSeal + 0.3), 15);
      glowOff(c);
    }
    c.restore();
  }
}

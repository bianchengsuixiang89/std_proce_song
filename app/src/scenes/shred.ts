// 图版 07 `shred` — 碾碎 / "像碾碎可笑的法律 · 像处理没用的道理"
// PAPER: a shredder in section (feed slot, two toothed rollers, the bin). The petition's documents come back: the
// law extract (its red underlines, its 已收悉) feeds in on 碾碎 and leaves as strips; the test report (阴性, boxed)
// follows on 处理. The red line is the cut line at the rollers' nip. The system logs it: 已收悉材料 · 保存期限 0 日.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { Lyrics, type Line } from '../engine/lyrics';
import { F, font } from '../engine/type';
import { clamp, ease, lerp, prog, pulse, hash, frameIdx, TAU } from '../engine/util';
import { Paper, PAPER_POST, SYS, glowOn, glowOff, sysPanel, INK, PRINT, RED, camXf, applyXf, label, greek, hatchRect, drawStamp, type Cam, type Ctx2, type Stamp, chrome } from './_archive';

const PW = 520, PH = 720;          // a page
const NIP = 0;                      // the rollers' nip (y)
const BIN = { y0: 250, y1: 640, x0: -420, x1: 420 };
const SLOT_TOP = -150;              // the top of the housing (the feed slot)
const SHEET_PX = 3;                 // backing px per page px of a document's sheet (sharp at 4K and 1.2× zoom)

export default class Shred extends Scene {
  ink = new Layer2D();
  hud = new Layer2D();
  paper = new Paper();
  L1!: Line; L2!: Line;
  T0 = 0; T1 = 0;
  a0 = 0; a1 = 0; b0 = 0; b1 = 0;

  override async init() {
    const { lyrics } = this.ctx;
    this.L1 = lyrics.get('像碾碎可笑的法律'); this.L2 = lyrics.get('像处理没用的道理');
    this.T0 = this.ctx.start; this.T1 = this.ctx.end;
    const crush = Lyrics.phrase(this.L1, '碾碎');
    this.a0 = crush.start - 0.5; this.a1 = this.L1.end + 0.2;
    const proc = Lyrics.phrase(this.L2, '处理');
    this.b0 = proc.start - 0.5; this.b1 = this.L2.end + 0.2;
  }

  /** How far a page has been fed (its top edge's y): above the slot → through the nip → gone. */
  feed(t: number, t0: number, t1: number) { return lerp(-PH - 420, PH * 0.75, ease.inOutSine(prog(t, t0, t1))); }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const crush = Lyrics.phrase(this.L1, '碾碎').start, proc = Lyrics.phrase(this.L2, '处理').start;
    const cam: Cam = { x: 110, y: lerp(140, 170, prog(t, this.T0, this.T1)), z: 1.0 * (1 + 0.04 * pulse(t, crush, 0.1) + 0.04 * pulse(t, proc, 0.1)), r: -0.01 };
    const ph = frameIdx(t);
    const amp = 14 * pulse(t, crush, 0.07) + 12 * pulse(t, proc, 0.07) + 2.5 * ((t > this.a0 && t < this.a1) || (t > this.b0 && t < this.b1) ? 1 : 0);
    const m = camXf(cam, amp * (hash(ph, 1) - 0.5) * 2, amp * (hash(ph, 2) - 0.5) * 2);
    const L = this.ink;
    L.clear('#000');
    const c = L.ctx;
    c.globalCompositeOperation = 'lighter';
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    const stamps: Stamp[] = [];
    this.machine(c, t);
    // the pile in the bin grows as strips arrive
    const pile = 40 + 120 * prog(t, this.a0 + 1, this.a1) + 120 * prog(t, this.b0 + 1, this.b1);
    c.save(); c.beginPath(); c.rect(BIN.x0 + 4, BIN.y1 - pile, BIN.x1 - BIN.x0 - 8, pile); c.clip();
    c.strokeStyle = PRINT(0.7); c.lineWidth = 1;
    for (let i = 0; i < 90; i++) { const x = BIN.x0 + 10 + hash(i, 1) * (BIN.x1 - BIN.x0 - 20); c.beginPath(); c.moveTo(x, BIN.y1 - 4); c.quadraticCurveTo(x + (hash(i, 2) - 0.5) * 80, BIN.y1 - pile * 0.5, x + (hash(i, 3) - 0.5) * 120, BIN.y1 - pile + hash(i, 4) * 30); c.stroke(); }
    // the chips that have landed (ink, print and the odd red one: what the pages were)
    for (let i = 0; i < 260; i++) {
      const x = BIN.x0 + 14 + hash(i, 5) * (BIN.x1 - BIN.x0 - 28), y = BIN.y1 - 6 - hash(i, 6) * hash(i, 6) * pile;
      c.save(); c.translate(x, y); c.rotate((hash(i, 7) - 0.5) * 3);
      c.strokeStyle = hash(i, 8) > 0.9 ? RED(0.9) : hash(i, 8) > 0.45 ? INK(0.55) : PRINT(0.8);
      c.strokeRect(-11, -18, 22, 36);
      c.restore();
    }
    c.restore();
    // each document only while it is being fed (it enters from above the frame, it ends in the pile)
    if (t >= this.a0 - 0.6 && t < this.a1) this.page(c, 'law', this.feed(t, this.a0, this.a1), BIN.y1 - pile);
    if (t >= this.b0 - 0.6 && t < this.b1) this.page(c, 'report', this.feed(t, this.b0, this.b1), BIN.y1 - pile);
    // the cut line at the nip
    c.fillStyle = RED(1); c.fillRect(-PW / 2 - 60, NIP - 1.5, PW + 120, 3);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    const nip = applyXf(m, -PW / 2 - 60, NIP);
    this.paper.render(this.ctx.renderer, L.upload(), m, cam.z, out, { stamps, heads: [{ x: nip.x, y: nip.y, k: 0.9 }] });
    this.hud.clear();
    const hc = this.hud.ctx;
    hc.save(); hc.textBaseline = 'alphabetic';
    hc.fillStyle = SYS.fg;
    chrome(hc, t, '文件销毁 · 窗口 07 · 已收悉材料');
    sysPanel(hc, 1380, 240, 460, '销毁记录', [
      { k: '宪法 · 检测报告', v: '已销毁', t: crush + 0.3 },
      { k: '保存期限', v: '0 日', t: proc + 0.5, red: true },
    ], t, 18);
    hc.restore();
    this.ctx.comp.draw(this.ctx.renderer, this.hud.upload(), out);
    return PAPER_POST;
  }

  machine(c: Ctx2, t: number) {
    c.strokeStyle = INK(0.9); c.lineWidth = 2;
    // housing
    c.strokeRect(-460, -150, 920, 300);
    c.strokeStyle = PRINT(0.6); c.lineWidth = 1;
    hatchRect(c, -460, -150, 140, 300, 8); hatchRect(c, 320, -150, 140, 300, 8);
    // the slot
    c.strokeStyle = INK(0.9); c.lineWidth = 2;
    c.beginPath(); c.moveTo(-PW / 2 - 40, -150); c.lineTo(-30, -60); c.moveTo(PW / 2 + 40, -150); c.lineTo(30, -60); c.stroke();
    // two rollers, toothed, turning while something feeds
    const spin = t * 9;
    for (const s of [-1, 1]) {
      const cx = s * 72, cy = NIP;
      c.strokeStyle = INK(0.9); c.lineWidth = 1.8;
      c.beginPath(); c.arc(cx, cy, 66, 0, TAU); c.stroke();
      c.beginPath(); c.arc(cx, cy, 16, 0, TAU); c.stroke();
      c.beginPath();
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU + spin * -s;
        c.moveTo(cx + Math.cos(a) * 66, cy + Math.sin(a) * 66); c.lineTo(cx + Math.cos(a + 0.12) * 78, cy + Math.sin(a + 0.12) * 78); c.lineTo(cx + Math.cos(a + 0.26) * 66, cy + Math.sin(a + 0.26) * 66);
      }
      c.stroke();
    }
    // the bin
    c.strokeStyle = INK(0.85); c.lineWidth = 2;
    c.beginPath(); c.moveTo(BIN.x0, BIN.y0); c.lineTo(BIN.x0, BIN.y1); c.lineTo(BIN.x1, BIN.y1); c.lineTo(BIN.x1, BIN.y0); c.stroke();
    c.fillStyle = INK(0.85); c.font = font(F.hei(600), 26); c.fillText('碎纸机 · 剖面', -460, -190);
    c.fillStyle = PRINT(0.9); label(c, '切割宽度 4 mm', 360, 40, 14, 500, 2);
  }

  /** A document fed through the rollers: whole above the nip; below it 20 strips that are cut again into
   *  chips (cross-cut), which break off, tumble and fall into the bin, where they join the pile. */
  page(c: Ctx2, kind: 'law' | 'report', top: number, pileTop: number) {
    if (top < -PH - 250) return;
    const x0 = -PW / 2;
    const img = this.sheet(kind);
    const S = SHEET_PX, pad = 10;
    // (source rect in page px → the sheet's pixels)
    const blit = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) =>
      c.drawImage(img, (sx - x0 + pad) * S, sy * S, sw * S, sh * S, dx, dy, sw, sh);
    // above the slot: whole (inside the housing only the rollers show)
    if (top < SLOT_TOP) blit(x0 - pad, 0, PW + 2 * pad, Math.min(PH, SLOT_TOP - top), x0 - pad, top);
    // below: strips that fan out a little as they leave the rollers, then break into chips and fall
    const n = 20, sw = PW / n, ch = 40, D0 = 90;
    for (let i = 0; i < n; i++) {
      const sx = x0 + i * sw;
      const fan = (i - (n - 1) / 2) * 0.05;
      for (let j = 0; j < PH / ch; j++) {
        const yr = top + j * ch;
        if (yr + ch <= NIP) continue;
        const cut = Math.max(0, NIP - yr); // the part still above the nip
        const d = yr + cut - NIP;
        if (d < D0) {
          // still part of the strip
          blit(sx + 1, j * ch + cut, sw - 2, ch - cut, sx + 1 + fan * d, yr + cut);
          continue;
        }
        // a chip: falls faster than the paper is fed, drifts and turns
        const s = d - D0;
        const y = NIP + D0 + s * (1.3 + 1.2 * hash(i, j, 23)) + s * s * 0.002;
        if (y > pileTop) continue;
        const x = sx + 1 + fan * D0 + (hash(i, j, 21) - 0.5) * s * 0.9;
        c.save();
        c.translate(x + sw / 2, y + ch / 2); c.rotate((hash(i, j, 22) - 0.5) * s * 0.03);
        c.globalAlpha = clamp((pileTop - y) / 60);
        c.drawImage(img, (sx + 1 - x0 + pad) * S, j * ch * S, (sw - 2) * S, ch * S, -sw / 2, -ch / 2, sw - 2, ch);
        c.restore();
      }
    }
  }

  /** Each document drawn once into its own sheet (page px × SHEET_PX), cut up from there. */
  sheets: Partial<Record<'law' | 'report', HTMLCanvasElement>> = {};
  sheet(kind: 'law' | 'report') {
    const have = this.sheets[kind];
    if (have) return have;
    const S = SHEET_PX, pad = 10, x0 = -PW / 2;
    const cv = document.createElement('canvas');
    cv.width = (PW + 2 * pad) * S; cv.height = (PH + 4) * S;
    const cc = cv.getContext('2d')!;
    cc.scale(S, S); cc.translate(PW / 2 + pad, 0);
    cc.globalCompositeOperation = 'lighter';
    {
      cc.strokeStyle = INK(0.8); cc.lineWidth = 1.3; cc.strokeRect(x0, 0, PW, PH);
      cc.fillStyle = INK(0.92); cc.font = font(F.song(700), 30); cc.textAlign = 'center';
      cc.fillText(kind === 'law' ? '中华人民共和国宪法' : '检 测 报 告', 0, 60); cc.textAlign = 'left';
      if (kind === 'law') {
        for (let i = 0; i < 6; i++) {
          const y = 120 + i * 92;
          cc.fillStyle = INK(0.9); cc.font = font(F.hei(700), 16); cc.fillText(['第二条', '第三十三条', '第三十五条', '第三十七条', '第三十九条', '第四十一条'][i]!, x0 + 24, y);
          cc.fillStyle = INK(0.38); greek(cc, x0 + 100, y, PW - 130, 3, 22, 7, 100 + i);
          if (i < 4) { cc.fillStyle = RED(1); cc.fillRect(x0 + 100, y + 4, PW - 130, 3); }
        }
        drawStamp(cc, 60, 520, 120, 52, -0.09, '已收悉', '仅表示收到', 1);
      } else {
        cc.strokeStyle = INK(0.8); cc.lineWidth = 1.2;
        cc.beginPath(); cc.moveTo(x0 + 40, 120); cc.lineTo(x0 + 40, 300); cc.lineTo(x0 + PW - 40, 300); cc.stroke();
        cc.strokeStyle = RED(1); cc.lineWidth = 2.5;
        cc.beginPath(); for (let i = 0; i < 12; i++) { const x = x0 + 60 + i * 36, y = 240 - 30 * hash(i, 31); i ? cc.lineTo(x, y) : cc.moveTo(x, y); } cc.stroke();
        for (let i = 0; i < 3; i++) {
          const y = 380 + i * 60;
          cc.fillStyle = INK(0.38); greek(cc, x0 + 40, y, 260, 1, 0, 7, 400 + i);
          cc.fillStyle = INK(0.92); cc.font = font(F.fang(), 26); cc.fillText('阴性', x0 + 360, y);
          cc.strokeStyle = RED(1); cc.lineWidth = 2.2; cc.strokeRect(x0 + 350, y - 28, 70, 38);
        }
      }
    }
    return (this.sheets[kind] = cv);
  }
}

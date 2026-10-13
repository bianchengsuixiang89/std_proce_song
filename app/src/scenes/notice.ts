// 图版 03 `notice` — 告知书 / "他手里那张纸 · 写着喵喵的忌日 · 依照标准流程 · 进行报废处理"
//   N1 (PAPER) the notice in a gloved hand: a red-headed 处置告知书, 编号 0471. 喵喵 is typed into the 对象 field;
//      on 忌日 the red line strikes the printed label 处置日期 and writes 忌日 above it by hand: the correction
//      line names what the form won't. The system's eye tags the correction 手写批注 · 无效 · 已忽略.
//   N2 (SCREEN) 依照标准流程: the SOP as a flowchart, one node lit per character (入户 · 核查 · ◇住户同意？ ·
//      捕捉 · 处置 · 归档); at the decision both branches, 是 and 否, lead to the same box.
//   N3 (PAPER) 进行报废处理: back on the notice: 报废 (按物品处理) is stamped over the 处置方式 options and the
//      HUD reclassifies 类别 宠物 → 物品.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D } from '../engine/gl';
import { Lyrics, type Line } from '../engine/lyrics';
import { F, font, measure } from '../engine/type';
import { clamp, ease, lerp, prog, pulse, hash, frameIdx, TAU } from '../engine/util';
import { Paper, PAPER_POST, SCREEN_POST, SYS, glowOn, glowOff, brackets, sysTag, sysPanel, INK, PRINT, RED, camXf, applyXf, lerpCam, label, route, drawRoute, arrowHead, drawStamp, greek, type Cam, type Ctx2, type Xf, type Stamp, chrome } from './_archive';

const SHEET = { x0: -450, y0: -620, x1: 450, y1: 620 };
const ROW = (i: number) => -120 + i * 92; // field rows (baseline y)
const FLOW = { y: 3000 };

export default class Notice extends Scene {
  ink = new Layer2D();
  hud = new Layer2D();
  paper = new Paper();
  L4!: Line; L5!: Line; L6!: Line; L7!: Line;
  beat = 0.4;
  T0 = 0; T1 = 0;
  tName0 = 0; tName1 = 0; tJi0 = 0; tJi1 = 0; tN2 = 0; tNodes: number[] = []; tN3 = 0; tStamp = 0; tX = 0;

  override async init() {
    const { lyrics, audio } = this.ctx;
    this.L4 = lyrics.get('他手里那张纸'); this.L5 = lyrics.get('写着喵喵的忌日');
    this.L6 = lyrics.get('依照标准流程'); this.L7 = lyrics.get('进行报废处理');
    this.T0 = this.ctx.start; this.T1 = this.ctx.end;
    const b0 = Math.floor(audio.beatAt(this.T0));
    this.beat = audio.timeOfBeat(b0 + 1) - audio.timeOfBeat(b0);
    const onBeat = (t: number) => audio.timeOfBeat(Math.floor(audio.beatAt(t + 0.02)));
    const nm = Lyrics.phrase(this.L5, '喵喵'), ji = Lyrics.phrase(this.L5, '忌日');
    this.tName0 = nm.start; this.tName1 = nm.end;
    this.tJi0 = ji.start; this.tJi1 = ji.end + 0.2;
    this.tN2 = onBeat(this.L6.start);
    this.tNodes = this.L6.words.map((w) => w.start);
    const bf = Lyrics.phrase(this.L7, '报废');
    this.tN3 = onBeat(bf.start);
    this.tStamp = bf.start;
    this.tX = Lyrics.phrase(this.L7, '处理').start;
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const screen = t >= this.tN2 && t < this.tN3 ? 1 : 0;
    const cam = screen ? this.flowCam(t) : this.sheetCam(t);
    const ph = frameIdx(t);
    const amp = 24 * pulse(t, this.tStamp, 0.07) + 6 * pulse(t, this.tN2, 0.05) + 6 * pulse(t, this.tN3, 0.05);
    const m = camXf(cam, amp * (hash(ph, 1) - 0.5) * 2, amp * (hash(ph, 2) - 0.5) * 2);
    const L = this.ink;
    L.clear('#000');
    const c = L.ctx;
    c.globalCompositeOperation = 'lighter';
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    const heads: { x: number; y: number; k: number }[] = [];
    const stamps: Stamp[] = [];
    if (screen) this.drawFlow(c, t, heads);
    else {
      this.drawSheet(c, t, heads);
      this.drawGlove(c, t);
      if (t >= this.tStamp) {
        const k = prog(t, this.tStamp, this.tStamp + 0.06, ease.outQuad);
        this.assetTag(c, 190, ROW(2) - 30, -0.06, k);
      }
    }
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    this.paper.render(this.ctx.renderer, L.upload(), m, cam.z, out, { stamps, heads: heads.map((h) => ({ ...applyXf(m, h.x, h.y), k: h.k, r: 4 * cam.z })), screen });
    this.hud.clear();
    this.drawHud(this.hud.ctx, t, m, screen);
    this.ctx.comp.draw(this.ctx.renderer, this.hud.upload(), out);
    return screen ? SCREEN_POST : PAPER_POST;
  }

  sheetCam(t: number): Cam {
    // held up: the whole sheet in the hand, a slight sway; in on the fields as they are written
    const sway = 0.006 * Math.sin(t * 1.3);
    const whole: Cam = { x: -30, y: 40, z: 0.82, r: -0.05 + sway };
    let c = lerpCam({ ...whole, z: 0.74, y: 90 }, whole, prog(t, this.T0, this.T0 + 1.2, ease.outCubic));
    c = lerpCam(c, { x: 40, y: ROW(0) - 30, z: 1.5, r: -0.03 + sway }, prog(t, this.L5.start - 0.1, this.L5.start + 0.35, ease.outExpo));
    c = lerpCam(c, { x: -60, y: ROW(1) - 60, z: 1.75, r: -0.025 + sway }, prog(t, this.tJi0 - 0.12, this.tJi0 + 0.2, ease.outExpo));
    c = lerpCam(c, { x: -10, y: ROW(1) - 20, z: 1.3, r: -0.03 + sway }, prog(t, this.tJi1 + 0.4, this.tN2, ease.inOutCubic));
    if (t >= this.tN3) {
      const s: Cam = { x: 60, y: ROW(2) - 20, z: 1.35, r: -0.02 };
      c = lerpCam(s, { ...s, z: 1.2, y: ROW(2) + 40 }, prog(t, this.tX, this.T1, ease.inOutQuad));
      c.z *= 1 + 0.05 * pulse(t, this.tStamp, 0.09);
    }
    return c;
  }

  drawSheet(c: Ctx2, t: number, heads: { x: number; y: number; k: number }[]) {
    const { x0, y0, x1, y1 } = SHEET;
    c.strokeStyle = INK(0.7); c.lineWidth = 1.3; c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    c.fillStyle = PRINT(0.3); c.fillRect(x0 + 8, y1, x1 - x0, 8); c.fillRect(x1, y0 + 8, 8, y1 - y0);
    // the red head (红头): issuer anonymised, double rule
    c.fillStyle = RED(1);
    c.textAlign = 'center';
    c.font = font(F.song(900), 46);
    c.fillText('××社区疫情防控工作组', 0, y0 + 110);
    c.fillRect(x0 + 50, y0 + 140, x1 - x0 - 100, 4);
    c.fillRect(x0 + 50, y0 + 150, x1 - x0 - 100, 1.5);
    c.fillStyle = INK(0.95);
    c.font = font(F.song(700), 52);
    c.fillText('处 置 告 知 书', 0, y0 + 230);
    c.textAlign = 'left';
    c.fillStyle = INK(0.8);
    label(c, '编号 0471', x1 - 50, y0 + 275, 18, 500, 3, 'right');
    c.fillStyle = INK(0.88);
    c.font = font(F.fang(), 26);
    c.fillText('根据防控工作需要，依照标准流程，', x0 + 60, y0 + 330);
    c.fillText('对下列对象进行处置。', x0 + 60, y0 + 372);
    // the fields
    const fields: [string, string][] = [['对象', ''], ['处置日期', '即日'], ['处置方式', ''], ['住户意见', '（无需填写）']];
    fields.forEach(([k, v], i) => {
      const y = ROW(i);
      c.fillStyle = INK(0.75); c.font = font(F.hei(500), 24); c.fillText(k, x0 + 60, y);
      c.fillStyle = INK(0.35); c.fillRect(x0 + 200, y + 12, x1 - x0 - 260, 1.2);
      c.fillStyle = INK(0.9); c.font = font(F.fang(), 28);
      if (v) c.fillText(v, x0 + 220, y);
    });
    // 对象: typed on 喵喵
    {
      const s = '猫 · 名“喵喵”';
      const n = Math.floor(Array.from(s).length * prog(t, this.tName0 - 0.35, this.tName1 + 0.05));
      c.fillStyle = INK(0.92); c.font = font(F.fang(), 28);
      c.fillText(Array.from(s).slice(0, n).join(''), x0 + 220, ROW(0));
    }
    // 处置方式: the options (one gets an X on 处理)
    const opts = ['隔离观察', '寄养', '无害化处理'];
    let ox = x0 + 220;
    c.font = font(F.hei(400), 22);
    opts.forEach((o, i) => {
      c.strokeStyle = INK(0.8); c.lineWidth = 1.4;
      c.strokeRect(ox, ROW(2) - 20, 22, 22);
      c.fillStyle = INK(0.85); c.fillText(o, ox + 30, ROW(2));
      if (i === 2 && t >= this.tX) { c.fillStyle = INK(0.95); c.font = font(F.mono(700), 30); c.fillText('X', ox + 2, ROW(2) + 2); c.font = font(F.hei(400), 22); }
      ox += 30 + measure(o, F.hei(400), 22) + 40;
    });
    // footer: signature lines, the date
    c.fillStyle = INK(0.75); c.font = font(F.hei(500), 22);
    c.fillText('执行人', x0 + 60, y1 - 170); c.fillText('签收', x0 + 480, y1 - 170);
    c.fillStyle = INK(0.35); c.fillRect(x0 + 150, y1 - 158, 260, 1); c.fillRect(x0 + 550, y1 - 158, 260, 1);
    c.fillStyle = INK(0.6); c.font = font(F.hei(400), 16); c.fillText('（防护着装，免签）', x0 + 160, y1 - 128);
    c.fillStyle = INK(0.3); greek(c, x0 + 60, y1 - 70, x1 - x0 - 120, 1, 0, 7, 77);
    // 忌日: the red line strikes the printed label and writes the word above it
    const y = ROW(1);
    const sk = prog(t, this.tJi0, this.tJi0 + 0.18, ease.outCubic);
    if (sk > 0) {
      c.fillStyle = RED(1);
      c.fillRect(x0 + 52, y - 9, 116 * sk, 3.5);
      if (sk < 1) heads.push({ x: x0 + 52 + 116 * sk, y: y - 8, k: 1 });
      // the caret, then the word by hand (KaiTi), wiped in
      const wk = prog(t, this.tJi0 + 0.16, this.tJi1, ease.inOutQuad);
      if (wk > 0) {
        c.strokeStyle = RED(1); c.lineWidth = 2.5;
        c.beginPath(); c.moveTo(x0 + 92, y + 4); c.lineTo(x0 + 104, y - 22); c.lineTo(x0 + 116, y + 4); c.stroke();
        c.save();
        c.beginPath(); c.rect(x0 + 50, y - 110, 150 * wk, 90); c.clip();
        c.fillStyle = RED(1);
        c.font = font(F.kai(), 54);
        c.save(); c.translate(x0 + 58, y - 36); c.rotate(-0.06); c.fillText('忌日', 0, 0); c.restore();
        c.restore();
        if (wk < 1) heads.push({ x: x0 + 58 + 120 * wk, y: y - 52, k: 1 });
      }
    }
  }

  /** 报废: an asset tag (固定资产标签) slapped onto the form: bar code, number, category. */
  assetTag(c: Ctx2, x: number, y: number, rot: number, k: number) {
    c.save();
    c.translate(x, y); c.rotate(rot); c.scale(lerp(1.15, 1, k), lerp(1.15, 1, k));
    c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(-230, -95, 460, 190); c.globalCompositeOperation = 'lighter';
    c.fillStyle = RED(1); c.fillRect(-230, -95, 460, 54);
    c.globalCompositeOperation = 'difference'; c.fillStyle = 'rgba(0,0,255,1)';
    c.font = font(F.hei(900), 34); c.fillText('报废物品 · 资产标签', -210, -56);
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = RED(1); c.lineWidth = 3; c.strokeRect(-230, -95, 460, 190);
    c.fillStyle = INK(0.95);
    for (let i = 0; i < 46; i++) if (hash(i, 61) > 0.35) c.fillRect(-210 + i * 6, -28, hash(i, 62) > 0.6 ? 4 : 2, 70);
    c.font = font(F.mono(600), 26); c.fillText('NO. 0471', 80, 0);
    c.font = font(F.hei(600), 22); c.fillText('类别：物品', 80, 36);
    c.restore();
  }

  /** A nitrile glove holding the sheet's lower-left edge (printed: slate). */
  drawGlove(c: Ctx2, t: number) {
    const gx = SHEET.x0 + 40, gy = SHEET.y1 - 40;
    c.save();
    c.translate(gx, gy); c.rotate(0.35 + 0.01 * Math.sin(t * 1.3));
    c.fillStyle = PRINT(0.95); c.strokeStyle = INK(0.6); c.lineWidth = 1.5;
    // the hand behind the sheet edge, thumb over it
    c.beginPath();
    c.moveTo(-260, 260); c.bezierCurveTo(-240, 120, -160, 40, -60, 30);
    c.bezierCurveTo(-10, 24, 40, 40, 70, 80);
    c.lineTo(110, 300); c.closePath();
    c.fill(); c.stroke();
    c.beginPath(); c.ellipse(-12, -6, 30, 58, 0.5, 0, TAU); c.fill(); c.stroke(); // the thumb, on the paper
    c.strokeStyle = INK(0.3); c.lineWidth = 1;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(-120 + i * 30, 90 + i * 4); c.quadraticCurveTo(-100 + i * 30, 150, -110 + i * 30, 200); c.stroke(); }
    // the cuff of the suit over the glove
    c.fillStyle = INK(0); c.strokeStyle = INK(0.55); c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-300, 240); c.lineTo(-180, 200); c.lineTo(-120, 340); c.stroke();
    c.restore();
  }

  // ------------------------------------------------------------------ N2: the SOP
  nodes() {
    const y = FLOW.y;
    return [
      { s: '入户', x: -760, y, kind: 'box' }, { s: '核查', x: -460, y, kind: 'box' }, { s: '住户同意？', x: -130, y, kind: 'dia' },
      { s: '捕捉', x: 240, y, kind: 'box' }, { s: '处置', x: 520, y, kind: 'box' }, { s: '归档', x: 800, y, kind: 'box' },
    ];
  }
  flowCam(t: number): Cam {
    // the whole chart in frame, a slow push
    return { x: 0, y: FLOW.y + 10, z: lerp(0.9, 0.95, prog(t, this.tN2, this.tN3, ease.inOutQuad)), r: 0 };
  }
  drawFlow(c: Ctx2, t: number, heads: { x: number; y: number; k: number }[]) {
    const ns = this.nodes();
    c.fillStyle = INK(0.85);
    label(c, '标准处置流程（SOP）· 第 3 版', -900, FLOW.y - 260, 22, 600, 5);
    ns.forEach((n, i) => {
      const lit = t >= (this.tNodes[i] ?? 1e9);
      c.strokeStyle = lit ? INK(0.95) : PRINT(0.8); c.lineWidth = lit ? 2.2 : 1.4;
      if (n.kind === 'box') c.strokeRect(n.x - 100, n.y - 46, 200, 92);
      else { c.beginPath(); c.moveTo(n.x, n.y - 90); c.lineTo(n.x + 130, n.y); c.lineTo(n.x, n.y + 90); c.lineTo(n.x - 130, n.y); c.closePath(); c.stroke(); }
      c.fillStyle = lit ? INK(1) : PRINT(0.9);
      c.font = font(F.hei(700), n.kind === 'dia' ? 26 : 32);
      c.textAlign = 'center'; c.fillText(n.s, n.x, n.y + 11); c.textAlign = 'left';
    });
    // the connectors (printed), and the decision: both branches to the same box
    c.strokeStyle = PRINT(0.8); c.lineWidth = 1.4; c.fillStyle = PRINT(0.8);
    const arrow = (ax: number, ay: number, bx: number, by: number) => { c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); arrowHead(c, bx, by, Math.atan2(by - ay, bx - ax), 12); };
    arrow(-660, FLOW.y, -560, FLOW.y); arrow(-360, FLOW.y, -260, FLOW.y);
    c.beginPath(); c.moveTo(-130, FLOW.y - 90); c.lineTo(-130, FLOW.y - 170); c.lineTo(240, FLOW.y - 170); c.lineTo(240, FLOW.y - 46); c.stroke(); arrowHead(c, 240, FLOW.y - 46, Math.PI / 2, 12);
    c.beginPath(); c.moveTo(-130, FLOW.y + 90); c.lineTo(-130, FLOW.y + 170); c.lineTo(240, FLOW.y + 170); c.lineTo(240, FLOW.y + 46); c.stroke(); arrowHead(c, 240, FLOW.y + 46, -Math.PI / 2, 12);
    c.fillStyle = INK(0.9); c.font = font(F.hei(500), 24);
    c.fillText('是', -110, FLOW.y - 180); c.fillText('否', -110, FLOW.y + 200);
    arrow(340, FLOW.y, 420, FLOW.y); arrow(620, FLOW.y, 700, FLOW.y);
    // the red line runs the procedure, one node per character
    const pts = [{ x: -860, y: FLOW.y }, { x: -760, y: FLOW.y }, { x: -460, y: FLOW.y }, { x: -130, y: FLOW.y }];
    c.strokeStyle = RED(1); c.lineWidth = 4;
    const full = route([...pts, { x: -130, y: FLOW.y - 170 }, { x: 240, y: FLOW.y - 170 }, { x: 240, y: FLOW.y }, { x: 520, y: FLOW.y }, { x: 800, y: FLOW.y }]);
    // route length at each node (入户, 核查, ◇, 捕捉 via the 是 branch, 处置, 归档): reached on its character
    const at = [100, 400, 730, 1440, 1720, 2000];
    let len = 0;
    this.tNodes.forEach((tn, i) => { if (t >= tn - 0.15) len = lerp(i ? at[i - 1]! : 0, at[i]!, prog(t, tn - 0.15, tn, ease.outCubic)); });
    const h = drawRoute(c, full, Math.min(full.total, len));
    if (len < full.total) heads.push({ x: h.x, y: h.y, k: 1 });
    // the 否 branch lights too, on 准: the decision decides nothing
    if (t >= (this.tNodes[3] ?? 1e9)) {
      const bk = prog(t, this.tNodes[3]!, this.tNodes[3]! + 0.25, ease.inOutQuad);
      const r2 = route([{ x: -130, y: FLOW.y }, { x: -130, y: FLOW.y + 170 }, { x: 240, y: FLOW.y + 170 }, { x: 240, y: FLOW.y }]);
      drawRoute(c, r2, r2.total * bk);
    }
  }

  drawHud(c: Ctx2, t: number, m: Xf, screen: number) {
    c.save();
    c.textBaseline = 'alphabetic';
    c.fillStyle = SYS.fg;
    chrome(c, t, screen ? '流程引擎 · 执行中 · 节点 ' + Math.min(6, this.tNodes.filter((x) => t >= x).length) + '/6' : '文书生成 · 处置告知书 · 0471');
    if (!screen) {
      // the hand correction, seen and dismissed
      if (t >= this.tJi1 - 0.1 && t < this.tN2) {
        const p = applyXf(m, SHEET.x0 + 50, ROW(1) - 110), q = applyXf(m, SHEET.x0 + 210, ROW(1) + 16);
        brackets(c, p.x, p.y, q.x - p.x, q.y - p.y, SYS.dim, prog(t, this.tJi1 - 0.1, this.tJi1 + 0.15), 14, 1.5);
        sysTag(c, '手写批注 · 无效 · 已忽略', p.x, p.y - 6, 'rgba(84,88,91,0.92)', '#fff', prog(t, this.tJi1, this.tJi1 + 0.5), 15);
      }
      if (t >= this.tN3) {
        sysPanel(c, 1400, 220, 420, '对象 0471 · 归类', [
          { k: '类别', v: '宠物 → 物品', t: this.tStamp + 0.1, red: true },
          { k: '状态', v: '已处置', t: this.tX + 0.3 },
        ], t);
      }
    }
    c.restore();
  }
}

// 图版 04 / 09 `chorus` — params { n: 1 | 2 }: the two choruses, one template (like the reference's hook).
// The choruses are the system's voice ("继续闹吧 …"): the person is watched, measured, scored, classified. Every
// lyric line is one shot (hard cuts on the beat) of one instrument of that evaluation:
//   tiles     — the surveillance wall: the visitor in every tile, the tiles doubling on the beat; a red focus frame
//   forecast  — 耐受度 over days, the red forecast to the 崩溃阈值 (n1: with betting odds; n2: 等待即可 · 无需处置;
//               later: 偏离预测, still holding)
//   views     — n1 观看人次 rolling up, 回放 ×12; n2 关注人数 rolling down to 0
//   meter     — 悲伤指数, the needle past the reference band
//   weapon    — 随身物品: 泪液 → 列为武器 · 威胁等级 低
//   form      — 诉求登记表: the 求饶 field struck in red, 冗余字段 · 已删除
//   music     — a staff, a note on each character; 旋律识别 · 匹配《标准流程》0.97
//   edit      — chorus 1's second half, one continuous editing desk: the crying is detected as 高光 and cut out
//               (你伤心了吗), sped up ×2 with a laugh track and sound effects (还不够滑稽), the tear slowed ×0.25
//               (你流泪了吗), titled 《闹剧》, exported and published, the plays counting up (像场闹剧)
//   avoid     — a top-down crowd: everyone's path bends round the visitor; the avoidance ring (red) widens:
//               周边回避率 98% · 无需干预 (只配别人嫌弃)
//   clips     — 谁会真的在意: the visitor's card, and on every character a news clipping slapped over it: the great
//               power rising, the decisive victory over the epidemic, and the comments that came after (都过去了 ·
//               向前看 · 别再提了), until the card is gone under them: 热搜 · 已撤下
//   cue       — 继续哭吧 (n1): the teleprompter: the visitor's suffering is a script: （哭） （哭得更大声） 观众：（笑）
//   drawer    — 继续闹吧 (n2): the card filed into a drawer of thousands like it (同类诉求 4,812 份), the drawer shut
//   stress    — 等着你自己先垮下去: the visitor as a loaded member: a mesh, cracks climbing from the feet: 安全系数 0.6 ·
//               处置：等待自行坍塌
//   rain      — 继续哭吧 (n2): a weather radar of tears: 橙色预警 · 局部有泪 · 无需带伞
//   code      — 你流泪了吗 (n2): crying detected, 情绪异常: the health code turns red: 禁止通行
//   battery   — 你还撑着么: 3 % left, 预计关机 23:10
//   chat      — 你还听着么: the visitor's messages, every one 已读, none answered: 对方已开启免打扰
// n1 (spectacle) is SCREEN: watched live. n2 (index) is PAPER: the same person, now index cards, numbered.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H } from '../engine/gl';
import { Lyrics, type Line } from '../engine/lyrics';
import { F, font } from '../engine/type';
import { clamp, ease, lerp, prog, pulse, hash, frameIdx, TAU, mod } from '../engine/util';
import { dayMinutes, Paper, PAPER_POST, SCREEN_POST, SYS, glowOn, glowOff, brackets, sysTag, sysPanel, INK, PRINT, RED, camXf, applyXf, label, route, drawRoute, drawFigure, greek, hatchRect, type Cam, type Ctx2, type Xf, type FigureKind, chrome } from './_archive';

type Gag = 'tiles' | 'forecast' | 'views' | 'meter' | 'weapon' | 'form' | 'music' | 'edit' | 'avoid' | 'clips' | 'cue' | 'drawer' | 'stress' | 'rain' | 'code' | 'battery' | 'chat';
const GAGS: Record<number, Gag[]> = {
  // chorus 1: watched live, then (你伤心了吗 …) cut into a comedy on the editing desk
  1: ['tiles', 'forecast', 'cue', 'views', 'edit', 'edit', 'edit', 'edit'],
  // (every idea in the film appears once: no instrument repeats between or within the choruses)
  2: ['drawer', 'stress', 'rain', 'weapon', 'meter', 'avoid', 'code', 'form', 'battery', 'clips', 'chat', 'music'],
};
interface Shot { line: Line; gag: Gag; t0: number; t1: number; k: number /* nth use of this gag */ }
type Heads = { x: number; y: number; k: number }[];

export default class Chorus extends Scene {
  ink = new Layer2D();
  hud = new Layer2D();
  paper = new Paper();
  n = 1;
  beat = 0.4;
  shots: Shot[] = [];

  override async init() {
    const { lyrics, audio } = this.ctx;
    this.n = this.ctx.params.n ?? 1;
    const b0 = Math.floor(audio.beatAt(this.ctx.start));
    this.beat = audio.timeOfBeat(b0 + 1) - audio.timeOfBeat(b0);
    const lines = lyrics.lines.filter((l) => l.start >= this.ctx.start - 0.05 && l.start < this.ctx.end);
    const gags = GAGS[this.n]!;
    const count: Record<string, number> = {};
    this.shots = lines.map((line, i) => {
      const gag = gags[i] ?? 'tiles';
      const k = (count[gag] = (count[gag] ?? -1) + 1);
      const t0 = i === 0 ? this.ctx.start : audio.timeOfBeat(Math.floor(audio.beatAt(line.start + 0.02)));
      return { line, gag, t0, t1: 0, k };
    });
    this.shots.forEach((s, i) => (s.t1 = this.shots[i + 1]?.t0 ?? this.ctx.end));
  }

  shotAt(t: number) { return this.shots.find((s) => t >= s.t0 && t < s.t1) ?? this.shots[this.shots.length - 1]!; }
  /** Sung characters of the shot's line so far (fractional). */
  sung(s: Shot, t: number) { return Lyrics.lineCharProgress(s.line, t); }
  charT(s: Shot, i: number) { return s.line.words[Math.min(i, s.line.words.length - 1)]!.start; }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const s = this.shotAt(t);
    const screen = this.n === 1 ? 1 : 0;
    const { audio } = this.ctx;
    // the camera: a slow push through the shot, a punch on every downbeat
    const local = prog(t, s.t0, s.t1);
    let punch = 0;
    for (const d of audio.downbeats) if (d <= t && d > t - 0.5 && d >= s.t0) punch = Math.max(punch, pulse(t, d, 0.08));
    const cam: Cam = s.gag === 'edit'
      ? { x: 0, y: [-110, -60, -255, -80][s.k] ?? 0, z: ([0.95, 0.92, 1.45, 0.95][s.k] ?? 1) * (1 + 0.03 * local) * (1 + 0.035 * punch), r: 0 }
      : { x: 0, y: 0, z: (1 + 0.05 * local) * (1 + 0.035 * punch), r: (hash(this.shots.indexOf(s), 3) - 0.5) * 0.03 };
    const ph = frameIdx(t);
    const amp = 10 * pulse(t, s.t0, 0.05);
    const m = camXf(cam, amp * (hash(ph, 1) - 0.5) * 2, amp * (hash(ph, 2) - 0.5) * 2);
    const L = this.ink;
    L.clear('#000');
    const c = L.ctx;
    c.globalCompositeOperation = 'lighter';
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    const heads: Heads = [];
    this.hud.clear();
    const hc = this.hud.ctx;
    hc.save(); hc.textBaseline = 'alphabetic';
    // the shot's instrument
    ({
      tiles: () => this.tiles(c, hc, t, s, m, heads),
      forecast: () => this.forecast(c, hc, t, s, m, heads),
      views: () => this.views(c, hc, t, s, m, heads),
      meter: () => this.meter(c, hc, t, s, m, heads),
      weapon: () => this.weapon(c, hc, t, s, m, heads),
      form: () => this.form(c, hc, t, s, m, heads),
      music: () => this.music(c, hc, t, s, m, heads),
      edit: () => this.edit(c, hc, t, s, m, heads),
      avoid: () => this.avoid(c, hc, t, s, m, heads),
      clips: () => this.clips(c, hc, t, s, m, heads),
      cue: () => this.cue(c, hc, t, s, m, heads),
      drawer: () => this.drawer(c, hc, t, s, m, heads),
      stress: () => this.stress(c, hc, t, s, m, heads),
      rain: () => this.rain(c, hc, t, s, m, heads),
      code: () => this.code(c, hc, t, s, m, heads),
      battery: () => this.battery(c, hc, t, s, m, heads),
      chat: () => this.chat(c, hc, t, s, m, heads),
    })[s.gag]();
    // chrome
    hc.fillStyle = SYS.fg;
    chrome(hc, t, this.n === 1 ? `情绪监测 · 来访人 0472 · 实时` : `档案 0472 · 归档评估`);
    hc.restore();
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';
    this.paper.render(this.ctx.renderer, L.upload(), m, cam.z, out, { heads: heads.map((h) => ({ ...applyXf(m, h.x, h.y), k: h.k, r: 4 })), screen });
    this.ctx.comp.draw(this.ctx.renderer, this.hud.upload(), out);
    return screen ? SCREEN_POST : PAPER_POST;
  }

  // ------------------------------------------------------------------ tiles: the wall (n1) / the cards (n2)
  tiles(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    const ch = this.sung(s, t);
    // how many: doubling on the characters, from where the previous use left off
    const base = 1, top = 64;
    const steps = Math.round(Math.log2(top / base));
    const step = Math.min(steps, Math.floor((ch / s.line.words.length) * (steps + 1) + 1e-6));
    const N = base * Math.pow(2, step);
    const focus = s.k === 2; // the last use: one tile, close, tears detected
    const cols = focus ? 1 : Math.ceil(Math.sqrt((N * 16) / 9)), rows = Math.ceil(N / cols);
    const AW = 1640, AH = 820;
    const tw = focus ? 900 : AW / cols, th = focus ? 620 : Math.min(AH / rows, tw * 0.62);
    const ox = -((focus ? tw : tw * cols) / 2), oy = -((focus ? th : th * rows) / 2) - 20;
    const card = this.n === 2;
    const kinds: FigureKind[] = ['adult', 'reach', 'adult', 'grab'];
    for (let i = 0; i < (focus ? 1 : N); i++) {
      const cx = ox + (i % cols) * tw, cy = oy + Math.floor(i / cols) * th;
      const pad = Math.max(2, tw * 0.04);
      const x = cx + pad, y = cy + pad, w = tw - pad * 2, h = th - pad * 2;
      if (card) {
        c.strokeStyle = INK(0.7); c.lineWidth = Math.max(0.6, w / 300);
        c.strokeRect(x, y, w, h);
        c.beginPath(); c.arc(x + w / 2, y + h - h * 0.08, Math.max(1, h * 0.03), 0, TAU); c.stroke();
        c.fillStyle = RED(0.9); label(c, `0472-${String(i + 1).padStart(2, '0')}`, x + w - w * 0.05, y + h * 0.14, Math.max(5, h * 0.08), 600, 0, 'right');
      } else {
        c.strokeStyle = PRINT(0.9); c.lineWidth = Math.max(0.6, w / 400);
        c.strokeRect(x, y, w, h);
        c.fillStyle = INK(0.7); label(c, `CAM ${String(7 + (i % 9)).padStart(2, '0')}`, x + w * 0.04, y + h * 0.12, Math.max(5, h * 0.07), 500, 0);
        // floor line
        c.fillStyle = PRINT(0.6); c.fillRect(x + w * 0.05, y + h * 0.86, w * 0.9, Math.max(0.5, h * 0.004));
      }
      const fh = h * (card ? 0.62 : 0.7);
      const fx = x + w * (card ? 0.32 : 0.35 + 0.3 * hash(i, 4)), fy = y + h * (card ? 0.82 : 0.86);
      drawFigure(c, kinds[(i + s.k) % 4]!, fx, fy, fh, { fill: PRINT(card ? 0.35 : 0.7), stroke: INK(0.9), lw: Math.max(0.6, fh / 300) }, hash(i, 9) > 0.5 ? 1 : -1);
      // tears: a drop at the head (n2: a stain on the card)
      if ((s.k >= 1) && hash(i, 11) < (focus ? 1 : 0.5)) {
        const tt = this.charT(s, 2);
        if (t >= tt) {
          c.fillStyle = card ? INK(0.25) : RED(0.9);
          const r = card ? h * 0.12 : fh * 0.03;
          c.beginPath(); c.arc(fx + fh * 0.05, card ? y + h * 0.4 : fy - fh * 0.8, r, 0, TAU); c.fill();
        }
      }
    }
    // the system's focus: a red frame that jumps tile to tile on the characters
    const fi = focus ? 0 : Math.floor(hash(Math.floor(ch), s.k + 1) * N);
    const fx2 = ox + (fi % cols) * tw, fy2 = oy + Math.floor(fi / cols) * th;
    c.strokeStyle = RED(1); c.lineWidth = Math.max(2, tw / 120);
    c.strokeRect(fx2 + 1, fy2 + 1, tw - 2, th - 2);
    const a = applyXf(m, fx2, fy2);
    const tag = focus ? (this.n === 1 ? '泪液 · 检出 · 0.93' : '泪痕 · 已归档') : this.n === 1 ? ['情绪 · 激动', '情绪 · 失控', '情绪 · 表演'][s.k] ?? '' : ['档案 · 复制', '档案 · 复制 ×64', ''][s.k] ?? '';
    glowOn(hc, 0.8);
    sysTag(hc, tag, a.x, a.y - 4, SYS.red, '#fff', 1, 15);
    glowOff(hc);

  }

  // ------------------------------------------------------------------ forecast: how long until you break (hours of today)
  forecast(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    const X0 = -760, X1 = 360, Y0 = 300, Y1 = -320; // 08:00..24:00, 耐受度 1..0
    const dx = (h: number) => lerp(X0, X1, (h - 8) / 16), dy = (v: number) => lerp(Y0, Y1, v);
    c.strokeStyle = INK(0.85); c.lineWidth = 1.8;
    c.beginPath(); c.moveTo(X0, Y1 - 20); c.lineTo(X0, Y0); c.lineTo(X1 + 20, Y0); c.stroke();
    c.fillStyle = INK(0.85);
    for (let h = 8; h <= 24; h += 4) { c.fillRect(dx(h), Y0, 1.5, 10); label(c, `${String(h).padStart(2, '0')}:00`, dx(h), Y0 + 40, 22, 500, 0, 'center'); }
    c.font = font(F.hei(600), 28); c.fillText('耐受度', X0 - 10, Y1 - 44);
    c.strokeStyle = PRINT(0.9); c.setLineDash([12, 9]);
    c.beginPath(); c.moveTo(X0, dy(0.2)); c.lineTo(X1, dy(0.2)); c.stroke(); c.setLineDash([]);
    c.fillStyle = PRINT(1); c.font = font(F.hei(600), 24); c.fillText('崩溃阈值', X1 - 110, dy(0.2) - 14);
    // observed (ink) from the morning to now
    const now = dayMinutes(t) / 60;
    const holding = this.n === 2 && s.k === 1; // late in the evening, still above the line
    const obs = (h: number) => 0.95 - 0.07 * (h - 8) + 0.03 * Math.sin(h * 2.3) + (holding && h > 19 ? 0.06 * (h - 19) : 0);
    const k = prog(t, s.t0, this.charT(s, 3));
    c.strokeStyle = INK(0.95); c.lineWidth = 3;
    c.beginPath();
    for (let h = 8; h <= lerp(8, now, k); h += 0.1) { const x = dx(h), y = dy(obs(h)); h === 8 ? c.moveTo(x, y) : c.lineTo(x, y); }
    c.stroke();
    c.fillStyle = INK(0.5); c.fillRect(dx(now), Y1, 1.5, Y0 - Y1);
    c.fillStyle = INK(0.95); label(c, '现在', dx(now), Y1 - 14, 22, 600, 0, 'center');
    // the forecast (red), from now down to the threshold
    const cross = this.n === 1 ? 17 + 20 / 60 : holding ? 21 : 21;
    const fk = prog(t, this.charT(s, 3), this.charT(s, s.line.words.length - 2), ease.inOutQuad);
    if (fk > 0 && !holding) {
      const fc = (h: number) => obs(now) - ((obs(now) - 0.2) * (h - now)) / (cross - now);
      const hEnd = lerp(now, Math.min(24, cross + 1.5), fk);
      c.strokeStyle = RED(1); c.lineWidth = 4; c.setLineDash([18, 10]);
      c.beginPath(); c.moveTo(dx(now), dy(obs(now)));
      for (let h = now; h <= hEnd; h += 0.05) c.lineTo(dx(h), dy(Math.max(0, fc(h))));
      c.stroke(); c.setLineDash([]);
      heads.push({ x: dx(hEnd), y: dy(Math.max(0, fc(hEnd))), k: fk < 1 ? 1 : 0 });
      if (hEnd >= cross) {
        c.fillStyle = RED(1);
        c.beginPath(); c.arc(dx(cross), dy(0.2), 11, 0, TAU); c.fill();
        c.font = font(F.hei(800), 34); c.fillText(this.n === 1 ? '预计崩溃 17:20' : '预计自行放弃 21:00', dx(cross) - 120, dy(0.2) + 60);
      }
    }
    if (holding) {
      // the forecast was 21:00; it is past that, and the line is still above the threshold
      c.strokeStyle = PRINT(1); c.lineWidth = 2; c.setLineDash([10, 8]);
      c.beginPath(); c.moveTo(dx(19.5), dy(obs(19.5))); c.lineTo(dx(21), dy(0.2)); c.stroke(); c.setLineDash([]);
      c.fillStyle = RED(1); c.beginPath(); c.arc(dx(now), dy(obs(now)), 11, 0, TAU); c.fill();
      heads.push({ x: dx(now), y: dy(obs(now)), k: 1 });
    }
    const tl = (i: number) => this.charT(s, i);
    const rows = this.n === 1
      ? [{ k: '撑到 14:00', v: '赔率 1.8', t: tl(3) }, { k: '撑到 17:00', v: '赔率 2.6', t: tl(5) }, { k: '撑到 20:00', v: '赔率 9.0', t: tl(7), red: true }]
      : !holding
        ? [{ k: '预计自行放弃', v: '21:00', t: tl(5) }, { k: '处置', v: '等待即可', t: tl(9), red: true }]
        : [{ k: '偏离预测', v: '+2 小时', t: tl(1), red: true }, { k: '处置', v: '持续观察', t: tl(3) }];
    sysPanel(hc, 1360, 300, 400, this.n === 1 ? '盘口 · 撑到几时' : '预测 · 来访人 0472', rows, t, 18);
  }

  // ------------------------------------------------------------------ views: who is watching (n1) / who cares (n2)
  views(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    const k = ease.inOutCubic(prog(t, s.line.start, s.line.end));
    const v = Math.round(this.n === 1 ? lerp(3, 1204, k) : lerp(1204, 0, k));
    const title = this.n === 1 ? '观看人次' : '关注人数';
    c.fillStyle = INK(0.85); c.font = font(F.hei(500), 30); c.fillText(title, -760, -230);
    c.fillStyle = INK(0.98); c.font = font(F.mono(500), 240);
    c.fillText(v.toLocaleString('en-US'), -775, 20);
    // the sparkline: up and up (n1), down to a flat line (n2)
    c.strokeStyle = RED(1); c.lineWidth = 3;
    c.beginPath();
    const n = 60;
    for (let i = 0; i <= n * k; i++) {
      const u = i / n;
      const val = this.n === 1 ? Math.pow(u, 1.6) + 0.04 * Math.sin(i * 1.7) : Math.max(0, 1 - Math.pow(u, 0.6)) + 0.03 * Math.sin(i * 2.1) * (1 - u);
      const x = -760 + u * 1500, y = 300 - val * 180;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
      if (i === Math.floor(n * k)) heads.push({ x, y, k: k < 1 ? 1 : 0 });
    }
    c.stroke();
    c.fillStyle = PRINT(0.9); c.fillRect(-760, 300, 1500, 1.5);
    if (this.n === 1) {
      // the same clip, replayed: loop markers on a timeline
      for (let i = 0; i < 12; i++) {
        const on = prog(t, lerp(s.line.start, s.line.end, i / 12), lerp(s.line.start, s.line.end, i / 12) + 0.1);
        if (on <= 0) continue;
        c.strokeStyle = INK(0.7 * on); c.lineWidth = 1.2;
        c.strokeRect(-760 + i * 125, 360, 110, 40);
        c.fillStyle = INK(0.7 * on); label(c, '同一片段', -760 + i * 125 + 55, 386, 12, 500, 0, 'center');
      }
      sysPanel(hc, 1400, 240, 400, '片段 · 来访人 0472', [{ k: '回放次数', v: '×12', t: this.charT(s, 3) }, { k: '推荐', v: '继续播放', t: this.charT(s, 7), red: true }], t, 18);
    } else {
      sysPanel(hc, 1400, 240, 400, '关注 · 来访人 0472', [{ k: '评论', v: '已关闭', t: this.charT(s, 4) }, { k: '在意的人', v: '0', t: this.charT(s, 7), red: true }], t, 18);
    }
  }

  // ------------------------------------------------------------------ meter: 悲伤指数
  meter(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    const cx = -150, cy = 220, R = 420;
    c.strokeStyle = INK(0.9); c.lineWidth = 2;
    c.beginPath(); c.arc(cx, cy, R, Math.PI, TAU); c.stroke();
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI + (i / 20) * Math.PI, l = i % 5 === 0 ? 30 : 14;
      c.beginPath(); c.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); c.lineTo(cx + Math.cos(a) * (R - l), cy + Math.sin(a) * (R - l)); c.stroke();
      if (i % 5 === 0) { c.fillStyle = INK(0.85); label(c, (i / 20).toFixed(2), cx + Math.cos(a) * (R + 36), cy + Math.sin(a) * (R + 36) + 5, 15, 500, 0, 'center'); }
    }
    // the reference band (normal): printed, hatched
    c.strokeStyle = PRINT(0.9); c.lineWidth = 26;
    c.beginPath(); c.arc(cx, cy, R - 60, Math.PI + 0.2 * Math.PI, Math.PI + 0.4 * Math.PI); c.stroke();
    c.fillStyle = PRINT(1); c.font = font(F.hei(500), 18); c.fillText('参考区间', cx - R + 20, cy - 280);
    const v = lerp(0.12, this.n === 1 ? 0.91 : 0.97, ease.outBack(prog(t, this.charT(s, 1), this.charT(s, 3) + 0.2), 1.3));
    const a = Math.PI + clamp(v, 0, 1.02) * Math.PI;
    c.strokeStyle = RED(1); c.lineWidth = 5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * (R - 40), cy + Math.sin(a) * (R - 40)); c.stroke();
    c.fillStyle = RED(1); c.beginPath(); c.arc(cx, cy, 14, 0, TAU); c.fill();
    c.fillStyle = INK(0.98); c.font = font(F.mono(500), 120); c.textAlign = 'center'; c.fillText(v.toFixed(2), cx, cy + 150); c.textAlign = 'left';
    c.fillStyle = INK(0.85); c.font = font(F.hei(500), 30); c.textAlign = 'center'; c.fillText('悲伤指数', cx, cy - 120); c.textAlign = 'left';
    sysPanel(hc, 1400, 300, 420, '情绪评估', [{ k: '判定', v: this.n === 1 ? '情绪化' : '已稳定', t: this.charT(s, 3), red: true }, { k: '建议', v: this.n === 1 ? '冷处理' : '无需响应', t: this.charT(s, 4) }], t, 18);
  }

  // ------------------------------------------------------------------ weapon: tears listed as a weapon
  weapon(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    c.fillStyle = INK(0.92); c.font = font(F.song(700), 40); c.fillText('随身物品检查 · 0472', -760, -300);
    c.fillStyle = INK(0.5); c.fillRect(-760, -270, 1100, 1.5);
    const rows: [string, string][] = [['手机', '1'], ['身份证件', '1'], ['纸质材料', '12 份（已收悉）'], ['泪液', '']];
    rows.forEach(([k, v], i) => {
      const y = -190 + i * 100;
      if (t < this.charT(s, i * 2)) return;
      c.fillStyle = INK(0.88); c.font = font(F.hei(500), 32); c.fillText(k, -740, y);
      c.fillStyle = INK(0.92); c.font = font(F.fang(), 34); c.fillText(v, -400, y);
      c.fillStyle = INK(0.3); c.fillRect(-760, y + 26, 1100, 1);
    });
    const wt = Lyrics.phrase(s.line, '武器').start;
    // the evidence photo of a tear: a drop with a scale bar
    if (t >= this.charT(s, 6)) {
      c.strokeStyle = INK(0.85); c.lineWidth = 1.4; c.strokeRect(460, -230, 320, 380);
      c.fillStyle = PRINT(0.9);
      c.beginPath(); c.moveTo(620, -130); c.quadraticCurveTo(700, 10, 620, 40); c.quadraticCurveTo(540, 10, 620, -130); c.fill();
      c.fillStyle = INK(0.9); c.fillRect(500, 110, 100, 3); label(c, '1 mm', 550, 136, 13, 500, 0, 'center');
      label(c, '证物 04', 475, -205, 13, 600, 3);
    }
    if (t >= wt) {
      const k = prog(t, wt, wt + 0.25, ease.outCubic);
      c.fillStyle = RED(1); c.font = font(F.hei(900), 34);
      c.fillText('列为：武器'.slice(0, Math.ceil(5 * k)), -400, -190 + 300);
      c.strokeStyle = RED(1); c.lineWidth = 3; c.strokeRect(-770, -190 + 300 - 52, 1120, 78);
      sysPanel(hc, 1400, 560, 400, '风险登记 · 泪液', [{ k: '类别', v: '武器', t: wt + 0.15, red: true }, { k: '威胁等级', v: '低', t: wt + 0.4 }], t, 18);
    }
  }

  // ------------------------------------------------------------------ form: begging is a redundant field
  form(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    c.fillStyle = INK(0.92); c.font = font(F.song(700), 40); c.fillText('诉求登记表 · 第 4 版', -760, -320);
    const dt = Lyrics.phrase(s.line, '多余').start;
    const collapse = ease.inOutCubic(prog(t, dt + 0.35, dt + 0.75));
    const rows = ['姓名', '诉求', '求饶', '签字'];
    let y = -220;
    rows.forEach((k, i) => {
      const hgt = i === 2 ? lerp(120, 0, collapse) : 120;
      if (hgt < 2) { y += hgt; return; }
      c.save(); c.beginPath(); c.rect(-800, y - 60, 1700, hgt); c.clip();
      c.fillStyle = INK(0.85); c.font = font(F.hei(500), 32); c.fillText(k, -760, y);
      c.fillStyle = INK(0.35); c.fillRect(-560, y + 14, 1000, 1.2);
      c.fillStyle = INK(0.9); c.font = font(F.fang(), 32);
      if (i === 0) c.fillText('0472', -540, y);
      if (i === 1) { c.fillStyle = INK(0.35); greek(c, -540, y, 900, 1, 0, 9, 41); }
      if (i === 2) {
        const qt = Lyrics.phrase(s.line, '求饶').start;
        const n = Math.floor(6 * prog(t, qt, qt + 0.4));
        c.fillStyle = INK(0.9); c.font = font(F.kai(), 36);
        c.fillText('求求你们……'.slice(0, n), -540, y);
        const sk = prog(t, dt, dt + 0.2, ease.outCubic);
        if (sk > 0) { c.fillStyle = RED(1); c.fillRect(-780, y - 12, 1260 * sk, 4); if (sk < 1) heads.push({ x: -780 + 1260 * sk, y: y - 10, k: 1 }); }
      }
      c.restore();
      y += hgt;
    });
    if (t >= dt) {
      const a = applyXf(m, 520, -110);
      glowOn(hc, 1);
      sysTag(hc, '冗余字段 · 已删除（第 5 版）', a.x, a.y, SYS.red, '#fff', prog(t, dt, dt + 0.4), 18);
      glowOff(hc);
    }
  }

  // ------------------------------------------------------------------ music: despair, recognised as a melody
  music(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    const morph = ease.inOutCubic(prog(t, s.t0, s.t0 + 0.6));
    c.strokeStyle = INK(0.9 * morph); c.lineWidth = 1.5;
    for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(-760, -80 + i * 40); c.lineTo(-760 + 1500 * morph, -80 + i * 40); c.stroke(); }
    // notes on the sung characters
    s.line.words.forEach((w, i) => {
      if (t < w.start) return;
      const x = -700 + (i / s.line.words.length) * 1400, y = -80 + Math.round(hash(i, 21) * 8) * 20;
      c.fillStyle = INK(0.95);
      c.save(); c.translate(x, y); c.rotate(-0.35); c.beginPath(); c.ellipse(0, 0, 17, 12, 0, 0, TAU); c.fill(); c.restore();
      c.fillRect(x + 15, y - 110, 3, 110);
    });
    const xt = Lyrics.phrase(s.line, '旋律').start;
    if (t >= xt) {
      c.strokeStyle = RED(1); c.lineWidth = 3; c.strokeRect(-780, -150, 1540 * prog(t, xt, xt + 0.3, ease.outCubic), 300);
      sysPanel(hc, 1360, 600, 420, '旋律识别', [{ k: '匹配', v: '《标准流程》', t: xt + 0.1, red: true }, { k: '置信度', v: '0.97', t: xt + 0.4 }], t, 18);
    }
    c.fillStyle = INK(0.9); c.font = font(F.song(700), 40); c.fillText('旋律识别 · 来访人 0472', -760, -300);
  }
  // ------------------------------------------------------------------ edit: suffering cut into a comedy
  edit(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    const group = this.shots.filter((x) => x.gag === 'edit');
    const g0 = group[0]!, g1 = group[1], g2 = group[2], g3 = group[3];
    const st = (sh: Shot | undefined) => sh?.line.start ?? 1e9;
    const V = { x0: -420, y0: -470, x1: 420, y1: -40 };      // the viewer
    const TL = { x0: -800, x1: 800, y0: 40 };                 // the timeline
    const trackY = (i: number) => TL.y0 + 40 + i * 78;
    // ---- the desk
    c.strokeStyle = INK(0.85); c.lineWidth = 2;
    c.strokeRect(V.x0, V.y0, V.x1 - V.x0, V.y1 - V.y0);
    c.fillStyle = INK(0.85); label(c, '预览', V.x0, V.y0 - 16, 22, 600, 4);
    c.strokeStyle = PRINT(0.9); c.lineWidth = 1.2;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(TL.x0, trackY(i) + 30); c.lineTo(TL.x1, trackY(i) + 30); c.stroke(); }
    const names = ['画面', '原声', '笑声', '特效'];
    names.forEach((n, i) => { c.fillStyle = INK(0.85); c.font = font(F.hei(600), 24); c.fillText(n, TL.x0 - 90, trackY(i) + 10); });
    // ---- the clip and the cut
    const hl = { x0: -260, x1: 180 };                        // the "highlight": the crying
    const kCut = prog(t, st(g0) + 0.3, g0.line.end, ease.inOutQuad);
    const kStretchFast = prog(t, st(g1), st(g1) + 0.5, ease.outCubic); // ×2: the segment halves
    const kSlow = prog(t, st(g2), st(g2) + 0.5, ease.outCubic);        // ×0.25: one moment stretched
    const fastW = lerp(hl.x1 - hl.x0, (hl.x1 - hl.x0) / 2, kStretchFast);
    c.fillStyle = PRINT(0.55); c.fillRect(TL.x0, trackY(0) - 10, 1600, 34);
    if (kCut > 0) {
      c.fillStyle = INK(0.85); c.fillRect(hl.x0, trackY(0) - 10, fastW, 34);
      c.fillStyle = RED(1);
      c.fillRect(hl.x0 - 2, trackY(0) - 40, 4, 360 * Math.min(1, kCut * 2));
      c.fillRect(hl.x0 + fastW - 2, trackY(0) - 40, 4, 360 * Math.min(1, Math.max(0, kCut * 2 - 1)));
    }
    if (kSlow > 0) {
      // one frame of the tear, stretched ×4 after the segment
      c.fillStyle = INK(0.6); c.fillRect(hl.x0 + fastW + 8, trackY(0) - 10, 260 * kSlow, 34);
      c.fillStyle = RED(1); label(c, '×0.25', hl.x0 + fastW + 20, trackY(0) + 14, 22, 700, 1);
    }
    if (kStretchFast > 0) { c.fillStyle = RED(1); label(c, '×2.0', hl.x0 + 10, trackY(0) - 22, 22, 700, 1); }
    // the original sound: the voice (the song's own vocal)
    c.fillStyle = PRINT(0.95);
    for (let i = 0; i < 160; i++) {
      const tt = g0.t0 + (i / 160) * 12;
      const v = this.ctx.audio.env('vocal', tt) * (0.6 + 0.4 * hash(i, 8));
      c.fillRect(TL.x0 + i * 10, trackY(1) + 8 - v * 28, 6, v * 56);
    }
    // the laugh track: a block lands on each character of 这副样子还不够滑稽
    if (g1) g1.line.words.forEach((w, i) => {
      if (t < w.start) return;
      const k = prog(t, w.start, w.start + 0.1, ease.outCubic);
      c.fillStyle = RED(0.9); c.fillRect(TL.x0 + 160 + i * 150, trackY(2) - 10, 130 * k, 34);
      c.fillStyle = INK(1); c.font = font(F.hei(600), 18); if (k >= 1) c.fillText('哈哈哈', TL.x0 + 170 + i * 150, trackY(2) + 14);
    });
    // effects
    const fx: [string, number][] = [['音效 · 滑音', st(g1) + 0.6], ['音效 · 嘣', st(g1) + 1.4], ['字幕 · 《闹剧》', st(g3) + 0.4]];
    fx.forEach(([n, tf], i) => { if (t < tf) return; c.strokeStyle = INK(0.9); c.lineWidth = 2; c.strokeRect(TL.x0 + 200 + i * 470, trackY(3) - 10, 300, 34); c.fillStyle = INK(0.95); c.font = font(F.hei(600), 20); c.fillText(n, TL.x0 + 214 + i * 470, trackY(3) + 14); });
    // the playhead
    const ph = TL.x0 + ((t - g0.t0) / (this.shots[this.shots.length - 1]!.t1 - g0.t0)) * 1600;
    c.fillStyle = RED(1); c.fillRect(ph - 1.5, TL.y0, 3, 330);
    heads.push({ x: ph, y: TL.y0, k: 1 });
    // ---- the viewer: what is being made of the visitor
    c.save();
    c.beginPath(); c.rect(V.x0, V.y0, V.x1 - V.x0, V.y1 - V.y0); c.clip();
    c.fillStyle = PRINT(0.35); c.fillRect(V.x0, V.y1 - 60, V.x1 - V.x0, 2);
    const fast = t >= st(g1) && t < st(g2), slow = t >= st(g2) && t < st(g3);
    let fx2 = 0, fh = 330, fy = V.y1 - 58;
    if (fast) fx2 = Math.sin(t * 40) * 26 + Math.sin(t * 13) * 40;     // jerky, sped up
    if (slow) { fh = 900; fy = V.y1 + 560; }                          // in on the face, slowed
    drawFigure(c, fast && frameIdx(t) % 8 < 4 ? 'reach' : 'adult', fx2, fy, fh, { fill: PRINT(0.7), stroke: INK(0.95), lw: 2 });
    if (slow || t >= st(g0) + 0.6) {
      // the tear: falls (slowly, in slow motion)
      const tt = slow ? (t - st(g2)) * 0.25 : ((t - g0.t0) % 0.8);
      c.fillStyle = RED(1);
      const tx = fx2 + fh * 0.06, ty = fy - fh * 0.9 + tt * (slow ? 600 : 160);
      c.beginPath(); c.arc(tx, ty, slow ? 14 : 5, 0, TAU); c.fill();
    }
    if (t >= st(g3)) {
      const k = prog(t, st(g3) + 0.4, st(g3) + 0.6, ease.outBack);
      c.save(); c.translate(0, -260); c.rotate(-0.06); c.scale(k, k);
      c.fillStyle = INK(1); c.font = font(F.song(900), 150); c.textAlign = 'center'; c.fillText('闹剧', 0, 50); c.textAlign = 'left';
      c.restore();
    }
    c.restore();
    if (fast) { c.fillStyle = RED(1); label(c, '×2', V.x1 - 24, V.y0 + 50, 44, 700, 0, 'right'); }
    if (slow) { c.fillStyle = RED(1); label(c, '×0.25', V.x1 - 24, V.y0 + 50, 44, 700, 0, 'right'); }
    // ---- the system: one line per shot
    const at = (x: number, y: number) => applyXf(m, x, y);
    if (s === g0 && kCut > 0.4) { const p = at(hl.x0, trackY(0) - 50); glowOn(hc, 1); sysTag(hc, '高光检测 · 哭泣 · 0.96', p.x, p.y, SYS.red, '#fff', prog(t, st(g0) + 0.6, st(g0) + 1.0), 17); glowOff(hc); }
    if (s === g1) { const p = at(V.x1 + 30, V.y0 + 60); sysTag(hc, '滑稽度不足 · 自动增强', p.x, p.y, 'rgba(84,88,91,0.94)', '#fff', prog(t, st(g1) + 0.2, st(g1) + 0.6), 17); }
    if (s === g2) { const p = at(V.x0, V.y0 - 40); glowOn(hc, 1); sysTag(hc, '泪滴 · 慢放 ×0.25', p.x, p.y, SYS.red, '#fff', prog(t, st(g2) + 0.2, st(g2) + 0.5), 17); glowOff(hc); }
    if (s === g3) {
      const tExp = st(g3) + 0.9;
      const ek = prog(t, tExp, tExp + 0.9, ease.inOutQuad);
      c.fillStyle = PRINT(0.6); c.fillRect(V.x0, V.y1 + 20, V.x1 - V.x0, 8);
      c.fillStyle = RED(1); c.fillRect(V.x0, V.y1 + 20, (V.x1 - V.x0) * ek, 8);
      sysPanel(hc, 1400, 300, 400, '导出 · 《闹剧》', [{ k: '状态', v: ek >= 1 ? '已发布' : `导出 ${Math.round(ek * 100)}%`, t: tExp, red: ek >= 1 }, { k: '推荐', v: '首页 · 精选', t: tExp + 0.9 }], t, 18);
    }
  }

  // ------------------------------------------------------------------ avoid: everyone keeps their distance
  avoid(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    const cx = -120, cy = 40;
    const R0 = 120, R1 = 430;
    const Rt = (tt: number) => lerp(R0, R1, ease.inOutCubic(prog(tt, s.line.start, s.line.end)));
    // a walker's position at time tt: a straight path, bent away from the visitor by the ring of that moment
    const pos = (i: number, tt: number) => {
      const a = hash(i, 1) * TAU, sp = 70 + 60 * hash(i, 2);
      const off = (hash(i, 3) - 0.5) * 900;
      const u = ((tt * sp + hash(i, 4) * 2400) % 2400) - 1200;
      let x = cx + Math.cos(a) * u - Math.sin(a) * off, y = cy + Math.sin(a) * u + Math.cos(a) * off;
      const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) || 1, Rr = Rt(tt);
      const nr = r + Rr * Math.exp(-r / Rr) * 1.1;
      x = cx + (dx / r) * nr; y = cy + (dy / r) * nr;
      return { x, y, wrap: u > 1100 || u < -1100 };
    };
    c.fillStyle = INK(0.9); c.font = font(F.song(700), 40); c.fillText('人流轨迹 · 广场', -760, -330);
    c.lineWidth = 1.6;
    for (let i = 0; i < 90; i++) {
      c.strokeStyle = PRINT(0.85);
      c.beginPath();
      let first = true;
      for (let k = 0; k <= 12; k++) {
        const p = pos(i, t - (12 - k) * 0.12);
        if (p.wrap) { first = true; continue; }
        if (first) { c.moveTo(p.x, p.y); first = false; } else c.lineTo(p.x, p.y);
      }
      c.stroke();
      const p = pos(i, t);
      c.fillStyle = INK(0.95); c.beginPath(); c.arc(p.x, p.y, 6, 0, TAU); c.fill();
    }
    // the visitor, and the ring nobody crosses
    c.fillStyle = RED(1); c.beginPath(); c.arc(cx, cy, 13, 0, TAU); c.fill();
    c.strokeStyle = RED(1); c.lineWidth = 3; c.setLineDash([14, 10]);
    c.beginPath(); c.arc(cx, cy, Rt(t), 0, TAU); c.stroke(); c.setLineDash([]);
    heads.push({ x: cx + Rt(t), y: cy, k: 1 });
    const p = applyXf(m, cx + Rt(t) * 0.7, cy - Rt(t) * 0.7);
    glowOn(hc, 1);
    sysTag(hc, `回避半径 ${(Rt(t) / 50).toFixed(1)} m`, p.x, p.y, SYS.red, '#fff', 1, 17);
    glowOff(hc);
    const q = applyXf(m, cx - 60, cy + 60);
    sysTag(hc, '来访人 0472', q.x, q.y + 40, 'rgba(84,88,91,0.94)', '#fff', 1, 15);
    sysPanel(hc, 1400, 260, 400, '周边人员', [{ k: '回避率', v: '98%', t: this.charT(s, 4), red: true }, { k: '建议', v: '无需干预', t: this.charT(s, 8) }], t, 18);
  }
  // ------------------------------------------------------------------ clips: who would really care
  clips(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    // the visitor's card, in the middle of the wall
    const card = { x0: -330, y0: -220, x1: 330, y1: 200 };
    c.strokeStyle = INK(0.85); c.lineWidth = 2; c.strokeRect(card.x0, card.y0, card.x1 - card.x0, card.y1 - card.y0);
    c.fillStyle = INK(0.92); c.font = font(F.song(700), 40); c.fillText('来访人登记卡', card.x0 + 30, card.y0 + 60);
    c.fillStyle = RED(1); label(c, '0472', card.x1 - 30, card.y0 + 56, 34, 600, 4, 'right');
    drawFigure(c, 'reach', card.x0 + 150, card.y1 - 40, 280, { fill: PRINT(0.45), stroke: INK(0.9), lw: 2 });
    c.fillStyle = INK(0.8); c.font = font(F.fang(), 30);
    c.fillText('诉求：我的猫', card.x0 + 300, card.y0 + 150); c.fillText('状态：待处理', card.x0 + 300, card.y0 + 210);
    // the clippings: headlines, then what people said afterwards
    const CL: { h: string; sub: string; kind: 'paper' | 'comment' }[] = [
      { h: '大国崛起', sub: '××日报 · 头版', kind: 'paper' },
      { h: '厉害了，我的国', sub: '××日报 · 要闻', kind: 'paper' },
      { h: '人民至上 生命至上', sub: '××日报 · 评论员文章', kind: 'paper' },
      { h: '都过去了', sub: '评论 · 2.3 万赞', kind: 'comment' },
      { h: '疫情防控取得重大决定性胜利', sub: '××日报 · 头版', kind: 'paper' },
      { h: '经济总量突破 120 万亿元', sub: '××日报 · 经济', kind: 'paper' },
      { h: '向前看', sub: '评论 · 1.1 万赞', kind: 'comment' },
      { h: '奋进新征程', sub: '××日报 · 头版', kind: 'paper' },
      { h: '别再提了', sub: '评论 · 8,402 赞', kind: 'comment' },
      { h: '中国式现代化', sub: '××日报 · 理论', kind: 'paper' },
      { h: '没有一个冬天不可逾越', sub: '××日报 · 副刊', kind: 'paper' },
      { h: '那三年，什么都没发生', sub: '评论 · 已折叠', kind: 'comment' },
      { h: '岁月静好', sub: '评论 · 3.6 万赞', kind: 'comment' },
      { h: '谁还记得这些', sub: '评论 · 已删除', kind: 'comment' },
    ];
    const n = s.line.words.length;
    CL.forEach((cl, i) => {
      // one per character, the rest in a rush after the last one
      const at = i < n ? this.charT(s, i) : lerp(s.line.end - 0.1, s.t1 - 0.2, (i - n) / Math.max(1, CL.length - n));
      if (t < at) return;
      const k = prog(t, at, at + 0.09, ease.outBack);
      const big = cl.kind === 'paper' && cl.h.length <= 6;
      const fs2 = cl.kind === 'comment' ? 54 : big ? 96 : 64;
      c.font = font(cl.kind === 'comment' ? F.hei(800) : F.song(900), fs2);
      const tw = c.measureText(cl.h).width;
      const w = Math.max(300, tw + 80), h = fs2 + 110;
      const cx = (hash(i, 31) - 0.5) * 1000, cy = (hash(i, 32) - 0.5) * 520;
      const rot = (hash(i, 33) - 0.5) * 0.22;
      c.save();
      c.translate(cx, cy); c.rotate(rot); c.scale(lerp(1.25, 1, k), lerp(1.25, 1, k));
      // a cut-out covers what is under it
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#000'; c.fillRect(-w / 2, -h / 2, w, h);
      c.globalCompositeOperation = 'lighter';
      if (cl.kind === 'paper') {
        c.strokeStyle = INK(0.5); c.lineWidth = 1.2; c.strokeRect(-w / 2, -h / 2, w, h);
        c.fillStyle = INK(0.7); c.font = font(F.hei(600), 20); c.fillText(cl.sub, -w / 2 + 24, -h / 2 + 36);
        c.fillStyle = INK(0.3); c.fillRect(-w / 2 + 24, -h / 2 + 48, w - 48, 2);
        c.fillStyle = INK(0.97); c.font = font(F.song(900), fs2); c.textAlign = 'center';
        c.fillText(cl.h, 0, h / 2 - 38); c.textAlign = 'left';
      } else {
        c.fillStyle = PRINT(0.55); c.fillRect(-w / 2, -h / 2, w, h);
        c.fillStyle = INK(0.75); c.font = font(F.hei(500), 20); c.fillText(cl.sub, -w / 2 + 24, -h / 2 + 34);
        c.fillStyle = INK(0.97); c.font = font(F.hei(800), fs2); c.textAlign = 'center';
        c.fillText(cl.h, 0, h / 2 - 34); c.textAlign = 'left';
      }
      c.restore();
    });
    if (t >= s.t1 - 0.6) {
      glowOn(hc, 1);
      sysTag(hc, '相关话题 · 热搜已撤下', 1300, 980, SYS.red, '#fff', prog(t, s.t1 - 0.6, s.t1 - 0.3), 20);
      glowOff(hc);
    }
  }
  // ------------------------------------------------------------------ cue: the suffering, scripted
  cue(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    const lines = ['第 3 场 · 窗口前 · 日', '来访人：（哭）', '来访人：（哭得更大声）', '来访人：（停顿，再哭）', '观众：（笑）', '来访人：（继续哭）', '导演：情绪再饱满一点'];
    c.strokeStyle = INK(0.7); c.lineWidth = 2; c.strokeRect(-640, -400, 1280, 760);
    c.fillStyle = INK(0.8); label(c, '提 词 器', -620, -420, 24, 700, 6);
    // the script scrolls up one line per sung character pair; the current line under the red bar
    const ch = this.sung(s, t);
    const pos = Math.min(lines.length - 1, ch / 1.2);
    c.save(); c.beginPath(); c.rect(-640, -400, 1280, 760); c.clip();
    lines.forEach((l, i) => {
      const y = 20 + (i - pos) * 130;
      const cur = Math.abs(i - pos) < 0.5;
      c.fillStyle = INK(cur ? 1 : 0.35);
      c.font = font(i === 0 ? F.hei(600) : F.song(900), i === 0 ? 40 : 76);
      c.textAlign = 'center'; c.fillText(l, 0, y); c.textAlign = 'left';
    });
    c.restore();
    c.fillStyle = RED(1); c.fillRect(-640, 40, 14, 90); c.fillRect(626, 40, 14, 90);
    heads.push({ x: -633, y: 85, k: 1 });
    const p = applyXf(m, 300, -370);
    glowOn(hc, 1); sysTag(hc, '节目效果 · 待加强', p.x, p.y, SYS.red, '#fff', prog(t, s.line.start + 0.4, s.line.start + 0.8), 17); glowOff(hc);
  }

  // ------------------------------------------------------------------ drawer: filed among thousands
  drawer(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    // the drawer in section: thousands of card edges, the visitor's card held above its slot
    const D = { x0: -760, x1: 760, y0: 40, y1: 360 };
    const shut = prog(t, this.charT(s, 3), this.charT(s, 3) + 0.25, ease.inOutCubic);
    const dx = 0;
    c.save(); c.translate(dx, 0);
    c.strokeStyle = INK(0.9); c.lineWidth = 3; c.strokeRect(D.x0, D.y0, D.x1 - D.x0, D.y1 - D.y0);
    c.strokeStyle = PRINT(0.85); c.lineWidth = 1.2;
    c.beginPath();
    for (let x = D.x0 + 8; x < D.x1 - 8; x += 6) { const h = 40 + 10 * hash(x, 2); c.moveTo(x, D.y0 + 20 - h * 0.2); c.lineTo(x, D.y1 - 6); }
    c.stroke();
    c.restore();
    // the card: lifted on 继, dropped on 续 (into the gap at x = 120)
    const up = prog(t, this.charT(s, 0), this.charT(s, 0) + 0.3, ease.outCubic);
    const down = prog(t, this.charT(s, 1), this.charT(s, 1) + 0.25, ease.inCubic);
    const cy = lerp(lerp(120, -260, up), 140, down);
    {
      c.save(); c.translate(120 + dx, cy);
      c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(-170, -120, 340, 240); c.globalCompositeOperation = 'lighter';
      c.strokeStyle = INK(0.9); c.lineWidth = 2; c.strokeRect(-170, -120, 340, 240);
      c.fillStyle = INK(0.9); c.font = font(F.song(700), 30); c.fillText('来访人登记卡', -150, -70);
      c.fillStyle = RED(1); label(c, '0472', 150, -72, 26, 600, 3, 'right');
      drawFigure(c, 'adult', -90, 100, 150, { fill: PRINT(0.45), stroke: INK(0.9), lw: 1.5 });
      c.restore();
    }
    // the drawer's front closes over it (from the left), and stays shut
    if (shut > 0) {
      const w = (D.x1 - D.x0 + 40) * shut;
      c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(D.x0 - 20, -180, w, 560); c.globalCompositeOperation = 'lighter';
      c.fillStyle = PRINT(0.55); c.fillRect(D.x0 - 20, -180, w, 560);
      c.strokeStyle = INK(0.9); c.lineWidth = 4; c.strokeRect(D.x0 - 20, -180, w, 560);
      if (shut >= 1) {
        c.strokeStyle = INK(0.9); c.lineWidth = 3; c.strokeRect(-200, -60, 400, 120);
        c.fillStyle = INK(0.95); c.font = font(F.hei(800), 40); c.textAlign = 'center'; c.fillText('诉求类 · 宠物处置', 0, 14); c.textAlign = 'left';
        c.fillStyle = INK(0.9); c.fillRect(-90, 120, 180, 26);
        c.fillStyle = INK(0.8); c.font = font(F.mono(600), 28); c.fillText('第 17 屉', -60, 220);
      }
    }
    const n = Math.round(lerp(4811, 4812, down));
    sysPanel(hc, 1360, 200, 420, '归档', [{ k: '同类诉求', v: `${n.toLocaleString('en-US')} 份`, t: this.charT(s, 1) }, { k: '处理', v: '无需处理', t: this.charT(s, 2), red: true }], t, 18);
  }

  // ------------------------------------------------------------------ stress: waiting for the collapse
  stress(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    const fx = -250, fy = 380, fh = 720;
    // the load: arrows pressing down on the shoulders
    c.strokeStyle = INK(0.85); c.fillStyle = INK(0.85); c.lineWidth = 3;
    for (let i = 0; i < 5; i++) { const x = fx - 120 + i * 60; c.beginPath(); c.moveTo(x, fy - fh - 160); c.lineTo(x, fy - fh - 40); c.stroke(); c.beginPath(); c.moveTo(x - 10, fy - fh - 56); c.lineTo(x, fy - fh - 36); c.lineTo(x + 10, fy - fh - 56); c.fill(); }
    // the member, meshed
    drawFigure(c, 'adult', fx, fy, fh, { fill: PRINT(0.35), stroke: INK(0.95), lw: 2.5 });
    c.save();
    c.beginPath(); c.rect(fx - 120, fy - fh - 20, 260, fh + 20); c.clip();
    c.strokeStyle = PRINT(0.6); c.lineWidth = 1;
    c.beginPath();
    for (let y = fy - fh; y < fy; y += 36) { c.moveTo(fx - 120, y); c.lineTo(fx + 140, y); }
    for (let x = fx - 120; x < fx + 140; x += 36) { c.moveTo(x, fy - fh); c.lineTo(x + 36, fy); }
    c.stroke();
    c.restore();
    // cracks: red, from the feet upward, one branch per character
    const k = this.sung(s, t) / s.line.words.length;
    c.strokeStyle = RED(1); c.lineWidth = 3.5; c.lineCap = 'round';
    for (let b = 0; b < 4; b++) {
      let x = fx + (b - 1.5) * 18, y = fy - 4;
      const len = clamp(k * 1.3 - b * 0.12) * fh * 0.85;
      c.beginPath(); c.moveTo(x, y);
      for (let d = 0; d < len; d += 24) { x += (hash(b, d, 3) - 0.5) * 30; y -= 24; c.lineTo(x, y); }
      c.stroke();
      if (b === 0) heads.push({ x, y, k: len > 0 && k < 1 ? 1 : 0 });
    }
    // the stress scale
    c.fillStyle = INK(0.9); c.font = font(F.song(700), 40); c.fillText('结构评估 · 来访人 0472', 180, -330);
    const sf = lerp(1.4, 0.6, clamp(k));
    c.fillStyle = sf < 1 ? RED(1) : INK(0.95); c.font = font(F.mono(600), 120); c.fillText(sf.toFixed(1), 180, -120);
    c.fillStyle = INK(0.8); c.font = font(F.hei(600), 30); c.fillText('安全系数', 180, -40);
    sysPanel(hc, 1360, 560, 420, '处置建议', [{ k: '预计', v: '自行坍塌', t: this.charT(s, 8), red: true }, { k: '人工干预', v: '不需要', t: this.charT(s, 10) }], t, 18);
  }

  // ------------------------------------------------------------------ rain: tears, as weather
  rain(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    const cx = -150, cy = 40;
    // isohyets round the visitor
    const k = prog(t, s.line.start, s.line.end);
    c.strokeStyle = PRINT(0.85); c.lineWidth = 1.6;
    for (let i = 1; i <= 7; i++) {
      c.beginPath();
      for (let a = 0; a <= TAU + 0.01; a += 0.1) {
        const r = i * 70 * (1 + 0.12 * Math.sin(a * 3 + i)) * (0.9 + 0.2 * k);
        const x = cx + Math.cos(a) * r * 1.4, y = cy + Math.sin(a) * r;
        a ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke();
    }
    // the rain itself: short slanted strokes, heavier near the centre, falling
    c.strokeStyle = INK(0.75); c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 260; i++) {
      const r = Math.pow(hash(i, 1), 1.6) * 520 * (0.4 + k), a = hash(i, 2) * TAU;
      const x = cx + Math.cos(a) * r * 1.4, y = cy + Math.sin(a) * r + ((t * 900 + hash(i, 3) * 400) % 80) - 40;
      c.moveTo(x, y); c.lineTo(x - 8, y + 22);
    }
    c.stroke();
    c.fillStyle = RED(1); c.beginPath(); c.arc(cx, cy, 12, 0, TAU); c.fill();
    c.fillStyle = INK(0.9); c.font = font(F.song(700), 40); c.fillText('降泪雷达 · 窗口 07 周边', -760, -330);
    c.fillStyle = INK(0.8); c.font = font(F.hei(600), 26); c.fillText(`泪量 ${Math.round(lerp(2, 38, k))} mm`, cx + 60, cy + 10);
    if (t >= this.charT(s, 2)) {
      const ks = prog(t, this.charT(s, 2), this.charT(s, 2) + 0.15, ease.outBack);
      c.save(); c.translate(420, -120); c.scale(ks, ks); c.rotate(-0.05);
      c.strokeStyle = RED(1); c.lineWidth = 5; c.strokeRect(-200, -90, 400, 180);
      c.fillStyle = RED(1); c.font = font(F.song(900), 62); c.textAlign = 'center'; c.fillText('橙色预警', 0, 0);
      c.font = font(F.hei(700), 30); c.fillText('局部有泪', 0, 56); c.textAlign = 'left';
      c.restore();
    }
    sysPanel(hc, 1360, 640, 420, '出行建议', [{ k: '带伞', v: '无需', t: this.charT(s, 3) }], t, 18);
  }

  // ------------------------------------------------------------------ code: crying turns the code red
  qr(c: Ctx2, x: number, y: number, size: number, color: (a: number) => string, seed: number) {
    const n = 25, cs = size / n;
    c.fillStyle = color(1);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const finder = (i < 8 && j < 8) || (i > n - 9 && j < 8) || (i < 8 && j > n - 9);
      if (finder) continue;
      if (hash(i, j, seed) > 0.52) c.fillRect(x + i * cs, y + j * cs, cs + 0.5, cs + 0.5);
    }
    for (const [fi, fj] of [[0, 0], [n - 7, 0], [0, n - 7]]) {
      c.fillRect(x + fi * cs, y + fj * cs, 7 * cs, 7 * cs);
      c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(x + (fi + 1) * cs, y + (fj + 1) * cs, 5 * cs, 5 * cs);
      c.globalCompositeOperation = 'lighter'; c.fillStyle = color(1); c.fillRect(x + (fi + 2) * cs, y + (fj + 2) * cs, 3 * cs, 3 * cs);
    }
  }
  code(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    const tr = Lyrics.phrase(s.line, '流泪').start;
    const red = t >= tr + 0.15;
    const k = prog(t, tr, tr + 0.3, ease.outCubic);
    c.strokeStyle = INK(0.7); c.lineWidth = 2; c.strokeRect(-330, -440, 660, 860);
    c.fillStyle = INK(0.9); c.font = font(F.hei(700), 36); c.textAlign = 'center'; c.fillText('通行码 · 来访人 0472', 0, -370);
    this.qr(c, -230, -320, 460, red ? RED : PRINT, 77);
    c.fillStyle = red ? RED(1) : INK(0.7); c.font = font(F.song(900), 96);
    c.fillText(red ? '禁止通行' : '正常', 0, 270);
    c.textAlign = 'left';
    if (red && k < 1) { c.strokeStyle = RED(1 - k); c.lineWidth = 8; c.strokeRect(-330 - 30 * k, -440 - 30 * k, 660 + 60 * k, 860 + 60 * k); }
    const p = applyXf(m, 360, -300);
    glowOn(hc, 1);
    sysTag(hc, '检测到流泪 · 情绪异常 · 赋码', p.x, p.y, SYS.red, '#fff', prog(t, tr, tr + 0.4), 18);
    glowOff(hc);
  }

  // ------------------------------------------------------------------ battery: still holding?
  battery(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    const k = this.sung(s, t) / s.line.words.length;
    const pct = Math.max(1, Math.round(lerp(12, 3, k)));
    c.strokeStyle = INK(0.95); c.lineWidth = 8; c.strokeRect(-560, -200, 1000, 400);
    c.fillStyle = INK(0.95); c.fillRect(440, -70, 50, 140);
    c.fillStyle = RED(1); c.fillRect(-540, -180, (960 * pct) / 100, 360);
    if (frameIdx(t) % 40 < 20) { c.fillStyle = RED(0.5); c.fillRect(-540 + (960 * pct) / 100, -180, 30, 360); }
    c.fillStyle = INK(0.98); c.font = font(F.mono(600), 180); c.fillText(`${pct}%`, -200, 70);
    c.fillStyle = INK(0.9); c.font = font(F.song(700), 40); c.fillText('来访人 0472 · 剩余电量', -560, -270);
    sysPanel(hc, 1360, 700, 420, '电源', [{ k: '低电量模式', v: '已开启', t: this.charT(s, 1) }, { k: '预计关机', v: '23:10', t: this.charT(s, 3), red: true }], t, 18);
  }

  // ------------------------------------------------------------------ chat: read, never answered
  chat(c: Ctx2, hc: Ctx2, t: number, s: Shot, m: Xf, heads: Heads) {
    const msgs = ['您好，想问一下我的猫', '处置的依据是什么？', '我可以先去看一眼吗', '你们还在吗', '求你们回一句'];
    c.strokeStyle = INK(0.7); c.lineWidth = 2; c.strokeRect(-420, -460, 840, 900);
    c.fillStyle = INK(0.9); c.font = font(F.hei(700), 32); c.textAlign = 'center'; c.fillText('窗口 07（工作群）', 0, -405); c.textAlign = 'left';
    c.fillStyle = INK(0.3); c.fillRect(-420, -380, 840, 1.5);
    msgs.forEach((msg, i) => {
      const tm = i < s.line.words.length ? this.charT(s, i) : s.line.end;
      if (t < tm) return;
      const y = -320 + i * 140;
      c.font = font(F.hei(500), 32);
      const w = c.measureText(msg).width + 56;
      c.globalCompositeOperation = 'source-over'; c.fillStyle = '#000'; c.fillRect(380 - w, y - 46, w, 74); c.globalCompositeOperation = 'lighter';
      c.fillStyle = PRINT(0.5); c.fillRect(380 - w, y - 46, w, 74);
      c.fillStyle = INK(0.97); c.fillText(msg, 380 - w + 28, y + 2);
      c.fillStyle = RED(1); c.font = font(F.hei(700), 22); c.textAlign = 'right'; c.fillText('已读', 370, y + 58); c.textAlign = 'left';
    });
    if (t >= s.line.end + 0.1) {
      c.fillStyle = INK(0.6); c.font = font(F.hei(500), 26); c.textAlign = 'center'; c.fillText('—— 对方已开启消息免打扰 ——', 0, 400); c.textAlign = 'left';
    }
  }
}

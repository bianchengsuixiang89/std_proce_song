// 图版 08 `bus` — 转运 / "开往贵州的大巴 · 最终会轮到你 · 一次撞击 · 一个坏了的玩具"
// Bone paper, four shots, hard cuts on the beat:
//   E. A window envelope (内部转运; red postcode boxes, 550000 written in by hand): the address shows in its
//      window, and the red line underlines 贵州 as it is sung; the camera pushes into the window and, on 大巴,
//      the window is matched edge for edge by a coach's side window.
//   B. The coach in side elevation, driving: night streaks in the windows, behind a cage-grille of numbered
//      cells; above it the route strip of the bus, its stops the steps of the procedure
//      (受理 · 审核 · 登记 · 转运 · 处置 · 贵州); the red line is the route, its head the bus.
//   Q. The queue board of the 处置 window: on 你 the number flips 0471 → 0472 and is framed in red; the
//      same number is framed in the coach's grille.
//   M. The dispatch map at night: contour terrain, the route winding through it, the red line's head is the
//      coach; telemetry (车速, 时间 02:3x, 状态 正常).
//   X. 一次撞击: on 撞 the head stops; every plate slips out of register, bands of the display shift, the
//      telemetry reads 车速 0 · 信号丢失; on 击 the screen goes black. In the black, typed, the system's
//      only record of it: 转运任务 0918 · 状态 已完成 · 异常记录 无.
// Media: the envelope and the card are PAPER (the archive); the coach, the board and the map are the
// SCREEN (the system). The match cut on 大巴 is also the cut from paper to screen.
//   C. 一个坏了的玩具: one catalogue card (物品登记卡) on an empty sheet: a scale figure lying on its side,
//      a winding key in its back, its outline broken. The red line comes in from the dark and runs along the
//      card's lower edge as a proofreading rule, and stops at the edge. Nothing else moves.
//   (real material, quoted) On 一次 the dispatch map gives way to the real highway-camera still of the coach at night,
//      the driver in a protective suit, the system still tagging it 正常行驶; on 撞 the photograph itself tears (bands
//      shifted, the plates apart) and goes black. In the coda, after the card has stopped: the same still again, whole,
//      grey, a slow push in on the driver. Then the next card (0473) slides in and a new rule starts: the procedure goes on.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H, clearRT } from '../engine/gl';
import { Lyrics, type Line } from '../engine/lyrics';
import { F, font } from '../engine/type';
import { clamp, ease, lerp, prog, hash, pulse, frameIdx, mod, type V2 } from '../engine/util';
import { dayMinutes, hhmm, Paper, PAPER_POST, SCREEN_POST, SYS, glowOn, glowOff, brackets, sysTag, sysPanel, INK, PRINT, RED, camXf, applyXf, label, drawFigure, hatchRect, route, drawRoute, type Cam, type Ctx2, type Xf, type Head, type Route, chrome, loadImage, drawQuoted, sourceLine } from './_archive';
import { fbm2, pointAtLength } from '../engine/util';

// the matched windows (same size): the envelope's, and the coach's second window
const WIN = { w: 420, h: 136, r: 16 };
const ENV = { x0: -620, y0: -330, x1: 620, y1: 330, win: { x: -440, y: -30 } };
const BUS = { x0: -1240, x1: 1260, roof: -400, floor: 200, wins: [-1090, -640, -190, 260].map((x) => ({ x, y: -290 })) };
const STRIP = { y: -640, x0: -1100, x1: 1100, stops: ['受理', '审核', '登记', '转运', '处置', '贵州'] };
const CARD = { x0: -470, y0: -280, x1: 470, y1: 280 };
const KNOCK = (a = 1) => `rgba(0,${Math.round(255 * a)},0,1)`; // with 'difference': knocks print out

export default class Bus extends Scene {
  ink = new Layer2D();
  hud = new Layer2D();
  paper = new Paper();
  /** the dispatch map: contour segments (page px) and the road */
  contours: number[][] = [];
  road!: Route;
  stopsAt: number[] = [];
  tMap = 0;
  tNews = 0; tCapture = 0;
  night!: HTMLImageElement;

  L1!: Line; L2!: Line; L3!: Line; L4!: Line;
  beat = 0.4;
  T0 = 0; T1 = 0;
  tCutBus = 0; tGz0 = 0; tGz1 = 0; tDest = 0; tNext = 0; tQ = 0; tFlip = 0; tHit = 0; tBlack = 0; tCard = 0; tRule0 = 0; tRule1 = 0;
  fields: { k: string; v: string; t0: number; t1: number }[] = [];

  override async init() {
    const { lyrics, audio } = this.ctx;
    this.L1 = lyrics.get('开往贵州的大巴');
    this.L2 = lyrics.get('最终会轮到你');
    this.L3 = lyrics.get('一次撞击');
    this.L4 = lyrics.get('一个坏了的玩具');
    const b0 = Math.floor(audio.beatAt(this.ctx.start));
    this.beat = audio.timeOfBeat(b0 + 1) - audio.timeOfBeat(b0);
    const onBeat = (t: number) => audio.timeOfBeat(Math.floor(audio.beatAt(t + 0.02)));
    const nearBeat = (t: number) => audio.timeOfBeat(Math.round(audio.beatAt(t)));
    // the plate's own anchors (the same in both of its timeline entries, bus and its coda): it opens on the
    // first beat after the last chorus line and runs to the end of the song
    this.T0 = audio.timeOfBeat(Math.ceil(audio.beatAt(lyrics.get('怎么连绝望都听出了旋律').end)));
    this.T1 = audio.duration;
    const gz = Lyrics.phrase(this.L1, '贵州');
    this.tGz0 = gz.start; this.tGz1 = gz.end;
    // the match cut: on the beat nearest 大(巴)
    this.tCutBus = Math.max(this.tGz1 + 0.1, nearBeat(Lyrics.phrase(this.L1, '大巴').start));
    this.tQ = onBeat(this.L2.start);
    this.tDest = this.tQ - 0.2;
    this.tFlip = Lyrics.phrase(this.L2, '你').start;
    this.tHit = Lyrics.phrase(this.L3, '撞').start;
    this.tMap = Math.max(this.tFlip + 0.6, onBeat(this.L2.end + 0.45));
    this.buildMap();
    this.tBlack = Math.max(this.tHit + this.beat, Lyrics.phrase(this.L3, '击').end);
    this.tCard = Math.max(this.tBlack + this.beat, onBeat(this.L4.start));
    this.tRule0 = this.L4.start;
    this.tRule1 = this.L4.end;
    // the coda: the card holds; the news on a beat; then the next card on a downbeat
    this.tNext = audio.downbeats.find((d) => d > this.tRule1 + 2.4) ?? this.tRule1 + 3;
    this.tNews = audio.timeOfBeat(Math.round(audio.beatAt(this.tRule1 + 1.2)));
    this.night = await loadImage('refs/guizhou_bus_night.jpg');
    // the real capture: on the beat at/before 一次, through 撞, to the black
    this.tCapture = audio.timeOfBeat(Math.floor(audio.beatAt(this.L3.start + 0.02)));
    const w = (q: string) => Lyrics.phrase(this.L4, q);
    this.fields = [
      { k: '编号', v: '0472', t0: this.tCard - 0.2, t1: this.tCard },
      { k: '数量', v: '1', t0: w('一个').start, t1: w('一个').end },
      { k: '名称', v: '玩具（损坏）', t0: w('坏了的').start, t1: w('玩具').end },
      { k: '来源', v: '转运途中', t0: w('玩具').end, t1: w('玩具').end + 0.5 },
      { k: '处理', v: '', t0: 1e9, t1: 1e9 },
    ];
  }

  /** The impact: 1 on 撞, decaying (the plates stay a little off afterwards). */
  hit(t: number) { return t < this.tHit ? 0 : 0.25 + 0.75 * Math.exp(-(t - this.tHit) / 0.35); }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    if (t >= this.tNews && t < this.tNext) return this.newsShot(t, out);
    if (t >= this.tCapture && t < this.tBlack) return this.captureShot(t, out);
    const L = this.ink;
    L.clear('#000');
    const c = L.ctx;
    c.globalCompositeOperation = 'lighter';
    let cam: Cam, heads: Head[] = [];
    const h = this.hit(t);
    const ph = frameIdx(t);
    let amp = 0;
    if (t < this.tCutBus) cam = this.shotEnvelope(c, t);
    else if (t < this.tQ) cam = this.shotBus(c, t, heads);
    else if (t < this.tMap) cam = this.shotQueue(c, t, heads);
    else if (t < this.tBlack) { cam = this.shotMap(c, t, heads); amp = 34 * pulse(t, this.tHit, 0.09); }
    else if (t < this.tCard) cam = { x: 0, y: 0, z: 1, r: 0 };
    else cam = this.shotCard(c, t, heads);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';

    amp += 8 * pulse(t, this.tCutBus, 0.05) + 6 * pulse(t, this.tQ, 0.05) + 9 * pulse(t, this.tFlip, 0.06);
    const m = camXf(cam, amp * (hash(ph, 11) - 0.5) * 2, amp * (hash(ph, 12) - 0.5) * 2);
    // heads were collected in page space: to screen
    const hs = heads.map((p) => ({ ...applyXf(m, p.x, p.y), k: p.k, r: (p.r ?? 4) * cam.z }));
    const black = t >= this.tBlack && t < this.tCard;
    if (black) {
      // the black: only the pen head, where the route broke off
      hs.length = 0;
      hs.push({ x: 960, y: 640, k: 0.9 + 0.1 * Math.sin(t * 9), r: 4 });
    }
    const screen = t >= this.tCutBus && t < this.tBlack ? 1 : 0;
    const misreg: [V2, V2, V2] = [
      { x: -38 * h, y: 14 * h }, { x: 26 * h, y: -22 * h }, { x: 64 * h, y: 30 * h },
    ];
    this.paper.render(this.ctx.renderer, L.upload(), m, cam.z, out, {
      heads: hs, misreg, slip: (t >= this.tHit && t < this.tBlack ? 70 * h : 0), slipSeed: Math.floor(ph / 3) % 7, light: black ? 0 : 1, screen,
    });
    this.hud.clear();
    this.drawHud(this.hud.ctx, t, m);
    this.ctx.comp.draw(this.ctx.renderer, this.hud.upload(), out);
    if (black) return { ...SCREEN_POST, vignette: 0.5 };
    return screen ? SCREEN_POST : PAPER_POST;
  }

  // ------------------------------------------------------------------ the highway camera, quoted; it tears on 撞
  captureShot(t: number, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    this.hud.clear();
    const hc = this.hud.ctx;
    hc.fillStyle = '#060707'; hc.fillRect(0, 0, W, H);
    const k = prog(t, this.tCapture, this.tBlack);
    const z = lerp(1.0, 1.12, k);
    const iw = W * z, ih = (iw * this.night.height) / this.night.width;
    const x = W / 2 - iw / 2, y = H / 2 - ih / 2;
    const h = this.hit(t);
    if (t < this.tHit) drawQuoted(hc, this.night, x, y, iw, ih, 0.35);
    else {
      // the photograph tears: bands shifted sideways, the three plates apart
      const ph = frameIdx(t);
      const band = 54;
      for (let by = 0; by < H; by += band) {
        const dx = (hash(Math.floor(by / band), Math.floor(ph / 3)) - 0.5) * 260 * h * (hash(by, 7) > 0.4 ? 1 : 0);
        hc.save(); hc.beginPath(); hc.rect(0, by, W, band); hc.clip();
        drawQuoted(hc, this.night, x + dx, y, iw, ih, 0.35);
        hc.restore();
      }
      hc.save(); hc.globalCompositeOperation = 'lighter';
      hc.globalAlpha = 0.5 * h;
      hc.filter = 'grayscale(1)';
      hc.drawImage(this.night, x - 40 * h, y + 12 * h, iw, ih);
      hc.restore();
      hc.fillStyle = `rgba(200,50,31,${0.35 * pulse(t, this.tHit, 0.08)})`; hc.fillRect(0, 0, W, H);
    }
    // the system: still tracking, still fine
    const bx = x + iw * 0.27, byy = y + ih * 0.0, bw = iw * 0.44, bh = ih * 0.98;
    brackets(hc, bx, Math.max(120, byy), bw, Math.min(bh, H - 140 - Math.max(120, byy)), t < this.tHit ? SYS.red : SYS.dim, prog(t, this.tCapture + 0.1, this.tCapture + 0.35, ease.outCubic), 40, 3);
    glowOn(hc, 1);
    sysTag(hc, t < this.tHit ? '转运车辆 #0918 · 正常行驶' : '信号丢失', bx, Math.max(150, byy + 40), SYS.red, '#fff', 1, 18);
    glowOff(hc);
    chrome(hc, t, '卡口抓拍 · 车辆 #0918');
    clearRT(renderer, out, [0, 0, 0]);
    comp.draw(renderer, this.hud.upload(), out);
    const amp = 30 * pulse(t, this.tHit, 0.09);
    return { bloom: 0.35, bloomThreshold: 0.85, halation: 0.06, vignette: 0.5, grain: 0.1, ca: 1.6 + 4 * h * (t >= this.tHit ? 1 : 0), paper: 0, shake: [amp * (hash(frameIdx(t), 1) - 0.5), amp * (hash(frameIdx(t), 2) - 0.5)] };
  }

  // ------------------------------------------------------------------ the driver, quoted again (coda)
  newsShot(t: number, out: THREE.WebGLRenderTarget): PostOverrides {
    const { renderer, comp } = this.ctx;
    this.hud.clear();
    const hc = this.hud.ctx;
    hc.fillStyle = '#0b0c0d'; hc.fillRect(0, 0, W, H);
    const k = ease.inOutQuad(prog(t, this.tNews, this.tNext));
    // a slow push from the whole still in on the driver (the suit behind the windscreen, right of centre)
    const z = lerp(0.82, 1.3, k);
    const iw = W * z, ih = (iw * this.night.height) / this.night.width;
    const x = W / 2 - iw * lerp(0.5, 0.6, k), y = H / 2 - ih / 2;
    drawQuoted(hc, this.night, x, y, iw, ih, 0.3);
    clearRT(renderer, out, [0, 0, 0]);
    comp.draw(renderer, this.hud.upload(), out);
    return { bloom: 0.3, bloomThreshold: 0.9, halation: 0.04, vignette: 0.5, grain: 0.08, ca: 0.8, paper: 0, subtitle: 0 };
  }

  // ------------------------------------------------------------------ M. the dispatch map
  buildMap() {
    // contour lines of a noise terrain (marching squares, deterministic), and a road winding through it
    const nx = 150, ny = 90, x0 = -1500, y0 = -900, cs = 20;
    const hgt = (i: number, j: number) => fbm2((x0 + i * cs) * 0.0016, (y0 + j * cs) * 0.0016, 4, 9) + 0.25 * Math.sin((x0 + i * cs) * 0.0012);
    const g: number[][] = [];
    for (let j = 0; j <= ny; j++) { g.push([]); for (let i = 0; i <= nx; i++) g[j]!.push(hgt(i, j)); }
    for (let lv = -0.6; lv <= 0.6; lv += 0.075) {
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = g[j]![i]!, b = g[j]![i + 1]!, c2 = g[j + 1]![i + 1]!, d = g[j + 1]![i]!;
        const pts: number[] = [];
        const edge = (p: number, q: number, xa: number, ya: number, xb: number, yb: number) => {
          if ((p < lv) !== (q < lv)) { const u = (lv - p) / (q - p); pts.push(x0 + (xa + (xb - xa) * u) * cs, y0 + (ya + (yb - ya) * u) * cs); }
        };
        edge(a, b, i, j, i + 1, j); edge(b, c2, i + 1, j, i + 1, j + 1); edge(c2, d, i + 1, j + 1, i, j + 1); edge(d, a, i, j + 1, i, j);
        if (pts.length >= 4) this.contours.push(pts.slice(0, 4));
      }
    }
    const pts: V2[] = [];
    for (let i = 0; i <= 120; i++) {
      const u = i / 120;
      pts.push({ x: lerp(-1300, 1300, u) + 60 * Math.sin(u * 23), y: 260 * Math.sin(u * 5.2 + 0.6) + 120 * Math.sin(u * 13.1) - 80 * u });
    }
    this.road = route(pts);
    this.stopsAt = [0.04, 0.2, 0.37, 0.55, 0.86, 0.98];
  }

  /** How far along the road the coach is (0..1): it never gets past 转运 → 处置. */
  mapK(t: number) { return lerp(0.47, 0.71, prog(Math.min(t, this.tHit), this.tMap, this.tHit + 0.6, ease.linear)); }

  shotMap(c: Ctx2, t: number, heads: Head[]): Cam {
    const k = this.mapK(t);
    const p = pointAtLength(this.road.pts, this.road.L, this.road.total * k);
    const j = this.hit(t);
    const cam: Cam = { x: p.x + 140, y: p.y + 30, z: 1.25 + 0.15 * j, r: -0.04 + 0.05 * j };
    const m = camXf(cam);
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    c.strokeStyle = PRINT(0.55); c.lineWidth = 1 / cam.z * 1.2;
    c.beginPath();
    for (const s2 of this.contours) { c.moveTo(s2[0]!, s2[1]!); c.lineTo(s2[2]!, s2[3]!); }
    c.stroke();
    // the road (printed), then the route run so far (red)
    c.strokeStyle = INK(0.55); c.lineWidth = 7;
    drawRoute(c, this.road, this.road.total);
    c.strokeStyle = INK(0); c.lineWidth = 1;
    this.stopsAt.forEach((u, i) => {
      const q = pointAtLength(this.road.pts, this.road.L, this.road.total * u);
      c.fillStyle = INK(0.9);
      c.beginPath(); c.arc(q.x, q.y, 9, 0, Math.PI * 2); c.fill();
      c.font = font(F.hei(i === 5 ? 900 : 500), i === 5 ? 30 : 22);
      c.fillText(STRIP.stops[i]!, q.x + 16, q.y - 14);
    });
    c.strokeStyle = RED(1); c.lineWidth = 4; c.lineCap = 'round';
    const hp = drawRoute(c, this.road, this.road.total * k, this.road.total * 0.04);
    heads.push({ x: hp.x, y: hp.y, k: t < this.tHit ? 1 : 0.6 + 0.4 * (frameIdx(t) % 20 < 10 ? 1 : 0), r: 6 });
    return cam;
  }

  // ------------------------------------------------------------------ the system's eye
  drawHud(c: Ctx2, t: number, m: Xf) {
    c.save();
    c.textBaseline = 'alphabetic';
    const tick = (_t0: number) => hhmm(dayMinutes(t));
    if (t >= this.tCutBus && t < this.tQ) {
      c.fillStyle = SYS.fg;
      chrome(c, t, '转运调度 · 车辆 #0918 · 乘员已登记');
      const a = applyXf(m, BUS.x0, BUS.roof), b = applyXf(m, BUS.x1, BUS.floor + 140);
      brackets(c, a.x - 10, a.y - 10, b.x - a.x + 20, b.y - a.y + 20, SYS.dim, prog(t, this.tCutBus + 0.2, this.tCutBus + 0.5), 26, 1.5);
    }
    if (t >= this.tMap && t < this.tBlack) {
      const lost = t >= this.tHit;
      c.fillStyle = SYS.fg;
      chrome(c, t, '转运调度 · 实时轨迹 · 任务 0918');
      const v = lost ? 0 : Math.round(62 + 6 * Math.sin(t * 1.7) + 3 * Math.sin(t * 5.3));
      sysPanel(c, 1420, 120, 420, '车辆遥测 #0918', [
        { k: '时间', v: tick(this.tMap), t: this.tMap },
        { k: '车速', v: `${v} km/h`, t: this.tMap + 0.1, red: lost },
        { k: '状态', v: lost ? '信号丢失' : '正常', t: this.tMap + 0.3, red: lost },
      ], t, 17);
    }
    if (t >= this.tBlack && t < this.tCard) {
      // the black: the system's record of what happened
      const rows: [string, number, boolean][] = [['转运任务 0918', this.tBlack + 0.08, false], ['状态 · 已完成', this.tBlack + 0.38, true], ['异常记录 · 无', this.tBlack + 0.7, false]];
      c.textAlign = 'center';
      rows.forEach(([txt, t0, red], i) => {
        if (t < t0) return;
        const chars = Array.from(txt), n = Math.ceil(chars.length * prog(t, t0, t0 + 0.028 * chars.length + 0.04));
        c.font = font(F.mono(500), i === 1 ? 34 : 22);
        c.letterSpacing = i === 1 ? '8px' : '5px';
        c.fillStyle = red ? SYS.red : SYS.dim;
        if (red) glowOn(c, 1.4);
        c.fillText(chars.slice(0, n).join(''), 960, 470 + i * 64);
        glowOff(c);
        c.letterSpacing = '0px';
      });
      c.textAlign = 'left';
    }
    c.restore();
  }

  // ------------------------------------------------------------------ E. the envelope
  envCam(t: number): Cam {
    // the whole envelope, a slow drift; then (from 贵州) the push into its window
    const p0 = this.tGz0 - 0.1;
    const k = prog(t, p0, this.tCutBus, ease.inQuart);
    const m = ease.inOutCubic(prog(t, p0, this.tCutBus));
    const wx = ENV.win.x + WIN.w / 2, wy = ENV.win.y + WIN.h / 2;
    const d = prog(t, this.T0, p0);
    // the window ends up exactly the size the coach's window has at the cut (see busCam)
    return { x: lerp(lerp(-40, -10, d), wx, m), y: lerp(lerp(30, 0, d), wy, m), z: Math.exp(lerp(Math.log(lerp(1.18, 1.3, d)), Math.log(4.2), k)), r: lerp(-0.03, 0, k) };
  }

  shotEnvelope(c: Ctx2, t: number): Cam {
    const cam = this.envCam(t);
    const m = camXf(cam);
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    // the envelope (paper on paper: an outline and a shadow)
    c.strokeStyle = INK(0.75); c.lineWidth = 1.4;
    c.strokeRect(ENV.x0, ENV.y0, ENV.x1 - ENV.x0, ENV.y1 - ENV.y0);
    c.fillStyle = PRINT(0.28);
    c.fillRect(ENV.x0 + 8, ENV.y1, ENV.x1 - ENV.x0, 7);
    c.fillRect(ENV.x1, ENV.y0 + 8, 7, ENV.y1 - ENV.y0);
    // the six red postcode boxes, the code written in by hand
    for (let i = 0; i < 6; i++) {
      const x = ENV.x0 + 40 + i * 52, y = ENV.y0 + 36;
      c.strokeStyle = RED(1); c.lineWidth = 2;
      c.strokeRect(x, y, 42, 46);
      c.fillStyle = INK(0.85);
      c.font = font(F.kai(), 36);
      c.textAlign = 'center';
      c.fillText('550000'[i]!, x + 21, y + 37 + (hash(i, 3) - 0.5) * 3);
      c.textAlign = 'left';
    }
    // 'stamp' area: printed, red frame
    c.strokeStyle = RED(1); c.lineWidth = 2;
    c.strokeRect(ENV.x1 - 150, ENV.y0 + 30, 110, 130);
    c.fillStyle = RED(1);
    c.font = font(F.song(700), 22);
    c.textAlign = 'center';
    c.fillText('转运', ENV.x1 - 95, ENV.y0 + 88); c.fillText('专用', ENV.x1 - 95, ENV.y0 + 118);
    c.textAlign = 'left';
    // the window: a film over the enclosed card (its text a little grey)
    const wx = ENV.win.x, wy = ENV.win.y;
    c.strokeStyle = INK(0.6); c.lineWidth = 1;
    c.beginPath(); c.roundRect(wx, wy, WIN.w, WIN.h, WIN.r); c.stroke();
    c.fillStyle = PRINT(0.12);
    c.beginPath(); c.roundRect(wx, wy, WIN.w, WIN.h, WIN.r); c.fill();
    c.fillStyle = INK(0.8);
    c.font = font(F.fang(), 30);
    c.fillText('贵州 · 处置中心  收', wx + 34, wy + 56);
    label(c, 'NO. 0461–0480 · 内部转运', wx + 34, wy + 100, 15, 500, 2);
    // the red line writes the destination: under 贵州, as it is sung
    const u = prog(t, this.tGz0, this.tGz1, ease.inOutQuad);
    if (u > 0) {
      c.fillStyle = RED(1);
      c.fillRect(wx + 30, wy + 66, 64 * u, 3.5);
    }
    // the sender's line, the address rules
    c.fillStyle = PRINT(0.6);
    for (let i = 0; i < 2; i++) c.fillRect(ENV.x0 + 40, ENV.y0 + 150 + i * 46 + 30, 560, 1);
    c.fillStyle = INK(0.8);
    c.font = font(F.song(600), 20);
    c.textAlign = 'right';
    c.fillText('受理窗口 07  寄', ENV.x1 - 60, ENV.y1 - 40);
    c.textAlign = 'left';
    return cam;
  }

  // ------------------------------------------------------------------ B. the coach
  busCam(t: number, crash: boolean): Cam {
    // at the cut: the coach's second window sits exactly where the envelope's window was on screen
    const e = this.envCam(this.tCutBus - 1e-4);
    const w = BUS.wins[1]!;
    const at: Cam = { x: w.x + WIN.w / 2 + (e.x - (ENV.win.x + WIN.w / 2)), y: w.y + WIN.h / 2 + (e.y - (ENV.win.y + WIN.h / 2)), z: e.z, r: e.r };
    const wide: Cam = { x: 120, y: -230, z: 0.62, r: 0 };
    const k = prog(t, this.tCutBus + 0.05, this.tCutBus + this.beat * 3, ease.inOutExpo);
    let cam: Cam = { x: lerp(at.x, wide.x, k), y: lerp(at.y, wide.y, k), z: Math.exp(lerp(Math.log(at.z), Math.log(wide.z), k)), r: 0 };
    cam = { ...cam, z: cam.z * (1 + 0.04 * prog(t, this.tCutBus + this.beat * 3, this.tQ)) };
    if (crash) {
      // the impact: a jolt and a roll, held crooked
      const j = this.hit(t);
      cam = { x: 140 + 40 * j, y: -300, z: 0.95 + 0.25 * j, r: 0.06 * j + 0.025 };
    }
    return cam;
  }

  /** The route's progress (0..1 along the strip) — the bus between the stops. */
  routeK(t: number) {
    if (t < this.tCutBus) return 0;
    return lerp(0.12, 1, prog(t, this.tCutBus, this.tDest, ease.inOutCubic));
  }

  shotBus(c: Ctx2, t: number, heads: Head[], crash = false): Cam {
    const cam = this.busCam(t, crash);
    const m = camXf(cam);
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    // the road: ground line, dashes running back
    c.fillStyle = INK(0.85);
    c.fillRect(-2600, BUS.floor + 135, 5200, 2.2);
    c.fillStyle = PRINT(0.6);
    const run = t * 900;
    for (let k = -14; k < 14; k++) c.fillRect(mod(k * 220 - run, 5200) - 2600, BUS.floor + 175, 110, 5);
    c.strokeStyle = PRINT(0.4); c.lineWidth = 1;
    hatchRect(c, -2600, BUS.floor + 137, 5200, 26, 9);
    // the body
    c.strokeStyle = INK(0.92); c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(BUS.x0 + 40, BUS.floor);
    c.lineTo(BUS.x0, BUS.floor - 30); c.lineTo(BUS.x0 + 10, BUS.roof + 40); c.quadraticCurveTo(BUS.x0 + 20, BUS.roof, BUS.x0 + 80, BUS.roof);
    c.lineTo(BUS.x1 - 160, BUS.roof); c.quadraticCurveTo(BUS.x1 - 60, BUS.roof + 4, BUS.x1 - 30, BUS.roof + 120);
    c.lineTo(BUS.x1, BUS.floor - 40); c.lineTo(BUS.x1 - 30, BUS.floor);
    c.closePath(); c.stroke();
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(BUS.x0 + 10, BUS.floor - 80); c.lineTo(BUS.x1 - 8, BUS.floor - 80); c.stroke();
    c.strokeStyle = PRINT(0.45);
    hatchRect(c, BUS.x0 + 30, BUS.floor - 78, BUS.x1 - BUS.x0 - 70, 70, 8, -Math.PI / 4);
    // the wheels (hatched, turning: spokes by time)
    for (const wx of [-820, 820]) {
      c.fillStyle = PRINT(0.85);
      c.beginPath(); c.arc(wx, BUS.floor + 30, 105, 0, Math.PI * 2); c.fill();
      c.strokeStyle = INK(0.9); c.lineWidth = 2;
      c.beginPath(); c.arc(wx, BUS.floor + 30, 105, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(wx, BUS.floor + 30, 52, 0, Math.PI * 2); c.stroke();
      const a0 = -t * 9;
      c.lineWidth = 1.5;
      for (let i = 0; i < 6; i++) {
        const a = a0 + (i * Math.PI) / 3;
        c.beginPath(); c.moveTo(wx + Math.cos(a) * 14, BUS.floor + 30 + Math.sin(a) * 14); c.lineTo(wx + Math.cos(a) * 50, BUS.floor + 30 + Math.sin(a) * 50); c.stroke();
      }
    }
    // the door and the windscreen
    c.strokeStyle = INK(0.85); c.lineWidth = 1.5;
    c.strokeRect(780, -300, 150, 420);
    c.beginPath(); c.moveTo(855, -300); c.lineTo(855, 120); c.stroke();
    c.beginPath(); c.moveTo(980, -300); c.lineTo(1150, -300); c.lineTo(1215, -60); c.lineTo(980, -60); c.closePath(); c.stroke();
    // the destination board
    c.fillStyle = INK(0.92);
    c.fillRect(960, -385, 250, 60);
    c.globalCompositeOperation = 'difference';
    c.fillStyle = 'rgba(255,0,0,1)';
    c.font = font(F.hei(900), 34);
    c.fillText('开往  贵州', 990, -342);
    c.globalCompositeOperation = 'lighter';
    // the windows: night inside, streaks of passing light, a grille of numbered cells
    BUS.wins.forEach((w, wi) => this.busWindow(c, t, w.x, w.y, wi));
    // the coordinates, in the system's small type (they jump on the impact)
    const h = this.hit(t);
    const jit = (s: number) => (h > 0 ? (hash(frameIdx(t), s) - 0.5) * 40 * h : 0);
    c.fillStyle = INK(0.85);
    label(c, `N ${(26.57 + jit(1)).toFixed(2)}°  E ${(106.71 + jit(2)).toFixed(2)}°`, 960, -420, 15, 500, 3);
    label(c, `车次 0472 · 内部转运`, BUS.x0 + 20, BUS.roof - 26, 15, 500, 3);
    this.drawStrip(c, t, heads, crash);
    return cam;
  }

  busWindow(c: Ctx2, t: number, x: number, y: number, wi: number) {
    c.save();
    c.beginPath(); c.roundRect(x, y, WIN.w, WIN.h, WIN.r); c.clip();
    c.fillStyle = PRINT(0.9);
    c.fillRect(x, y, WIN.w, WIN.h);
    c.globalCompositeOperation = 'difference';
    // passing lights: streaks running back
    for (let k = 0; k < 7; k++) {
      const sp = 1500 + 900 * hash(k, wi, 3);
      const xx = mod(hash(k, wi, 1) * 3000 - t * sp, 3000) - 1200 + x;
      const yy = y + 12 + hash(k, wi, 2) * (WIN.h - 24);
      c.fillStyle = KNOCK(0.35 + 0.4 * hash(k, wi, 4));
      c.fillRect(xx, yy, 120 + 260 * hash(k, wi, 5), 2.5);
    }
    // the grille: numbered cells, knocked out of the dark
    c.strokeStyle = KNOCK(0.55); c.lineWidth = 1.2;
    const cw = WIN.w / 5, ch = WIN.h / 2;
    for (let j = 0; j < 2; j++) for (let i = 0; i < 5; i++) {
      c.strokeRect(x + i * cw + 6, y + j * ch + 6, cw - 12, ch - 12);
      for (let b = 1; b < 4; b++) { c.beginPath(); c.moveTo(x + i * cw + 6 + (b * (cw - 12)) / 4, y + j * ch + 6); c.lineTo(x + i * cw + 6 + (b * (cw - 12)) / 4, y + (j + 1) * ch - 6); c.stroke(); }
      c.fillStyle = KNOCK(0.8);
      label(c, String(461 + wi * 10 + j * 5 + i).padStart(4, '0'), x + i * cw + 12, y + j * ch + 24, 11, 600, 1);
    }
    c.restore();
    c.globalCompositeOperation = 'lighter';
    c.strokeStyle = INK(0.92); c.lineWidth = 1.8;
    c.beginPath(); c.roundRect(x, y, WIN.w, WIN.h, WIN.r); c.stroke();
    // 0472 is in the second window, top row, second cell: framed in red once its number is called
    if (wi === 1 && t >= this.tFlip) {
      c.strokeStyle = RED(1); c.lineWidth = 3;
      const cw2 = WIN.w / 5;
      c.strokeRect(x + cw2 + 2, y + 2, cw2 - 4, WIN.h / 2 - 4);
    }
  }

  drawStrip(c: Ctx2, t: number, heads: Head[], crash: boolean) {
    const { x0, x1, y } = STRIP;
    const n = STRIP.stops.length;
    const sx = (i: number) => lerp(x0, x1, i / (n - 1));
    c.fillStyle = INK(0.75);
    c.fillRect(x0, y - 1, x1 - x0, 2);
    label(c, '线 路', x0 - 10, y - 70, 15, 600, 6);
    const k = this.routeK(t);
    const hx = lerp(x0, x1, k);
    for (let i = 0; i < n; i++) {
      const passed = sx(i) <= hx + 1;
      c.strokeStyle = INK(0.9); c.lineWidth = 2;
      c.beginPath(); c.arc(sx(i), y, 11, 0, Math.PI * 2); c.stroke();
      c.fillStyle = passed ? RED(1) : INK(0);
      if (passed) { c.beginPath(); c.arc(sx(i), y, 7, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = INK(0.9);
      c.font = font(F.hei(i === n - 1 ? 900 : 500), i === n - 1 ? 30 : 24);
      c.textAlign = 'center';
      c.fillText(STRIP.stops[i]!, sx(i), y + 52);
      c.textAlign = 'left';
    }
    // the destination lights when the route reaches it
    if (t >= this.tDest) {
      const g = prog(t, this.tDest, this.tDest + 0.15, ease.outCubic);
      c.strokeStyle = RED(1); c.lineWidth = 3;
      c.strokeRect(sx(n - 1) - 50, y + 18, 100 * g, 48);
    }
    // the red line: the route run so far; on the impact it leaves the strip
    c.strokeStyle = RED(1); c.lineWidth = 5; c.lineCap = 'square';
    c.beginPath(); c.moveTo(x0, y); c.lineTo(hx, y); c.stroke();
    if (crash) {
      const j = prog(t, this.tHit, this.tHit + 0.18, ease.outExpo);
      c.beginPath(); c.moveTo(hx, y); c.lineTo(hx + 260 * j, y + 420 * j); c.stroke();
      heads.push({ x: hx + 260 * j, y: y + 420 * j, k: 1, r: 5 });
    } else if (k > 0 && k < 1) heads.push({ x: hx, y, k: 1, r: 5 });
  }

  // ------------------------------------------------------------------ Q. the queue board
  shotQueue(c: Ctx2, t: number, heads: Head[]): Cam {
    const k = prog(t, this.tQ, this.tFlip, ease.linear);
    const cam: Cam = { x: lerp(-40, 0, k), y: lerp(20, 0, k), z: lerp(1.15, 1.22, k) * (1 + 0.05 * pulse(t, this.tFlip, 0.1)), r: lerp(0.012, 0, k) };
    const m = camXf(cam);
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    const x0 = -600, y0 = -330, x1 = 600, y1 = 330;
    c.strokeStyle = INK(0.9); c.lineWidth = 2;
    c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    c.lineWidth = 1;
    c.strokeRect(x0 + 12, y0 + 12, x1 - x0 - 24, y1 - y0 - 24);
    c.fillStyle = INK(0.92);
    c.font = font(F.song(900), 46);
    c.fillText('处置窗口 · 叫号', x0 + 50, y0 + 90);
    c.fillStyle = INK(0.5);
    c.fillRect(x0 + 50, y0 + 120, x1 - x0 - 100, 1.2);
    c.fillStyle = INK(0.8);
    c.font = font(F.hei(500), 22);
    c.fillText('当前号', x0 + 56, y0 + 170);
    c.fillText('下一位', x0 + 760, y0 + 170);
    // the number: a split-flap that turns on 你
    const flip = prog(t, this.tFlip, this.tFlip + 0.16, ease.inOutQuad);
    const num = flip < 0.5 ? '0471' : '0472';
    const sy = flip < 0.5 ? 1 - flip * 2 : (flip - 0.5) * 2;
    c.save();
    c.translate(x0 + 56, y0 + 380);
    c.scale(1, Math.max(0.02, sy));
    c.fillStyle = INK(0.95);
    c.font = font(F.mono(500), 230);
    c.fillText(num, 0, 0);
    c.restore();
    c.fillStyle = INK(0.8);
    c.font = font(F.mono(500), 90);
    c.fillText(flip < 0.5 ? '0472' : '0473', x0 + 760, y0 + 290);
    c.fillStyle = INK(0.5);
    c.fillRect(x0 + 720, y0 + 140, 1.2, 300);
    // framed in red when called; the instruction types in
    if (t >= this.tFlip) {
      const g = prog(t, this.tFlip + 0.12, this.tFlip + 0.4, ease.outCubic);
      c.strokeStyle = RED(1); c.lineWidth = 4;
      const bx = x0 + 40, by = y0 + 200, bw = 610, bh = 210;
      const per = 2 * (bw + bh) * g;
      c.beginPath(); c.moveTo(bx, by);
      const segs: [number, number][] = [[bx + bw, by], [bx + bw, by + bh], [bx, by + bh], [bx, by]];
      let acc = 0, px = bx, py = by;
      for (const [sx2, sy2] of segs) {
        const l = Math.hypot(sx2 - px, sy2 - py);
        if (acc + l <= per) { c.lineTo(sx2, sy2); acc += l; px = sx2; py = sy2; } else { const u = (per - acc) / l; c.lineTo(lerp(px, sx2, u), lerp(py, sy2, u)); break; }
      }
      c.stroke();
      const s = '请 0472 号 到 处置窗口';
      const n = Math.floor(Array.from(s).length * prog(t, this.tFlip + 0.3, this.tFlip + 1.1));
      c.fillStyle = INK(0.92);
      c.font = font(F.hei(700), 30);
      c.fillText(Array.from(s).slice(0, n).join(''), x0 + 56, y1 - 60);
    }
    return cam;
  }

  // ------------------------------------------------------------------ C. the card
  shotCard(c: Ctx2, t: number, heads: Head[]): Cam {
    const cam: Cam = { x: 0, y: 40, z: 1.32 + 0.02 * prog(t, this.tCard, this.T1), r: -0.006 };
    const m = camXf(cam);
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    this.drawCard(c, t, heads, '0472', 0, 0, 0, true);
    // the coda: the next card slides in over it (it covers the first: its area is cleared to bare paper)
    if (t >= this.tNext) {
      const k = prog(t, this.tNext, this.tNext + 0.45, ease.outExpo);
      this.drawCard(c, t, heads, '0473', lerp(1700, 26, k), lerp(-30, -18, k), lerp(0.05, 0.012, k), false);
    }
    return cam;
  }

  /** One catalogue card, offset (dx, dy) and turned; 'first' is the visitor's (filled in, ruled). */
  drawCard(c: Ctx2, t: number, heads: Head[], no: string, dx: number, dy: number, rot: number, first: boolean) {
    c.save();
    c.translate(dx, dy); c.rotate(rot);
    const { x0, y0, x1, y1 } = CARD;
    if (!first) {
      c.globalCompositeOperation = 'source-over';
      c.fillStyle = '#000';
      c.fillRect(x0, y0, x1 - x0 + 8, y1 - y0 + 8);
      c.globalCompositeOperation = 'lighter';
    }
    // the card: outline, a shadow line, the rod hole of a catalogue card
    c.strokeStyle = INK(0.8); c.lineWidth = 1.4;
    c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    c.fillStyle = PRINT(0.3);
    c.fillRect(x0 + 7, y1, x1 - x0, 6);
    c.fillRect(x1, y0 + 7, 6, y1 - y0);
    c.beginPath(); c.arc((x0 + x1) / 2, y1 - 26, 9, 0, Math.PI * 2); c.strokeStyle = INK(0.6); c.lineWidth = 1.2; c.stroke();
    // header
    c.fillStyle = INK(0.92);
    c.font = font(F.song(700), 34);
    c.fillText('物品登记卡', x0 + 36, y0 + 62);
    c.fillStyle = RED(1);
    label(c, no, x1 - 36, y0 + 58, 26, 600, 4, 'right');
    c.fillStyle = INK(0.55);
    c.fillRect(x0 + 36, y0 + 86, x1 - x0 - 72, 1.2);
    // the figure box: the scale figure lying on its side, a winding key in its back, its outline broken
    const bx = x0 + 36, by = y0 + 112, bw = 330, bh = 330;
    c.strokeStyle = INK(0.6); c.lineWidth = 1;
    c.strokeRect(bx, by, bw, bh);
    c.fillStyle = INK(0.6);
    label(c, '图 1', bx + 8, by + 22, 12, 500, 2);
    if (!first) {
      // the next card: blank fields but its number, and its own rule starting along its edge
      const fx = bx + bw + 40, fw = x1 - 36 - fx;
      this.fields.forEach((fd, i) => {
        const y = by + 40 + i * 64;
        c.fillStyle = INK(0.75); c.font = font(F.hei(500), 20); c.fillText(fd.k, fx, y);
        c.fillStyle = INK(0.45); c.fillRect(fx + 64, y + 10, fw - 64, 1);
      });
      c.fillStyle = INK(0.92); c.font = font(F.fang(), 28); c.fillText(no, fx + 78, by + 42);
      const k = prog(t, this.tNext + 0.5, this.T1 + 2, ease.linear);
      const hx = x0 - 600 + (x1 - x0 + 600) * k;
      c.fillStyle = RED(1);
      c.fillRect(x0 - 600, y1 + 22, hx - (x0 - 600), 4);
      if (k > 0 && k < 1) heads.push({ x: dx + hx, y: dy + y1 + 24, k: 1, r: 5 }); // (the card's turn is small)
      c.restore();
      return;
    }
    c.save();
    // (the break: a notch cut out of the outline)
    c.beginPath(); c.rect(bx, by, bw, bh); c.rect(bx + 186, by + 196, 22, 26); c.clip('evenodd');
    c.translate(bx + bw / 2 - 10, by + bh / 2 + 40);
    c.rotate(-Math.PI / 2);
    drawFigure(c, 'adult', 0, 120, 250, { stroke: INK(0.88), lw: 1.6 });
    c.restore();
    // the key, in its back
    c.save();
    c.translate(bx + bw / 2 - 10, by + bh / 2 + 40 + 12);
    c.strokeStyle = INK(0.88); c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 34); c.stroke();
    c.beginPath(); c.ellipse(-13, 44, 13, 9, 0, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.ellipse(13, 44, 13, 9, 0, 0, Math.PI * 2); c.stroke();
    c.restore();
    // the fields
    const fx = bx + bw + 40, fw = x1 - 36 - fx;
    this.fields.forEach((fd, i) => {
      const y = by + 40 + i * 64;
      c.fillStyle = INK(0.75);
      c.font = font(F.hei(500), 20);
      c.fillText(fd.k, fx, y);
      c.fillStyle = INK(0.45);
      c.fillRect(fx + 64, y + 10, fw - 64, 1);
      const chars = Array.from(fd.v);
      const n = Math.floor(chars.length * prog(t, fd.t0, fd.t1));
      c.fillStyle = INK(0.92);
      c.font = font(F.fang(), 28);
      c.fillText(chars.slice(0, n).join(''), fx + 78, y + 2);
    });
    // the proofreading rule: in from the dark along the card's lower edge, stopping at its edge
    const k = prog(t, this.tRule0, this.tRule1, ease.inOutQuad);
    const start = -1400, end = x1;
    const hx = lerp(start, end, k);
    c.fillStyle = RED(1);
    c.fillRect(start, y1 + 22, hx - start, 4);
    if (k >= 1) c.fillRect(end - 2, y1 + 8, 4, 32); // the stop mark
    else if (t >= this.tRule0 - 0.5) heads.push({ x: hx, y: y1 + 24, k: 1, r: 5 });
    c.restore();
  }
}

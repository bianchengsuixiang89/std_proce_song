// 图版 03 `petition` — 呈递 / "你问他法律条文 · 你问他科学依据 · 他看着你 · 像看着一个不懂事的孩子"
// One engineering sheet on bone paper, seen by a restless camera: a cross-section of a service counter
// (来访人 left, 工作人员 right, a partition between, a slot under it) with two detail views above it.
//   A. Detail A (附件 1, the law extract): on 法-律-条-文 the red line underlines one article per character;
//      已收悉 (仅表示收到) is stamped on the beat; the line runs on as the submission route, down the
//      sheet to the slot — where the document drops edge-on into the partition and closes the slot.
//   B. Detail B (附件 2, the test report): on 科-学 the red line traces the data, on 依-据 it rules a box
//      round each 阴性; stamped; routed; it can't reach the slot any more and becomes another layer.
//   C. "他看着你": the rest of the attachments drop in on the beats, the partition doubles and doubles
//      (a dimension line keeps count, in mm). His sightline is a hidden line (dashed) through the wall.
//   D. "像看着一个不懂事的孩子": on 不懂事 a red revision cloud is drawn round the visitor; on 孩子 the
//      visitor is redrawn at another scale (a child's proportions) and the revision is logged: △1.
// The partition is made of what was submitted: received, never read.
// Two media, cut on the beat: the documents are PAPER under the scanner's eye (a red laser sweeps them, OCR
// boxes catch each article, a verdict panel types: 情绪化诉求 / 不予采信); the routes and the section are the
// SCREEN, the system's own schematic, where a detector tags the visitor (情绪 激动) and an age estimator
// rolls 34 → 7 on 孩子. The official's face: 已脱敏.
import * as THREE from 'three';
import { Scene, type Frame, type PostOverrides } from '../engine/scene';
import { Layer2D, W, H } from '../engine/gl';
import { Lyrics, type Line } from '../engine/lyrics';
import { F, font, measure } from '../engine/type';
import { clamp, ease, lerp, prog, hash, pulse, frameIdx, type V2 } from '../engine/util';
import {
  Paper, PAPER_POST, SCREEN_POST, SYS, glowOn, glowOff, brackets, sysTag, sysPanel, INK, PRINT, RED, camXf, invXf, applyXf, lerpCam, route, drawRoute, arrowHead, drawStamp, greek, label,
  dimension, drawFigure, hatchRect, chrome, type Cam, type Route, type Stamp, type Ctx2,
} from './_archive';

// sheet geometry (page px). Origin: the slot, at counter-top level, on the partition's right face.
const FLOOR = 300, CEIL = -560, PART_TOP = -470, SLOT = 30;
const COUNTER = { x0: 20, x1: 540 };
const PERSON = { x: -400, h: 600 }, OFFICIAL = { x: 330, h: 600 };
const DA = { x: -760, y: -1150, hw: 370, hh: 470 };
const DB = { x: 760, y: -1110, hw: 300, hh: 400 };
const MM = 1.5; // mm per page px (the partition's thickness)
const SHEET = { x0: -1300, x1: 1300, y0: -1720, y1: 700 };

interface Layer { t: number; mm: number; name: string }

/** 中华人民共和国宪法 (2018), the articles the visitor brings (verbatim), and the status the system gives each. */
const ARTS = [
  { n: '第二条', s: '中华人民共和国的一切权力属于人民。', tag: '人民当家作主 · 权限不足' },
  { n: '第三十三条', s: '中华人民共和国公民在法律面前一律平等。国家尊重和保障人权。', tag: '不适用' },
  { n: '第三十五条', s: '中华人民共和国公民有言论、出版、集会、结社、游行、示威的自由。', tag: '已屏蔽' },
  { n: '第三十七条', s: '中华人民共和国公民的人身自由不受侵犯。', tag: '已隔离' },
  { n: '第三十九条', s: '中华人民共和国公民的住宅不受侵犯。禁止非法搜查或者非法侵入公民的住宅。', tag: '已入户' },
  { n: '第四十一条', s: '中华人民共和国公民对于任何国家机关和国家工作人员，有提出批评和建议的权利；', tag: '已转办' },
];
/** The articles underlined on 法-律-条-文 (one per character). */
const UNDER = [0, 2, 4, 5];
const ART_SIZE = 25, ART_LEAD = 36;

export default class Petition extends Scene {
  ink = new Layer2D();
  hud = new Layer2D();
  paper = new Paper();

  L1!: Line; L2!: Line; L3!: Line; L4!: Line;
  beat = 0.4;
  // key times
  T0 = 0; T1 = 0;
  tUnder: number[] = []; tStampA = 0; tRouteA = 0; tDropA = 0;
  tWhipB = 0; tTrace0 = 0; tTrace1 = 0; tBox: number[] = []; tStampB = 0; tRouteB = 0; tDropB = 0;
  tWide = 0; tSight = 0; tCloud0 = 0; tCloud1 = 0; tKid = 0; tLog = 0;
  layers: Layer[] = [];
  /** laid-out articles: label, wrapped lines, first baseline y (page px) */
  arts: { n: string; lines: string[]; y: number; tag: string }[] = [];
  routeA!: Route; routeB!: Route;
  /** route draw durations */
  durA = 1; durB = 1;
  data: V2[] = [];
  dataRoute!: Route;

  override async init() {
    const { lyrics, audio } = this.ctx;
    this.L1 = lyrics.get('你问他法律条文');
    this.L2 = lyrics.get('你问他科学依据');
    this.L3 = lyrics.get('他看着你');
    this.L4 = lyrics.get('像看着一个不懂事的孩子');
    const law = Lyrics.phrase(this.L1, '法律条文'), sci = Lyrics.phrase(this.L2, '科学依据');
    const kid = Lyrics.phrase(this.L4, '孩子'), dumb = Lyrics.phrase(this.L4, '不懂事');
    const b0 = Math.floor(audio.beatAt(this.ctx.start));
    this.beat = audio.timeOfBeat(b0 + 1) - audio.timeOfBeat(b0);
    const nextBeat = (t: number) => audio.timeOfBeat(Math.ceil(audio.beatAt(t) - 1e-3));
    this.T0 = this.ctx.start; this.T1 = this.ctx.end;

    // A: one underline per character of 法律条文, the stamp on the beat after the phrase, then the route
    this.tUnder = law.words.map((w) => w.start);
    this.tStampA = nextBeat(law.end - this.beat * 0.25);
    this.tRouteA = this.tStampA + this.beat;
    // B starts a beat before line 2 (a whip), the route must reach the slot before line 3
    this.tWhipB = Math.max(this.tRouteA + this.beat, nextBeat(this.L2.start - this.beat * 1.1));
    this.durA = Math.max(this.beat * 1.5, this.tWhipB - this.tRouteA - this.beat * 0.75);
    this.tDropA = this.tRouteA + this.durA;
    this.tTrace0 = sci.words[0]!.start; this.tTrace1 = sci.words[1]!.end;
    this.tBox = [sci.words[2]!.start, lerp(sci.words[2]!.start, sci.words[3]!.start, 0.5), sci.words[3]!.start, lerp(sci.words[3]!.start, sci.words[3]!.end, 0.5)];
    this.tStampB = nextBeat(sci.end - this.beat * 0.25);
    this.tRouteB = this.tStampB + this.beat * 0.5;
    this.tWide = nextBeat(this.L3.start - 0.05);
    this.durB = Math.max(this.beat, this.tWide - this.tRouteB - 0.05);
    this.tDropB = this.tRouteB + this.durB;
    this.tSight = Lyrics.phrase(this.L3, '看').start;
    this.tCloud0 = dumb.start; this.tCloud1 = dumb.end;
    this.tKid = kid.start;
    this.tLog = kid.end;

    // the partition: base 12 mm, then what was submitted (doubling on the beats of line 3)
    this.layers = [
      { t: this.tDropA, mm: 12, name: '附件 1' },
      { t: this.tDropB, mm: 24, name: '附件 2' },
    ];
    let mm = 48, k = 3;
    for (let t = this.tWide + this.beat; t < this.L4.start - this.beat * 0.5 && k < 12; t += this.beat, k++) {
      this.layers.push({ t, mm, name: `附件 ${k}` });
      mm = Math.min(mm * 2, 256);
    }

    // lay out the articles (wrapped to the page)
    {
      let y = DA.y - DA.hh + 190;
      const x0 = DA.x - DA.hw + 40 + 150, wmax = DA.hw * 2 - 80 - 150;
      for (const a of ARTS) {
        const lines: string[] = [];
        let cur = '';
        for (const ch of Array.from(a.s)) { if (measure(cur + ch, F.fang(), ART_SIZE) > wmax) { lines.push(cur); cur = ch; } else cur += ch; }
        if (cur) lines.push(cur);
        this.arts.push({ n: a.n, lines, y, tag: a.tag });
        y += lines.length * ART_LEAD + 30;
        void x0;
      }
    }
    // the routes (orthogonal, ruler-straight): from the marked text down to the slot
    const slot = (thick: number) => 20 - thick / MM;
    this.routeA = route([
      { x: DA.x + DA.hw - 40, y: this.underY(5) }, { x: DA.x + DA.hw + 70, y: this.underY(5) }, { x: DA.x + DA.hw + 70, y: -620 },
      { x: -170, y: -640 }, { x: -170, y: -SLOT / 2 }, { x: slot(12) - 2, y: -SLOT / 2 },
    ]);
    this.routeB = route([
      { x: DB.x - DB.hw + 450, y: DB.y + 352 }, { x: DB.x - DB.hw + 450, y: DB.y + 470 }, { x: DB.x - DB.hw - 70, y: DB.y + 470 }, { x: DB.x - DB.hw - 70, y: -700 },
      { x: -230, y: -700 }, { x: -230, y: -SLOT / 2 }, { x: slot(24) - 2, y: -SLOT / 2 },
    ]);
    // the report's data: well under the threshold, a little noisy
    this.data = Array.from({ length: 13 }, (_, i) => ({ x: DB.x - 230 + i * 37, y: DB.y + 120 - 26 - 40 * hash(i, 31) - 14 * Math.sin(i * 0.9) }));
    this.dataRoute = route(this.data);
  }

  /** y of the underline under an article's first line. */
  underY(i: number) { return (this.arts[i]?.y ?? 0) + 9; }

  /** The partition's thickness (mm) at t: each layer drops in with a short fall and a snap. */
  thickness(t: number) {
    let mm = 12;
    for (const l of this.layers) mm += l.mm * prog(t, l.t, l.t + 0.12, ease.outCubic);
    return mm;
  }

  /** Visitor's scale: 1 (adult), drawn at 1:32 from 孩子 on (a snap with a little overshoot). */
  kidK(t: number) { return clamp(ease.outBack(prog(t, this.tKid, this.tKid + 0.22), 2.2), 0, 1.06); }

  camAt(t: number): Cam {
    const B = this.beat;
    // A: the whole extract, legible from the first frame; one slow push down the articles while they are
    // underlined (no snaps: the text has to be read)
    const aPage: Cam = { x: DA.x + 20, y: DA.y - 30, z: 1.08, r: -0.02 };
    let cam = lerpCam(aPage, { x: DA.x + 30, y: DA.y + 40, z: 1.18, r: -0.014 }, prog(t, this.T0, this.tStampA, ease.inOutSine));
    // the stamp: a short pull back to see the page
    cam = lerpCam(cam, { x: DA.x + 30, y: DA.y + 20, z: 1.0, r: -0.01 }, prog(t, this.tStampA - 0.05, this.tStampA + 0.35, ease.inOutCubic));
    if (t < this.tRouteA) return cam;
    // the route: the camera chases the pen, widening as it runs down the sheet
    if (t < this.tWhipB) {
      const h = this.headA(t);
      const chase: Cam = { x: h.x + 60, y: h.y + 80, z: lerp(1.0, 0.92, prog(t, this.tRouteA, this.tDropA)), r: lerp(-0.01, 0.006, prog(t, this.tRouteA, this.tDropA)) };
      cam = lerpCam(cam, chase, prog(t, this.tRouteA, this.tRouteA + B, ease.inOutCubic));
      const sec: Cam = { x: -80, y: -20, z: 1.02, r: 0.004 };
      return lerpCam(cam, sec, prog(t, this.tDropA - 0.1, this.tDropA + 0.25, ease.outExpo));
    }
    // B: a whip across the sheet, settling on the chart as the data is traced
    const bChart: Cam = { x: DB.x + 10, y: DB.y + 70, z: 1.55, r: 0.02 };
    const bTable: Cam = { x: DB.x + 40, y: DB.y + 230, z: 1.45, r: 0.015 };
    const bPage: Cam = { x: DB.x - 10, y: DB.y + 20, z: 1.02, r: 0.01 };
    if (t < this.tRouteB) {
      const from = this.camAt(this.tWhipB - 1e-4);
      let c = lerpCam(from, bChart, prog(t, this.tWhipB, this.tWhipB + B * 0.9, ease.inOutExpo));
      c = lerpCam(c, { ...bChart, x: bChart.x + 60 }, prog(t, this.tTrace0, this.tTrace1, ease.inOutQuad));
      c = lerpCam(c, bTable, prog(t, this.tBox[0]! - 0.05, this.tBox[0]! + 0.3, ease.outExpo));
      return lerpCam(c, bPage, prog(t, this.tStampB - 0.05, this.tStampB + 0.3, ease.outExpo));
    }
    if (t < this.tWide) {
      const h = this.headB(t);
      const chase: Cam = { x: h.x - 60, y: h.y + 60, z: 0.95, r: -0.006 };
      return lerpCam(lerpCam(bPage, chase, prog(t, this.tRouteB, this.tRouteB + B * 0.8, ease.inOutCubic)), { x: -120, y: -30, z: 1.0, r: 0 }, prog(t, this.tDropB - 0.12, this.tDropB, ease.inOutCubic));
    }
    // C: the section, wide; a slow push while the wall doubles
    const wide: Cam = { x: -40, y: -60, z: lerp(0.86, 0.92, prog(t, this.tWide, this.L4.start)), r: 0 };
    let c = lerpCam({ x: -120, y: -30, z: 1.0, r: 0 }, wide, prog(t, this.tWide - 0.02, this.tWide + 0.3, ease.outExpo));
    // D: in on the visitor for the revision, then out to read the log
    const onVisitor: Cam = { x: -300, y: 50, z: 1.3, r: -0.012 };
    c = lerpCam(c, onVisitor, prog(t, this.tCloud0 - 0.08, this.tCloud0 + 0.3, ease.outExpo));
    c = lerpCam(c, { x: -240, y: 60, z: 1.18, r: -0.006 }, prog(t, this.tKid - 0.02, this.tKid + 0.3, ease.outExpo));
    return lerpCam(c, { x: -200, y: 30, z: lerp(1.0, 1.03, prog(t, this.tLog, this.T1)), r: 0 }, prog(t, this.tLog, this.tLog + 0.45, ease.inOutCubic));
  }

  headA(t: number) { return drawRouteHead(this.routeA, this.routeA.total * prog(t, this.tRouteA, this.tDropA, ease.inOutQuad)); }
  headB(t: number) { return drawRouteHead(this.routeB, this.routeB.total * prog(t, this.tRouteB, this.tDropB, ease.inOutQuad)); }

  shake(t: number): [number, number] {
    let amp = 22 * pulse(t, this.tStampA, 0.07)  + 10 * pulse(t, this.tKid, 0.06);
    for (const l of this.layers) amp += (l.mm > 40 ? 9 : 5) * pulse(t, l.t + 0.1, 0.05);
    const ph = frameIdx(t);
    return [amp * (hash(ph, 11) - 0.5) * 2, amp * (hash(ph, 12) - 0.5) * 2];
  }

  render(f: Frame, out: THREE.WebGLRenderTarget): PostOverrides {
    const t = f.t;
    const cam = this.camAt(t);
    cam.z *= 1 + 0.045 * pulse(t, this.tStampA, 0.09)  + 0.03 * pulse(t, this.tKid, 0.08);
    const [shx, shy] = this.shake(t);
    const m = camXf(cam, shx, shy);
    const L = this.ink;
    L.clear('#000');
    const c = L.ctx;
    c.globalCompositeOperation = 'lighter';
    c.setTransform(m.a, m.b, m.c, m.d, m.e, m.f);
    this.drawSheet(c);
    this.drawDetailA(c, t);
    this.drawDetailB(c, t);
    this.drawSection(c, t);
    const heads = this.drawRed(c, t);
    this.drawTitle(c, t);
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = 'source-over';

    const stamps: Stamp[] = [];
    for (const s of [this.stampA(t), this.stampB(t)]) if (s.on) stamps.push({ x: s.x, y: s.y, hw: s.hw * 1.1, hh: s.hh * 1.15, rot: s.rot, strength: 1 + 0.4 * (1 - s.k), seed: s.seed });
    const scr = heads.map((h) => ({ ...applyXf(m, h.x, h.y), k: h.k, r: 3.5 * cam.z }));
    const screen = this.screenAt(t);
    this.paper.render(this.ctx.renderer, L.upload(), m, cam.z, out, { stamps, heads: scr, screen });
    this.hud.clear();
    this.drawHud(this.hud.ctx, t, m, screen);
    this.ctx.comp.draw(this.ctx.renderer, this.hud.upload(), out);
    return { ...(screen ? SCREEN_POST : PAPER_POST), hud: 1 };
  }

  /** Which medium: the documents on paper, the system's schematic on screen (hard cuts on the beat). */
  screenAt(t: number) { return (t >= this.tRouteA && t < this.tWhipB) || t >= this.tRouteB ? 1 : 0; }

  // ------------------------------------------------------------------ the system's eye
  drawHud(c: Ctx2, t: number, m: ReturnType<typeof camXf>, screen: number) {
    const box = (x0: number, y0: number, x1: number, y1: number) => {
      const a = applyXf(m, x0, y0), b = applyXf(m, x1, y1);
      return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
    };
    c.save();
    c.textBaseline = 'alphabetic';
    if (!screen && t < this.tWhipB) {
      // A: the scanner over the law extract
      this.scanner(c, t, box(DA.x - DA.hw, DA.y - DA.hh, DA.x + DA.hw, DA.y + DA.hh), '材料上传 · 智能预审', this.tUnder[0]! - 0.25, this.tUnder[3]! + 0.25);
      // each article, as the laser passes it, gets its status
      const t0 = this.tUnder[0]! - 0.25, t1 = this.tUnder[3]! + 0.25;
      this.arts.forEach((a, i) => {
        const yb = a.y + (a.lines.length - 1) * ART_LEAD;
        const tp = lerp(t0, t1, (yb + 20 - (DA.y - DA.hh)) / (DA.hh * 2));
        if (t < tp) return;
        const p = applyXf(m, DA.x + DA.hw + 20, a.y - 6);
        const red = UNDER.includes(i);
        if (red) glowOn(c, 0.8);
        sysTag(c, a.tag, Math.min(p.x, 1880 - 300), p.y + 10, red ? SYS.red : 'rgba(84,88,91,0.94)', '#fff', prog(t, tp, tp + 0.25), 16);
        glowOff(c);
      });
      sysPanel(c, 1390, 700, 420, '预审 · 附件 1 · 宪法', [
        { k: '判定', v: '情绪化诉求', t: this.tUnder[3]!, red: true },
        { k: '处理', v: '已收悉 · 归档', t: this.tStampA },
      ], t);
    } else if (!screen) {
      // B: the scanner over the test report
      this.scanner(c, t, box(DB.x - DB.hw, DB.y - DB.hh, DB.x + DB.hw, DB.y + DB.hh), '材料上传 · 智能预审', this.tTrace0 - 0.2, this.tBox[3]! + 0.2);
      const tx = DB.x - DB.hw + 40, ty = DB.y + 190;
      for (let i = 0; i < 3; i++) {
        if (t < this.tBox[i]!) continue;
        const b = box(tx + 400, ty + 72 + i * 40 - 30, tx + 490, ty + 72 + i * 40 + 14);
        c.fillStyle = SYS.dim;
        label(c, '阴性 · 0.99', b.x + b.w + 10, b.y + b.h - 10, 12, 500, 2);
      }
      sysPanel(c, 60, 640, 420, '预审 · 附件 2 · 检测报告', [
        { k: '结果 阴性', v: '不予采信', t: this.tBox[3]!, red: true },
        { k: '理由', v: '非指定机构', t: this.tStampB },
      ], t);
    } else {
      // the system's schematic: workflow chrome, then the detectors on the section
      chrome(c, t, '材料流转 · 来访人 0472');
      if (t >= this.tWide) {
        const kk = this.kidK(t);
        const h = PERSON.h * lerp(1, 0.66, kk);
        const pb = box(PERSON.x - 110, FLOOR - h - 30, PERSON.x + 110, FLOOR + 6);
        const kp = prog(t, this.tWide, this.tWide + 0.2, ease.outCubic);
        brackets(c, pb.x, pb.y, pb.w, pb.h, SYS.red, kp, 22, 2.5);
        glowOn(c, 0.7);
        sysTag(c, '来访人 0472', pb.x, pb.y - 4, SYS.red, '#fff', prog(t, this.tWide, this.tWide + 0.3));
        glowOff(c);
        c.fillStyle = SYS.fg;
        if (t >= this.tSight) label(c, `情绪 · 激动`, pb.x, pb.y + pb.h + 34, 22, 600, 3);
        // the official: tracked too, and his face blanked out by policy
        const ob = box(OFFICIAL.x - 90, FLOOR - OFFICIAL.h - 40, OFFICIAL.x + 90, 0);
        brackets(c, ob.x, ob.y, ob.w, ob.h, SYS.dim, kp, 18, 1.5);
        sysTag(c, '工作人员 · 已脱敏', ob.x, ob.y - 4, 'rgba(84,88,91,0.9)', '#fff', prog(t, this.tWide + 0.2, this.tWide + 0.6), 14);
        // the age estimator: reads the visitor as a child
        if (t >= this.tCloud0) {
          const age = Math.round(lerp(34, 7, ease.inOutCubic(prog(t, this.tKid, this.tKid + 0.35))));
          sysPanel(c, pb.x + pb.w + 30, Math.max(120, pb.y), 340, '人脸属性分析', [
            { k: '估计年龄', v: `${age} 岁`, t: this.tCloud0, red: t >= this.tKid },
            { k: '处置建议', v: '劝返', t: this.tKid + 0.35 },
          ], t);
        }
      }
    }
    c.restore();
  }

  /** The scanner's chrome over a page (screen box): frame, header, the red laser sweeping between t0..t1. */
  scanner(c: Ctx2, t: number, b: { x: number; y: number; w: number; h: number }, title: string, t0: number, t1: number) {
    brackets(c, b.x - 14, b.y - 14, b.w + 28, b.h + 28, SYS.fg, 1, 34, 2);
    chrome(c, t, title);
    const k = prog(t, t0, t1, ease.inOutQuad);
    c.fillStyle = SYS.dim; c.fillRect(40, 92, 300, 4);
    c.fillStyle = SYS.red; c.fillRect(40, 92, 300 * k, 4);
    if (k > 0 && k < 1) {
      const y = b.y + b.h * k;
      glowOn(c, 1.6);
      c.fillStyle = SYS.red;
      c.fillRect(b.x - 30, y - 1.5, b.w + 60, 3);
      glowOff(c);
      const gr = c.createLinearGradient(0, y - 120, 0, y);
      gr.addColorStop(0, 'rgba(200,50,31,0)'); gr.addColorStop(1, 'rgba(200,50,31,0.14)');
      c.fillStyle = gr; c.fillRect(b.x - 30, y - 120, b.w + 60, 120);
    }
  }

  // ------------------------------------------------------------------ drawing
  drawSheet(c: Ctx2) {
    c.strokeStyle = PRINT(0.7); c.lineWidth = 2;
    c.strokeRect(SHEET.x0, SHEET.y0, SHEET.x1 - SHEET.x0, SHEET.y1 - SHEET.y0);
    c.lineWidth = 0.8;
    c.strokeRect(SHEET.x0 + 14, SHEET.y0 + 14, SHEET.x1 - SHEET.x0 - 28, SHEET.y1 - SHEET.y0 - 28);
    // zone marks along the border
    c.fillStyle = PRINT(0.6);
    for (let i = 0; i < 8; i++) {
      const x = lerp(SHEET.x0, SHEET.x1, (i + 0.5) / 8);
      label(c, String(i + 1), x, SHEET.y0 + 11, 10, 500, 0, 'center');
      label(c, String(i + 1), x, SHEET.y1 - 3, 10, 500, 0, 'center');
    }
    for (let i = 0; i < 5; i++) {
      const y = lerp(SHEET.y0, SHEET.y1, (i + 0.5) / 5) + 4;
      label(c, 'ABCDE'[i]!, SHEET.x0 + 7, y, 10, 500, 0, 'center');
      label(c, 'ABCDE'[i]!, SHEET.x1 - 7, y, 10, 500, 0, 'center');
    }
  }

  detailFrame(c: Ctx2, d: typeof DA, tag: string, att: string) {
    c.strokeStyle = PRINT(0.8); c.lineWidth = 1;
    c.setLineDash([14, 5, 3, 5]);
    c.strokeRect(d.x - d.hw - 40, d.y - d.hh - 40, (d.hw + 40) * 2, (d.hh + 40) * 2);
    c.setLineDash([]);
    c.fillStyle = PRINT(1);
    c.font = font(F.hei(700), 22);
    c.fillText(tag, d.x - d.hw - 40, d.y - d.hh - 56);
    c.fillStyle = PRINT(0.75);
    label(c, att, d.x + d.hw + 40, d.y - d.hh - 58, 13, 500, 3, 'right');
    // the page itself (paper on paper: an outline and a soft shadow line)
    c.strokeStyle = INK(0.8); c.lineWidth = 1.3;
    c.strokeRect(d.x - d.hw, d.y - d.hh, d.hw * 2, d.hh * 2);
    c.fillStyle = PRINT(0.25);
    c.fillRect(d.x - d.hw + 6, d.y + d.hh, d.hw * 2, 5);
    c.fillRect(d.x + d.hw, d.y - d.hh + 6, 5, d.hh * 2);
  }

  drawDetailA(c: Ctx2, t: number) {
    const d = DA;
    this.detailFrame(c, d, '详图 A', '附件 1');
    c.fillStyle = INK(0.95);
    c.textAlign = 'center';
    c.font = font(F.song(900), 44);
    c.fillText('中华人民共和国宪法', d.x, d.y - d.hh + 82);
    c.font = font(F.song(500), 24);
    c.fillText('（摘录）', d.x, d.y - d.hh + 122);
    c.textAlign = 'left';
    c.fillStyle = INK(0.55);
    c.fillRect(d.x - d.hw + 40, d.y - d.hh + 145, d.hw * 2 - 80, 1.2);
    for (const a of this.arts) {
      c.fillStyle = INK(0.92);
      c.font = font(F.hei(700), 24);
      c.fillText(a.n, d.x - d.hw + 40, a.y);
      c.font = font(F.fang(), ART_SIZE);
      a.lines.forEach((l, j) => c.fillText(l, d.x - d.hw + 190, a.y + j * ART_LEAD));
    }
    c.fillStyle = INK(0.6);
    c.textAlign = 'center';
    c.font = font(F.song(400), 18);
    c.fillText('— 1 —', d.x, d.y + d.hh - 26);
    c.textAlign = 'left';
  }

  drawDetailB(c: Ctx2, t: number) {
    const d = DB;
    this.detailFrame(c, d, '详图 B', '附件 2 · 共 11 页');
    c.fillStyle = INK(0.92);
    c.textAlign = 'center';
    c.font = font(F.song(700), 34);
    c.fillText('检 测 报 告', d.x, d.y - d.hh + 70);
    c.textAlign = 'left';
    c.fillStyle = INK(0.38);
    greek(c, d.x - d.hw + 40, d.y - d.hh + 118, d.hw * 2 - 80, 2, 22, 7, 300);
    // the chart: axes, a dashed threshold, the samples
    const ax = d.x - 250, ay = d.y + 120, aw = 500, ah = 200;
    c.strokeStyle = INK(0.85); c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(ax, ay - ah); c.lineTo(ax, ay); c.lineTo(ax + aw, ay); c.stroke();
    c.lineWidth = 1;
    for (let i = 0; i <= 12; i++) { c.beginPath(); c.moveTo(ax + 20 + i * 37, ay); c.lineTo(ax + 20 + i * 37, ay + 5); c.stroke(); }
    c.strokeStyle = INK(0.6); c.setLineDash([8, 6]);
    c.beginPath(); c.moveTo(ax, ay - 160); c.lineTo(ax + aw, ay - 160); c.stroke();
    c.setLineDash([]);
    c.fillStyle = INK(0.75);
    c.font = font(F.hei(500), 14);
    c.fillText('阈值', ax + aw - 34, ay - 168);
    c.fillText('检测值', ax - 8, ay - ah - 12);
    c.fillText('样本', ax + aw - 26, ay + 24);
    c.fillStyle = INK(0.9);
    for (const p of this.data) { c.beginPath(); c.arc(p.x, p.y, 3.2, 0, Math.PI * 2); c.fill(); }
    // the table: three rows, the result column legible
    const tx = d.x - d.hw + 40, ty = d.y + 190, tw = d.hw * 2 - 80;
    c.fillStyle = INK(0.8);
    c.fillRect(tx, ty, tw, 1.4);
    c.font = font(F.hei(700), 15);
    c.fillText('样本编号', tx + 6, ty + 26); c.fillText('检测项目', tx + 190, ty + 26); c.fillText('结果', tx + 420, ty + 26);
    c.fillRect(tx, ty + 38, tw, 1);
    for (let i = 0; i < 3; i++) {
      const y = ty + 72 + i * 40;
      c.fillStyle = INK(0.38);
      greek(c, tx + 6, y, 130, 1, 0, 7, 400 + i);
      greek(c, tx + 190, y, 170, 1, 0, 7, 420 + i);
      c.fillStyle = INK(0.92);
      c.font = font(F.fang(), 24);
      c.fillText('阴性', tx + 420, y + 2);
    }
    c.fillStyle = INK(0.8);
    c.fillRect(tx, ty + 170, tw, 1.4);
  }

  drawSection(c: Ctx2, t: number) {
    // floor, ceiling, the counter in section
    c.strokeStyle = INK(0.9); c.lineWidth = 2;
    c.beginPath(); c.moveTo(-1100, FLOOR); c.lineTo(1100, FLOOR); c.stroke();
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-1100, CEIL); c.lineTo(1100, CEIL); c.stroke();
    c.strokeStyle = PRINT(0.55); c.lineWidth = 1;
    hatchRect(c, -1100, FLOOR, 2200, 26, 9);
    hatchRect(c, -1100, CEIL - 22, 2200, 22, 9);
    // the official, behind the counter (above the counter top only)
    c.save();
    c.beginPath(); c.rect(COUNTER.x0, CEIL, 1000, -CEIL); c.clip();
    drawFigure(c, 'suit', OFFICIAL.x, FLOOR, OFFICIAL.h, { stroke: INK(0.85), lw: 1.4, hatch: PRINT(0.6) }, -1);
    c.restore();
    c.strokeStyle = INK(0.9); c.lineWidth = 1.6;
    c.strokeRect(COUNTER.x0, 0, COUNTER.x1 - COUNTER.x0, FLOOR);
    c.strokeStyle = PRINT(0.5); c.lineWidth = 1;
    hatchRect(c, COUNTER.x0, 0, COUNTER.x1 - COUNTER.x0, FLOOR, 10);
    c.fillStyle = PRINT(0.85);
    c.font = font(F.hei(500), 15);
    c.fillText('工作人员', OFFICIAL.x - 30, FLOOR + 52);

    // the partition: a 12 mm pane over the slot, then the layers, each closing the slot from the ceiling down
    const base = 12 / MM;
    c.strokeStyle = INK(0.9); c.lineWidth = 1.3;
    c.strokeRect(COUNTER.x0 - base, PART_TOP, base, -PART_TOP - SLOT);
    let x = COUNTER.x0 - base;
    for (const l of this.layers) {
      const k = prog(t, l.t - 0.05, l.t + 0.12, ease.inCubic);
      if (k <= 0) continue;
      const w = l.mm / MM;
      const yTop = PART_TOP, yBot = lerp(PART_TOP - 400, 0, k);
      c.strokeStyle = INK(0.85); c.lineWidth = 1.1;
      c.strokeRect(x - w, Math.min(yTop, yBot - 470), w, Math.max(0, yBot - Math.min(yTop, yBot - 470)));
      // sheets edge-on: hairlines across the thickness
      c.strokeStyle = PRINT(0.55); c.lineWidth = 0.7;
      c.beginPath();
      for (let s = 2.5; s < w - 1; s += 2.5) { c.moveTo(x - s, Math.max(yTop, yBot - 470)); c.lineTo(x - s, yBot); }
      c.stroke();
      // the leader to its name
      if (k >= 1 && w > 5) {
        c.fillStyle = PRINT(0.85);
        c.font = font(F.hei(500), 12);
        c.save(); c.translate(x - w / 2 + 4, PART_TOP - 8); c.rotate(-Math.PI / 2);
        c.fillText(l.name, 0, 0);
        c.restore();
      }
      x -= w * clamp(k);
    }
    // the slot (while open) and its label
    if (t < this.tDropA) {
      c.fillStyle = PRINT(0.8);
      c.font = font(F.hei(500), 14);
      c.fillText('递件口', COUNTER.x0 + 14, -SLOT / 2 + 5);
    }
    // the thickness, dimensioned above the partition
    const mm = this.thickness(t);
    c.strokeStyle = INK(0.75); c.fillStyle = INK(0.9); c.lineWidth = 1;
    dimension(c, COUNTER.x0 - mm / MM, PART_TOP - 70, COUNTER.x0, PART_TOP - 70, '', 0, 13);
    c.font = font(F.mono(500), 18);
    c.textAlign = 'right';
    c.fillText(`${Math.round(mm)}`, COUNTER.x0 - mm / MM / 2 + 2, PART_TOP - 82);
    c.textAlign = 'left';
    c.font = font(F.hei(500), 14);
    c.fillText('隔断厚度（mm）', COUNTER.x0 + 12, PART_TOP - 66);
    // the note: what the partition is made of
    c.fillStyle = PRINT(0.9);
    c.font = font(F.hei(400), 14);
    c.fillText('注：呈递材料一经收悉，即作为隔断材料使用。', 760, 400);

    // the visitor: adult, then redrawn at another scale
    const kk = this.kidK(t);
    const h = PERSON.h * lerp(1, 0.66, kk);
    c.save();
    c.translate(PERSON.x, FLOOR);
    c.scale(lerp(1, 1.06, kk), 1);
    drawFigure(c, kk > 0.5 ? 'child' : 'adult', 0, 0, h, { fill: PRINT(0.62), stroke: INK(0.9), lw: 1.3 });
    c.restore();
    c.fillStyle = PRINT(0.85);
    c.font = font(F.hei(500), 15);
    c.fillText('来访人', PERSON.x - 24, FLOOR + 52);
    // height dimension on the visitor
    c.strokeStyle = INK(0.6); c.fillStyle = INK(0.85); c.lineWidth = 0.9;
    const mmH = Math.round(lerp(1720, 1100, clamp(kk)) / 10) * 10;
    dimension(c, PERSON.x - 90, FLOOR, PERSON.x - 90, FLOOR - h, String(mmH), 0, 12);

    // his sightline: a hidden line (dashed) from the visor through the wall to the visitor's head
    const k = prog(t, this.tSight, this.tSight + this.beat * 1.5, ease.inOutQuad);
    if (k > 0) {
      const ex = OFFICIAL.x - 0.04 * OFFICIAL.h, ey = FLOOR - 0.93 * OFFICIAL.h;
      const hx = PERSON.x + 4, hy = FLOOR - h * (kk > 0.5 ? 0.83 : 0.928);
      c.strokeStyle = INK(0.8); c.lineWidth = 1.1;
      c.setLineDash([12, 7]);
      c.beginPath(); c.moveTo(ex, ey); c.lineTo(lerp(ex, hx, k), lerp(ey, hy, k)); c.stroke();
      c.setLineDash([]);
      if (k >= 1) {
        const ang = Math.atan2(hy - ey, ex - hx) * (180 / Math.PI);
        c.fillStyle = INK(0.85);
        c.font = font(F.hei(500), 14);
        c.fillText(`视线 · 俯角 ${Math.max(0, ang).toFixed(0)}°`, ex - 190, ey - 14);
      }
    }
  }

  stampA(t: number) {
    const k = prog(t, this.tStampA, this.tStampA + 0.06, ease.outQuad);
    return { on: t >= this.tStampA, k, x: DA.x + 160, y: DA.y + DA.hh - 95, hw: 150, hh: 66, rot: -0.09, seed: 3.7 };
  }
  stampB(t: number) {
    const k = prog(t, this.tStampB, this.tStampB + 0.06, ease.outQuad);
    return { on: false, k, x: DB.x - 70, y: DB.y - 170, hw: 150, hh: 66, rot: 0.07, seed: 9.1 }; // (one stamp per film idea: only the Constitution gets 已收悉)
  }

  /** A submission route, drawn by length; the wall it ends at swallows its end as it thickens. */
  drawSubmission(c: Ctx2, t: number, r: Route, t0: number, t1: number, heads: (V2 & { k: number })[]) {
    const face = COUNTER.x0 - this.thickness(t) / MM;
    c.save();
    c.beginPath(); c.rect(-5000, -5000, 10000, 10000); c.rect(face, PART_TOP - 2, COUNTER.x0 + 40 - face, -PART_TOP + 4); c.clip('evenodd');
    c.lineWidth = 3;
    const len = r.total * prog(t, t0, t1, ease.inOutQuad);
    const h = drawRoute(c, r, len);
    c.restore();
    if (len >= r.total) arrowHead(c, Math.min(h.x, face) + 1, h.y, h.angle, 16);
    else heads.push({ x: h.x, y: h.y, k: 1 });
  }

  /** Everything vermilion: underlines, traces, boxes, routes, stamps, the revision cloud. Returns pen heads. */
  drawRed(c: Ctx2, t: number) {
    const heads: (V2 & { k: number })[] = [];
    c.strokeStyle = RED(1); c.fillStyle = RED(1);
    c.lineCap = 'square'; c.lineJoin = 'miter';
    // A: one underline per article, ruled under its first text line
    c.lineWidth = 3;
    this.tUnder.forEach((tu, i) => {
      const k = prog(t, tu, tu + 0.22, ease.outCubic);
      if (k <= 0) return;
      const y = this.underY(UNDER[i]!);
      const xa = DA.x - DA.hw + 190, xb = DA.x + DA.hw - 40;
      c.beginPath(); c.moveTo(xa, y); c.lineTo(lerp(xa, xb, k), y); c.stroke();
      if (k < 1) heads.push({ x: lerp(xa, xb, k), y, k: 1 });
    });
    // A: the route to the slot; the arrow stays on the partition's face as it thickens
    if (t >= this.tRouteA) this.drawSubmission(c, t, this.routeA, this.tRouteA, this.tDropA, heads);
    // B: the data traced on 科学, a box round each 阴性 on 依据
    if (t >= this.tTrace0) {
      const len = this.dataRoute.total * prog(t, this.tTrace0, this.tTrace1, ease.inOutQuad);
      c.lineWidth = 2.6;
      const h = drawRoute(c, this.dataRoute, len);
      if (len < this.dataRoute.total) heads.push({ x: h.x, y: h.y, k: 1 });
    }
    const tx = DB.x - DB.hw + 40, ty = DB.y + 190;
    c.lineWidth = 2.4;
    for (let i = 0; i < 3; i++) {
      const k = prog(t, this.tBox[i]!, this.tBox[i]! + 0.2, ease.outCubic);
      if (k <= 0) continue;
      const bx = tx + 410, by = ty + 72 + i * 40 - 26, bw = 70, bh = 36;
      const r = route([{ x: bx, y: by }, { x: bx + bw, y: by }, { x: bx + bw, y: by + bh }, { x: bx, y: by + bh }, { x: bx, y: by - 1.2 }]);
      drawRoute(c, r, r.total * k);
    }
    if (t >= this.tRouteB) this.drawSubmission(c, t, this.routeB, this.tRouteB, this.tDropB, heads);
    // the stamps
    for (const s of [this.stampA(t), this.stampB(t)]) if (s.on) drawStamp(c, s.x, s.y, s.hw, s.hh, s.rot, '已收悉', '仅表示收到', s.k);
    // D: the revision cloud round the visitor, then the delta tag and its log line
    const ck = prog(t, this.tCloud0, this.tCloud1 + 0.1, ease.inOutQuad);
    if (ck > 0) {
      c.lineWidth = 2.4; c.lineCap = 'round';
      const pts = cloudPath(PERSON.x + 8, FLOOR - 330, 150, 290, 14);
      const r = route(pts);
      const h = drawRoute(c, r, r.total * ck);
      if (ck < 1) heads.push({ x: h.x, y: h.y, k: 1 });
      c.lineCap = 'square';
    }
    if (t >= this.tKid) {
      const k = prog(t, this.tKid, this.tKid + 0.12, ease.outCubic);
      const x = PERSON.x - 150, y = FLOOR - 640;
      c.lineWidth = 2.2;
      c.beginPath(); c.moveTo(x, y - 26 * k); c.lineTo(x - 22 * k, y + 13 * k); c.lineTo(x + 22 * k, y + 13 * k); c.closePath(); c.stroke();
      c.font = font(F.mono(700), 18);
      c.textAlign = 'center'; c.fillText('1', x, y + 9); c.textAlign = 'left';

    }
    return heads;
  }

  drawTitle(c: Ctx2, t: number) {
    const x0 = 760, y0 = 430, x1 = SHEET.x1 - 14, y1 = SHEET.y1 - 14;
    c.strokeStyle = INK(0.85); c.lineWidth = 1.4;
    c.strokeRect(x0, y0, x1 - x0, y1 - y0);
    c.lineWidth = 0.9;
    c.beginPath();
    c.moveTo(x0, y0 + 96); c.lineTo(x1, y0 + 96);
    c.moveTo(x0, y0 + 160); c.lineTo(x1, y0 + 160);
    c.moveTo(x0 + 250, y0 + 96); c.lineTo(x0 + 250, y1);
    c.stroke();
    c.fillStyle = INK(0.95);
    c.font = font(F.song(900), 46);
    c.fillText('图版 03', x0 + 22, y0 + 66);
    c.font = font(F.hei(500), 18);
    c.fillText('材料呈递 · 剖面', x0 + 250, y0 + 62);
    c.fillStyle = INK(0.8);
    c.font = font(F.hei(400), 15);
    c.fillText('比例', x0 + 22, y0 + 136); c.fillText('1 : 20', x0 + 130, y0 + 136);
    c.fillText('审核', x0 + 272, y0 + 136);
    c.fillText('修订', x0 + 22, y0 + 196);
    c.fillText(t >= this.tLog ? '△1' : '—', x0 + 130, y0 + 196);
    c.fillStyle = INK(0.45);
    c.fillRect(x0 + 330, y0 + 140, 150, 1);
  }
}

function drawRouteHead(r: Route, len: number) {
  const L = r.L, pts = r.pts;
  let i = 1;
  while (i < pts.length - 1 && L[i]! < len) i++;
  const a = pts[i - 1]!, b = pts[i]!;
  const seg = L[i]! - L[i - 1]!;
  const u = seg > 0 ? clamp((len - L[i - 1]!) / seg) : 0;
  return { x: lerp(a.x, b.x, u), y: lerp(a.y, b.y, u) };
}

/** A revision cloud: scalloped arcs round an ellipse (polyline, drawn by length like any route). */
function cloudPath(cx: number, cy: number, rx: number, ry: number, n: number): V2[] {
  const pts: V2[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
    const p0 = { x: cx + Math.cos(a0) * rx, y: cy + Math.sin(a0) * ry }, p1 = { x: cx + Math.cos(a1) * rx, y: cy + Math.sin(a1) * ry };
    const mx = (p0.x + p1.x) / 2, my = (p0.y + p1.y) / 2, ch = Math.hypot(p1.x - p0.x, p1.y - p0.y) / 2;
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x);
    for (let k = 0; k <= 8; k++) {
      const u = Math.PI - (k / 8) * Math.PI;
      pts.push({ x: mx + Math.cos(ang) * Math.cos(u) * ch + Math.cos(ang - Math.PI / 2) * Math.sin(u) * ch * 0.8, y: my + Math.sin(ang) * Math.cos(u) * ch + Math.sin(ang - Math.PI / 2) * Math.sin(u) * ch * 0.8 });
    }
  }
  return pts;
}

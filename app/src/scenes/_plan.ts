// The apartment, in plan (住宅平面 1:50): shared by `home` (where the cat lived) and `fog` (where the suit walks
// in). Page px, origin at the plan's centre. Drawn in channel-coded inks (see _archive.ts).
import { F, font } from '../engine/type';
import { hash, lerp, type V2 } from '../engine/util';
import { INK, PRINT, hatchRect, label, type Ctx2 } from './_archive';

export const PLAN = { x0: -820, y0: -500, x1: 820, y1: 500, wall: 26 };
export const DOOR = { x: -600, y: 500, w: 110 };              // entrance, bottom wall
export const WINDOW = { x0: -160, x1: 220, y: -500 };          // living-room window, top wall
export const BOX = { x: 120, y: 240, w: 120, h: 90 };          // the cardboard box (its favourite place)
export const BOWL = { x: -650, y: -330 };                       // the bowls, kitchen corner
export const SUN = [{ x: -150, y: -474 }, { x: 230, y: -474 }, { x: 330, y: -150 }, { x: -50, y: -150 }]; // the sun patch
/** The paw-print trail: window sill → sun patch → bowls → sofa → box. */
export const TRAIL: V2[] = [
  { x: 40, y: -420 }, { x: 80, y: -300 }, { x: 20, y: -200 }, { x: -200, y: -170 }, { x: -420, y: -230 }, { x: -600, y: -300 },
  { x: -560, y: -120 }, { x: -380, y: 40 }, { x: -150, y: 160 }, { x: 40, y: 230 }, { x: 110, y: 250 },
];
/** The suit's way in: from the corridor, through the door, to the box. */
export const ENTRY: V2[] = [{ x: -545, y: 760 }, { x: -545, y: 470 }, { x: -545, y: 330 }, { x: -200, y: 330 }, { x: 60, y: 300 }, { x: 110, y: 285 }];

/** Walls (poché), openings, furniture. */
export function drawPlan(c: Ctx2) {
  const { x0, y0, x1, y1, wall } = PLAN;
  c.save();
  // walls: hatched poché between two outlines, with the openings left out
  c.strokeStyle = INK(0.9); c.lineWidth = 1.6;
  const seg = (ax: number, ay: number, bx: number, by: number) => {
    const w = Math.abs(bx - ax) || wall, h = Math.abs(by - ay) || wall;
    const x = Math.min(ax, bx) - (bx === ax ? wall / 2 : 0), y = Math.min(ay, by) - (by === ay ? wall / 2 : 0);
    c.strokeStyle = INK(0.9); c.strokeRect(x, y, w, h);
    c.strokeStyle = PRINT(0.6); c.lineWidth = 1; hatchRect(c, x, y, w, h, 6); c.lineWidth = 1.6;
  };
  seg(x0, y0, WINDOW.x0, y0); seg(WINDOW.x1, y0, x1, y0);
  seg(x1, y0, x1, y1);
  seg(x0, y1, DOOR.x - DOOR.w / 2, y1); seg(DOOR.x + DOOR.w / 2, y1, x1, y1);
  seg(x0, y0, x0, y1);
  // interior walls: bedroom (right), kitchen (top left)
  seg(380, y0, 380, -60); seg(380, 60, 380, y1);
  seg(x0, -140, -480, -140);
  // the window: three thin lines in the gap
  c.strokeStyle = INK(0.8); c.lineWidth = 1;
  for (const d of [-8, 0, 8]) { c.beginPath(); c.moveTo(WINDOW.x0, y0 + d); c.lineTo(WINDOW.x1, y0 + d); c.stroke(); }
  // the door leaf and its swing
  c.beginPath(); c.moveTo(DOOR.x - DOOR.w / 2, y1); c.lineTo(DOOR.x - DOOR.w / 2, y1 - DOOR.w); c.stroke();
  c.setLineDash([6, 5]);
  c.beginPath(); c.arc(DOOR.x - DOOR.w / 2, y1, DOOR.w, -Math.PI / 2, 0); c.stroke();
  c.setLineDash([]);
  // furniture (printed, lighter)
  c.strokeStyle = PRINT(0.85); c.lineWidth = 1.3;
  c.strokeRect(500, -420, 260, 330); c.strokeRect(520, -410, 220, 70);           // bed + pillow
  c.strokeRect(-260, 300, 340, 120); c.strokeRect(-260, 300, 340, 34);           // sofa
  c.strokeRect(-200, 120, 200, 110);                                            // low table
  c.strokeRect(x0 + 20, y0 + 20, 320, 70); c.strokeRect(x0 + 20, y0 + 20, 70, 320); // kitchen counters
  c.beginPath(); c.arc(-470, -380, 34, 0, Math.PI * 2); c.stroke();             // the cat tree (platforms)
  c.beginPath(); c.arc(-470, -380, 18, 0, Math.PI * 2); c.stroke();
  // the box and the bowls
  c.strokeStyle = INK(0.85); c.lineWidth = 1.4;
  c.strokeRect(BOX.x - BOX.w / 2, BOX.y - BOX.h / 2, BOX.w, BOX.h);
  c.beginPath(); c.moveTo(BOX.x - BOX.w / 2, BOX.y - BOX.h / 2); c.lineTo(BOX.x - BOX.w / 2 - 30, BOX.y - BOX.h / 2 - 22); c.stroke();
  c.beginPath(); c.moveTo(BOX.x + BOX.w / 2, BOX.y - BOX.h / 2); c.lineTo(BOX.x + BOX.w / 2 + 30, BOX.y - BOX.h / 2 - 22); c.stroke();
  for (const dx of [0, 46]) { c.beginPath(); c.arc(BOWL.x + dx, BOWL.y, 16, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.arc(BOWL.x + dx, BOWL.y, 9, 0, Math.PI * 2); c.stroke(); }
  // room names (printed)
  c.fillStyle = PRINT(0.85);
  c.font = font(F.hei(500), 18);
  c.fillText('客厅', -120, 40); c.fillText('卧室', 560, 0); c.fillText('厨房', -780, -170 + 40);
  c.fillStyle = PRINT(0.7);
  label(c, '住宅平面 1:50', x0, y1 + 70, 15, 600, 4);
  c.restore();
}

/** The sun patch (hatched, faint) on the floor under the window. */
export function drawSun(c: Ctx2, k = 1) {
  c.save();
  c.beginPath(); SUN.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y))); c.closePath(); c.clip();
  c.strokeStyle = PRINT(0.35 * k); c.lineWidth = 1;
  hatchRect(c, -200, -500, 600, 400, 9, Math.PI / 4);
  c.restore();
}

/** Paw prints along the trail up to `n` prints (fractional: the last one fades in). */
export function drawPaws(c: Ctx2, n: number, color: (a: number) => string) {
  const steps = trailSteps();
  for (let i = 0; i < Math.min(n, steps.length); i++) {
    const s = steps[i]!;
    const a = Math.min(1, n - i);
    c.save();
    c.translate(s.x, s.y); c.rotate(s.a + Math.PI / 2);
    c.fillStyle = color(0.85 * a);
    c.beginPath(); c.ellipse(0, 4, 7, 6, 0, 0, Math.PI * 2); c.fill();
    for (const [dx, dy] of [[-7, -6], [-2.5, -10], [2.5, -10], [7, -6]]) { c.beginPath(); c.ellipse(dx!, dy!, 2.4, 3, 0, 0, Math.PI * 2); c.fill(); }
    c.restore();
  }
  return steps.length;
}

let STEPS: { x: number; y: number; a: number }[] | null = null;
export function trailSteps() {
  if (STEPS) return STEPS;
  const out: { x: number; y: number; a: number }[] = [];
  let k = 0;
  for (let i = 0; i < TRAIL.length - 1; i++) {
    const a = TRAIL[i]!, b = TRAIL[i + 1]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
    for (let d = 0; d < len; d += 38) {
      const u = d / len, side = k % 2 ? 1 : -1;
      out.push({ x: lerp(a.x, b.x, u) - Math.sin(ang) * 9 * side + (hash(k, 3) - 0.5) * 3, y: lerp(a.y, b.y, u) + Math.cos(ang) * 9 * side, a: ang });
      k++;
    }
  }
  return (STEPS = out);
}

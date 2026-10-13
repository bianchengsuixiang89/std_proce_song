// The edit: which plate plays when. Boundaries are anchored to lyric lines and snapped to the beat grid,
// so they follow the aligned data (data/lyrics.json, data/audio.json); nothing here is a hard-coded second.
// Plates (docs/TREATMENT.md): home · fog · notice · petition · spectacle · hotline · glass · shred · index · bus (+ coda).
import type { TimelineEntry } from './engine/engine';
import type { SceneClass } from './engine/scene';
import type { Lyrics } from './engine/lyrics';
import type { AudioData } from './engine/audio';

// Scene modules are discovered lazily so a missing/broken scene never breaks the build.
const modules = import.meta.glob<{ default: SceneClass }>('./scenes/*.ts');
const scene = (name: string) => () => {
  const m = modules[`./scenes/${name}.ts`];
  return m ? m() : Promise.reject(new Error(`scene module not found: scenes/${name}.ts`));
};

export function makeTimeline(ly: Lyrics, au: AudioData): TimelineEntry[] {
  /** Cut on the last beat at/before the first sung character of the matching line (never after it). */
  const cut = (q: string, nth = 0, tol = 0.02) => {
    const s = ly.get(q, nth).words[0]!.start;
    return au.timeOfBeat(Math.floor(au.beatAt(s + tol)));
  };
  /** First beat after the end of a line (a plate that opens in the gap before the next line). */
  const gap = (q: string, nth = 0) => au.timeOfBeat(Math.ceil(au.beatAt(ly.get(q, nth).end)));
  /** Nearest downbeat to the end of a line. */
  const after = (q: string, nth = 0) => {
    const e = ly.get(q, nth).end;
    return au.downbeats.reduce((b, d) => (Math.abs(d - e) < Math.abs(b - e) ? d : b), au.downbeats[0] ?? e);
  };

  const b = {
    fog: cut('穿着白色防护服的人'),
    notice: cut('他手里那张纸'),
    petition: cut('你问他法律条文'),
    spectacle: cut('继续闹吧', 0),
    hotline: cut('你说你认识局长'),
    glass: cut('你上前一步'),
    shred: cut('像碾碎可笑的法律'),
    index: cut('继续闹吧', 1),
    // (opens in the instrumental gap after the last chorus line: the envelope needs time to be read)
    bus: gap('怎么连绝望都听出了旋律'),
    // the last line's held note, then the instrumental tail
    outro: after('一个坏了的玩具'),
    end: au.duration,
  };

  const E = (id: string, file: string, start: number, end: number, extra: Partial<TimelineEntry> = {}): TimelineEntry =>
    ({ id, load: scene(file), start, end, ...extra });

  return [
    E('home', 'home', 0, b.fog),
    E('fog', 'fog', b.fog, b.notice),
    E('notice', 'notice', b.notice, b.petition),
    E('petition', 'petition', b.petition, b.spectacle),
    E('spectacle', 'chorus', b.spectacle, b.hotline, { params: { n: 1 } }),
    E('hotline', 'hotline', b.hotline, b.glass),
    E('glass', 'glass', b.glass, b.shred),
    E('shred', 'shred', b.shred, b.index),
    E('index', 'chorus', b.index, b.bus, { params: { n: 2 } }),
    E('bus', 'bus', b.bus, b.outro),
    // the outro is the bus plate's coda (the same sheet: the card holds still, the next card comes in);
    // frames are a function of t only, so the cut between the two entries is seamless
    E('outro', 'bus', b.outro, b.end),
  ];
}

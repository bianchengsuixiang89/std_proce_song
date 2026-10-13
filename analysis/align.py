"""Character-level lyric alignment -> data/lyrics.json (the format app/src/engine/lyrics.ts reads).

The words of the song are known (lyrics/lyrics.src.txt); only their times are not. Whisper (faster-whisper,
large-v3) transcribes the mix with word timestamps, the recognised characters are aligned to the known text
by dynamic programming (exact character > same pinyin > mismatch), and characters it missed are
interpolated between their matched neighbours. Each lyric "word" is one character: phrases are looked up
with Lyrics.phrase(). Section starts (## headers in the source) are written into data/audio.json.

Usage: python analysis/align.py audio/song.wav lyrics/lyrics.src.txt data/lyrics.json data/audio.json
The transcription is cached in analysis/cache/whisper.json (delete it to re-run Whisper).
"""
import json
import os
import re
import sys

from pypinyin import lazy_pinyin

CACHE = os.path.join(os.path.dirname(__file__), 'cache', 'whisper.json')
# the model files, fetched from huggingface.co/Systran/faster-whisper-large-v3 with curl (the hub client
# stalls on this network)
MODEL = os.path.join(os.path.dirname(__file__), 'cache', 'faster-whisper-large-v3')
PUNCT = re.compile(r'[\s，。、！？；：“”‘’"\'（）()《》…—\-,.!?;:]')


def read_lyrics(path):
    sections, lines, cur = [], [], None
    for raw in open(path, encoding='utf-8'):
        s = raw.strip()
        if s.startswith('## '):
            cur = s[3:].strip()
            sections.append({'name': cur, 'line': len(lines)})
        elif s and not s.startswith('#'):
            lines.append(PUNCT.sub('', s))
    return sections, lines


def transcribe(audio, prompt):
    if os.path.exists(CACHE):
        return json.load(open(CACHE, encoding='utf-8'))
    from faster_whisper import WhisperModel
    try:
        model = WhisperModel(MODEL, device='cuda', compute_type='float16')
        segs, _ = model.transcribe(audio, language='zh', word_timestamps=True, initial_prompt=prompt,
                                   beam_size=5, vad_filter=False, condition_on_previous_text=False)
        segs = list(segs)
    except Exception as e:  # no usable CUDA runtime: CPU int8 (slower, same model)
        print('cuda failed, falling back to cpu:', str(e)[:200])
        model = WhisperModel(MODEL, device='cpu', compute_type='int8')
        segs, _ = model.transcribe(audio, language='zh', word_timestamps=True, initial_prompt=prompt,
                                   beam_size=5, vad_filter=False, condition_on_previous_text=False)
        segs = list(segs)
    words = [{'w': w.word, 'start': w.start, 'end': w.end, 'p': w.probability} for s in segs for w in (s.words or [])]
    os.makedirs(os.path.dirname(CACHE), exist_ok=True)
    json.dump(words, open(CACHE, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    return words


def recognised_chars(words):
    """Split Whisper's words into characters, sharing each word's span evenly."""
    out = []
    for w in words:
        chars = [c for c in w['w'] if not PUNCT.match(c)]
        if not chars:
            continue
        d = (w['end'] - w['start']) / len(chars)
        for i, c in enumerate(chars):
            out.append({'c': c, 'start': w['start'] + i * d, 'end': w['start'] + (i + 1) * d, 'p': w['p']})
    return out


def py(c):
    p = lazy_pinyin(c)
    return p[0] if p else c


def align(target, rec):
    """Needleman-Wunsch: returns, for each target index, the matched recognised index or None."""
    n, m = len(target), len(rec)
    tp = [py(c) for c in target]
    rp = [py(r['c']) for r in rec]
    GAP = -1.0
    score = [[0.0] * (m + 1) for _ in range(n + 1)]
    back = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        score[i][0] = i * GAP
        back[i][0] = 1
    for j in range(1, m + 1):
        score[0][j] = j * GAP * 0.5  # skipping hallucinated/extra recognised chars is cheap
        back[0][j] = 2
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            a, b = target[i - 1], rec[j - 1]['c']
            s = 3.0 if a == b else 2.0 if tp[i - 1] == rp[j - 1] else -1.0
            opts = (score[i - 1][j - 1] + s, score[i - 1][j] + GAP, score[i][j - 1] + GAP * 0.5)
            k = max(range(3), key=lambda x: opts[x])
            score[i][j] = opts[k]
            back[i][j] = k
    match = [None] * n
    i, j = n, m
    while i > 0 or j > 0:
        k = back[i][j] if i > 0 and j > 0 else (1 if i > 0 else 2)
        if k == 0:
            # a substitution is the same syllable misheard (他 -> 再, 进行 -> 精心): its time is still good
            match[i - 1] = j - 1
            i, j = i - 1, j - 1
        elif k == 1:
            i -= 1
        else:
            j -= 1
    return match


def main(audio, src, dst, audio_json):
    sections, lines = read_lyrics(src)
    target, owner = [], []
    for li, l in enumerate(lines):
        for c in l:
            target.append(c)
            owner.append(li)
    words = transcribe(audio, '，'.join(lines[:24]))
    rec = recognised_chars(words)
    match = align(target, rec)
    n = len(target)
    st = [rec[match[i]]['start'] if match[i] is not None else None for i in range(n)]
    en = [rec[match[i]]['end'] if match[i] is not None else None for i in range(n)]
    print(f'{sum(m is not None for m in match)}/{n} characters matched ({len(rec)} recognised)')

    # interpolate the unmatched characters between matched neighbours (by character count)
    known = [i for i in range(n) if st[i] is not None]
    for i in range(n):
        if st[i] is not None:
            continue
        prev = max((k for k in known if k < i), default=None)
        nxt = min((k for k in known if k > i), default=None)
        if prev is None:
            st[i] = st[nxt] - 0.25 * (nxt - i)
        elif nxt is None:
            st[i] = en[prev] + 0.25 * (i - prev - 1)
        else:
            gap0, gap1 = en[prev], st[nxt]
            k = (i - prev) / (nxt - prev)
            st[i] = gap0 + (gap1 - gap0) * (k - 1 / (nxt - prev)) if gap1 > gap0 else st[prev] + 0.01 * (i - prev)
        en[i] = None
    # monotonic starts; each character ends where the next one starts (inside a line), capped
    for i in range(1, n):
        st[i] = max(st[i], st[i - 1] + 0.03)
    for i in range(n):
        same = i + 1 < n and owner[i + 1] == owner[i]
        nxt = st[i + 1] if i + 1 < n else st[i] + 1.0
        e = en[i] if en[i] is not None else min(nxt, st[i] + 0.35)
        if same:
            e = nxt
        else:
            e = min(max(e, st[i] + 0.2), nxt - 0.02, st[i] + 2.5)
        en[i] = e

    # Whisper opens a segment early: a line's first character often spans the silence before it. If it is
    # far longer than the line's typical character, start it a typical length (x1.3) before its end.
    for li in range(len(lines)):
        idx = [i for i in range(n) if owner[i] == li]
        if len(idx) < 3:
            continue
        durs = sorted(en[i] - st[i] for i in idx[1:-1]) or [0.25]
        med = durs[len(durs) // 2]
        i0 = idx[0]
        if en[i0] - st[i0] > 2.2 * med:
            st[i0] = en[i0] - 1.3 * med

    out_lines = []
    for li, text in enumerate(lines):
        idx = [i for i in range(n) if owner[i] == li]
        ws = [{'w': target[i], 'start': round(st[i], 3), 'end': round(en[i], 3),
               'conf': round(rec[match[i]]['p'], 2) if match[i] is not None else 0.0} for i in idx]
        out_lines.append({'i': li, 'text': text, 'start': ws[0]['start'], 'end': ws[-1]['end'], 'words': ws})
        miss = ''.join('·' if match[i] is None else target[i] for i in idx)
        print(f'{li:2d} {ws[0]["start"]:7.2f}-{ws[-1]["end"]:7.2f}  {text}   [{miss}]')
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump({'lines': out_lines}, f, ensure_ascii=False, indent=1)

    # sections: from the first line of each ## block (the outro runs to the end of the song)
    aj = json.load(open(audio_json, encoding='utf-8'))
    secs = []
    for k, s in enumerate(sections):
        start = 0.0 if k == 0 else out_lines[s['line']]['start']
        end = out_lines[sections[k + 1]['line']]['start'] if k + 1 < len(sections) else aj['duration']
        secs.append({'name': s['name'], 'start': round(start, 3), 'end': round(end, 3)})
    aj['sections'] = secs
    with open(audio_json, 'w', encoding='utf-8') as f:
        json.dump(aj, f, separators=(',', ':'))
    print('sections:', ', '.join(f"{s['name']}@{s['start']:.1f}" for s in secs))


if __name__ == '__main__':
    main(*sys.argv[1:5])

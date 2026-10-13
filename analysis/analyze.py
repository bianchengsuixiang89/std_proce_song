"""Music analysis -> data/audio.json (the format app/src/engine/audio.ts reads).

Beat grid: librosa beat tracking on the percussive part, then a constant-tempo grid fitted through the
detected beats (the track is produced to a click, so a straight grid is truer than the tracker's jitter).
Downbeats: the bar phase (0..3) whose beats carry the most low-band onset energy.
Envelopes at 100 fps, normalised 0..1. There are no stems: vocal/drums/bass/other are band/HPSS proxies.

Usage: python analysis/analyze.py audio/song.wav data/audio.json
"""
import json
import sys

import librosa
import numpy as np

FPS = 100


def norm01(x, lo=5, hi=99):
    a, b = np.percentile(x, lo), np.percentile(x, hi)
    return np.clip((x - a) / max(b - a, 1e-9), 0, 1)


def band_rms(S, freqs, f0, f1):
    m = (freqs >= f0) & (freqs < f1)
    return np.sqrt(np.mean(S[m] ** 2, axis=0))


def peaks(env, times, thresh, min_gap):
    """Onset peaks of an onset-strength envelope: local maxima above thresh, at least min_gap apart."""
    out = []
    for i in range(1, len(env) - 1):
        if env[i] >= thresh and env[i] >= env[i - 1] and env[i] > env[i + 1]:
            if out and times[i] - out[-1][0] < min_gap:
                if env[i] > out[-1][1]:
                    out[-1] = (times[i], env[i])
                continue
            out.append((times[i], env[i]))
    return [[round(float(t), 3), round(float(s), 3)] for t, s in out]


def main(src, dst):
    y, sr = librosa.load(src, sr=22050, mono=True)
    dur = len(y) / sr
    hop = sr // FPS  # 220 samples: 100.2 fps; times are computed from frames, not assumed
    yh, yp = librosa.effects.hpss(y)

    # ---- beats
    onset_p = librosa.onset.onset_strength(y=yp, sr=sr, hop_length=hop)
    tempo, bt = librosa.beat.beat_track(onset_envelope=onset_p, sr=sr, hop_length=hop, tightness=400)
    bt_times = librosa.frames_to_time(bt, sr=sr, hop_length=hop)
    # robust constant-tempo fit: index each detected beat by its rounded position on a first-guess grid
    period = float(np.median(np.diff(bt_times)))
    for _ in range(3):
        idx = np.round((bt_times - bt_times[0]) / period)
        A = np.vstack([idx, np.ones_like(idx)]).T
        (period, t0), *_ = np.linalg.lstsq(A, bt_times, rcond=None)
        res = bt_times - (t0 + idx * period)
        keep = np.abs(res) < 0.05
        bt_times, idx = bt_times[keep], idx[keep]
    # refine the phase on the onset envelope: shift the grid to maximise onset strength at the beats
    t_on = librosa.frames_to_time(np.arange(len(onset_p)), sr=sr, hop_length=hop)
    best = (0, -1)
    for sh in np.arange(-0.04, 0.0401, 0.002):
        g = t0 + sh + np.arange(-2, int(dur / period) + 2) * period
        g = g[(g >= 0) & (g < dur)]
        s = np.interp(g, t_on, onset_p).sum()
        if s > best[1]:
            best = (sh, s)
    t0 += best[0]
    n0 = int(np.ceil(-t0 / period)) if t0 < 0 else -int(np.floor(t0 / period))
    beats = t0 + np.arange(n0, int((dur - t0) / period) + 1) * period
    beats = beats[(beats >= 0) & (beats < dur)]

    # ---- spectral bands
    S = np.abs(librosa.stft(y, n_fft=2048, hop_length=hop))
    Sh = np.abs(librosa.stft(yh, n_fft=2048, hop_length=hop))
    Sp = np.abs(librosa.stft(yp, n_fft=2048, hop_length=hop))
    freqs = librosa.fft_frequencies(sr=sr, n_fft=2048)
    times = librosa.frames_to_time(np.arange(S.shape[1]), sr=sr, hop_length=hop)

    low_p = band_rms(Sp, freqs, 30, 150)
    # downbeat phase: low-band percussive energy at each bar position
    lowp_on = np.maximum(0, np.diff(low_p, prepend=low_p[0]))
    score = []
    for ph in range(4):
        b = beats[ph::4]
        score.append(float(np.interp(b, times, lowp_on).mean() + 0.5 * np.interp(b, t_on, onset_p).mean() / max(onset_p.mean(), 1e-9) * lowp_on.mean()))
    phase = int(np.argmax(score))
    downbeats = beats[phase::4]

    # ---- envelopes (resampled to exactly FPS)
    grid = np.arange(0, dur, 1 / FPS)
    rs = lambda x: np.interp(grid, times, x)
    feats = {
        'rms': norm01(rs(librosa.feature.rms(y=y, hop_length=hop)[0][: len(times)])),
        'low': norm01(rs(band_rms(S, freqs, 30, 160))),
        'mid': norm01(rs(band_rms(S, freqs, 160, 2500))),
        'high': norm01(rs(band_rms(S, freqs, 4000, 11000))),
        'vocal': norm01(rs(band_rms(Sh, freqs, 250, 3500))),
        'drums': norm01(rs(np.sqrt(np.mean(Sp ** 2, axis=0)))),
        'bass': norm01(rs(band_rms(Sh, freqs, 30, 200))),
        'other': norm01(rs(band_rms(Sh, freqs, 3500, 9000))),
    }

    # ---- onsets
    def band_onset(Sx, f0, f1):
        b = band_rms(Sx, freqs, f0, f1)
        d = np.maximum(0, np.diff(np.log1p(b * 50), prepend=0))
        return norm01(d, 50, 99.7)
    kick = band_onset(Sp, 30, 150)
    snare = band_onset(Sp, 1500, 5000)
    hat = band_onset(Sp, 7000, 11000)
    vocal_on = band_onset(Sh, 250, 3500)
    onsets = {
        'kick': peaks(kick, times, 0.45, 0.12),
        'snare': peaks(snare, times, 0.5, 0.12),
        'hat': peaks(hat, times, 0.5, 0.07),
        'vocal': peaks(vocal_on, times, 0.5, 0.1),
    }

    out = {
        'duration': round(dur, 3),
        'bpm': round(60 / period, 3),
        'beat_period': round(float(period), 5),
        'time_signature': 4,
        'beats': [round(float(b), 3) for b in beats],
        'downbeats': [round(float(b), 3) for b in downbeats],
        'sections': [],  # filled from the aligned lyrics by sections.py
        'fps': FPS,
        'features': {k: [round(float(v), 3) for v in a] for k, a in feats.items()},
        'onsets': onsets,
    }
    with open(dst, 'w', encoding='utf-8') as f:
        json.dump(out, f, separators=(',', ':'))
    print(f'duration {dur:.2f}s  tempo {60 / period:.3f} bpm (tracker {float(np.atleast_1d(tempo)[0]):.2f})  '
          f'beats {len(beats)}  downbeat phase {phase} scores {[round(s, 4) for s in score]}  '
          f'onsets ' + ', '.join(f'{k}:{len(v)}' for k, v in onsets.items()))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])

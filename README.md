# 《标准流程》 MV — code-rendered

Built on the method and engine of [mexicat/pdoom-video](https://github.com/mexicat/pdoom-video) (MIT, see `app/LICENSE.pdoom-video`).
Concept, events and plates: [`docs/TREATMENT.md`](docs/TREATMENT.md).

## Layout

- `audio/song.wav` — the song the app plays and the renderer muxes, with comment metadata removed.
  The original root-level WAV stays local and is not tracked.
- `lyrics/lyrics.src.txt` — the lyric, one sung phrase per line, `## section` headers.
- `analysis/analyze.py` → `data/audio.json` (beat grid, downbeats, envelopes, onsets).
- `analysis/align.py` → `data/lyrics.json` (per-character times; faster-whisper large-v3 + DP alignment) and section starts.
- `app/` — the renderer (TypeScript + three.js, Vite, run with bun): `src/timeline.ts` (the edit), `src/scenes/*.ts` (plates),
  `src/scenes/_archive.ts` (shared design system: paper/screen shader, the red line, the system's eye, scale figures).
- `out/samples/` — round-1 samples (A petition, B glass, C bus): clip, stills, contact sheet.

## Run (Windows)

```powershell
# analysis (conda env mv1: librosa, faster-whisper, pypinyin, imageio-ffmpeg)
conda run -n mv1 python analysis\analyze.py audio\song.wav data\audio.json
conda run -n mv1 python analysis\align.py audio\song.wav lyrics\lyrics.src.txt data\lyrics.json data\audio.json

# preview / render (bun via npx; ffmpeg from tools\)
cd app; npm install
$env:PDOOM_NO_HMR='1'; npx vite --port 5190            # preview: http://localhost:5190/?t=105
npx bun scripts/render.ts stills --url http://localhost:5190 --only glass --t 111.5 --out ../out/wip/glass
$env:PATH = "$(Resolve-Path ..\tools);$env:PATH"
npx bun scripts/render.ts video --url http://localhost:5190 --only petition --from 40.3 --to 53.35 --samples 4 --shutter 0.3 --out ../out/petition.mp4
```

The Whisper model is read from `analysis/cache/faster-whisper-large-v3` (fetched with curl from huggingface.co: the hub client
stalls on this network). Without a CUDA 12 cuBLAS it runs on the CPU (int8), about a minute for the song.

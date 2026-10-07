# Cartoon What-If Studio
Static frontend + local **Worker** (Node, zero npm dependencies) that runs: AI story (Ollama) → Character Bible → keyframes (Pollinations or local Stable Diffusion WebUI) → **Wan image-to-video** (ComfyUI or HTTP endpoint) → **Piper** voice → burned-in captions → **FFmpeg** → 1080×1920 H.264/AAC MP4.
There is no zoom/pan/canvas animation and no mock provider in the product path. A missing component produces an explicit error and generation stops.

## Why "Worker unreachable at http://127.0.0.1:8787" happened
The frontend is a static page; it cannot generate video by itself. All work is done by `worker/server.mjs`, a **separate process that must be running**. Earlier versions had no `package.json` (so `npm run worker` did not exist) and the worker was not started automatically. Now:

## Start (exact)
Requires Node.js 18+ (`node -v`). From the project folder:
```
npm run worker          # or: node worker/server.mjs
```
Windows: double-click `start-worker.bat`. macOS/Linux: `./start-worker.sh`. (`npm install` is not needed: there are no dependencies.)
Then open **http://127.0.0.1:8787/** (the worker also serves the app, so no CORS/https issues) and **http://127.0.0.1:8787/health**. The startup log lists every component as `OK` or `MISSING` with the reason.
If the app is hosted elsewhere (e.g. GitHub Pages), set the Worker URL on the PRODUCE tab, in `config.js`, or via `?worker=http://127.0.0.1:8787`; add the page origin to `ALLOWED_ORIGINS`. localhost/127.0.0.1 on any port are always allowed; other origins get HTTP 403. Safari blocks https→http localhost calls; use Chrome/Firefox or open the app from the worker.

## Components the worker needs (each is checked by `GET /health`)
| Component | Error code | Setup |
|---|---|---|
| FFmpeg + ffprobe (libx264, aac, libass) | `FFMPEG_UNAVAILABLE` | install FFmpeg, put on PATH |
| Piper TTS | `TTS_UNAVAILABLE` | `pip install piper-tts`; download voices; set `PIPER_MODEL_EN` (and `PIPER_MODEL_AR`) to the `.onnx` files |
| Wan image-to-video | `WAN_UNAVAILABLE` | ComfyUI + Wan 2.1/2.2 I2V on a **GPU**; export the API workflow with placeholders (`worker/workflows/README.md`); set `WAN_BASE_URL`, optionally `WAN_WORKFLOW`, `WAN_MODEL` (`{{MODEL}}` placeholder), `WAN_OUTPUT_DIR`; or set `I2V_HTTP_URL` to your own endpoint |
| Story LLM | `STORY_UNAVAILABLE` | install Ollama, `ollama pull llama3.2`; optional `OLLAMA_URL`, `OLLAMA_MODEL` |
| Keyframe images | `IMAGE_UNAVAILABLE` | default `IMAGE_PROVIDER=pollinations` (free, internet, rate-limited, no key, can change); or `IMAGE_PROVIDER=a1111` + `SD_URL` (local Stable Diffusion WebUI started with `--api`) |

Put settings in `.env` (copy `.env.example`) or environment variables. Unavailable component → HTTP 503 `{ "ok": false, "error": "WAN_UNAVAILABLE", "message": "Wan Image-to-Video is not available on this worker." }` (same shape for the others); the UI prints `❌ Wan AI video generation is not configured on this Worker`, `❌ Piper TTS unavailable`, `❌ FFmpeg unavailable`, `❌ Image generation unavailable`, `❌ AI story generation unavailable`, `❌ Worker offline`.
`WAN_DEVICE` is intentionally not offered: the device (GPU/CPU) is chosen by ComfyUI/your Wan service, and the worker cannot verify or change it.

## Using it
STORY → type the idea → **⚡ Create Short**. Status lines (PRODUCE tab) are written only after the corresponding worker operation finished: Worker online → story → per scene keyframe + Wan clip → narration → render → "Final MP4 ready" (only after ffprobe confirms 1080×1920 H.264/AAC and the file is reachable). The AI also writes the Character Bible (name, species, color, clothing, accessories, personality, visual style); it is injected into every keyframe prompt. Untick "Let the AI create the Character Bible" to use your own cast. **Template story (fallback, NOT AI)** is a separate, clearly labelled button for drafts only; Create Short never falls back to it.

## API (worker)
`GET /health` · `POST /api/story` · `POST /api/image` · `POST /api/i2v` · `POST /api/render` (these four return `{job}`; poll `GET /api/jobs/:id` → `{status:running|done|failed,progress,result,error,code}`) · `POST /api/tts` (sync) · `GET /files/:id.ext` (range supported). Optional `WORKER_TOKEN` (Bearer, or `?t=` for media URLs; type it on PRODUCE, it is kept per tab only).

## Cost and hardware (honest)
Free/open source: this code, FFmpeg, Piper, Ollama, ComfyUI, Wan weights, Stable Diffusion WebUI. **Wan needs a CUDA GPU** (roughly 8–12 GB VRAM for small I2V setups; minutes per 5 s clip; 14B models need much more). CPU-only machines cannot realistically run it and will show `WAN_UNAVAILABLE`. Free cloud GPUs have limits and are not guaranteed; paid GPU endpoints are optional via `I2V_HTTP_URL`. Wan clips are ≈480×832 and are upscaled, so output is soft.

## Verified vs not verified
`npm run test:worker` starts the worker with **test-only mocks** (`worker/test/`: a ComfyUI protocol stand-in that returns an FFmpeg test pattern, a fixed-fixture Ollama, an A1111 stand-in, a sine-tone "piper") and checks: `/health`, static serving, CORS allow/deny, story → keyframe → I2V job → TTS → caption burn-in → 1080×1920 H.264/AAC render, narration-too-long refusal, and 503 error codes when each component is missing. The browser UI was also run end-to-end against that setup (worker offline message, worker online, 6-scene story → 30.0 s MP4).
**Not verified (no GPU/network in the build sandbox):** real Wan output, your ComfyUI workflow, real Piper speech, real Ollama stories, real Pollinations/Stable Diffusion images, Arabic caption shaping (needs `CAPTION_FONT` with Arabic glyphs), iPhone Safari. The mocks do not show motion quality, speech, or character consistency.

## Limits
Narration must fit its clip (≤ clip + 1 s; the worker never loops or freezes frames to hide it). Captions are 3-word phrases timed proportionally to the voice length (estimate). Character consistency relies on the Character Bible text and a shared seed; Wan and the image model can still drift. Final length ≈ scenes × clip length (6–8 scenes × 5–8 s).

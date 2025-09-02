# FLOWS Video Generator (Runway + OpenAI TTS)

This is a minimal, production-ready web app you can deploy to **Vercel** and embed in **Wix** via an iframe.
It generates short social videos using **Runway API** (text→image→video pipeline) and creates a voiceover
MP3 from your ad script using **OpenAI Text-to-Speech**. v1 shows video + voiceover with a preview and download;
muxing (merging MP3 into MP4) can be added later with ffmpeg.wasm.

## ✨ Features
- Ad brief → auto-built **video prompt** (shot, style, CTA)
- **Text-to-Image** (Runway `text_to_image`) to get first frame
- **Image-to-Video** (Runway `image_to_video`, Gen-3/Gen-4 models) with proper `ratio`
- **Script generator** (OpenAI) + **TTS MP3** (OpenAI)
- Clean embed, CORS and iframe headers for Wix
- Safe env variables, no secrets in client

## ⚙️ Environment Variables (Vercel Project Settings → Environment Variables)
- `RUNWAY_API_KEY` → your Runway API key
- `OPENAI_API_KEY` → your OpenAI API key (for script + TTS)
- (Optional) `OPENAI_MODEL` → default `gpt-4o-mini`
- (Optional) `OPENAI_TTS_VOICE` → default `alloy`

## 🚀 Deploy
1. Zip and upload to Vercel (or connect a Git repo).
2. In **Vercel → Project → Settings → Environment Variables**, add keys above.
3. Deploy. Copy the live URL.
4. In **Wix Studio** → Add → Embed Code → **Embed a site** → paste your Vercel URL.

## 🧩 Notes
- Runway API version header is set to `2024-11-06`. If you experience issues, you can remove it in `/api/runway/*.js`.
- For vertical Reels/Stories use `ratio: "768:1280"`. For landscape use `1280:720`.
- v1 does not *mux* audio into the MP4 (export). We preview both + let you download MP3.
  We can add ffmpeg.wasm later for in-browser muxing.


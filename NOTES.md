# LAN Kart NOTES

## Structure
- server/main.py: FastAPI + WebSocket authoritative server.
- static/: index.html, style.css, main.js, style.js, render.js, postfx.js, vendor/three.module.js.
- Docker: Dockerfile prod, docker-compose.yml.

## Render loop
- Low-res WebGLRenderTarget (480x270), NearestFilter.
- Composite pass upscales with letterbox + palette quantize + Bayer dither + post chain.
- requestAnimationFrame animate() -> updateDriving etc -> renderFrame(scene,camera,dt).

## Protocol
- WebSocket /ws: welcome, state, shoot, projectile_hit, name, finish, winner, reset, leave.

## Assumptions
- True 3D Three.js, no CDN, vendored three.module.js.
- No audio.
- Server authoritative; FX client-only.
- .venv untracked.

## Checklist (Stage 1)
- [x] NOTES.md
- [x] .venv gitignored/untracked
- [x] vendor three
- [x] low-res render target + upscale
- [x] palette quantize + bayer dither
- [x] fog/vertex snap/flat/no AA
- [x] post chain toggles
- [ ] docker build+run verified
- [ ] 2-client test
- [ ] commit+push
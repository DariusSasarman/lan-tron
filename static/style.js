// style.js — single config for the PS2-era Night City restyle
export const STYLE = {
  render: {
    lowResWidth: 480,
    lowResHeight: 270,
    fogColor: 0x1a0a2e,
    fogNear: 80,
    fogFar: 320,
    vertexSnap: 96,
    flatShading: true,
  },
  palette: {
    colors: 48,
  },
  postfx: {
    bloom: { enabled: true, strength: 0.6 },
    chromaticAberration: { enabled: true, strength: 0.003 },
    scanlines: { enabled: true, strength: 0.35 },
    colorBleed: { enabled: true, strength: 0.2 },
    vignette: { enabled: true, strength: 0.5 },
    grain: { enabled: true, strength: 0.15 },
    glitch: { enabled: true, intervalMin: 8, intervalMax: 20, strength: 0.4 },
  },
  presets: {
    "PS2 Authentic": {},
    "Clean Neon": {},
    "Low FX": {},
  },
};
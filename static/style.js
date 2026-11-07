// Single configuration surface for rendering, atmosphere, and performance.
const POST_DEFAULTS = {
  bloom: { enabled: true, strength: 0.6 },
  chromaticAberration: { enabled: true, strength: 0.003 },
  scanlines: { enabled: true, strength: 0.12 },
  colorBleed: { enabled: true, strength: 0.2 },
  vignette: { enabled: true, strength: 0.5 },
  grain: { enabled: true, strength: 0.04 },
  glitch: { enabled: true, intervalMin: 8, intervalMax: 20, strength: 0.4 },
};

const clone = (value) => JSON.parse(JSON.stringify(value));

export const STYLE = {
  render: {
    lowResWidth: 480,
    lowResHeight: 270,
    integerUpscale: true,
    fogColor: 0x1a0a2e,
    fogNear: 120,
    fogFar: 600,
    vertexSnap: 96,
    flatShading: true,
  },
  palette: { colors: 48 },
  postfx: clone(POST_DEFAULTS),
  themes: {
    Downtown: { ground: 0x1b202b, skyTop: 0x1a0a2e, skyBot: 0xff4d8d },
    Industrial: { ground: 0x30251e, skyTop: 0x2a1a0a, skyBot: 0xff8a3d },
    Waterfront: { ground: 0x182833, skyTop: 0x0a1a2e, skyBot: 0x3ddcff },
  },
  activePreset: "PS2 Authentic",
  presets: {
    "PS2 Authentic": {
      colors: 48,
      postfx: clone(POST_DEFAULTS),
    },
    "Clean Neon": {
      colors: 64,
      postfx: {
        ...clone(POST_DEFAULTS),
        scanlines: { enabled: false, strength: 0 },
        grain: { enabled: false, strength: 0 },
        glitch: { enabled: false, intervalMin: 8, intervalMax: 20, strength: 0 },
      },
    },
    "Low FX": {
      colors: 32,
      postfx: {
        ...clone(POST_DEFAULTS),
        bloom: { enabled: false, strength: 0 },
        chromaticAberration: { enabled: false, strength: 0 },
        scanlines: { enabled: false, strength: 0 },
        colorBleed: { enabled: false, strength: 0 },
        grain: { enabled: false, strength: 0 },
        glitch: { enabled: false, intervalMin: 8, intervalMax: 20, strength: 0 },
      },
    },
  },
};

export function applyPreset(name) {
  const preset = STYLE.presets[name];
  if (!preset) return false;
  STYLE.activePreset = name;
  STYLE.palette.colors = preset.colors;
  STYLE.postfx = clone(preset.postfx);
  return true;
}

export function cyclePreset() {
  const names = Object.keys(STYLE.presets);
  const index = (names.indexOf(STYLE.activePreset) + 1) % names.length;
  applyPreset(names[index]);
  return STYLE.activePreset;
}

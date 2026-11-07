// postfx.js — composite shader: palette quantize + Bayer dither + post chain
import * as THREE from "./vendor/three.module.js";
import { STYLE } from "./style.js";

const BAYER = `float bayer4(vec2 p){ 
  ivec2 ip = ivec2(mod(p, 4.0));
  int idx = ip.x + ip.y*4;
  float m[16] = float[16](0.,8.,2.,10.,12.,4.,14.,6.,3.,11.,1.,9.,15.,7.,13.,5.);
  return m[idx]/16.0;
}`;

export function createCompositeMaterial(texture) {
  const P = STYLE.postfx;
  const off = !!P.disableAll;
  const uniforms = {
    tDiffuse: { value: texture },
    uTime: { value: 0 },
    uResolution: { value: new THREE.Vector2(STYLE.render.lowResWidth, STYLE.render.lowResHeight) },
    uLowRes: { value: new THREE.Vector2(STYLE.render.lowResWidth, STYLE.render.lowResHeight) },
    uBloom: { value: off ? 0 : (P.bloom.enabled ? P.bloom.strength : 0) },
    uCA: { value: off ? 0 : (P.chromaticAberration.enabled ? P.chromaticAberration.strength : 0) },
    uScan: { value: off ? 0 : (P.scanlines.enabled ? P.scanlines.strength : 0) },
    uBleed: { value: off ? 0 : (P.colorBleed.enabled ? P.colorBleed.strength : 0) },
    uVig: { value: off ? 0 : (P.vignette.enabled ? P.vignette.strength : 0) },
    uGrain: { value: off ? 0 : (P.grain.enabled ? P.grain.strength : 0) },
    uGlitch: { value: 0 },
    uColors: { value: STYLE.palette.colors },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position,1.0); }",
    fragmentShader: `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform vec2 uResolution;
      varying vec2 vUv;
      uniform float uBloom, uCA, uScan, uBleed, uVig, uGrain, uGlitch;
      uniform float uColors;
      uniform vec2 uLowRes;
      ${BAYER}
      vec3 quantize(vec3 c){ return floor(c * uColors + 0.5) / uColors; }
      void main(){
        vec2 uv = vUv;
        vec2 px = floor(uv * uLowRes);
        // chromatic aberration
        float ca = uCA * (1.0 + uGlitch*2.0);
        vec3 col;
        col.r = texture2D(tDiffuse, uv + vec2(ca,0.0)).r;
        col.g = texture2D(tDiffuse, uv).g;
        col.b = texture2D(tDiffuse, uv - vec2(ca,0.0)).b;
        // color bleed
        col += texture2D(tDiffuse, uv + vec2(0.002*uBleed,0.0)).rgb * uBleed * 0.25;
        // bloom-ish
        col += col * uBloom * 0.15;
        // palette quantize + bayer dither
        float d = bayer4(px) - 0.5;
        col = quantize(col + d / uColors);
        // scanlines
        float scan = sin(px.y * 3.14159) * 0.5 + 0.5;
        col *= 1.0 - uScan * (1.0 - scan) * 0.3;
        // vignette
        float dist = distance(uv, vec2(0.5));
        col *= 1.0 - uVig * smoothstep(0.35, 0.85, dist);
        // grain
        float g = fract(sin(dot(px + uTime*100.0, vec2(12.9898,78.233))) * 43758.5453);
        col += (g - 0.5) * uGrain;
        // glitch burst
        if(uGlitch > 0.0){
          float band = step(0.5, fract(uv.y * 40.0 + uTime*20.0));
          col = mix(col, col.bgr, band * uGlitch * 0.5);
        }
        gl_FragColor = vec4(clamp(col,0.0,1.0),1.0);
      }`,
    depthTest: false, depthWrite: false,
  });
  return { material: mat, uniforms };
}

export function updateGlitch(uniforms, dt) {
  const g = STYLE.postfx.glitch;
  if (!g.enabled) { uniforms.uGlitch.value = 0; return; }
  // trigger every intervalMin..intervalMax
  if (!updateGlitch._next) updateGlitch._next = g.intervalMin + Math.random()*(g.intervalMax-g.intervalMin);
  updateGlitch._t = (updateGlitch._t||0) + dt;
  if (updateGlitch._t >= updateGlitch._next) {
    updateGlitch._burst = 0.3;
    updateGlitch._t = 0;
    updateGlitch._next = g.intervalMin + Math.random()*(g.intervalMax-g.intervalMin);
  }
  if (updateGlitch._burst > 0) {
    updateGlitch._burst -= dt * 3;
    uniforms.uGlitch.value = g.strength * Math.max(0, updateGlitch._burst);
  } else {
    uniforms.uGlitch.value = 0;
  }
  uniforms.uTime.value += dt;
}
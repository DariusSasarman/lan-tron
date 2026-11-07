// render.js — low-res render target, integer upscale, vertex snap helper
import * as THREE from "./vendor/three.module.js";
import { STYLE } from "./style.js";
import { createCompositeMaterial, updateGlitch } from "./postfx.js";

export let renderer, renderTarget, scene, camera;
export let compositeScene, compositeCamera, compositeMesh;
let compositeUniforms;

export function initRender(canvasHost) {
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  (canvasHost || document.body).appendChild(renderer.domElement);

  const cfg = STYLE.render;
  renderTarget = new THREE.WebGLRenderTarget(cfg.lowResWidth, cfg.lowResHeight, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    format: THREE.RGBAFormat,
    type: THREE.UnsignedByteType,
  });

  compositeCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  compositeScene = new THREE.Scene();
  const geo = new THREE.PlaneGeometry(2, 2);
  const { material: compMat, uniforms: compUniforms } = createCompositeMaterial(renderTarget.texture);
  compositeMesh = new THREE.Mesh(geo, compMat);
  compositeScene.add(compositeMesh);
  compositeUniforms = compUniforms;

  handleResize();
  window.addEventListener("resize", handleResize);
  return renderer;
}

export function handleResize() {
  const w = window.innerWidth, h = window.innerHeight;
  const cfg = STYLE.render;
  const scale = Math.floor(Math.min(w / cfg.lowResWidth, h / cfg.lowResHeight)) || 1;
  const vw = cfg.lowResWidth * scale;
  const vh = cfg.lowResHeight * scale;
  const ox = Math.floor((w - vw) / 2);
  const oy = Math.floor((h - vh) / 2);
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + "px";
  renderer.domElement.style.height = h + "px";
  renderer.setViewport(ox, oy, vw, vh);
  renderer.setScissor(ox, oy, vw, vh);
  renderer.setScissorTest(true);
}

export function applyVertexSnap(material) {
  if (!material) return;
  if (material.userData && material.userData._vertexSnapPatched) return;
  material.flatShading = STYLE.render.flatShading;
  const snap = STYLE.render.vertexSnap;
  if (snap && snap > 0) {
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <project_vertex>",
        "#include <project_vertex>\n  gl_Position.xy = floor(gl_Position.xy / gl_Position.w * " + snap + ".0 + 0.5) / " + snap + ".0 * gl_Position.w;"
      );
    };
  }
  if (!material.userData) material.userData = {};
  material.userData._vertexSnapPatched = true;
  material.needsUpdate = true;
}

export function applyVertexSnapToScene(root) {
  if (!root) return;
  const seen = new WeakSet();
  root.traverse((obj) => {
    const mats = Array.isArray(obj.material) ? obj.material : (obj.material ? [obj.material] : []);
    for (const m of mats) {
      if (!m || seen.has(m)) continue;
      seen.add(m);
      applyVertexSnap(m);
    }
  });
}

export function renderFrame(scene, camera, dt = 0.016) {
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  if (compositeUniforms) {
    syncPostFX(compositeUniforms);
    updateGlitch(compositeUniforms, dt);
  }
  renderer.render(compositeScene, compositeCamera);
}

function syncPostFX(uniforms) {
  const p = STYLE.postfx;
  uniforms.uBloom.value = p.bloom.enabled ? p.bloom.strength : 0;
  uniforms.uCA.value = p.chromaticAberration.enabled ? p.chromaticAberration.strength : 0;
  uniforms.uScan.value = p.scanlines.enabled ? p.scanlines.strength : 0;
  uniforms.uBleed.value = p.colorBleed.enabled ? p.colorBleed.strength : 0;
  uniforms.uVig.value = p.vignette.enabled ? p.vignette.strength : 0;
  uniforms.uGrain.value = p.grain.enabled ? p.grain.strength : 0;
  uniforms.uColors.value = STYLE.palette.colors;
}
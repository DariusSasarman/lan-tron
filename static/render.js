// render.js — low-res render target, integer upscale, vertex snap helper
import * as THREE from "./vendor/three.module.js";
import { STYLE } from "./style.js";
import { createCompositeMaterial, updateGlitch } from "./postfx.js";

export let renderer, renderTarget, scene, camera;
export let compositeScene, compositeCamera, compositeMesh;

export function initRender(canvasHost) {
  renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
  renderer.setPixelRatio(1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = false;
  document.body.appendChild(renderer.domElement);

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
  renderFrame._uniforms = compUniforms;

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
  renderer.setSize(w, h, false);
  renderer.domElement.style.width = w + "px";
  renderer.domElement.style.height = h + "px";
}

export function applyVertexSnap(material) {
  if (!material) return;
  material.flatShading = STYLE.render.flatShading;
  const snap = STYLE.render.vertexSnap;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `vec3 transformed = position;\n transformed = floor(transformed * ${snap}.0 + 0.5) / ${snap}.0;`
    );
  };
  material.needsUpdate = true;
}

export function renderFrame(scene, camera, dt = 0.016) {
  renderer.setRenderTarget(renderTarget);
  renderer.render(scene, camera);
  renderer.setRenderTarget(null);
  if (renderFrame._uniforms) updateGlitch(renderFrame._uniforms, dt);
  renderer.render(compositeScene, compositeCamera);
}
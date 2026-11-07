// vehicles.js — angular low-poly cyber-cars
import * as THREE from "./vendor/three.module.js";

const NEON_PALETTE = [0xff00ff,0x00ffff,0xffee00,0x00ff80,0xff4d8d];

export function neonColorFor(id){
  let h=0; for(let i=0;i<id.length;i++) h=(h*31+id.charCodeAt(i))>>>0;
  return NEON_PALETTE[h % NEON_PALETTE.length];
}

export function makeKart(color) {
  const root = new THREE.Group();
  const visual = new THREE.Group();
  root.add(visual);

  const hex = typeof color === "number" ? color : (color==="red"?0xff00ff:0x00ffff);
  const bodyMat = new THREE.MeshBasicMaterial({ color: hex });
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x111122 });

  // wedge body
  const body = new THREE.Mesh(new THREE.BoxGeometry(1.6,0.4,3.0), bodyMat);
  body.position.y=0.4; visual.add(body);
  const hood = new THREE.Mesh(new THREE.BoxGeometry(1.2,0.25,1.0), bodyMat);
  hood.position.set(0,0.55,1.0); visual.add(hood);
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(1.9,0.08,0.4), darkMat);
  spoiler.position.set(0,0.9,-1.3); visual.add(spoiler);
  const engine = new THREE.Mesh(new THREE.BoxGeometry(0.8,0.5,0.8), darkMat);
  engine.position.set(0,0.7,-0.9); visual.add(engine);

  // wheels
  const wg = new THREE.CylinderGeometry(0.32,0.32,0.28,6);
  for(const [x,z] of [[-0.75,0.95],[0.75,0.95],[-0.75,-0.95],[0.75,-0.95]]){
    const w=new THREE.Mesh(wg,darkMat); w.rotation.z=Math.PI/2; w.position.set(x,0.32,z); visual.add(w);
  }

  // underglow
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.2,3.6), new THREE.MeshBasicMaterial({color:hex,transparent:true,opacity:0.35,side:THREE.DoubleSide}));
  glow.rotation.x=-Math.PI/2; glow.position.y=0.05; visual.add(glow);
  root.userData.glow = glow;

  // brake lights
  const bl = new THREE.Mesh(new THREE.BoxGeometry(1.4,0.15,0.05), new THREE.MeshBasicMaterial({color:0xff0000}));
  bl.position.set(0,0.5,-1.52); visual.add(bl);
  root.userData.brake = bl;

  // headlight cones
  const hl = new THREE.Mesh(new THREE.ConeGeometry(0.6,2.5,8), new THREE.MeshBasicMaterial({color:0xffffcc,transparent:true,opacity:0.25}));
  hl.rotation.x=Math.PI/2; hl.position.set(0,0.5,2.2); visual.add(hl);

  // name tag (sprite-like plane)
  const tag = new THREE.Mesh(new THREE.PlaneGeometry(2.4,0.6), new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.7,side:THREE.DoubleSide}));
  tag.position.set(0,2.2,0); visual.add(tag);
  root.userData.tag = tag;

  scene.add(root);
  return { root, visual };
}

export function updateVehicle(v, dt, state){}
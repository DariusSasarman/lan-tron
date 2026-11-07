// environment.js — Night City environment (procedural, PS2-era)
import * as THREE from "./vendor/three.module.js";
import { STYLE } from "./style.js";

const BRANDS = ["ARASHI-TEK","NOVACORP","SYNTHRA","KIROSHI-X"];
const envObjects = [];
const envAnim = { rainLayers:[], steam:[], sparks:[], trash:[], neons:[], drones:[], crowds:[], puddles:[] };

function clearEnv(scene){ for(const o of envObjects){ scene.remove(o); if(o.geometry) o.geometry.dispose(); } envObjects.length=0; for(const k in envAnim) envAnim[k].length=0; }
function add(scene,o){ scene.add(o); envObjects.push(o); return o; }
function fakeKanji(){ const chars="アイウエオカキクケコサシスセソタチツテトナニヌネノ"; let s=""; for(let i=0;i<6;i++) s+=chars[Math.floor(Math.random()*chars.length)]; return s; }

export function buildEnvironment(scene, params) {
  clearEnv(scene);
  const theme = (params && params.theme) || "Downtown";
  const T = (STYLE.themes && STYLE.themes[theme]) || { skyTop:0x1a0a2e, skyBot:0xff4d8d };

  // Sky gradient
  const skyGeo = new THREE.SphereGeometry(4000, 24, 12);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: { uTop:{value:new THREE.Color(T.skyTop)}, uBot:{value:new THREE.Color(T.skyBot)}, uSmog:{value:new THREE.Color(0x3a2a4a)} },
    vertexShader:"varying vec3 v; void main(){ v=position; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
    fragmentShader:"varying vec3 v; uniform vec3 uTop,uBot,uSmog; void main(){ float t=normalize(v).y*0.5+0.5; vec3 c=mix(uBot,uTop,t); c=mix(c,uSmog,0.25*(1.0-t)); gl_FragColor=vec4(c,1.0); }"
  });
  add(scene, new THREE.Mesh(skyGeo, skyMat));

  // Holo-billboard moon / corp logo
  const moon = new THREE.Mesh(new THREE.PlaneGeometry(300,300), new THREE.MeshBasicMaterial({color:0x00ffff,transparent:true,opacity:0.6,side:THREE.DoubleSide}));
  moon.position.set(1500,1200,-2000); add(scene,moon);

  // Distant megabuildings with blinking windows
  for(let i=0;i<60;i++){
    const w=100+Math.random()*250, h=500+Math.random()*1500, d=80+Math.random()*150;
    const x=(Math.random()*2-1)*3500, z=(Math.random()*2-1)*3500;
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), new THREE.MeshBasicMaterial({color:0x05020f}));
    m.position.set(x,h/2,z); add(scene,m);
    const ant=new THREE.Mesh(new THREE.BoxGeometry(2,60,2), new THREE.MeshBasicMaterial({color:0x222222}));
    ant.position.set(x,h+30,z); add(scene,ant);
    const blink=new THREE.Mesh(new THREE.SphereGeometry(2,6,6), new THREE.MeshBasicMaterial({color:0xff0000}));
    blink.position.set(x,h+62,z); add(scene,blink);
    envAnim.neons.push({mesh:blink,type:"blink",phase:Math.random()*6});
  }

  // 3 parallax building layers
  for(let layer=0;layer<3;layer++){
    const count = layer===0?25: layer===1?40:60;
    for(let i=0;i<count;i++){
      const w=20+Math.random()*40, h=60+Math.random()*200*(layer+1), d=20+Math.random()*40;
      const r=1200+layer*800;
      const ang=Math.random()*Math.PI*2;
      const x=Math.cos(ang)*r, z=Math.sin(ang)*r;
      const mat=new THREE.MeshBasicMaterial({color: layer===0?0x1a0a2e:layer===1?0x0f0a1e:0x05020f});
      const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
      m.position.set(x,h/2,z); add(scene,m);
      if(layer===0){
        const sign=new THREE.Mesh(new THREE.PlaneGeometry(12,4), new THREE.MeshBasicMaterial({color:Math.random()>0.5?0xff00ff:0x00ffff}));
        sign.position.set(x+ w/2+0.5, 5+Math.random()*h*0.6, z);
        add(scene,sign);
        envAnim.neons.push({mesh:sign,type:"flicker",phase:Math.random()*6,brand:BRANDS[Math.floor(Math.random()*BRANDS.length)]});
      }
    }
  }

  // Aerial traffic lights
  for(let i=0;i<15;i++){
    const m=new THREE.Mesh(new THREE.SphereGeometry(1.5,6,6), new THREE.MeshBasicMaterial({color:0xffff00}));
    m.position.set((Math.random()*2-1)*1500, 200+Math.random()*400, (Math.random()*2-1)*1500);
    add(scene,m); envAnim.neons.push({mesh:m,type:"drift",vx:(Math.random()-0.5)*2,vz:(Math.random()-0.5)*2});
  }

  // Neon signs with dead letters / fake kanji / LED tickers
  for(let i=0;i<12;i++){
    const w=30+Math.random()*60;
    const sign=new THREE.Mesh(new THREE.PlaneGeometry(w,8), new THREE.MeshBasicMaterial({color:0xff0080}));
    sign.position.set((Math.random()*2-1)*800, 8+Math.random()*20, (Math.random()*2-1)*800);
    add(scene,sign);
    envAnim.neons.push({mesh:sign,type:"neon",phase:Math.random()*6,dead:Math.random()<0.3});
  }

  // Rain layers
  for(let L=0;L<3;L++){
    const rc=1500; const arr=new Float32Array(rc*3);
    for(let i=0;i<rc;i++){ arr[i*3]=(Math.random()*2-1)*2500; arr[i*3+1]=Math.random()*600; arr[i*3+2]=(Math.random()*2-1)*2500; }
    const geo=new THREE.BufferGeometry(); geo.setAttribute("position",new THREE.BufferAttribute(arr,3));
    const rain=new THREE.Points(geo, new THREE.PointsMaterial({color:0x99aaff,size:0.5+L*0.3,transparent:true,opacity:0.35+L*0.15}));
    add(scene,rain); envAnim.rainLayers.push({mesh:rain,speed:80+L*40});
  }

  // Steam vents
  for(let i=0;i<20;i++){
    const s=new THREE.Mesh(new THREE.PlaneGeometry(6,6), new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:0.25,side:THREE.DoubleSide}));
    s.position.set((Math.random()*2-1)*600,1,(Math.random()*2-1)*600); s.rotation.x=-Math.PI/2;
    add(scene,s); envAnim.steam.push({mesh:s,phase:Math.random()*6});
  }

  // Sparks
  for(let i=0;i<40;i++){
    const sp=new THREE.Mesh(new THREE.SphereGeometry(0.3,4,4), new THREE.MeshBasicMaterial({color:0xffaa00}));
    sp.position.set((Math.random()*2-1)*700,Math.random()*5,(Math.random()*2-1)*700);
    add(scene,sp); envAnim.sparks.push({mesh:sp,phase:Math.random()*6});
  }

  // Drifting trash
  for(let i=0;i<30;i++){
    const t=new THREE.Mesh(new THREE.PlaneGeometry(1,0.6), new THREE.MeshBasicMaterial({color:0x555555,side:THREE.DoubleSide}));
    t.position.set((Math.random()*2-1)*900,0.2,(Math.random()*2-1)*900);
    add(scene,t); envAnim.trash.push({mesh:t,vx:(Math.random()-0.5)*3,vz:(Math.random()-0.5)*3});
  }

  // Props
  for(let i=0;i<15;i++){
    const b=new THREE.Mesh(new THREE.BoxGeometry(6,1.2,1), new THREE.MeshBasicMaterial({color:0xffaa00}));
    b.position.set((Math.random()*2-1)*500,0.6,(Math.random()*2-1)*500); add(scene,b);
  }
  for(let i=0;i<8;i++){
    const hb=new THREE.Mesh(new THREE.PlaneGeometry(4,2), new THREE.MeshBasicMaterial({color:0x00ffff,transparent:true,opacity:0.4,side:THREE.DoubleSide}));
    hb.position.set((Math.random()*2-1)*400,1.5,(Math.random()*2-1)*400); add(scene,hb);
  }
  for(let i=0;i<10;i++){
    const d=new THREE.Mesh(new THREE.BoxGeometry(1.5,0.6,1.5), new THREE.MeshBasicMaterial({color:0x888888}));
    d.position.set((Math.random()*2-1)*600,15+Math.random()*30,(Math.random()*2-1)*600);
    add(scene,d); envAnim.drones.push({mesh:d,vx:(Math.random()-0.5)*5,vz:(Math.random()-0.5)*5});
  }
  for(let i=0;i<12;i++){
    const v=new THREE.Mesh(new THREE.BoxGeometry(1.2,2.2,1), new THREE.MeshBasicMaterial({color:0x222244}));
    v.position.set((Math.random()*2-1)*400,1.1,(Math.random()*2-1)*400); add(scene,v);
  }
  for(let i=0;i<60;i++){
    const c=new THREE.Mesh(new THREE.PlaneGeometry(1.2,2.5), new THREE.MeshBasicMaterial({color:0x111122,side:THREE.DoubleSide}));
    c.position.set((Math.random()*2-1)*300,1.25,(Math.random()*2-1)*300);
    add(scene,c); envAnim.crowds.push(c);
  }

  // Puddles
  for(let i=0;i<25;i++){
    const p=new THREE.Mesh(new THREE.PlaneGeometry(3,2), new THREE.MeshBasicMaterial({color:0x00ffff,transparent:true,opacity:0.25,side:THREE.DoubleSide}));
    p.rotation.x=-Math.PI/2; p.position.set((Math.random()*2-1)*200,0.03,(Math.random()*2-1)*200);
    add(scene,p); envAnim.puddles.push({mesh:p,phase:Math.random()*6});
  }

  return envAnim;
}

export function updateEnvironment(dt, env){
  const e = env || envAnim;
  const t = performance.now()/1000;
  const nf = Math.floor(t*14);
  for(const n of e.neons){
    if(n.type==="blink"){ n.mesh.visible = (nf%2===0); }
    if(n.type==="flicker"){ n.mesh.visible = Math.random()>0.05; }
    if(n.type==="neon"){ n.mesh.visible = n.dead ? Math.random()>0.4 : Math.random()>0.02; }
    if(n.type==="drift"){ n.mesh.position.x += n.vx*dt; n.mesh.position.z += n.vz*dt; if(Math.abs(n.mesh.position.x)>2000){n.vx*=-1;} if(Math.abs(n.mesh.position.z)>2000){n.vz*=-1;} }
  }
  for(const r of e.rainLayers){
    const arr=r.mesh.geometry.attributes.position.array;
    for(let i=0;i<arr.length;i+=3){ arr[i+1]-=r.speed*dt; if(arr[i+1]<0){ arr[i+1]=600; arr[i]=(Math.random()*2-1)*2500; arr[i+2]=(Math.random()*2-1)*2500; } }
    r.mesh.geometry.attributes.position.needsUpdate=true;
  }
  for(const s of e.steam){ s.mesh.scale.setScalar(1+0.3*Math.sin(t*2+s.phase)); s.mesh.material.opacity=0.15+0.1*Math.sin(t*3+s.phase); }
  for(const sp of e.sparks){ sp.mesh.visible = Math.sin(t*8+sp.phase)>0.7; }
  for(const tr of e.trash){ tr.mesh.position.x += tr.vx*dt; tr.mesh.position.z += tr.vz*dt; if(Math.abs(tr.mesh.position.x)>900){tr.vx*=-1;} if(Math.abs(tr.mesh.position.z)>900){tr.vz*=-1;} tr.mesh.rotation.y += dt; }
  for(const d of e.drones){ d.mesh.position.x += d.vx*dt; d.mesh.position.z += d.vz*dt; if(Math.abs(d.mesh.position.x)>600){d.vx*=-1;} if(Math.abs(d.mesh.position.z)>600){d.vz*=-1;} }
  for(const p of e.puddles){ p.mesh.material.opacity=0.2+0.1*Math.sin(t*4+p.phase); }
}

export { envAnim as ENV };
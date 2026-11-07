// hud.js — cyberdeck HUD
export function initHUD(){ }
export function updateHUD(speed, lap, laps, time, best, players, wrongWay){
  const s=document.getElementById("speed"); if(s) s.textContent=Math.round(speed*3.6);
  const l=document.getElementById("lap"); if(l) l.textContent=lap+" / "+laps;
  const t=document.getElementById("time"); if(t) t.textContent=time.toFixed(1);
  const b=document.getElementById("best"); if(b) b.textContent=best===null?"--":best.toFixed(2);
  const p=document.getElementById("players"); if(p) p.textContent=players;
  const w=document.getElementById("wrongway"); if(w) w.style.display = wrongWay?"block":"none";
}
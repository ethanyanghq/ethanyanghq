/* Animated favicon, driven by the same ephemeris as the sky. Every frame is computed from the clock, never stepped,
   so it stays correct when the browser throttles a background tab to one update a second.
   It shows Jupiter and its four big moons seen from Earth, as Galileo drew them in 1610, starting from where they
   are right now and running at 12 hours per second. ?favpreview shows the icon enlarged in the corner.
   prefers-reduced-motion freezes it at real time. /favicon.png is a still frame for crawlers, Safari and no-JS. */
(() => {
'use strict';
const A = window.Astronomy, link = document.querySelector('link[rel="icon"]');
const SIZE = 32;                               /* canvas px: a 16 CSS px tab icon on a 2x screen */
const cv = document.createElement('canvas'); cv.width = cv.height = SIZE;
const ctx = cv.getContext && cv.getContext('2d');
if(!A || !link || !ctx) return;

const q = new URLSearchParams(location.search);
const SPEED = 0.5 * 86400e3;                  /* sim ms per real second: 12 hours */
const still = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
const t0 = Date.now();

function disc(x, y, r){ ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2); ctx.fill(); }
const dot = (a, b) => a.x*b.x + a.y*b.y + a.z*b.z;
function unit(v){ const l = Math.hypot(v.x, v.y, v.z); return { x: v.x/l, y: v.y/l, z: v.z/l }; }
function cross(a, b){ return { x: a.y*b.z - a.z*b.y, y: a.z*b.x - a.x*b.z, z: a.x*b.y - a.y*b.x }; }

/* Galileo: project each moon onto the sky plane as seen from Earth. Distances are compressed (power 0.6) so Io
   clears Jupiter's disc; the motion stays monotonic, so each moon still swings like the real thing.
   A moon behind Jupiter is hidden; one in front is drawn with a white rim so the transit shows. */
function galileo(t){
  const los = unit(A.GeoVector(A.Body.Jupiter, t, true)), east = unit(cross({ x: 0, y: 0, z: 1 }, los));
  const north = cross(los, east), jm = A.JupiterMoons(t), R = 3.6;
  const moons = [jm.io, jm.europa, jm.ganymede, jm.callisto].map(m => {
    const e = -dot(m, east), n = dot(m, north), r = Math.hypot(e, n);
    const k = 14 * Math.pow(Math.min(1, r / 0.0126), 0.6) / (r || 1);
    return { x: 16 + e*k, y: 16 - n*k*0.5, front: dot(m, los) < 0 };
  });
  for(const m of moons) if(!m.front) disc(m.x, m.y, 1.6);
  disc(16, 16, R);
  for(const m of moons) if(m.front){
    if(Math.hypot(m.x - 16, m.y - 16) < R + 1.6){ ctx.fillStyle = '#fff'; disc(m.x, m.y, 2.4); ctx.fillStyle = '#000'; }
    disc(m.x, m.y, 1.6);
  }
}

let preview = null;
if(q.has('favpreview')){
  preview = document.createElement('img');
  preview.style.cssText = 'position:fixed;right:16px;bottom:16px;width:128px;height:128px;border:1px solid #000;z-index:99;image-rendering:auto;pointer-events:none';
  document.body.appendChild(preview);
}

let last = 0;
function render(){
  const now = Date.now();
  if(now - last < 33) return;                  /* ~30 fps is plenty for a 16px icon */
  last = now;
  const t = A.MakeTime(new Date(t0 + (still ? now - t0 : (now - t0) * SPEED / 1000)));
  ctx.setTransform(SIZE/32, 0, 0, SIZE/32, 0, 0);
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 32, 32);
  ctx.fillStyle = ctx.strokeStyle = '#000';
  galileo(t);
  const url = cv.toDataURL('image/png');
  link.href = url; if(preview) preview.src = url;
}

/* Visible: every animation frame. Hidden: rAF stops, so a timer keeps the tab icon moving at whatever rate the
   browser allows (about once a second). Reduced motion: once a minute, at real time. */
let timer = 0;
function loop(){ render(); if(!document.hidden) requestAnimationFrame(loop); }
function schedule(){
  clearInterval(timer);
  if(still){ last = 0; render(); timer = setInterval(() => { last = 0; render(); }, 60e3); return; }
  if(document.hidden) timer = setInterval(() => { last = 0; render(); }, 1000);
  else requestAnimationFrame(loop);
}
document.addEventListener('visibilitychange', schedule);
schedule();
})();

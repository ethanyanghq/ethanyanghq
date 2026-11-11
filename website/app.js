/* Ethan Yang: the solar system at true scale, drawn where it is right now.
   Positions: astronomy-engine (VSOP87, ±1 arcmin) for the Sun, planets, Pluto, the Moon and the Galilean moons;
   JPL SSD mean orbital elements (data/moons.json, see tools/fetch_moons.py) for every other moon. */
(function(){
  const el = document.getElementById('email'), addr = 'ethanyanghq@gmail.com'; let timer = 0;
  /* the address itself is the confirmation: it shows what was copied, and can still be read or selected if copying failed */
  function done(){ el.textContent = addr; clearTimeout(timer); timer = setTimeout(() => { el.textContent = 'Email'; }, 2400); }
  function fallback(){ const ta = document.createElement('textarea'); ta.value = addr; ta.setAttribute('readonly',''); ta.style.cssText = 'position:fixed;opacity:0;left:-9999px'; document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch(_) {} ta.remove(); done(ok); }
  el.addEventListener('click', e => { e.preventDefault();
    if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(addr).then(() => done(true), fallback); } else fallback(); });
})();
(async function(){
'use strict';
const A = window.Astronomy;
const canvas = document.getElementById('sky');
const layer = document.getElementById('layer');
const clockEl = document.getElementById('clock');
const gl = canvas.getContext('webgl2', {antialias:false, alpha:false, depth:false, stencil:false, powerPreference:'high-performance'});
if(!gl){ console.warn('No WebGL2: the sky is not drawn.'); return; }   /* the clock line keeps its description */
if(!A){ console.warn('The ephemeris failed to load: the sky is not drawn.'); return; }

/* ---------- constants ---------- */
const AU_KM = 149597870.7, DAY_MS = 86400e3, D2R = Math.PI/180;
const ROT = A.Rotation_EQJ_ECL();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* primaries: r in km; w = framing width in AU (short side of the viewport) when flown to */
const B = [
 {n:'Sun',     r:695700, w:3.9},
 {n:'Mercury', b:'Mercury', r:2439.7, w:4.6e-4},
 {n:'Venus',   b:'Venus',   r:6051.8, w:1.1e-3},
 {n:'Earth',   b:'Earth',   r:6371.0, w:6.8e-3, blue:true},
 {n:'Moon',    r:1737.4, parent:3, w:3.3e-4, moon:true},
 {n:'Mars',    b:'Mars',    r:3389.5, w:6.4e-4},
 {n:'Jupiter', b:'Jupiter', r:69911,  w:2.8e-2},
 {n:'Saturn',  b:'Saturn',  r:58232,  w:1.8e-2},
 {n:'Uranus',  b:'Uranus',  r:25362,  w:8.0e-3},
 {n:'Neptune', b:'Neptune', r:24622,  w:6.0e-3},
 {n:'Pluto',   b:'Pluto',   r:1188.3, w:1.0e-3},
];
const PLANETS = [1,2,3,5,6,7,8,9,10];
const SATURN = 7;

/* ---------- moons: JPL SSD mean orbital elements (ssd.jpl.nasa.gov/sats/elem) and mean radii (sats/phys_par) ----------
   [parent, name, a km, e, ω°, M°, i°, Ω°, P days, P_apsis yr, P_node yr, frame (0 ecliptic, 1 Laplace, 2 planet equator), pole RA°, pole Dec°, epoch JD, radius km, ½ulp of P] */
const MOONDATA = window.MOONDATA || await (await fetch('data/moons.json')).json();
const nowJD = 2440587.5 + Date.now()/DAY_MS;
const T0 = A.MakeTime(new Date());
function basisFromPole(raDeg, decDeg){   /* x = ascending node of the plane on the ICRF equator, z = pole; returned in ecliptic coords */
  const ra = raDeg*D2R, dec = decDeg*D2R;
  const z = new A.Vector(Math.cos(dec)*Math.cos(ra), Math.cos(dec)*Math.sin(ra), Math.sin(dec), T0);
  const x = new A.Vector(Math.cos(ra + Math.PI/2), Math.sin(ra + Math.PI/2), 0, T0);
  const y = new A.Vector(z.y*x.z - z.z*x.y, z.z*x.x - z.x*x.z, z.x*x.y - z.y*x.x, T0);
  const ex = A.RotateVector(ROT, x), ey = A.RotateVector(ROT, y), ez = A.RotateVector(ROT, z);
  return [ex.x,ex.y,ex.z, ey.x,ey.y,ey.z, ez.x,ez.y,ez.z];
}
const ECL_BASIS = [1,0,0, 0,1,0, 0,0,1];
const planetPole = {};
for(const i of [5,6,7,8,9,10]){ const ax = A.RotationAxis(B[i].b, T0); planetPole[i] = basisFromPole(ax.ra*15, ax.dec); }
const MOONS = MOONDATA.map(d => {
  const [parent, name, aKm, e, w, M, inc, node, P, Pw, Pn, frame, ra, dec, epoch, rKm, halfUlp] = d;
  const basis = frame === 0 ? ECL_BASIS : frame === 1 ? basisFromPole(ra, dec) : planetPole[parent];
  const ci = Math.cos(inc*D2R);
  const wdot = Pw > 0 ? Math.sign(5*ci*ci - 1)*360/(Pw*365.25) : 0;       /* deg/day */
  const ndot = Pn > 0 ? -Math.sign(ci)*360/(Pn*365.25) : 0;
  const phaseErr = 360*halfUlp*Math.abs(nowJD - epoch)/(P*P);              /* how far the published period's rounding can shift the phase */
  return { n:name, parent, a:aKm/AU_KM, e, w0:w, M0:M, inc, node0:node, nDeg:360/P, wdot, ndot, epoch, r:rKm, basis, moon:true,
           w: Math.max(rKm/AU_KM*28, 2e-7), uncertain: phaseErr > 45, x:0, y:0 };
});
const ALL = B.concat(MOONS);
const NB = B.length, NALL = ALL.length;
for(const b of ALL){ b.x = 0; b.y = 0; }
const GALILEAN = {}; for(let i=0;i<MOONS.length;i++){ const m = MOONS[i]; if(m.parent === 6 && /^(Io|Europa|Ganymede|Callisto)$/.test(m.n)) GALILEAN[m.n.toLowerCase()] = m; }

/* ---------- ephemeris ---------- */
const ecl = v => A.RotateVector(ROT, v);
const eclS = s => A.RotateState(ROT, s);
let pluto = null;
function keplerE(M, e){ let E = e < 0.8 ? M : Math.PI; for(let k=0;k<8;k++){ const d = (E - e*Math.sin(E) - M)/(1 - e*Math.cos(E)); E -= d; if(Math.abs(d) < 1e-12) break; } return E; }
function moonPos(m, jd){
  const dt = jd - m.epoch;
  const M = ((m.M0 + m.nDeg*dt) % 360)*D2R, w = (m.w0 + m.wdot*dt)*D2R, O = (m.node0 + m.ndot*dt)*D2R, i = m.inc*D2R;
  const E = keplerE(M, m.e);
  const cosv = (Math.cos(E) - m.e)/(1 - m.e*Math.cos(E)), sinv = Math.sqrt(1 - m.e*m.e)*Math.sin(E)/(1 - m.e*Math.cos(E));
  const r = m.a*(1 - m.e*Math.cos(E));
  const u = Math.atan2(sinv, cosv) + w;
  const cu = Math.cos(u), su = Math.sin(u), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i), si = Math.sin(i);
  const X = r*(cu*cO - su*sO*ci), Y = r*(cu*sO + su*cO*ci), Z = r*su*si;
  const b = m.basis;
  return [X*b[0] + Y*b[3] + Z*b[6], X*b[1] + Y*b[4] + Z*b[7]];
}
function updatePositions(tms){
  const date = new Date(tms), jd = 2440587.5 + tms/DAY_MS;
  for(const i of PLANETS){
    const b = B[i];
    if(b.b === 'Pluto'){
      if(!pluto || Math.abs(tms - pluto.t) > 2*DAY_MS){ const s = eclS(A.HelioState('Pluto', date)); pluto = {t:tms, x:s.x, y:s.y, vx:s.vx, vy:s.vy}; }
      const dd = (tms - pluto.t)/DAY_MS; b.x = pluto.x + pluto.vx*dd; b.y = pluto.y + pluto.vy*dd;
    } else { const v = ecl(A.HelioVector(b.b, date)); b.x = v.x; b.y = v.y; }
  }
  const mo = ecl(A.GeoMoon(date)); B[4].x = B[3].x + mo.x; B[4].y = B[3].y + mo.y;
  for(const m of MOONS){ const p = moonPos(m, jd), P = B[m.parent]; m.x = P.x + p[0]; m.y = P.y + p[1]; }
  const jm = A.JupiterMoons(date);                     /* the Galilean four from the engine's own theory, more precise than mean elements */
  for(const k in GALILEAN){ const s = ecl(jm[k]); GALILEAN[k].x = B[6].x + s.x; GALILEAN[k].y = B[6].y + s.y; }
}
/* Saturn's pole, for the ring ellipse */
const satPole = ecl(A.RotationAxis('Saturn', T0).north);
const spn = Math.hypot(satPole.x, satPole.y) || 1;
const RING_DIR = [satPole.x/spn, satPole.y/spn], RING_K = Math.max(0.05, Math.abs(satPole.z));

/* ---------- GL: one instanced quad per body, hard-edged ---------- */
const VS = `#version 300 es
layout(location=0) in vec2 aCorner;
layout(location=1) in vec2 aPos; layout(location=2) in float aR; layout(location=3) in vec3 aCol; layout(location=4) in float aKind;
uniform vec2 uRes;
out vec2 vP; flat out float vR; flat out vec3 vCol; flat out float vKind;
void main(){
  float ext = aKind > 0.5 ? aR*2.45 : aR + 1.0;
  if(aR < 0.7 && aKind < 0.5) ext = 0.0;             /* no pixel centre can fall inside: draw nothing */
  vP = aCorner*ext; vR = aR; vCol = aCol; vKind = aKind;
  gl_Position = vec4((aPos + vP)/(0.5*uRes), 0.0, 1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec2 vP; flat in float vR; flat in vec3 vCol; flat in float vKind;
uniform vec2 uRingDir; uniform float uRingK, uRingPx;
out vec4 o;
float band(float x,float a,float b){ return step(a,x)*(1.0-step(b,x)); }
void main(){
  float dist = length(vP);
  if(vKind < 0.5){ if(dist > vR) discard; o = vec4(vCol, 1.0); return; }
  /* Saturn's rings: real radii in thousands of km, projected by the pole tilt; far half hidden behind the disc */
  vec2 n = uRingDir; float dn = dot(vP, n), dm = dot(vP, vec2(-n.y, n.x));
  float rk = sqrt(dm*dm + dn*dn/(uRingK*uRingK))/uRingPx;
  float dens = band(rk,74.5,92.0) + band(rk,92.0,117.5) + band(rk,122.2,136.8);
  if(dens < 0.5) discard;
  if(dn >= 0.0 && dist <= vR) discard;
  o = vec4(vCol, 1.0);
}`;
function shader(type, src){ const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
  if(!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.error(gl.getShaderInfoLog(s)); return s; }
const prog = gl.createProgram();
gl.attachShader(prog, shader(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, shader(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog);
if(!gl.getProgramParameter(prog, gl.LINK_STATUS)){ console.error('The renderer failed to start:', gl.getProgramInfoLog(prog)); return; }
gl.useProgram(prog);
const U = {}; for(const n of ['uRes','uRingDir','uRingK','uRingPx']) U[n] = gl.getUniformLocation(prog, n);
gl.uniform2f(U.uRingDir, RING_DIR[0], RING_DIR[1]); gl.uniform1f(U.uRingK, RING_K);
const vao = gl.createVertexArray(); gl.bindVertexArray(vao);
const quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, 1,1]), gl.STATIC_DRAW);
gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
const STRIDE = 7, NINST = NALL + 1;                     /* + Saturn's ring */
const inst = new Float32Array(NINST*STRIDE);
const ibuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ibuf); gl.bufferData(gl.ARRAY_BUFFER, inst.byteLength, gl.DYNAMIC_DRAW);
for(const [loc, size, off] of [[1,2,0],[2,1,2],[3,3,3],[4,1,6]]){ gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, STRIDE*4, off*4); gl.vertexAttribDivisor(loc, 1); }
for(let i=0;i<NALL;i++){ const o = i*STRIDE; inst[o+3] = 0; inst[o+4] = 0; inst[o+5] = 0; inst[o+6] = 0;   /* every body is ink-black on the white page */ }
{ const o = NALL*STRIDE; inst[o+3] = inst[o+4] = inst[o+5] = 0.6; inst[o+6] = 1; }
gl.clearColor(1,1,1,1);

/* ---------- viewport ---------- */
let vw = 1, vh = 1;
function resize(){
  vw = canvas.clientWidth || 1; vh = canvas.clientHeight || 1;
  if(canvas.width !== vw || canvas.height !== vh){ canvas.width = vw; canvas.height = vh; }   /* one CSS pixel per rendered pixel */
  gl.viewport(0,0,vw,vh); gl.uniform2f(U.uRes, vw, vh);
}
new ResizeObserver(resize).observe(canvas); resize();

/* ---------- camera: centre = ALL[follow] + (ox,oy) in AU; logS = ln(px per AU). Input applies directly. ---------- */
const cam = { follow:0, ox:0, oy:0, logS:0, flight:null, dragging:false };
const minLog = () => Math.log(Math.min(vw,vh)/200), maxLog = () => Math.log(4e6);
const clampLog = x => Math.min(maxLog(), Math.max(minLog(), x));
function worldRelAt(sx, sy){ const s = Math.exp(cam.logS); return { x: cam.ox + (sx - vw/2)/s, y: cam.oy - (sy - vh/2)/s }; }
/* van Wijk & Nuij smooth zoom-and-pan path; (x,y) in AU, w = visible width in AU */
function zoomPath(ux0,uy0,w0,ux1,uy1,w1){
  const rho = Math.SQRT2, rho2 = 2, rho4 = 4;
  const dx = ux1-ux0, dy = uy1-uy0, d2 = dx*dx+dy*dy;
  if(d2 < 1e-24){ const S = Math.log(w1/w0)/rho; return { S:Math.abs(S), f:t => [ux0+t*dx, uy0+t*dy, w0*Math.exp(rho*t*S)] }; }
  const d1 = Math.sqrt(d2);
  const b0 = (w1*w1 - w0*w0 + rho4*d2)/(2*w0*rho2*d1), b1 = (w1*w1 - w0*w0 - rho4*d2)/(2*w1*rho2*d1);
  const r0 = -Math.asinh(b0), r1 = -Math.asinh(b1), S = (r1-r0)/rho, cr0 = Math.cosh(r0), sr0 = Math.sinh(r0);
  return { S:Math.abs(S), f:t => { const s = t*S; const u = w0/(rho2*d1)*(cr0*Math.tanh(rho*s+r0) - sr0); return [ux0+u*dx, uy0+u*dy, w0*cr0/Math.cosh(rho*s+r0)]; } };
}
function flyTo(i){
  const s = Math.exp(cam.logS), F = ALL[cam.follow], D = ALL[i];
  const p0x = F.x + cam.ox - D.x, p0y = F.y + cam.oy - D.y;
  const w0 = vw/s, w1 = Math.max(D.w, Math.min(vw,vh)/4e6) * (vw/Math.min(vw,vh));
  const z = zoomPath(p0x, p0y, w0, 0, 0, w1);
  cam.follow = i; markFollow();
  if(reduceMotion){ cam.ox = 0; cam.oy = 0; cam.logS = clampLog(Math.log(vw/w1)); cam.flight = null; return; }
  cam.flight = { f:z.f, t0:performance.now(), dur: Math.min(2600, Math.max(700, z.S*300)) };
}
function flyOut(){ const s = Math.exp(cam.logS), F = ALL[cam.follow]; cam.follow = 0; cam.ox = F.x + cam.ox; cam.oy = F.y + cam.oy; markFollow();
  const w0 = vw/s, w1 = 66*(vw/Math.min(vw,vh)); const z = zoomPath(cam.ox, cam.oy, w0, 0, 0, w1);
  if(reduceMotion){ cam.ox = cam.oy = 0; cam.logS = clampLog(Math.log(vw/w1)); return; }
  cam.flight = { f:z.f, t0:performance.now(), dur: Math.min(2600, Math.max(700, z.S*300)) }; }
function markFollow(){ for(let i=0;i<NALL;i++) labels[i].classList.toggle('on', i===cam.follow); }

/* ---------- input: direct manipulation, no smoothing ---------- */
const ptrs = new Map(); let pinch = null, down = null;
canvas.addEventListener('pointerdown', e => {
  canvas.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, {x:e.clientX, y:e.clientY}); cam.flight = null;
  if(ptrs.size === 1){ down = {x:e.clientX, y:e.clientY, t:performance.now()}; cam.dragging = true; }
  else if(ptrs.size === 2){ down = null; const [a,b] = [...ptrs.values()]; pinch = {d:Math.hypot(a.x-b.x,a.y-b.y), mx:(a.x+b.x)/2, my:(a.y+b.y)/2}; }
});
canvas.addEventListener('pointermove', e => {
  const p = ptrs.get(e.pointerId); if(!p) return;
  const px = p.x, py = p.y; p.x = e.clientX; p.y = e.clientY;
  if(ptrs.size === 1){ const s = Math.exp(cam.logS); cam.ox -= (e.clientX-px)/s; cam.oy += (e.clientY-py)/s; }
  else if(ptrs.size === 2 && pinch){
    const [a,b] = [...ptrs.values()];
    const d = Math.hypot(a.x-b.x, a.y-b.y), mx = (a.x+b.x)/2, my = (a.y+b.y)/2, s = Math.exp(cam.logS);
    cam.ox -= (mx-pinch.mx)/s; cam.oy += (my-pinch.my)/s;
    const wr = worldRelAt(mx, my); cam.logS = clampLog(cam.logS + Math.log(d/Math.max(1,pinch.d)));
    const s2 = Math.exp(cam.logS); cam.ox = wr.x - (mx - vw/2)/s2; cam.oy = wr.y + (my - vh/2)/s2;
    pinch = {d, mx, my};
  }
});
function endPtr(e){
  ptrs.delete(e.pointerId); if(ptrs.size < 2) pinch = null;
  if(ptrs.size === 0){ cam.dragging = false;
    if(down){ const dt = performance.now()-down.t, dist = Math.hypot(e.clientX-down.x, e.clientY-down.y);
      if(dist < 5 && dt < 500){ const hit = hitTest(e.clientX, e.clientY); if(hit >= 0) flyTo(hit); } down = null; }
  } else down = null;
}
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', e => {
  e.preventDefault();
  let dy = e.deltaY; if(e.deltaMode === 1) dy *= 16; else if(e.deltaMode === 2) dy *= vh;
  const k = e.ctrlKey ? 0.011 : 0.0024;                     /* trackpad pinch arrives as ctrl+wheel */
  cam.flight = null;
  const wr = worldRelAt(e.clientX, e.clientY);              /* the world point under the cursor stays put */
  cam.logS = clampLog(cam.logS - dy*k);
  const s2 = Math.exp(cam.logS); cam.ox = wr.x - (e.clientX - vw/2)/s2; cam.oy = wr.y + (e.clientY - vh/2)/s2;
}, {passive:false});
for(const ev of ['gesturestart','gesturechange','gestureend']) canvas.addEventListener(ev, e => e.preventDefault());
let tWarp = 1, logWarp = 0; const wv = {v:0};
addEventListener('keydown', e => {
  if(e.metaKey || e.ctrlKey || e.altKey) return;
  if(e.key === ']' || e.key === '.') tWarp = Math.min(1e7, tWarp*10);
  else if(e.key === '[' || e.key === ',') tWarp = Math.max(1, tWarp/10);
  else if(e.key === '0'){ tWarp = 1; simT = Date.now(); }
  else if(e.key === 'Escape'){ flyOut(); }
  else return;
  e.preventDefault();
});
const sx = new Float64Array(NALL), sy = new Float64Array(NALL), sr = new Float64Array(NALL);   /* screen position (CSS px, y down) and radius */
function hitTest(x, y){
  let best = -1, bd = 1e9;
  for(let i=0;i<NALL;i++){ const d = Math.hypot(x-sx[i], y-sy[i]) - Math.max(sr[i], 9); if(d < 0 && d < bd){ bd = d; best = i; } }
  return best;
}

/* ---------- labels: snap on/off, never overlap; a moon's label appears once it stands clear of its parent ---------- */
const labels = ALL.map((b,i) => { const el = document.createElement('button'); el.className = 'lbl' + (b.moon ? ' moon' : ''); el.type = 'button';
  el.textContent = (b.uncertain ? '~' : '') + b.n; el.title = b.uncertain ? b.n + ': position along its orbit uncertain (published period too coarse)' : b.n;
  el.hidden = true; el.addEventListener('click', () => flyTo(i)); layer.appendChild(el); return el; });
const shown = new Uint8Array(NALL), placed = [];
const order = ALL.map((b,i) => i).sort((p,q) => ALL[q].r - ALL[p].r);   /* bigger bodies claim label space first */
function updateLabels(){
  placed.length = 0;
  for(let k=0;k<NALL;k++){
    const i = order[k], b = ALL[i], el = labels[i];
    let ok = sx[i] > -20 && sx[i] < vw+20 && sy[i] > 40 && sy[i] < vh+20 && sr[i] < Math.min(vw,vh)*0.7;
    if(ok && b.moon){ const P = b.parent ?? 3; ok = Math.hypot(sx[i]-sx[P], sy[i]-sy[P]) > sr[P] + 18; }
    else if(ok && i > 0){ ok = Math.hypot(sx[i]-sx[0], sy[i]-sy[0]) > 14; }
    let x = 0, y = 0, w = 0, h = 13;
    if(ok){
      x = sx[i] + Math.max(sr[i],0) + 7; y = sy[i] - 7; w = (b.n.length + (b.uncertain?1:0))*7.6 + 8;
      for(const r of placed){ if(x < r.x+r.w && x+w > r.x && y < r.y+r.h && y+h > r.y){ ok = false; break; } }
    }
    if(ok){ placed.push({x,y,w,h}); el.style.transform = `translate(${x.toFixed(0)}px, ${y.toFixed(0)}px)`; }
    if(shown[i] !== (ok?1:0)){ shown[i] = ok?1:0; el.hidden = !ok; }
  }
}
const fmtClock = new Intl.DateTimeFormat(undefined, {weekday:'short', day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', timeZoneName:'short'});
let lastSec = -1, lastWarpShown = -1;
function smoothDamp(cur, target, st, smoothTime, dt){
  const omega = 2/smoothTime, x = omega*dt, ex = 1/(1 + x + 0.48*x*x + 0.235*x*x*x);
  const change = cur - target, temp = (st.v + omega*change)*dt; st.v = (st.v - omega*temp)*ex;
  let out = target + (change + temp)*ex; if((target - cur > 0) === (out > target)){ out = target; st.v = 0; } return out;
}

/* ---------- frame ---------- */
let simT = Date.now(), last = performance.now();
function frame(now){
  requestAnimationFrame(frame);
  let dt = (now - last)/1000; last = now; if(dt > 0.05) dt = 0.05; if(dt < 0) dt = 0;
  logWarp = smoothDamp(logWarp, Math.log(tWarp), wv, 0.25, dt);
  if(held !== null) simT = held;
  else if(tWarp === 1 && Math.abs(logWarp) < 1e-3){ logWarp = 0; wv.v = 0; simT = Date.now(); } else simT += dt*Math.exp(logWarp)*1000;
  updatePositions(simT);
  if(cam.flight){
    const fl = cam.flight; let t = (now - fl.t0)/fl.dur; if(!(t > 0)) t = 0; if(t >= 1) t = 1;
    const [ox,oy,w] = fl.f(t); cam.ox = ox; cam.oy = oy; cam.logS = clampLog(Math.log(vw/w));
    if(t >= 1) cam.flight = null;
  }
  const F = ALL[cam.follow], cx = F.x + cam.ox, cy = F.y + cam.oy, s = Math.exp(cam.logS);
  for(let i=0;i<NALL;i++){
    const b = ALL[i], o = i*STRIDE;
    const px = Math.round((b.x-cx)*s), py = Math.round((b.y-cy)*s);   /* centres snap to whole pixels so a disc's shape is stable while it moves */
    inst[o] = px; inst[o+1] = py; inst[o+2] = b.r/AU_KM*s;              /* true size, no floor */
    sx[i] = vw/2 + px; sy[i] = vh/2 - py; sr[i] = inst[o+2];
  }
  { const o = NALL*STRIDE, so = SATURN*STRIDE; inst[o] = inst[so]; inst[o+1] = inst[so+1]; inst[o+2] = inst[so+2]*(sr[SATURN] > 2 ? 1 : 0); }
  gl.uniform1f(U.uRingPx, s/AU_KM*1000);
  gl.bindBuffer(gl.ARRAY_BUFFER, ibuf); gl.bufferSubData(gl.ARRAY_BUFFER, 0, inst);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, NINST);
  updateLabels();
  const sec = Math.floor(simT/1000);
  if(sec !== lastSec || tWarp !== lastWarpShown){ lastSec = sec; lastWarpShown = tWarp;
    const when = fmtClock.format(new Date(simT)); clockEl.textContent = tWarp === 1 ? when : `×${tWarp.toLocaleString()} · ${when}`; }
}

/* ---------- writings: resting on a date holds the sky (and the clock) at that moment; leaving lets it go, with no animation.
   Keyboard focus does the same. On a touch screen a tap holds it until the next tap anywhere else. ---------- */
let held = null, heldFrom = 0;
function hold(t){ if(held === null) heldFrom = simT; held = t; }
function release(){ if(held === null) return; held = null; if(tWarp !== 1) simT = heldFrom; }
for(const d of document.querySelectorAll('.writings .d')){
  const t = Date.parse(d.dataset.t); if(!Number.isFinite(t)) continue;
  d.addEventListener('mouseenter', () => hold(t)); d.addEventListener('mouseleave', release);
  d.addEventListener('focus', () => hold(t)); d.addEventListener('blur', release);
}
document.addEventListener('pointerdown', e => {
  if(e.pointerType === 'mouse') return;
  const d = e.target.closest && e.target.closest('.writings .d');
  document.querySelectorAll('.writings .d.on').forEach(x => { if(x !== d) x.classList.remove('on'); });
  if(d){ d.classList.add('on'); hold(Date.parse(d.dataset.t)); } else release();
});

/* ---------- start: straight into the inner system, once the canvas has a size ---------- */
function boot(now){
  resize();
  if(vw < 2 || vh < 2){ requestAnimationFrame(boot); return; }
  last = now; updatePositions(simT);
  cam.follow = 0; cam.logS = clampLog(Math.log(Math.min(vw,vh)/3.9)); markFollow();
  requestAnimationFrame(frame);
}
requestAnimationFrame(boot);
})();

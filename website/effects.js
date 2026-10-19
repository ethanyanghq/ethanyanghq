// Idle effects for the ASCII painting. Each effect is a small state machine stepped by one
// requestAnimationFrame loop; when any of them changed a cell, the grid is uploaded once.
// All of them only swap characters in cells, so the drawing never moves.
// start() returns stop() and resolve(). The renderer re-converts the grid on the GPU as the
// viewport changes; while its CPU mirror is stale (ASCII.stale) the effects hold, and when a fresh
// mirror lands ("ascii-grid") they restart on it. resolve() ripples the first grid in.

import { eye } from "./regions.js";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const SPACE = 0;

function start(A) {
  const cleanup = [];                            // listeners to remove on stop()
  const owned = new Set();                       // cells currently held by an effect
  const key = (r, c) => r * A.cols + c;
  const inView = (r, c) => { const v = A.visible(); return r >= v.row0 && r <= v.row1 && c >= v.col0 && c <= v.col1; };

  // glow: cells an effect touched light up and fade over GLOW_MS, so a swap between two
  // similar glyphs still registers as a spark without moving the drawing
  const GLOW_MS = 700;
  const glowing = new Map();                     // key -> [r, c, startTime, strength]
  const spark = (r, c, t, strength = 1) => { glowing.set(key(r, c), [r, c, t, strength]); A.setGlow(r, c, strength); };
  function fadeGlow(t) {
    let changed = false;
    for (const [k, [r, c, t0, s]] of glowing) {
      const v = s * Math.max(0, 1 - (t - t0) / GLOW_MS);
      A.setGlow(r, c, v); changed = true;
      if (v <= 0) glowing.delete(k);
    }
    return changed;
  }

  // morph: crossfade a cell from its current glyph to another over ms (pixel-smooth)
  const morphs = new Map();                      // key -> [r, c, startTime, ms]
  const morph = (r, c, id, t, ms) => {
    const cur = A.idAt(r, c);
    if (cur === id) return;
    A.setFrom(r, c, cur); A.setId(r, c, id); A.setBlend(r, c, 0);
    morphs.set(key(r, c), [r, c, t, ms]);
  };
  function stepMorphs(t) {
    let changed = false;
    for (const [k, [r, c, t0, ms]] of morphs) {
      const b = Math.max(0, Math.min(1, (t - t0) / ms));   // t0 may lie ahead (resolve delays)
      A.setBlend(r, c, b); changed = true;
      if (b >= 1) morphs.delete(k);
    }
    return changed;
  }

  // -- caret: a block cursor blinking in the last visible cell, like a prompt waiting ------
  function caret() {
    let r = -1, c = -1, orig = SPACE, on = false, next = 0;
    function place() {
      if (r >= 0) { A.setId(r, c, orig); owned.delete(key(r, c)); }
      const v = A.visible();
      r = v.row1; c = v.col1; orig = A.idAt(r, c);
      owned.add(key(r, c));
      on = true; A.setId(r, c, A.BLOCK); A.setGlow(r, c, 1); A.flush();
    }
    cleanup.push(A.onLayout(place)); place();
    if (REDUCED) return () => false;              // static caret
    return (t) => {
      if (t < next) return false;
      next = t + 530;
      on = !on;
      A.setId(r, c, on ? A.BLOCK : orig);
      return true;
    };
  }

  // -- typo: every 8-15 s one cell mistypes a same-tone glyph, pauses, backspaces, retypes --
  function typo() {
    const similar = [];                            // for each glyph id: ids with nearly the same ink
    for (let i = 0; i < 95; i++) {
      similar[i] = [];
      for (let j = 1; j < 95; j++) { const d = Math.abs(A.state.tone[i] - A.state.tone[j]); if (j !== i && d > 0.04 && d < 0.14) similar[i].push(j); }
    }
    let phase = 0, next = rand(2500, 5000), r = 0, c = 0, orig = SPACE;
    return (t) => {
      if (t < next) return false;
      if (phase === 0) {
        const v = A.visible();
        for (let tries = 0; tries < 20; tries++) {
          r = (rand(v.row0, v.row1 + 1)) | 0; c = (rand(v.col0, v.col1 + 1)) | 0;
          orig = A.idAt(r, c);
          if (!owned.has(key(r, c)) && !morphs.has(key(r, c)) && orig !== SPACE && similar[orig].length) break;
          orig = -1;
        }
        if (orig < 0) { next = t + 1000; return false; }
        owned.add(key(r, c));
        A.setId(r, c, pick(similar[orig])); spark(r, c, t);
        phase = 1; next = t + rand(450, 700);
      } else if (phase === 1) {
        A.setId(r, c, A.BLOCK); A.setGlow(r, c, 1);   // cursor lands on the mistake
        phase = 2; next = t + 160;
      } else if (phase === 2) {
        A.setId(r, c, SPACE); A.setGlow(r, c, 0);     // backspace
        phase = 3; next = t + 110;
      } else {
        A.setId(r, c, orig); spark(r, c, t);          // retype
        owned.delete(key(r, c));
        phase = 0; next = t + rand(5000, 9000);
      }
      return true;
    };
  }

  // -- breathe: in flat areas, a few letters slowly swap case and back ---------------------
  function breathe() {
    const swap = new Map();                        // glyph id -> case-swapped id, when the ink is close
    for (let ch = 97; ch <= 122; ch++) {
      const lo = ch - 32, up = ch - 32 - 32;
      if (Math.abs(A.state.tone[lo] - A.state.tone[up]) < 0.1) { swap.set(lo, up); swap.set(up, lo); }
    }
    const flat = [];                                // cells whose 3x3 neighbourhood has nearly uniform ink
    for (let r = 1; r < A.rows - 1; r++) for (let c = 1; c < A.cols - 1; c++) {
      if (!swap.has(A.idAt(r, c))) continue;
      let sum = 0, sq = 0;
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const v = A.state.tone[A.idAt(r + dr, c + dc)]; sum += v; sq += v * v; }
      const mean = sum / 9, sd = Math.sqrt(Math.max(0, sq / 9 - mean * mean));
      if (sd < 0.05) flat.push([r, c]);
    }
    const active = [];                              // [r, c, originalId, restoreAt]
    let next = 0;
    return (t) => {
      let changed = false;
      for (let i = active.length - 1; i >= 0; i--) {
        const [r, c, orig, at] = active[i];
        if (t >= at) { morph(r, c, orig, t, 300); owned.delete(key(r, c)); active.splice(i, 1); changed = true; }
      }
      if (t >= next && flat.length) {
        next = t + 450;
        const n = Math.max(2, Math.round(flat.length * 0.006));
        for (let i = 0; i < n; i++) {
          const [r, c] = pick(flat);
          if (owned.has(key(r, c)) || morphs.has(key(r, c)) || !inView(r, c)) continue;
          const orig = A.idAt(r, c);
          owned.add(key(r, c));
          morph(r, c, swap.get(orig), t, 300); spark(r, c, t, 0.55);
          active.push([r, c, orig, t + rand(1200, 2600)]);
          changed = true;
        }
      }
      return changed;
    };
  }

  // -- blink: the Homunculus blinks when the page is clicked -------------------------------
  // The eye is a region of the image; it is mapped onto the current grid through the crop.
  // Open = the pupil cells cleared to spaces. Closed = a lid line on the top row, the skin
  // below the eye copied up into the rest. Three in-betweens step each cell through a density
  // ramp by ink; every step is a crossfade, so the lid slides rather than snaps.
  function eyeCells() {
    const { sx, sy, sw, sh } = A.crop;
    const toC = (x) => (x - sx) / sw * A.cols, toR = (y) => (y - sy) / sh * A.rows;
    const c0 = toC(eye.x0), c1 = toC(eye.x1), r0 = toR(eye.y0), r1 = toR(eye.y1);
    const cx = (c0 + c1) / 2, cy = (r0 + r1) / 2, rx = (c1 - c0) / 2 * 0.85, ry = (r1 - r0) / 2 * 0.85;
    const hole = [], box = [];                     // box: cells whose centre is inside the rectangle
    for (let r = Math.floor(r0); r < Math.ceil(r1); r++) for (let c = Math.floor(c0); c < Math.ceil(c1); c++) {
      if (r < 0 || c < 0 || r >= A.rows || c >= A.cols) continue;
      if (c + 0.5 >= c0 && c + 0.5 <= c1 && r + 0.5 >= r0 && r + 0.5 <= r1) box.push([r, c]);
      if (((c + 0.5 - cx) / rx) ** 2 + ((r + 0.5 - cy) / ry) ** 2 <= 1) hole.push([r, c]);
    }
    if (!hole.length) {
      const r = Math.floor(cy), c = Math.floor(cx);
      if (r >= 0 && c >= 0 && r < A.rows && c < A.cols) hole.push([r, c]);
    }
    for (const h of hole) if (!box.some(([r, c]) => r === h[0] && c === h[1])) box.push(h);
    return { hole, box };
  }
  function blink() {
    const { hole, box: cells } = eyeCells();
    if (!hole.length) return () => false;
    const rows = cells.map(([r]) => r), cols = cells.map(([, c]) => c);
    const R0 = Math.min(...rows), R1 = Math.max(...rows), C0 = Math.min(...cols), C1 = Math.max(...cols);
    const id = (ch) => ch.charCodeAt(0) - 32;
    const isHole = new Set(hole.map(([r, c]) => key(r, c)));
    for (const [r, c] of hole) A.setId(r, c, SPACE);
    const box = [];                                  // [r, c, openId, closedId]
    for (let r = R0; r <= R1; r++) for (let c = C0; c <= C1; c++) {
      const open = isHole.has(key(r, c)) ? SPACE : A.idAt(r, c);
      const below = Math.min(A.rows - 1, R1 + 1);
      const closed = r === R0 ? id("-") : A.idAt(below, c);
      box.push([r, c, open, closed]);
      owned.add(key(r, c));
    }
    const RAMP = Array.from(" .:-=c%", id);
    const nearest = (tone) => RAMP.reduce((b, g) => Math.abs(A.state.tone[g] - tone) < Math.abs(A.state.tone[b] - tone) ? g : b);
    const frames = [box.map(b => b[2])];
    for (let k = 1; k <= 3; k++) frames.push(box.map(([, , o, cl]) => nearest(A.state.tone[o] + (A.state.tone[cl] - A.state.tone[o]) * k / 4)));
    frames.push(box.map(b => b[3]));
    const DOWN = 36, HOLD = 140, UP = 46;          // ms per leg down, closed hold, ms per leg up
    const legs = [];                                // [frameIndex, legMs, holdAfterMs]
    for (let i = 1; i < frames.length; i++) legs.push([i, DOWN, i === frames.length - 1 ? HOLD : 0]);
    for (let i = frames.length - 2; i >= 0; i--) legs.push([i, UP, 0]);
    const write = (frame, t, ms) => { box.forEach(([r, c], i) => morph(r, c, frame[i], t, ms)); };
    let li = -1, next = Infinity, queued = 0;
    const onDown = () => { queued = Math.min(queued + 1, 2); };
    window.addEventListener("pointerdown", onDown);
    cleanup.push(() => window.removeEventListener("pointerdown", onDown));
    return (t) => {
      if (li < 0 && queued > 0) { queued--; next = t; }  // a click starts a blink right away
      if (t < next) return false;
      li++;
      if (li < legs.length) {
        const [fi, ms, hold] = legs[li];
        write(frames[fi], t, ms);
        next = t + ms + hold;
        return true;
      }
      li = -1; next = Infinity;                       // back to open, wait for the next click
      return true;
    };
  }

  // -- resolve: after a grid swap every cell starts on a random glyph of nearly the same ink
  // and crossfades to its real glyph, rippling out from the centre with a little jitter
  function resolve(t) {
    const near = [];                               // for each glyph id: ids with nearly the same ink
    for (let i = 0; i < 95; i++) {
      near[i] = [];
      for (let j = 0; j < 95; j++) if (j !== i && Math.abs(A.state.tone[i] - A.state.tone[j]) < 0.06) near[i].push(j);
    }
    const cx = (A.cols - 1) / 2, cy = (A.rows - 1) / 2, far = Math.hypot(cx, cy * 2) || 1;   // cells are 1:2
    for (let r = 0; r < A.rows; r++) for (let c = 0; c < A.cols; c++) {
      if (owned.has(key(r, c))) continue;
      const id = A.idAt(r, c);
      A.setFrom(r, c, near[id].length ? pick(near[id]) : SPACE);
      A.setBlend(r, c, 0);
      const delay = Math.random() * 120 + Math.hypot(c - cx, (r - cy) * 2) / far * 300;
      morphs.set(key(r, c), [r, c, t + delay, 180]);
    }
    A.flush();
  }

  const effects = [caret(), blink()];
  if (!REDUCED) effects.push(typo(), breathe());
  A.flush();
  let raf = 0;
  const loop = (t) => {
    if (A.stale) { raf = requestAnimationFrame(loop); return; }   // grid is mid-resize: hold
    let dirty = stepMorphs(t);                   // finish running crossfades before effects start new ones
    for (const step of effects) dirty = step(t) || dirty;
    dirty = fadeGlow(t) || dirty;
    if (dirty) A.flush();
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return {
    resolve,
    stop() {
      cancelAnimationFrame(raf);
      for (const fn of cleanup) fn();
    },
  };
}

let running = null;
function boot() {
  const A = window.ASCII;
  const first = !running;
  if (running) running.stop();
  running = start(A);
  if (first && !REDUCED) running.resolve(performance.now());
}
window.addEventListener("ascii-grid", boot);
const ready = () => { if (!window.ASCII.stale) boot(); };   // else the first "ascii-grid" boots
if (window.ASCII) ready();
else window.addEventListener("ascii-ready", ready, { once: true });

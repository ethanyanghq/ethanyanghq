// Idle effects for the ASCII painting. Each effect is a small state machine stepped by one
// requestAnimationFrame loop; when any of them changed a cell, the grid is uploaded once.
// All of them only swap characters in cells, so the drawing never moves.

import { eye } from "./regions.js";

const REDUCED = matchMedia("(prefers-reduced-motion: reduce)").matches;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const SPACE = 0;

function start(A) {
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
      const b = Math.min(1, (t - t0) / ms);
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
    A.onLayout(place); place();
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
          if (!owned.has(key(r, c)) && orig !== SPACE && similar[orig].length) break;
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
          if (owned.has(key(r, c)) || !inView(r, c)) continue;
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

  // -- blink: the Homunculus blinks every 8-15 s ------------------------------------------
  // Frames go open -> three in-betweens -> closed; every step is a crossfade, so the lid
  // slides rather than snaps.
  function blink() {
    const frames = [eye.open, ...eye.frames, eye.closed];
    const DOWN = 36, HOLD = 140, UP = 46;          // ms per leg down, closed hold, ms per leg up
    const legs = [];                                // [frameIndex, legMs, holdAfterMs]
    for (let i = 1; i < frames.length; i++) legs.push([i, DOWN, i === frames.length - 1 ? HOLD : 0]);
    for (let i = frames.length - 2; i >= 0; i--) legs.push([i, UP, 0]);
    const write = (frame, t, ms) => {
      for (let i = 0; i < frame.length; i++) for (let j = 0; j < frame[i].length; j++) {
        morph(eye.row + i, eye.col + j, frame[i].charCodeAt(j) - 32, t, ms);
      }
    };
    for (let i = 0; i < eye.open.length; i++) for (let j = 0; j < eye.open[i].length; j++) owned.add(key(eye.row + i, eye.col + j));
    let li = -1, next = rand(3000, 6000), second = false;
    return (t) => {
      if (t < next) return false;
      li++;
      if (li < legs.length) {
        const [fi, ms, hold] = legs[li];
        write(frames[fi], t, ms);
        next = t + ms + hold;
        return true;
      }
      li = -1;                                        // back to open
      if (second) { second = false; next = t + rand(8000, 15000); }
      else if (Math.random() < 0.2) { second = true; next = t + 200; }   // double blink
      else next = t + rand(8000, 15000);
      return true;
    };
  }

  const effects = [caret(), blink()];
  if (!REDUCED) effects.push(typo(), breathe());
  A.flush();
  const loop = (t) => {
    let dirty = stepMorphs(t);                   // finish running crossfades before effects start new ones
    for (const step of effects) dirty = step(t) || dirty;
    dirty = fadeGlow(t) || dirty;
    if (dirty) A.flush();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

if (window.ASCII) start(window.ASCII);
else window.addEventListener("ascii-ready", () => start(window.ASCII), { once: true });

/* Window primitive. A box bounded by thin black lines that floats above the sky, independent of the camera.
   Drag anywhere on it to move. One handle, the top-right corner, resizes; the bottom-left is the anchor.
   Drag the handle all the way in and the window collapses to a line, then to the caret alone: there is no
   minimised state, only geometry. No buttons, no chrome, no animation: input is direct.
   Contents are left to the caller: makeWindow() returns the element, and its .body is the slot to fill. */
(() => {
'use strict';
const SNAP = 10;                               /* px: a dimension dragged below this snaps to zero */
let zTop = 10;                                 /* last window touched sits on top */

function clamp(v, lo, hi){ return v < lo ? lo : v > hi ? hi : v; }

function makeWindow({x = 40, y = 120, w = 320, h = 200} = {}){
  const el = document.createElement('div'); el.className = 'win';
  const body = document.createElement('div'); body.className = 'win-body'; el.appendChild(body); el.body = body;
  const grab = document.createElement('div'); grab.className = 'win-grab'; el.appendChild(grab);
  const r = {x, y, w, h};
  function place(){
    /* integer positions keep the 1px border crisp; the whole box stays inside the viewport */
    r.w = clamp(Math.round(r.w), 0, innerWidth); r.h = clamp(Math.round(r.h), 0, innerHeight);
    r.x = clamp(Math.round(r.x), 0, innerWidth - r.w); r.y = clamp(Math.round(r.y), 0, innerHeight - r.h);
    el.style.transform = `translate(${r.x}px,${r.y}px)`; el.style.width = r.w + 'px'; el.style.height = r.h + 'px';
    el.classList.toggle('flat-x', r.w === 0); el.classList.toggle('flat-y', r.h === 0);
  }
  el.addEventListener('pointerdown', e => {
    if(e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    el.style.zIndex = ++zTop;
    const resize = e.target === grab;
    const sx = e.clientX, sy = e.clientY, o = {...r};
    const target = e.target; target.setPointerCapture(e.pointerId);
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if(resize){ /* the handle is top-right: width follows the pointer, height grows upward from the fixed bottom edge */
        r.w = o.w + dx; r.h = Math.min(o.h - dy, o.y + o.h);
        if(r.w < SNAP) r.w = 0; if(r.h < SNAP) r.h = 0;
        r.y = o.y + o.h - r.h; }
      else { r.x = o.x + dx; r.y = o.y + dy; }
      place();
    };
    const up = () => { target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', up); };
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', up); target.addEventListener('pointercancel', up);
  });
  addEventListener('resize', place);
  place(); document.body.appendChild(el);
  return el;
}

window.makeWindow = makeWindow;

/* one empty window so the primitive can be seen and tried */
makeWindow();
})();

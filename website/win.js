/* Window primitive. A box bounded by thin black lines that floats above the sky, independent of the camera.
   Drag anywhere on it to move. Every corner resizes, with the opposite corner as the anchor; only the
   bottom-right corner is marked, with a small L caret. Drag a corner all the way in and the window collapses to
   a line, then to the caret alone: there is no minimised state, only geometry. A collapsed window reopens from
   the caret only, in whichever direction it is pulled. No buttons, no chrome, no animation: input is direct.
   Contents are left to the caller: makeWindow() returns the element, and its .body is the slot to fill.
   Given a url, the window is a porthole onto that page: the page is laid out at full viewport size and stays
   fixed to the viewport, so moving the window pans across it. A press released without moving opens the page.
   A label outside the top-left corner names it and is the real link, for keyboards and screen readers. */
(() => {
'use strict';
const SLOP = 3;                                /* px: a press that travels less than this is a click, not a drag */
const SNAP = 10;                               /* px: a dimension dragged below this snaps to zero */
let zTop = 10;                                 /* last window touched sits on top */

function clamp(v, lo, hi){ return v < lo ? lo : v > hi ? hi : v; }

/* One axis of a corner resize. The edge opposite the handle is fixed; the handle's edge follows the pointer. Below SNAP,
   or pulled past the fixed edge, the side collapses onto it; overshooting never flips an open window. A side that
   starts collapsed has no such limit and opens whichever way it is pulled. A collapsed side is drawn as the box's leading border, one pixel at `pos`, so when the fixed edge
   is the far one the line sits one pixel back, exactly where that border was. Returns [pos, size]. */
function span(pos, size, d, lead, max){
  const far = pos + Math.max(size, 1);
  const fixed = lead ? far : pos;
  const moving = clamp((lead ? pos : pos + size) + d, 0, max);
  const lo = Math.min(fixed, moving), hi = Math.max(fixed, moving);
  const crossed = lead ? moving > fixed : moving < fixed;
  if(hi - lo < SNAP || (size > 0 && crossed)) return [lead ? fixed - 1 : fixed, 0];
  return [lo, hi - lo];
}

function makeWindow({x = 40, y = 120, w = 320, h = 200, url = '', label = ''} = {}){
  const el = document.createElement('div'); el.className = 'win';
  const body = document.createElement('div'); body.className = 'win-body'; el.appendChild(body); el.body = body;
  /* one handle per corner, named by the edges it moves; 'se' carries the caret */
  for(const dir of ['nw', 'ne', 'se', 'sw']){
    const g = document.createElement('div'); g.className = 'win-grab ' + dir; g.dataset.dir = dir; el.appendChild(g);
  }
  let view = null, tag = null;
  if(url){
    view = document.createElement('iframe'); view.className = 'win-view'; view.src = url; view.title = label || url;
    view.tabIndex = -1; view.inert = true; view.setAttribute('aria-hidden', 'true'); view.setAttribute('scrolling', 'no');
    body.appendChild(view);
  }
  if(label){
    tag = document.createElement(url ? 'a' : 'span'); tag.className = 'win-tag'; tag.textContent = label;
    if(url) tag.href = url;
    tag.draggable = false; el.appendChild(tag);
  }
  let dragged = false;
  const r = {x, y, w, h};
  function place(){
    /* integer positions keep the 1px border crisp; the whole box stays inside the viewport */
    r.w = clamp(Math.round(r.w), 0, innerWidth); r.h = clamp(Math.round(r.h), 0, innerHeight);
    /* a collapsed side is still one pixel of line, so keep that pixel on screen too */
    r.x = clamp(Math.round(r.x), 0, innerWidth - Math.max(r.w, 1)); r.y = clamp(Math.round(r.y), 0, innerHeight - Math.max(r.h, 1));
    el.style.transform = `translate(${r.x}px,${r.y}px)`; el.style.width = r.w + 'px'; el.style.height = r.h + 'px';
    el.classList.toggle('flat-x', r.w === 0); el.classList.toggle('flat-y', r.h === 0);
    /* the body starts one border in from the box; undo both so the page sits at the viewport's origin */
    if(view) view.style.transform = `translate(${-r.x - 1}px,${-r.y - 1}px)`;
  }
  el.addEventListener('pointerdown', e => {
    if(e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    el.style.zIndex = ++zTop;
    const dir = e.target.dataset.dir || '', resize = dir !== '';
    const sx = e.clientX, sy = e.clientY, o = {...r};
    const target = e.target; target.setPointerCapture(e.pointerId);
    dragged = false;
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if(!dragged && Math.hypot(dx, dy) < SLOP) return;
      dragged = true;
      if(resize){
        [r.x, r.w] = span(o.x, o.w, dx, dir.includes('w'), innerWidth);
        [r.y, r.h] = span(o.y, o.h, dy, dir.includes('n'), innerHeight);
      }
      else { r.x = o.x + dx; r.y = o.y + dy; }
      place();
    };
    const up = ev => {
      target.removeEventListener('pointermove', move); target.removeEventListener('pointerup', up); target.removeEventListener('pointercancel', up);
      /* the label is a link and opens itself; everywhere else on the box a still press does the same */
      if(url && !dragged && !resize && ev.type === 'pointerup' && target !== tag) location.assign(url);
    };
    target.addEventListener('pointermove', move); target.addEventListener('pointerup', up); target.addEventListener('pointercancel', up);
  });
  /* dragging by the label must not follow it */
  el.addEventListener('click', e => { if(dragged) e.preventDefault(); });
  addEventListener('resize', place);
  place(); document.body.appendChild(el);
  return el;
}

window.makeWindow = makeWindow;

/* Doppel's panel is 720px wide, centred, 48px from the top. Start as a small crop of its top-left corner: a strip of
   its dot ground, the title bar and the question line, stopping just above the NAME chip. Where that crop would run
   into the clock (which can grow to its max-width once it starts ticking), drop below the header instead. */
{
  const clock = document.getElementById('clock'), head = document.querySelector('.top');
  const clear = clock.getBoundingClientRect().left + (parseFloat(getComputedStyle(clock).maxWidth) || 0) + 24;
  const w = Math.min(300, innerWidth - 24), h = 80;
  let x = Math.round(innerWidth / 2) - 376, y = 40;
  if(x < clear){ x = Math.max(12, x); y = Math.round(head.getBoundingClientRect().bottom) + 8; }
  makeWindow({x, y, w, h, url: 'https://doppel.ethanyang.io/', label: 'doppel'});
}
})();

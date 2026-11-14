/**
 * TZ Digital — Cursor dot reveal
 *
 * Pulled apart lamalama.com's actual implementation (their WebGL shader +
 * cursor module, fetched and read directly) rather than guessing from the
 * recording. Two things it does that our old version didn't:
 *
 * 1. The reveal is stamped at the RAW, current pointer position on every
 *    mousemove — no easing on the center at all. Their "trailing" look is
 *    an emergent side-effect of decay, not of the center lagging behind.
 *    Our old version eased a `followX/Y` point toward the pointer over
 *    ~0.5s, which reads as sluggish input response — that's the "too
 *    slow" complaint.
 * 2. The brightness is a velocity/heat field that decays every rendered
 *    frame (`value *= 1 - decay`) regardless of whether the pointer is
 *    still moving, and goes fully idle ~1.5s after the last move. Our old
 *    version had no decay at all — the lit cluster just sat at the last
 *    position forever, which is the "doesn't disappear" bug.
 *
 * Reimplemented as a 2D-canvas analogue of the same idea (a real WebGL
 * fluid sim is out of scope for a static site): an offscreen "heat" canvas
 * gets a soft stamp added at the pointer on every move, decays via a
 * `destination-out` wash every frame, and is masked against a pre-rendered
 * dot grid to composite the visible cluster. Fixed grid of small dots,
 * flat light gray (~rgb(198,201,201)) on the dark ground, never moves —
 * only which dots are lit and how brightly.
 *
 * Desktop-with-a-mouse only (`hover: hover` + `pointer: fine`), fully
 * skipped under `prefers-reduced-motion: reduce`.
 */
(function () {
  'use strict';

  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!canHover || reducedMotion) return;

  var PITCH = 9;             // px between grid dots, both axes
  var DOT_SIZE = 1.6;        // px — drawn as a small square, halftone-style
  var DOT_RGB = '198,201,201'; // sampled directly from the reference recording
  var PEAK_OPACITY = 0.85;   // opacity of a fully-lit dot
  var DOT_ALPHA_JITTER = 0.3; // baked per-dot brightness variance (0..1 fraction) — halftone grain, no per-frame cost
  var INJECT_RADIUS = 60;    // px — soft stamp radius added at the pointer on every move
  var INJECT_ALPHA = 0.55;   // peak alpha of a single stamp, at its own center
  var TRAIL_TAU = 0.22;      // seconds — decay time constant; ~5x this and a stationary cluster is gone
  var IDLE_STOP_MS = 900;    // stop redrawing once the trail's fully decayed (perf, mirrors reference's own idle cutoff)

  var dpr = Math.min(window.devicePixelRatio || 1, 2);

  // Visible canvas — the only one attached to the page.
  var canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed; inset:0; pointer-events:none; z-index:150;';
  document.body.appendChild(canvas);
  var ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) return;

  // Offscreen heat field: gets a stamp added per pointer move, decays every frame.
  var trail = document.createElement('canvas');
  var tctx = trail.getContext('2d', { alpha: true });

  // Offscreen pre-rendered dot grid: static, only rebuilt on resize.
  var dots = document.createElement('canvas');
  var dctx = dots.getContext('2d', { alpha: true });

  if (!tctx || !dctx) return;

  // Deterministic per-cell hash (not Math.random) so each dot's baked
  // brightness is stable across resizes/reruns instead of flickering.
  function hash(col, row) {
    var s = Math.sin(col * 12.9898 + row * 78.233) * 43758.5453;
    return s - Math.floor(s); // 0..1
  }

  function buildDotGrid(pxW, pxH) {
    dots.width = pxW;
    dots.height = pxH;
    dctx.clearRect(0, 0, pxW, pxH);
    dctx.fillStyle = 'rgb(' + DOT_RGB + ')';
    var pitch = PITCH * dpr;
    var size = DOT_SIZE * dpr;
    var cols = Math.ceil(pxW / pitch) + 1;
    var rows = Math.ceil(pxH / pitch) + 1;
    for (var col = 0; col < cols; col++) {
      var x = col * pitch;
      for (var row = 0; row < rows; row++) {
        var y = row * pitch;
        var alpha = PEAK_OPACITY * (1 - DOT_ALPHA_JITTER + DOT_ALPHA_JITTER * hash(col, row));
        dctx.globalAlpha = alpha;
        dctx.fillRect(x, y, size, size);
      }
    }
    dctx.globalAlpha = 1;
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    var pxW = Math.round(window.innerWidth * dpr);
    var pxH = Math.round(window.innerHeight * dpr);

    canvas.width = pxW;
    canvas.height = pxH;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';

    trail.width = pxW;
    trail.height = pxH;

    buildDotGrid(pxW, pxH);
    updateNavRects();
  }
  resize();
  window.addEventListener('resize', resize);

  // Cut the nav pills out of the trail every frame so the dot field reads
  // as passing behind the nav rather than painting over it. Rects are
  // cached (fixed-position pills only move on resize/font-load) and
  // refreshed a beat after load in case web-font swap shifts pill widths.
  var navRects = [];
  function updateNavRects() {
    var pills = document.querySelectorAll('.nav__pill');
    navRects = [];
    for (var i = 0; i < pills.length; i++) {
      var r = pills[i].getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      navRects.push({
        x: r.left * dpr,
        y: r.top * dpr,
        w: r.width * dpr,
        h: r.height * dpr,
        radius: (r.height * dpr) / 2 // pill shape — fully rounded ends
      });
    }
  }
  window.addEventListener('load', function () {
    setTimeout(updateNavRects, 300);
  });

  function cutOutNavPills() {
    if (!navRects.length) return;
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    for (var i = 0; i < navRects.length; i++) {
      var p = navRects[i];
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(p.x, p.y, p.w, p.h, p.radius);
      } else {
        ctx.rect(p.x, p.y, p.w, p.h); // fallback: square cutout
      }
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  var lastMoveTime = -Infinity;

  function stamp(clientX, clientY) {
    var x = clientX * dpr;
    var y = clientY * dpr;
    var r = INJECT_RADIUS * dpr;
    var g = tctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, 'rgba(255,255,255,' + INJECT_ALPHA + ')');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    tctx.globalCompositeOperation = 'lighter'; // additive — a fast drag builds a continuous bright streak
    tctx.fillStyle = g;
    tctx.fillRect(x - r, y - r, r * 2, r * 2);
    tctx.globalCompositeOperation = 'source-over';
    lastMoveTime = performance.now();
  }

  function onMove(e) {
    stamp(e.clientX, e.clientY);
  }
  window.addEventListener('pointermove', onMove, { passive: true });

  var lastFrameTime = null;
  var running = true;

  function tick(now) {
    if (lastFrameTime === null) lastFrameTime = now;
    var dt = Math.min((now - lastFrameTime) / 1000, 1 / 15);
    lastFrameTime = now;

    var idleFor = now - lastMoveTime;

    if (running) {
      // Decay the heat field toward zero every frame — this alone is what
      // makes a stationary cluster fade out instead of sitting there.
      var decay = 1 - Math.exp(-dt / TRAIL_TAU);
      tctx.globalCompositeOperation = 'destination-out';
      tctx.fillStyle = 'rgba(0,0,0,' + decay.toFixed(3) + ')';
      tctx.fillRect(0, 0, trail.width, trail.height);
      tctx.globalCompositeOperation = 'source-over';

      // Composite: draw the heat field, then clip it to the dot grid so
      // only dot pixels show through, each carrying the heat field's local
      // alpha — this is what turns a smooth blob into the halftone look.
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage(trail, 0, 0);
      ctx.globalCompositeOperation = 'destination-in';
      ctx.drawImage(dots, 0, 0);
      ctx.globalCompositeOperation = 'source-over';

      cutOutNavPills();

      // Once fully decayed and idle, stop doing per-frame work until the
      // next pointer move re-arms it — mirrors the reference's own
      // animating-flag cutoff, and means an idle page does zero canvas work.
      if (idleFor > IDLE_STOP_MS) running = false;
    }

    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  // Re-arm the render loop the moment a new stamp lands after being idle.
  window.addEventListener('pointermove', function () {
    if (!running) {
      running = true;
      lastFrameTime = null;
    }
  }, { passive: true });
})();

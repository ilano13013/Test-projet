/* Utilitaires partagés : maths, easing, RNG à graine, géométrie, pooling.
   Aucune dépendance. Chargé en premier. */
window.LC = window.LC || {};

LC.util = (function () {
  const TAU = Math.PI * 2;

  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const lerp = (a, b, t) => a + (b - a) * t;

  /* Interpolation exponentielle indépendante du framerate (approche douce). */
  const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));

  const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
  const easeInOutSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
  const easeOutBack = t => { const c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };

  function normAngle(a) {
    while (a > Math.PI) a -= TAU;
    while (a < -Math.PI) a += TAU;
    return a;
  }
  /* Rapproche l'angle `a` de `target` d'au plus `maxStep` (radians). */
  function approachAngle(a, target, maxStep) {
    const d = normAngle(target - a);
    return a + Math.sign(d) * Math.min(Math.abs(d), maxStep);
  }
  /* Lissage angulaire exponentiel (respecte le plus court chemin). */
  function dampAngle(a, target, lambda, dt) {
    return a + normAngle(target - a) * (1 - Math.exp(-lambda * dt));
  }

  /* RNG déterministe à graine (mulberry32) — défis quotidiens / graines. */
  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s |= 0; s = (s + 0x6D2B79F5) | 0;
      let t = Math.imul(s ^ (s >>> 15), 1 | s);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /* Convertit une chaîne de graine en entier 32 bits. */
  function hashSeed(str) {
    let h = 2166136261;
    str = String(str);
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  /* --- géométrie --- */

  /* Paramètre d'entrée t (0..1) d'un segment dans un rectangle (Liang-Barsky), ou Infinity. */
  function rayRectT(x0, y0, x1, y1, r) {
    let t0 = 0, t1 = 1;
    const dx = x1 - x0, dy = y1 - y0;
    const p = [-dx, dx, -dy, dy];
    const q = [x0 - r.x, r.x + r.w - x0, y0 - r.y, r.y + r.h - y0];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return Infinity; }
      else {
        const t = q[i] / p[i];
        if (p[i] < 0) { if (t > t1) return Infinity; if (t > t0) t0 = t; }
        else { if (t < t0) return Infinity; if (t < t1) t1 = t; }
      }
    }
    return t0;
  }
  /* Ligne de vue dégagée entre deux points au regard d'une liste de rectangles. */
  function losClear(ax, ay, bx, by, rects) {
    for (const w of rects) if (rayRectT(ax, ay, bx, by, w) !== Infinity) return false;
    return true;
  }
  function circleHitsRect(cx, cy, r, rect) {
    const nx = clamp(cx, rect.x, rect.x + rect.w);
    const ny = clamp(cy, rect.y, rect.y + rect.h);
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }
  const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

  /* Pool d'objets générique : évite de recréer particules/effets à chaque frame. */
  function pool(factory, reset) {
    const free = [], live = [];
    return {
      live,
      spawn(init) {
        const o = free.pop() || factory();
        reset(o);
        if (init) init(o);
        live.push(o);
        return o;
      },
      /* update(o, dt) renvoie false pour recycler l'objet. */
      update(fn, dt) {
        for (let i = live.length - 1; i >= 0; i--) {
          if (fn(live[i], dt) === false) free.push(live.splice(i, 1)[0]);
        }
      },
      clear() { while (live.length) free.push(live.pop()); },
    };
  }

  return {
    TAU, clamp, lerp, damp, easeOutCubic, easeInOutSine, easeOutBack,
    normAngle, approachAngle, dampAngle, mulberry32, hashSeed,
    rayRectT, losClear, circleHitsRect, dist, pool,
  };
})();

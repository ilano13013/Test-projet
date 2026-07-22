/* Le joueur — petite étoile. Physique à inertie (marche / sprint / endurance),
   animation (squash & stretch, rotation, traînée, dégâts) et émission de bruit.
   Tout est piloté par le delta time ; aucun mouvement linéaire brut. */
window.LC = window.LC || {};

LC.player = (function () {
  const U = LC.util;

  const WALK = 172, SPRINT = 300;
  const ACCEL = 11, FRICTION = 9;          // lambda d'amortissement (inertie)
  const STAMINA_DRAIN = 0.55, STAMINA_REGEN = 0.32, STAMINA_MIN = 0.18;

  function create(cfg) {
    return {
      x: cfg.x, y: cfg.y, r: 11,
      vx: 0, vy: 0, angle: -Math.PI / 2,
      stamina: 1, sprinting: false, canSprint: true,
      spin: 0, pulse: Math.random() * U.TAU,
      scaleX: 1, scaleY: 1,
      hitFlash: 0, invincible: 0,
      trail: [], trailTimer: 0,
      noiseEvent: null, bumped: false, exposed: false,
      entering: 0, // animation d'entrée dans la porte (0 = inactif)
    };
  }

  /* input = { ax, ay, sprint }  ·  ctx = { blockers, size, dt } */
  function update(pl, input, ctx, dt) {
    pl.pulse += dt;
    pl.spin += dt * (0.5 + Math.hypot(pl.vx, pl.vy) / 400);
    pl.noiseEvent = null;
    pl.bumped = false;
    if (pl.invincible > 0) pl.invincible -= dt;
    if (pl.hitFlash > 0) pl.hitFlash = Math.max(0, pl.hitFlash - dt * 2);

    if (pl.entering > 0) { updateEntering(pl, dt); return; }

    let ax = input.ax, ay = input.ay;
    const mag = Math.hypot(ax, ay);
    if (mag > 1) { ax /= mag; ay /= mag; }
    const moving = mag > 0.02;

    /* endurance / sprint */
    const wantSprint = input.sprint && moving && pl.canSprint && pl.stamina > 0;
    pl.sprinting = wantSprint;
    if (wantSprint) {
      pl.stamina = Math.max(0, pl.stamina - STAMINA_DRAIN * dt);
      if (pl.stamina === 0) pl.canSprint = false;
    } else {
      pl.stamina = Math.min(1, pl.stamina + STAMINA_REGEN * dt);
      if (!pl.canSprint && pl.stamina >= STAMINA_MIN) pl.canSprint = true;
    }
    pl.exposed = pl.sprinting;

    const targetSpeed = pl.sprinting ? SPRINT : WALK;
    const desVx = ax * targetSpeed, desVy = ay * targetSpeed;
    const lambda = moving ? ACCEL : FRICTION;   // décélération fluide au relâchement
    pl.vx = U.damp(pl.vx, desVx, lambda, dt);
    pl.vy = U.damp(pl.vy, desVy, lambda, dt);

    const speed = Math.hypot(pl.vx, pl.vy);
    if (speed > 6) pl.angle = U.dampAngle(pl.angle, Math.atan2(pl.vy, pl.vx), 10, dt);

    /* déplacement + collisions séparées par axe (permet de longer les murs) */
    moveAxis(pl, ctx.blockers, pl.vx * dt, 0, ctx);
    moveAxis(pl, ctx.blockers, 0, pl.vy * dt, ctx);
    pl.x = U.clamp(pl.x, pl.r, ctx.size.w - pl.r);
    pl.y = U.clamp(pl.y, pl.r, ctx.size.h - pl.r);

    /* squash & stretch : étirement dans le sens du mouvement */
    const stretch = U.clamp(speed / SPRINT, 0, 1) * (pl.sprinting ? 0.42 : 0.22);
    pl.scaleX = U.damp(pl.scaleX, 1 + stretch, 12, dt);
    pl.scaleY = U.damp(pl.scaleY, 1 - stretch * 0.7, 12, dt);

    /* traînée lumineuse (surtout au sprint) */
    pl.trailTimer -= dt;
    if (speed > 60 && pl.trailTimer <= 0) {
      pl.trail.push({ x: pl.x, y: pl.y, life: pl.sprinting ? 0.45 : 0.28 });
      pl.trailTimer = 0.02;
      if (pl.trail.length > 24) pl.trail.shift();
    }
    for (let i = pl.trail.length - 1; i >= 0; i--) {
      pl.trail[i].life -= dt;
      if (pl.trail[i].life <= 0) pl.trail.splice(i, 1);
    }

    /* bruit : le sprint émet des ondes régulières ; la marche est discrète */
    if (pl.sprinting && speed > 120) {
      pl._noiseAcc = (pl._noiseAcc || 0) - dt;
      if (pl._noiseAcc <= 0) {
        pl.noiseEvent = { x: pl.x, y: pl.y, intensity: 0.7 };
        pl._noiseAcc = 0.32;
      }
    }
  }

  function moveAxis(pl, blockers, dx, dy, ctx) {
    pl.x += dx; pl.y += dy;
    for (const w of blockers) {
      if (U.circleHitsRect(pl.x, pl.y, pl.r, w)) {
        const fast = Math.hypot(pl.vx, pl.vy) > 240;
        if (dx > 0) pl.x = w.x - pl.r; else if (dx < 0) pl.x = w.x + w.w + pl.r;
        if (dy > 0) pl.y = w.y - pl.r; else if (dy < 0) pl.y = w.y + w.h + pl.r;
        if (dx) pl.vx = 0; if (dy) pl.vy = 0;
        if (fast && !pl._justBumped) {
          pl.bumped = true;
          pl.noiseEvent = { x: pl.x, y: pl.y, intensity: 0.55 };
          pl.scaleX = 0.75; pl.scaleY = 1.25;   // compression à l'impact
          pl._justBumped = 0.2;
        }
      }
    }
    if (pl._justBumped > 0) pl._justBumped -= ctx.dt; else pl._justBumped = 0;
  }

  function hit(pl, invTime) {
    pl.hitFlash = 1;
    pl.invincible = invTime;
    pl.scaleX = 1.4; pl.scaleY = 0.6;
  }

  function startEntering(pl, door) {
    pl.entering = 1;
    pl.enterTarget = { x: door.x + door.w / 2, y: door.y + door.h / 2 };
  }
  function updateEntering(pl, dt) {
    pl.entering = Math.min(1.0001, pl.entering + dt * 1.6);
    const t = U.easeOutCubic(Math.min(1, pl.entering));
    pl.x = U.lerp(pl.x, pl.enterTarget.x, 0.12);
    pl.y = U.lerp(pl.y, pl.enterTarget.y, 0.12);
    const s = 1 - t;
    pl.scaleX = s; pl.scaleY = s;
    pl.spin += dt * 8;
  }

  return { create, update, hit, startEntering, WALK, SPRINT };
})();

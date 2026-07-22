/* Les Curieux — machine à états réutilisable des ennemis.
   6 états de détection : calme → soupçon → recherche → détection → poursuite
   → retour. La logique est identique pour tous ; seuls les PARAMÈTRES et
   quelques nuances de comportement changent selon le type. Ce module ne
   dessine rien : il expose des données que engine.js interprète et rend. */
window.LC = window.LC || {};

LC.enemy = (function () {
  const U = LC.util;

  const STATE = {
    CALM: 'calm', SUSPECT: 'suspect', SEARCH: 'search',
    DETECT: 'detect', PURSUE: 'pursue', RETURN: 'return',
  };

  /* Réglages par type. Vision fournie par le niveau ; ici le tempérament. */
  const PARAMS = {
    guetteur: {
      sense: 0.95, calm: 0.7, hearing: 130, moveSpeed: 92, chaseSpeed: 108,
      memory: 3.2, searchRadius: 70, anticipate: false, noisePull: 0.15,
      turnLead: 7.5, turnBody: 3.2, sweepTurn: 1.4,
    },
    distrait: {
      sense: 0.7, calm: 1.0, hearing: 540, moveSpeed: 84, chaseSpeed: 92,
      memory: 2.2, searchRadius: 80, anticipate: false, noisePull: 1.0,
      confuse: 1.6, distractCooldown: 3.6, turnLead: 9, turnBody: 3.6, sweepTurn: 1.2,
    },
    mefiant: {
      sense: 0.85, calm: 0.6, hearing: 220, moveSpeed: 74, chaseSpeed: 90,
      memory: 5.0, searchRadius: 110, anticipate: true, noisePull: 0.3,
      turnLead: 6, turnBody: 2.6, sweepTurn: 1.0,
    },
    boss: {
      sense: 1.5, calm: 1.1, hearing: 300, moveSpeed: 60, chaseSpeed: 70,
      memory: 4.0, searchRadius: 120, anticipate: true, noisePull: 0.1,
      turnLead: 5, turnBody: 2.2, sweepTurn: 1.0,
    },
  };

  function create(cfg) {
    const p = PARAMS[cfg.type] || PARAMS.guetteur;
    const e = {
      type: cfg.type,
      x: cfg.x, y: cfg.y, home: { x: cfg.x, y: cfg.y },
      dir: cfg.angle || 0, pupilDir: cfg.angle || 0, prevDir: cfg.angle || 0,
      vision: { range: cfg.vision.range, angle: cfg.vision.angle },
      baseVision: { range: cfg.vision.range, angle: cfg.vision.angle },
      sweep: cfg.sweep || null,
      patrol: cfg.patrol || null, patrolI: 0,
      params: p,
      suspicion: 0, state: STATE.CALM, stateTime: 0,
      lastKnown: null, lastSeenAt: -99, sawVel: { x: 0, y: 0 },
      distractTarget: null, distractCooldown: 0, confuseTime: 0,
      justDetected: false, sees: false,
      /* animation */
      breathe: Math.random() * U.TAU, sway: Math.random() * U.TAU,
      blink: 1, nextBlink: 1 + Math.random() * 3, squint: 0,
      reaction: null, reactionT: 0,
      /* boss */
      isBoss: cfg.type === 'boss', phase: 0, orbit: Math.random() * U.TAU,
    };
    return e;
  }

  function setReaction(e, type, dur) { e.reaction = type; e.reactionT = dur; }

  function visible(e, ctx) {
    const pl = ctx.player;
    if (pl.hidden || pl.invincible) return false;
    const d = U.dist(e.x, e.y, pl.x, pl.y);
    if (d > e.vision.range) return false;
    const ang = Math.atan2(pl.y - e.y, pl.x - e.x);
    if (Math.abs(U.normAngle(ang - e.dir)) > e.vision.angle / 2) return false;
    return U.losClear(e.x, e.y, pl.x, pl.y, ctx.blockers);
  }

  function moveToward(e, tx, ty, speed, dt, blockers) {
    const dx = tx - e.x, dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) return true;
    const step = Math.min(speed * dt, d);
    let nx = e.x + (dx / d) * step;
    let ny = e.y + (dy / d) * step;
    for (const w of blockers) {
      if (U.circleHitsRect(nx, ny, 18, w)) {
        if (!U.circleHitsRect(nx, e.y, 18, w)) ny = e.y;
        else if (!U.circleHitsRect(e.x, ny, 18, w)) nx = e.x;
        else { nx = e.x; ny = e.y; }
      }
    }
    e.x = nx; e.y = ny;
    return d < 4;
  }

  /* Le regard précède le corps : la pupille vise d'abord, le corps suit. */
  function aim(e, tx, ty, dt) {
    const target = Math.atan2(ty - e.y, tx - e.x);
    e.pupilDir = U.dampAngle(e.pupilDir, target, e.params.turnLead, dt);
    e.dir = U.dampAngle(e.dir, target, e.params.turnBody, dt);
  }

  function patrolTick(e, dt) {
    if (e.patrol && e.patrol.points && e.patrol.points.length) {
      const pt = e.patrol.points[e.patrolI];
      if (moveToward(e, pt.x, pt.y, e.patrol.speed || 60, dt, [])) {
        e.patrolI = (e.patrolI + 1) % e.patrol.points.length;
      }
      const nx = e.patrol.points[e.patrolI];
      e.pupilDir = U.dampAngle(e.pupilDir, Math.atan2(nx.y - e.y, nx.x - e.x), e.params.turnLead, dt);
      e.dir = U.dampAngle(e.dir, Math.atan2(nx.y - e.y, nx.x - e.x), e.params.turnBody, dt);
    } else if (e.sweep) {
      const target = e.sweep.base + Math.sin(e.stateTime * e.sweep.speed + e.breathe) * e.sweep.amp;
      e.pupilDir = U.dampAngle(e.pupilDir, target, e.params.turnLead * 0.6, dt);
      e.dir = U.dampAngle(e.dir, target, e.params.sweepTurn, dt);
    }
  }

  function goState(e, s) {
    if (e.state === s) return;
    e.state = s;
    e.stateTime = 0;
    if (s === STATE.SUSPECT) setReaction(e, 'surprise', 0.8);
    else if (s === STATE.SEARCH) setReaction(e, 'search', 1.2);
    else if (s === STATE.PURSUE) setReaction(e, 'angry', 1.0);
    else if (s === STATE.RETURN) setReaction(e, 'lost', 1.0);
  }

  function update(e, ctx, dt) {
    e.justDetected = false;
    e.stateTime += dt;
    e.breathe += dt; e.sway += dt * 0.7;
    if (e.distractCooldown > 0) e.distractCooldown -= dt;
    if (e.confuseTime > 0) e.confuseTime -= dt;
    if (e.reactionT > 0) { e.reactionT -= dt; if (e.reactionT <= 0) e.reaction = null; }

    /* clignements irréguliers */
    e.nextBlink -= dt;
    if (e.nextBlink <= 0) { e.blink = 0; e.nextBlink = 1.4 + Math.random() * 3.5; }
    e.blink = U.damp(e.blink, 1, 14, dt);

    const P = e.params;

    /* boss : mouvement orbital + phases pilotées par engine (e.phase) */
    if (e.isBoss) updateBoss(e, ctx, dt);

    /* --- bruit : le Distrait est attiré, les autres réagissent peu --- */
    const noise = ctx.noise;
    if (noise) {
      const nd = U.dist(e.x, e.y, noise.x, noise.y);
      const hear = P.hearing * (0.6 + noise.intensity * 0.8);
      if (nd < hear) {
        if (e.type === 'distrait' && e.distractCooldown <= 0 && e.state !== STATE.PURSUE) {
          e.distractTarget = { x: noise.x, y: noise.y };
          e.confuseTime = 0;
          setReaction(e, 'surprise', 0.7);
        } else if (e.state === STATE.CALM) {
          /* les autres tournent brièvement la tête vers un bruit fort */
          if (noise.intensity > 0.6) e.suspicion = Math.min(e.suspicion + 0.15, 0.4);
        }
      }
    }

    /* --- perception visuelle --- */
    const sees = visible(e, ctx);
    e.sees = sees;
    if (sees) {
      const d = U.dist(e.x, e.y, ctx.player.x, ctx.player.y);
      const closeness = 1 - 0.5 * (d / e.vision.range);
      const exposedBoost = ctx.player.exposed ? 1.6 : 1;
      e.suspicion = Math.min(1, e.suspicion + dt * P.sense * closeness * exposedBoost * (ctx.senseMul || 1));
      e.lastKnown = { x: ctx.player.x, y: ctx.player.y };
      e.lastSeenAt = ctx.time;
      e.sawVel = { x: ctx.player.vx, y: ctx.player.vy };
      e.squint = U.damp(e.squint, 1, 8, dt);
    } else {
      e.suspicion = Math.max(0, e.suspicion - dt * P.calm);
      e.squint = U.damp(e.squint, 0, 6, dt);
    }

    /* --- transitions --- */
    if (e.type === 'distrait' && e.distractTarget) return distractedBehaviour(e, ctx, dt);

    switch (e.state) {
      case STATE.CALM:
        patrolTick(e, dt);
        if (sees) goState(e, STATE.SUSPECT);
        break;

      case STATE.SUSPECT:
        if (sees) aim(e, ctx.player.x, ctx.player.y, dt);
        else if (e.lastKnown) aim(e, e.lastKnown.x, e.lastKnown.y, dt);
        if (e.suspicion >= 1) { triggerDetect(e); }
        else if (!sees && e.suspicion < 0.05) goState(e, e.lastKnown ? STATE.SEARCH : STATE.RETURN);
        else if (!sees && e.stateTime > 0.6) goState(e, STATE.SEARCH);
        break;

      case STATE.SEARCH: {
        const tgt = searchTarget(e, ctx);
        moveToward(e, tgt.x, tgt.y, P.moveSpeed, dt, ctx.blockers);
        /* balaie du regard autour du point inspecté */
        const look = Math.atan2(tgt.y - e.y, tgt.x - e.x) + Math.sin(e.stateTime * 2.2) * 0.7;
        e.pupilDir = U.dampAngle(e.pupilDir, look, P.turnLead, dt);
        e.dir = U.dampAngle(e.dir, look, P.turnBody, dt);
        if (sees) goState(e, STATE.SUSPECT);
        else if (e.stateTime > P.memory) goState(e, STATE.RETURN);
        break;
      }

      case STATE.PURSUE: {
        const tgt = sees ? ctx.player : (e.lastKnown || e.home);
        aim(e, tgt.x, tgt.y, dt);
        moveToward(e, tgt.x, tgt.y, P.chaseSpeed, dt, ctx.blockers);
        if (!sees && ctx.time - e.lastSeenAt > P.memory) goState(e, STATE.SEARCH);
        break;
      }

      case STATE.RETURN:
        moveToward(e, e.home.x, e.home.y, P.moveSpeed * 0.8, dt, ctx.blockers);
        if (sees) goState(e, STATE.SUSPECT);
        else if (U.dist(e.x, e.y, e.home.x, e.home.y) < 8) goState(e, STATE.CALM);
        else { const a = Math.atan2(e.home.y - e.y, e.home.x - e.x); e.dir = U.dampAngle(e.dir, a, P.turnBody, dt); e.pupilDir = e.dir; }
        break;
    }
    return;
  }

  function triggerDetect(e) {
    e.justDetected = true;
    e.suspicion = 0.65;       // reste alerte sans re-déclencher aussitôt
    goState(e, STATE.PURSUE);
    setReaction(e, 'angry', 1.2);
  }

  /* Le Méfiant anticipe : il vise un peu en avant du dernier trajet vu. */
  function searchTarget(e, ctx) {
    if (!e.lastKnown) return e.home;
    if (e.params.anticipate && (e.sawVel.x || e.sawVel.y)) {
      const spd = Math.hypot(e.sawVel.x, e.sawVel.y);
      const lead = Math.min(e.params.searchRadius, spd * 0.4);
      if (spd > 5) {
        return { x: e.lastKnown.x + (e.sawVel.x / spd) * lead, y: e.lastKnown.y + (e.sawVel.y / spd) * lead };
      }
    }
    /* petit balayage autour du dernier point connu */
    const r = e.params.searchRadius * 0.4;
    return { x: e.lastKnown.x + Math.cos(e.stateTime * 1.7) * r, y: e.lastKnown.y + Math.sin(e.stateTime * 1.3) * r };
  }

  /* Le Distrait quitte son poste, arrive, reste confus, puis revient. */
  function distractedBehaviour(e, ctx, dt) {
    const t = e.distractTarget;
    const reached = U.dist(e.x, e.y, t.x, t.y) < 26;
    if (!reached && e.confuseTime <= 0) {
      moveToward(e, t.x, t.y, e.params.moveSpeed, dt, ctx.blockers);
      aim(e, t.x, t.y, dt);
      e.suspicion = Math.max(0, e.suspicion - dt * 1.5); // trop occupé pour vous voir
    } else {
      if (e.confuseTime <= 0) { e.confuseTime = e.params.confuse; setReaction(e, 'confused', e.params.confuse); }
      /* tourne sur lui-même, l'air perdu */
      e.dir += dt * 2.0; e.pupilDir = e.dir;
      e.suspicion = Math.max(0, e.suspicion - dt * 1.5);
      if (e.confuseTime <= 0.02) {
        e.distractTarget = null;
        e.distractCooldown = e.params.distractCooldown;
        goState(e, STATE.RETURN);
      }
    }
  }

  function updateBoss(e, ctx, dt) {
    const bcfg = ctx.bossConfig;
    if (!bcfg) return;
    const ph = bcfg.phases[Math.min(e.phase, bcfg.phases.length - 1)];
    e.vision.range = U.damp(e.vision.range, ph.vision.range, 3, dt);
    e.vision.angle = U.damp(e.vision.angle, ph.vision.angle, 3, dt);
    if (ph.move) {
      e.orbit += dt * ph.move.speed;
      const cx = bcfg.x + Math.cos(e.orbit) * ph.move.r;
      const cy = bcfg.y + Math.sin(e.orbit) * ph.move.r * 0.6;
      e.x = U.damp(e.x, cx, 4, dt); e.y = U.damp(e.y, cy, 4, dt);
    }
    if (e.state === STATE.CALM) {
      const target = e.dir + ph.speed * dt * 2;
      e.dir = target; e.pupilDir = target;
    }
  }

  return { STATE, PARAMS, create, update, visible, setReaction };
})();

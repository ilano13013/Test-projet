/* Moteur du jeu « Les Curieux » — canvas 2D, sans dépendance.
   Le joueur (petite étoile) doit atteindre la porte sans se faire observer.
   Trois comportements de Curieux :
   - le Guetteur suit le joueur du regard (tant qu'il a une ligne de vue) ;
   - le Distrait se laisse détourner par un petit bruit (clic / tap) ;
   - le Méfiant mémorise la dernière position où il a aperçu le joueur. */
window.LC = window.LC || {};

LC.game = (function () {
  const W = 960, H = 600;
  const PLAYER_SPEED = 230;
  const EXPOSURE_RATE = 1.15;   // vitesse de remplissage quand on est vu
  const EXPOSURE_DECAY = 1.6;
  const INVINCIBLE_TIME = 2.4;
  const PING_DURATION = 3.2;
  const PING_COOLDOWN = 3.5;

  const LEVELS = [
    {
      id: 1, name: 'Premiers pas',
      start: { x: 70, y: 520 },
      door: { x: 880, y: 40, w: 44, h: 84 },
      walls: [
        { x: 170, y: 400, w: 150, h: 44 },
        { x: 330, y: 180, w: 44, h: 180 },
        { x: 500, y: 430, w: 160, h: 44 },
        { x: 585, y: 130, w: 44, h: 160 },
        { x: 740, y: 300, w: 150, h: 44 },
      ],
      curieux: [
        { type: 'guetteur', x: 480, y: 70, angle: Math.PI / 2, fov: 0.85, range: 320 },
        { type: 'distrait', x: 150, y: 200, angle: 0.5, fov: 0.95, range: 260, sweep: { base: 0.5, amp: 0.9, speed: 0.7 } },
        { type: 'mefiant', x: 830, y: 480, angle: Math.PI, fov: 0.9, range: 300, sweep: { base: Math.PI * 0.95, amp: 0.6, speed: 0.55 } },
      ],
    },
    {
      id: 2, name: 'Les couloirs',
      start: { x: 70, y: 80 },
      door: { x: 880, y: 470, w: 44, h: 84 },
      walls: [
        { x: 150, y: 160, w: 540, h: 44 },
        { x: 270, y: 380, w: 540, h: 44 },
        { x: 780, y: 60, w: 44, h: 144 },
        { x: 150, y: 424, w: 44, h: 120 },
      ],
      curieux: [
        { type: 'guetteur', x: 890, y: 90, angle: Math.PI, fov: 0.8, range: 360 },
        { type: 'distrait', x: 480, y: 290, angle: 0, fov: 0.9, range: 300, sweep: { base: 0, amp: 2.4, speed: 0.5 } },
        { type: 'mefiant', x: 90, y: 520, angle: 0, fov: 0.85, range: 320, sweep: { base: 0, amp: 0.7, speed: 0.6 } },
      ],
    },
    {
      id: 3, name: 'Le grand hall',
      start: { x: 70, y: 530 },
      door: { x: 880, y: 40, w: 44, h: 84 },
      walls: [
        { x: 190, y: 140, w: 64, h: 64 },
        { x: 190, y: 390, w: 64, h: 64 },
        { x: 440, y: 110, w: 64, h: 64 },
        { x: 440, y: 280, w: 64, h: 64 },
        { x: 440, y: 460, w: 64, h: 64 },
        { x: 690, y: 170, w: 64, h: 64 },
        { x: 690, y: 410, w: 64, h: 64 },
      ],
      curieux: [
        { type: 'guetteur', x: 480, y: 55, angle: Math.PI / 2, fov: 0.8, range: 340 },
        { type: 'mefiant', x: 900, y: 300, angle: Math.PI, fov: 0.85, range: 380, sweep: { base: Math.PI, amp: 0.8, speed: 0.5 } },
        { type: 'distrait', x: 60, y: 300, angle: 0, fov: 0.95, range: 300, sweep: { base: 0, amp: 0.9, speed: 0.65 } },
      ],
    },
  ];

  const CURIEUX_LABEL = { guetteur: 'le Guetteur', distrait: 'le Distrait', mefiant: 'le Méfiant' };

  /* ---------------- géométrie ---------------- */
  function normAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  /* Paramètre d'entrée t (0..1) d'un segment dans un rectangle, ou Infinity. */
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

  function losClear(ax, ay, bx, by, walls) {
    for (const w of walls) if (rayRectT(ax, ay, bx, by, w) !== Infinity) return false;
    return true;
  }

  function circleHitsRect(cx, cy, r, rect) {
    const nx = Math.max(rect.x, Math.min(cx, rect.x + rect.w));
    const ny = Math.max(rect.y, Math.min(cy, rect.y + rect.h));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
  }

  /* ---------------- écran de jeu ---------------- */
  function createGameScreen(levelParam) {
    const level = LEVELS.find(l => l.id === Number(levelParam)) || LEVELS[0];
    const user = LC.auth.current();
    const saveData = LC.save.load(user.email);
    const skinColor = LC.save.skinColor(user.email);

    const el = document.createElement('div');
    el.className = 'screen game-screen';
    el.innerHTML = `
      <div class="game-hud">
        <span class="hud-hearts" id="hudHearts"></span>
        <span class="hud-level">Niveau ${level.id} — ${level.name}</span>
        <span class="hud-time" id="hudTime">00:00.0</span>
        <button class="hud-btn" id="pauseBtn" aria-label="Pause">⏸ Pause</button>
      </div>
      <div class="game-wrap">
        <canvas id="gameCanvas"></canvas>
        <div class="joystick" id="joystick"><div class="thumb" id="joyThumb"></div></div>
        <div class="game-overlay" id="overlay" hidden><div class="overlay-card" id="overlayCard"></div></div>
      </div>
      <p class="game-hint">Flèches · ZQSD · WASD pour bouger — clic ou tap : petit bruit qui distrait le Distrait — Échap : pause</p>`;

    const canvas = el.querySelector('#gameCanvas');
    const ctx = canvas.getContext('2d');
    const hudHearts = el.querySelector('#hudHearts');
    const hudTime = el.querySelector('#hudTime');
    const overlay = el.querySelector('#overlay');
    const overlayCard = el.querySelector('#overlayCard');
    const joystick = el.querySelector('#joystick');
    const joyThumb = el.querySelector('#joyThumb');

    /* étoiles fixes du décor, déterministes */
    const bgStars = [];
    let seed = 42;
    const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 60; i++) bgStars.push({ x: rand() * W, y: rand() * H, r: 0.6 + rand() * 1.4, a: 0.15 + rand() * 0.5 });

    const state = {
      t: 0, running: true, paused: false, finished: false,
      player: { x: level.start.x, y: level.start.y, r: 11, hearts: 3, inv: 0 },
      exposure: 0, detections: 0, flash: 0,
      keys: Object.create(null),
      joy: null,
      ping: null, pingCooldown: 0,
      curieux: level.curieux.map((c, i) => ({
        ...c, dir: c.angle, sees: false, lastSeen: null, lastSeenT: -99, alert: 0, phase: i * 2.1,
      })),
    };

    /* ---------------- entrées clavier ---------------- */
    const KEYMAP = {
      ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
      KeyW: 'up', KeyZ: 'up', KeyS: 'down', KeyA: 'left', KeyQ: 'left', KeyD: 'right',
    };
    function onKeyDown(e) {
      if (e.code === 'Escape') { togglePause(); return; }
      const k = KEYMAP[e.code];
      if (k) { state.keys[k] = true; e.preventDefault(); }
    }
    function onKeyUp(e) {
      const k = KEYMAP[e.code];
      if (k) state.keys[k] = false;
    }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    /* ---------------- joystick tactile ---------------- */
    let joyPointer = null;
    joystick.addEventListener('pointerdown', (e) => {
      joyPointer = e.pointerId;
      joystick.setPointerCapture(e.pointerId);
      moveJoy(e);
    });
    joystick.addEventListener('pointermove', (e) => { if (e.pointerId === joyPointer) moveJoy(e); });
    function endJoy(e) {
      if (e.pointerId !== joyPointer) return;
      joyPointer = null;
      state.joy = null;
      joyThumb.style.transform = 'translate(-50%, -50%)';
    }
    joystick.addEventListener('pointerup', endJoy);
    joystick.addEventListener('pointercancel', endJoy);
    function moveJoy(e) {
      const rect = joystick.getBoundingClientRect();
      let dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
      let dy = (e.clientY - (rect.top + rect.height / 2)) / (rect.height / 2);
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      state.joy = { x: dx, y: dy };
      joyThumb.style.transform = `translate(calc(-50% + ${dx * 32}px), calc(-50% + ${dy * 32}px))`;
    }

    /* ---------------- petit bruit (distraction) ---------------- */
    canvas.addEventListener('pointerdown', (e) => {
      if (state.paused || state.finished) return;
      if (state.pingCooldown > 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width * W;
      const y = (e.clientY - rect.top) / rect.height * H;
      state.ping = { x, y, t: state.t };
      state.pingCooldown = PING_COOLDOWN;
    });

    /* ---------------- dimensionnement ---------------- */
    function resize() {
      const cssWidth = canvas.parentElement.clientWidth;
      if (!cssWidth) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssWidth * (H / W) * dpr);
    }
    /* l'écran est monté après création : observer la taille réelle du conteneur */
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(el.querySelector('.game-wrap'));

    /* ---------------- mise à jour ---------------- */
    function update(dt) {
      state.t += dt;
      const p = state.player;

      let dx = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
      let dy = (state.keys.down ? 1 : 0) - (state.keys.up ? 1 : 0);
      if (state.joy) { dx = state.joy.x; dy = state.joy.y; }
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }

      p.x += dx * PLAYER_SPEED * dt;
      for (const w of level.walls) {
        if (circleHitsRect(p.x, p.y, p.r, w)) p.x = dx > 0 ? w.x - p.r : w.x + w.w + p.r;
      }
      p.y += dy * PLAYER_SPEED * dt;
      for (const w of level.walls) {
        if (circleHitsRect(p.x, p.y, p.r, w)) p.y = dy > 0 ? w.y - p.r : w.y + w.h + p.r;
      }
      p.x = Math.max(p.r, Math.min(W - p.r, p.x));
      p.y = Math.max(p.r, Math.min(H - p.r, p.y));

      if (p.inv > 0) p.inv -= dt;
      if (state.pingCooldown > 0) state.pingCooldown -= dt;
      if (state.flash > 0) state.flash -= dt;
      if (state.ping && state.t - state.ping.t > PING_DURATION) state.ping = null;

      let seen = false;
      for (const c of state.curieux) {
        updateCurieux(c, dt, p);
        c.sees = canSee(c, p);
        if (c.sees) { seen = true; c.alert = Math.min(1, c.alert + dt * 2); }
        else c.alert = Math.max(0, c.alert - dt * 2);
      }

      if (seen && p.inv <= 0) state.exposure = Math.min(1, state.exposure + dt * EXPOSURE_RATE);
      else state.exposure = Math.max(0, state.exposure - dt * EXPOSURE_DECAY);

      if (state.exposure >= 1) detection();

      const d = level.door;
      if (p.x > d.x - p.r && p.x < d.x + d.w + p.r && p.y > d.y - p.r && p.y < d.y + d.h + p.r) win();
    }

    function canSee(c, p) {
      if (p.inv > 0) return false;
      const dist = Math.hypot(p.x - c.x, p.y - c.y);
      if (dist > c.range) return false;
      const ang = Math.atan2(p.y - c.y, p.x - c.x);
      if (Math.abs(normAngle(ang - c.dir)) > c.fov / 2) return false;
      return losClear(c.x, c.y, p.x, p.y, level.walls);
    }

    function turnToward(c, target, speed, dt) {
      const d = normAngle(target - c.dir);
      c.dir += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
    }

    function updateCurieux(c, dt, p) {
      const angToPlayer = Math.atan2(p.y - c.y, p.x - c.x);
      switch (c.type) {
        case 'guetteur': {
          // Suit directement le joueur du regard, tant que rien ne bloque la vue.
          const dist = Math.hypot(p.x - c.x, p.y - c.y);
          if (dist < c.range * 1.3 && losClear(c.x, c.y, p.x, p.y, level.walls)) {
            turnToward(c, angToPlayer, 1.7, dt);
          } else {
            c.dir += Math.sin(state.t * 0.8 + c.phase) * 0.25 * dt;
          }
          break;
        }
        case 'distrait': {
          const ping = state.ping;
          if (ping && Math.hypot(ping.x - c.x, ping.y - c.y) < 460) {
            c.distracted = true;
            turnToward(c, Math.atan2(ping.y - c.y, ping.x - c.x), 3.2, dt);
          } else {
            c.distracted = false;
            const s = c.sweep;
            turnToward(c, s.base + Math.sin(state.t * s.speed + c.phase) * s.amp, 1.2, dt);
          }
          break;
        }
        case 'mefiant': {
          if (c.sees) {
            c.lastSeen = { x: p.x, y: p.y };
            c.lastSeenT = state.t;
            turnToward(c, angToPlayer, 2.4, dt);
          } else if (c.lastSeen && state.t - c.lastSeenT < 3.2) {
            // Fixe la dernière position connue du joueur.
            turnToward(c, Math.atan2(c.lastSeen.y - c.y, c.lastSeen.x - c.x), 2.0, dt);
          } else {
            const s = c.sweep;
            turnToward(c, s.base + Math.sin(state.t * s.speed + c.phase) * s.amp, 1.0, dt);
          }
          break;
        }
      }
    }

    function detection() {
      const p = state.player;
      state.exposure = 0;
      state.detections++;
      state.flash = 0.5;
      p.hearts--;
      p.inv = INVINCIBLE_TIME;
      renderHud();
      if (p.hearts <= 0) fail();
    }

    /* ---------------- fin de partie ---------------- */
    function win() {
      if (state.finished) return;
      state.finished = true;
      const time = Math.round(state.t * 10) / 10;
      const stars = state.detections === 0 ? 3 : state.detections === 1 ? 2 : 1;
      LC.save.recordResult(user.email, level.id, { stars, time, detections: state.detections });
      const starsHtml = [1, 2, 3].map(n => `<span class="${n <= stars ? '' : 'off'}">★</span>`).join('');
      const next = LEVELS.find(l => l.id === level.id + 1);
      showOverlay(`
        <h2>Sortie atteinte !</h2>
        <p class="ov-sub">Les Curieux n'ont ${state.detections === 0 ? 'rien vu du tout' : 'presque rien vu'}.</p>
        <div class="ov-stars">${starsHtml}</div>
        <p class="ov-stats">Temps : <strong>${LC.screens.formatTime(time)}</strong><br>Détections : <strong>${state.detections}</strong></p>
        <div class="overlay-actions">
          ${next ? `<button class="btn" data-go="/game/${next.id}">Niveau suivant</button>` : '<button class="btn" data-go="/levels">Tous les niveaux</button>'}
          <button class="btn-ghost" data-act="retry">Rejouer</button>
          <button class="btn-ghost" data-go="/menu">Menu principal</button>
        </div>`);
    }

    function fail() {
      state.finished = true;
      showOverlay(`
        <h2>Repérée…</h2>
        <p class="ov-sub">Trois regards insistants, c'est un de trop. L'étoile file se rhabiller.</p>
        <div class="overlay-actions">
          <button class="btn" data-act="retry">Réessayer</button>
          <button class="btn-ghost" data-go="/levels">Niveaux</button>
          <button class="btn-ghost" data-go="/menu">Menu principal</button>
        </div>`);
    }

    function togglePause() {
      if (state.finished) return;
      state.paused = !state.paused;
      if (state.paused) {
        showOverlay(`
          <h2>Pause</h2>
          <p class="ov-sub">Les Curieux patientent, l'air de rien.</p>
          <div class="overlay-actions">
            <button class="btn" data-act="resume">Reprendre</button>
            <button class="btn-ghost" data-act="retry">Recommencer</button>
            <button class="btn-ghost" data-go="/menu">Menu principal</button>
          </div>`);
      } else {
        overlay.hidden = true;
      }
    }
    el.querySelector('#pauseBtn').addEventListener('click', togglePause);

    function showOverlay(html) {
      overlayCard.innerHTML = html;
      overlay.hidden = false;
    }
    overlay.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) { LC.router.go(go.dataset.go); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      if (act.dataset.act === 'resume') togglePause();
      if (act.dataset.act === 'retry') LC.router.go('/game/' + level.id);
    });

    /* ---------------- rendu ---------------- */
    function renderHud() {
      const p = state.player;
      hudHearts.innerHTML =
        '♥'.repeat(Math.max(0, p.hearts)) +
        `<span class="lost">${'♥'.repeat(Math.max(0, 3 - p.hearts))}</span>`;
    }
    renderHud();

    function coneColor(c) {
      if (c.sees || c.alert > 0.4) return [255, 176, 90];
      if (c.type === 'distrait' && c.distracted) return [126, 210, 240];
      return [235, 238, 255];
    }

    function draw() {
      const scale = canvas.width / W;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);

      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#161d3a');
      g.addColorStop(1, '#0c1124');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);

      for (const s of bgStars) {
        ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(state.t * 2 + s.x));
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      /* champs de vision (découpés par les murs via lancer de rayons) */
      for (const c of state.curieux) drawCone(c);

      /* porte de sortie */
      const d = level.door;
      ctx.save();
      ctx.shadowColor = 'rgba(255, 220, 130, .9)';
      ctx.shadowBlur = 26;
      ctx.fillStyle = '#ffe9b0';
      roundRect(d.x, d.y, d.w, d.h, 10);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255, 233, 176, .75)';
      ctx.font = '600 11px "Segoe UI", system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('SORTIE', d.x + d.w / 2, d.y + d.h + 16);

      /* obstacles : blocs blancs, comme la carte de connexion */
      for (const w of level.walls) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,.4)';
        ctx.shadowBlur = 16;
        ctx.shadowOffsetY = 6;
        ctx.fillStyle = 'rgba(255,255,255,.94)';
        roundRect(w.x, w.y, w.w, w.h, 10);
        ctx.fill();
        ctx.restore();
      }

      /* petit bruit */
      if (state.ping) {
        const age = state.t - state.ping.t;
        const r = 12 + age * 60;
        ctx.strokeStyle = `rgba(126, 210, 240, ${Math.max(0, 0.7 - age * 0.25)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(state.ping.x, state.ping.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = `rgba(126, 210, 240, ${Math.max(0, 1 - age / PING_DURATION)})`;
        ctx.font = '16px "Segoe UI", system-ui, sans-serif';
        ctx.fillText('♪', state.ping.x, state.ping.y - r - 4);
      }

      /* le Méfiant marque la dernière position vue */
      for (const c of state.curieux) {
        if (c.type === 'mefiant' && c.lastSeen && !c.sees && state.t - c.lastSeenT < 3.2) {
          ctx.fillStyle = 'rgba(255,255,255,.5)';
          ctx.font = '600 16px "Segoe UI", system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('?', c.lastSeen.x, c.lastSeen.y - 14);
        }
      }

      /* les Curieux */
      for (const c of state.curieux) drawCurieux(c);

      /* le joueur : petite étoile */
      drawPlayer();

      /* vignette d'exposition */
      if (state.exposure > 0 || state.flash > 0) {
        const alpha = Math.min(0.5, state.exposure * 0.38 + state.flash * 0.6);
        const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.75);
        vg.addColorStop(0, 'rgba(224, 91, 107, 0)');
        vg.addColorStop(1, `rgba(224, 91, 107, ${alpha})`);
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, W, H);
      }
    }

    function drawCone(c) {
      const rays = 26;
      const [r, g, b] = coneColor(c);
      const pts = [];
      for (let i = 0; i <= rays; i++) {
        const a = c.dir - c.fov / 2 + (c.fov * i) / rays;
        const ex = c.x + Math.cos(a) * c.range;
        const ey = c.y + Math.sin(a) * c.range;
        let t = 1;
        for (const w of level.walls) t = Math.min(t, rayRectT(c.x, c.y, ex, ey, w));
        pts.push([c.x + (ex - c.x) * t, c.y + (ey - c.y) * t]);
      }
      if (saveData.settings.subtleVision) {
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${c.sees ? 0.5 : 0.22})`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 7]);
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(pts[0][0], pts[0][1]);
        for (const [x, y] of pts) ctx.lineTo(x, y);
        ctx.lineTo(c.x, c.y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const grad = ctx.createRadialGradient(c.x, c.y, 10, c.x, c.y, c.range);
        grad.addColorStop(0, `rgba(${r}, ${g}, ${b}, ${c.sees ? 0.28 : 0.13})`);
        grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        for (const [x, y] of pts) ctx.lineTo(x, y);
        ctx.closePath();
        ctx.fill();
      }
    }

    function drawCurieux(c) {
      ctx.save();
      ctx.translate(c.x, c.y);
      /* corps */
      ctx.fillStyle = '#2c3152';
      ctx.beginPath();
      ctx.ellipse(0, 26, 20, 16, 0, Math.PI, 0);
      ctx.fill();
      /* tête */
      ctx.beginPath();
      ctx.arc(0, 0, 19, 0, Math.PI * 2);
      ctx.fill();
      /* yeux tournés dans la direction du regard */
      const ex = Math.cos(c.dir) * 6, ey = Math.sin(c.dir) * 5;
      const squint = c.sees ? 0.7 : 1;
      for (const side of [-1, 1]) {
        const ox = ex + side * 7 * Math.abs(Math.sin(c.dir)) + side * 5 * Math.abs(Math.cos(c.dir + Math.PI / 2));
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.ellipse(ox * 0.9 + ex * 0.1, ey - 2, 5, 6 * squint, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#23263a';
        ctx.beginPath();
        ctx.arc(ox * 0.9 + ex * 0.4, ey - 2 + Math.sin(c.dir) * 1.5, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
      /* état au-dessus de la tête */
      ctx.textAlign = 'center';
      ctx.font = '700 15px "Segoe UI", system-ui, sans-serif';
      if (c.sees) { ctx.fillStyle = '#ffb05a'; ctx.fillText('!', 0, -26); }
      else if (c.type === 'distrait' && c.distracted) { ctx.fillStyle = '#7ed2f0'; ctx.fillText('♪', 0, -26); }
      /* nom discret */
      ctx.fillStyle = 'rgba(223,227,255,.4)';
      ctx.font = '600 10px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(CURIEUX_LABEL[c.type], 0, 52);
      ctx.restore();
    }

    function drawPlayer() {
      const p = state.player;
      const blink = p.inv > 0 ? 0.35 + 0.3 * Math.sin(state.t * 22) : 1;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(p.x, p.y);
      ctx.rotate(state.t * 0.6);
      ctx.shadowColor = skinColor;
      ctx.shadowBlur = 18;
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? p.r + 3 : p.r * 0.45;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function roundRect(x, y, w, h, r) {
      ctx.beginPath();
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + w, y, r);
      ctx.closePath();
    }

    /* ---------------- boucle ---------------- */
    let rafId = 0, lastTime = performance.now();
    function frame(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      if (!state.paused && !state.finished) {
        update(dt);
        hudTime.textContent = LC.screens.formatTime(Math.round(state.t * 10) / 10);
      }
      draw();
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    function onBlur() { if (!state.paused && !state.finished) togglePause(); }
    window.addEventListener('blur', onBlur);

    return {
      el,
      cleanup() {
        cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
      },
    };
  }

  return { LEVELS, createGameScreen };
})();

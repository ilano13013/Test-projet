/* Les Curieux — moteur de jeu (canvas 2D).
   Orchestre : caméra fluide, particules poolées, boucle à delta time,
   détection progressive (via enemy.js), joueur (via player.js), rendu du
   décor en parallaxe, cônes de vision doux découpés par les murs, HUD,
   tutoriels contextuels, écran d'objectifs, pause, résultats partageables,
   fantôme personnel, défi quotidien. */
window.LC = window.LC || {};

LC.game = (function () {
  const U = LC.util;
  const VW = 960, VH = 600;               // fenêtre logique (la caméra cadre dedans)
  const INVINCIBLE = 2.2;

  const QUIPS = [
    'Vu de trop près, mais quel style.',
    'Les Curieux en parlent encore.',
    'Silencieux comme une étoile filante.',
    'Ni vu ni connu… ou presque.',
    'Trois regards déjoués, un ego intact.',
    'La nuit vous appartient.',
  ];

  function fmt(sec) {
    if (sec == null) return '—';
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(1).padStart(4, '0');
    return `${String(m).padStart(2, '0')}:${s}`;
  }

  /* ---------------- génération : défi quotidien & graines ---------------- */
  function seededLevel(seedStr) {
    const rng = U.mulberry32(U.hashSeed(seedStr));
    const size = { w: 1040, h: 640 };
    const walls = [];
    const cols = 4 + Math.floor(rng() * 2);
    for (let i = 0; i < cols; i++) {
      const vertical = rng() > 0.5;
      walls.push({
        x: 160 + rng() * (size.w - 360), y: 120 + rng() * (size.h - 320),
        w: vertical ? 44 : 120 + rng() * 100, h: vertical ? 120 + rng() * 120 : 44,
      });
    }
    const types = ['guetteur', 'distrait', 'mefiant'];
    const enemies = [];
    const n = 3;
    for (let i = 0; i < n; i++) {
      const t = types[i % 3];
      enemies.push({
        type: t, x: 240 + rng() * (size.w - 480), y: 160 + rng() * (size.h - 320),
        angle: rng() * U.TAU,
        vision: { range: 260 + rng() * 120, angle: 0.7 + rng() * 0.6 },
        sweep: { base: rng() * U.TAU, amp: 0.8 + rng() * 1.6, speed: 0.4 + rng() * 0.5 },
      });
    }
    const fragments = [];
    for (let i = 0; i < 3; i++) fragments.push({ x: 140 + rng() * (size.w - 280), y: 120 + rng() * (size.h - 240) });
    return {
      id: 'seed-' + seedStr, world: 0, index: 0, name: 'Graine ' + seedStr,
      size, start: { x: 60, y: size.h - 70 }, exit: { x: size.w - 80, y: 50, w: 44, h: 80 },
      targetTime: 55, hearts: 3, walls, fragments, enemies,
      objectives: [{ id: 'frag', label: 'Récupérer les 3 fragments', type: 'allFragments' }],
      tutorials: [], seed: seedStr,
    };
  }
  function dailySeed() {
    const d = new Date();
    return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  }

  function resolveLevel(param) {
    if (param === 'daily') { const lv = seededLevel(dailySeed()); lv.name = 'Défi du jour'; lv.mode = 'daily'; return lv; }
    if (param && param.indexOf('seed-') === 0) { const lv = seededLevel(param.slice(5)); lv.mode = 'seed'; return lv; }
    const lv = LC.levels.getLevel(param);
    if (lv) lv.mode = 'campaign';
    return lv;
  }

  /* ============================================================
     Écran de jeu
     ============================================================ */
  function createGameScreen(param) {
    const level = resolveLevel(param);
    if (!level) { LC.router.go('/worlds'); return { el: document.createElement('div') }; }

    const user = LC.auth.current();
    const settings = LC.save.load(user.email).settings;
    const keybinds = LC.save.getKeybinds(user.email);
    const skinColor = LC.save.skinColor(user.email);
    const ghost = LC.save.getGhost(user.email, level.id);
    const hideCones = level.hideCones || settings.hideCones;

    const el = document.createElement('div');
    el.className = 'screen game-screen';
    el.innerHTML = `
      <div class="game-hud">
        <span class="hud-hearts" id="hudHearts"></span>
        <div class="hud-gauges">
          <div class="gauge stamina"><span id="staminaFill"></span></div>
          <div class="gauge danger"><span id="dangerFill"></span></div>
        </div>
        <span class="hud-frag" id="hudFrag">◆ 0/0</span>
        <span class="hud-time" id="hudTime">00:00.0</span>
        <button class="hud-btn" id="pauseBtn" aria-label="Pause">⏸</button>
      </div>
      <div class="game-wrap" id="wrap">
        <canvas id="gameCanvas"></canvas>
        <div class="tuto-banner" id="tuto" hidden></div>
        <div class="touch-controls">
          <div class="joystick" id="joystick"><div class="thumb" id="joyThumb"></div></div>
          <button class="sprint-btn" id="sprintBtn">Sprint</button>
        </div>
        <div class="game-overlay" id="overlay"><div class="overlay-card" id="overlayCard"></div></div>
      </div>`;

    const canvas = el.querySelector('#gameCanvas');
    const ctx = canvas.getContext('2d');
    const hudHearts = el.querySelector('#hudHearts');
    const hudTime = el.querySelector('#hudTime');
    const hudFrag = el.querySelector('#hudFrag');
    const staminaFill = el.querySelector('#staminaFill');
    const dangerFill = el.querySelector('#dangerFill');
    const overlay = el.querySelector('#overlay');
    const overlayCard = el.querySelector('#overlayCard');
    const tuto = el.querySelector('#tuto');
    const joystick = el.querySelector('#joystick');
    const joyThumb = el.querySelector('#joyThumb');
    const sprintBtn = el.querySelector('#sprintBtn');

    /* ---------------- parallaxe : couches d'étoiles ---------------- */
    const layers = [];
    let sd = U.hashSeed(level.id + 'bg');
    const rnd = U.mulberry32(sd);
    for (let L = 0; L < 3; L++) {
      const arr = [];
      const count = [40, 30, 18][L];
      for (let i = 0; i < count; i++) arr.push({ x: rnd() * level.size.w, y: rnd() * level.size.h, r: (L + 1) * 0.5 + rnd(), a: 0.15 + rnd() * 0.45 });
      layers.push({ stars: arr, depth: 0.2 + L * 0.28 });
    }
    const dust = [];
    for (let i = 0; i < 22; i++) dust.push({ x: rnd() * level.size.w, y: rnd() * level.size.h, ph: rnd() * U.TAU, sp: 6 + rnd() * 14 });

    /* ---------------- état ---------------- */
    const doors = (level.doors || []).map(d => ({ ...d, open: false }));
    const switches = (level.switches || []).map(s => ({ ...s, on: false }));
    const fragments = (level.fragments || []).map(f => ({ x: f.x, y: f.y, got: false, ph: Math.random() * U.TAU }));
    const totalFrags = fragments.length;
    const checkpoints = (level.checkpoints || []).map(c => ({ ...c, reached: false }));

    const player = LC.player.create(level.start);
    const enemies = (level.enemies || []).map(LC.enemy.create);
    if (level.boss) enemies.push(LC.enemy.create({ type: 'boss', x: level.boss.x, y: level.boss.y, angle: 0, vision: level.boss.phases[0].vision }));

    const cam = { x: player.x, y: player.y, zoom: 1, shake: 0 };
    const particles = U.pool(() => ({}), o => { o.x = o.y = o.vx = o.vy = 0; o.life = o.max = 1; o.r = 2; o.col = '#fff'; });
    const rings = U.pool(() => ({}), o => { o.x = o.y = 0; o.life = o.max = 1; o.r0 = 8; o.r1 = 60; o.col = '126,210,240'; });

    const state = {
      t: 0, phase: 'objectives', running: false, timeScale: 1,
      heartsLost: 0, detections: 0, danger: 0, collected: 0,
      activeNoise: null, pingCooldown: 0, respawn: { ...level.start }, checkpointsUsed: 0,
      keys: Object.create(null), joy: null, sprintTouch: false,
      ghostRec: [], ghostAcc: 0, tutoShown: Object.create(null),
      hearts: level.hearts || 3, bossPhase: 0,
    };

    /* ============ entrées ============ */
    const actionFor = code => {
      for (const a in keybinds) if (keybinds[a].includes(code)) return a;
      return null;
    };
    function onKeyDown(e) {
      const a = actionFor(e.code);
      if (!a) return;
      e.preventDefault();
      if (a === 'pause') { if (state.phase === 'play') togglePause(); return; }
      if (a === 'noise') { emitPing(player.x, player.y); return; }
      state.keys[a] = true;
    }
    function onKeyUp(e) { const a = actionFor(e.code); if (a) state.keys[a] = false; }
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    /* joystick */
    let joyId = null;
    joystick.addEventListener('pointerdown', e => { joyId = e.pointerId; joystick.setPointerCapture(e.pointerId); moveJoy(e); });
    joystick.addEventListener('pointermove', e => { if (e.pointerId === joyId) moveJoy(e); });
    const endJoy = e => { if (e.pointerId !== joyId) return; joyId = null; state.joy = null; joyThumb.style.transform = 'translate(-50%,-50%)'; };
    joystick.addEventListener('pointerup', endJoy);
    joystick.addEventListener('pointercancel', endJoy);
    function moveJoy(e) {
      const r = joystick.getBoundingClientRect();
      let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
      let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      state.joy = { x: dx, y: dy };
      joyThumb.style.transform = `translate(calc(-50% + ${dx * 30}px), calc(-50% + ${dy * 30}px))`;
    }
    const setSprint = v => e => { state.sprintTouch = v; if (e) e.preventDefault(); };
    sprintBtn.addEventListener('pointerdown', setSprint(true));
    sprintBtn.addEventListener('pointerup', setSprint(false));
    sprintBtn.addEventListener('pointercancel', setSprint(false));

    /* bruit volontaire au clic dans la scène */
    canvas.addEventListener('pointerdown', e => {
      if (state.phase !== 'play' || state.pingCooldown > 0) return;
      const p = screenToWorld(e);
      emitPing(p.x, p.y);
    });
    function emitPing(x, y) {
      if (state.pingCooldown > 0) return;
      state.activeNoise = { x, y, intensity: 1, t: state.t, until: state.t + 3 };
      state.pingCooldown = 3.4;
      rings.spawn(o => { o.x = x; o.y = y; o.max = o.life = 0.9; o.r0 = 10; o.r1 = 90; o.col = '126,210,240'; });
    }
    function screenToWorld(e) {
      const r = canvas.getBoundingClientRect();
      const sx = (e.clientX - r.left) / r.width * VW;
      const sy = (e.clientY - r.top) / r.height * VH;
      return { x: cam.x + (sx - VW / 2) / cam.zoom, y: cam.y + (sy - VH / 2) / cam.zoom };
    }

    /* ---------------- dimensionnement ---------------- */
    function resize() {
      const w = canvas.parentElement.clientWidth;
      if (!w) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(w * (VH / VW) * dpr);
    }
    const ro = new ResizeObserver(resize);
    ro.observe(el.querySelector('#wrap'));

    /* ============ helpers monde ============ */
    function activeBlockers() {
      const b = level.walls.slice();
      for (const d of doors) if (!d.open) b.push(d);
      return b;
    }

    /* ============ mise à jour ============ */
    function update(dt) {
      state.t += dt;

      /* entrées → vecteur désiré */
      let ax = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
      let ay = (state.keys.down ? 1 : 0) - (state.keys.up ? 1 : 0);
      if (state.joy) { ax = state.joy.x; ay = state.joy.y; }
      const sprint = state.keys.sprint || state.sprintTouch;

      const blockers = activeBlockers();
      LC.player.update(player, { ax, ay, sprint }, { blockers, size: level.size, dt }, dt);

      /* bruit émis par le joueur (sprint / choc) */
      if (player.noiseEvent) {
        state.activeNoise = { ...player.noiseEvent, t: state.t, until: state.t + 0.4 };
        rings.spawn(o => { o.x = player.noiseEvent.x; o.y = player.noiseEvent.y; o.max = o.life = 0.5; o.r0 = 6; o.r1 = 46; o.col = '255,255,255'; });
      }
      const noiseForEnemies = state.activeNoise && state.t <= state.activeNoise.until ? state.activeNoise : null;

      if (state.pingCooldown > 0) state.pingCooldown -= dt;

      /* interrupteurs (activation au contact) */
      for (const s of switches) {
        if (!s.on && U.dist(player.x, player.y, s.x, s.y) < 26) {
          s.on = true;
          for (const id of s.opens) { const d = doors.find(dd => dd.id === id); if (d) d.open = true; }
          burst(s.x, s.y, '#7ef0d4', 14);
        }
      }

      /* fragments */
      for (const f of fragments) {
        if (!f.got && U.dist(player.x, player.y, f.x, f.y) < player.r + 12) {
          f.got = true; state.collected++;
          burst(f.x, f.y, skinColor, 18);
          if (level.boss) { state.bossPhase = Math.min(state.bossPhase + 1, level.boss.phases.length - 1); cam.shake = Math.max(cam.shake, 8); }
        }
      }

      /* checkpoints */
      for (const c of checkpoints) if (!c.reached && U.dist(player.x, player.y, c.x, c.y) < 30) { c.reached = true; state.respawn = { x: c.x, y: c.y }; }

      /* ennemis + détection */
      const eCtx = {
        player: { x: player.x, y: player.y, r: player.r, vx: player.vx, vy: player.vy, hidden: false, invincible: player.invincible > 0, exposed: player.exposed },
        blockers, noise: noiseForEnemies, time: state.t, senseMul: level.mode === 'daily' ? 1.15 : 1,
        bossConfig: level.boss ? { ...level.boss, phases: level.boss.phases } : null,
      };
      if (level.boss) enemies.forEach(e => { if (e.isBoss) e.phase = state.bossPhase; });

      let danger = 0;
      for (const e of enemies) {
        LC.enemy.update(e, eCtx, dt);
        danger = Math.max(danger, e.suspicion);
        if (e.justDetected && player.invincible <= 0) onDetected(e);
      }
      state.danger = U.damp(state.danger, danger, 10, dt);

      /* caméra (anticipation + zoom danger + secousse) */
      const lead = 22;
      const tx = player.x + player.vx / LC.player.SPRINT * lead;
      const ty = player.y + player.vy / LC.player.SPRINT * lead;
      cam.x = U.damp(cam.x, tx, 6, dt);
      cam.y = U.damp(cam.y, ty, 6, dt);
      const targetZoom = 1 + state.danger * 0.06;
      cam.zoom = U.damp(cam.zoom, targetZoom, 4, dt);
      clampCamera();
      if (cam.shake > 0) cam.shake = Math.max(0, cam.shake - dt * 26);

      /* enregistrement du fantôme (échantillonné) */
      state.ghostAcc -= dt;
      if (state.ghostAcc <= 0) { state.ghostRec.push({ t: state.t, x: player.x, y: player.y }); state.ghostAcc = 0.08; }

      /* particules */
      particles.update((p, d) => { p.life -= d; p.x += p.vx * d; p.y += p.vy * d; p.vx *= 0.92; p.vy *= 0.92; return p.life > 0; }, dt);
      rings.update((r, d) => { r.life -= d; return r.life > 0; }, dt);

      /* tutoriels contextuels */
      updateTutorials();

      /* sortie */
      const ex = level.exit;
      const exitOpen = !ex.needs || state.collected >= ex.needs;
      if (exitOpen && player.entering <= 0 &&
          player.x > ex.x - player.r && player.x < ex.x + ex.w + player.r &&
          player.y > ex.y - player.r && player.y < ex.y + ex.h + player.r) {
        LC.player.startEntering(player, ex);
        state.phase = 'winning';
        burst(player.x, player.y, '#ffe9b0', 30);
      }
      if (state.phase === 'winning' && player.entering >= 1) win();
    }

    function onDetected(e) {
      state.detections++;
      state.hearts--;
      state.heartsLost++;
      LC.player.hit(player, INVINCIBLE);
      LC.enemy.setReaction(e, 'angry', 1.2);
      if (!settings.disableShake) cam.shake = 14;
      state.timeScale = 0.35;             // court ralenti
      setTimeout(() => { state.timeScale = 1; }, 220);
      burst(player.x, player.y, '#e05b6b', 22);
      renderHud();
      if (state.hearts <= 0) {
        if (state.checkpointsUsed < checkpoints.length) {
          state.checkpointsUsed++;
          state.hearts = 1;
          player.x = state.respawn.x; player.y = state.respawn.y;
          player.vx = player.vy = 0;
          LC.player.hit(player, INVINCIBLE);
        } else { fail(); }
      }
    }

    function burst(x, y, col, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * U.TAU, sp = 40 + Math.random() * 140;
        particles.spawn(o => { o.x = x; o.y = y; o.vx = Math.cos(a) * sp; o.vy = Math.sin(a) * sp; o.max = o.life = 0.4 + Math.random() * 0.5; o.r = 1.5 + Math.random() * 2.5; o.col = col; });
      }
    }

    function updateTutorials() {
      for (const tu of (level.tutorials || [])) {
        const key = JSON.stringify(tu.at);
        if (state.tutoShown[key]) continue;
        if (tu.at === 'start') { showTuto(tu.text); state.tutoShown[key] = 1; }
        else if (tu.at && tu.at.r != null && U.dist(player.x, player.y, tu.at.x, tu.at.y) < tu.at.r) { showTuto(tu.text); state.tutoShown[key] = 1; }
      }
    }
    let tutoTimer = 0;
    function showTuto(text) { tuto.textContent = text; tuto.hidden = false; tutoTimer = 5; }

    function clampCamera() {
      const hw = VW / (2 * cam.zoom), hh = VH / (2 * cam.zoom);
      cam.x = level.size.w <= hw * 2 ? level.size.w / 2 : U.clamp(cam.x, hw, level.size.w - hw);
      cam.y = level.size.h <= hh * 2 ? level.size.h / 2 : U.clamp(cam.y, hh, level.size.h - hh);
    }

    /* ============ rendu ============ */
    function draw() {
      const scale = canvas.width / VW;
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      // fond + parallaxe (espace écran)
      const g = ctx.createLinearGradient(0, 0, 0, VH);
      g.addColorStop(0, '#161d3a'); g.addColorStop(1, '#0b1022');
      ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
      for (const layer of layers) {
        for (const s of layer.stars) {
          // décalage parallaxe proportionnel à la profondeur de la couche
          const scx = (s.x - cam.x) * layer.depth + VW / 2;
          const scy = (s.y - cam.y) * layer.depth + VH / 2;
          if (scx < -5 || scx > VW + 5 || scy < -5 || scy > VH + 5) continue;
          ctx.globalAlpha = s.a * (0.6 + 0.4 * Math.sin(state.t * 1.5 + s.x));
          ctx.fillStyle = '#fff';
          ctx.beginPath(); ctx.arc(scx, scy, s.r, 0, U.TAU); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // transformation monde (caméra + zoom + secousse)
      const sh = cam.shake, ox = sh ? (Math.random() - 0.5) * sh : 0, oy = sh ? (Math.random() - 0.5) * sh : 0;
      const z = scale * cam.zoom;
      ctx.setTransform(z, 0, 0, z, (VW / 2 - cam.x * cam.zoom) * scale + ox, (VH / 2 - cam.y * cam.zoom) * scale + oy);

      // poussières lumineuses
      for (const d of dust) {
        const dy = d.y + Math.sin(state.t * 0.4 + d.ph) * 8;
        ctx.globalAlpha = 0.10 + 0.06 * Math.sin(state.t + d.ph);
        ctx.fillStyle = '#9fb0ff';
        ctx.beginPath(); ctx.arc(d.x, dy, 2, 0, U.TAU); ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (!hideCones) for (const e of enemies) drawCone(e);

      drawExit();
      for (const f of fragments) if (!f.got) drawFragment(f);
      for (const s of switches) drawSwitch(s);
      for (const d of doors) if (!d.open) drawDoor(d);
      for (const w of level.walls) drawWall(w);

      // marqueurs "dernière position vue" (Méfiant)
      for (const e of enemies) if (e.lastKnown && !e.sees && (e.state === LC.enemy.STATE.SEARCH) ) {
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '700 18px "Segoe UI",sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('?', e.lastKnown.x, e.lastKnown.y - 12);
      }

      // rings de bruit
      rings.live.forEach(r => {
        const k = 1 - r.life / r.max, rad = U.lerp(r.r0, r.r1, U.easeOutCubic(k));
        ctx.strokeStyle = `rgba(${r.col}, ${(1 - k) * 0.7})`; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(r.x, r.y, rad, 0, U.TAU); ctx.stroke();
      });

      // fantôme
      if (ghost && ghost.length) drawGhost();

      for (const e of enemies) drawEnemy(e);
      drawParticles();
      drawPlayer();

      // vignette de danger (retour à l'écran)
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      if (state.danger > 0.05) {
        const vg = ctx.createRadialGradient(VW / 2, VH / 2, VH * 0.32, VW / 2, VH / 2, VH * 0.72);
        const col = state.danger > 0.75 ? '224,91,107' : '255,176,90';
        vg.addColorStop(0, `rgba(${col},0)`); vg.addColorStop(1, `rgba(${col},${state.danger * 0.34})`);
        ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
      }
      if (player.hitFlash > 0) { ctx.fillStyle = `rgba(224,91,107,${player.hitFlash * 0.25})`; ctx.fillRect(0, 0, VW, VH); }
    }

    function drawCone(e) {
      const rays = 30, pts = [];
      for (let i = 0; i <= rays; i++) {
        const a = e.dir - e.vision.angle / 2 + (e.vision.angle * i) / rays;
        const ex = e.x + Math.cos(a) * e.vision.range, ey = e.y + Math.sin(a) * e.vision.range;
        let t = 1; for (const w of activeBlockers()) t = Math.min(t, U.rayRectT(e.x, e.y, ex, ey, w));
        pts.push([e.x + (ex - e.x) * t, e.y + (ey - e.y) * t]);
      }
      // couleur selon l'état
      let col = '235,238,255', base = 0.10;
      if (e.state === LC.enemy.STATE.SUSPECT) { col = '255,214,140'; base = 0.16; }
      if (e.state === LC.enemy.STATE.SEARCH) { col = '255,190,110'; base = 0.15; }
      if (e.state === LC.enemy.STATE.PURSUE || e.sees) { col = '255,120,120'; base = 0.24; }
      if (e.type === 'distrait' && e.distractTarget) { col = '126,210,240'; base = 0.14; }
      const osc = 1 + Math.sin(state.t * 3 + e.breathe) * 0.04;
      const grad = ctx.createRadialGradient(e.x, e.y, 10, e.x, e.y, e.vision.range);
      grad.addColorStop(0, `rgba(${col},${(base + e.suspicion * 0.14) * osc})`);
      grad.addColorStop(0.7, `rgba(${col},${base * 0.5})`);
      grad.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.moveTo(e.x, e.y);
      for (const [x, y] of pts) ctx.lineTo(x, y);
      ctx.closePath(); ctx.fill();
    }

    function drawWall(w) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 7;
      ctx.fillStyle = 'rgba(255,255,255,.94)';
      roundRect(w.x, w.y, w.w, w.h, 10); ctx.fill();
      ctx.restore();
    }
    function drawDoor(d) {
      ctx.fillStyle = 'rgba(120,130,200,.55)';
      roundRect(d.x, d.y, d.w, d.h, 6); ctx.fill();
      ctx.strokeStyle = 'rgba(180,190,255,.6)'; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
    }
    function drawSwitch(s) {
      ctx.save(); ctx.translate(s.x, s.y);
      ctx.fillStyle = s.on ? '#7ef0d4' : '#4a5178';
      ctx.shadowColor = s.on ? '#7ef0d4' : 'transparent'; ctx.shadowBlur = s.on ? 16 : 0;
      roundRect(-13, -13, 26, 26, 6); ctx.fill();
      ctx.fillStyle = s.on ? '#0b1022' : '#aeb6e0'; ctx.font = '700 14px "Segoe UI",sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(s.on ? '✓' : '⏻', 0, 1); ctx.restore(); ctx.textBaseline = 'alphabetic';
    }
    function drawExit() {
      const d = level.exit, open = !d.needs || state.collected >= d.needs;
      ctx.save();
      if (open) {
        ctx.shadowColor = 'rgba(255,220,130,.9)'; ctx.shadowBlur = 26 + Math.sin(state.t * 3) * 6;
        ctx.fillStyle = '#ffe9b0';
        // particules aspirées
        if (Math.random() < 0.3) particles.spawn(o => { const a = Math.random() * U.TAU; o.x = d.x + d.w / 2 + Math.cos(a) * 40; o.y = d.y + d.h / 2 + Math.sin(a) * 40; o.vx = (d.x + d.w / 2 - o.x) * 1.5; o.vy = (d.y + d.h / 2 - o.y) * 1.5; o.max = o.life = 0.5; o.r = 1.5; o.col = '#ffe9b0'; });
      } else { ctx.fillStyle = 'rgba(120,130,200,.5)'; }
      roundRect(d.x, d.y, d.w, d.h, 10); ctx.fill();
      ctx.restore();
      ctx.fillStyle = open ? 'rgba(255,233,176,.8)' : 'rgba(180,190,255,.7)';
      ctx.font = '600 11px "Segoe UI",sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(open ? 'SORTIE' : `${state.collected}/${d.needs} ◆`, d.x + d.w / 2, d.y + d.h + 15);
    }
    function drawFragment(f) {
      const y = f.y + Math.sin(state.t * 2 + f.ph) * 4;
      ctx.save(); ctx.translate(f.x, y); ctx.rotate(Math.PI / 4);
      ctx.shadowColor = skinColor; ctx.shadowBlur = 14; ctx.fillStyle = skinColor;
      ctx.globalAlpha = 0.9; roundRect(-7, -7, 14, 14, 3); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1;
    }

    function drawEnemy(e) {
      const breath = 1 + Math.sin(e.breathe * 1.6) * 0.03;
      const swayX = Math.sin(e.sway) * 2;
      ctx.save();
      ctx.translate(e.x + swayX, e.y);
      ctx.scale(e.isBoss ? 1.9 : 1, e.isBoss ? 1.9 : 1);
      ctx.scale(breath, 2 - breath);
      // corps
      ctx.fillStyle = e.isBoss ? '#3a2c52' : '#2c3152';
      ctx.beginPath(); ctx.ellipse(0, 26, 20, 16, 0, Math.PI, 0); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, 19, 0, U.TAU); ctx.fill();
      // yeux : la pupille suit e.pupilDir, indépendamment du corps
      const px = Math.cos(e.pupilDir) * 6, py = Math.sin(e.pupilDir) * 5;
      const eyeH = 6 * e.blink * (1 - e.squint * 0.35);
      for (const side of [-1, 1]) {
        const ex = side * 7;
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(ex, -2, 5, eyeH, 0, 0, U.TAU); ctx.fill();
        ctx.fillStyle = '#23263a';
        ctx.beginPath(); ctx.arc(ex + px * 0.5, -2 + py * 0.5, 2.3 * e.blink, 0, U.TAU); ctx.fill();
      }
      // émote de réaction
      if (e.reaction) {
        const sym = { surprise: '!', confused: '?', angry: '!', search: '…', lost: '·' }[e.reaction];
        const rc = { surprise: '#ffd68c', confused: '#7ed2f0', angry: '#ff7878', search: '#ffbe6e', lost: '#aeb6e0' }[e.reaction];
        ctx.fillStyle = rc; ctx.font = '700 16px "Segoe UI",sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(sym, 0, -26 - Math.sin(state.t * 6) * 2);
      }
      ctx.restore();
      // nom : seulement en tutoriel (mondes/niveaux d'intro)
      if (level.index >= 1 && level.index <= 3 && !e.isBoss || (e.isBoss)) {
        ctx.fillStyle = 'rgba(223,227,255,.35)'; ctx.font = '600 10px "Segoe UI",sans-serif'; ctx.textAlign = 'center';
        const nm = { guetteur: 'le Guetteur', distrait: 'le Distrait', mefiant: 'le Méfiant', boss: 'L’Œil' }[e.type];
        ctx.fillText(nm, e.x + swayX, e.y + (e.isBoss ? 74 : 50));
      }
    }

    function drawGhost() {
      // position du fantôme au temps courant
      let g = ghost[0];
      for (let i = 1; i < ghost.length; i++) { if (ghost[i].t > state.t) { g = ghost[i - 1]; break; } g = ghost[i]; }
      ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#9fb0ff'; ctx.shadowColor = '#9fb0ff'; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.arc(g.x, g.y, 9, 0, U.TAU); ctx.fill(); ctx.restore();
    }

    function drawParticles() {
      particles.live.forEach(p => {
        ctx.globalAlpha = Math.max(0, p.life / p.max);
        ctx.fillStyle = p.col;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, U.TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    function drawPlayer() {
      // traînée
      player.trail.forEach(tp => {
        ctx.globalAlpha = Math.max(0, tp.life) * 0.5;
        ctx.fillStyle = skinColor;
        ctx.beginPath(); ctx.arc(tp.x, tp.y, 5, 0, U.TAU); ctx.fill();
      });
      ctx.globalAlpha = 1;
      const blink = player.invincible > 0 ? 0.4 + 0.35 * Math.sin(state.t * 22) : 1;
      const pulse = 1 + Math.sin(player.pulse * 2.4) * 0.05;
      ctx.save();
      ctx.globalAlpha = blink;
      ctx.translate(player.x, player.y);
      ctx.rotate(player.angle + Math.PI / 2);
      ctx.scale(player.scaleX * pulse, player.scaleY * pulse);
      ctx.shadowColor = skinColor; ctx.shadowBlur = 18;
      ctx.fillStyle = skinColor;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rr = i % 2 === 0 ? player.r + 3 : player.r * 0.45;
        const a = (Math.PI / 5) * i - Math.PI / 2;
        ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath(); ctx.fill();
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

    /* ============ HUD ============ */
    function renderHud() {
      hudHearts.innerHTML = '♥'.repeat(Math.max(0, state.hearts)) + `<span class="lost">${'♥'.repeat(Math.max(0, (level.hearts || 3) - state.hearts))}</span>`;
      hudFrag.textContent = `◆ ${state.collected}/${totalFrags}`;
      hudFrag.style.display = totalFrags ? '' : 'none';
    }
    function renderGauges() {
      staminaFill.style.width = (player.stamina * 100) + '%';
      staminaFill.style.opacity = player.canSprint ? 1 : 0.4;
      dangerFill.style.width = (state.danger * 100) + '%';
    }

    /* ============ écrans (objectifs / pause / résultats) ============ */
    function showOverlay(html) { overlayCard.innerHTML = html; overlay.classList.add('shown'); }
    function hideOverlay() { overlay.classList.remove('shown'); }

    function showObjectives() {
      state.phase = 'objectives';
      const objs = (level.objectives || []).map(o => `<li>${o.label}</li>`).join('');
      const modeTag = level.mode === 'seed' ? '<span class="tag">Graine</span>' : '';
      showOverlay(`
        <h2>${level.name} ${modeTag}</h2>
        <p class="ov-sub">Temps cible : ${fmt(level.targetTime)}${totalFrags ? ` · ${totalFrags} fragment${totalFrags > 1 ? 's' : ''}` : ''}</p>
        <ul class="ov-obj">
          <li>★ Terminer le niveau</li>
          <li>★★ Sans perdre de cœur</li>
          <li>★★★ Battre le temps cible ${totalFrags ? '+ tous les fragments' : ''}</li>
          ${objs}
        </ul>
        <div class="overlay-actions">
          <button class="btn" data-act="start">Commencer</button>
          <button class="btn-ghost" data-go="/world/${level.world || 1}">Retour</button>
        </div>`);
    }

    function togglePause() {
      if (state.phase === 'play') {
        state.phase = 'pause';
        showOverlay(`
          <h2>Pause</h2>
          <p class="ov-sub">Les Curieux patientent, l'air de rien.</p>
          <div class="overlay-actions">
            <button class="btn" data-act="resume">Reprendre</button>
            <button class="btn-ghost" data-act="retry">Recommencer</button>
            <button class="btn-ghost" data-go="/world/${level.world || 1}">Quitter</button>
          </div>`);
      } else if (state.phase === 'pause') { state.phase = 'play'; hideOverlay(); }
    }

    function computeStars(time) {
      let stars = 1;
      if (state.heartsLost === 0) stars = 2;
      if (time <= level.targetTime && state.collected === totalFrags) stars = 3;
      return stars;
    }

    function win() {
      if (state.phase === 'done') return;
      state.phase = 'done';
      const time = Math.round(state.t * 10) / 10;
      const stars = computeStars(time);
      let best = null;
      if (level.mode === 'campaign') {
        const rec = LC.save.recordResult(user.email, level.id, {
          stars, time, detections: state.detections, fragments: state.collected, total: totalFrags,
          objectives: objectivesResult(time),
        });
        best = rec.worlds[level.world].levels[level.id].bestTime;
        // fantôme : conserver le meilleur trajet personnel
        const prevGhost = LC.save.getGhost(user.email, level.id);
        if (!prevGhost || time <= best) LC.save.saveGhost(user.email, level.id, state.ghostRec);
      }
      const seed = level.seed || dailySeed();
      const doCinematic = level.cinematic;
      if (doCinematic) { runCinematic(() => showResult(time, stars, best, seed)); }
      else showResult(time, stars, best, seed);
    }

    function objectivesResult(time) {
      const res = {};
      for (const o of (level.objectives || [])) {
        if (o.type === 'allFragments') res[o.id] = state.collected === totalFrags;
        else if (o.type === 'noDetect') res[o.id] = state.detections === 0;
        else if (o.type === 'underTime') res[o.id] = time <= level.targetTime;
        else res[o.id] = false;
      }
      return res;
    }

    function runCinematic(done) {
      state.phase = 'cinematic';
      let ct = 0;
      const iv = setInterval(() => {
        ct += 0.05;
        cam.zoom = U.damp(cam.zoom, 0.55, 3, 0.05);
        if (ct > 1.6) { clearInterval(iv); done(); }
      }, 50);
    }

    function showResult(time, stars, best, seed) {
      const starsHtml = [1, 2, 3].map(n => `<span class="${n <= stars ? '' : 'off'}">★</span>`).join('');
      const objs = objectivesResult(time);
      const objHtml = (level.objectives || []).map(o => `<li class="${objs[o.id] ? 'ok' : 'ko'}">${objs[o.id] ? '✓' : '✗'} ${o.label}</li>`).join('');
      const nextId = LC.levels.nextLevelId(level.id);
      const rank = ['—', 'Bronze', 'Argent', 'Or'][stars];
      const quip = QUIPS[Math.floor(Math.random() * QUIPS.length)];
      const shareTxt = `Les Curieux — ${level.name}\n${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} · ${fmt(time)} · ${state.detections} détection(s)\nGraine : ${seed}\n${quip}`;
      showOverlay(`
        <h2>${state.mode === 'daily' ? 'Défi relevé !' : 'Sortie atteinte !'}</h2>
        <div class="ov-stars">${starsHtml}</div>
        <div class="share-card">
          <div class="share-head"><strong>${level.name}</strong><span>${rank}</span></div>
          <div class="share-grid">
            <span>Temps</span><b>${fmt(time)}</b>
            <span>Meilleur</span><b>${fmt(best != null ? best : time)}</b>
            <span>Détections</span><b>${state.detections}</b>
            <span>Fragments</span><b>${state.collected}/${totalFrags}</b>
            <span>Graine</span><b>${seed}</b>
          </div>
          <p class="share-quip">« ${quip} »</p>
        </div>
        <ul class="ov-obj result">${objHtml}</ul>
        <div class="overlay-actions">
          ${nextId ? `<button class="btn" data-go="/game/${nextId}">Niveau suivant</button>` : `<button class="btn" data-go="/world/${level.world || 1}">Carte des niveaux</button>`}
          <div class="row-2">
            <button class="btn-ghost" data-act="retry">Rejouer</button>
            <button class="btn-ghost" data-act="share" data-share="${encodeURIComponent(shareTxt)}">Partager</button>
          </div>
          <button class="btn-link" data-go="/menu">Menu principal</button>
        </div>`);
    }

    function fail() {
      state.phase = 'done';
      showOverlay(`
        <h2>Repérée…</h2>
        <p class="ov-sub">Un regard de trop. L'étoile file se rhabiller.</p>
        <div class="overlay-actions">
          <button class="btn" data-act="retry">Réessayer</button>
          <button class="btn-ghost" data-go="/world/${level.world || 1}">Niveaux</button>
          <button class="btn-link" data-go="/menu">Menu principal</button>
        </div>`);
    }

    /* actions overlay */
    overlay.addEventListener('click', async (e) => {
      const go = e.target.closest('[data-go]');
      if (go) { LC.router.go(go.dataset.go); return; }
      const act = e.target.closest('[data-act]');
      if (!act) return;
      const a = act.dataset.act;
      if (a === 'start') { state.phase = 'play'; hideOverlay(); lastTime = performance.now(); }
      else if (a === 'resume') togglePause();
      else if (a === 'retry') LC.router.go('/game/' + level.id);
      else if (a === 'share') {
        const txt = decodeURIComponent(act.dataset.share);
        try { await navigator.clipboard.writeText(txt); act.textContent = 'Copié !'; }
        catch { act.textContent = 'Copie indispo'; }
        setTimeout(() => { act.textContent = 'Partager'; }, 1600);
      }
    });

    el.querySelector('#pauseBtn').addEventListener('click', () => { if (state.phase === 'play' || state.phase === 'pause') togglePause(); });

    /* ============ boucle ============ */
    let rafId = 0, lastTime = performance.now();
    renderHud();
    showObjectives();
    function frame(now) {
      let dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      dt *= state.timeScale;
      if (state.phase === 'play' || state.phase === 'winning' || state.phase === 'cinematic') {
        if (state.phase !== 'cinematic') update(dt);
        hudTime.textContent = fmt(Math.round(state.t * 10) / 10);
        if (tutoTimer > 0) { tutoTimer -= dt; if (tutoTimer <= 0) tuto.hidden = true; }
        renderGauges();
      }
      draw();
      rafId = requestAnimationFrame(frame);
    }
    rafId = requestAnimationFrame(frame);

    function onBlur() { if (state.phase === 'play') togglePause(); }
    window.addEventListener('blur', onBlur);

    return {
      el,
      cleanup() {
        cancelAnimationFrame(rafId);
        ro.disconnect();
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('blur', onBlur);
      },
    };
  }

  return { createGameScreen, seededLevel, dailySeed, resolveLevel, fmt };
})();

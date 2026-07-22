/* Écrans de l'application (hors moteur de jeu) :
   auth (connexion / inscription / oubli), menu, carte des mondes, sélection
   des niveaux, profil, paramètres. La direction artistique d'origine est
   conservée (silhouettes + cartes blanches sur fond bleu nuit). */
window.LC = window.LC || {};

LC.screens = (function () {

  const EYE_ICONS = `
    <svg class="icon-show" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
    </svg>
    <svg class="icon-hide" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>`;

  function make(cls, html) { const el = document.createElement('div'); el.className = cls; el.innerHTML = html; return el; }
  function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  function formatTime(sec) {
    if (sec == null) return '—';
    const m = Math.floor(sec / 60), s = (sec % 60).toFixed(1).padStart(4, '0');
    return `${String(m).padStart(2, '0')}:${s}`;
  }
  function starRow(n) { return [1, 2, 3].map(i => `<span class="${i <= n ? '' : 'off'}">★</span>`).join(''); }
  function applyMotionPref() {
    const u = LC.auth.current();
    document.body.classList.toggle('reduced-motion', u ? LC.save.load(u.email).settings.reducedMotion : false);
  }

  function passwordField(id, label) {
    return `
      <div class="field">
        <label for="${id}">${label}</label>
        <div class="input-wrap">
          <input type="password" id="${id}" data-password placeholder="••••••••">
          <button type="button" class="toggle-pass" data-toggle="${id}" aria-label="Afficher le mot de passe" title="Afficher / masquer">${EYE_ICONS}</button>
        </div>
      </div>`;
  }

  function authScene(cardHtml) {
    const el = make('screen auth-screen', `<div class="scene"><div class="card">${cardHtml}</div></div>`);
    const peeps = LC.peeps.create();
    el.querySelector('.scene').prepend(peeps.el);
    return { el, peeps, card: el.querySelector('.card') };
  }

  function bindPeeps(el, peeps, emailIds, hints) {
    const passInput = el.querySelector('#password');
    const toggle = el.querySelector('.toggle-pass');
    LC.peeps.bindForm(peeps, {
      emailInputs: emailIds.map(id => el.querySelector('#' + id)).filter(Boolean),
      passInput, toggleBtn: toggle,
      iconShow: toggle && toggle.querySelector('.icon-show'),
      iconHide: toggle && toggle.querySelector('.icon-hide'),
      hintEl: el.querySelector('#hint'), hints,
    });
  }

  /* ============================ CONNEXION ============================ */
  function loginScreen() {
    const { el, peeps, card } = authScene(`
      <h1>Bon retour&nbsp;!</h1>
      <p class="subtitle">Connectez-vous… on ne regarde pas, promis.</p>
      <form id="loginForm" autocomplete="off"><fieldset>
        <div class="field"><label for="email">Adresse e-mail</label>
          <div class="input-wrap"><input type="email" id="email" placeholder="vous@exemple.com" spellcheck="false"></div></div>
        ${passwordField('password', 'Mot de passe')}
        <button type="submit" class="btn">Se connecter</button>
        <p class="hint" id="hint"></p>
        <p class="alt-links"><a href="#/register">Créer un compte</a> · <a href="#/forgot">Mot de passe oublié&nbsp;?</a></p>
      </fieldset></form>`);
    bindPeeps(el, peeps, ['email'], {
      idle: '', email: 'Elles lisent par-dessus votre épaule… 👀',
      password: 'Chut… elles essaient de deviner votre mot de passe.',
      reveal: 'Mot de passe visible : elles détournent le regard, promis !',
    });
    const form = el.querySelector('#loginForm'), fs = form.querySelector('fieldset');
    const email = el.querySelector('#email'), password = el.querySelector('#password'), hint = el.querySelector('#hint');
    let timers = [];
    form.addEventListener('submit', async e => {
      e.preventDefault();
      hint.dataset.locked = '1'; hint.classList.remove('error', 'success');
      try { await LC.auth.login(email.value, password.value); }
      catch (err) { hint.classList.add('error'); hint.textContent = err.message; delete hint.dataset.locked; return; }
      fs.disabled = true; hint.classList.add('success');
      hint.textContent = 'Identité confirmée. Les Curieux vous ont reconnu.';
      peeps.resetEyes(); peeps.setState('hello'); applyMotionPref();
      timers.push(setTimeout(() => card.classList.add('fade-out'), 1300));
      timers.push(setTimeout(() => LC.router.go('/menu'), 2100));
    });
    return { el, cleanup: () => timers.forEach(clearTimeout) };
  }

  /* ========================= CRÉATION DE COMPTE ========================= */
  function registerScreen() {
    const { el, peeps } = authScene(`
      <h1>Bienvenue parmi nous</h1>
      <p class="subtitle">Créez votre compte… elles sont déjà très intriguées.</p>
      <form id="registerForm" autocomplete="off"><fieldset>
        <div class="field"><label for="pseudo">Pseudonyme</label>
          <div class="input-wrap"><input type="text" id="pseudo" placeholder="PetiteÉtoile" maxlength="20" spellcheck="false"></div></div>
        <div class="field"><label for="email">Adresse e-mail</label>
          <div class="input-wrap"><input type="email" id="email" placeholder="vous@exemple.com" spellcheck="false"></div></div>
        ${passwordField('password', 'Mot de passe (6 caractères min.)')}
        <button type="submit" class="btn">Créer mon compte</button>
        <p class="hint" id="hint"></p>
        <p class="alt-links">Déjà un compte&nbsp;? <a href="#/login">Se connecter</a></p>
      </fieldset></form>`);
    bindPeeps(el, peeps, ['pseudo', 'email'], {
      email: 'Un nouveau visage ! Elles prennent des notes.',
      password: 'Elles plissent les yeux… choisissez-le bien.',
      reveal: 'Elles détournent poliment le regard.',
    });
    const hint = el.querySelector('#hint');
    el.querySelector('#registerForm').addEventListener('submit', async e => {
      e.preventDefault();
      hint.dataset.locked = '1'; hint.classList.remove('error');
      try {
        await LC.auth.register({ pseudo: el.querySelector('#pseudo').value, email: el.querySelector('#email').value, password: el.querySelector('#password').value });
        LC.router.go('/menu');
      } catch (err) { hint.classList.add('error'); hint.textContent = err.message; delete hint.dataset.locked; }
    });
    return { el };
  }

  /* ======================= MOT DE PASSE OUBLIÉ ======================= */
  function forgotScreen() {
    const { el, peeps } = authScene(`
      <h1>Mot de passe oublié</h1>
      <p class="subtitle">Démo locale, sans e-mail : définissez-en un nouveau ici.</p>
      <form id="forgotForm" autocomplete="off"><fieldset>
        <div class="field"><label for="email">Adresse e-mail du compte</label>
          <div class="input-wrap"><input type="email" id="email" placeholder="vous@exemple.com" spellcheck="false"></div></div>
        ${passwordField('password', 'Nouveau mot de passe')}
        <button type="submit" class="btn">Réinitialiser</button>
        <p class="hint" id="hint"></p>
        <p class="alt-links"><a href="#/login">Retour à la connexion</a></p>
      </fieldset></form>`);
    bindPeeps(el, peeps, ['email'], {
      email: 'Elles cherchent votre nom dans leurs souvenirs…',
      password: 'Un nouveau secret ? Elles adorent les secrets.',
      reveal: 'Rien vu, rien entendu.',
    });
    const hint = el.querySelector('#hint');
    el.querySelector('#forgotForm').addEventListener('submit', async e => {
      e.preventDefault();
      hint.dataset.locked = '1'; hint.classList.remove('error', 'success');
      try {
        await LC.auth.resetPassword(el.querySelector('#email').value, el.querySelector('#password').value);
        hint.classList.add('success'); hint.textContent = 'Mot de passe réinitialisé. Vous pouvez vous connecter.';
      } catch (err) { hint.classList.add('error'); hint.textContent = err.message; }
    });
    return { el };
  }

  /* ============================ MENU PRINCIPAL ============================ */
  function menuScreen() {
    applyMotionPref();
    const u = LC.auth.current();
    const stars = LC.save.totalStars(u.email);
    const next = LC.save.nextUnfinished(u.email);
    const progress = LC.save.hasProgress(u.email);
    const { el, peeps } = authScene(`
      <div class="player-strip">
        <span><span class="pseudo">${escapeHtml(u.pseudo)}</span> · Niveau ${LC.save.rank(u.email)}</span>
        <span class="badge-stars">★ ${stars}</span>
      </div>
      <h1>Les Curieux</h1>
      <p class="subtitle">Traversez la nuit sans vous faire remarquer.</p>
      <div class="menu-actions">
        <button class="btn" data-go="/game/${next}">${progress ? 'Continuer' : 'Jouer'}</button>
        <button class="btn-ghost" data-go="/game/daily">Défi du jour ✦</button>
        <div class="menu-grid">
          <button class="btn-ghost" data-go="/worlds">Mondes</button>
          <button class="btn-ghost" data-go="/profile">Profil</button>
          <button class="btn-ghost" data-go="/settings">Réglages</button>
        </div>
      </div>
      <div class="menu-foot"><button class="btn-link" id="logout">Se déconnecter</button></div>`);
    el.querySelector('.card').classList.add('menu-card');
    peeps.setState('hello'); setTimeout(() => peeps.setState('idle'), 1400);
    el.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) LC.router.go(g.dataset.go); });
    el.querySelector('#logout').addEventListener('click', () => { LC.auth.logout(); LC.router.go('/login'); });
    return { el };
  }

  /* ============================ CARTE DES MONDES ============================ */
  function worldsScreen() {
    const u = LC.auth.current();
    const all = [...LC.levels.WORLDS.map(w => ({ ...w, real: true })), ...LC.levels.LOCKED_WORLDS.map(w => ({ ...w, real: false }))];
    const cards = all.map(w => {
      const unlocked = w.real && LC.save.isWorldUnlocked(u.email, w.id);
      const totalLv = w.real ? w.levels.length : 10;
      const maxStars = totalLv * 3;
      const got = w.real ? LC.save.worldStars(u.email, w.id) : 0;
      return `
        <button class="world-card ${unlocked ? '' : 'locked'}" data-go="${unlocked ? '/world/' + w.id : ''}" ${unlocked ? '' : 'disabled'} style="--wc:${w.color}">
          <span class="world-dot"></span>
          <span class="world-info">
            <span class="world-name">${w.id}. ${w.name} ${unlocked ? '' : '🔒'}</span>
            <span class="world-sub">${w.subtitle}</span>
          </span>
          <span class="world-stars">★ ${got}/${maxStars}</span>
        </button>`;
    }).join('');
    const el = make('screen', `
      <div class="scene wide"><div class="card">
        <div class="back-row"><button class="btn-link" data-go="/menu">← Menu</button></div>
        <h1>Les mondes</h1>
        <p class="subtitle">Cinq mondes à explorer. Le premier est ouvert.</p>
        <div class="worlds-list">${cards}</div>
      </div></div>`);
    el.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g && g.dataset.go) LC.router.go(g.dataset.go); });
    return { el };
  }

  /* ========================= SÉLECTION DES NIVEAUX ========================= */
  function worldScreen(param) {
    const u = LC.auth.current();
    const world = LC.levels.getWorld(param);
    if (!world) { LC.router.go('/worlds'); return { el: document.createElement('div') }; }
    const tiles = world.levels.map(lv => {
      const unlocked = LC.save.isLevelUnlocked(u.email, lv.id);
      const rec = LC.save.getLevelRecord(u.email, lv.id);
      const stars = rec ? rec.stars : 0;
      return `
        <button class="level-tile ${unlocked ? '' : 'locked'} ${lv.isBoss ? 'boss' : ''}" data-go="${unlocked ? '/game/' + lv.id : ''}" ${unlocked ? '' : 'disabled'}>
          <span class="lt-num">${lv.isBoss ? '☠' : lv.index}</span>
          <span class="lt-name">${unlocked ? lv.name : '🔒'}</span>
          <span class="lt-stars">${starRow(stars)}</span>
          <span class="lt-time">${rec && rec.bestTime != null ? formatTime(rec.bestTime) : ''}</span>
        </button>`;
    }).join('');
    const el = make('screen', `
      <div class="scene wide"><div class="card">
        <div class="back-row"><button class="btn-link" data-go="/worlds">← Mondes</button></div>
        <h1>${world.id}. ${world.name}</h1>
        <p class="subtitle">${world.subtitle}</p>
        <div class="levels-grid">${tiles}</div>
      </div></div>`);
    el.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g && g.dataset.go) LC.router.go(g.dataset.go); });
    return { el };
  }

  /* ============================ PROFIL ============================ */
  function profileScreen() {
    const u = LC.auth.current();
    const stars = LC.save.totalStars(u.email);
    const unlocked = LC.save.unlockedSkins(u.email);
    const data = LC.save.load(u.email);
    let done = 0, total = 0;
    for (const w of LC.levels.WORLDS) for (const l of w.levels) { total++; const r = LC.save.getLevelRecord(u.email, l.id); if (r && r.stars > 0) done++; }
    const skinChips = LC.save.SKINS.map(s => {
      const ok = unlocked.some(x => x.id === s.id), active = data.skin === s.id;
      return `<button class="skin-chip ${active ? 'active' : ''}" data-skin="${s.id}" ${ok ? '' : 'disabled'} title="${ok ? 'Choisir' : 'Débloquée à ' + s.cost + ' ★'}">
        <span class="skin-dot" style="background:${s.color};color:${s.color}"></span>${s.name}${ok ? '' : ' · ' + s.cost + '★'}</button>`;
    }).join('');
    const el = make('screen', `
      <div class="scene"><div class="card">
        <div class="back-row"><button class="btn-link" data-go="/menu">← Menu</button></div>
        <h1>${escapeHtml(u.pseudo)}</h1>
        <p class="subtitle">${escapeHtml(u.email)} · Niveau ${LC.save.rank(u.email)} · ★ ${stars}</p>
        <div class="stat-rows">
          <div class="stat-row"><span class="k">Niveaux terminés</span><span class="v">${done} / ${total}</span></div>
          <div class="stat-row"><span class="k">Étoiles récoltées</span><span class="v">${stars}</span></div>
        </div>
        <p class="subtitle" style="margin-bottom:10px">Apparence de votre étoile</p>
        <div class="skin-list">${skinChips}</div>
        <button class="btn-ghost" id="logout">Se déconnecter</button>
      </div></div>`);
    el.addEventListener('click', e => {
      const g = e.target.closest('[data-go]'); if (g) { LC.router.go(g.dataset.go); return; }
      const chip = e.target.closest('.skin-chip');
      if (chip && !chip.disabled) { LC.save.setSkin(u.email, chip.dataset.skin); el.querySelectorAll('.skin-chip').forEach(c => c.classList.toggle('active', c === chip)); }
    });
    el.querySelector('#logout').addEventListener('click', () => { LC.auth.logout(); LC.router.go('/login'); });
    return { el };
  }

  /* ============================ PARAMÈTRES ============================ */
  const ACTION_LABELS = { up: 'Haut', down: 'Bas', left: 'Gauche', right: 'Droite', sprint: 'Sprint', noise: 'Bruit', pause: 'Pause' };
  const KEY_LABEL = c => c.replace(/^Key/, '').replace(/^Arrow/, '↑↓←→'[['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(c)] || '').replace('Digit', '').replace('Space', 'Espace').replace('ShiftLeft', 'Maj').replace('ShiftRight', 'Maj D').replace('Escape', 'Échap');

  function settingsScreen() {
    const u = LC.auth.current();
    const s = LC.save.load(u.email).settings;
    let binds = LC.save.getKeybinds(u.email);
    const toggle = (id, key, label, sub) => `
      <label class="switch-row"><span>${label}<span class="sw-sub">${sub}</span></span>
        <input type="checkbox" class="switch" id="${id}" ${s[key] ? 'checked' : ''}></label>`;
    function bindRows() {
      return Object.keys(ACTION_LABELS).map(a => `
        <div class="bind-row"><span class="bind-label">${ACTION_LABELS[a]}</span>
          <span class="bind-keys">${binds[a].map(KEY_LABEL).join(' · ')}</span>
          <button class="btn-mini" data-bind="${a}">Modifier</button></div>`).join('');
    }
    const el = make('screen', `
      <div class="scene wide"><div class="card">
        <div class="back-row"><button class="btn-link" data-go="/menu">← Menu</button></div>
        <h1>Réglages</h1>
        <p class="subtitle">Enregistrés avec votre compte.</p>
        ${toggle('reducedMotion', 'reducedMotion', 'Réduire les animations', 'Limite les mouvements du décor et des menus')}
        ${toggle('disableShake', 'disableShake', 'Désactiver les secousses de caméra', 'Aucun tremblement lors des détections')}
        ${toggle('hideCones', 'hideCones', 'Masquer les champs de vision', 'Mode expert : les cônes ne sont plus dessinés')}
        <p class="subtitle" style="margin:16px 0 8px">Touches (clavier)</p>
        <div class="binds" id="binds">${bindRows()}</div>
        <button class="btn-link" id="resetBinds">Réinitialiser les touches</button>
      </div></div>`);

    el.addEventListener('click', e => {
      const g = e.target.closest('[data-go]'); if (g) { LC.router.go(g.dataset.go); return; }
      const b = e.target.closest('[data-bind]');
      if (b) {
        b.textContent = 'Appuyez…';
        const onKey = ev => {
          ev.preventDefault();
          LC.save.setKeybind(u.email, b.dataset.bind, [ev.code]);
          binds = LC.save.getKeybinds(u.email);
          el.querySelector('#binds').innerHTML = bindRows();
          window.removeEventListener('keydown', onKey, true);
        };
        window.addEventListener('keydown', onKey, true);
      }
    });
    el.querySelectorAll('.switch').forEach(sw => sw.addEventListener('change', e => {
      LC.save.setSetting(u.email, e.target.id, e.target.checked);
      if (e.target.id === 'reducedMotion') applyMotionPref();
    }));
    el.querySelector('#resetBinds').addEventListener('click', () => {
      LC.save.resetKeybinds(u.email); binds = LC.save.getKeybinds(u.email);
      el.querySelector('#binds').innerHTML = bindRows();
    });
    return { el };
  }

  return { loginScreen, registerScreen, forgotScreen, menuScreen, worldsScreen, worldScreen, profileScreen, settingsScreen, formatTime };
})();

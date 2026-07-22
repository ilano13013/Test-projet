/* Écrans de l'application (hors jeu) : auth, menu, niveaux, profil, paramètres. */
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

  function make(className, html) {
    const el = document.createElement('div');
    el.className = className;
    el.innerHTML = html;
    return el;
  }

  function passwordField(id, label) {
    return `
      <div class="field">
        <label for="${id}">${label}</label>
        <div class="input-wrap">
          <input type="password" id="${id}" data-password placeholder="••••••••">
          <button type="button" class="toggle-pass" data-toggle="${id}" aria-label="Afficher le mot de passe" title="Afficher / masquer">
            ${EYE_ICONS}
          </button>
        </div>
      </div>`;
  }

  function applyMotionPref() {
    const user = LC.auth.current();
    const reduced = user ? LC.save.load(user.email).settings.reducedMotion : false;
    document.body.classList.toggle('reduced-motion', reduced);
  }

  /* ---------- écran avec silhouettes + carte (auth) ---------- */
  function authScene(cardHtml) {
    const el = make('screen auth-screen', `<div class="scene"><div class="card">${cardHtml}</div></div>`);
    const scene = el.querySelector('.scene');
    const peeps = LC.peeps.create();
    scene.prepend(peeps.el);
    return { el, peeps, card: el.querySelector('.card') };
  }

  /* ============================ CONNEXION ============================ */
  function loginScreen() {
    const { el, peeps, card } = authScene(`
      <h1>Bon retour&nbsp;!</h1>
      <p class="subtitle">Connectez-vous… on ne regarde pas, promis.</p>
      <form id="loginForm" autocomplete="off"><fieldset>
        <div class="field">
          <label for="email">Adresse e-mail</label>
          <div class="input-wrap"><input type="email" id="email" placeholder="vous@exemple.com" spellcheck="false"></div>
        </div>
        ${passwordField('password', 'Mot de passe')}
        <button type="submit" class="btn">Se connecter</button>
        <p class="hint" id="hint"></p>
        <p class="alt-links"><a href="#/register">Créer un compte</a> · <a href="#/forgot">Mot de passe oublié&nbsp;?</a></p>
      </fieldset></form>`);

    const form = el.querySelector('#loginForm');
    const fieldset = form.querySelector('fieldset');
    const email = el.querySelector('#email');
    const password = el.querySelector('#password');
    const toggle = el.querySelector('.toggle-pass');
    const hint = el.querySelector('#hint');

    LC.peeps.bindForm(peeps, {
      emailInputs: [email],
      passInput: password,
      toggleBtn: toggle,
      iconShow: toggle.querySelector('.icon-show'),
      iconHide: toggle.querySelector('.icon-hide'),
      hintEl: hint,
      hints: {
        idle: '',
        email: 'Elles lisent par-dessus votre épaule… 👀',
        password: 'Chut… elles essaient de deviner votre mot de passe.',
        reveal: 'Mot de passe visible : elles détournent le regard, promis !',
      },
    });

    let timers = [];
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hint.dataset.locked = '1';
      hint.classList.remove('error', 'success');
      try {
        await LC.auth.login(email.value, password.value);
      } catch (err) {
        hint.classList.add('error');
        hint.textContent = err.message;
        delete hint.dataset.locked;
        return;
      }
      /* Séquence de succès : formulaire désactivé, message, regard vers
         l'utilisateur, fondu de la carte, puis redirection vers le menu. */
      fieldset.disabled = true;
      hint.classList.add('success');
      hint.textContent = 'Identité confirmée. Les Curieux vous ont reconnu.';
      peeps.resetEyes();
      peeps.setState('hello');
      applyMotionPref();
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
        <div class="field">
          <label for="pseudo">Pseudonyme</label>
          <div class="input-wrap"><input type="text" id="pseudo" placeholder="PetiteÉtoile" maxlength="20" spellcheck="false"></div>
        </div>
        <div class="field">
          <label for="email">Adresse e-mail</label>
          <div class="input-wrap"><input type="email" id="email" placeholder="vous@exemple.com" spellcheck="false"></div>
        </div>
        ${passwordField('password', 'Mot de passe (6 caractères min.)')}
        <button type="submit" class="btn">Créer mon compte</button>
        <p class="hint" id="hint"></p>
        <p class="alt-links">Déjà un compte&nbsp;? <a href="#/login">Se connecter</a></p>
      </fieldset></form>`);

    const pseudo = el.querySelector('#pseudo');
    const email = el.querySelector('#email');
    const password = el.querySelector('#password');
    const toggle = el.querySelector('.toggle-pass');
    const hint = el.querySelector('#hint');

    LC.peeps.bindForm(peeps, {
      emailInputs: [pseudo, email],
      passInput: password,
      toggleBtn: toggle,
      iconShow: toggle.querySelector('.icon-show'),
      iconHide: toggle.querySelector('.icon-hide'),
      hintEl: hint,
      hints: {
        email: 'Un nouveau visage ! Elles prennent des notes.',
        password: 'Elles plissent les yeux… choisissez-le bien.',
        reveal: 'Elles détournent poliment le regard.',
      },
    });

    el.querySelector('#registerForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      hint.dataset.locked = '1';
      hint.classList.remove('error');
      try {
        await LC.auth.register({ pseudo: pseudo.value, email: email.value, password: password.value });
        LC.router.go('/menu');
      } catch (err) {
        hint.classList.add('error');
        hint.textContent = err.message;
        delete hint.dataset.locked;
      }
    });

    return { el };
  }

  /* ======================= MOT DE PASSE OUBLIÉ ======================= */
  function forgotScreen() {
    const { el, peeps } = authScene(`
      <h1>Mot de passe oublié</h1>
      <p class="subtitle">Démo locale, sans e-mail : définissez-en un nouveau ici.</p>
      <form id="forgotForm" autocomplete="off"><fieldset>
        <div class="field">
          <label for="email">Adresse e-mail du compte</label>
          <div class="input-wrap"><input type="email" id="email" placeholder="vous@exemple.com" spellcheck="false"></div>
        </div>
        ${passwordField('password', 'Nouveau mot de passe')}
        <button type="submit" class="btn">Réinitialiser</button>
        <p class="hint" id="hint"></p>
        <p class="alt-links"><a href="#/login">Retour à la connexion</a></p>
      </fieldset></form>`);

    const email = el.querySelector('#email');
    const password = el.querySelector('#password');
    const toggle = el.querySelector('.toggle-pass');
    const hint = el.querySelector('#hint');

    LC.peeps.bindForm(peeps, {
      emailInputs: [email],
      passInput: password,
      toggleBtn: toggle,
      iconShow: toggle.querySelector('.icon-show'),
      iconHide: toggle.querySelector('.icon-hide'),
      hintEl: hint,
      hints: {
        email: 'Elles cherchent votre nom dans leurs souvenirs…',
        password: 'Un nouveau secret ? Elles adorent les secrets.',
        reveal: 'Rien vu, rien entendu.',
      },
    });

    el.querySelector('#forgotForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      hint.dataset.locked = '1';
      hint.classList.remove('error', 'success');
      try {
        await LC.auth.resetPassword(email.value, password.value);
        hint.classList.add('success');
        hint.textContent = 'Mot de passe réinitialisé. Vous pouvez vous connecter.';
      } catch (err) {
        hint.classList.add('error');
        hint.textContent = err.message;
      }
    });

    return { el };
  }

  /* ============================ MENU PRINCIPAL ============================ */
  function menuScreen() {
    applyMotionPref();
    const user = LC.auth.current();
    const stars = LC.save.totalStars(user.email);
    const rank = LC.save.rank(user.email);
    const levelIds = LC.game.LEVELS.map(l => l.id);
    const next = LC.save.nextLevel(user.email, levelIds);
    const hasProgress = LC.save.hasProgress(user.email);

    const { el, peeps } = authScene(`
      <div class="player-strip">
        <span><span class="pseudo">${escapeHtml(user.pseudo)}</span> · Niveau ${rank}</span>
        <span class="badge-stars">★ ${stars}</span>
      </div>
      <h1>Les Curieux</h1>
      <p class="subtitle">Traversez la nuit sans vous faire remarquer.</p>
      <div class="menu-actions">
        <button class="btn" data-go="/game/${hasProgress ? levelIds[0] : next}">Jouer</button>
        ${hasProgress ? `<button class="btn-ghost" data-go="/game/${next}">Continuer — niveau ${next}</button>` : ''}
        <div class="menu-grid">
          <button class="btn-ghost" data-go="/levels">Niveaux</button>
          <button class="btn-ghost" data-go="/profile">Profil</button>
          <button class="btn-ghost" data-go="/settings">Paramètres</button>
        </div>
      </div>
      <div class="menu-foot"><button class="btn-link" id="logout">Se déconnecter</button></div>`);

    el.querySelector('.card').classList.add('menu-card');
    peeps.setState('hello');
    setTimeout(() => peeps.setState('idle'), 1400);

    el.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) LC.router.go(go.dataset.go);
    });
    el.querySelector('#logout').addEventListener('click', () => {
      LC.auth.logout();
      LC.router.go('/login');
    });

    return { el };
  }

  /* ========================= SÉLECTION DES NIVEAUX ========================= */
  function levelsScreen() {
    const user = LC.auth.current();
    const data = LC.save.load(user.email);

    const rows = LC.game.LEVELS.map((lv, i) => {
      const prev = i === 0 ? null : LC.game.LEVELS[i - 1];
      const locked = prev ? !(data.levels[prev.id] && data.levels[prev.id].stars) : false;
      const rec = data.levels[lv.id];
      const stars = rec ? rec.stars : 0;
      const starsHtml = [1, 2, 3].map(n => `<span class="${n <= stars ? '' : 'off'}">★</span>`).join('');
      const sub = locked
        ? `Terminez « ${prev.name} » pour déverrouiller`
        : (rec && rec.bestTime != null ? `Meilleur temps : ${formatTime(rec.bestTime)}` : 'Jamais exploré');
      return `
        <button class="level-row" data-level="${lv.id}" ${locked ? 'disabled' : ''}>
          <span><span class="lv-name">${lv.id}. ${lv.name}</span><span class="lv-sub">${sub}</span></span>
          <span class="lv-stars">${starsHtml}</span>
        </button>`;
    }).join('');

    const el = make('screen', `
      <div class="scene"><div class="card">
        <div class="back-row"><button class="btn-link" data-go="/menu">← Menu</button></div>
        <h1>Niveaux</h1>
        <p class="subtitle">Chaque traversée discrète vaut jusqu'à trois étoiles.</p>
        <div class="levels-list">${rows}</div>
      </div></div>`);

    el.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) { LC.router.go(go.dataset.go); return; }
      const row = e.target.closest('.level-row');
      if (row && !row.disabled) LC.router.go('/game/' + row.dataset.level);
    });

    return { el };
  }

  /* ============================ PROFIL ============================ */
  function profileScreen() {
    const user = LC.auth.current();
    const data = LC.save.load(user.email);
    const stars = LC.save.totalStars(user.email);
    const unlocked = LC.save.unlockedSkins(user.email);
    const completed = Object.values(data.levels).filter(l => l.stars > 0).length;

    const skinChips = LC.save.SKINS.map(s => {
      const isUnlocked = unlocked.some(u => u.id === s.id);
      const active = data.skin === s.id;
      return `
        <button class="skin-chip ${active ? 'active' : ''}" data-skin="${s.id}" ${isUnlocked ? '' : 'disabled'}
                title="${isUnlocked ? 'Choisir cette apparence' : `Débloquée à ${s.cost} ★`}">
          <span class="skin-dot" style="background:${s.color}; color:${s.color}"></span>
          ${s.name}${isUnlocked ? '' : ` · ${s.cost}★`}
        </button>`;
    }).join('');

    const levelRows = LC.game.LEVELS.map(lv => {
      const rec = data.levels[lv.id];
      const v = rec ? `${'★'.repeat(rec.stars)} · ${formatTime(rec.bestTime)}` : '—';
      return `<div class="stat-row"><span class="k">${lv.id}. ${lv.name}</span><span class="v">${v}</span></div>`;
    }).join('');

    const el = make('screen', `
      <div class="scene"><div class="card">
        <div class="back-row"><button class="btn-link" data-go="/menu">← Menu</button></div>
        <h1>${escapeHtml(user.pseudo)}</h1>
        <p class="subtitle">${escapeHtml(user.email)} · Niveau ${LC.save.rank(user.email)} · ★ ${stars}</p>
        <div class="stat-rows">
          <div class="stat-row"><span class="k">Niveaux terminés</span><span class="v">${completed} / ${LC.game.LEVELS.length}</span></div>
          ${levelRows}
        </div>
        <p class="subtitle" style="margin-bottom:10px">Apparence de votre étoile</p>
        <div class="skin-list">${skinChips}</div>
        <button class="btn-ghost" id="logout">Se déconnecter</button>
      </div></div>`);

    el.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) { LC.router.go(go.dataset.go); return; }
      const chip = e.target.closest('.skin-chip');
      if (chip && !chip.disabled) {
        LC.save.setSkin(user.email, chip.dataset.skin);
        el.querySelectorAll('.skin-chip').forEach(c => c.classList.toggle('active', c === chip));
      }
    });
    el.querySelector('#logout').addEventListener('click', () => {
      LC.auth.logout();
      LC.router.go('/login');
    });

    return { el };
  }

  /* ============================ PARAMÈTRES ============================ */
  function settingsScreen() {
    const user = LC.auth.current();
    const settings = LC.save.load(user.email).settings;

    const el = make('screen', `
      <div class="scene"><div class="card">
        <div class="back-row"><button class="btn-link" data-go="/menu">← Menu</button></div>
        <h1>Paramètres</h1>
        <p class="subtitle">Réglages enregistrés avec votre compte.</p>
        <label class="switch-row">
          <span>Champs de vision discrets<span class="sw-sub">N'affiche que le contour du regard des Curieux</span></span>
          <input type="checkbox" class="switch" id="subtleVision" ${settings.subtleVision ? 'checked' : ''}>
        </label>
        <label class="switch-row">
          <span>Réduire les animations<span class="sw-sub">Limite les mouvements du décor et des menus</span></span>
          <input type="checkbox" class="switch" id="reducedMotion" ${settings.reducedMotion ? 'checked' : ''}>
        </label>
        <div class="stat-row" style="margin-top:8px"><span class="k">Déplacement</span><span class="v">Flèches · ZQSD · WASD · joystick tactile</span></div>
        <div class="stat-row" style="margin-top:8px"><span class="k">Distraction</span><span class="v">Clic / tap dans le niveau : petit bruit</span></div>
      </div></div>`);

    el.addEventListener('click', (e) => {
      const go = e.target.closest('[data-go]');
      if (go) LC.router.go(go.dataset.go);
    });
    el.querySelector('#subtleVision').addEventListener('change', (e) => {
      LC.save.setSetting(user.email, 'subtleVision', e.target.checked);
    });
    el.querySelector('#reducedMotion').addEventListener('change', (e) => {
      LC.save.setSetting(user.email, 'reducedMotion', e.target.checked);
      applyMotionPref();
    });

    return { el };
  }

  /* ---------- utilitaires ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function formatTime(seconds) {
    if (seconds == null) return '—';
    const m = Math.floor(seconds / 60);
    const s = (seconds % 60).toFixed(1).padStart(4, '0');
    return `${String(m).padStart(2, '0')}:${s}`;
  }

  return { loginScreen, registerScreen, forgotScreen, menuScreen, levelsScreen, profileScreen, settingsScreen, formatTime };
})();

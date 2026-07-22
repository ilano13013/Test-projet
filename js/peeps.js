/* Composant réutilisable : les trois silhouettes curieuses.
   Utilisé sur l'écran de connexion, la création de compte et le menu. */
window.LC = window.LC || {};

LC.peeps = (function () {
  const SVG_PEEP_1 = `
    <div class="peep peep-1">
      <svg width="110" height="120" viewBox="0 0 110 120">
        <path d="M15 120 C15 85 40 72 55 72 C70 72 95 85 95 120 Z" fill="var(--silhouette)"/>
        <g class="head">
          <circle cx="55" cy="42" r="30" fill="var(--silhouette)"/>
          <path d="M40 16 Q47 6 58 12 Q52 12 50 18 Z" fill="var(--silhouette)"/>
          <g class="face">
            <path class="brow" d="M36 26 Q42 22 48 25" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path class="brow" d="M62 25 Q68 22 74 26" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <ellipse class="eye eye-l" cx="42" cy="38" rx="8" ry="9" fill="#fff"/>
            <ellipse class="eye eye-r" cx="68" cy="38" rx="8" ry="9" fill="#fff"/>
            <circle class="pupil" cx="42" cy="38" r="3.6" fill="var(--silhouette)"/>
            <circle class="pupil" cx="68" cy="38" r="3.6" fill="var(--silhouette)"/>
            <path class="lid" d="M34 38 Q42 43 50 38" stroke="#fff" stroke-width="2.5" fill="var(--silhouette)" stroke-linecap="round"/>
            <path class="lid" d="M60 38 Q68 43 76 38" stroke="#fff" stroke-width="2.5" fill="var(--silhouette)" stroke-linecap="round"/>
          </g>
          <g class="hands">
            <circle cx="40" cy="40" r="12" fill="var(--silhouette)" stroke="#3a3f5c" stroke-width="2"/>
            <circle cx="70" cy="40" r="12" fill="var(--silhouette)" stroke="#3a3f5c" stroke-width="2"/>
          </g>
        </g>
      </svg>
    </div>`;

  const SVG_PEEP_2 = `
    <div class="peep peep-2">
      <svg width="120" height="140" viewBox="0 0 120 140">
        <path d="M18 140 C18 100 45 86 60 86 C75 86 102 100 102 140 Z" fill="var(--silhouette)"/>
        <g class="head">
          <circle cx="60" cy="50" r="34" fill="var(--silhouette)"/>
          <path d="M44 20 Q56 8 74 18 Q62 16 58 24 Z" fill="var(--silhouette)"/>
          <g class="face">
            <path class="brow" d="M40 32 Q46 28 53 31" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path class="brow" d="M67 31 Q74 28 80 32" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <ellipse class="eye eye-l" cx="46" cy="46" rx="9" ry="10" fill="#fff"/>
            <ellipse class="eye eye-r" cx="74" cy="46" rx="9" ry="10" fill="#fff"/>
            <circle class="pupil" cx="46" cy="46" r="4" fill="var(--silhouette)"/>
            <circle class="pupil" cx="74" cy="46" r="4" fill="var(--silhouette)"/>
          </g>
        </g>
      </svg>
    </div>`;

  const SVG_PEEP_3 = `
    <div class="peep peep-3">
      <svg width="110" height="120" viewBox="0 0 110 120">
        <path d="M15 120 C15 85 40 72 55 72 C70 72 95 85 95 120 Z" fill="var(--silhouette)"/>
        <g class="head">
          <circle cx="55" cy="42" r="30" fill="var(--silhouette)"/>
          <path d="M52 12 Q64 4 72 14 Q63 12 60 18 Z" fill="var(--silhouette)"/>
          <g class="face">
            <path class="brow" d="M36 26 Q42 22 48 25" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <path class="brow" d="M62 25 Q68 22 74 26" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/>
            <ellipse class="eye eye-l" cx="42" cy="38" rx="8" ry="9" fill="#fff"/>
            <ellipse class="eye eye-r" cx="68" cy="38" rx="8" ry="9" fill="#fff"/>
            <circle class="pupil" cx="42" cy="38" r="3.6" fill="var(--silhouette)"/>
            <circle class="pupil" cx="68" cy="38" r="3.6" fill="var(--silhouette)"/>
          </g>
          <text class="note" x="88" y="20" font-size="14" fill="#fff">♪</text>
          <text class="note" x="96" y="34" font-size="11" fill="#fff" style="animation-delay:.8s">♫</text>
        </g>
      </svg>
    </div>`;

  const STATES = ['state-email', 'state-password', 'state-reveal', 'state-hello'];

  function create() {
    const el = document.createElement('div');
    el.className = 'peeps';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = SVG_PEEP_1 + SVG_PEEP_2 + SVG_PEEP_3;
    const pupils = el.querySelectorAll('.pupil');

    return {
      el,
      setState(state) {
        el.classList.remove(...STATES);
        if (state && state !== 'idle') el.classList.add('state-' + state);
      },
      trackEyes(input) {
        const ratio = Math.min(input.value.length / 24, 1);
        const x = -4 + ratio * 8;
        const y = document.activeElement === input ? 4 : 0;
        pupils.forEach(p => { p.style.transform = `translate(${x}px, ${y}px)`; });
      },
      resetEyes() {
        pupils.forEach(p => { p.style.transform = 'translate(0px, 0px)'; });
      },
    };
  }

  /* Branche les réactions des silhouettes sur un formulaire :
     emailInputs = champs "lus" (e-mail, pseudo…), passInput + toggleBtn = mot de passe. */
  function bindForm(peeps, { emailInputs = [], passInput, toggleBtn, iconShow, iconHide, hintEl, hints = {} }) {
    let revealed = false;

    function currentState() {
      if (revealed) return 'reveal';
      if (passInput && document.activeElement === passInput) return 'password';
      if (emailInputs.includes(document.activeElement)) return 'email';
      return 'idle';
    }
    function refresh() {
      const s = currentState();
      peeps.setState(s);
      if (hintEl && !hintEl.dataset.locked) {
        hintEl.classList.remove('error', 'success');
        hintEl.textContent = hints[s] || '';
      }
    }

    emailInputs.forEach(inp => {
      inp.addEventListener('focus', () => { refresh(); peeps.trackEyes(inp); });
      inp.addEventListener('input', () => peeps.trackEyes(inp));
      inp.addEventListener('blur', () => { refresh(); peeps.resetEyes(); });
    });

    if (passInput) {
      passInput.addEventListener('focus', () => { refresh(); if (!revealed) peeps.trackEyes(passInput); });
      passInput.addEventListener('input', () => { if (!revealed) peeps.trackEyes(passInput); });
      passInput.addEventListener('blur', () => { refresh(); if (!revealed) peeps.resetEyes(); });
    }

    if (toggleBtn && passInput) {
      toggleBtn.addEventListener('click', () => {
        revealed = !revealed;
        passInput.type = revealed ? 'text' : 'password';
        if (iconShow) iconShow.style.display = revealed ? 'none' : '';
        if (iconHide) iconHide.style.display = revealed ? '' : 'none';
        toggleBtn.setAttribute('aria-label', revealed ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
        refresh();
        if (revealed) peeps.resetEyes(); else if (document.activeElement === passInput) peeps.trackEyes(passInput);
        passInput.focus();
      });
    }

    return { refresh, isRevealed: () => revealed };
  }

  return { create, bindForm };
})();

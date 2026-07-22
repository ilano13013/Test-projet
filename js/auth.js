/* Authentification locale (démo sans serveur).
   Les comptes vivent dans localStorage ; les mots de passe ne sont JAMAIS
   stockés en clair : dérivation PBKDF2-SHA256 (Web Crypto) avec sel aléatoire
   par compte. Note honnête : sans backend, cela protège le stockage local
   mais ne remplace pas une vraie authentification côté serveur. */
window.LC = window.LC || {};

LC.auth = (function () {
  const USERS_KEY = 'lescurieux.users';
  const SESSION_KEY = 'lescurieux.session';
  const ITERATIONS = 120000;
  const enc = new TextEncoder();

  function readUsers() {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || {}; }
    catch { return {}; }
  }
  function writeUsers(users) {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }

  function bufToHex(buf) {
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  function hexToBuf(hex) {
    return new Uint8Array(hex.match(/.{2}/g).map(h => parseInt(h, 16)));
  }
  function randomSalt() {
    return bufToHex(crypto.getRandomValues(new Uint8Array(16)));
  }

  async function derive(password, saltHex, iterations) {
    if (crypto.subtle) {
      const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', hash: 'SHA-256', salt: hexToBuf(saltHex), iterations },
        key, 256
      );
      return bufToHex(bits);
    }
    // Repli pour contextes sans Web Crypto (jamais de clair pour autant).
    let h1 = 0x811c9dc5, h2 = 0x9e3779b9;
    const s = saltHex + password + saltHex;
    for (let r = 0; r < 5000; r++) {
      for (let i = 0; i < s.length; i++) {
        h1 = Math.imul(h1 ^ s.charCodeAt(i), 0x01000193) >>> 0;
        h2 = Math.imul(h2 + s.charCodeAt(i) + (h1 & 0xffff), 0x85ebca6b) >>> 0;
      }
    }
    return 'weak-' + h1.toString(16) + h2.toString(16);
  }

  function normEmail(email) { return String(email || '').trim().toLowerCase(); }

  function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email); }

  async function register({ pseudo, email, password }) {
    pseudo = String(pseudo || '').trim();
    const key = normEmail(email);
    if (pseudo.length < 2) throw new Error('Choisissez un pseudonyme d’au moins 2 caractères.');
    if (!validEmail(key)) throw new Error('Cette adresse e-mail ne semble pas valide.');
    if ((password || '').length < 6) throw new Error('Le mot de passe doit faire au moins 6 caractères.');
    const users = readUsers();
    if (users[key]) throw new Error('Un compte existe déjà avec cette adresse.');
    const salt = randomSalt();
    const hash = await derive(password, salt, ITERATIONS);
    users[key] = { pseudo, email: key, salt, hash, iterations: ITERATIONS, created: Date.now() };
    writeUsers(users);
    setSession(key);
    return users[key];
  }

  async function login(email, password) {
    const key = normEmail(email);
    const users = readUsers();
    const user = users[key];
    if (!user) throw new Error('Aucun compte ne correspond à cette adresse.');
    const hash = await derive(password || '', user.salt, user.iterations);
    if (hash !== user.hash) throw new Error('Mot de passe incorrect.');
    setSession(key);
    return user;
  }

  /* Réinitialisation "mot de passe oublié" — en mode démo locale, sans e-mail
     sortant, on autorise la définition d’un nouveau mot de passe. */
  async function resetPassword(email, newPassword) {
    const key = normEmail(email);
    const users = readUsers();
    const user = users[key];
    if (!user) throw new Error('Aucun compte ne correspond à cette adresse.');
    if ((newPassword || '').length < 6) throw new Error('Le mot de passe doit faire au moins 6 caractères.');
    user.salt = randomSalt();
    user.hash = await derive(newPassword, user.salt, ITERATIONS);
    user.iterations = ITERATIONS;
    writeUsers(users);
    return user;
  }

  function setSession(emailKey) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ email: emailKey, at: Date.now() }));
  }

  function current() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY));
      if (!s || !s.email) return null;
      return readUsers()[s.email] || null;
    } catch { return null; }
  }

  function logout() { localStorage.removeItem(SESSION_KEY); }

  return { register, login, resetPassword, current, logout };
})();

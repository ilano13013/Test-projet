/* Sauvegarde de progression, associée au compte connecté (clé par e-mail). */
window.LC = window.LC || {};

LC.save = (function () {
  const PREFIX = 'lescurieux.save.';

  const SKINS = [
    { id: 'lumiere', name: 'Lumière', color: '#ffffff', cost: 0 },
    { id: 'braise', name: 'Braise', color: '#ffb45b', cost: 3 },
    { id: 'aurore', name: 'Aurore', color: '#7ef0d4', cost: 6 },
    { id: 'nebuleuse', name: 'Nébuleuse', color: '#ff9ad5', cost: 9 },
  ];

  function defaults() {
    return {
      levels: {},          // { [id]: { stars, bestTime, completions } }
      skin: 'lumiere',
      settings: { subtleVision: false, reducedMotion: false },
    };
  }

  function load(email) {
    try {
      const data = JSON.parse(localStorage.getItem(PREFIX + email));
      return Object.assign(defaults(), data, {
        levels: (data && data.levels) || {},
        settings: Object.assign(defaults().settings, data && data.settings),
      });
    } catch { return defaults(); }
  }

  function store(email, data) {
    localStorage.setItem(PREFIX + email, JSON.stringify(data));
  }

  function recordResult(email, levelId, { stars, time, detections }) {
    const data = load(email);
    const prev = data.levels[levelId] || { stars: 0, bestTime: null, completions: 0 };
    data.levels[levelId] = {
      stars: Math.max(prev.stars, stars),
      bestTime: prev.bestTime == null ? time : Math.min(prev.bestTime, time),
      completions: prev.completions + 1,
      lastDetections: detections,
    };
    store(email, data);
    return data;
  }

  function totalStars(email) {
    const data = load(email);
    return Object.values(data.levels).reduce((sum, l) => sum + (l.stars || 0), 0);
  }

  function rank(email) {
    return 1 + Math.floor(totalStars(email) / 3);
  }

  function unlockedSkins(email) {
    const stars = totalStars(email);
    return SKINS.filter(s => stars >= s.cost);
  }

  function setSkin(email, skinId) {
    const data = load(email);
    if (unlockedSkins(email).some(s => s.id === skinId)) {
      data.skin = skinId;
      store(email, data);
    }
    return data;
  }

  function setSetting(email, key, value) {
    const data = load(email);
    data.settings[key] = value;
    store(email, data);
    return data;
  }

  function skinColor(email) {
    const data = load(email);
    const skin = SKINS.find(s => s.id === data.skin) || SKINS[0];
    return skin.color;
  }

  /* Prochain niveau à jouer : premier non terminé, sinon le premier. */
  function nextLevel(email, levelIds) {
    const data = load(email);
    for (const id of levelIds) {
      if (!data.levels[id] || !data.levels[id].stars) return id;
    }
    return levelIds[0];
  }

  function hasProgress(email) {
    return Object.keys(load(email).levels).length > 0;
  }

  return { SKINS, load, store, recordResult, totalStars, rank, unlockedSkins, setSkin, setSetting, skinColor, nextLevel, hasProgress };
})();

/* Sauvegarde de progression (v2), associée au compte connecté.
   Progression par monde/niveau : étoiles, meilleur temps, détections min,
   fragments, objectifs. Plus : mondes débloqués, apparences, réglages,
   remappage des touches, fantômes personnels. Stockée dans localStorage. */
window.LC = window.LC || {};

LC.save = (function () {
  const PREFIX = 'lescurieux.save.';

  const SKINS = [
    { id: 'lumiere', name: 'Lumière', color: '#ffffff', cost: 0 },
    { id: 'braise', name: 'Braise', color: '#ffb45b', cost: 6 },
    { id: 'aurore', name: 'Aurore', color: '#7ef0d4', cost: 12 },
    { id: 'nebuleuse', name: 'Nébuleuse', color: '#ff9ad5', cost: 20 },
  ];

  const DEFAULT_KEYBINDS = {
    up: ['ArrowUp', 'KeyW', 'KeyZ'],
    down: ['ArrowDown', 'KeyS'],
    left: ['ArrowLeft', 'KeyA', 'KeyQ'],
    right: ['ArrowRight', 'KeyD'],
    sprint: ['ShiftLeft', 'ShiftRight'],
    noise: ['Space', 'KeyE'],
    pause: ['Escape', 'KeyP'],
  };

  function defaults() {
    return {
      version: 2,
      unlockedWorld: 1,
      worlds: {},          // { [worldId]: { levels: { [levelId]: record } } }
      ghosts: {},          // { [levelId]: [ {t,x,y} ] }
      skin: 'lumiere',
      settings: { subtleVision: false, reducedMotion: false, disableShake: false, hideCones: false },
      keybinds: null,      // null → DEFAULT_KEYBINDS
    };
  }

  function load(email) {
    let data;
    try { data = JSON.parse(localStorage.getItem(PREFIX + email)); } catch { data = null; }
    const base = defaults();
    if (!data) return base;
    // migration douce depuis la v1 (levels à plat) si présente
    if (data.version !== 2 && data.levels) {
      base.worlds['1'] = { levels: {} };
      for (const [k, v] of Object.entries(data.levels)) base.worlds['1'].levels['1-' + k] = v;
    }
    return {
      ...base, ...data,
      worlds: data.worlds || base.worlds,
      ghosts: data.ghosts || {},
      settings: Object.assign(base.settings, data.settings),
    };
  }

  function store(email, data) { localStorage.setItem(PREFIX + email, JSON.stringify(data)); }

  function levelRec(data, levelId) {
    const wid = levelId.split('-')[0];
    return (data.worlds[wid] && data.worlds[wid].levels[levelId]) || null;
  }

  function recordResult(email, levelId, { stars, time, detections, fragments, total, objectives }) {
    const data = load(email);
    const wid = levelId.split('-')[0];
    data.worlds[wid] = data.worlds[wid] || { levels: {} };
    const prev = data.worlds[wid].levels[levelId] || { stars: 0, bestTime: null, minDetections: null, fragments: 0, completions: 0, objectives: {} };
    data.worlds[wid].levels[levelId] = {
      stars: Math.max(prev.stars, stars),
      bestTime: prev.bestTime == null ? time : Math.min(prev.bestTime, time),
      minDetections: prev.minDetections == null ? detections : Math.min(prev.minDetections, detections),
      fragments: Math.max(prev.fragments, fragments),
      total,
      completions: prev.completions + 1,
      objectives: Object.assign({}, prev.objectives, objectives),
    };
    // déblocage du monde suivant si le monde courant est intégralement terminé
    maybeUnlockNextWorld(data, wid);
    store(email, data);
    return data;
  }

  function maybeUnlockNextWorld(data, wid) {
    const world = LC.levels.getWorld(wid);
    if (!world) return;
    const done = world.levels.every(l => data.worlds[wid] && data.worlds[wid].levels[l.id] && data.worlds[wid].levels[l.id].stars > 0);
    if (done) data.unlockedWorld = Math.max(data.unlockedWorld, Number(wid) + 1);
  }

  function getLevelRecord(email, levelId) { return levelRec(load(email), levelId); }

  function isLevelUnlocked(email, levelId) {
    const world = LC.levels.getWorld(levelId.split('-')[0]);
    if (!world) return false;
    const idx = world.levels.findIndex(l => l.id === levelId);
    if (idx <= 0) return true;                     // 1er niveau toujours ouvert
    const prev = world.levels[idx - 1];
    const rec = getLevelRecord(email, prev.id);
    return !!(rec && rec.stars > 0);
  }

  function isWorldUnlocked(email, worldId) { return Number(worldId) <= load(email).unlockedWorld; }

  function totalStars(email) {
    const data = load(email);
    let sum = 0;
    for (const w of Object.values(data.worlds)) for (const l of Object.values(w.levels)) sum += l.stars || 0;
    return sum;
  }
  function worldStars(email, worldId) {
    const w = load(email).worlds[worldId];
    if (!w) return 0;
    return Object.values(w.levels).reduce((s, l) => s + (l.stars || 0), 0);
  }
  function rank(email) { return 1 + Math.floor(totalStars(email) / 3); }

  function unlockedSkins(email) { const s = totalStars(email); return SKINS.filter(k => s >= k.cost); }
  function setSkin(email, id) { const d = load(email); if (unlockedSkins(email).some(s => s.id === id)) { d.skin = id; store(email, d); } return d; }
  function skinColor(email) { const d = load(email); return (SKINS.find(s => s.id === d.skin) || SKINS[0]).color; }

  function setSetting(email, key, val) { const d = load(email); d.settings[key] = val; store(email, d); return d; }

  function getKeybinds(email) { const d = load(email); return d.keybinds || JSON.parse(JSON.stringify(DEFAULT_KEYBINDS)); }
  function setKeybind(email, action, codes) {
    const d = load(email);
    d.keybinds = d.keybinds || JSON.parse(JSON.stringify(DEFAULT_KEYBINDS));
    d.keybinds[action] = codes;
    store(email, d);
    return d;
  }
  function resetKeybinds(email) { const d = load(email); d.keybinds = null; store(email, d); return d; }

  function saveGhost(email, levelId, traj) {
    const d = load(email);
    // sous-échantillonne pour limiter la taille
    d.ghosts[levelId] = traj.filter((_, i) => i % 2 === 0);
    store(email, d);
  }
  function getGhost(email, levelId) { return load(email).ghosts[levelId] || null; }

  /* prochain niveau non terminé de tout le jeu (campagne) */
  function nextUnfinished(email) {
    for (const w of LC.levels.WORLDS) {
      for (const l of w.levels) {
        const rec = getLevelRecord(email, l.id);
        if (!rec || !rec.stars) return l.id;
      }
    }
    return LC.levels.WORLDS[0].levels[0].id;
  }
  function hasProgress(email) {
    const d = load(email);
    return Object.values(d.worlds).some(w => Object.keys(w.levels).length > 0);
  }

  return {
    SKINS, DEFAULT_KEYBINDS, load, store, recordResult, getLevelRecord,
    isLevelUnlocked, isWorldUnlocked, totalStars, worldStars, rank,
    unlockedSkins, setSkin, skinColor, setSetting,
    getKeybinds, setKeybind, resetKeybinds, saveGhost, getGhost,
    nextUnfinished, hasProgress,
  };
})();

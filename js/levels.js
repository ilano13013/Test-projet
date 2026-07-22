/* Configuration des niveaux — externalisée (aucune logique de jeu ici).
   Architecture extensible : 5 mondes × 10 niveaux prévus. Ce fichier définit
   le Monde 1 (10 niveaux + boss). Un niveau ne décrit que des DONNÉES ;
   c'est le moteur (engine.js) qui les interprète.

   Schéma d'un niveau :
   {
     id, world, index, name,
     size:      { w, h },              // dimensions logiques (caméra si > écran)
     start:     { x, y },
     exit:      { x, y, w, h, needs? }, // needs: nb de fragments requis pour ouvrir
     targetTime:  secondes (seuil 3 étoiles),
     hearts:      cœurs de départ (défaut 3),
     walls:     [ { x, y, w, h } ],    // obstacles / cachettes
     fragments: [ { x, y } ],
     switches:  [ { id, x, y, opens:[doorId] } ],
     doors:     [ { id, x, y, w, h } ],// fermées tant que l'interrupteur n'est pas pris
     enemies:   [ voir enemy.js ],
     objectives:[ { id, label, type } ],// objectifs secondaires
     tutorials: [ { at, text, x?, y? } ],// 'start' | zone {x,y,r} | temps
     hideCones:  bool,                  // masque les cônes (niveaux avancés)
     boss:       config de boss éventuelle
   }
*/
window.LC = window.LC || {};

LC.levels = (function () {
  const V = (range, angle) => ({ range, angle });

  const world1 = {
    id: 1,
    name: 'Le Vestibule',
    subtitle: 'Là où les Curieux apprennent à vous connaître.',
    color: '#5b6cff',
    levels: [
      /* ---------------- 1-3 : déplacements, Guetteur, cachettes ---------------- */
      {
        id: '1-1', world: 1, index: 1, name: 'Premiers pas',
        size: { w: 900, h: 560 }, start: { x: 70, y: 480 },
        exit: { x: 820, y: 60, w: 44, h: 80 }, targetTime: 22, hearts: 3,
        walls: [{ x: 360, y: 240, w: 44, h: 200 }, { x: 560, y: 130, w: 44, h: 200 }],
        fragments: [{ x: 470, y: 300 }],
        enemies: [
          { type: 'guetteur', x: 450, y: 70, angle: Math.PI / 2, vision: V(300, 0.8), sweep: { base: Math.PI / 2, amp: 0.7, speed: 0.6 } },
        ],
        objectives: [{ id: 'frag', label: 'Récupérer le fragment', type: 'allFragments' }],
        tutorials: [
          { at: 'start', text: 'Flèches, ZQSD ou WASD pour déplacer votre étoile. Atteignez la porte SORTIE.' },
          { at: { x: 470, y: 300, r: 120 }, text: 'Ramassez les fragments : ils comptent pour la 3ᵉ étoile.' },
        ],
      },
      {
        id: '1-2', world: 1, index: 2, name: 'Le Guetteur',
        size: { w: 960, h: 600 }, start: { x: 70, y: 520 },
        exit: { x: 890, y: 460, w: 44, h: 80 }, targetTime: 28, hearts: 3,
        walls: [
          { x: 200, y: 380, w: 180, h: 44 }, { x: 470, y: 200, w: 44, h: 220 },
          { x: 640, y: 380, w: 200, h: 44 },
        ],
        fragments: [{ x: 300, y: 200 }, { x: 740, y: 200 }],
        enemies: [
          { type: 'guetteur', x: 480, y: 70, angle: Math.PI / 2, vision: V(340, 0.85), sweep: { base: Math.PI / 2, amp: 1.1, speed: 0.5 } },
        ],
        objectives: [{ id: 'frag', label: 'Récupérer les 2 fragments', type: 'allFragments' }],
        tutorials: [
          { at: 'start', text: 'Le Guetteur balaie la salle et vous suit s’il vous voit. Restez derrière les blocs.' },
        ],
      },
      {
        id: '1-3', world: 1, index: 3, name: 'Cache-cache',
        size: { w: 1000, h: 620 }, start: { x: 60, y: 60 },
        exit: { x: 920, y: 500, w: 44, h: 80 }, targetTime: 35, hearts: 3,
        walls: [
          { x: 180, y: 150, w: 44, h: 320 }, { x: 340, y: 150, w: 44, h: 200 },
          { x: 500, y: 300, w: 44, h: 280 }, { x: 660, y: 120, w: 44, h: 300 },
          { x: 820, y: 300, w: 44, h: 220 },
        ],
        fragments: [{ x: 260, y: 520 }, { x: 590, y: 90 }, { x: 900, y: 120 }],
        enemies: [
          { type: 'guetteur', x: 420, y: 560, angle: -Math.PI / 2, vision: V(360, 0.7), sweep: { base: -Math.PI / 2, amp: 0.9, speed: 0.7 } },
          { type: 'guetteur', x: 760, y: 560, angle: -Math.PI / 2, vision: V(320, 0.7), sweep: { base: -Math.PI / 2, amp: 0.8, speed: 0.55 } },
        ],
        objectives: [{ id: 'frag', label: 'Récupérer les 3 fragments', type: 'allFragments' }],
        tutorials: [{ at: 'start', text: 'Deux Guetteurs. Utilisez les colonnes comme cachettes et avancez au bon rythme.' }],
      },

      /* ---------------- 4-6 : Distrait, bruit, objectifs secondaires ---------------- */
      {
        id: '1-4', world: 1, index: 4, name: 'Le Distrait',
        size: { w: 960, h: 600 }, start: { x: 70, y: 300 },
        exit: { x: 890, y: 260, w: 44, h: 80 }, targetTime: 30, hearts: 3,
        walls: [{ x: 300, y: 120, w: 44, h: 160 }, { x: 300, y: 340, w: 44, h: 160 }, { x: 620, y: 220, w: 44, h: 200 }],
        fragments: [{ x: 470, y: 120 }, { x: 470, y: 480 }],
        enemies: [
          { type: 'distrait', x: 480, y: 300, angle: 0, vision: V(280, 0.95), sweep: { base: 0, amp: 2.6, speed: 0.5 } },
        ],
        objectives: [
          { id: 'frag', label: 'Récupérer les 2 fragments', type: 'allFragments' },
          { id: 'time', label: 'Terminer sous le temps cible', type: 'underTime' },
        ],
        tutorials: [
          { at: 'start', text: 'Cliquez / tapez pour faire un bruit. Le Distrait ira voir : profitez-en pour passer.' },
        ],
      },
      {
        id: '1-5', world: 1, index: 5, name: 'Faux bruits',
        size: { w: 1040, h: 620 }, start: { x: 60, y: 540 },
        exit: { x: 960, y: 70, w: 44, h: 80 }, targetTime: 40, hearts: 3,
        walls: [
          { x: 220, y: 200, w: 200, h: 44 }, { x: 220, y: 200, w: 44, h: 240 },
          { x: 560, y: 120, w: 44, h: 260 }, { x: 700, y: 360, w: 240, h: 44 },
        ],
        fragments: [{ x: 140, y: 200 }, { x: 500, y: 500 }, { x: 900, y: 200 }],
        enemies: [
          { type: 'distrait', x: 380, y: 480, angle: -Math.PI / 2, vision: V(300, 0.9), sweep: { base: -Math.PI / 2, amp: 1.6, speed: 0.6 } },
          { type: 'guetteur', x: 760, y: 120, angle: Math.PI / 2, vision: V(340, 0.75), sweep: { base: Math.PI / 2, amp: 0.9, speed: 0.5 } },
        ],
        objectives: [
          { id: 'frag', label: 'Récupérer les 3 fragments', type: 'allFragments' },
          { id: 'noDetect', label: 'Aucune détection', type: 'noDetect' },
        ],
        tutorials: [{ at: 'start', text: 'Un bruit a un temps de recharge : choisissez le bon moment.' }],
      },
      {
        id: '1-6', world: 1, index: 6, name: 'Le sprint',
        size: { w: 1100, h: 600 }, start: { x: 60, y: 300 },
        exit: { x: 1020, y: 260, w: 44, h: 80 }, targetTime: 26, hearts: 3,
        walls: [
          { x: 260, y: 0, w: 44, h: 240 }, { x: 260, y: 360, w: 44, h: 240 },
          { x: 520, y: 160, w: 44, h: 280 }, { x: 780, y: 0, w: 44, h: 240 }, { x: 780, y: 360, w: 44, h: 240 },
        ],
        fragments: [{ x: 400, y: 90 }, { x: 660, y: 510 }, { x: 920, y: 90 }],
        enemies: [
          { type: 'guetteur', x: 400, y: 300, angle: 0, vision: V(240, 1.0), sweep: { base: 0, amp: 1.4, speed: 0.9 } },
          { type: 'distrait', x: 660, y: 300, angle: Math.PI, vision: V(260, 0.95), sweep: { base: Math.PI, amp: 1.2, speed: 0.7 } },
          { type: 'guetteur', x: 920, y: 300, angle: Math.PI, vision: V(240, 1.0), sweep: { base: Math.PI, amp: 1.4, speed: 0.9 } },
        ],
        objectives: [
          { id: 'time', label: 'Battre le temps cible', type: 'underTime' },
          { id: 'frag', label: 'Récupérer les 3 fragments', type: 'allFragments' },
        ],
        tutorials: [{ at: 'start', text: 'Maj (Shift) pour sprinter : plus rapide, mais plus bruyant et plus visible. L’endurance est limitée.' }],
      },

      /* ---------------- 7-9 : Méfiant, combinaisons, interrupteurs ---------------- */
      {
        id: '1-7', world: 1, index: 7, name: 'Le Méfiant',
        size: { w: 1000, h: 640 }, start: { x: 60, y: 60 },
        exit: { x: 920, y: 540, w: 44, h: 80 }, targetTime: 40, hearts: 3,
        walls: [
          { x: 200, y: 160, w: 300, h: 44 }, { x: 200, y: 160, w: 44, h: 240 },
          { x: 560, y: 300, w: 300, h: 44 }, { x: 560, y: 344, w: 44, h: 240 },
        ],
        fragments: [{ x: 340, y: 320 }, { x: 720, y: 200 }],
        enemies: [
          { type: 'mefiant', x: 500, y: 480, angle: 0, vision: V(280, 0.85), sweep: { base: 0, amp: 1.0, speed: 0.5 } },
          { type: 'guetteur', x: 720, y: 460, angle: -Math.PI / 2, vision: V(320, 0.7), sweep: { base: -Math.PI / 2, amp: 0.8, speed: 0.6 } },
        ],
        objectives: [{ id: 'frag', label: 'Récupérer les 2 fragments', type: 'allFragments' }],
        tutorials: [{ at: 'start', text: 'Le Méfiant retient l’endroit où il vous a vu et va l’inspecter. Ne restez pas prévisible.' }],
      },
      {
        id: '1-8', world: 1, index: 8, name: 'Interrupteurs',
        size: { w: 1080, h: 640 }, start: { x: 60, y: 560 },
        exit: { x: 1000, y: 80, w: 44, h: 80, needs: 0 }, targetTime: 45, hearts: 3,
        walls: [
          { x: 240, y: 0, w: 44, h: 420 }, { x: 480, y: 220, w: 44, h: 420 },
          { x: 720, y: 0, w: 44, h: 420 }, { x: 860, y: 300, w: 220, h: 44 },
        ],
        doors: [{ id: 'd1', x: 480, y: 120, w: 44, h: 100 }],
        switches: [{ id: 's1', x: 160, y: 120, opens: ['d1'] }],
        fragments: [{ x: 360, y: 560 }, { x: 620, y: 90 }, { x: 940, y: 560 }],
        enemies: [
          { type: 'mefiant', x: 360, y: 300, angle: -Math.PI / 2, vision: V(300, 0.8), sweep: { base: -Math.PI / 2, amp: 1.0, speed: 0.5 } },
          { type: 'distrait', x: 620, y: 460, angle: 0, vision: V(280, 0.95), sweep: { base: 0, amp: 1.8, speed: 0.6 } },
        ],
        objectives: [
          { id: 'frag', label: 'Récupérer les 3 fragments', type: 'allFragments' },
          { id: 'noDetect', label: 'Aucune détection', type: 'noDetect' },
        ],
        tutorials: [
          { at: 'start', text: 'Un interrupteur ouvre la porte fermée. Approchez-vous pour l’activer.' },
        ],
      },
      {
        id: '1-9', world: 1, index: 9, name: 'Les trois regards',
        size: { w: 1120, h: 680 }, start: { x: 60, y: 60 },
        exit: { x: 1040, y: 580, w: 44, h: 80, needs: 3 }, targetTime: 55, hearts: 3,
        walls: [
          { x: 220, y: 180, w: 44, h: 320 }, { x: 420, y: 0, w: 44, h: 300 },
          { x: 420, y: 420, w: 44, h: 260 }, { x: 640, y: 200, w: 44, h: 320 },
          { x: 860, y: 0, w: 44, h: 280 }, { x: 860, y: 420, w: 44, h: 260 },
        ],
        fragments: [{ x: 330, y: 600 }, { x: 740, y: 90 }, { x: 970, y: 340 }],
        enemies: [
          { type: 'guetteur', x: 330, y: 340, angle: 0, vision: V(320, 0.8), sweep: { base: 0, amp: 1.4, speed: 0.6 } },
          { type: 'distrait', x: 540, y: 340, angle: Math.PI / 2, vision: V(300, 0.95), sweep: { base: Math.PI / 2, amp: 2.0, speed: 0.5 } },
          { type: 'mefiant', x: 970, y: 340, angle: Math.PI, vision: V(300, 0.8), sweep: { base: Math.PI, amp: 1.1, speed: 0.5 } },
        ],
        objectives: [
          { id: 'frag', label: 'Les 3 fragments ouvrent la sortie', type: 'allFragments' },
          { id: 'noDetect', label: 'Aucune détection', type: 'noDetect' },
        ],
        tutorials: [{ at: 'start', text: 'Les trois Curieux réunis. La sortie ne s’ouvre qu’avec les 3 fragments.' }],
      },

      /* ---------------- 10 : boss ---------------- */
      {
        id: '1-10', world: 1, index: 10, name: 'L’Œil du Vestibule',
        size: { w: 1200, h: 760 }, start: { x: 600, y: 700 },
        exit: { x: 578, y: 40, w: 60, h: 70, needs: 3 }, targetTime: 90, hearts: 3,
        isBoss: true,
        walls: [
          { x: 150, y: 200, w: 160, h: 44 }, { x: 890, y: 200, w: 160, h: 44 },
          { x: 150, y: 520, w: 160, h: 44 }, { x: 890, y: 520, w: 160, h: 44 },
          { x: 560, y: 340, w: 80, h: 80 },
        ],
        fragments: [{ x: 220, y: 360 }, { x: 980, y: 360 }, { x: 600, y: 180 }],
        checkpoints: [{ x: 600, y: 560 }],
        boss: {
          x: 600, y: 380, phases: [
            { vision: V(360, 1.1), speed: 0.35, move: null },
            { vision: V(420, 1.3), speed: 0.6, move: { r: 160, speed: 0.5 } },
            { vision: V(300, 2.2), speed: 0.9, move: { r: 220, speed: 0.9 } },
          ],
        },
        enemies: [],
        objectives: [
          { id: 'frag', label: 'Récupérer les 3 fragments', type: 'allFragments' },
          { id: 'noDetect', label: 'Aucune détection', type: 'noDetect' },
        ],
        tutorials: [
          { at: 'start', text: 'L’Œil du Vestibule. Récupérez un fragment pour l’affaiblir — mais chaque fragment l’énerve.' },
        ],
        cinematic: true,
      },
    ],
  };

  const WORLDS = [world1];
  /* Emplacements réservés : mondes 2 à 5 (verrouillés, à remplir plus tard). */
  const LOCKED_WORLDS = [
    { id: 2, name: 'La Galerie', subtitle: 'Bientôt.', color: '#7ef0d4' },
    { id: 3, name: 'Le Grenier', subtitle: 'Bientôt.', color: '#ffb45b' },
    { id: 4, name: 'La Volière', subtitle: 'Bientôt.', color: '#ff9ad5' },
    { id: 5, name: 'Le Dôme', subtitle: 'Bientôt.', color: '#c58bff' },
  ];

  function getWorld(id) { return WORLDS.find(w => w.id === Number(id)) || null; }
  function getLevel(levelId) {
    for (const w of WORLDS) {
      const lv = w.levels.find(l => l.id === levelId);
      if (lv) return lv;
    }
    return null;
  }
  function levelKey(lv) { return lv.id; }
  function nextLevelId(levelId) {
    const lv = getLevel(levelId);
    if (!lv) return null;
    const w = getWorld(lv.world);
    const i = w.levels.findIndex(l => l.id === levelId);
    return i >= 0 && i < w.levels.length - 1 ? w.levels[i + 1].id : null;
  }

  return { WORLDS, LOCKED_WORLDS, getWorld, getLevel, levelKey, nextLevelId };
})();

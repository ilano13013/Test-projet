// Moteur du bureau : tout le pixel art est dessiné en code (aucune image).
export const W = 352;
export const H = 256;

const PORTE = { x: -14, y: 172 };
const COULOIR_X = 40;
const BUREAU_MAX = { x: 176, y: 70 };
const COLONNES = [96, 160, 224, 288];
const RANGEES = [{ bureauY: 124, allee: 100 }, { bureauY: 196, allee: 172 }];

export const POSTES = [];
for (const r of RANGEES) for (const x of COLONNES) POSTES.push({ x, bureauY: r.bureauY, allee: r.allee, siegeY: r.bureauY + 2 });

// ---------- utilitaires couleur ----------
function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function teinte(hex, f) {
  const [r, g, b] = rgb(hex).map((c) => Math.max(0, Math.min(255, Math.round(f > 0 ? c + (255 - c) * f : c * (1 + f)))));
  return `rgb(${r},${g},${b})`;
}

function r(ctx, x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); }

// ---------- décor statique ----------
function dessinerDecor() {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  // Parquet
  for (let y = 48; y < H; y += 8) {
    const decal = ((y / 8) % 2) * 20;
    for (let x = -decal; x < W; x += 40) {
      const v = ((x * 7 + y * 13) % 3);
      r(g, x, y, 40, 8, ['#a8744a', '#9e6c44', '#b07b4f'][v]);
      r(g, x, y + 7, 40, 1, '#80542f');
      r(g, x + 39, y, 1, 8, '#80542f');
    }
  }
  // Mur du fond
  r(g, 0, 0, W, 44, '#3d4266');
  for (let x = 0; x < W; x += 16) r(g, x, 0, 1, 44, '#383d5e');
  r(g, 0, 40, W, 4, '#2b2f4a');
  r(g, 0, 44, W, 4, '#6b4a33');
  // Fenêtres
  for (const fx of [28, 260]) {
    r(g, fx - 2, 6, 68, 30, '#262a44');
    r(g, fx, 8, 64, 26, '#7cc6f0');
    r(g, fx, 26, 64, 8, '#a6dcf7');
    r(g, fx + 8, 13, 14, 4, '#ffffff'); r(g, fx + 12, 11, 8, 2, '#ffffff');
    r(g, fx + 40, 18, 12, 3, '#eaf7ff');
    r(g, fx + 31, 8, 2, 26, '#262a44'); r(g, fx, 20, 64, 2, '#262a44');
    r(g, fx - 3, 35, 70, 3, '#c9cde0');
  }
  // Tableau blanc derrière Max
  r(g, 138, 6, 76, 30, '#2b2f4a');
  r(g, 140, 8, 72, 26, '#eef1f6');
  r(g, 146, 13, 26, 2, '#4fb6e8'); r(g, 146, 18, 40, 2, '#e86fb0'); r(g, 146, 23, 20, 2, '#7bd36b');
  r(g, 190, 12, 14, 14, '#f2a33a'); r(g, 192, 14, 10, 10, '#eef1f6');
  r(g, 194, 18, 6, 2, '#f2a33a');
  // Horloge
  r(g, 236, 12, 12, 12, '#2b2f4a'); r(g, 237, 13, 10, 10, '#f6f1e3');
  r(g, 241, 15, 1, 4, '#2b2f4a'); r(g, 241, 18, 3, 1, '#2b2f4a');
  // Mur gauche + porte
  r(g, 0, 48, 8, H - 48, '#33385a');
  r(g, 8, 48, 2, H - 48, '#2b2f4a');
  r(g, 0, 152, 10, 40, '#a8744a');
  r(g, 0, 150, 10, 2, '#2b2f4a'); r(g, 0, 192, 10, 2, '#2b2f4a');
  r(g, 10, 158, 16, 28, '#5e3d5f'); // paillasson
  for (let y = 160; y < 184; y += 4) r(g, 12, y, 12, 1, '#7a5378');
  // Panneau "Bureau"
  r(g, 12, 128, 22, 12, '#f2a33a'); r(g, 13, 129, 20, 10, '#ffd9a0');
  r(g, 16, 132, 14, 1, '#6b4a33'); r(g, 16, 135, 10, 1, '#6b4a33');
  // Tapis de Max
  r(g, 130, 52, 92, 42, '#4b3a6e');
  r(g, 132, 54, 88, 38, '#5d4a85');
  for (let x = 136; x < 216; x += 8) r(g, x, 56, 4, 1, '#7a68a6');
  // Plantes
  for (const [px, py] of [[338, 64], [20, 236], [338, 236], [118, 58]]) plante(g, px, py);
  // Machine à café + fontaine
  r(g, 318, 140, 22, 30, '#2b2f4a'); r(g, 320, 142, 18, 12, '#c9cde0');
  r(g, 324, 145, 10, 5, '#3d4266'); r(g, 326, 158, 6, 6, '#ffffff'); r(g, 327, 159, 4, 3, '#6b4a33');
  r(g, 318, 170, 22, 2, '#1d2036');
  return c;
}

function plante(g, x, y) {
  r(g, x - 6, y - 8, 12, 9, '#c4683f'); r(g, x - 7, y - 9, 14, 2, '#d97a4f');
  r(g, x - 1, y - 20, 2, 12, '#3f8a4a');
  for (const [dx, dy] of [[-7, -18], [3, -22], [-5, -26], [2, -14], [-9, -12], [5, -17]]) {
    r(g, x + dx, y + dy, 6, 4, '#4caf5a'); r(g, x + dx + 1, y + dy, 3, 1, '#7bd36b');
  }
  r(g, x - 6, y + 1, 12, 2, 'rgba(0,0,0,.25)');
}

// ---------- mobilier dynamique ----------
function bureau(ctx, x, y, allume, couleur, t, estMax) {
  const w = estMax ? 44 : 34;
  r(ctx, x - w / 2 + 2, y + 18, w - 4, 3, 'rgba(0,0,0,.25)');
  r(ctx, x - w / 2, y, w, 16, estMax ? '#6b4a33' : '#8a5a36');
  r(ctx, x - w / 2, y, w, 2, estMax ? '#8a6347' : '#a8744a');
  r(ctx, x - w / 2, y + 14, w, 2, '#5a3a22');
  r(ctx, x - w / 2 + 1, y + 16, 3, 3, '#5a3a22'); r(ctx, x + w / 2 - 4, y + 16, 3, 3, '#5a3a22');
  // écran sur le côté du bureau, pour laisser voir le visage
  const ex = x + w / 2 - 12;
  r(ctx, ex, y - 7, 12, 9, '#23263b');
  r(ctx, ex + 1, y - 6, 10, 7, allume ? couleur : '#30344f');
  if (allume) {
    const l = Math.floor(t / 180) % 4;
    r(ctx, ex + 2, y - 5, 2 + l * 2, 1, 'rgba(255,255,255,.75)');
    r(ctx, ex + 2, y - 3, 7 - l, 1, 'rgba(255,255,255,.5)');
  }
  r(ctx, ex + 4, y + 2, 4, 2, '#23263b');
  // clavier, tasse
  r(ctx, x - 7, y + 5, 11, 3, '#d8dbe6'); r(ctx, x - 7, y + 7, 11, 1, '#a3a8bd');
  r(ctx, x - w / 2 + 4, y + 4, 4, 4, estMax ? '#f2a33a' : '#eef1f6');
  if (estMax) { r(ctx, x - 16, y + 3, 7, 9, '#ffffff'); r(ctx, x - 15, y + 5, 5, 1, '#9aa4b1'); r(ctx, x - 15, y + 7, 4, 1, '#9aa4b1'); }
}

// ---------- robots ----------
export function dessinerRobot(ctx, x, y, couleur, o = {}) {
  const t = o.t || 0;
  const marche = o.marche;
  const pas = marche ? Math.floor(t / 120) % 2 : 0;
  const assis = o.assis;
  const tape = assis && o.travaille ? Math.floor(t / 140) % 2 : 0;
  const saut = o.saut ? -Math.max(0, Math.round(Math.sin(o.saut * Math.PI) * 3)) : 0;
  const respire = !marche && !assis ? (Math.floor(t / 600) % 2) : 0;
  y += saut;
  const fonce = teinte(couleur, -0.35);
  const clair = teinte(couleur, 0.35);

  r(ctx, x - 6, y - 1 - saut, 12, 2, 'rgba(0,0,0,.28)');
  // jambes
  if (!assis) {
    r(ctx, x - 4, y - 5 + (pas ? -1 : 0), 3, 5, '#3a3f5c');
    r(ctx, x + 1, y - 5 + (pas ? 0 : -1), 3, 5, '#3a3f5c');
  }
  const by = y - 12 + respire;
  // corps
  r(ctx, x - 5, by, 10, 8, fonce);
  r(ctx, x - 5, by, 10, 7, couleur);
  r(ctx, x - 2, by + 2, 4, 3, '#23263b');
  r(ctx, x - 1, by + 3, 2, 1, Math.floor(t / 500) % 2 ? '#8ef0ff' : '#4fb6e8');
  if (o.cravate) { r(ctx, x - 1, by, 2, 6, '#d64545'); r(ctx, x - 2, by, 4, 1, '#ffffff'); }
  // bras
  const ba = marche ? (pas ? 1 : -1) : 0;
  r(ctx, x - 7, by + 1 + ba - tape, 2, 5, fonce);
  r(ctx, x + 5, by + 1 - ba - (tape ? 0 : 1) * (assis && o.travaille ? 1 : 0), 2, 5, fonce);
  // tête
  const hy = by - 10;
  r(ctx, x - 6, hy + 1, 12, 8, fonce);
  r(ctx, x - 6, hy, 12, 8, couleur);
  r(ctx, x - 5, hy, 10, 1, clair);
  // visière
  r(ctx, x - 5, hy + 2, 10, 5, '#1d2036');
  const cligne = (Math.floor(t / 100) + (o.graine || 0)) % 38 === 0;
  if (!cligne) {
    const yeux = o.dort ? '#3d4266' : '#8ef0ff';
    const dx = marche ? (o.dir || 0) : 0;
    r(ctx, x - 3 + dx, hy + 4, 2, o.dort ? 1 : 2, yeux);
    r(ctx, x + 1 + dx, hy + 4, 2, o.dort ? 1 : 2, yeux);
  }
  // antenne
  r(ctx, x, hy - 3, 1, 3, fonce);
  r(ctx, x - 1, hy - 5, 3, 2, Math.floor(t / 400) % 2 && o.travaille ? '#ffffff' : clair);
  if (o.casque) { r(ctx, x - 7, hy + 2, 2, 4, '#23263b'); r(ctx, x + 5, hy + 2, 2, 4, '#23263b'); r(ctx, x - 6, hy - 1, 12, 1, '#23263b'); }
}

// ---------- scène ----------
export class Bureau {
  constructor(canvas) {
    this.ctx = canvas.getContext('2d');
    this.decor = dessinerDecor();
    this.acteurs = new Map();
    this.papiers = [];
    this.max = { x: BUREAU_MAX.x, y: BUREAU_MAX.y + 2, couleur: '#f2a33a', travaille: false, saut: 0 };
    this.t0 = performance.now();
    this.dernier = this.t0;
    this.ecouteurs = [];
    requestAnimationFrame((t) => this.boucle(t));
  }

  surFrame(f) { this.ecouteurs.push(f); }

  posteLibre(prefere) {
    const pris = new Set([...this.acteurs.values()].map((a) => a.poste));
    if (prefere != null && !pris.has(prefere)) return prefere;
    for (let i = 0; i < POSTES.length; i++) if (!pris.has(i)) return i;
    return prefere ?? 0;
  }

  arrivee(id, membre, indexMembre) {
    if (this.acteurs.has(id)) return;
    const poste = this.posteLibre(indexMembre % POSTES.length);
    const p = POSTES[poste];
    const a = {
      id, membre, poste, couleur: membre.couleur,
      x: PORTE.x, y: PORTE.y, chemin: [
        { x: COULOIR_X, y: PORTE.y }, { x: COULOIR_X, y: p.allee }, { x: p.x, y: p.allee }, { x: p.x, y: p.siegeY },
      ],
      etat: 'arrive', saut: 0, graine: Math.floor(Math.random() * 30), dir: 0,
    };
    this.acteurs.set(id, a);
    return a;
  }

  depart(id) {
    const a = this.acteurs.get(id);
    if (!a) return;
    const p = POSTES[a.poste];
    a.etat = 'part';
    a.chemin = [{ x: p.x, y: p.allee }, { x: COULOIR_X, y: p.allee }, { x: COULOIR_X, y: PORTE.y }, { x: PORTE.x, y: PORTE.y }];
    // le livrable vole jusqu'au bureau de Max
    this.papiers.push({ x: p.x, y: p.bureauY - 4, vers: { x: BUREAU_MAX.x - 14, y: BUREAU_MAX.y + 4 }, k: 0, couleur: a.couleur });
  }

  sautiller(id) {
    const a = id === 'max' ? this.max : this.acteurs.get(id);
    if (a) a.saut = 0.001;
  }

  boucle(maintenant) {
    const dt = Math.min(50, maintenant - this.dernier);
    this.dernier = maintenant;
    const t = maintenant - this.t0;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.decor, 0, 0);

    // déplacements
    for (const a of this.acteurs.values()) {
      if (a.saut) { a.saut += dt / 300; if (a.saut >= 1) a.saut = 0; }
      if (!a.chemin.length) continue;
      const cible = a.chemin[0];
      const dx = cible.x - a.x, dy = cible.y - a.y;
      const d = Math.hypot(dx, dy);
      const v = 0.055 * dt;
      a.dir = Math.abs(dx) > 0.5 ? Math.sign(dx) : 0;
      if (d <= v) {
        a.x = cible.x; a.y = cible.y; a.chemin.shift();
        if (!a.chemin.length) {
          if (a.etat === 'arrive') { a.etat = 'travaille'; a.saut = 0.001; }
          if (a.etat === 'part') a.etat = 'parti';
        }
      } else { a.x += (dx / d) * v; a.y += (dy / d) * v; }
    }
    for (const [id, a] of this.acteurs) if (a.etat === 'parti') this.acteurs.delete(id);
    if (this.max.saut) { this.max.saut += dt / 300; if (this.max.saut >= 1) this.max.saut = 0; }

    // tri par profondeur : postes (bureau + éventuel occupant), Max, marcheurs
    const dessins = [];
    const occupants = new Map();
    for (const a of this.acteurs.values()) if (a.etat === 'travaille') occupants.set(a.poste, a);
    POSTES.forEach((p, i) => {
      const o = occupants.get(i);
      dessins.push({
        z: p.bureauY, f: () => {
          if (o) dessinerRobot(ctx, o.x, o.y, o.couleur, { t, assis: true, travaille: true, saut: o.saut, graine: o.graine });
          bureau(ctx, p.x, p.bureauY, !!o, o ? teinte(o.couleur, 0.3) : null, t);
        },
      });
    });
    dessins.push({
      z: BUREAU_MAX.y, f: () => {
        dessinerRobot(ctx, this.max.x, this.max.y, this.max.couleur, {
          t, assis: true, travaille: this.max.travaille, cravate: true, casque: true, saut: this.max.saut, graine: 7,
        });
        bureau(ctx, BUREAU_MAX.x, BUREAU_MAX.y, this.max.travaille, '#ffd9a0', t, true);
      },
    });
    for (const a of this.acteurs.values()) {
      if (a.etat === 'travaille') continue;
      dessins.push({ z: a.y, f: () => dessinerRobot(ctx, a.x, a.y, a.couleur, { t, marche: a.chemin.length > 0, dir: a.dir, graine: a.graine }) });
    }
    dessins.sort((a, b) => a.z - b.z).forEach((d) => d.f());

    // papiers volants
    this.papiers = this.papiers.filter((p) => p.k < 1);
    for (const p of this.papiers) {
      p.k += dt / 900;
      const k = Math.min(1, p.k);
      const x = p.x + (p.vers.x - p.x) * k;
      const y = p.y + (p.vers.y - p.y) * k - Math.sin(k * Math.PI) * 24;
      r(ctx, x - 3, y - 4, 7, 9, '#ffffff');
      r(ctx, x - 2, y - 2, 5, 1, p.couleur); r(ctx, x - 2, y, 4, 1, '#9aa4b1'); r(ctx, x - 2, y + 2, 5, 1, '#9aa4b1');
    }

    for (const f of this.ecouteurs) f(t);
    requestAnimationFrame((tt) => this.boucle(tt));
  }

  // position (en px scène) de la tête d'un acteur, pour les bulles DOM
  tete(id) {
    if (id === 'max') return { x: this.max.x, y: this.max.y - 26 };
    const a = this.acteurs.get(id);
    return a ? { x: a.x, y: a.y - 26 } : null;
  }
}

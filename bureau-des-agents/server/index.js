// Serveur local du Bureau des agents : sert l'interface, diffuse les
// événements en SSE et lance les missions. Écoute uniquement sur 127.0.0.1.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Mission } from './mission.js';
import { lancerDemo } from './demo.js';

const RACINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBLIC = path.join(RACINE, 'public');
const PORT = Number(process.env.PORT) || 4848;
const HOTE = '127.0.0.1';
const MISSIONS = process.env.BUREAU_MISSIONS
  || path.join(os.homedir(), 'Documents', 'Bureau des agents', 'Missions');
const DEMO_SEULE = process.argv.includes('--demo');

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon',
};

function chargerEquipe() {
  return JSON.parse(fs.readFileSync(path.join(RACINE, 'equipe.json'), 'utf8'));
}

// --- Diffusion SSE + état courant (pour les rechargements de page) ---
const clients = new Set();
let etat = { mission: null, agents: {}, journal: [] };
let mission = null;
let arreterDemo = null;

function emettre(ev) {
  ev.t = Date.now();
  if (ev.type === 'mission:debut') etat = { mission: { id: ev.id, demande: ev.demande, enCours: true }, agents: {}, journal: [] };
  if (ev.type === 'agent:arrive') etat.agents[ev.id] = { membre: ev.membre, tache: ev.tache };
  if (ev.type === 'agent:part') delete etat.agents[ev.id];
  if (ev.type === 'mission:fin') {
    if (etat.mission) etat.mission.enCours = false;
    mission = null; arreterDemo = null;
  }
  etat.journal.push(ev);
  if (etat.journal.length > 300) etat.journal.shift();
  const data = `data: ${JSON.stringify(ev)}\n\n`;
  for (const c of clients) c.write(data);
}

function slug(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'mission';
}

function lireCorps(req) {
  return new Promise((ok, ko) => {
    let s = '';
    req.on('data', (d) => { s += d; if (s.length > 1e5) req.destroy(); });
    req.on('end', () => { try { ok(s ? JSON.parse(s) : {}); } catch (e) { ko(e); } });
  });
}

function json(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(obj));
}

function servirFichier(res, racine, relatif, sandbox = false) {
  const p = path.resolve(racine, '.' + path.sep + decodeURIComponent(relatif));
  if (!p.startsWith(path.resolve(racine) + path.sep) && p !== path.resolve(racine)) return json(res, 403, { erreur: 'interdit' });
  fs.stat(p, (err, st) => {
    if (err || !st.isFile()) return json(res, 404, { erreur: 'introuvable' });
    const entetes = { 'Content-Type': TYPES[path.extname(p).toLowerCase()] || 'text/plain; charset=utf-8' };
    // Les sites produits par l'équipe tournent dans un bac à sable.
    if (sandbox) entetes['Content-Security-Policy'] = 'sandbox allow-scripts';
    res.writeHead(200, entetes);
    fs.createReadStream(p).pipe(res);
  });
}

const serveur = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  // Protection basique : seules les requêtes venant du bureau lui-même modifient l'état.
  if (req.method === 'POST') {
    const origine = req.headers.origin;
    if (origine && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origine)) return json(res, 403, { erreur: 'origine refusée' });
  }

  if (url.pathname === '/api/evenements') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ type: 'etat', etat })}\n\n`);
    clients.add(res);
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    req.on('close', () => { clients.delete(res); clearInterval(ping); });
    return;
  }

  if (url.pathname === '/api/equipe') {
    try { return json(res, 200, { ...chargerEquipe(), demoSeule: DEMO_SEULE, missions: MISSIONS }); }
    catch (e) { return json(res, 500, { erreur: 'equipe.json illisible : ' + e.message }); }
  }

  if (url.pathname === '/api/mission' && req.method === 'POST') {
    if (mission || arreterDemo) return json(res, 409, { erreur: 'Une mission est déjà en cours.' });
    let corps;
    try { corps = await lireCorps(req); } catch { return json(res, 400, { erreur: 'JSON invalide' }); }
    const demande = String(corps.demande || '').trim();
    if (!demande) return json(res, 400, { erreur: 'Dis-moi ce que tu veux 🙂' });
    const equipe = chargerEquipe();
    if (corps.demo || DEMO_SEULE) {
      arreterDemo = lancerDemo(equipe, emettre, demande);
      return json(res, 200, { ok: true, demo: true });
    }
    const date = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h');
    const id = `${date}_${slug(demande)}`;
    mission = new Mission({
      id, demande, equipe, emettre,
      dossier: path.join(MISSIONS, id),
      modele: process.env.BUREAU_MODELE,
    });
    mission.demarrer();
    return json(res, 200, { ok: true, id });
  }

  if (url.pathname === '/api/stop' && req.method === 'POST') {
    if (mission) mission.arreter();
    else if (arreterDemo) {
      arreterDemo();
      for (const id of Object.keys(etat.agents)) emettre({ type: 'agent:part', id, resume: '' });
      emettre({ type: 'mission:fin', id: 'demo', ok: false, texte: 'Mission arrêtée.', fichiers: [] });
    }
    return json(res, 200, { ok: true });
  }

  const m = url.pathname.match(/^\/missions\/([^/]+)\/(.+)$/);
  if (m) return servirFichier(res, path.join(MISSIONS, m[1]), m[2], true);

  if (req.method === 'GET') return servirFichier(res, PUBLIC, url.pathname === '/' ? 'index.html' : url.pathname);
  json(res, 405, { erreur: 'méthode non gérée' });
});

serveur.listen(PORT, HOTE, () => {
  console.log(`\n  🏢  Le Bureau des agents est ouvert : http://localhost:${PORT}`);
  console.log(`  📁  Missions : ${MISSIONS}`);
  if (DEMO_SEULE) console.log('  🎬  Mode démo : aucune requête vers Claude.');
  console.log('  ⏹   Ctrl + C pour fermer le bureau.\n');
});

process.on('SIGINT', () => { if (mission) mission.arreter(); process.exit(0); });

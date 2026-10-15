import { Bureau, dessinerRobot, W, H } from './pixel.js';

const $ = (s) => document.querySelector(s);
const bureau = new Bureau($('#canvas'));
const calque = $('#calque');

let equipe = { chef: { nom: 'Max', metier: 'Chef de projet', couleur: '#f2a33a' }, specialistes: [] };
let missionId = null;
let enCours = false;
const taches = new Map(); // id agent -> { el, membre }

// ---------- sons (petits bips façon console) ----------
let son = true;
let audio;
function bip(freq = 660, duree = 0.07, type = 'square', vol = 0.04) {
  if (!son) return;
  try {
    audio ||= new AudioContext();
    const o = audio.createOscillator(), g = audio.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audio.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + duree);
    o.connect(g).connect(audio.destination); o.start(); o.stop(audio.currentTime + duree);
  } catch { /* pas d'audio */ }
}
const jingle = (notes) => notes.forEach((f, i) => setTimeout(() => bip(f, 0.09), i * 90));
$('#btn-son').onclick = () => { son = !son; $('#btn-son').textContent = son ? '🔊' : '🔈'; };

// ---------- bulles et étiquettes (DOM au-dessus du canvas) ----------
const overlays = new Map(); // id -> { tag, bulle, timer }
function overlay(id, nom, couleur) {
  if (overlays.has(id)) return overlays.get(id);
  const tag = document.createElement('div');
  tag.className = 'etiquette'; tag.textContent = nom; tag.style.setProperty('--c', couleur);
  calque.append(tag);
  const o = { tag, bulle: null, timer: null };
  overlays.set(id, o);
  return o;
}
function bulle(id, texte, duree = 0) {
  const o = overlays.get(id);
  if (!o) return;
  if (o.bulle) o.bulle.remove();
  clearTimeout(o.timer);
  const b = document.createElement('div');
  b.className = 'bulle' + (id === 'max' ? ' max' : '');
  b.textContent = texte.length > 90 ? texte.slice(0, 89) + '…' : texte;
  calque.append(b);
  o.bulle = b;
  if (duree) o.timer = setTimeout(() => { b.remove(); if (o.bulle === b) o.bulle = null; }, duree);
}
function retirerOverlay(id) {
  const o = overlays.get(id);
  if (!o) return;
  clearTimeout(o.timer); o.tag.remove(); o.bulle?.remove(); overlays.delete(id);
}
bureau.surFrame(() => {
  for (const [id, o] of overlays) {
    const p = bureau.tete(id);
    if (!p) { if (id !== 'max') retirerOverlay(id); continue; }
    const x = (p.x / W) * 100 + '%', y = (p.y / H) * 100 + '%';
    o.tag.style.left = x; o.tag.style.top = y;
    if (o.bulle) { o.bulle.style.left = x; o.bulle.style.top = y; }
  }
});

// ---------- boîte de dialogue de Max (effet machine à écrire) ----------
let ecriture;
function maxDit(texte) {
  const el = $('#dialogue-texte');
  clearInterval(ecriture);
  const propre = texte.replace(/[#*`_]+/g, '').trim();
  const plein = propre.length > 420 ? propre.slice(0, 419) + '…' : propre;
  let i = 0;
  el.textContent = '';
  ecriture = setInterval(() => {
    i += 2;
    el.textContent = plein.slice(0, i);
    if (i % 8 === 0) bip(520 + Math.random() * 80, 0.03, 'square', 0.015);
    if (i >= plein.length) clearInterval(ecriture);
  }, 22);
  bureau.sautiller('max');
}

function portrait(canvas, couleur, max = false) {
  const g = canvas.getContext('2d');
  g.imageSmoothingEnabled = false;
  const dessiner = (t) => {
    g.clearRect(0, 0, canvas.width, canvas.height);
    dessinerRobot(g, canvas.width / 2, canvas.height - 1, couleur, { t, cravate: max, casque: max, graine: 3 });
    requestAnimationFrame(dessiner);
  };
  requestAnimationFrame(dessiner);
}
portrait($('#portrait'), '#f2a33a', true);

// ---------- panneaux ----------
document.querySelectorAll('.onglets button').forEach((b) => {
  b.onclick = () => {
    document.querySelectorAll('.onglets button').forEach((x) => x.classList.toggle('actif', x === b));
    document.querySelectorAll('.onglet').forEach((o) => { o.hidden = o.id !== 'onglet-' + b.dataset.onglet; });
  };
});

function afficherEquipe() {
  const ul = $('#equipe');
  ul.innerHTML = '';
  const tous = [{ ...equipe.chef, outils: ['Agent', 'Read', 'Glob'], description: 'Lit ta demande, fait le plan et appelle les bons spécialistes.' }, ...equipe.specialistes];
  for (const m of tous) {
    const li = document.createElement('li');
    li.className = 'membre';
    const c = document.createElement('canvas'); c.width = 20; c.height = 26;
    li.append(c);
    const d = document.createElement('div');
    d.innerHTML = `<div class="nom"></div><div class="metier"></div><div class="puces"></div>`;
    d.querySelector('.nom').textContent = m.nom;
    d.querySelector('.metier').textContent = `${m.metier} — ${m.description || ''}`;
    for (const o of m.outils || []) {
      const s = document.createElement('span'); s.className = 'puce'; s.textContent = o;
      d.querySelector('.puces').append(s);
    }
    li.append(d); ul.append(li);
    portrait(c, m.couleur, m === tous[0]);
  }
}

function journal(html) {
  const li = document.createElement('li');
  const h = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  li.innerHTML = `<time>${h}</time>${html}`;
  $('#journal').prepend(li);
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function ajouterTache(id, membre, tache) {
  const li = document.createElement('li');
  li.className = 'tache';
  li.style.setProperty('--c', membre.couleur);
  li.innerHTML = `<div class="haut"><span></span><span class="statut">au travail…</span></div><div class="derniere">Arrive au bureau</div>`;
  li.querySelector('.haut span').textContent = `${membre.nom} · ${tache}`;
  $('#liste-taches').append(li);
  taches.set(id, { el: li, membre });
}

function setEnCours(v) {
  enCours = v;
  $('#btn-go').disabled = v;
  $('#btn-stop').hidden = !v;
  bureau.max.travaille = v;
}

// ---------- événements du serveur ----------
const indexMembre = (m) => Math.max(0, equipe.specialistes.findIndex((s) => s.id === m.id));

function arrivee(ev, instantane = false) {
  const a = bureau.arrivee(ev.id, ev.membre, indexMembre(ev.membre));
  if (!a) return;
  if (instantane) { const fin = a.chemin.at(-1); a.x = fin.x; a.y = fin.y; a.chemin = []; a.etat = 'travaille'; }
  overlay(ev.id, ev.membre.nom, ev.membre.couleur);
}

function traiter(ev) {
  switch (ev.type) {
    case 'etat': {
      const e = ev.etat;
      if (e.mission) {
        missionId = e.mission.id;
        $('#mission-vide').hidden = true; $('#mission-infos').hidden = false;
        $('#mission-titre').textContent = e.mission.demande;
        setEnCours(e.mission.enCours);
      }
      for (const [id, a] of Object.entries(e.agents)) { arrivee({ id, ...a }, true); ajouterTache(id, a.membre, a.tache); }
      break;
    }
    case 'mission:debut':
      missionId = ev.id;
      for (const id of [...overlays.keys()]) if (id !== 'max') retirerOverlay(id);
      taches.clear();
      $('#liste-taches').innerHTML = '';
      $('#bilan').hidden = true;
      $('#mission-vide').hidden = true; $('#mission-infos').hidden = false;
      $('#mission-titre').textContent = ev.demande;
      setEnCours(true);
      jingle([523, 659, 784]);
      journal(`<b>Nouvelle mission</b> — ${esc(ev.demande)}`);
      break;
    case 'max:dit':
      maxDit(ev.texte);
      journal(`<b>Max</b> : ${esc(ev.texte.slice(0, 200))}`);
      break;
    case 'max:action':
      bulle('max', `${ev.icone} ${ev.texte}`, 3500);
      break;
    case 'agent:arrive':
      arrivee(ev);
      bulle('max', `📣 ${ev.membre.nom}, à toi !`, 2500);
      bulle(ev.id, `👋 ${ev.tache}`, 4000);
      ajouterTache(ev.id, ev.membre, ev.tache);
      bip(880, 0.08); setTimeout(() => bip(1100, 0.08), 90);
      journal(`<b>${esc(ev.membre.nom)}</b> arrive : ${esc(ev.tache)}`);
      break;
    case 'agent:action': {
      const t = `${ev.icone} ${ev.texte}`;
      bulle(ev.id, t);
      bureau.sautiller(ev.id);
      bip(740 + Math.random() * 200, 0.04, 'triangle', 0.03);
      const tc = taches.get(ev.id);
      if (tc) tc.el.querySelector('.derniere').textContent = t;
      journal(`<b>${esc(tc?.membre.nom || '?')}</b> ${esc(t.slice(0, 160))}`);
      break;
    }
    case 'agent:part': {
      const tc = taches.get(ev.id);
      bulle(ev.id, '✅ Terminé !', 2500);
      bureau.depart(ev.id);
      setTimeout(() => bip(988, 0.1, 'triangle'), 0);
      if (tc) {
        tc.el.classList.add('fini');
        tc.el.querySelector('.statut').textContent = '✓ terminé';
        if (ev.resume) {
          const d = document.createElement('details');
          d.innerHTML = '<summary>Compte rendu</summary><p></p>';
          d.querySelector('p').textContent = ev.resume;
          tc.el.append(d);
        }
      }
      journal(`<b>${esc(tc?.membre.nom || '?')}</b> a fini et repart.`);
      break;
    }
    case 'mission:fin': {
      setEnCours(false);
      maxDit(ev.ok ? (ev.texte || 'Mission terminée !') : `Oups… ${ev.texte}`);
      $('#bilan').hidden = false;
      $('#bilan-texte').textContent = ev.texte || '';
      const ul = $('#fichiers'); ul.innerHTML = '';
      $('#titre-fichiers').hidden = !ev.fichiers?.length;
      for (const f of ev.fichiers || []) {
        const li = document.createElement('li');
        const a = document.createElement('a');
        a.href = `/missions/${encodeURIComponent(ev.id)}/${f.split('/').map(encodeURIComponent).join('/')}`;
        a.target = '_blank'; a.rel = 'noopener'; a.textContent = '📄 ' + f;
        li.append(a); ul.append(li);
      }
      $('#cout').textContent = ev.cout ? `Coût équivalent API : ${ev.cout.toFixed(3)} $ (inclus dans ton abonnement Claude).` : '';
      if (ev.ok) jingle([523, 659, 784, 1046]); else jingle([440, 330]);
      journal(`<b>Fin de mission</b> ${ev.ok ? '✅' : '⚠️'}`);
      break;
    }
  }
}

function connecter() {
  const es = new EventSource('/api/evenements');
  es.onopen = () => { $('#pastille').textContent = '● en ligne'; $('#pastille').classList.add('en-ligne'); };
  es.onmessage = (m) => { try { traiter(JSON.parse(m.data)); } catch (e) { console.error(e); } };
  es.onerror = () => { $('#pastille').textContent = '● hors ligne'; $('#pastille').classList.remove('en-ligne'); };
}

// ---------- envoi de la demande ----------
$('#form').onsubmit = async (e) => {
  e.preventDefault();
  const demande = $('#demande').value.trim();
  if (!demande) { maxDit('Dis-moi ce que tu veux 🙂'); return; }
  $('#btn-go').disabled = true;
  try {
    const r = await fetch('/api/mission', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ demande, demo: $('#demo').checked }),
    });
    const j = await r.json();
    if (!r.ok) { maxDit(j.erreur || 'Impossible de lancer la mission.'); $('#btn-go').disabled = enCours; }
    else $('#demande').value = '';
  } catch { maxDit("Je n'arrive pas à joindre le serveur. Est-ce que `npm start` tourne ?"); $('#btn-go').disabled = false; }
};
$('#demande').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) $('#form').requestSubmit();
});
$('#btn-stop').onclick = () => fetch('/api/stop', { method: 'POST' });

// ---------- démarrage ----------
overlay('max', 'Max', '#f2a33a');
fetch('/api/equipe').then((r) => r.json()).then((e) => {
  if (e.erreur) { maxDit(e.erreur); return; }
  equipe = e;
  overlays.get('max').tag.textContent = e.chef.nom;
  document.querySelector('.dialogue-nom').textContent = `${e.chef.nom} · ${e.chef.metier}`;
  if (e.demoSeule) { $('#demo').checked = true; $('#demo').disabled = true; }
  afficherEquipe();
  connecter();
}).catch(() => maxDit('Le serveur ne répond pas.'));

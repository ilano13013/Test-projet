// Mission de démonstration : rejoue un scénario sans appeler Claude,
// pour découvrir le bureau sans consommer d'abonnement.
export function lancerDemo(equipe, emettre, demande) {
  const m = (id) => equipe.specialistes.find((s) => s.id === id) || equipe.specialistes[0];
  const t = [];
  let d = 0;
  const plus = (ms, ev) => { d += ms; t.push(setTimeout(() => emettre(ev), d)); };

  plus(0, { type: 'mission:debut', id: 'demo', demande, dossier: '(démo)' });
  plus(300, { type: 'max:dit', texte: 'Je lis ta demande…' });
  plus(1800, { type: 'max:dit', texte: 'Bonne idée ! Léa va se renseigner, Inès prépare le style et Hugo code la page. Noé relira à la fin.' });
  plus(900, { type: 'agent:arrive', id: 'a1', membre: m('chercheuse'), tache: 'Recherche sur le sujet' });
  plus(400, { type: 'agent:arrive', id: 'a2', membre: m('designer'), tache: 'Palette et typographies' });
  plus(400, { type: 'agent:arrive', id: 'a3', membre: m('developpeur'), tache: 'Coder la page' });
  plus(3200, { type: 'agent:action', id: 'a1', icone: '🔎', texte: 'Cherche « meilleures boulangeries Lyon »' });
  plus(700, { type: 'agent:action', id: 'a2', icone: '🎨', texte: 'Choisit une palette chaude' });
  plus(900, { type: 'agent:action', id: 'a3', icone: '📖', texte: 'Lit DEMANDE.md' });
  plus(1500, { type: 'agent:action', id: 'a1', icone: '🌐', texte: 'Lit lyon-france.com' });
  plus(1200, { type: 'agent:action', id: 'a2', icone: '✍️', texte: 'Écrit style.css' });
  plus(900, { type: 'agent:action', id: 'a3', icone: '✍️', texte: 'Écrit index.html' });
  plus(1600, { type: 'agent:action', id: 'a1', icone: '✍️', texte: 'Écrit notes-recherche.md' });
  plus(1500, { type: 'agent:part', id: 'a2', resume: 'style.css livré : palette miel & crème, Fraunces + Inter.' });
  plus(1200, { type: 'agent:part', id: 'a1', resume: '5 sources croisées, synthèse dans notes-recherche.md.' });
  plus(1000, { type: 'agent:action', id: 'a3', icone: '✏️', texte: 'Retouche index.html' });
  plus(1400, { type: 'agent:part', id: 'a3', resume: 'index.html prêt, sans build.' });
  plus(600, { type: 'max:dit', texte: 'Super travail. Noé, tu peux relire ?' });
  plus(800, { type: 'agent:arrive', id: 'a4', membre: m('relecteur'), tache: 'Relecture finale' });
  plus(3000, { type: 'agent:action', id: 'a4', icone: '📖', texte: 'Lit index.html' });
  plus(1500, { type: 'agent:action', id: 'a4', icone: '✏️', texte: 'Retouche index.html (3 fautes)' });
  plus(1800, { type: 'agent:part', id: 'a4', resume: '3 coquilles corrigées, liens vérifiés.' });
  plus(1500, {
    type: 'mission:fin', id: 'demo', ok: true, cout: 0,
    texte: 'Mission terminée ! (démonstration)\n\nTu trouveras : index.html, style.css et notes-recherche.md.',
    fichiers: [],
  });
  return () => t.forEach(clearTimeout);
}

// Lance une mission : un seul processus `claude -p` où Max (l'agent principal)
// délègue aux spécialistes définis via --agents. Le flux stream-json est
// traduit en événements de bureau (arrivée, action, départ).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { decrireOutil } from './outils.js';

const OUTILS_AGENT = new Set(['Agent', 'Task']);

export function promptMax(equipe) {
  const liste = equipe.specialistes
    .map((s) => `- "${s.id}" (${s.nom}, ${s.metier}) : ${s.description}`)
    .join('\n');
  return `Tu es ${equipe.chef.nom}, chef de projet du Bureau des agents.
Tu ne fais pas le travail toi-même : tu lis la demande, tu annonces ton plan en une ou deux phrases courtes, puis tu confies chaque partie au bon spécialiste avec l'outil Agent (paramètre subagent_type = l'identifiant ci-dessous).
Ton équipe :
${liste}
Règles :
- Appelle seulement les spécialistes utiles (souvent 2 à 4). Lance en parallèle les tâches indépendantes, dans le même message.
- Donne à chacun une consigne précise et autonome, avec les noms de fichiers à produire.
- Tous les livrables sont écrits dans le dossier courant.
- Parle toujours en français, phrases courtes, ton chaleureux.
- À la fin, fais un bilan bref : ce qui a été produit et les fichiers à ouvrir.`;
}

export function argumentsClaude(equipe, demande, options = {}) {
  const agents = {};
  const outils = new Set(['Agent', 'Read', 'Glob']);
  for (const s of equipe.specialistes) {
    agents[s.id] = { description: s.description, prompt: s.prompt, tools: s.outils };
    if (s.modele) agents[s.id].model = s.modele;
    s.outils.forEach((o) => outils.add(o));
  }
  const liste = [...outils].join(',');
  const args = [
    '-p', demande,
    '--output-format', 'stream-json',
    '--verbose',
    '--restricted',
    '--agents', JSON.stringify(agents),
    '--tools', liste,
    '--allowedTools', liste,
    '--permission-mode', 'acceptEdits',
    '--append-system-prompt', promptMax(equipe),
  ];
  if (options.modele) args.push('--model', options.modele);
  return args;
}

export class Mission {
  constructor({ id, demande, dossier, equipe, emettre, modele }) {
    Object.assign(this, { id, demande, dossier, equipe, emettre, modele });
    this.agents = new Map(); // tool_use_id -> { membre, tache }
    this.fini = false;
  }

  demarrer() {
    fs.mkdirSync(this.dossier, { recursive: true });
    fs.writeFileSync(path.join(this.dossier, 'DEMANDE.md'), `# Demande\n\n${this.demande}\n`);
    const args = argumentsClaude(this.equipe, this.demande, { modele: this.modele });
    this.emettre({ type: 'mission:debut', id: this.id, demande: this.demande, dossier: this.dossier });
    this.emettre({ type: 'max:dit', texte: 'Je lis ta demande…' });

    this.proc = spawn(process.env.CLAUDE_BIN || 'claude', args, {
      cwd: this.dossier,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: process.env,
    });
    let tampon = '';
    this.proc.stdout.on('data', (morceau) => {
      tampon += morceau;
      let i;
      while ((i = tampon.indexOf('\n')) >= 0) {
        const ligne = tampon.slice(0, i).trim();
        tampon = tampon.slice(i + 1);
        if (!ligne) continue;
        try { this.traiter(JSON.parse(ligne)); } catch { /* ligne non JSON */ }
      }
    });
    let erreurs = '';
    this.proc.stderr.on('data', (d) => { erreurs += d; });
    this.proc.on('error', (e) => {
      this.terminer(false, e.code === 'ENOENT'
        ? 'Claude Code est introuvable. Installe-le puis connecte-toi avec `claude`.'
        : e.message);
    });
    this.proc.on('close', (code) => {
      if (!this.fini) this.terminer(code === 0, erreurs.trim().slice(-600) || `Claude s'est arrêté (code ${code}).`);
    });
  }

  arreter() {
    if (this.proc && !this.fini) {
      this.proc.kill('SIGTERM');
      this.terminer(false, 'Mission arrêtée.');
    }
  }

  membre(type) {
    return this.equipe.specialistes.find((s) => s.id === type) || {
      id: type || 'renfort', nom: 'Renfort', metier: type || 'Agent', couleur: '#9aa4b1', outils: [],
    };
  }

  traiter(msg) {
    if (msg.type === 'assistant' && msg.message?.content) {
      const parent = msg.parent_tool_use_id;
      for (const bloc of msg.message.content) {
        if (parent && this.agents.has(parent)) this.actionAgent(parent, bloc);
        else this.actionMax(bloc);
      }
    } else if (msg.type === 'user' && Array.isArray(msg.message?.content)) {
      for (const bloc of msg.message.content) {
        if (bloc.type === 'tool_result' && this.agents.has(bloc.tool_use_id)) {
          this.departAgent(bloc.tool_use_id, texteResultat(bloc.content));
        }
      }
    } else if (msg.type === 'result') {
      this.cout = msg.total_cost_usd;
      this.terminer(!msg.is_error, msg.result || '');
    }
  }

  actionMax(bloc) {
    if (bloc.type === 'text' && bloc.text.trim()) {
      this.emettre({ type: 'max:dit', texte: bloc.text.trim() });
    } else if (bloc.type === 'tool_use' && OUTILS_AGENT.has(bloc.name)) {
      const m = this.membre(bloc.input?.subagent_type);
      const tache = bloc.input?.description || 'Nouvelle tâche';
      this.agents.set(bloc.id, { membre: m, tache });
      this.emettre({ type: 'agent:arrive', id: bloc.id, membre: m, tache, consigne: bloc.input?.prompt || '' });
    } else if (bloc.type === 'tool_use') {
      this.emettre({ type: 'max:action', ...decrireOutil(bloc.name, bloc.input) });
    }
  }

  actionAgent(id, bloc) {
    if (bloc.type === 'tool_use') {
      this.emettre({ type: 'agent:action', id, ...decrireOutil(bloc.name, bloc.input) });
    } else if (bloc.type === 'text' && bloc.text.trim()) {
      this.emettre({ type: 'agent:action', id, icone: '💬', texte: bloc.text.trim() });
    }
  }

  departAgent(id, resume) {
    const a = this.agents.get(id);
    if (!a) return;
    this.agents.delete(id);
    this.emettre({ type: 'agent:part', id, resume: resume.slice(0, 1500) });
  }

  terminer(ok, texte) {
    if (this.fini) return;
    this.fini = true;
    for (const id of [...this.agents.keys()]) this.departAgent(id, '');
    const fichiers = listerFichiers(this.dossier);
    try { fs.writeFileSync(path.join(this.dossier, 'BILAN.md'), `# Bilan\n\n${texte}\n`); } catch { /* ignore */ }
    this.emettre({ type: 'mission:fin', id: this.id, ok, texte, cout: this.cout, fichiers });
  }
}

function texteResultat(contenu) {
  if (typeof contenu === 'string') return contenu;
  if (Array.isArray(contenu)) return contenu.filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  return '';
}

export function listerFichiers(dossier, base = dossier, profondeur = 0) {
  let res = [];
  if (profondeur > 3) return res;
  let entrees = [];
  try { entrees = fs.readdirSync(dossier, { withFileTypes: true }); } catch { return res; }
  for (const e of entrees) {
    if (e.name.startsWith('.')) continue;
    const p = path.join(dossier, e.name);
    if (e.isDirectory()) res = res.concat(listerFichiers(p, base, profondeur + 1));
    else if (!['DEMANDE.md', 'BILAN.md'].includes(e.name)) res.push(path.relative(base, p).split(path.sep).join('/'));
  }
  return res.slice(0, 100);
}

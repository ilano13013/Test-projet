// Traduit un appel d'outil Claude Code en petite phrase pour la bulle.
const court = (s, n = 48) => {
  s = String(s ?? '').replace(/\s+/g, ' ').trim();
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
};
const fichier = (p) => court(String(p ?? '').split(/[\\/]/).pop(), 40);
const domaine = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return court(u, 30); } };

export function decrireOutil(nom, input = {}) {
  switch (nom) {
    case 'WebSearch': return { icone: '🔎', texte: `Cherche « ${court(input.query, 40)} »`, outil: nom };
    case 'WebFetch': return { icone: '🌐', texte: `Lit ${domaine(input.url)}`, outil: nom };
    case 'Read': return { icone: '📖', texte: `Lit ${fichier(input.file_path)}`, outil: nom };
    case 'Write': return { icone: '✍️', texte: `Écrit ${fichier(input.file_path)}`, outil: nom };
    case 'Edit':
    case 'MultiEdit': return { icone: '✏️', texte: `Retouche ${fichier(input.file_path)}`, outil: nom };
    case 'Glob': return { icone: '🗂️', texte: `Cherche des fichiers ${court(input.pattern, 24)}`, outil: nom };
    case 'Grep': return { icone: '🔍', texte: `Fouille « ${court(input.pattern, 28)} »`, outil: nom };
    case 'Bash': return { icone: '⌨️', texte: `Lance ${court(input.command, 36)}`, outil: nom };
    case 'TodoWrite': return { icone: '📝', texte: 'Organise sa liste de tâches', outil: nom };
    default: return { icone: '⚙️', texte: `Utilise ${nom}`, outil: nom };
  }
}

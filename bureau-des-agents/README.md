# 🏢 Mon Bureau des agents

**Tu dis ce que tu veux. Une équipe d'agents IA se met au travail sous tes yeux.**

Un petit bureau en pixel art au-dessus de Claude Code. **Max**, le chef de
projet, lit ta demande et appelle les bons spécialistes. Ils entrent par la
porte, s'installent à leur bureau, et chaque bulle montre ce qu'ils font
vraiment, à cet instant. Ce ne sont pas des animations : chaque robot est un
vrai agent Claude Code, qui tourne sur ton ordinateur avec ton abonnement.

Inspiré de [devlikemasta/bureau-des-agents](https://github.com/devlikemasta/bureau-des-agents),
réécrit de zéro : **aucune dépendance, aucun build**, juste Node et un navigateur.

## L'équipe

| | Nom | Métier | Outils Claude Code |
|---|---|---|---|
| 🟠 | **Max** | Chef de projet | `Agent`, `Read`, `Glob` |
| 🔵 | **Léa** | Recherche | `WebSearch`, `WebFetch`, `Read`, `Write` |
| 🟢 | **Hugo** | Code | `Read`, `Write`, `Edit`, `Glob`, `Grep` |
| 🩷 | **Inès** | Design | `Read`, `Write`, `Edit`, `Glob` |
| 🟣 | **Paul** | Rédaction | `Read`, `Write`, `Edit` |
| 🔴 | **Zoé** | Analyse | `Read`, `Write`, `Glob`, `Grep` |
| 🟡 | **Noé** | Relecture | `Read`, `Edit`, `Glob`, `Grep` |

C'est **ton** équipe : ouvre `equipe.json` pour changer les noms, les métiers,
les couleurs, les consignes (`prompt`) ou les outils de chacun, ou ajouter un
spécialiste (8 bureaux disponibles). Tu peux aussi fixer un modèle par agent
avec `"modele": "haiku"` par exemple. Recharge la page et c'est pris en compte.

## Deux façons de l'ouvrir

| | Version web (`web/bureau.html`) | Version Claude Code (`npm start`) |
|---|---|---|
| Installation | **Aucune** : un lien claude.ai | Node.js 20+ et Claude Code |
| Qui travaille | Claude, avec ton compte claude.ai | De vrais agents Claude Code |
| Fichiers produits | Dans la page : aperçu + téléchargement `.zip` | Sur ton disque, dans `~/Documents/…` |
| Recherche web | Non (connaissances de Claude) | Oui (`WebSearch`, `WebFetch`) |
| Équipe | Modifiable dans l'onglet 👥 | Modifiable dans `equipe.json` |

La version web est un seul fichier autonome, publié comme page claude.ai.
Ouvert directement depuis le disque (double-clic), il ne peut pas joindre Claude
et passe en mode démo.

## Lancer la version Claude Code

Il faut **Node.js 20+** et **Claude Code** installé et connecté (`claude` dans un terminal).

```bash
cd bureau-des-agents
npm start
```

Le bureau ouvre sur **http://localhost:4848**. `Ctrl + C` pour fermer.

Pour découvrir le bureau sans consommer ton abonnement : coche **Démo** dans
l'interface, ou lance `npm run demo` (aucune requête vers Claude).

Astuce : `Ctrl + Entrée` envoie la demande à Max.

## Comment ça marche

```
navigateur ──POST /api/mission──▶ server/index.js ──spawn──▶ claude -p … --agents <équipe>
     ▲                                  │                         │ (Max = agent principal,
     └──────── SSE /api/evenements ◀────┴── server/mission.js ◀───┘  spécialistes = sous-agents)
                                            traduit le stream-json
```

- `server/mission.js` lance **un seul** `claude -p` en `--output-format stream-json`.
  Max est l'agent principal ; l'équipe d'`equipe.json` lui est donnée via `--agents`.
- Quand Max appelle l'outil `Agent`, un robot entre par la porte.
  Les messages dont `parent_tool_use_id` pointe vers cet appel deviennent ses bulles
  (`WebSearch` → 🔎, `Write` → ✍️, `Edit` → ✏️…, voir `server/outils.js`).
  Quand le résultat de l'appel revient, le robot dépose son livrable chez Max et repart.
- `public/js/pixel.js` dessine tout le bureau sur un canvas 352 × 256 :
  pas une seule image, tout le pixel art est généré en code.
- `public/js/app.js` gère les bulles, la boîte de dialogue de Max, les onglets
  Mission / Équipe / Journal et les petits bips.

## Sécurité

- Le serveur écoute **uniquement sur 127.0.0.1**.
- Claude tourne en `--restricted` : pas de `Bash` ni d'exécution de code, et les
  outils de fichiers sont confinés au dossier de la mission.
- Seuls les outils listés dans `equipe.json` sont disponibles, en `acceptEdits`.
- Les sites produits par l'équipe s'ouvrent dans un bac à sable (`CSP: sandbox`).

## Où sont mes livrables ?

Chaque mission a son dossier dans `~/Documents/Bureau des agents/Missions/`
(avec `DEMANDE.md` et `BILAN.md`). Les fichiers produits sont aussi listés
dans l'onglet **📋 Mission** à la fin.

## Réglages (variables d'environnement)

| Variable | Rôle | Défaut |
|---|---|---|
| `PORT` | Port du bureau | `4848` |
| `BUREAU_MISSIONS` | Dossier des missions | `~/Documents/Bureau des agents/Missions` |
| `BUREAU_MODELE` | Modèle de Max (`opus`, `sonnet`, `haiku`…) | celui de Claude Code |
| `CLAUDE_BIN` | Chemin vers l'exécutable `claude` | `claude` |

Licence MIT.

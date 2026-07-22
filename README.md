# Les Curieux — jeu web d'infiltration nocturne

Le joueur contrôle une petite étoile qui doit traverser des niveaux sans se
faire observer par trois personnages : **les Curieux**. L'application reprend
et prolonge l'identité graphique de l'écran de connexion d'origine : bleu nuit
étoilé, cartes blanches, silhouettes minimalistes et légèrement humoristiques.

## Lancer le projet

Aucune dépendance, aucun build : ouvrez simplement `index.html` dans un
navigateur (ou servez le dossier avec n'importe quel serveur statique).

```bash
xdg-open index.html    # Linux
open index.html        # macOS
```

## Structure

```
index.html          coquille de l'application (SPA à routage par hash)
css/style.css       identité graphique commune + tous les écrans
js/peeps.js         composant réutilisable : les trois silhouettes animées
js/auth.js          comptes + session (PBKDF2-SHA256, jamais de clair)
js/save.js          progression, étoiles, apparences, réglages (par compte)
js/router.js        routeur #/… avec protection des routes authentifiées
js/screens.js       connexion, inscription, mot de passe oublié, menu,
                    niveaux, profil, paramètres
js/game.js          moteur du jeu (canvas 2D) + définition des niveaux
js/main.js          point d'entrée : décor, enregistrement des routes
```

## Routes

| Route | Accès | Contenu |
|---|---|---|
| `#/login` | invité | connexion (silhouettes curieuses / regard détourné) |
| `#/register` | invité | création de compte |
| `#/forgot` | invité | réinitialisation du mot de passe (démo locale) |
| `#/menu` | connecté | menu principal (Jouer, Continuer, Niveaux, Profil, Paramètres) |
| `#/levels` | connecté | sélection des niveaux, étoiles et meilleurs temps |
| `#/game/:id` | connecté | écran de jeu |
| `#/profile` | connecté | statistiques, apparences débloquées, déconnexion |
| `#/settings` | connecté | vision discrète, réduction des animations |

Sans session, toute route protégée redirige vers `#/login`.

## Le jeu

- Déplacement : flèches, ZQSD, WASD, ou joystick tactile sur mobile.
- Un clic / tap dans le niveau produit un **petit bruit** (avec temps de
  recharge) qui attire l'attention du Distrait.
- Trois cœurs ; être vu remplit une jauge d'exposition qui, pleine, coûte un
  cœur (courte invincibilité ensuite). Objectif : la porte **SORTIE**.
- Étoiles : 3 sans détection, 2 avec une seule, 1 sinon.

Les trois comportements :

1. **Le Guetteur** suit directement le joueur du regard tant qu'aucun obstacle
   ne bloque sa ligne de vue.
2. **Le Distrait** balaie la zone mais se laisse détourner par les bruits.
3. **Le Méfiant** mémorise la dernière position où il a aperçu le joueur et la
   fixe (marquée d'un « ? ») avant de reprendre sa ronde.

Les champs de vision sont découpés par les obstacles (lancer de rayons) et
affichés en halo doux — ou en simple contour pointillé avec le réglage
« Champs de vision discrets ».

## Authentification et sauvegarde — limites honnêtes

Le projet est 100 % statique, sans serveur. Les comptes vivent donc dans le
`localStorage` du navigateur : les mots de passe n'y sont **jamais stockés en
clair** (dérivation PBKDF2-SHA256, sel aléatoire par compte, 120 000
itérations via Web Crypto), la session est persistante et les routes du jeu
sont protégées côté client. C'est une architecture propre pour une démo, mais
une vraie mise en production nécessiterait un backend : la « réinitialisation »
du mot de passe, sans e-mail sortant, est ici assumée comme un mode démo.

La progression (niveaux terminés, meilleurs temps, apparences débloquées,
réglages) est associée au compte connecté.

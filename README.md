# Les Curieux — jeu web d'infiltration 2D

Le joueur contrôle une petite étoile qui doit traverser des niveaux courts et
exigeants sans se faire observer par les **Curieux**. Jeu 2D minimaliste,
mystérieux et fluide, dans la direction artistique d'origine (bleu nuit
étoilé, cartes blanches, silhouettes). Aucune dépendance, aucun build.

## Lancer

Ouvrez `index.html` dans un navigateur, ou servez le dossier statiquement.

```bash
xdg-open index.html    # Linux
open index.html        # macOS
```

## Architecture (SPA vanilla, namespace global `LC`, canvas 2D)

```
index.html         coquille + ordre de chargement des scripts
css/style.css      identité graphique + tous les écrans + HUD de jeu

js/util.js         maths, easing, RNG à graine, géométrie, pool d'objets
js/peeps.js        composant réutilisable : les silhouettes animées (auth)
js/auth.js         comptes + session (PBKDF2-SHA256, jamais de clair)
js/levels.js       CONFIG des niveaux — Monde 1 (10 niveaux + boss)
js/save.js         progression par compte (mondes, étoiles, fragments,
                   détections min, fantômes, réglages, remap des touches)
js/enemy.js        machine à états des ennemis (6 phases, 3 comportements + boss)
js/player.js       physique du joueur (marche/sprint/endurance/inertie) + anim
js/engine.js       moteur : caméra, particules, rendu, détection, tutoriels,
                   résultats partageables, fantôme, défi quotidien
js/screens.js      auth, menu, carte des mondes, sélection des niveaux,
                   profil, paramètres (accessibilité + touches)
js/router.js       routeur #/… avec protection des routes
js/main.js         point d'entrée
```

## Routes

`#/login` `#/register` `#/forgot` (invité) · `#/menu` `#/worlds`
`#/world/:id` `#/game/:levelId` `#/profile` `#/settings` (connecté).
`#/game/daily` lance le défi du jour ; `#/game/seed-XXXX` une graine.

## Le jeu

- **Déplacement** : flèches, ZQSD, WASD, joystick + bouton Sprint sur mobile.
  Marche discrète, **sprint** rapide mais bruyant et plus visible, consommant
  une **endurance** limitée ; inertie et décélération fluides, on longe les murs.
- **Bruit** : chaque action a une intensité (marche, sprint, choc, bruit
  volontaire). Un clic/tap ou la touche Bruit émet une onde qui attire
  le Distrait (temps de recharge).
- **Détection progressive** (jauge, pas instantanée) en 6 états : calme →
  soupçon → recherche → détection → poursuite → retour. Le champ de vision
  change de couleur et d'intensité, les yeux réagissent, un symbole apparaît
  au-dessus du Curieux. Être détecté coûte un cœur (invincibilité brève).
- **Objectif** : atteindre la porte SORTIE (parfois conditionnée à des
  fragments). Écran d'objectifs avant chaque niveau, résultats après.

### Les trois Curieux (+ boss)

- **Le Guetteur** — vision longue, balaie sa zone, vous suit s'il vous voit,
  réagit peu au bruit.
- **Le Distrait** — vision moyenne, fortement attiré par les bruits ; il se
  déplace jusqu'à la source, reste confus un instant, puis récupère (pas de
  distraction en continu).
- **Le Méfiant** — vision plus courte mais meilleure mémoire : il retient la
  dernière position vue, l'inspecte, cherche autour et anticipe votre trajet.
- **L'Œil du Vestibule** (boss du niveau 10) — grand champ de vision mobile,
  plusieurs phases déclenchées par les fragments, checkpoints limités,
  courte cinématique à la victoire.

## Notation (jusqu'à 3 étoiles)

- ★ terminer le niveau ;
- ★★ terminer sans perdre de cœur ;
- ★★★ battre le temps cible **et** récupérer tous les fragments.

L'écran de fin affiche temps, meilleur temps, détections, fragments, étoiles,
objectifs réussis, et une **carte de résultat partageable** (nom, rang, graine,
phrase humoristique) copiable en un clic. Boutons Rejouer / Suivant / Carte.

## Rejouabilité

- **Défi du jour** généré depuis la date (graine du jour) ;
- **graines** affichables et copiables (niveaux reproductibles) ;
- **fantôme personnel** : votre meilleur trajet est enregistré et rejoué en
  transparence ;
- architecture prête pour classement, mode sans détection et speedrun.

## Accessibilité & performances

- Clavier, souris et tactile ; **remappage des touches** dans les réglages ;
- options : réduire les animations, désactiver les secousses de caméra,
  masquer les champs de vision (mode expert) ;
- indices non uniquement chromatiques (symboles, formes, marqueurs) ;
- boucle à delta time, particules **poolées** (pas de réallocation), gestion
  du redimensionnement via `ResizeObserver`.

## Progression & sécurité

Progression associée au compte connecté (niveaux terminés, étoiles, meilleurs
temps, détections minimales, fragments, apparences, monde débloqué, fantômes).
Le projet est 100 % statique : les comptes vivent dans `localStorage`, les mots
de passe n'y sont jamais en clair (PBKDF2-SHA256, sel par compte). C'est une
démo propre ; une mise en production réelle nécessiterait un backend.

## Étendre le jeu

Ajouter un niveau = ajouter un objet dans `js/levels.js` (aucune logique à
toucher). Ajouter un monde = un nouvel objet dans `WORLDS`. Le schéma d'un
niveau est documenté en tête de `js/levels.js`.

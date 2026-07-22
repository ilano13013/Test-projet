/* Point d'entrée : décor étoilé de fond, enregistrement des routes, rendu. */
(function () {
  const stars = document.getElementById('stars');
  for (let i = 0; i < 40; i++) {
    const s = document.createElement('span');
    s.style.left = Math.random() * 100 + 'vw';
    s.style.top = Math.random() * 100 + 'vh';
    s.style.animationDelay = (Math.random() * 3) + 's';
    stars.appendChild(s);
  }

  const R = LC.router;
  R.register('login', LC.screens.loginScreen, { guest: true });
  R.register('register', LC.screens.registerScreen, { guest: true });
  R.register('forgot', LC.screens.forgotScreen, { guest: true });
  R.register('menu', LC.screens.menuScreen, { auth: true });
  R.register('worlds', LC.screens.worldsScreen, { auth: true });
  R.register('world', LC.screens.worldScreen, { auth: true });
  R.register('game', LC.game.createGameScreen, { auth: true });
  R.register('profile', LC.screens.profileScreen, { auth: true });
  R.register('settings', LC.screens.settingsScreen, { auth: true });

  if (!location.hash || location.hash === '#' || location.hash === '#/') {
    location.replace('#' + R.defaultRoute());
  }
  R.render();
})();

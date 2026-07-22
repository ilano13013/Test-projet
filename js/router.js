/* Routeur par hash (#/login, #/menu, #/game/1…), compatible fichier statique.
   Les routes marquées auth:true sont protégées : sans session, retour au login. */
window.LC = window.LC || {};

LC.router = (function () {
  const routes = {};
  let activeCleanup = null;

  function register(name, screenFn, opts = {}) {
    routes[name] = { fn: screenFn, auth: !!opts.auth, guest: !!opts.guest };
  }

  function parse() {
    const hash = location.hash.replace(/^#\/?/, '');
    const [name, ...rest] = hash.split('/');
    return { name: name || '', param: rest.join('/') || null };
  }

  function go(path) {
    if (location.hash === '#' + path.replace(/^#/, '')) render();
    else location.hash = path;
  }

  function defaultRoute() {
    return LC.auth.current() ? '/menu' : '/login';
  }

  function render() {
    const { name, param } = parse();
    let route = routes[name];

    if (!route) { location.replace('#' + defaultRoute()); return; }
    const user = LC.auth.current();
    if (route.auth && !user) { location.replace('#/login'); return; }
    if (route.guest && user) { location.replace('#/menu'); return; }

    if (activeCleanup) { try { activeCleanup(); } catch {} activeCleanup = null; }

    const app = document.getElementById('app');
    app.innerHTML = '';
    const result = route.fn(param) || {};
    if (result.el) app.appendChild(result.el);
    activeCleanup = result.cleanup || null;
    window.scrollTo(0, 0);
  }

  window.addEventListener('hashchange', render);

  return { register, go, render, defaultRoute };
})();

// Loads the static data files that ship with the site. Nothing is ever sent anywhere:
// the only network requests are for these files, from the same place the page came from.
(function () {
  const FILES = { units: 'data/units.json', abilities: 'data/abilities.json', cards: 'data/cards.json', products: 'data/products.json', terrain: 'data/terrain.json', maps: 'data/maps.json' };
  const LAZY = new Set(['cards']); // card pictures are large, so they load on first use
  const S = {};
  const subs = [];
  let queued = false;
  const notify = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; for (const fn of subs) fn(); });
  };
  function load(id) {
    if (S[id]) return;
    S[id] = { status: 'loading', data: [] };
    fetch(FILES[id])
      .then((r) => { if (!r.ok) throw new Error(r.status + ' ' + r.statusText); return r.json(); })
      .then((rows) => { S[id] = { status: 'ok', data: rows }; notify(); })
      .catch((e) => { S[id] = { status: 'error', data: [], message: String(e.message || e) }; notify(); });
  }
  for (const id of Object.keys(FILES)) if (!LAZY.has(id)) load(id);
  let lastW = window.innerWidth;
  window.addEventListener('resize', () => { if (Math.abs(window.innerWidth - lastW) > 40) { lastW = window.innerWidth; notify(); } });
  window.dash = {
    data(id) {
      if (!FILES[id]) return { status: 'missing', data: [] };
      load(id);
      return S[id];
    },
    peek(id) { return S[id] ? S[id].status : 'not loaded'; }, // status without starting a download
    onData(fn) { subs.push(fn); fn(); },
    setLink(name) { try { history.replaceState(null, '', '#' + name); } catch (e) { /* not allowed in some frames */ } }
  };
})();

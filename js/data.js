// Loads the static data files that ship with the site. Nothing is ever sent anywhere:
// the only network requests are for these files, from the same place the page came from.
(function () {
  const FILES = { units: 'data/units.json', abilities: 'data/abilities.json', cards: 'data/cards.json', products: 'data/products.json', terrain: 'data/terrain.json', maps: 'data/maps.json', errata: 'data/errata.json' };
  const V = '6f609b1e02'; // the build puts a version tag here, so an update never mixes old cached data with new code
  const LAZY = new Set(); // anything large can be listed here to load on first use (card pictures are now separate small files)
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
    fetch(FILES[id] + (V ? '?v=' + V : ''))
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

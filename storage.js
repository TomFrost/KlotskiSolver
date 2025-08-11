(function(){
  const STORAGE_KEY = 'klotski.puzzles.v1';
  const DEFAULT_KEY = 'klotski.default.v1';

  function loadAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const data = JSON.parse(raw);
      return (data && typeof data === 'object') ? data : {};
    } catch { return {}; }
  }

  function saveAll(map) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  }

  function savePuzzle(name, state) {
    const map = loadAll();
    map[name] = state;
    saveAll(map);
  }

  function deletePuzzle(name) {
    const map = loadAll();
    delete map[name];
    saveAll(map);
    const def = getDefaultName();
    if (def === name) clearDefaultName();
  }

  function getPuzzle(name) {
    const map = loadAll();
    return map[name] || null;
  }

  function listNames() {
    return Object.keys(loadAll()).sort();
  }

  function setDefaultName(name) {
    if (!name) return clearDefaultName();
    localStorage.setItem(DEFAULT_KEY, name);
  }

  function getDefaultName() {
    return localStorage.getItem(DEFAULT_KEY) || '';
  }

  function clearDefaultName() {
    localStorage.removeItem(DEFAULT_KEY);
  }

  window.Klotski = window.Klotski || {};
  window.Klotski.Storage = {
    savePuzzle,
    deletePuzzle,
    getPuzzle,
    listNames,
    setDefaultName,
    getDefaultName,
    clearDefaultName,
  };
})();

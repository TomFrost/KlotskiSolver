// Utility helpers in global namespace
(function(){
  const Klotski = window.Klotski = window.Klotski || {};

  /** Generate simple A, B, C... IDs, then AA, AB... */
  function createIdGenerator() {
    let index = 0;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    return function nextId() {
      let i = index++;
      let out = '';
      do {
        out = alphabet[i % 26] + out;
        i = Math.floor(i / 26) - 1;
      } while (i >= 0);
      return out;
    };
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  /** Rectangle collision check on grid coordinates */
  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  /** Point inside rect on pixel coordinates */
  function pointInRect(px, py, rect) {
    return px >= rect.x && px < rect.x + rect.w && py >= rect.y && py < rect.y + rect.h;
  }

  Klotski.utils = { createIdGenerator, clamp, deepClone, rectsOverlap, pointInRect };
})();

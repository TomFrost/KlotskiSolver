(function(){
  const { createIdGenerator, clamp, rectsOverlap, deepClone } = window.Klotski.utils;

  /** Model representing the board state and interactions */
  class BoardModel {
    constructor({ cols = 4, rows = 5, goalX = 1, goalY = 3 } = {}) {
      this.cols = cols;
      this.rows = rows;
      this.goal = { x: goalX, y: goalY, w: 2, h: 2 };
      this.pieces = []; // { id, type, x, y, w, h }
      this.selectedId = null;
      this.nextId = createIdGenerator();
      this.lastSavedState = null; // for Reset
    }

    setBoardSize(cols, rows) {
      this.cols = clamp(cols, 3, 8);
      this.rows = clamp(rows, 4, 10);
      // Move goal inside bounds if needed
      this.goal.x = clamp(this.goal.x, 0, this.cols - this.goal.w);
      this.goal.y = clamp(this.goal.y, 0, this.rows - this.goal.h);
      // Remove any pieces that no longer fit
      this.pieces = this.pieces.filter(p => p.x + p.w <= this.cols && p.y + p.h <= this.rows);
    }

    setGoalPosition(x, y) {
      this.goal.x = clamp(x, 0, this.cols - this.goal.w);
      this.goal.y = clamp(y, 0, this.rows - this.goal.h);
    }

    clear() {
      this.pieces = [];
      this.selectedId = null;
      this.nextId = createIdGenerator(); // Reset ID generator to start from 'A'
    }

    resetToLastSaved() {
      if (this.lastSavedState) {
        this.loadState(this.lastSavedState);
      }
    }

    saveStateSnapshot() {
      this.lastSavedState = this.getInitialState();
    }

    createPiece(type, x, y) {
      const size = BoardModel.typeToSize(type);
      // Do not assign an id yet; only consume an id when successfully added
      const piece = { type, x, y, ...size };
      return piece;
    }

    static typeToSize(type) {
      switch (type) {
        case '2x2': return { w: 2, h: 2 };
        case '2x1': return { w: 2, h: 1 };
        case '1x2': return { w: 1, h: 2 };
        case '1x1': return { w: 1, h: 1 };
        default: throw new Error('Unknown piece type: ' + type);
      }
    }

    /** Add a piece if it fits and does not collide */
    tryAddPiece(piece) {
      if (!this.inBounds(piece)) return false;
      if (this.collidesAny(piece)) return false;
      if (!piece.id) piece.id = this.nextId();
      this.pieces.push(piece);
      return true;
    }

    /** Attempt to move a piece by dx,dy grid steps if legal */
    tryMovePiece(id, dx, dy) {
      const piece = this.pieces.find(p => p.id === id);
      if (!piece) return false;
      const target = { ...piece, x: piece.x + dx, y: piece.y + dy };
      if (!this.inBounds(target)) return false;
      if (this.collidesAny(target, id)) return false;
      piece.x = target.x; piece.y = target.y;
      return true;
    }

    inBounds(rect) {
      return rect.x >= 0 && rect.y >= 0 && rect.x + rect.w <= this.cols && rect.y + rect.h <= this.rows;
    }

    collidesAny(rect, ignoreId = null) {
      return this.pieces.some(p => p.id !== ignoreId && rectsOverlap(rect, p));
    }

    /** Get serializable initial state for solver */
    getInitialState() {
      return {
        cols: this.cols,
        rows: this.rows,
        goal: deepClone(this.goal),
        pieces: deepClone(this.pieces),
      };
    }

    /** Load a full board state (replaces current). Re-seeds ID generator to avoid collisions. */
    loadState(state) {
      this.cols = state.cols;
      this.rows = state.rows;
      this.goal = deepClone(state.goal);
      this.pieces = deepClone(state.pieces || []);
      this.selectedId = null;
      this.#reseedIdGeneratorFromPieces();
    }

    #reseedIdGeneratorFromPieces() {
      const used = new Set(this.pieces.map(p => p.id));
      const baseNext = createIdGenerator();
      this.nextId = function() {
        let id;
        do { id = baseNext(); } while (used.has(id));
        used.add(id);
        return id;
      };
    }
  }

  window.Klotski.BoardModel = BoardModel;
})();

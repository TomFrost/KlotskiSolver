(function(){
  /** Animate a sequence of moves on the model, calling render on each step */
  async function animateMoves({ model, renderer, moves, msPerStep = 300, onStatus, getSpeed }) {
    function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // Interpolate one grid step for a single piece
    function easeInOutSine(t) {
      return 0.5 - 0.5 * Math.cos(Math.PI * t);
    }

    async function animateSingleStep(pieceId, dx, dy, durationMs) {
      const piece = model.pieces.find(p => p.id === pieceId);
      if (!piece) throw new Error('Unknown piece id: ' + pieceId);
      const from = { x: piece.x, y: piece.y };
      const to = { x: piece.x + dx, y: piece.y + dy };

      const start = performance.now();
      const end = start + durationMs;
      while (true) {
        const now = performance.now();
        const t = Math.min(1, (now - start) / (durationMs || 1));
        const te = easeInOutSine(t);
        renderer.draw(model.selectedId, null, { id: pieceId, from, to, t: te });
        if (t >= 1) break;
        await sleep(16);
      }

      // Commit the logical move at the end to preserve collision rules already validated by solver
      const ok = model.tryMovePiece(pieceId, dx, dy);
      if (!ok) throw new Error(`Illegal move when committing animation: {id:${pieceId}, dx:${dx}, dy:${dy}}`);
    }

    let step = 0;
    for (const move of moves) {
      const count = Math.max(1, move.count ?? 1);
      step++;

      // Show status message for the move (including count if > 1)
      const statusText = count > 1
        ? `Step ${step}: ${move.id} ${move.dir} ${count} times`
        : `Step ${step}: ${move.id} ${move.dir}`;
      onStatus?.(statusText);

      // Animate each individual step
      for (let i = 0; i < count; i++) {
        let dx = 0, dy = 0;
        if (move.dir === 'left') dx = -1; else if (move.dir === 'right') dx = 1; else if (move.dir === 'up') dy = -1; else if (move.dir === 'down') dy = 1;
        // Get current speed for this step (use getSpeed function if provided, otherwise use msPerStep)
        const currentSpeed = getSpeed ? getSpeed() : msPerStep;
        await animateSingleStep(move.id, dx, dy, currentSpeed);
      }
    }
  }

  window.Klotski = window.Klotski || {};
  window.Klotski.animateMoves = animateMoves;
})();

(function(){
  /** Animate a sequence of moves on the model, calling render on each step */
  async function animateMoves({ model, renderer, moves, msPerStep = 300, onStatus, getSpeed, onProgress, onComplete }) {
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

  /** Controllable animation player with pause/step functionality */
  class AnimationPlayer {
    constructor({ model, renderer, moves, msPerStep = 300, onStatus, getSpeed, onProgress, onComplete }) {
      this.model = model;
      this.renderer = renderer;
      this.moves = moves;
      this.msPerStep = msPerStep;
      this.getSpeed = getSpeed;
      this.onStatus = onStatus;
      this.onProgress = onProgress;
      this.onComplete = onComplete;

      this.currentStep = 0;
      this.isPlaying = false;
      this.isPaused = false;
      this.pendingPause = false; // Pause after current animation completes
      this.animationPromise = null;
      this.animationResolve = null;
      this.animationReject = null;
    }

    // Get current move info
    getCurrentMove() {
      if (this.currentStep >= this.moves.length) return null;
      const move = this.moves[this.currentStep];
      const count = Math.max(1, move.count ?? 1);
      return {
        move,
        count,
        isComplete: false // Always false since we don't track partial completion
      };
    }

    // Get total progress (0-1)
    getProgress() {
      if (this.moves.length === 0) return 0;
      const totalMoves = this.moves.length;
      const completedMoves = this.currentStep;
      return totalMoves > 0 ? completedMoves / totalMoves : 0;
    }

    // Get total number of moves
    getTotalSteps() {
      return this.moves.length;
    }

    // Get current move number (1-based for UI display)
    getCurrentStepNumber() {
      return this.currentStep;
    }

    // Seek to a specific progress position (0-1)
    seekToProgress(progress) {
      // Clamp progress between 0 and 1
      progress = Math.max(0, Math.min(1, progress));

      const totalMoves = this.moves.length;
      const targetMove = Math.floor(progress * totalMoves);

      // Reset to beginning
      this.model.resetToLastSaved();
      this.currentStep = 0;

      // Apply complete moves up to target move
      for (let moveIndex = 0; moveIndex < targetMove && moveIndex < this.moves.length; moveIndex++) {
        const move = this.moves[moveIndex];
        const count = Math.max(1, move.count ?? 1);

        // Apply the full move (all individual steps at once)
        for (let step = 0; step < count; step++) {
          let dx = 0, dy = 0;
          if (move.dir === 'left') dx = -1;
          else if (move.dir === 'right') dx = 1;
          else if (move.dir === 'up') dy = -1;
          else if (move.dir === 'down') dy = 1;

          const ok = this.model.tryMovePiece(move.id, dx, dy);
          if (!ok) throw new Error(`Illegal move when seeking: {id:${move.id}, dx:${dx}, dy:${dy}}`);
        }

        this.currentStep++;
      }

      // Update the display
      this.renderer.draw(this.model.selectedId);
      this.onProgress?.(this.getProgress());
      this.showCurrentStepStatus();
    }

        // Reset to beginning
    reset() {
      this.currentStep = 0;
      this.isPlaying = false;
      this.isPaused = false;
      this.pendingPause = false;
      this.model.resetToLastSaved();
      this.renderer.draw(this.model.selectedId);
      this.onProgress?.(this.getProgress());
      this.onStatus?.('Ready to solve');
    }

    // Jump to end
    jumpToEnd() {
      this.currentStep = this.moves.length;
      this.isPlaying = false;
      this.isPaused = false;
      this.pendingPause = false;

      // Apply all moves to get to final state
      this.model.resetToLastSaved();
      for (const move of this.moves) {
        const count = Math.max(1, move.count ?? 1);
        for (let i = 0; i < count; i++) {
          let dx = 0, dy = 0;
          if (move.dir === 'left') dx = -1;
          else if (move.dir === 'right') dx = 1;
          else if (move.dir === 'up') dy = -1;
          else if (move.dir === 'down') dy = 1;

          const ok = this.model.tryMovePiece(move.id, dx, dy);
          if (!ok) throw new Error(`Illegal move: {id:${move.id}, dx:${dx}, dy:${dy}}`);
        }
      }

      this.renderer.draw(this.model.selectedId);
      this.onProgress?.(this.getProgress());
      this.onStatus?.(`Solution complete - ${this.moves.length} moves`);
      this.onComplete?.();
    }

        // Step forward one complete move
    stepForward() {
      if (this.currentStep >= this.moves.length) return false;

      const move = this.moves[this.currentStep];
      const count = Math.max(1, move.count ?? 1);

      // Execute the complete move (all individual steps)
      for (let i = 0; i < count; i++) {
        let dx = 0, dy = 0;
        if (move.dir === 'left') dx = -1;
        else if (move.dir === 'right') dx = 1;
        else if (move.dir === 'up') dy = -1;
        else if (move.dir === 'down') dy = 1;

        const ok = this.model.tryMovePiece(move.id, dx, dy);
        if (!ok) throw new Error(`Illegal move: {id:${move.id}, dx:${dx}, dy:${dy}}`);
      }

      this.currentStep++;
      this.renderer.draw(this.model.selectedId);
      this.onProgress?.(this.getProgress());

      // Show status message for the move that was just executed
      const totalMoves = this.getTotalSteps();
      const currentMoveNum = this.getCurrentStepNumber();
      const statusText = count > 1
        ? `Move ${currentMoveNum} of ${totalMoves}: ${move.id} ${move.dir} ${count} spaces`
        : `Move ${currentMoveNum} of ${totalMoves}: ${move.id} ${move.dir}`;
      this.onStatus?.(statusText);

      if (this.currentStep >= this.moves.length) {
        this.onComplete?.();
        return false;
      }

      return true;
    }

    // Step backward one complete move
    stepBackward() {
      if (this.currentStep <= 0) return false;

      // Go back one complete move
      this.currentStep--;
      const move = this.moves[this.currentStep];
      const count = Math.max(1, move.count ?? 1);

      // Undo the complete move (all individual steps in reverse)
      for (let i = 0; i < count; i++) {
        let dx = 0, dy = 0;
        if (move.dir === 'left') dx = 1; // Undo left = right
        else if (move.dir === 'right') dx = -1; // Undo right = left
        else if (move.dir === 'up') dy = 1; // Undo up = down
        else if (move.dir === 'down') dy = -1; // Undo down = up

        const ok = this.model.tryMovePiece(move.id, dx, dy);
        if (!ok) throw new Error(`Illegal undo move: {id:${move.id}, dx:${dx}, dy:${dy}}`);
      }
      this.renderer.draw(this.model.selectedId);
      this.onProgress?.(this.getProgress());
      this.showCurrentStepStatus();

      return true;
    }



    // Start playing
    play() {
      if (this.isPlaying) return;
      if (this.currentStep >= this.moves.length) return;

      this.isPlaying = true;
      this.isPaused = false;
      this.animationPromise = this.playAnimation();
    }

    // Pause playing - wait for current animation to complete
    pause() {
      if (this.isPlaying) {
        this.pendingPause = true;
      } else {
        this.isPaused = true;
      }
    }

    // Resume playing
    resume() {
      this.isPaused = false;
      this.pendingPause = false;
    }

    // Stop playing
    stop() {
      this.isPlaying = false;
      this.isPaused = false;
      this.pendingPause = false;
    }

    // Main animation loop
    async playAnimation() {
      while (this.isPlaying && this.currentStep < this.moves.length) {
        if (this.isPaused) {
          await new Promise(resolve => setTimeout(resolve, 100));
          continue;
        }

        const move = this.moves[this.currentStep];
        const count = Math.max(1, move.count ?? 1);

        // Show status message
        const totalMoves = this.getTotalSteps();
        const currentMoveNum = this.currentStep + 1;
        const statusText = count > 1
          ? `Move ${currentMoveNum} of ${totalMoves}: ${move.id} ${move.dir} ${count} spaces`
          : `Move ${currentMoveNum} of ${totalMoves}: ${move.id} ${move.dir}`;
        this.onStatus?.(statusText);

        // Animate the full move (all spaces at once)
        let dx = 0, dy = 0;
        if (move.dir === 'left') dx = -count;
        else if (move.dir === 'right') dx = count;
        else if (move.dir === 'up') dy = -count;
        else if (move.dir === 'down') dy = count;

        const currentSpeed = this.getSpeed ? this.getSpeed() : this.msPerStep;
        await this.animateFullMove(move.id, dx, dy, count, currentSpeed);

        // Check for pending pause after animation completes
        if (this.pendingPause) {
          this.isPaused = true;
          this.pendingPause = false;
        }

        // Move completed, advance to next
        this.currentStep++;
        this.onProgress?.(this.getProgress());

        if (this.currentStep >= this.moves.length) {
          this.isPlaying = false;
          this.onComplete?.();
          break;
        }
      }
    }

    // Animate a full move (potentially multiple spaces) with interpolation
    async animateFullMove(pieceId, dx, dy, count, durationMs) {
      const piece = this.model.pieces.find(p => p.id === pieceId);
      if (!piece) throw new Error('Unknown piece id: ' + pieceId);
      const from = { x: piece.x, y: piece.y };
      const to = { x: piece.x + dx, y: piece.y + dy };

      const start = performance.now();
      const end = start + durationMs;

      while (true) {
        const now = performance.now();
        const t = Math.min(1, (now - start) / (durationMs || 1));
        const te = this.easeInOutSine(t);
        this.renderer.draw(this.model.selectedId, null, { id: pieceId, from, to, t: te });

        if (t >= 1) break;
        await new Promise(resolve => setTimeout(resolve, 16));
      }

      // Commit the logical moves (apply all individual steps)
      for (let i = 0; i < count; i++) {
        const stepDx = dx > 0 ? 1 : dx < 0 ? -1 : 0;
        const stepDy = dy > 0 ? 1 : dy < 0 ? -1 : 0;
        const ok = this.model.tryMovePiece(pieceId, stepDx, stepDy);
        if (!ok) throw new Error(`Illegal move when committing animation: {id:${pieceId}, step:${i+1}/${count}}`);
      }
    }

    // Animate a single step with interpolation
    async animateSingleStep(pieceId, dx, dy, durationMs) {
      const piece = this.model.pieces.find(p => p.id === pieceId);
      if (!piece) throw new Error('Unknown piece id: ' + pieceId);
      const from = { x: piece.x, y: piece.y };
      const to = { x: piece.x + dx, y: piece.y + dy };

      const start = performance.now();
      const end = start + durationMs;

      while (true) {
        const now = performance.now();
        const t = Math.min(1, (now - start) / (durationMs || 1));
        const te = this.easeInOutSine(t);
        this.renderer.draw(this.model.selectedId, null, { id: pieceId, from, to, t: te });

        if (t >= 1) break;
        await new Promise(resolve => setTimeout(resolve, 16));
      }

      // Commit the logical move
      const ok = this.model.tryMovePiece(pieceId, dx, dy);
      if (!ok) throw new Error(`Illegal move when committing animation: {id:${pieceId}, dx:${dx}, dy:${dy}}`);
    }

    // Show status message for current step position
    showCurrentStepStatus() {
      const totalMoves = this.getTotalSteps();
      const currentMoveNum = this.getCurrentStepNumber();

      if (this.currentStep === 0) {
        this.onStatus?.('Ready to solve');
        return;
      }

      if (this.currentStep >= this.moves.length) {
        this.onStatus?.(`Solution complete - ${this.moves.length} moves`);
        return;
      }

      // Show the last completed move
      const lastMove = this.moves[this.currentStep - 1];
      const count = Math.max(1, lastMove.count ?? 1);
      const statusText = count > 1
        ? `Move ${currentMoveNum} of ${totalMoves}: ${lastMove.id} ${lastMove.dir} ${count} spaces`
        : `Move ${currentMoveNum} of ${totalMoves}: ${lastMove.id} ${lastMove.dir}`;
      this.onStatus?.(statusText);
    }

    easeInOutSine(t) {
      return 0.5 - 0.5 * Math.cos(Math.PI * t);
    }
  }

  window.Klotski = window.Klotski || {};
  window.Klotski.animateMoves = animateMoves;
  window.Klotski.AnimationPlayer = AnimationPlayer;
})();

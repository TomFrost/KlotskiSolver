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
      this.currentSubStep = 0;
      this.isPlaying = false;
      this.isPaused = false;
      this.pendingPause = false; // Pause after current animation completes
      this.animationPromise = null;
      this.animationResolve = null;
      this.animationReject = null;
    }

    // Get current move and substep info
    getCurrentMove() {
      if (this.currentStep >= this.moves.length) return null;
      const move = this.moves[this.currentStep];
      const count = Math.max(1, move.count ?? 1);
      return {
        move,
        count,
        subStep: this.currentSubStep,
        isComplete: this.currentSubStep >= count
      };
    }

    // Get total progress (0-1)
    getProgress() {
      if (this.moves.length === 0) return 0;
      let totalSteps = 0;
      let completedSteps = 0;

      for (let i = 0; i < this.moves.length; i++) {
        const count = Math.max(1, this.moves[i].count ?? 1);
        totalSteps += count;
        if (i < this.currentStep) {
          completedSteps += count;
        } else if (i === this.currentStep) {
          completedSteps += this.currentSubStep;
        }
      }

      return totalSteps > 0 ? completedSteps / totalSteps : 0;
    }

        // Reset to beginning
    reset() {
      this.currentStep = 0;
      this.currentSubStep = 0;
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
      this.currentSubStep = 0;
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

        // Step forward one move
    stepForward() {
      if (this.currentStep >= this.moves.length) return false;

      const move = this.moves[this.currentStep];
      const count = Math.max(1, move.count ?? 1);

      if (this.currentSubStep < count) {
        // Execute one substep
        let dx = 0, dy = 0;
        if (move.dir === 'left') dx = -1;
        else if (move.dir === 'right') dx = 1;
        else if (move.dir === 'up') dy = -1;
        else if (move.dir === 'down') dy = 1;

        const ok = this.model.tryMovePiece(move.id, dx, dy);
        if (!ok) throw new Error(`Illegal move: {id:${move.id}, dx:${dx}, dy:${dy}}`);

        this.currentSubStep++;
        this.renderer.draw(this.model.selectedId);
        this.onProgress?.(this.getProgress());

        // Show status message for the step that was just executed
        const statusText = count > 1
          ? `Step ${this.currentStep + 1}: ${move.id} ${move.dir} ${count} times (${this.currentSubStep}/${count})`
          : `Step ${this.currentStep + 1}: ${move.id} ${move.dir}`;
        this.onStatus?.(statusText);

        // If we completed this move, advance to next
        if (this.currentSubStep >= count) {
          this.currentStep++;
          this.currentSubStep = 0;

          if (this.currentStep >= this.moves.length) {
            this.onComplete?.();
            return false;
          }
        }

        return true;
      } else if (this.currentStep < this.moves.length - 1) {
        // Move to next step if current step is complete
        this.currentStep++;
        this.currentSubStep = 0;
        return this.stepForward();
      }

      return false;
    }

    // Step backward one move
    stepBackward() {
      if (this.currentStep <= 0 && this.currentSubStep <= 0) return false;

                  if (this.currentSubStep > 0) {
        // Normal undo within or between steps
        this.undoLastMove();
        this.currentSubStep--;
        this.renderer.draw(this.model.selectedId);
        this.onProgress?.(this.getProgress());
        this.showCurrentStepStatus();
        return true;
      } else if (this.currentStep > 0) {
        // Check if we're going back to the very beginning (Step 1 to initial state)
        if (this.currentStep === 1 && this.currentSubStep === 0) {
          // Use the same logic as the rewind button since it works correctly
          this.reset();
          return true;
        }
        // Capture info about the move we're undoing
        const undoingMove = this.moves[this.currentStep];

        // Go back to previous move
        this.currentStep--;
        const move = this.moves[this.currentStep];
        const count = Math.max(1, move.count ?? 1);
        this.currentSubStep = count - 1;
        this.undoLastMove();
        this.renderer.draw(this.model.selectedId);
        this.onProgress?.(this.getProgress());

        // Show appropriate status message for current position
        this.showCurrentStepStatus();

        return true;
      } else if (this.currentStep === 0 && this.currentSubStep === 0) {
        // We're at the very beginning, can't go back further
        return false;
      }

      return false;
    }

    // Undo the last move that was made
    undoLastMove() {
      if (this.currentStep <= 0 && this.currentSubStep <= 0) return;

      const move = this.moves[this.currentStep];
      let dx = 0, dy = 0;
      if (move.dir === 'left') dx = 1; // Undo left = right
      else if (move.dir === 'right') dx = -1; // Undo right = left
      else if (move.dir === 'up') dy = 1; // Undo up = down
      else if (move.dir === 'down') dy = -1; // Undo down = up

      const ok = this.model.tryMovePiece(move.id, dx, dy);
      if (!ok) throw new Error(`Illegal undo move: {id:${move.id}, dx:${dx}, dy:${dy}}`);
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
        const statusText = count > 1
          ? `Step ${this.currentStep + 1}: ${move.id} ${move.dir} ${count} times`
          : `Step ${this.currentStep + 1}: ${move.id} ${move.dir}`;
        this.onStatus?.(statusText);

        // Animate current substep
        if (this.currentSubStep < count) {
          let dx = 0, dy = 0;
          if (move.dir === 'left') dx = -1;
          else if (move.dir === 'right') dx = 1;
          else if (move.dir === 'up') dy = -1;
          else if (move.dir === 'down') dy = 1;

                    const currentSpeed = this.getSpeed ? this.getSpeed() : this.msPerStep;
          await this.animateSingleStep(move.id, dx, dy, currentSpeed);

          // Check for pending pause after animation completes
          if (this.pendingPause) {
            this.isPaused = true;
            this.pendingPause = false;
          }

          this.currentSubStep++;
          this.onProgress?.(this.getProgress());

          // If we completed this move, advance to next
          if (this.currentSubStep >= count) {
            this.currentStep++;
            this.currentSubStep = 0;

            if (this.currentStep >= this.moves.length) {
              this.isPlaying = false;
              this.onComplete?.();
              break;
            }
          }
        }
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
      if (this.currentStep === 0 && this.currentSubStep === 0) {
        this.onStatus?.('Ready to solve');
        return;
      }

      if (this.currentStep >= this.moves.length) {
        this.onStatus?.(`Solution complete - ${this.moves.length} moves`);
        return;
      }

      // If we're at the beginning of a step (currentSubStep === 0),
      // show the previous completed step
      if (this.currentSubStep === 0 && this.currentStep > 0) {
        const prevMove = this.moves[this.currentStep - 1];
        const prevCount = Math.max(1, prevMove.count ?? 1);
        const statusText = prevCount > 1
          ? `Step ${this.currentStep}: ${prevMove.id} ${prevMove.dir} ${prevCount} times`
          : `Step ${this.currentStep}: ${prevMove.id} ${prevMove.dir}`;
        this.onStatus?.(statusText);
      } else {
        // Show current step in progress
        const move = this.moves[this.currentStep];
        const count = Math.max(1, move.count ?? 1);
        const statusText = count > 1
          ? `Step ${this.currentStep + 1}: ${move.id} ${move.dir} ${count} times (${this.currentSubStep}/${count})`
          : `Step ${this.currentStep + 1}: ${move.id} ${move.dir}`;
        this.onStatus?.(statusText);
      }
    }

    easeInOutSine(t) {
      return 0.5 - 0.5 * Math.cos(Math.PI * t);
    }
  }

  window.Klotski = window.Klotski || {};
  window.Klotski.animateMoves = animateMoves;
  window.Klotski.AnimationPlayer = AnimationPlayer;
})();
